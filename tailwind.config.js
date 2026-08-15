/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./sidepanel.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        meta: {
          blue: '#0064E0',
          darkBlue: '#004BB5',
          bg: '#0F172A',
          card: '#1E293B',
          border: '#334155',
          hover: '#475569',
          purple: '#7C3AED',
          accent: '#06B6D4'
        }
      }
    },
  },
  plugins: [],
}
