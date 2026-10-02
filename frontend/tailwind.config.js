/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Cormorant Garamond"', "ui-serif", "Georgia", "serif"],
        sans: ['"Outfit"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        sand: "#F7F5F0",
        surface: "#EFECE5",
        forest: "#2D4A22",
        moss: "#5C6B52",
        terracotta: "#C65D47",
        butter: "#F4C96B",
        coral: "#E78A6F",
        sky: "#CFE1D5",
        ink: "#1C231A",
        border: "rgba(45,74,34,0.18)",
        background: "#F7F5F0",
        foreground: "#1C231A",
        card: { DEFAULT: "#EFECE5", foreground: "#1C231A" },
        popover: { DEFAULT: "#F7F5F0", foreground: "#1C231A" },
        primary: { DEFAULT: "#2D4A22", foreground: "#F7F5F0" },
        secondary: { DEFAULT: "#5C6B52", foreground: "#F7F5F0" },
        muted: { DEFAULT: "#EFECE5", foreground: "#5C6B52" },
        accent: { DEFAULT: "#C65D47", foreground: "#F7F5F0" },
        destructive: { DEFAULT: "#A23A2A", foreground: "#F7F5F0" },
        input: "rgba(45,74,34,0.2)",
        ring: "#2D4A22",
      },
      borderRadius: { lg: "0.5rem", md: "0.375rem", sm: "0.25rem" },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "fade-up": { from: { opacity: 0, transform: "translateY(12px)" }, to: { opacity: 1, transform: "translateY(0)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.6s ease-out both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
