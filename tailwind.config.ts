import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0b1120",
          raised: "#111a2e",
          border: "#1e2a44",
        },
      },
    },
  },
  plugins: [],
};
export default config;
