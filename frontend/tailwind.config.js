/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep near-black with a teal tint — the app's base surface scale.
        ink: {
          950: "#070B0A",
          900: "#0B1210",
          800: "#121B18",
          700: "#1A2622",
          600: "#263430",
        },
        // Fixed semantic colors for the four decision levels (Phase 7+).
        signal: {
          allow: "#34D399", // emerald — ALLOW (0-29)
          warn: "#FBBF24", // amber — WARN (30-59)
          verify: "#FB923C", // orange — VERIFY (60-79)
          block: "#F43F5E", // rose — BLOCK (80-100)
        },
      },
      fontFamily: {
        sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        mono: 'ui-monospace, "Cascadia Code", Consolas, "Courier New", monospace',
      },
    },
  },
  plugins: [],
};
