/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surfaces, darkest to lightest. 925 is the page under a raised card;
        // 900 is the card itself; 850 is a well *inside* a card (inputs, tiles).
        ink: {
          950: '#0A0C10',
          925: '#0C0F14',
          900: '#0F1216',
          850: '#141821',
          800: '#1A1F29',
          700: '#232A36',
          600: '#2E3644',
          500: '#3B4557',
        },
        // Text, brightest to dimmest
        fog: {
          100: '#EEF1F6',
          300: '#C3CAD6',
          500: '#8B94A5',
          700: '#5B6474',
          800: '#454E5E',
        },
        accent: { DEFAULT: '#7C9CFF', soft: '#A9BEFF', dim: '#3C4A78', deep: '#1D2748' },
        ok: '#3DD68C',
        warn: '#F5B84B',
        over: '#FF6B6B',
      },
      fontFamily: {
        // No webfonts anywhere: the bundle must render with zero network.
        // Three roles, all from stacks the OS already has.
        // — display: the register of an official document (headings only)
        display: ['ui-serif', 'Iowan Old Style', 'Palatino', 'Georgia', 'Times New Roman', 'serif'],
        // — sans: the interface itself
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        // — mono: every date and day count, i.e. the actual content of this app
        mono: ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      fontSize: {
        // The one size below 12px, reserved for stamp eyebrows.
        stamp: ['0.625rem', { lineHeight: '1', letterSpacing: '0.14em' }],
      },
      borderRadius: { xl2: '1.125rem', xl3: '1.5rem' },
      boxShadow: {
        lift: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.8)',
        pop: '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 24px 60px -20px rgba(0,0,0,0.95)',
      },
      transitionTimingFunction: {
        // One easing curve for the whole app.
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
