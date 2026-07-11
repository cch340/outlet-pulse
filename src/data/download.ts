/**
 * Trigger a browser download of in-memory text as a file. Browser-only (uses
 * Blob / URL / anchor); all CSV shaping lives in the pure `csvExport` module so
 * this stays untested glue.
 */
export function downloadTextFile(filename: string, mime: string, text: string): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
