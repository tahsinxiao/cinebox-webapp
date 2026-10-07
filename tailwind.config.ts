import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#05050a",
          900: "#0a0a12",
          850: "#0f0f1a",
          800: "#141427",
          700: "#1d1d33",
          600: "#2a2a45",
        },
        brand: {
          50: "#f3edff",
          200: "#d4bcff",
          300: "#b794ff",
          400: "#9a6bff",
          500: "#7b3dff",
          600: "#5b21d6",
          700: "#3f16a0",
          900: "#1b0a4d",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 18px 50px -12px rgba(0,0,0,.85)",
        glow: "0 0 0 2px rgba(154,107,255,.6), 0 18px 60px -12px rgba(123,61,255,.55)",
      },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "none" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-up": "fade-up .5s cubic-bezier(.2,.7,.3,1) both",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
