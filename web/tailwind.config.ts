import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1E2238",
          light: "#252A45",
          border: "#2D3452",
        },
        teal: {
          DEFAULT: "#00BCD4",
          light: "#4DD0E1",
        },
        brand: {
          blue: "#2563EB",
        },
      },
      borderRadius: {
        lg: "10px",
        md: "8px",
        sm: "6px",
      },
    },
  },
  plugins: [],
};

export default config;
