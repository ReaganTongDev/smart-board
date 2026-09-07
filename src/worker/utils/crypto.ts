/**
 * Crypto utilities using the Web Crypto API (globalThis.crypto).
 * These are fully compatible with Cloudflare Workers — no Node.js crypto module required.
 */

/** SHA-256 hex digest of a UTF-8 string */
export async function sha256Hex(message: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(message)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a cryptographically-secure random hex string (64 chars = 256 bits).
 * Used for raw API bearer tokens before hashing.
 */
export function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generate a UUID v4 using the built-in randomUUID() */
export function generateId(): string {
  return crypto.randomUUID();
}
