import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      colors: {
        accent: {
          DEFAULT: '#1d4ed8',
          light: '#3b82f6',
          dark: '#1e3a8a',
        },
        verdict: {
          valid: '#166534',
          tampered: '#7f1d1d',
          revoked: '#78350f',
          unknown: '#374151',
        },
      },
    },
  },
  plugins: [],
};

export default config;
