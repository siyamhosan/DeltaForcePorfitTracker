export const env = {
  clerkSecretKey: process.env.CLERK_SECRET_KEY ?? "",
  ocrAnalyzerUrl: process.env.OCR_ANALYZER_URL ?? "http://127.0.0.1:8765/analyze",
  stashDeltaWarningThresholdM: Number(process.env.STASH_DELTA_WARNING_THRESHOLD_M ?? 200),
  port: Number(process.env.PORT ?? 3000),
}

export function assertServerEnv() {
  if (!env.clerkSecretKey) {
    console.warn("CLERK_SECRET_KEY is missing; protected routes will reject requests.")
  }
}
