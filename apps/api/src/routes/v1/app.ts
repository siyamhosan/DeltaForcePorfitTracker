import { Elysia } from "elysia"
import {
  confirmUploadSchema,
  createApiKeySchema,
  createUploadSchema,
  type UploadAnalysisDto,
  type UploadConfirmWarningDto,
} from "@workspace/domain"
import { clerkPlugin } from "elysia-clerk"
import { and, desc, eq, inArray } from "drizzle-orm"

import { env } from "../../config/env"
import { db } from "../../db/client"
import {
  manualUploadJobsTable,
  raidsTable,
  stashSnapshotsTable,
  usersTable,
} from "../../db/schema"
import {
  type AuthContext,
  isAuthenticatedContext,
  unauthenticatedAuthContext,
} from "../../lib/auth"
import {
  analyzeUploadWithExternalSystem,
  sha256ForBase64Image,
} from "../../lib/storage"
import {
  createApiKeyForUser,
  ensureDesktopApiKeyForUser,
  listApiKeysForUser,
  revokeApiKeyForUser,
  validateApiKey,
} from "../../services/api-key-service"
import {
  deleteSnapshotForUpload,
  ensureUserByClerkId,
  endActiveSession,
  getActiveSession,
  getOverview,
  getSessionByIdForUser,
  getReopenableLastSession,
  getSessionHistory,
  getSessionHistoryPaginated,
  getSessionRaidsForUser,
  getUploadJobForUser,
  reopenLastSession,
  rebuildAllTimeLeaderboardForUser,
  resolveSessionForSnapshot,
  toSessionHistoryItem,
  toUploadJobDto,
} from "../../services/app-service"

const AUTO_CONFIRM_MIN_CONFIDENCE = 0.8

/** DB column `raw_image_path` is required; images are not written to disk anymore. */
const RAW_IMAGE_PATH_NOT_STORED = "inline"

function toOneDecimalMillion(value: number) {
  return Math.round(value * 10) / 10
}

type UploadJobParseNotes = {
  analysis?: unknown
  source?: "manual_upload" | "desktop_client"
  processingFailureReason?: string
  confirmation?: {
    method: "auto" | "user"
    confirmedByUser: boolean
    editedByUser: boolean
    confirmedAt: string
  }
}

function parseUploadJobParseNotes(raw: string | null): UploadJobParseNotes {
  if (!raw) {
    return {}
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as UploadJobParseNotes
    }
  } catch {
    return {}
  }
  return {}
}

async function persistConfirmedSnapshot(params: {
  userId: number
  uploadJobId: string
  stashValue: number
  confidence: string | null
  raidMode: "operations" | "warfare"
  extracted: boolean
  loadoutCost: number
  consumablesCost: number
  insuranceCost: number
  confirmedAt: Date
}) {
  const session = await resolveSessionForSnapshot(
    params.userId,
    params.stashValue,
    params.confirmedAt
  )
  const [raid] = await db
    .insert(raidsTable)
    .values({
      userId: params.userId,
      sessionId: session.id,
      mode: params.raidMode,
      extracted: params.extracted,
      loadoutCost: params.loadoutCost.toString(),
      consumablesCost: params.consumablesCost.toString(),
      insuranceCost: params.insuranceCost.toString(),
      createdAt: params.confirmedAt,
    })
    .returning()

  await db.insert(stashSnapshotsTable).values({
    userId: params.userId,
    raidId: raid.id,
    uploadJobId: params.uploadJobId,
    sessionId: session.id,
    stashValue: params.stashValue.toString(),
    confidence: params.confidence,
    source: "manual_upload",
    createdAt: params.confirmedAt,
  })

  return raid.id
}

async function getLatestStashValue(userId: number) {
  const lastSnapshot = await db.query.stashSnapshotsTable.findFirst({
    where: eq(stashSnapshotsTable.userId, userId),
    orderBy: [desc(stashSnapshotsTable.createdAt)],
  })
  return lastSnapshot?.stashValue === undefined
    ? null
    : toOneDecimalMillion(Number(lastSnapshot.stashValue))
}

function requireAuthContext(
  authContext: AuthContext,
  set: { status?: number | string }
): Extract<AuthContext, { isAuthenticated: true }> | null {
  if (!isAuthenticatedContext(authContext)) {
    set.status = 401
    return null
  }

  return authContext
}

export const appRoutes = new Elysia({ prefix: "/v1/app" })
  .use(clerkPlugin())
  .resolve(async ({ auth, clerk, request }) => {
    const authHeader = request.headers.get("authorization") ?? ""
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null
    if (bearerToken) {
      const apiKeyRecord = await validateApiKey(bearerToken)
      if (apiKeyRecord) {
        const desktopUser = await db.query.usersTable.findFirst({
          where: eq(usersTable.id, apiKeyRecord.userId),
        })
        if (desktopUser) {
          return {
            authContext: {
              isAuthenticated: true as const,
              authMethod: "desktop" as const,
              clerkUserId: desktopUser.clerkUserId,
              sessionId: null,
              localUser: desktopUser,
            },
          }
        }
      }
    }

    const { userId, sessionId } = auth()
    if (!userId) {
      return { authContext: unauthenticatedAuthContext }
    }

    const clerkUser = await clerk.users.getUser(userId)
    const localUser = await ensureUserByClerkId(
      userId,
      clerkUser.fullName ?? clerkUser.firstName ?? null
    )

    return {
      authContext: {
        isAuthenticated: true as const,
        authMethod: "clerk" as const,
        clerkUserId: userId,
        sessionId: sessionId ?? null,
        localUser,
      },
    }
  })
  .onBeforeHandle(({ authContext, set }) => {
    if (!isAuthenticatedContext(authContext)) {
      set.status = 401
      return { error: "Unauthorized" }
    }
  })
  .get("/me", async ({ authContext, set }) => {
    const currentAuth = requireAuthContext(authContext, set)
    if (!currentAuth) {
      return { error: "Unauthorized" }
    }
    const user = currentAuth.localUser
    return {
      userId: user.clerkUserId,
      internalUserId: user.id,
      displayName: user.displayName,
    }
  })
  .get("/api-keys", async ({ authContext, set }) => {
    const currentAuth = requireAuthContext(authContext, set)
    if (!currentAuth) {
      return { error: "Unauthorized" }
    }
    const keys = await listApiKeysForUser(currentAuth.localUser.id)
    return { keys }
  })
  .post("/api-keys", async ({ authContext, set, body }) => {
    const currentAuth = requireAuthContext(authContext, set)
    if (!currentAuth) {
      return { error: "Unauthorized" }
    }
    if (currentAuth.authMethod !== "clerk") {
      set.status = 403
      return { error: "API keys can only be created from web login." }
    }
    const parsed = createApiKeySchema.safeParse(body)
    if (!parsed.success) {
      set.status = 400
      return { error: "Invalid payload" }
    }
    const created = await createApiKeyForUser({
      userId: currentAuth.localUser.id,
      name: parsed.data.name,
      type: parsed.data.type,
    })
    return created
  })
  .post("/desktop/api-key", async ({ authContext, set }) => {
    const currentAuth = requireAuthContext(authContext, set)
    if (!currentAuth) {
      return { error: "Unauthorized" }
    }
    if (currentAuth.authMethod !== "clerk") {
      set.status = 403
      return { error: "Desktop API key minting requires a browser login." }
    }
    return ensureDesktopApiKeyForUser(currentAuth.localUser.id)
  })
  .delete("/api-keys/:keyId", async ({ authContext, set, params }) => {
    const currentAuth = requireAuthContext(authContext, set)
    if (!currentAuth) {
      return { error: "Unauthorized" }
    }
    if (currentAuth.authMethod !== "clerk") {
      set.status = 403
      return { error: "API keys can only be managed from web login." }
    }
    const revoked = await revokeApiKeyForUser(
      currentAuth.localUser.id,
      params.keyId
    )
    if (!revoked) {
      set.status = 404
      return { error: "API key not found." }
    }
    return { revoked: true }
  })
  .get("/overview", async ({ authContext, set }) => {
    const currentAuth = requireAuthContext(authContext, set)
    if (!currentAuth) {
      return { error: "Unauthorized" }
    }
    const user = currentAuth.localUser
    return getOverview(user.id)
  })
  .get("/sessions", async ({ authContext, set }) => {
    const currentAuth = requireAuthContext(authContext, set)
    if (!currentAuth) {
      return { error: "Unauthorized" }
    }
    const user = currentAuth.localUser
    return getSessionHistory(user.id)
  })
  .get("/sessions/paginated", async ({ authContext, set, query }) => {
    const currentAuth = requireAuthContext(authContext, set)
    if (!currentAuth) {
      return { error: "Unauthorized" }
    }
    const pageRaw = Number(query.page ?? 1)
    const pageSizeRaw = Number(query.pageSize ?? 20)
    const user = currentAuth.localUser
    return getSessionHistoryPaginated(user.id, pageRaw, pageSizeRaw)
  })
  .get("/sessions/:sessionId/raids", async ({ authContext, set, params }) => {
    const currentAuth = requireAuthContext(authContext, set)
    if (!currentAuth) {
      return { error: "Unauthorized" }
    }
    const user = currentAuth.localUser
    const raids = await getSessionRaidsForUser(user.id, params.sessionId)
    if (raids === null) {
      set.status = 404
      return { error: "Session not found" }
    }
    return { raids }
  })
  .get("/sessions/:sessionId", async ({ authContext, set, params }) => {
    const currentAuth = requireAuthContext(authContext, set)
    if (!currentAuth) {
      return { error: "Unauthorized" }
    }
    const user = currentAuth.localUser
    const session = await getSessionByIdForUser(user.id, params.sessionId)
    if (!session) {
      set.status = 404
      return { error: "Session not found" }
    }
    return { session }
  })
  .get("/session/active", async ({ authContext, set }) => {
    const currentAuth = requireAuthContext(authContext, set)
    if (!currentAuth) {
      return { error: "Unauthorized" }
    }

    const user = currentAuth.localUser
    const activeSession = await getActiveSession(user.id)
    return { activeSession }
  })
  .post("/session/end", async ({ authContext, set }) => {
    const currentAuth = requireAuthContext(authContext, set)
    if (!currentAuth) {
      return { error: "Unauthorized" }
    }

    const user = currentAuth.localUser
    const endedSession = await endActiveSession(user.id)
    return {
      endedSession: endedSession ? toSessionHistoryItem(endedSession) : null,
    }
  })
  .get("/session/reopen-last", async ({ authContext, set }) => {
    const currentAuth = requireAuthContext(authContext, set)
    if (!currentAuth) {
      return { error: "Unauthorized" }
    }

    const user = currentAuth.localUser
    const reopenableSession = await getReopenableLastSession(user.id)
    return { reopenableSession }
  })
  .post("/session/reopen-last", async ({ authContext, set }) => {
    const currentAuth = requireAuthContext(authContext, set)
    if (!currentAuth) {
      return { error: "Unauthorized" }
    }

    const user = currentAuth.localUser
    const reopenedSession = await reopenLastSession(user.id)
    return {
      reopenedSession: reopenedSession
        ? toSessionHistoryItem(reopenedSession)
        : null,
    }
  })
  .post("/uploads/manual", async ({ authContext, body, set, request }) => {
    try {
      const currentAuth = requireAuthContext(authContext, set)
      if (!currentAuth) {
        return { error: "Unauthorized" }
      }
      const user = currentAuth.localUser
      const parsedBody = createUploadSchema.safeParse(body)
      if (!parsedBody.success) {
        set.status = 400
        return { error: "Invalid payload" }
      }
      const payload = parsedBody.data
      const uploadSource = payload.source ?? "manual_upload"

      const imageHash = sha256ForBase64Image(payload.imageBase64)
      const existing = await db.query.manualUploadJobsTable.findFirst({
        where: and(
          eq(manualUploadJobsTable.userId, user.id),
          eq(manualUploadJobsTable.rawImageHash, imageHash)
        ),
      })

      if (existing) {
        set.status = 409
        return {
          error: "Duplicate upload detected for this account",
          job: toUploadJobDto(existing),
        }
      }
      let processingFailureReason: string | null = null
      let analysis: UploadAnalysisDto
      try {
        analysis = await analyzeUploadWithExternalSystem(
          payload.filename,
          payload.imageBase64
        )
      } catch (processingError) {
        if (uploadSource !== "desktop_client") {
          throw processingError
        }
        processingFailureReason = "Desktop capture OCR request failed. Marked failed."
        analysis = {
          foundTotalAssetsAnchor: false,
          confidence: 0,
          stashValueText: null,
          stashValueMillions: null,
          timeTakenMs: null,
          stashValueBoundingBox: null,
          stashSearchBand: null,
          debugOutputDir: null,
        }
      }
      if (
        uploadSource === "desktop_client" &&
        (!analysis.foundTotalAssetsAnchor || analysis.stashValueMillions === null)
      ) {
        processingFailureReason =
          "Desktop capture OCR could not reliably read stash value. Marked failed."
      }

      const [job] = await db
        .insert(manualUploadJobsTable)
        .values({
          userId: user.id,
          status: processingFailureReason ? "failed" : "processed",
          rawImagePath: RAW_IMAGE_PATH_NOT_STORED,
          rawImageHash: imageHash,
          parsedStashValue:
            analysis.stashValueMillions === null
              ? null
              : analysis.stashValueMillions.toString(),
          confidence: analysis.confidence.toString(),
          confirmedStashValue: null,
          parseNotes: JSON.stringify({
            analysis,
            source: uploadSource,
            ...(processingFailureReason
              ? { processingFailureReason }
              : {}),
          } satisfies UploadJobParseNotes),
        })
        .returning()

      if (
        !processingFailureReason &&
        analysis.foundTotalAssetsAnchor &&
        analysis.confidence >= AUTO_CONFIRM_MIN_CONFIDENCE &&
        analysis.stashValueMillions !== null
      ) {
        const confirmedAt = new Date()
        const raidId = await persistConfirmedSnapshot({
          userId: user.id,
          uploadJobId: job.id,
          stashValue: analysis.stashValueMillions,
          confidence: job.confidence,
          raidMode: "operations",
          extracted: false,
          loadoutCost: 0,
          consumablesCost: 0,
          insuranceCost: 0,
          confirmedAt,
        })
        const [autoConfirmedJob] = await db
          .update(manualUploadJobsTable)
          // Persist confirmation metadata so UI can clearly show how this job was confirmed.
          .set({
            status: "confirmed",
            confirmedStashValue: analysis.stashValueMillions.toString(),
            parseNotes: JSON.stringify({
              ...parseUploadJobParseNotes(job.parseNotes),
              analysis,
              confirmation: {
                method: "auto",
                confirmedByUser: false,
                editedByUser: false,
                confirmedAt: confirmedAt.toISOString(),
              },
            } satisfies UploadJobParseNotes),
            updatedAt: confirmedAt,
          })
          .where(
            and(
              eq(manualUploadJobsTable.id, job.id),
              eq(manualUploadJobsTable.userId, user.id)
            )
          )
          .returning()
        await rebuildAllTimeLeaderboardForUser(user.id)
        return {
          job: toUploadJobDto(autoConfirmedJob),
          autoConfirmed: true,
          raidId,
          analysis,
        }
      }

      return { job: toUploadJobDto(job), autoConfirmed: false, analysis }
    } catch (error) {
      const url = new URL(request.url)
      const pathname = url.pathname
      console.log("🚀 ~ RouteHandler ~ handleRequest ~ pathname:", pathname)
      console.error("Upload manual route failed:", error)
      set.status = 500
      return { error: "Upload processing failed" }
    }
  })
  .post(
    "/uploads/:uploadId/confirm",
    async ({ authContext, params, body, set }) => {
      const currentAuth = requireAuthContext(authContext, set)
      if (!currentAuth) {
        return { error: "Unauthorized" }
      }
      const user = currentAuth.localUser
      const uploadJob = await getUploadJobForUser(params.uploadId, user.id)
      if (!uploadJob) {
        set.status = 404
        return { error: "Upload job not found" }
      }

      const parsedBody = confirmUploadSchema.safeParse(body)
      if (!parsedBody.success) {
        set.status = 400
        return { error: "Invalid payload" }
      }

      const raidPayload = parsedBody.data
      const parsedStashValue =
        uploadJob.parsedStashValue === null
          ? null
          : toOneDecimalMillion(Number(uploadJob.parsedStashValue))
      const editedByUser =
        parsedStashValue === null ||
        toOneDecimalMillion(raidPayload.stashValue) !== parsedStashValue
      const latestStashValue = await getLatestStashValue(user.id)
      const delta =
        latestStashValue === null
          ? 0
          : Math.abs(raidPayload.stashValue - latestStashValue)
      if (
        latestStashValue !== null &&
        delta > env.stashDeltaWarningThresholdM &&
        !raidPayload.forceConfirm
      ) {
        const warning: UploadConfirmWarningDto = {
          lastStashValue: latestStashValue,
          currentStashValue: raidPayload.stashValue,
          delta: toOneDecimalMillion(delta),
          threshold: env.stashDeltaWarningThresholdM,
        }
        set.status = 409
        return {
          error:
            "Large stash change detected. Confirm again with forceConfirm=true to continue.",
          warning,
        }
      }

      const confirmedAt = new Date()
      const raidId = await persistConfirmedSnapshot({
        userId: user.id,
        uploadJobId: uploadJob.id,
        stashValue: raidPayload.stashValue,
        confidence: uploadJob.confidence,
        raidMode: raidPayload.raidMode,
        extracted: raidPayload.extracted,
        loadoutCost: raidPayload.loadoutCost,
        consumablesCost: raidPayload.consumablesCost,
        insuranceCost: raidPayload.insuranceCost,
        confirmedAt,
      })

      const [updatedJob] = await db
        .update(manualUploadJobsTable)
        .set({
          status: "confirmed",
          confirmedStashValue: raidPayload.stashValue.toString(),
          parseNotes: JSON.stringify({
            ...parseUploadJobParseNotes(uploadJob.parseNotes),
            confirmation: {
              method: "user",
              confirmedByUser: true,
              editedByUser,
              confirmedAt: confirmedAt.toISOString(),
            },
          } satisfies UploadJobParseNotes),
          updatedAt: confirmedAt,
        })
        .where(
          and(
            eq(manualUploadJobsTable.id, uploadJob.id),
            eq(manualUploadJobsTable.userId, user.id)
          )
        )
        .returning()

      await rebuildAllTimeLeaderboardForUser(user.id)

      return { job: toUploadJobDto(updatedJob), raidId }
    }
  )
  .delete(
    "/uploads/:uploadId/snapshot",
    async ({ authContext, params, set }) => {
      const currentAuth = requireAuthContext(authContext, set)
      if (!currentAuth) {
        return { error: "Unauthorized" }
      }
      const user = currentAuth.localUser

      const uploadJob = await getUploadJobForUser(params.uploadId, user.id)
      if (!uploadJob) {
        set.status = 404
        return { error: "Upload job not found" }
      }

      const result = await deleteSnapshotForUpload(user.id, params.uploadId)
      if (!result.deleted) {
        set.status = 409
        return { error: "No snapshot found for this upload." }
      }

      await rebuildAllTimeLeaderboardForUser(user.id)
      return {
        deleted: true,
        deletedSessionIds: result.deletedSessionIds,
      }
    }
  )
  .get("/uploads", async ({ authContext, set }) => {
    const currentAuth = requireAuthContext(authContext, set)
    if (!currentAuth) {
      return { error: "Unauthorized" }
    }
    const user = currentAuth.localUser
    const jobs = await db.query.manualUploadJobsTable.findMany({
      where: eq(manualUploadJobsTable.userId, user.id),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      limit: 20,
    })
    const jobIds = jobs.map((job) => job.id)
    const snapshotRows =
      jobIds.length === 0
        ? []
        : await db.query.stashSnapshotsTable.findMany({
            where: and(
              eq(stashSnapshotsTable.userId, user.id),
              inArray(stashSnapshotsTable.uploadJobId, jobIds)
            ),
            orderBy: [desc(stashSnapshotsTable.createdAt)],
          })
    const firstByUploadId = new Map<
      string,
      { sessionId: string | null; raidId: string | null }
    >()
    for (const snapshot of snapshotRows) {
      if (!snapshot.uploadJobId || firstByUploadId.has(snapshot.uploadJobId)) {
        continue
      }
      firstByUploadId.set(snapshot.uploadJobId, {
        sessionId: snapshot.sessionId,
        raidId: snapshot.raidId,
      })
    }

    return jobs.map((job) => {
      const linked = firstByUploadId.get(job.id)
      return {
        ...toUploadJobDto(job),
        sessionId: linked?.sessionId ?? null,
        raidId: linked?.raidId ?? null,
      }
    })
  })
