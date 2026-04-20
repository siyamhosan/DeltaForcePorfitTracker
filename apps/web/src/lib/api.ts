import type {
  ActiveSessionDto,
  ActiveSessionRaidDto,
  PaginatedSessionsDto,
  ReopenableSessionDto,
  UploadAnalysisDto,
  UploadConfirmWarningDto,
  DashboardOverviewDto,
  LeaderboardEntryDto,
  SessionHistoryItem,
  UploadJobDto,
  ApiKeyDto,
  ApiKeyWithSecretDto,
} from "@workspace/domain"

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000/v1"

type GetToken = () => Promise<string | null>

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

async function apiFetch<T>(
  path: string,
  getToken: GetToken,
  init?: RequestInit
): Promise<T> {
  const token = await getToken()
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const rawText = await response.text().catch(() => "")
    let parsedBody: { error?: string; message?: string } | null = null
    if (rawText) {
      try {
        parsedBody = JSON.parse(rawText) as { error?: string; message?: string }
      } catch {
        parsedBody = null
      }
    }
    const message =
      response.status >= 500
        ? "Server error. Please try again."
        : (parsedBody?.error ??
          parsedBody?.message ??
          `Request failed: ${response.status}`)
    const payload = parsedBody ?? (rawText ? { raw: rawText } : null)
    throw new ApiError(message, response.status, payload)
  }

  return (await response.json()) as T
}

export function createApi(getToken: GetToken) {
  return {
    getOverview: () =>
      apiFetch<DashboardOverviewDto>("/app/overview", getToken),
    getSessions: () =>
      apiFetch<SessionHistoryItem[]>("/app/sessions", getToken),
    getSessionsPaginated: (page: number, pageSize = 20) =>
      apiFetch<PaginatedSessionsDto>(
        `/app/sessions/paginated?page=${page}&pageSize=${pageSize}`,
        getToken
      ),
    getSessionById: (sessionId: string) =>
      apiFetch<{ session: SessionHistoryItem }>(
        `/app/sessions/${sessionId}`,
        getToken
      ),
    getSessionRaids: (sessionId: string) =>
      apiFetch<{ raids: ActiveSessionRaidDto[] }>(
        `/app/sessions/${sessionId}/raids`,
        getToken
      ),
    getActiveSession: () =>
      apiFetch<{ activeSession: ActiveSessionDto | null }>(
        "/app/session/active",
        getToken
      ),
    endSession: () =>
      apiFetch<{ endedSession: SessionHistoryItem | null }>(
        "/app/session/end",
        getToken,
        {
          method: "POST",
        }
      ),
    getReopenableLastSession: () =>
      apiFetch<{ reopenableSession: ReopenableSessionDto | null }>(
        "/app/session/reopen-last",
        getToken
      ),
    reopenLastSession: () =>
      apiFetch<{ reopenedSession: SessionHistoryItem | null }>(
        "/app/session/reopen-last",
        getToken,
        {
          method: "POST",
        }
      ),
    getUploads: () => apiFetch<UploadJobDto[]>("/app/uploads", getToken),
    createUpload: (input: { filename: string; imageBase64: string }) =>
      apiFetch<{
        job: UploadJobDto
        autoConfirmed: boolean
        raidId?: string
        analysis: UploadAnalysisDto
      }>("/app/uploads/manual", getToken, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    confirmUpload: (
      uploadId: string,
      input: {
        stashValue: number
        raidMode: "operations" | "warfare"
        extracted: boolean
        loadoutCost: number
        consumablesCost: number
        insuranceCost: number
        forceConfirm?: boolean
      }
    ) =>
      apiFetch<{
        job: UploadJobDto
        raidId: string
        warning?: UploadConfirmWarningDto
      }>(`/app/uploads/${uploadId}/confirm`, getToken, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    deleteUploadSnapshot: (uploadId: string) =>
      apiFetch<{ deleted: boolean; deletedSessionIds: string[] }>(
        `/app/uploads/${uploadId}/snapshot`,
        getToken,
        {
          method: "DELETE",
        }
      ),
    getLeaderboard: () =>
      apiFetch<{ period: string; entries: LeaderboardEntryDto[] }>(
        "/leaderboard?period=all_time",
        getToken
      ),
    getApiKeys: () =>
      apiFetch<{ keys: ApiKeyDto[] }>("/app/api-keys", getToken),
    createApiKey: (input: { name: string; type: "desktop" | "manual" }) =>
      apiFetch<ApiKeyWithSecretDto>("/app/api-keys", getToken, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    deleteApiKey: (keyId: string) =>
      apiFetch<{ revoked: boolean }>(`/app/api-keys/${keyId}`, getToken, {
        method: "DELETE",
      }),
  }
}
