/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    // Couleurs des secteurs (src/lib/icons.tsx) et classes construites dans les utilitaires
    './src/lib/**/*.{js,ts,jsx,tsx}',
    './src/hooks/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Jetons de design ATTENDS : à utiliser plutôt que des valeurs écrites à la main
      colors: {
        orange: {
          50:  '#fff7ed',
          100: '#ffedd5',
          400: '#fb923c',
          500: '#f97316',
          600: '#9a3412',
          700: '#7c2d12',
        },
        brand: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          400: '#fb923c',
          DEFAULT: '#c2410c',
          600: '#9a3412',
          700: '#7c2d12',
        },
        ink: {
          DEFAULT: '#111827',
          muted: '#6b7280',
          subtle: '#6b7280',
        },
        surface: {
          DEFAULT: '#ffffff',
          sunken: '#f9fafb',
          line: '#f3f4f6',
        },
        success: { DEFAULT: '#16a34a', soft: '#dcfce7', ink: '#15803d' },
        warning: { DEFAULT: '#d97706', soft: '#fef3c7', ink: '#b45309' },
        danger:  { DEFAULT: '#dc2626', soft: '#fee2e2', ink: '#b91c1c' },
        info:    { DEFAULT: '#2563eb', soft: '#dbeafe', ink: '#1d4ed8' },
        blue: {
          deep: '#1E3A5F',
          mid:  '#2563EB',
        },
      },
      borderRadius: {
        card: '1rem',
        control: '0.875rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(17, 24, 39, 0.04), 0 1px 3px rgba(17, 24, 39, 0.06)',
        raised: '0 10px 30px -10px rgba(17, 24, 39, 0.25)',
      },
      // Transitions par défaut : sortie douce, alignée sur le système de mouvement (globals.css)
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.22, 1, 0.36, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        DEFAULT: '220ms',
      },
      minHeight: {
        touch: '48px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
