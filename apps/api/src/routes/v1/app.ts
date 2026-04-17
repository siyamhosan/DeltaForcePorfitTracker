import { Elysia } from "elysia"
import { confirmUploadSchema, createUploadSchema, type UploadConfirmWarningDto } from "@workspace/domain"
import { clerkPlugin } from "elysia-clerk"
import { and, desc, eq } from "drizzle-orm"

import { env } from "../../config/env"
import { db } from "../../db/client"
import { manualUploadJobsTable, raidsTable, stashSnapshotsTable } from "../../db/schema"
import {
  type AuthContext,
  isAuthenticatedContext,
  unauthenticatedAuthContext,
} from "../../lib/auth"
import { analyzeUploadWithExternalSystem, sha256ForBase64Image } from "../../lib/storage"
import {
  ensureUserByClerkId,
  endActiveSession,
  getActiveSession,
  getOverview,
  getSessionHistory,
  getSessionRaidsForUser,
  getUploadJobForUser,
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
  const session = await resolveSessionForSnapshot(params.userId, params.stashValue, params.confirmedAt)
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
  return lastSnapshot?.stashValue === undefined ? null : toOneDecimalMillion(Number(lastSnapshot.stashValue))
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
  .resolve(async ({ auth, clerk }) => {
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
    return { endedSession: endedSession ? toSessionHistoryItem(endedSession) : null }
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

      const imageHash = sha256ForBase64Image(payload.imageBase64)
      const existing = await db.query.manualUploadJobsTable.findFirst({
        where: and(
          eq(manualUploadJobsTable.userId, user.id),
          eq(manualUploadJobsTable.rawImageHash, imageHash)
        ),
      })

      if (existing) {
        set.status = 409
        return { error: "Duplicate upload detected for this account", job: toUploadJobDto(existing) }
      }
      const analysis = await analyzeUploadWithExternalSystem(payload.filename, payload.imageBase64)

      const [job] = await db
        .insert(manualUploadJobsTable)
        .values({
          userId: user.id,
          status: "processed",
          rawImagePath: RAW_IMAGE_PATH_NOT_STORED,
          rawImageHash: imageHash,
          parsedStashValue:
            analysis.stashValueMillions === null ? null : analysis.stashValueMillions.toString(),
          confidence: analysis.confidence.toString(),
          confirmedStashValue: null,
          parseNotes: JSON.stringify({
            analysis,
          } satisfies UploadJobParseNotes),
        })
        .returning()

      if (
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
          .where(and(eq(manualUploadJobsTable.id, job.id), eq(manualUploadJobsTable.userId, user.id)))
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
  .post("/uploads/:uploadId/confirm", async ({ authContext, params, body, set }) => {
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
      uploadJob.parsedStashValue === null ? null : toOneDecimalMillion(Number(uploadJob.parsedStashValue))
    const editedByUser =
      parsedStashValue === null || toOneDecimalMillion(raidPayload.stashValue) !== parsedStashValue
    const latestStashValue = await getLatestStashValue(user.id)
    const delta = latestStashValue === null ? 0 : Math.abs(raidPayload.stashValue - latestStashValue)
    if (latestStashValue !== null && delta > env.stashDeltaWarningThresholdM && !raidPayload.forceConfirm) {
      const warning: UploadConfirmWarningDto = {
        lastStashValue: latestStashValue,
        currentStashValue: raidPayload.stashValue,
        delta: toOneDecimalMillion(delta),
        threshold: env.stashDeltaWarningThresholdM,
      }
      set.status = 409
      return {
        error: "Large stash change detected. Confirm again with forceConfirm=true to continue.",
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
      .where(and(eq(manualUploadJobsTable.id, uploadJob.id), eq(manualUploadJobsTable.userId, user.id)))
      .returning()

    await rebuildAllTimeLeaderboardForUser(user.id)

    return { job: toUploadJobDto(updatedJob), raidId }
  })
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

    return jobs.map(toUploadJobDto)
  })
