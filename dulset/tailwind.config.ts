import type { Config } from 'tailwindcss'

// Colors are CSS variables (see app/globals.css) so light/dark themes swap in one place.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        'surface-2': v('surface-2'),
        line: v('line'),
        /** Boundaries of form controls (inputs, off switches): ≥3:1 against surfaces. */
        control: v('control'),
        ink: v('ink'),
        'ink-2': v('ink-2'),
        'ink-3': v('ink-3'),
        // Color roles (values + contrast notes in app/globals.css):
        // brand = deep teal (actions, the app's voice) · period = red, period days
        // only · fert = violet, the fertile window only (deeper = most likely days).
        brand: v('brand'),
        'brand-soft': v('brand-soft'),
        'brand-ink': v('brand-ink'),
        him: v('him'),
        'him-soft': v('him-soft'),
        her: v('her'),
        'her-soft': v('her-soft'),
        ok: v('ok'),
        'ok-soft': v('ok-soft'),
        warn: v('warn'),
        'warn-soft': v('warn-soft'),
        fert: v('fert'),
        'fert-soft': v('fert-soft'),
        period: v('period'),
        'period-soft': v('period-soft'),
      },
      fontFamily: {
        sans: [
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'Apple SD Gothic Neo',
          'Noto Sans KR',
          'Malgun Gothic',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: { xl2: '1.25rem' },
      boxShadow: { card: '0 1px 2px rgb(0 0 0 / 0.04), 0 4px 16px rgb(0 0 0 / 0.04)' },
    },
  },
  plugins: [],
}

export default config
