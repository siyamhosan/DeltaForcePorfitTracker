import type {
  ActiveSessionDto,
  DashboardOverviewDto,
  LeaderboardEntryDto,
  ReopenableSessionDto,
  SessionHistoryItem,
  UploadAnalysisDto,
  UploadJobDto,
} from "@workspace/domain"

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000/v1"

export class ApiError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.payload = payload
  }
}

async function apiFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const raw = await response.text().catch(() => "")
    let parsedBody: { error?: string; message?: string } | null = null
    if (raw) {
      try {
        parsedBody = JSON.parse(raw) as { error?: string; message?: string }
      } catch {
        parsedBody = null
      }
    }
    const message = parsedBody?.error ?? parsedBody?.message ?? `Request failed: ${response.status}`
    throw new ApiError(message, response.status, parsedBody ?? raw)
  }

  return (await response.json()) as T
}

export function createDesktopApi(token: string) {
  return {
    me: () => apiFetch<{ userId: string; internalUserId: number; displayName: string | null }>(token, "/app/me"),
    getOverview: () => apiFetch<DashboardOverviewDto>(token, "/app/overview"),
    getUploads: () => apiFetch<UploadJobDto[]>(token, "/app/uploads"),
    getActiveSession: () =>
      apiFetch<{ activeSession: ActiveSessionDto | null }>(token, "/app/session/active"),
    endSession: () =>
      apiFetch<{ endedSession: SessionHistoryItem | null }>(token, "/app/session/end", {
        method: "POST",
      }),
    getReopenableLastSession: () =>
      apiFetch<{ reopenableSession: ReopenableSessionDto | null }>(
        token,
        "/app/session/reopen-last"
      ),
    reopenLastSession: () =>
      apiFetch<{ reopenedSession: SessionHistoryItem | null }>(
        token,
        "/app/session/reopen-last",
        { method: "POST" }
      ),
    getLeaderboard: () =>
      apiFetch<{ period: string; entries: LeaderboardEntryDto[] }>(token, "/leaderboard?period=all_time"),
    createUpload: (input: { filename: string; imageBase64: string; source?: "manual_upload" | "desktop_client" }) =>
      apiFetch<{
        job: UploadJobDto
        autoConfirmed: boolean
        analysis: UploadAnalysisDto
      }>(token, "/app/uploads/manual", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  }
}
