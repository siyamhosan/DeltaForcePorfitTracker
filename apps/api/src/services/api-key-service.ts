import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { and, desc, eq, isNull } from "drizzle-orm"

import { env } from "../config/env"
import { db } from "../db/client"
import { apiKeysTable } from "../db/schema"

const API_KEY_PREFIX = "dfsk"
const ENCRYPTION_ALGO = "aes-256-gcm"

function toSha256(input: string) {
  return createHash("sha256").update(input).digest("hex")
}

function getEncryptionKey() {
  return createHash("sha256").update(env.desktopAuthSecret).digest()
}

function encryptSecret(secret: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ENCRYPTION_ALGO, getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString(
    "base64url"
  )}`
}

function decryptSecret(payload: string) {
  const [ivPart, tagPart, encryptedPart] = payload.split(".")
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error("Malformed encrypted secret payload.")
  }
  const iv = Buffer.from(ivPart, "base64url")
  const authTag = Buffer.from(tagPart, "base64url")
  const encrypted = Buffer.from(encryptedPart, "base64url")
  const decipher = createDecipheriv(ENCRYPTION_ALGO, getEncryptionKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
}

function toKeyPrefix(id: string) {
  return id.replace(/-/g, "").slice(0, 12)
}

function buildRawApiKey(prefix: string, secret: string) {
  return `${API_KEY_PREFIX}_${prefix}_${secret}`
}

function parseRawApiKey(rawApiKey: string) {
  const parts = rawApiKey.split("_")
  if (parts.length !== 3 || parts[0] !== API_KEY_PREFIX) {
    return null
  }
  const [, prefix, secret] = parts
  if (!prefix || !secret) {
    return null
  }
  return { prefix, secret }
}

export function toApiKeyDto(row: typeof apiKeysTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    prefix: row.prefix,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  }
}

export async function listApiKeysForUser(userId: number) {
  const rows = await db.query.apiKeysTable.findMany({
    where: eq(apiKeysTable.userId, userId),
    orderBy: [desc(apiKeysTable.createdAt)],
  })
  return rows.map(toApiKeyDto)
}

export async function createApiKeyForUser(params: {
  userId: number
  name: string
  type: "desktop" | "manual"
}) {
  const secret = randomBytes(24).toString("base64url")
  const secretHash = toSha256(secret)
  const [inserted] = await db
    .insert(apiKeysTable)
    .values({
      userId: params.userId,
      name: params.name,
      type: params.type,
      prefix: "temp",
      secretHash,
      encryptedSecret: encryptSecret(secret),
    })
    .returning()

  const prefix = toKeyPrefix(inserted.id)
  const [updated] = await db
    .update(apiKeysTable)
    .set({
      prefix,
      updatedAt: new Date(),
    })
    .where(eq(apiKeysTable.id, inserted.id))
    .returning()

  return {
    key: toApiKeyDto(updated),
    secret: buildRawApiKey(prefix, secret),
  }
}

export async function ensureDesktopApiKeyForUser(userId: number) {
  const existing = await db.query.apiKeysTable.findFirst({
    where: and(
      eq(apiKeysTable.userId, userId),
      eq(apiKeysTable.type, "desktop"),
      isNull(apiKeysTable.revokedAt)
    ),
    orderBy: [desc(apiKeysTable.createdAt)],
  })

  if (!existing) {
    return createApiKeyForUser({
      userId,
      name: "Desktop Client",
      type: "desktop",
    })
  }

  if (!existing.encryptedSecret) {
    return createApiKeyForUser({
      userId,
      name: "Desktop Client (rotated)",
      type: "desktop",
    })
  }

  const decryptedSecret = decryptSecret(existing.encryptedSecret)
  return {
    key: toApiKeyDto(existing),
    secret: buildRawApiKey(existing.prefix, decryptedSecret),
  }
}

export async function revokeApiKeyForUser(userId: number, keyId: string) {
  const [updated] = await db
    .update(apiKeysTable)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(apiKeysTable.userId, userId), eq(apiKeysTable.id, keyId), isNull(apiKeysTable.revokedAt)))
    .returning()

  return Boolean(updated)
}

export async function validateApiKey(rawApiKey: string) {
  const parsed = parseRawApiKey(rawApiKey)
  if (!parsed) {
    return null
  }
  const secretHash = toSha256(parsed.secret)
  const keyRow = await db.query.apiKeysTable.findFirst({
    where: and(
      eq(apiKeysTable.prefix, parsed.prefix),
      eq(apiKeysTable.secretHash, secretHash),
      isNull(apiKeysTable.revokedAt)
    ),
  })
  if (!keyRow) {
    return null
  }

  await db
    .update(apiKeysTable)
    .set({
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(apiKeysTable.id, keyRow.id))

  return keyRow
}
