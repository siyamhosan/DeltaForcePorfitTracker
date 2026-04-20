import { z } from "zod"

export const raidModeSchema = z.enum(["operations", "warfare"])
export type RaidMode = z.infer<typeof raidModeSchema>

export const uploadStatusSchema = z.enum([
  "queued",
  "processed",
  "confirmed",
  "ignored",
  "rejected",
  "failed",
])
export type UploadStatus = z.infer<typeof uploadStatusSchema>

export const createUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  imageBase64: z.string().min(16),
  source: z.enum(["manual_upload", "desktop_client"]).optional(),
})
export type CreateUploadInput = z.infer<typeof createUploadSchema>

const stashValueMillionSchema = z.number().nonnegative().max(9_999.9).multipleOf(0.1)

export const confirmUploadSchema = z.object({
  stashValue: stashValueMillionSchema,
  raidMode: raidModeSchema.default("operations"),
  extracted: z.boolean().default(false),
  loadoutCost: stashValueMillionSchema.default(0),
  consumablesCost: stashValueMillionSchema.default(0),
  insuranceCost: stashValueMillionSchema.default(0),
  forceConfirm: z.boolean().default(false),
})
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>

export type AnalyzerBoundingBoxDto = {
  x0: number
  y0: number
  x1: number
  y1: number
  widthPx: number
  heightPx: number
}

export type UploadAnalysisDto = {
  foundTotalAssetsAnchor: boolean
  confidence: number
  stashValueText: string | null
  stashValueMillions: number | null
  timeTakenMs: number | null
  stashValueBoundingBox: AnalyzerBoundingBoxDto | null
  stashSearchBand: AnalyzerBoundingBoxDto | null
  debugOutputDir: string | null
}

export type UploadJobDto = {
  id: string
  status: UploadStatus
  parsedStashValue: number | null
  confidence: number | null
  parseNotes: string | null
  confirmedStashValue: number | null
  ocrAnalysis: UploadAnalysisDto | null
  ocrPersistedAnalysisPath: string | null
  confirmationMethod: "auto" | "user" | null
  confirmedByUser: boolean
  editedByUser: boolean
  confirmedAt: string | null
  sessionId?: string | null
  source?: "manual_upload" | "desktop_client" | null
  processingFailureReason?: string | null
  ignoredReason?: "duplicate" | null
  createdAt: string
}

export type UploadConfirmWarningDto = {
  lastStashValue: number
  currentStashValue: number
  delta: number
  threshold: number
}

export type SessionHistoryItem = {
  id: string
  status: "active" | "ended"
  initialStashValue: number
  currentStashValue: number
  finalStashValue: number | null
  totalProfit: number
  totalRaids: number
  startedAt: string
  endedAt: string | null
  lastActivityAt: string
  durationSeconds: number
}

export type ActiveSessionRaidDto = {
  id: string
  stashValue: number
  createdAt: string
  uploadJobId: string | null
}

export type ActiveSessionDto = {
  id: string
  status: "active"
  initialStashValue: number
  currentStashValue: number
  totalProfit: number
  totalRaids: number
  startedAt: string
  lastActivityAt: string
  durationSeconds: number
  raids: ActiveSessionRaidDto[]
}

export type ReopenableSessionDto = {
  session: SessionHistoryItem
  expiresAt: string
  remainingSeconds: number
}

export type PaginatedSessionsDto = {
  items: SessionHistoryItem[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export type LeaderboardEntryDto = {
  rank: number
  userId: string
  displayName: string
  totalProfit: number
  totalRaids: number
  totalExtractions: number
}

export type DashboardOverviewDto = {
  totalProfit: number
  totalRaids: number
  winRate: number
  latestStashValue: number
  activeSessionProfit: number
  activeSessionDurationSeconds: number
}

export type OverviewPageDto = {
  overview: DashboardOverviewDto
  sessions: SessionHistoryItem[]
  activeSession: ActiveSessionDto | null
  reopenableSession: ReopenableSessionDto | null
}

export const createApiKeySchema = z.object({
  name: z.string().trim().min(2).max(64),
  type: z.enum(["desktop", "manual"]).default("manual"),
})
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>

export type ApiKeyDto = {
  id: string
  name: string
  type: "desktop" | "manual"
  prefix: string
  createdAt: string
  updatedAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

export type ApiKeyWithSecretDto = {
  key: ApiKeyDto
  secret: string
}
