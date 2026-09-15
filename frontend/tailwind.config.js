/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic, theme-aware tokens — the RGB triplets flip under `.dark`
        // (see src/index.css), so one set of class names styles both themes.
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        surface2: "rgb(var(--c-surface-2) / <alpha-value>)",
        line: "rgb(var(--c-border) / <alpha-value>)",
        line2: "rgb(var(--c-border-strong) / <alpha-value>)",
        fg: "rgb(var(--c-text) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        faint: "rgb(var(--c-faint) / <alpha-value>)",
        accent: "rgb(var(--c-accent) / <alpha-value>)",
        accentContrast: "rgb(var(--c-accent-contrast) / <alpha-value>)",
        ok: "rgb(var(--c-ok) / <alpha-value>)",
        warn: "rgb(var(--c-warn) / <alpha-value>)",
        check: "rgb(var(--c-check) / <alpha-value>)",
        stop: "rgb(var(--c-stop) / <alpha-value>)",
      },
      fontFamily: {
        sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        mono: 'ui-monospace, "Cascadia Code", Consolas, "Courier New", monospace',
      },
    },
  },
  plugins: [],
};
