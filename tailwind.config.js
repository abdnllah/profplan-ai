/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
          hover: 'hsl(var(--muted) / <alpha-value>)',
          border: 'hsl(var(--border) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
          hover: '#EAB308',
          active: '#CA8A04',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
          subtle: 'hsl(var(--primary) / 0.12)',
          border: 'hsl(var(--primary) / 0.35)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        surface: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          subtle: 'hsl(var(--secondary) / <alpha-value>)',
          border: 'hsl(var(--border) / <alpha-value>)',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar) / <alpha-value>)',
          foreground: 'hsl(var(--sidebar-foreground) / <alpha-value>)',
          border: 'hsl(var(--sidebar-border) / <alpha-value>)',
          primary: 'hsl(var(--primary) / <alpha-value>)',
          'primary-foreground': 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        text: {
          primary: 'hsl(var(--foreground) / <alpha-value>)',
          secondary: 'hsl(var(--muted-foreground) / <alpha-value>)',
          muted: 'hsl(var(--muted-foreground) / <alpha-value>)',
          dim: 'hsl(var(--muted-foreground) / 0.75)',
        },
        danger: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          subtle: 'hsl(var(--destructive) / 0.15)',
        },
        success: {
          DEFAULT: 'hsl(var(--chart-3) / <alpha-value>)',
          subtle: 'hsl(var(--chart-3) / 0.15)',
        },
        chart: {
          1: 'hsl(var(--chart-1) / <alpha-value>)',
          2: 'hsl(var(--chart-2) / <alpha-value>)',
          3: 'hsl(var(--chart-3) / <alpha-value>)',
          4: 'hsl(var(--chart-4) / <alpha-value>)',
          5: 'hsl(var(--chart-5) / <alpha-value>)',
        },
      },
      borderRadius: {
        '3xl': '1.5rem',
        '2xl': '1rem',
        xl: '0.75rem',
        lg: '0.5rem',
        md: '0.375rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.15), 0 2px 4px -2px rgba(0, 0, 0, 0.15)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.25), 0 4px 6px -4px rgba(0, 0, 0, 0.25)',
        'primary-glow': '0 0 20px -3px hsla(84, 89%, 60%, 0.35)',
      },
    },
  },
  plugins: [],
};
