import { useEffect, useState } from "react"
import type { UploadAnalysisDto } from "@workspace/domain"

export function AnalysisCanvasPreview({
  imageUrl,
  analysis,
}: {
  imageUrl: string
  analysis: UploadAnalysisDto
}) {
  const [imageRef, setImageRef] = useState<HTMLImageElement | null>(null)
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!imageRef || !canvasRef) {
      return
    }

    const ctx = canvasRef.getContext("2d")
    if (!ctx) {
      return
    }

    const width = imageRef.clientWidth
    const height = imageRef.clientHeight
    canvasRef.width = width
    canvasRef.height = height
    ctx.clearRect(0, 0, width, height)

    const scaleX = width / imageRef.naturalWidth
    const scaleY = height / imageRef.naturalHeight

    if (analysis.stashSearchBand) {
      const band = analysis.stashSearchBand
      ctx.strokeStyle = "rgba(255, 195, 0, 0.95)"
      ctx.lineWidth = 2
      ctx.strokeRect(band.x0 * scaleX, band.y0 * scaleY, band.widthPx * scaleX, band.heightPx * scaleY)
    }

    if (analysis.stashValueBoundingBox) {
      const box = analysis.stashValueBoundingBox
      ctx.strokeStyle = "rgba(255, 72, 72, 0.95)"
      ctx.lineWidth = 3
      ctx.strokeRect(box.x0 * scaleX, box.y0 * scaleY, box.widthPx * scaleX, box.heightPx * scaleY)
    }
  }, [analysis, imageRef, canvasRef])

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
      <img
        ref={setImageRef}
        src={imageUrl}
        alt="Analysis preview"
        className="w-full max-h-[28rem] object-contain bg-zinc-100 dark:bg-zinc-800"
      />
      <canvas ref={setCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  )
}
