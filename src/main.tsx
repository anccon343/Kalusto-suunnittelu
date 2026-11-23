import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// After a deploy, an open tab may request a code chunk that no longer exists; reload
// to fetch the new version instead of showing a blank page.
window.addEventListener('vite:preloadError', () => window.location.reload())

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
