import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bahnschrift"', '"Aptos Display"', '"Segoe UI"', "sans-serif"],
        body: ['"Segoe UI Variable Text"', '"Aptos"', '"Segoe UI"', "sans-serif"]
      },
      colors: {
        ink: "#07110b",
        panel: "#101d15",
        panelSoft: "#15241b",
        glow: "#1ed760",
        glowSoft: "#6df0a0",
        rose: "#ff7ab6"
      },
      boxShadow: {
        halo: "0 0 0 1px rgba(255,255,255,0.05), 0 24px 80px rgba(0,0,0,0.45)"
      },
      backgroundImage: {
        "hero-grid":
          "radial-gradient(circle at top left, rgba(30,215,96,0.2), transparent 35%), radial-gradient(circle at top right, rgba(255,122,182,0.16), transparent 25%), linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 55%)"
      },
      animation: {
        drift: "drift 12s ease-in-out infinite",
        pulseGlow: "pulseGlow 2.8s ease-in-out infinite"
      },
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(0, -10px, 0)" }
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 rgba(30,215,96,0.15)" },
          "50%": { boxShadow: "0 0 0 14px rgba(30,215,96,0.02)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
