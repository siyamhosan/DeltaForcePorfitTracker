import { Elysia } from "elysia"

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY

type AuthState =
  | {
      userId: string
      sessionId: string | null
      isAuthenticated: true
    }
  | {
      userId: null
      sessionId: null
      isAuthenticated: false
    }

const unauthenticatedState: AuthState = {
  userId: null,
  sessionId: null,
  isAuthenticated: false,
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")
  if (!authorization) {
    return null
  }

  const [scheme, token] = authorization.split(" ")
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null
  }

  return token
}

async function verifyClerkSessionToken(token: string): Promise<AuthState> {
  if (!CLERK_SECRET_KEY) {
    return unauthenticatedState
  }

  const response = await fetch("https://api.clerk.com/v1/sessions/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
    },
    body: JSON.stringify({ token }),
  })

  if (!response.ok) {
    return unauthenticatedState
  }

  const data = (await response.json()) as {
    sub?: string
    sid?: string
  }

  if (!data.sub) {
    return unauthenticatedState
  }

  return {
    userId: data.sub,
    sessionId: data.sid ?? null,
    isAuthenticated: true,
  }
}

const app = new Elysia()
  .derive(async ({ request }) => {
    const token = getBearerToken(request)
    if (!token) {
      return { auth: unauthenticatedState }
    }

    const auth = await verifyClerkSessionToken(token)
    return { auth }
  })
  .get("/", () => ({
    name: "Delta Force Profit Tracker API",
    status: "ok",
  }))
  .group("/app", (protectedApp) =>
    protectedApp
      .onBeforeHandle(({ auth, set }) => {
        if (!auth.isAuthenticated) {
          set.status = 401
          return { error: "Unauthorized" }
        }
      })
      .get("/me", ({ auth }) => ({
        userId: auth.userId,
        sessionId: auth.sessionId,
      }))
      .get("/health", () => ({
        status: "protected_ok",
      }))
  )
  .listen(3000)

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)
