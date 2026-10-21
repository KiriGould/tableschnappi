/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        jp: {
          red:    '#CC0000',
          redDk:  '#990000',
          amber:  '#D4A017',
          gold:   '#FFB800',
          green:  '#22863a',
          bg:     '#0a0a14',
          surface:'#12121e',
          card:   '#1a1a2a',
          border: '#2a2a3e',
          text:   '#F0EDE6',
          muted:  '#9090a0',
        },
        neon: {
          pink:   '#ff2d75',
          cyan:   '#00f0ff',
          purple: '#9d4edd',
          orange: '#ff8a4c',
          yellow: '#ffd700',
        },
        status: {
          free:    '#22c55e',
          ordering:'#f59e0b',
          occupied:'#ef4444',
          payment: '#3b82f6',
          paid:    '#6b7280',
          cleaning:'#94a3b8',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"Noto Sans JP"', '"Hiragino Sans"', 'sans-serif'],
      },
      animation: {
        'pulse-soft': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'tool-slide-in': 'toolCallSlideIn 0.3s ease-out both',
        'scroll-hint': 'scrollHint 2s ease-in-out infinite',
        'neon-pulse': 'neonPulse 2s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
