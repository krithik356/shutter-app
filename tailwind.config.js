/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#15171B', 2: '#1C1F24', 3: '#24282F' },
        hair: '#33373E',
        paper: '#F4F1EA',
        safelight: { DEFAULT: '#D6402C', dim: '#3A2320' },
        gold: '#C9A227',
        muted: '#66625B',
        secondary: '#9C9890',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}

