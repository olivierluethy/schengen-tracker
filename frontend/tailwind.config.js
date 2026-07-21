/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surfaces, darkest to lightest
        ink: {
          950: '#0A0C10',
          900: '#0F1216',
          850: '#141821',
          800: '#1A1F29',
          700: '#232A36',
          600: '#2E3644',
        },
        // Text, brightest to dimmest
        fog: {
          100: '#EEF1F6',
          300: '#C3CAD6',
          500: '#8B94A5',
          700: '#5B6474',
        },
        accent: { DEFAULT: '#7C9CFF', soft: '#A9BEFF', dim: '#3C4A78' },
        ok: '#3DD68C',
        warn: '#F5B84B',
        over: '#FF6B6B',
      },
      fontFamily: {
        // No webfonts: the bundle must work with zero network.
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      borderRadius: { xl2: '1.125rem' },
      boxShadow: {
        lift: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.8)',
      },
    },
  },
  plugins: [],
}
