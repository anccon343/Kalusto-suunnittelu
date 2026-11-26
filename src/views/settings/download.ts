/** Hands a text file to the browser as a download (Blob + object URL). */
export function downloadTextFile(fileName: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.rel = 'noopener'
    document.body.append(a)
    a.click()
    a.remove()
  } finally {
    // Revoke after the click has been handled; revoking at once can cancel it in Safari.
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
