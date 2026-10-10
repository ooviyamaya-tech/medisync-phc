/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        teal: { 50: '#effaf8', 100: '#d9f2ef', 500: '#0d9488', 600: '#087f79', 700: '#086b68', 900: '#143a3a' },
        ink: '#183334',
      },
      fontFamily: { sans: ['DM Sans', 'sans-serif'], display: ['Manrope', 'sans-serif'] },
      boxShadow: { soft: '0 10px 35px rgba(18, 69, 65, .07)' },
    },
  },
  plugins: [],
};