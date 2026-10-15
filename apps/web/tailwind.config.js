/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark Immersive Backgrounds
        dark: {
          primary: '#0B0B0C',
          secondary: '#141517',
          elevated: '#1B1D20',
          border: '#2A2C30',
        },
        // Light Workspace Surfaces
        light: {
          bg: '#F6F7F9',
          card: '#FFFFFF',
          subtle: '#F1F5F9',
        },
        // Premium Accent Colors
        accent: {
          cyan: '#22D3EE',
          blue: '#3B82F6',
          violet: '#8B5CF6',
          magenta: '#D946EF',
        },
        // Semantic colors
        success: '#16A34A',
        warning: '#F59E0B',
        error: '#DC2626',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      fontSize: {
        'fluid-xs': 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',
        'fluid-sm': 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)',
        'fluid-base': 'clamp(1rem, 0.925rem + 0.4vw, 1.125rem)',
        'fluid-lg': 'clamp(1.125rem, 1rem + 0.6vw, 1.375rem)',
        'fluid-xl': 'clamp(1.25rem, 1.1rem + 0.75vw, 1.75rem)',
        'fluid-2xl': 'clamp(1.5rem, 1.3rem + 1vw, 2.25rem)',
        'fluid-3xl': 'clamp(1.875rem, 1.5rem + 1.5vw, 3rem)',
        'fluid-4xl': 'clamp(2.25rem, 1.75rem + 2vw, 3.75rem)',
        'fluid-5xl': 'clamp(3rem, 2.25rem + 3vw, 4.5rem)',
      },
      borderRadius: {
        'pill': '999px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(22, 24, 29, 0.08), 0 1px 2px rgba(22, 24, 29, 0.04)',
        'card-hover': '0 8px 24px rgba(34, 211, 238, 0.12), 0 4px 8px rgba(34, 211, 238, 0.08)',
        'glow-cyan': '0 0 24px rgba(34, 211, 238, 0.3), 0 0 48px rgba(34, 211, 238, 0.15)',
        'glow-violet': '0 0 24px rgba(139, 92, 246, 0.3), 0 0 48px rgba(139, 92, 246, 0.15)',
        'glow-blue': '0 0 24px rgba(59, 130, 246, 0.3), 0 0 48px rgba(59, 130, 246, 0.15)',
        'dark': '0 8px 32px rgba(11, 11, 12, 0.6)',
      },
      animation: {
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
        'dash-flow': 'dash-flow 20s linear infinite',
        'signal-flow': 'signal-flow 3s ease-in-out infinite',
      },
      keyframes: {
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'pulse-glow': {
          '0%, 100%': { 
            opacity: '1',
            boxShadow: '0 0 12px rgba(34, 211, 238, 0.5)',
          },
          '50%': {
            opacity: '0.8',
            boxShadow: '0 0 24px rgba(34, 211, 238, 0.8)',
          },
        },
        'signal-flow': {
          '0%': {
            transform: 'translateX(-100%)',
            opacity: '0',
          },
          '50%': {
            opacity: '1',
          },
          '100%': {
            transform: 'translateX(400%)',
            opacity: '0',
          },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'dash-flow': {
          'to': { strokeDashoffset: '-100' },
        },
      },
    },
  },
  plugins: [],
};
