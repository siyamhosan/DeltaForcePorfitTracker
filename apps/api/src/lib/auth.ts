import type { usersTable } from "../db/schema"

export type LocalUser = typeof usersTable.$inferSelect

export type AuthContext =
  | {
      isAuthenticated: false
      clerkUserId: null
      sessionId: null
      localUser: null
    }
  | {
      isAuthenticated: true
      clerkUserId: string
      sessionId: string | null
      localUser: LocalUser
    }

export const unauthenticatedAuthContext: AuthContext = {
  isAuthenticated: false,
  clerkUserId: null,
  sessionId: null,
  localUser: null,
}

export function isAuthenticatedContext(
  authContext: AuthContext
): authContext is Extract<AuthContext, { isAuthenticated: true }> {
  return authContext.isAuthenticated
}
