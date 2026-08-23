import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Hetex AI brand identity
        hetex: {
          green: {
            50: "#eefdf4",
            100: "#d6fae3",
            200: "#adf3cb",
            300: "#72e6a9",
            400: "#37cf80",
            500: "#14b366",
            600: "#0a9153",
            700: "#0a7345",
            800: "#0b5b3a",
            900: "#0a4b31",
          },
          blue: {
            50: "#eef6ff",
            100: "#d9eaff",
            200: "#bcdaff",
            300: "#8ec2ff",
            400: "#589fff",
            500: "#3178f5",
            600: "#1f5aeb",
            700: "#1a47d1",
            800: "#1c3aa8",
            900: "#1c3484",
          },
          red: {
            500: "#ef4444",
          },
          yellow: {
            500: "#f5bb1e",
          },
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
