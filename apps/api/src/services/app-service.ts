import { and, desc, eq, isNotNull, sql } from "drizzle-orm"

import { db } from "../db/client"
import {
  gameplaySessionsTable,
  leaderboardEntriesTable,
  manualUploadJobsTable,
  raidsTable,
  stashSnapshotsTable,
  usersTable,
} from "../db/schema"
import type {
  ActiveSessionDto,
  ActiveSessionRaidDto,
  DashboardOverviewDto,
  LeaderboardEntryDto,
  ReopenableSessionDto,
  SessionHistoryItem,
  UploadAnalysisDto,
  UploadJobDto,
} from "@workspace/domain"

const SESSION_IDLE_TIMEOUT_MS = 1000 * 60 * 60 * 4
const SESSION_REOPEN_WINDOW_MS = 1000 * 60 * 60

function toMillionNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Math.round(value * 10) / 10
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : Math.round(parsed * 10) / 10
  }
  return 0
}

function getDurationSeconds(startedAt: Date, endedAt?: Date | null) {
  const end = endedAt ?? new Date()
  return Math.max(0, Math.floor((end.getTime() - startedAt.getTime()) / 1000))
}

/** Lifetime profit: sum of each session's totalProfit (stash delta vs that session's start). */
async function sumSessionProfitsForUser(userId: number): Promise<number> {
  const rows = await db.query.gameplaySessionsTable.findMany({
    where: eq(gameplaySessionsTable.userId, userId),
  })
  let total = 0
  for (const row of rows) {
    total += toMillionNumber(row.totalProfit)
  }
  return Math.round(total * 10) / 10
}

export function toSessionHistoryItem(
  row: typeof gameplaySessionsTable.$inferSelect
): SessionHistoryItem {
  return {
    id: row.id,
    status: row.status,
    initialStashValue: toMillionNumber(row.initialStashValue),
    currentStashValue: toMillionNumber(row.currentStashValue),
    finalStashValue: row.finalStashValue === null ? null : toMillionNumber(row.finalStashValue),
    totalProfit: toMillionNumber(row.totalProfit),
    totalRaids: row.totalRaids,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    lastActivityAt: row.lastActivityAt.toISOString(),
    durationSeconds: getDurationSeconds(row.startedAt, row.endedAt),
  }
}

export async function ensureUserByClerkId(clerkUserId: string, displayName?: string | null) {
  const existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkUserId, clerkUserId),
  })

  if (existing) {
    if (displayName && existing.displayName !== displayName) {
      const [updated] = await db
        .update(usersTable)
        .set({ displayName, updatedAt: new Date() })
        .where(eq(usersTable.id, existing.id))
        .returning()
      return updated
    }

    return existing
  }

  const [inserted] = await db
    .insert(usersTable)
    .values({
      clerkUserId,
      displayName: displayName ?? `User-${clerkUserId.slice(-6)}`,
    })
    .returning()

  return inserted
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function toUploadAnalysisDtoOrNull(value: unknown): UploadAnalysisDto | null {
  if (!isObjectRecord(value)) {
    return null
  }
  if (
    typeof value.foundTotalAssetsAnchor !== "boolean" ||
    typeof value.confidence !== "number" ||
    !("stashValueText" in value) ||
    !("stashValueMillions" in value)
  ) {
    return null
  }
  return value as UploadAnalysisDto
}

function parseUploadJobMetadata(parseNotes: string | null) {
  if (!parseNotes) {
    return {
      ocrAnalysis: null as UploadAnalysisDto | null,
      ocrPersistedAnalysisPath: null as string | null,
      confirmationMethod: null as "auto" | "user" | null,
      confirmedByUser: false,
      editedByUser: false,
      confirmedAt: null as string | null,
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(parseNotes) as unknown
  } catch {
    return {
      ocrAnalysis: null as UploadAnalysisDto | null,
      ocrPersistedAnalysisPath: null as string | null,
      confirmationMethod: null as "auto" | "user" | null,
      confirmedByUser: false,
      editedByUser: false,
      confirmedAt: null as string | null,
    }
  }

  const root = isObjectRecord(parsed) ? parsed : null
  const rootAnalysis = root?.analysis
  const legacyAnalysis = toUploadAnalysisDtoOrNull(parsed)
  const nestedAnalysis = toUploadAnalysisDtoOrNull(rootAnalysis)
  const ocrAnalysis = nestedAnalysis ?? legacyAnalysis

  const confirmationRoot = root?.confirmation
  const confirmation = isObjectRecord(confirmationRoot) ? confirmationRoot : null
  const methodValue = confirmation?.method
  const confirmationMethod: "auto" | "user" | null =
    methodValue === "auto" || methodValue === "user"
      ? methodValue
      : null

  return {
    ocrAnalysis,
    ocrPersistedAnalysisPath:
      typeof root?.persistedAnalysisPath === "string"
        ? root.persistedAnalysisPath
        : null,
    confirmationMethod,
    confirmedByUser:
      typeof confirmation?.confirmedByUser === "boolean"
        ? confirmation.confirmedByUser
        : confirmationMethod === "user",
    editedByUser:
      typeof confirmation?.editedByUser === "boolean"
        ? confirmation.editedByUser
        : false,
    confirmedAt:
      typeof confirmation?.confirmedAt === "string"
        ? confirmation.confirmedAt
        : null,
  }
}

export function toUploadJobDto(row: typeof manualUploadJobsTable.$inferSelect): UploadJobDto {
  const metadata = parseUploadJobMetadata(row.parseNotes)
  return {
    id: row.id,
    status: row.status,
    parsedStashValue: row.parsedStashValue === null ? null : toMillionNumber(row.parsedStashValue),
    confidence: row.confidence ? Number(row.confidence) : null,
    parseNotes: row.parseNotes,
    confirmedStashValue:
      row.confirmedStashValue === null ? null : toMillionNumber(row.confirmedStashValue),
    ocrAnalysis: metadata.ocrAnalysis,
    ocrPersistedAnalysisPath: metadata.ocrPersistedAnalysisPath,
    confirmationMethod: metadata.confirmationMethod,
    confirmedByUser: metadata.confirmedByUser,
    editedByUser: metadata.editedByUser,
    confirmedAt: metadata.confirmedAt,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function getOverview(userId: number): Promise<DashboardOverviewDto> {
  const totalProfit = await sumSessionProfitsForUser(userId)

  const raidRows = await db.query.raidsTable.findMany({
    where: eq(raidsTable.userId, userId),
  })

  const snapshotRows = await db.query.stashSnapshotsTable.findMany({
    where: eq(stashSnapshotsTable.userId, userId),
    orderBy: [desc(stashSnapshotsTable.createdAt)],
  })

  let totalExtractions = 0
  for (const raid of raidRows) {
    if (raid.extracted) {
      totalExtractions += 1
    }
  }

  const activeSession = await getActiveSession(userId)

  return {
    totalProfit,
    totalRaids: raidRows.length,
    winRate: raidRows.length ? Math.round((totalExtractions / raidRows.length) * 10000) / 100 : 0,
    latestStashValue: toMillionNumber(snapshotRows[0]?.stashValue),
    activeSessionProfit: toMillionNumber(activeSession?.totalProfit),
    activeSessionDurationSeconds: activeSession?.durationSeconds ?? 0,
  }
}

export async function getSessionHistory(userId: number): Promise<SessionHistoryItem[]> {
  const rows = await db.query.gameplaySessionsTable.findMany({
    where: eq(gameplaySessionsTable.userId, userId),
    orderBy: [desc(gameplaySessionsTable.startedAt)],
    limit: 50,
  })

  return rows.map(toSessionHistoryItem)
}

async function loadRaidsForSessionId(
  userId: number,
  sessionId: string
): Promise<ActiveSessionRaidDto[]> {
  const raidRows = await db
    .select({
      id: raidsTable.id,
      createdAt: raidsTable.createdAt,
      stashValue: stashSnapshotsTable.stashValue,
    })
    .from(raidsTable)
    .leftJoin(stashSnapshotsTable, eq(stashSnapshotsTable.raidId, raidsTable.id))
    .where(and(eq(raidsTable.sessionId, sessionId), eq(raidsTable.userId, userId)))
    .orderBy(desc(raidsTable.createdAt))

  const seenRaidIds = new Set<string>()
  const raids: ActiveSessionRaidDto[] = []
  for (const row of raidRows) {
    if (seenRaidIds.has(row.id)) {
      continue
    }
    seenRaidIds.add(row.id)
    raids.push({
      id: row.id,
      stashValue: toMillionNumber(row.stashValue),
      createdAt: row.createdAt.toISOString(),
    })
  }
  return raids
}

/** Raids for a session owned by the user, or `null` if the session does not exist. */
export async function getSessionRaidsForUser(
  userId: number,
  sessionId: string
): Promise<ActiveSessionRaidDto[] | null> {
  const session = await db.query.gameplaySessionsTable.findFirst({
    where: and(
      eq(gameplaySessionsTable.id, sessionId),
      eq(gameplaySessionsTable.userId, userId)
    ),
  })
  if (!session) {
    return null
  }
  return loadRaidsForSessionId(userId, sessionId)
}

export async function getActiveSession(userId: number): Promise<ActiveSessionDto | null> {
  const active = await db.query.gameplaySessionsTable.findFirst({
    where: and(
      eq(gameplaySessionsTable.userId, userId),
      eq(gameplaySessionsTable.status, "active")
    ),
    orderBy: [desc(gameplaySessionsTable.startedAt)],
  })

  if (!active) {
    return null
  }

  const now = new Date()
  const idleForMs = now.getTime() - active.lastActivityAt.getTime()
  if (idleForMs > SESSION_IDLE_TIMEOUT_MS) {
    await db
      .update(gameplaySessionsTable)
      .set({
        status: "ended",
        endedAt: active.lastActivityAt,
        finalStashValue: toMillionNumber(active.currentStashValue).toString(),
        updatedAt: now,
      })
      .where(eq(gameplaySessionsTable.id, active.id))
    return null
  }

  const raids = await loadRaidsForSessionId(userId, active.id)

  return {
    id: active.id,
    status: "active",
    initialStashValue: toMillionNumber(active.initialStashValue),
    currentStashValue: toMillionNumber(active.currentStashValue),
    totalProfit: toMillionNumber(active.totalProfit),
    totalRaids: active.totalRaids,
    startedAt: active.startedAt.toISOString(),
    lastActivityAt: active.lastActivityAt.toISOString(),
    durationSeconds: getDurationSeconds(active.startedAt, active.endedAt),
    raids,
  }
}

export async function endActiveSession(userId: number, endedAt = new Date()) {
  const existing = await db.query.gameplaySessionsTable.findFirst({
    where: and(
      eq(gameplaySessionsTable.userId, userId),
      eq(gameplaySessionsTable.status, "active")
    ),
    orderBy: [desc(gameplaySessionsTable.startedAt)],
  })

  if (!existing) {
    return null
  }

  const [updated] = await db
    .update(gameplaySessionsTable)
    .set({
      status: "ended",
      endedAt,
      finalStashValue: toMillionNumber(existing.currentStashValue).toString(),
      updatedAt: endedAt,
    })
    .where(eq(gameplaySessionsTable.id, existing.id))
    .returning()

  return updated
}

function isManualSessionEnd(row: typeof gameplaySessionsTable.$inferSelect) {
  if (!row.endedAt) {
    return false
  }
  return row.endedAt.getTime() > row.lastActivityAt.getTime()
}

function toReopenableSessionDto(
  row: typeof gameplaySessionsTable.$inferSelect,
  now: Date
): ReopenableSessionDto | null {
  if (!row.endedAt || !isManualSessionEnd(row)) {
    return null
  }

  const remainingMs = SESSION_REOPEN_WINDOW_MS - (now.getTime() - row.endedAt.getTime())
  if (remainingMs <= 0) {
    return null
  }

  return {
    session: toSessionHistoryItem(row),
    expiresAt: new Date(row.endedAt.getTime() + SESSION_REOPEN_WINDOW_MS).toISOString(),
    remainingSeconds: Math.floor(remainingMs / 1000),
  }
}

async function getMostRecentEndedSession(userId: number) {
  return db.query.gameplaySessionsTable.findFirst({
    where: and(
      eq(gameplaySessionsTable.userId, userId),
      eq(gameplaySessionsTable.status, "ended"),
      isNotNull(gameplaySessionsTable.endedAt)
    ),
    orderBy: [desc(gameplaySessionsTable.endedAt), desc(gameplaySessionsTable.startedAt)],
  })
}

export async function getReopenableLastSession(
  userId: number,
  now = new Date()
): Promise<ReopenableSessionDto | null> {
  const active = await db.query.gameplaySessionsTable.findFirst({
    where: and(eq(gameplaySessionsTable.userId, userId), eq(gameplaySessionsTable.status, "active")),
  })
  if (active) {
    return null
  }

  const recentEnded = await getMostRecentEndedSession(userId)
  if (!recentEnded) {
    return null
  }

  return toReopenableSessionDto(recentEnded, now)
}

export async function reopenLastSession(
  userId: number,
  reopenedAt = new Date()
): Promise<typeof gameplaySessionsTable.$inferSelect | null> {
  const reopenable = await getReopenableLastSession(userId, reopenedAt)
  if (!reopenable) {
    return null
  }

  const [reopened] = await db
    .update(gameplaySessionsTable)
    .set({
      status: "active",
      endedAt: null,
      finalStashValue: null,
      lastActivityAt: reopenedAt,
      updatedAt: reopenedAt,
    })
    .where(eq(gameplaySessionsTable.id, reopenable.session.id))
    .returning()

  return reopened
}

export async function resolveSessionForSnapshot(
  userId: number,
  stashValue: number,
  confirmedAt = new Date()
) {
  const active = await db.query.gameplaySessionsTable.findFirst({
    where: and(
      eq(gameplaySessionsTable.userId, userId),
      eq(gameplaySessionsTable.status, "active")
    ),
    orderBy: [desc(gameplaySessionsTable.startedAt)],
  })

  if (!active) {
    const [created] = await db
      .insert(gameplaySessionsTable)
      .values({
        userId,
        status: "active",
        initialStashValue: stashValue.toString(),
        currentStashValue: stashValue.toString(),
        totalProfit: "0",
        totalRaids: 1,
        startedAt: confirmedAt,
        lastActivityAt: confirmedAt,
        updatedAt: confirmedAt,
      })
      .returning()
    return created
  }

  const idleForMs = confirmedAt.getTime() - active.lastActivityAt.getTime()
  if (idleForMs > SESSION_IDLE_TIMEOUT_MS) {
    await db
      .update(gameplaySessionsTable)
      .set({
        status: "ended",
        endedAt: active.lastActivityAt,
        finalStashValue: toMillionNumber(active.currentStashValue).toString(),
        updatedAt: confirmedAt,
      })
      .where(eq(gameplaySessionsTable.id, active.id))

    const [created] = await db
      .insert(gameplaySessionsTable)
      .values({
        userId,
        status: "active",
        initialStashValue: stashValue.toString(),
        currentStashValue: stashValue.toString(),
        totalProfit: "0",
        totalRaids: 1,
        startedAt: confirmedAt,
        lastActivityAt: confirmedAt,
        updatedAt: confirmedAt,
      })
      .returning()
    return created
  }

  const [updated] = await db
    .update(gameplaySessionsTable)
    .set({
      currentStashValue: stashValue.toString(),
      totalProfit: (stashValue - toMillionNumber(active.initialStashValue)).toString(),
      totalRaids: active.totalRaids + 1,
      lastActivityAt: confirmedAt,
      updatedAt: confirmedAt,
    })
    .where(eq(gameplaySessionsTable.id, active.id))
    .returning()

  return updated
}

export async function rebuildAllTimeLeaderboardForUser(userId: number) {
  const totalProfit = await sumSessionProfitsForUser(userId)

  const [raidSummary] = await db
    .select({
      totalRaids: sql<number>`count(*)`,
      totalExtractions: sql<number>`sum(case when ${raidsTable.extracted} then 1 else 0 end)`,
    })
    .from(raidsTable)
    .where(eq(raidsTable.userId, userId))

  await db
    .insert(leaderboardEntriesTable)
    .values({
      userId,
      period: "all_time",
      totalProfit: totalProfit.toString(),
      totalRaids: raidSummary?.totalRaids ?? 0,
      totalExtractions: raidSummary?.totalExtractions ?? 0,
    })
    .onConflictDoUpdate({
      target: [leaderboardEntriesTable.period, leaderboardEntriesTable.userId],
      set: {
        totalProfit: totalProfit.toString(),
        totalRaids: raidSummary?.totalRaids ?? 0,
        totalExtractions: raidSummary?.totalExtractions ?? 0,
        updatedAt: new Date(),
      },
    })
}

export async function getLeaderboard(period = "all_time"): Promise<LeaderboardEntryDto[]> {
  const rows = await db
    .select({
      clerkUserId: usersTable.clerkUserId,
      displayName: usersTable.displayName,
      totalProfit: leaderboardEntriesTable.totalProfit,
      totalRaids: leaderboardEntriesTable.totalRaids,
      totalExtractions: leaderboardEntriesTable.totalExtractions,
    })
    .from(leaderboardEntriesTable)
    .innerJoin(usersTable, eq(usersTable.id, leaderboardEntriesTable.userId))
    .where(eq(leaderboardEntriesTable.period, period))
    .orderBy(desc(leaderboardEntriesTable.totalProfit))
    .limit(50)

  return rows.map((row, index) => ({
    rank: index + 1,
    userId: row.clerkUserId,
    displayName: row.displayName ?? `User-${row.clerkUserId.slice(-6)}`,
    totalProfit: toMillionNumber(row.totalProfit),
    totalRaids: row.totalRaids,
    totalExtractions: row.totalExtractions,
  }))
}

export async function getUploadJobForUser(uploadId: string, userId: number) {
  return db.query.manualUploadJobsTable.findFirst({
    where: and(eq(manualUploadJobsTable.id, uploadId), eq(manualUploadJobsTable.userId, userId)),
  })
}
