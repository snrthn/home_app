import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-soft': 'var(--color-primary-soft)',
        surface: 'var(--color-surface)',
        ink: 'var(--color-text)',
        'ink-soft': 'var(--color-text-soft)',
      },
      borderRadius: {
        card: 'var(--radius)',
      },
      boxShadow: {
        card: 'var(--shadow)',
      },
    },
  },
  plugins: [],
} satisfies Config;
