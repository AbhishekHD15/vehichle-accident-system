/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F766E',
          hover: '#115E59',
          light: '#F0FDFA',
        },
        sidebar: {
          bg: '#0B1F2A',
          text: '#CBD5E1',
          active: 'rgba(15,118,110,0.18)',
          accent: '#14B8A6',
          hover: '#132B3A',
        },
        app: {
          bg: '#F6F8FA',
          card: '#FFFFFF',
          border: '#E2E8F0',
          text: '#0F172A',
          muted: '#64748B',
        },
        semantic: {
          success: '#16A34A',
          warning: '#F59E0B',
          danger: '#DC2626',
          info: '#0284C7',
          orange: '#EA580C',
        },
        navy: {
          900: '#0B1F2A',
          800: '#132B3A',
          700: '#1B384B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        soft: '0 1px 3px rgba(15, 23, 42, 0.08)',
        card: '0 1px 3px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
}
