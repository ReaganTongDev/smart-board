import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/client/**/*.{ts,tsx}",
  ],
  // Dark mode controlled by `class` on <html> (we always enable dark)
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        slate: {
          // Custom mid-point between slate-800 (#1e293b) and slate-900 (#0f172a)
          850: "#172033",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.15s ease-out",
        "slide-up": "slideUp 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
