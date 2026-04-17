import type { UploadAnalysisDto } from "@workspace/domain"
import { env } from "../config/env"

export function sha256ForBase64Image(base64Image: string) {
  const hasher = new Bun.CryptoHasher("sha256")
  hasher.update(base64Image)
  return hasher.digest("hex")
}

type AnalyzerBoundingBox = {
  X0: number
  Y0: number
  X1: number
  Y1: number
  WidthPx: number
  HeightPx: number
}

type AnalyzerResponse = {
  FoundTotalAssetsAnchor?: boolean
  TotalAssetsAnchorConfidence?: number
  StashValue?: string
  StashValueConfidence?: number
  TimeTakenMs?: number
  StashValueBoundingBox?: AnalyzerBoundingBox
  StashSearchBandPx?: AnalyzerBoundingBox
  DebugOutputDir?: string
}

function toOneDecimalMillion(value: number) {
  return Math.round(value * 10) / 10
}

function parseStashValueTextToMillions(stashValueText?: string) {
  if (!stashValueText) {
    return null
  }

  const normalized = stashValueText.trim().toUpperCase()
  if (!/^\d{1,4}\.\dM$/.test(normalized)) {
    return null
  }

  const numericPart = Number(normalized.replace("M", ""))
  if (Number.isNaN(numericPart)) {
    return null
  }

  return toOneDecimalMillion(numericPart)
}

function mapBoundingBox(source?: AnalyzerBoundingBox): UploadAnalysisDto["stashValueBoundingBox"] {
  if (!source) {
    return null
  }

  return {
    x0: source.X0,
    y0: source.Y0,
    x1: source.X1,
    y1: source.Y1,
    widthPx: source.WidthPx,
    heightPx: source.HeightPx,
  }
}

export async function analyzeUploadWithExternalSystem(
  filename: string,
  base64Image: string
): Promise<UploadAnalysisDto> {
  const binary = Buffer.from(base64Image, "base64")
  const formData = new FormData()
  formData.append("file", new Blob([binary]), filename)

  const response = await fetch(env.ocrAnalyzerUrl, {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Analyzer request failed: ${response.status}`)
  }

  const raw = (await response.json()) as AnalyzerResponse
  const stashValueText = raw.StashValue?.toUpperCase() ?? null
  const stashValueMillions = parseStashValueTextToMillions(stashValueText ?? undefined)
  const confidenceSource =
    typeof raw.StashValueConfidence === "number"
      ? raw.StashValueConfidence
      : raw.TotalAssetsAnchorConfidence
  const confidence =
    typeof confidenceSource === "number" ? Math.max(0, Math.min(1, confidenceSource / 100)) : 0

  return {
    foundTotalAssetsAnchor: Boolean(raw.FoundTotalAssetsAnchor),
    confidence,
    stashValueText,
    stashValueMillions,
    timeTakenMs: raw.TimeTakenMs ?? null,
    stashValueBoundingBox: mapBoundingBox(raw.StashValueBoundingBox),
    stashSearchBand: mapBoundingBox(raw.StashSearchBandPx),
    debugOutputDir: raw.DebugOutputDir ?? null,
  }
}
