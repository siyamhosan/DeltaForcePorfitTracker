import { timingSafeEqual } from "node:crypto"

import { env } from "../config/env"

const DESKTOP_TOKEN_AUDIENCE = "desktop-client"
const DESKTOP_TOKEN_ISSUER = "deltaforce-profit-tracker"
const encoder = new TextEncoder()

type DesktopTokenPayload = {
  iss: string
  aud: string
  sub: string
  clerkUserId: string
  iat: number
  exp: number
}

function toBase64Url(input: Uint8Array): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function fromBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))
  return Uint8Array.from(Buffer.from(`${normalized}${padding}`, "base64"))
}

async function sign(input: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.desktopAuthSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(input))
  return toBase64Url(new Uint8Array(signature))
}

async function verifySignature(input: string, signatureBase64Url: string): Promise<boolean> {
  const expectedSignature = await sign(input)
  const actualBytes = Buffer.from(signatureBase64Url)
  const expectedBytes = Buffer.from(expectedSignature)
  if (actualBytes.length !== expectedBytes.length) {
    return false
  }
  return timingSafeEqual(actualBytes, expectedBytes)
}

export async function issueDesktopAccessToken(params: {
  localUserId: number
  clerkUserId: string
  ttlSeconds?: number
}) {
  const issuedAt = Math.floor(Date.now() / 1000)
  const ttlSeconds = params.ttlSeconds ?? env.desktopAuthTokenTtlSeconds
  const expiresAt = issuedAt + ttlSeconds
  const payload: DesktopTokenPayload = {
    iss: DESKTOP_TOKEN_ISSUER,
    aud: DESKTOP_TOKEN_AUDIENCE,
    sub: String(params.localUserId),
    clerkUserId: params.clerkUserId,
    iat: issuedAt,
    exp: expiresAt,
  }
  const header = {
    alg: "HS256",
    typ: "JWT",
  }

  const tokenInput = `${toBase64Url(encoder.encode(JSON.stringify(header)))}.${toBase64Url(
    encoder.encode(JSON.stringify(payload))
  )}`
  const signature = await sign(tokenInput)

  return {
    token: `${tokenInput}.${signature}`,
    expiresAt,
  }
}

export async function verifyDesktopAccessToken(token: string) {
  const parts = token.split(".")
  if (parts.length !== 3) {
    return null
  }
  const [encodedHeader, encodedPayload, signature] = parts
  if (!encodedHeader || !encodedPayload || !signature) {
    return null
  }

  const tokenInput = `${encodedHeader}.${encodedPayload}`
  const signatureValid = await verifySignature(tokenInput, signature)
  if (!signatureValid) {
    return null
  }

  try {
    const payloadRaw = Buffer.from(fromBase64Url(encodedPayload)).toString("utf8")
    const payload = JSON.parse(payloadRaw) as Partial<DesktopTokenPayload>
    if (payload.iss !== DESKTOP_TOKEN_ISSUER || payload.aud !== DESKTOP_TOKEN_AUDIENCE) {
      return null
    }
    if (typeof payload.sub !== "string" || !payload.sub.trim()) {
      return null
    }
    if (typeof payload.clerkUserId !== "string" || !payload.clerkUserId.trim()) {
      return null
    }
    if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null
    }
    const localUserId = Number(payload.sub)
    if (!Number.isInteger(localUserId) || localUserId <= 0) {
      return null
    }
    return {
      localUserId,
      clerkUserId: payload.clerkUserId,
      exp: payload.exp,
    }
  } catch {
    return null
  }
}
