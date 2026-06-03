/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#0b0f19",
        cardBg: "#111827",
        panelBorder: "#1f2937",
        indigoAccent: "#6366f1",
        indigoGlow: "#4f46e5",
        textPrimary: "#f8fafc",
        textSecondary: "#94a3b8",
        successGreen: "#10b981",
        dangerRed: "#991b1b"
      }
    },
  },
  plugins: [],
}
