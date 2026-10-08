/**
 * Hands a file to the learner: the share sheet where the browser offers one with files
 * (iOS Safari), otherwise a download. Returns false if the learner closed the share sheet.
 */
export async function saveFile(name: string, text: string, type: string, share: boolean): Promise<boolean> {
  const blob = new Blob([text], { type })
  const file = new File([blob], name, { type })
  if (share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return true
    } catch {
      return false
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
