/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        wall: {
          bg: 'rgb(var(--wall-bg) / <alpha-value>)',
          surface: 'rgb(var(--wall-surface) / <alpha-value>)',
          border: 'rgb(var(--wall-border) / <alpha-value>)',
          muted: 'rgb(var(--wall-muted) / <alpha-value>)',
          subtle: 'rgb(var(--wall-subtle) / <alpha-value>)',
          text: 'rgb(var(--wall-text) / <alpha-value>)',
          'text-muted': 'rgb(var(--wall-text-muted) / <alpha-value>)',
          'text-dim': 'rgb(var(--wall-text-dim) / <alpha-value>)',
        },
      },
      animation: {
        'pulse-slow': 'pulse 1.5s ease-in-out infinite',
        'spin-fast': 'spin 0.8s linear infinite',
      },
    },
  },
  plugins: [],
};
