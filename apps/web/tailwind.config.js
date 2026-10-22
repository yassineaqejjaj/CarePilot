/** Jetons issus de la planche « Système de design CarePilot v1.0 ». */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    fontFamily: { sans: ['"Inter Variable"', "Inter", "system-ui", "sans-serif"] },
    extend: {
      colors: {
        navy: { 900: "#14263D", 700: "#2A3F5C" },
        teal: { 700: "#127572", 500: "#168C88", 800: "#0E5E5B" },
        mint: { 100: "#E0F4EE", 300: "#9FE3D4" },
        signal: "#3CC2B0",
        ink: { DEFAULT: "#233044", 2: "#5B6678" },
        line: { DEFAULT: "#E3E8EC", strong: "#CBD3DB" },
        surface: { DEFAULT: "#FFFFFF", 2: "#F1F4F6" },
        page: "#F8FAFB",
        success: { DEFAULT: "#279A70", text: "#1E7A58", bg: "#E3F4EC" },
        warning: { DEFAULT: "#D99730", text: "#8A5A12", bg: "#FBF0DC" },
        info: { DEFAULT: "#4A7BC8", text: "#2F5C9E", bg: "#E6EEF9" },
        critical: { DEFAULT: "#CD5962", text: "#B23A47", bg: "#FBE7E9" },
      },
      borderRadius: { tag: "6px", ctl: "8px", card: "12px", panel: "16px" },
      boxShadow: {
        card: "0 1px 2px rgba(20,38,61,.06)",
        menu: "0 4px 12px rgba(20,38,61,.08)",
        modal: "0 12px 32px rgba(20,38,61,.14)",
      },
      fontSize: { meta: ["12px", "16px"], body: ["14px", "21px"], patient: ["16px", "24px"] },
    },
  },
  plugins: [],
};
