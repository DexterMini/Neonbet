import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ─── Ultra-dark casino palette (Shuffle/Winna style) ─── */
        background: {
          DEFAULT: '#0A0B0F',
          deep:    '#060709',
          secondary: '#0E1015',
          tertiary:  '#12141A',
          elevated:  '#171A21',
          hover:     '#1C1F27',
        },
        surface: {
          DEFAULT:  '#141620',
          light:    '#1A1D28',
          lighter:  '#222530',
        },
        border: {
          DEFAULT: '#1A1D28',
          light:   '#242835',
          accent:  '#2E3340',
        },

        /* ─── Green primary (Shuffle/Winna style) ─── */
        brand: {
          DEFAULT: '#00E87B',
          light:   '#33FF9E',
          lighter: '#66FFB8',
          dark:    '#00C968',
          darker:  '#00A555',
          muted:   'rgba(0, 232, 123, 0.12)',
        },

        /* ─── Semantic / UI colors ─── */
        accent: {
          green:  '#00E87B',
          red:    '#FF4757',
          amber:  '#FFB84D',
          blue:   '#5B8DEF',
          purple: '#9B6DFF',
          cyan:   '#00D4FF',
        },

        /* ─── Text ─── */
        muted: {
          DEFAULT: '#565B6B',
          light:   '#9CA3B8',
          dark:    '#3D4150',
        },

        /* ─── Text semantic aliases ─── */
        text: {
          primary:   '#E8EAF0',
          secondary: '#9CA3B8',
          muted:     '#565B6B',
        },
      },

      fontFamily: {
        sans: [
          'var(--font-inter)', 'Inter', '-apple-system', 'BlinkMacSystemFont',
          'system-ui', 'Segoe UI', 'sans-serif',
        ],
        mono: [
          'var(--font-mono)', 'JetBrains Mono', 'SF Mono', 'Menlo', 'Monaco',
          'monospace',
        ],
        display: [
          'var(--font-inter)', 'Inter', '-apple-system', 'BlinkMacSystemFont',
          'system-ui', 'sans-serif',
        ],
      },

      fontSize: {
        '2xs':  ['0.625rem', { lineHeight: '0.875rem' }],
        'hero': ['3.5rem',   { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'h1':   ['2.25rem',  { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        'h2':   ['1.75rem',  { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '600' }],
        'h3':   ['1.375rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        'h4':   ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        'body':  ['0.9375rem', { lineHeight: '1.6' }],
        'small': ['0.8125rem', { lineHeight: '1.5' }],
        'tiny':  ['0.6875rem', { lineHeight: '1.4' }],
      },

      spacing: {
        '4.5': '1.125rem',
        '18':  '4.5rem',
        '88':  '22rem',
        '128': '32rem',
      },

      borderRadius: {
        'xl': '0.875rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '2rem',
      },

      animation: {
        'fade-in':        'fadeIn 0.3s ease-out',
        'fade-up':        'fadeUp 0.4s ease-out',
        'fade-down':      'fadeDown 0.4s ease-out',
        'scale-in':       'scaleIn 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-left':  'slideInLeft 0.3s ease-out',
        'shimmer':        'shimmer 2s linear infinite',
        'pulse-subtle':   'pulseSubtle 3s ease-in-out infinite',
        'spin-slow':      'spin 3s linear infinite',
      },

      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeDown: {
          '0%':   { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.7' },
        },
      },

      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'shimmer': 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
        'glow-gold': 'radial-gradient(circle at center, rgba(0, 232, 123, 0.06) 0%, transparent 70%)',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
      },

      boxShadow: {
        'soft-xs': '0 1px 2px rgba(0, 0, 0, 0.4)',
        'soft-sm': '0 2px 8px rgba(0, 0, 0, 0.4)',
        'soft':    '0 4px 16px rgba(0, 0, 0, 0.45)',
        'soft-lg': '0 8px 32px rgba(0, 0, 0, 0.5)',
        'soft-xl': '0 16px 48px rgba(0, 0, 0, 0.6)',
        'glow-brand-sm': '0 0 12px rgba(0, 232, 123, 0.15)',
        'glow-brand':    '0 0 24px rgba(0, 232, 123, 0.2)',
        'glow-brand-lg': '0 0 48px rgba(0, 232, 123, 0.25)',
        'glow-gold-sm': '0 0 12px rgba(0, 232, 123, 0.15)',
        'glow-gold':    '0 0 24px rgba(0, 232, 123, 0.2)',
        'glow-gold-lg': '0 0 48px rgba(0, 232, 123, 0.25)',
        'glow-green':   '0 0 20px rgba(0, 232, 123, 0.25)',
        'glow-red':     '0 0 20px rgba(255, 71, 87, 0.2)',
        'inner-soft': 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
      },

      transitionDuration: {
        '250': '250ms',
        '400': '400ms',
      },

      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

export default config
