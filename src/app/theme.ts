import { createTheme, type MantineColorsTuple } from '@mantine/core'

/**
 * Practical tool look (see docs/UI.md): neutral greys, one restrained accent (dark
 * slate blue) for primary actions only, small radii, no decorative motion. Colour
 * carries meaning only: red = päällekkäin, orange/yellow = varoitus, grey = alustava.
 */
const slate: MantineColorsTuple = [
  '#f1f4f8',
  '#e2e7ee',
  '#c3ccd9',
  '#a1b0c3',
  '#8497b0',
  '#7187a5',
  '#667fa0',
  '#556d8c',
  '#4a607d',
  '#3c536f',
]

export const theme = createTheme({
  primaryColor: 'slate',
  primaryShade: { light: 8, dark: 5 },
  colors: { slate },
  defaultRadius: 'xs',
  radius: { xs: '2px', sm: '3px', md: '4px', lg: '4px', xl: '4px' },
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  headings: { fontWeight: '600' },
  respectReducedMotion: true,
  cursorType: 'pointer',
  components: {
    Button: { defaultProps: { size: 'sm' } },
    Badge: { defaultProps: { variant: 'light', radius: 'xs' } },
    Paper: { defaultProps: { shadow: 'none', withBorder: true } },
    Card: { defaultProps: { shadow: 'none', withBorder: true } },
    Modal: { defaultProps: { transitionProps: { duration: 0 } } },
    Drawer: { defaultProps: { transitionProps: { duration: 0 } } },
    Menu: { defaultProps: { transitionProps: { duration: 0 } } },
    Popover: { defaultProps: { transitionProps: { duration: 0 } } },
    Tooltip: { defaultProps: { transitionProps: { duration: 0 } } },
    Notification: { defaultProps: { withBorder: true } },
  },
})
