import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';
import { COLORS, EASE } from './src/tunables';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { ...COLORS },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: { cinematic: EASE.css },
      maxWidth: { page: '1200px' },
    },
  },
  plugins: [
    // Single source of truth: tunables.ts → CSS custom properties.
    plugin(({ addBase }) => {
      addBase({
        ':root': Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [`--${k}`, v])),
      });
    }),
  ],
} satisfies Config;
