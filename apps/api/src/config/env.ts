function parseCsvEnv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

export const env = {
  clerkSecretKey: process.env.CLERK_SECRET_KEY ?? "",
  desktopAuthSecret: process.env.DESKTOP_AUTH_SECRET ?? process.env.CLERK_SECRET_KEY ?? "",
  desktopAuthTokenTtlSeconds: Number(process.env.DESKTOP_AUTH_TOKEN_TTL_SECONDS ?? 300),
  ocrAnalyzerUrl: process.env.OCR_ANALYZER_URL ?? "http://127.0.0.1:8765/analyze",
  stashDeltaWarningThresholdM: Number(process.env.STASH_DELTA_WARNING_THRESHOLD_M ?? 200),
  port: Number(process.env.PORT ?? 3000),
  /** Comma-separated browser origins, e.g. https://app.example.com,https://www.example.com */
  corsOrigins: parseCsvEnv(process.env.CORS_ORIGIN?.trim() || "http://localhost:4173"),
}

export function assertServerEnv() {
  if (!env.clerkSecretKey) {
    console.warn("CLERK_SECRET_KEY is missing; protected routes will reject requests.")
  }
  if (!env.desktopAuthSecret) {
    console.warn("DESKTOP_AUTH_SECRET is missing; desktop token auth will reject requests.")
  }
}
