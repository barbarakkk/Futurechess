/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(214 32% 88%)",
        input: "hsl(214 32% 88%)",
        ring: "hsl(211 100% 50%)",
        background: "hsl(214 100% 97%)",
        foreground: "hsl(222 47% 20%)",
        primary: {
          DEFAULT: "hsl(211 100% 50%)",
          foreground: "hsl(0 0% 100%)",
        },
        secondary: {
          DEFAULT: "hsl(214 100% 94%)",
          foreground: "hsl(222 47% 20%)",
        },
        muted: {
          DEFAULT: "hsl(214 60% 92%)",
          foreground: "hsl(215 25% 45%)",
        },
        accent: {
          DEFAULT: "hsl(199 89% 48%)",
          foreground: "hsl(0 0% 100%)",
        },
        card: {
          DEFAULT: "hsl(0 0% 100%)",
          foreground: "hsl(222 47% 20%)",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      boxShadow: {
        soft: "0 4px 24px -4px hsl(211 100% 50% / 0.12)",
      },
    },
  },
  plugins: [],
};
