import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f4f4f2",
        panel: "#ffffff",
        ink: "#1b1b18",
        muted: "#6b6b66",
        line: "#e4e4e0",
        accent: {
          DEFAULT: "#5438f5",
          strong: "#4226d8",
          soft: "#efeaff",
          ink: "#3b2a9e",
        },
        good: "#177a3c",
        warn: "#b45309",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(24,24,20,0.05), 0 8px 24px rgba(24,24,20,0.06)",
        lift: "0 2px 4px rgba(24,24,20,0.06), 0 16px 40px rgba(24,24,20,0.12)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
