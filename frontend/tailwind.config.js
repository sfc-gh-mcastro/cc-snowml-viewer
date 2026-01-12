/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'pool': {
          bg: '#fef9c3',
          border: '#facc15',
        },
        'service': {
          bg: '#d1fae5',
          border: '#10b981',
        },
        'notebook': {
          bg: '#dbeafe',
          border: '#3b82f6',
        },
        'eai': {
          bg: '#f3e8ff',
          border: '#a855f7',
        },
      },
    },
  },
  plugins: [],
}
