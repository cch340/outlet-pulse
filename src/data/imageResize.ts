// Browser-only: decode an image File, downscale its longest edge and re-encode
// it as JPEG. No test (needs canvas / createImageBitmap, unavailable in the
// vitest node environment). Sizing math lives in the pure `photoPaths` module.
import { targetDimensions, JPEG_QUALITY } from './photoPaths'

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // Prefer createImageBitmap (fast, off-main-thread); fall back to an <img>.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // fall through to the HTMLImageElement path
    }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not read that image.'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Decode `file`, scale it to fit MAX_EDGE_PX and return a JPEG Blob. */
export async function resizeImageToJpeg(file: File): Promise<Blob> {
  const source = await decode(file)
  const srcW = 'width' in source ? source.width : (source as HTMLImageElement).naturalWidth
  const srcH = 'height' in source ? source.height : (source as HTMLImageElement).naturalHeight
  if (!srcW || !srcH) throw new Error('Could not read that image.')

  const { w, h } = targetDimensions(srcW, srcH)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process that image.')
  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h)
  if ('close' in source && typeof source.close === 'function') source.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )
  if (!blob) throw new Error('Could not process that image.')
  return blob
}
