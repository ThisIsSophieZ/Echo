/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./contents/**/*.{ts,tsx}",
    "./db/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        outline: "#727785",
        secondary: "#5b5f64",
        "tertiary-fixed": "#ffdbcb",
        "outline-variant": "#c1c6d6",
        "primary": "#005bbf",
        "surface-container-lowest": "#ffffff",
        "secondary-fixed": "#dfe3e8",
        "tertiary": "#9e4300",
        "secondary-container": "#dde0e6",
        "on-surface-variant": "#414754",
        "surface-bright": "#f9f9ff",
        "surface-container-low": "#f2f3fd",
        "primary-fixed-dim": "#adc7ff",
        "surface-container": "#ecedf7",
        "primary-container": "#1a73e8",
        "surface-tint": "#005bc0",
        "surface-dim": "#d8d9e3",
        "on-surface": "#191c23",
        "inverse-surface": "#2d3038",
        "tertiary-container": "#c55500",
        "tertiary-fixed-dim": "#ffb691",
        "error": "#ba1a1a",
        "on-tertiary": "#ffffff",
        "on-primary-container": "#ffffff",
        "surface-variant": "#e0e2ec",
        "error-container": "#ffdad6",
        "primary-fixed": "#d8e2ff",
        "on-primary-fixed": "#001a41",
        "inverse-primary": "#adc7ff",
        "on-secondary-container": "#5f6368",
        "surface-container-highest": "#e0e2ec",
        "surface-container-high": "#e6e8f2",
        "background": "#f9f9ff",
        "on-primary": "#ffffff",
        "on-secondary-fixed": "#181c20",
        "on-error": "#ffffff",
        "surface": "#f9f9ff",
        "on-background": "#191c23"
      },
      borderRadius: {
        DEFAULT: "4px",
        lg: "8px",
        xl: "12px",
        full: "9999px"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"]
      },
      fontSize: {
        "headline-sm": ["16px", { lineHeight: "24px", letterSpacing: "0px", fontWeight: "600" }],
        "label-sm": ["10px", { lineHeight: "12px", letterSpacing: "0px", fontWeight: "500" }],
        "body-md": ["13px", { lineHeight: "20px", letterSpacing: "0px", fontWeight: "400" }],
        "label-md": ["11px", { lineHeight: "16px", letterSpacing: "0.5px", fontWeight: "500" }],
        "body-sm": ["12px", { lineHeight: "16px", letterSpacing: "0px", fontWeight: "400" }]
      },
      spacing: {
        gutter: "12px",
        "stack-md": "8px",
        unit: "4px",
        "margin-side": "16px",
        "stack-sm": "4px",
        "stack-lg": "16px"
      }
    }
  },
  plugins: []
}
