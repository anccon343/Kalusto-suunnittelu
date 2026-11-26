import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/notifications/styles.css'
import './index.css'
import 'dayjs/locale/fi'
import { MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { Notifications } from '@mantine/notifications'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { createRouter } from './app/routes'
import { theme } from './app/theme'

// After a deploy, an open tab may request a code chunk that no longer exists; reload
// to fetch the new version instead of showing a blank page.
window.addEventListener('vite:preloadError', () => window.location.reload())

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <DatesProvider settings={{ locale: 'fi', firstDayOfWeek: 1, weekendDays: [0, 6] }}>
        <Notifications position="top-center" />
        <RouterProvider router={createRouter()} />
      </DatesProvider>
    </MantineProvider>
  </StrictMode>,
)
