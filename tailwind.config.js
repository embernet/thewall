/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        wall: {
          bg: '#020617',
          surface: '#0f172a',
          border: '#1e293b',
          muted: '#334155',
          subtle: '#475569',
          text: '#e2e8f0',
          'text-muted': '#94a3b8',
          'text-dim': '#64748b',
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
