/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:      '#FFFFFF',
        surface:      '#F8FAFC',
        surfaceAlt:   '#F1F5F9',
        dark:         '#0F172A',
        accent:       '#10B981',
        accentDark:   '#059669',
        accentLight:  '#D1FAE5',
        textPrimary:  '#1E293B',
        textSecondary:'#64748B',
        border:       '#E2E8F0',
        danger:       '#EF4444',
        warning:      '#F59E0B',
        info:         '#3B82F6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        soft:    '0 2px 15px -3px rgba(0,0,0,0.07), 0 10px 20px -2px rgba(0,0,0,0.04)',
        card:    '0 4px 25px -5px rgba(0,0,0,0.06), 0 10px 30px -5px rgba(0,0,0,0.04)',
        elevated:'0 10px 40px -10px rgba(0,0,0,0.1)',
        glow:    '0 0 30px rgba(16,185,129,0.15)',
      },
      animation: {
        'fade-in':       'fadeIn 0.6s ease-out',
        'slide-up':      'slideUp 0.6s ease-out',
        'float':         'float 6s ease-in-out infinite',
        'pulse-soft':    'pulseSoft 3s ease-in-out infinite',
        'count':         'count 2s ease-out',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:  { '0%': { opacity: '0', transform: 'translateY(30px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        float:    { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
        pulseSoft:{ '0%,100%': { opacity: '1' }, '50%': { opacity: '.7' } },
      },
    },
  },
  plugins: [],
}
