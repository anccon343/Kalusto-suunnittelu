/**
 * jsdom lacks `document.fonts`, which Mantine's autosizing Textarea listens to.
 * Suggested to move into src/test/setup.ts; kept here because views do not edit shared files.
 */
if (!('fonts' in document)) {
  Object.defineProperty(document, 'fonts', {
    value: { addEventListener: () => {}, removeEventListener: () => {} },
  })
}
