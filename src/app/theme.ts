import { createTheme } from '@mantine/core'

/** Calm, practical look: one accent colour, comfortable touch targets. */
export const theme = createTheme({
  primaryColor: 'teal',
  defaultRadius: 'md',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  components: {
    Button: { defaultProps: { size: 'sm' } },
  },
})
