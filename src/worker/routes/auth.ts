import { Hono } from "hono";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import { getSignedCookie, setSignedCookie, deleteCookie } from "hono/cookie";
import type { AppType } from "../index";
import { generateId } from "../utils/crypto";
import type { PasskeyCredential } from "../db";

const auth = new Hono<AppType>();

// ─── Cookie names ────────────────────────────────────────────────
const CHALLENGE_COOKIE = "wa_challenge"; // Signed; holds the WebAuthn challenge string
const PENDING_COOKIE = "wa_pending"; // Signed; holds pending registration/login state JSON
const SESSION_COOKIE = "session"; // Signed; holds the authenticated userId

// ─── Dynamic Cookie Options Helper ────────────────────────────────
// Dynamically detects HTTPS and cross-origin deployment (e.g. Pages frontend to Workers backend)
function getCookieOpts(
  c: { env: { ORIGIN?: string } },
  maxAge?: number
) {
  const isHttps = c.env.ORIGIN?.startsWith("https://") ?? false;
  // If production HTTPS and cross-origin, SameSite=None and Secure=true are required
  const isCrossOrigin = isHttps && !c.env.ORIGIN?.includes("localhost");
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: isCrossOrigin ? ("None" as const) : ("Lax" as const),
    path: "/",
    ...(maxAge !== undefined ? { maxAge } : {}),
  };
}

// ─── GET /api/auth/me ─────────────────────────────────────────────
auth.get("/me", async (c) => {
  const userId = await getSignedCookie(c, c.env.SESSION_SECRET, SESSION_COOKIE);
  if (!userId) return c.json({ user: null });

  const user = await c.env.DB.prepare(
    "SELECT id, email, created_at FROM users WHERE id = ?"
  )
    .bind(userId)
    .first<{ id: string; email: string; created_at: string }>();

  return c.json({ user: user ?? null });
});

// ─── POST /api/auth/register/options ─────────────────────────────
// Step 1 of registration: server generates a challenge, returns PublicKeyCredentialCreationOptions
auth.post("/register/options", async (c) => {
  const body = await c.req.json<{ email?: string }>();
  const email = body.email?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return c.json({ error: "A valid email address is required" }, 400);
  }

  // If the user already exists, get their credentials to pass as excludeCredentials
  // so the authenticator won't create a duplicate passkey for the same device.
  const existingUser = await c.env.DB.prepare(
    "SELECT id FROM users WHERE email = ?"
  )
    .bind(email)
    .first<{ id: string }>();

  const userId = existingUser?.id ?? generateId();

  let excludeCredentials: { id: string; transports?: AuthenticatorTransport[] }[] =
    [];

  if (existingUser) {
    const { results } = await c.env.DB.prepare(
      "SELECT id, transports FROM passkey_credentials WHERE user_id = ?"
    )
      .bind(userId)
      .all<{ id: string; transports: string | null }>();

    excludeCredentials = results.map((r) => ({
      id: r.id,
      transports: r.transports
        ? (JSON.parse(r.transports) as AuthenticatorTransport[])
        : undefined,
    }));
  }

  const options = await generateRegistrationOptions({
    rpName: "Smartboard",
    rpID: c.env.RP_ID,
    userID: isoUint8Array.fromUTF8String(userId),
    userName: email,
    userDisplayName: email,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    excludeCredentials,
  });

  // Store the challenge and pending state in signed, short-lived cookies.
  // This replaces a server-side challenge table — stateless and simple.
  await setSignedCookie(
    c,
    CHALLENGE_COOKIE,
    options.challenge,
    c.env.SESSION_SECRET,
    getCookieOpts(c, 300)
  );
  await setSignedCookie(
    c,
    PENDING_COOKIE,
    JSON.stringify({ userId, email, isNew: !existingUser }),
    c.env.SESSION_SECRET,
    getCookieOpts(c, 300)
  );

  return c.json(options);
});

// ─── POST /api/auth/register/verify ──────────────────────────────
// Step 2 of registration: verify the authenticator's response
auth.post("/register/verify", async (c) => {
  const [challenge, pendingStr] = await Promise.all([
    getSignedCookie(c, c.env.SESSION_SECRET, CHALLENGE_COOKIE),
    getSignedCookie(c, c.env.SESSION_SECRET, PENDING_COOKIE),
  ]);

  if (!challenge || !pendingStr) {
    return c.json(
      {
        error:
          "Registration session expired — please start again (challenge cookies missing or tampered with)",
      },
      400
    );
  }

  const pending = JSON.parse(pendingStr) as {
    userId: string;
    email: string;
    isNew: boolean;
  };

  let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
  try {
    verification = await verifyRegistrationResponse({
      response: await c.req.json(),
      expectedChallenge: challenge,
      expectedOrigin: c.env.ORIGIN,
      expectedRPID: c.env.RP_ID,
      requireUserVerification: true,
    });
  } catch (err) {
    console.error("Registration verification failed:", err);
    return c.json(
      { error: "Verification failed", detail: String(err) },
      400
    );
  }

  if (!verification.verified || !verification.registrationInfo) {
    return c.json({ error: "Verification failed" }, 400);
  }

  const { credential } = verification.registrationInfo;

  // Persist user (if new) and the new passkey credential
  if (pending.isNew) {
    await c.env.DB.prepare("INSERT INTO users (id, email) VALUES (?, ?)")
      .bind(pending.userId, pending.email)
      .run();
  }

  await c.env.DB.prepare(
    `INSERT OR REPLACE INTO passkey_credentials
       (id, user_id, public_key, counter, transports)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(
      credential.id,
      pending.userId,
      credential.publicKey, // Uint8Array → D1 stores as BLOB
      credential.counter,
      credential.transports ? JSON.stringify(credential.transports) : null
    )
    .run();

  // Clear the short-lived challenge cookies and set a session cookie
  deleteCookie(c, CHALLENGE_COOKIE, getCookieOpts(c));
  deleteCookie(c, PENDING_COOKIE, getCookieOpts(c));
  await setSignedCookie(
    c,
    SESSION_COOKIE,
    pending.userId,
    c.env.SESSION_SECRET,
    getCookieOpts(c, 60 * 60 * 24 * 7)
  );

  const user = await c.env.DB.prepare(
    "SELECT id, email, created_at FROM users WHERE id = ?"
  )
    .bind(pending.userId)
    .first();

  return c.json({ verified: true, user });
});

// ─── POST /api/auth/login/options ────────────────────────────────
// Step 1 of authentication: generate a challenge (email is optional)
auth.post("/login/options", async (c) => {
  const body = await c.req.json<{ email?: string }>();
  const email = body.email?.trim().toLowerCase();

  let allowCredentials: { id: string; transports?: AuthenticatorTransport[] }[] =
    [];
  let hintedUserId: string | null = null;

  // If email provided, scope the challenge to that user's credentials.
  // If no email, use discoverable credential flow (passkey picker shows all saved passkeys).
  if (email) {
    const user = await c.env.DB.prepare(
      "SELECT id FROM users WHERE email = ?"
    )
      .bind(email)
      .first<{ id: string }>();

    if (user) {
      hintedUserId = user.id;
      const { results } = await c.env.DB.prepare(
        "SELECT id, transports FROM passkey_credentials WHERE user_id = ?"
      )
        .bind(user.id)
        .all<{ id: string; transports: string | null }>();

      allowCredentials = results.map((r) => ({
        id: r.id,
        transports: r.transports
          ? (JSON.parse(r.transports) as AuthenticatorTransport[])
          : undefined,
      }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: c.env.RP_ID,
    allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    userVerification: "preferred",
  });

  await setSignedCookie(
    c,
    CHALLENGE_COOKIE,
    options.challenge,
    c.env.SESSION_SECRET,
    getCookieOpts(c, 300)
  );
  await setSignedCookie(
    c,
    PENDING_COOKIE,
    JSON.stringify({ userId: hintedUserId }),
    c.env.SESSION_SECRET,
    getCookieOpts(c, 300)
  );

  return c.json(options);
});

// ─── POST /api/auth/login/verify ─────────────────────────────────
// Step 2 of authentication: verify the authenticator's signature
auth.post("/login/verify", async (c) => {
  const [challenge] = await Promise.all([
    getSignedCookie(c, c.env.SESSION_SECRET, CHALLENGE_COOKIE),
    getSignedCookie(c, c.env.SESSION_SECRET, PENDING_COOKIE),
  ]);

  if (!challenge) {
    return c.json(
      {
        error:
          "Authentication session expired — please start again",
      },
      400
    );
  }

  const body = await c.req.json<{ id?: string }>();
  const credentialId = body.id;

  if (!credentialId) {
    return c.json({ error: "Missing credential id" }, 400);
  }

  // Look up the credential by its ID
  const cred = await c.env.DB.prepare(
    "SELECT * FROM passkey_credentials WHERE id = ?"
  )
    .bind(credentialId)
    .first<PasskeyCredential>();

  if (!cred) {
    return c.json({ error: "Unknown credential — not registered" }, 400);
  }

  let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
  try {
    verification = await verifyAuthenticationResponse({
      response: body as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
      expectedChallenge: challenge,
      expectedOrigin: c.env.ORIGIN,
      expectedRPID: c.env.RP_ID,
      credential: {
        id: cred.id,
        // D1 returns BLOB as ArrayBuffer; wrap in Uint8Array for SimpleWebAuthn
        publicKey: new Uint8Array(cred.public_key),
        counter: cred.counter,
        transports: cred.transports
          ? (JSON.parse(cred.transports) as AuthenticatorTransport[])
          : undefined,
      },
    });
  } catch (err) {
    console.error("Authentication verification failed:", err);
    return c.json(
      { error: "Authentication failed", detail: String(err) },
      401
    );
  }

  if (!verification.verified) {
    return c.json({ error: "Authentication failed" }, 401);
  }

  // Update the counter (prevents clone / replay attacks)
  await c.env.DB.prepare(
    "UPDATE passkey_credentials SET counter = ? WHERE id = ?"
  )
    .bind(verification.authenticationInfo.newCounter, cred.id)
    .run();

  // Clear challenge cookies and establish a session
  deleteCookie(c, CHALLENGE_COOKIE, getCookieOpts(c));
  deleteCookie(c, PENDING_COOKIE, getCookieOpts(c));
  await setSignedCookie(
    c,
    SESSION_COOKIE,
    cred.user_id,
    c.env.SESSION_SECRET,
    getCookieOpts(c, 60 * 60 * 24 * 7)
  );

  const user = await c.env.DB.prepare(
    "SELECT id, email, created_at FROM users WHERE id = ?"
  )
    .bind(cred.user_id)
    .first();

  return c.json({ verified: true, user });
});

// ─── POST /api/auth/logout ────────────────────────────────────────
auth.post("/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, getCookieOpts(c));
  return c.json({ ok: true });
});

export { auth as authRoutes };
