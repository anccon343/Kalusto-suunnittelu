/** Setup for component tests (jsdom): DOM matchers and browser APIs Mantine expects. */
import '@testing-library/jest-dom/vitest'
import { notifications } from '@mantine/notifications'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

afterEach(() => cleanup())

// The Mantine notification store is global: clear it so tests do not see each other's toasts.
beforeEach(() => {
  notifications.clean()
  notifications.cleanQueue()
})

// jsdom has no FontFaceSet; Mantine's autosizing Textarea listens to it.
Object.defineProperty(document, 'fonts', {
  configurable: true,
  value: { addEventListener: () => {}, removeEventListener: () => {} },
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub
window.HTMLElement.prototype.scrollIntoView = vi.fn<() => void>()
