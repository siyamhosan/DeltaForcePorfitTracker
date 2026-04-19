import { SignIn, useAuth } from "@clerk/clerk-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000/v1"
const DEFAULT_CALLBACK_URL = "dftstash://auth/callback"

function sanitizeCallback(rawValue: string | null) {
  if (!rawValue) {
    return DEFAULT_CALLBACK_URL
  }
  if (!rawValue.startsWith("dftstash://")) {
    return DEFAULT_CALLBACK_URL
  }
  return rawValue
}

export function DesktopConnectPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const [status, setStatus] = useState<
    "idle" | "connecting" | "ready" | "error"
  >("idle")
  const [error, setError] = useState<string | null>(null)
  const [closeBlocked, setCloseBlocked] = useState(false)

  const callbackUrl = useMemo(() => {
    const query = new URLSearchParams(window.location.search)
    return sanitizeCallback(query.get("callback"))
  }, [])

  useEffect(() => {
    if (
      !isLoaded ||
      !isSignedIn ||
      status === "connecting" ||
      status === "ready"
    ) {
      return
    }

    const connect = async () => {
      try {
        setStatus("connecting")
        setError(null)
        const clerkToken = await getToken()
        if (!clerkToken) {
          throw new Error("Missing Clerk token")
        }

        const response = await fetch(`${API_BASE}/app/desktop/api-key`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${clerkToken}`,
            "Content-Type": "application/json",
          },
        })
        const payload = (await response.json()) as {
          secret?: string
          error?: string
        }
        if (!response.ok || !payload.secret) {
          throw new Error(payload.error ?? "Unable to connect desktop app.")
        }

        setStatus("ready")
        const separator = callbackUrl.includes("?") ? "&" : "?"
        const deepLinkUrl = `${callbackUrl}${separator}token=${encodeURIComponent(payload.secret)}`
        window.setTimeout(() => {
          window.location.href = deepLinkUrl
          window.setTimeout(() => {
            window.close()
            window.setTimeout(() => {
              setCloseBlocked(true)
            }, 900)
          }, 1100)
        }, 250)
      } catch (caughtError) {
        setStatus("error")
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Desktop handoff failed."
        )
      }
    }

    void connect()
  }, [callbackUrl, getToken, isLoaded, isSignedIn, status])

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background"></div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="max-w-sm gap-4 px-4 mx-auto flex min-h-screen flex-col justify-center">
        <h1 className="text-xl font-semibold">Connect Desktop App</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Sign in to continue and we will hand control back to your desktop app.
        </p>
        <SignIn forceRedirectUrl={window.location.href} withSignUp />
      </div>
    )
  }

  return (
    <div className="max-w-md gap-4 px-4 mx-auto flex min-h-screen flex-col justify-center text-center">
      <h1 className="text-xl font-semibold">Connecting to desktop app</h1>
      {status === "connecting" ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Hold on while we securely hand off your session.
        </p>
      ) : null}
      {status === "ready" ? (
        <>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Connected successfully. Launching desktop app now...
          </p>
          {closeBlocked ? (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                If this tab did not close automatically, you can safely close
                it.
              </p>
              <button
                type="button"
                onClick={() => window.close()}
                className="border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 inline-flex items-center justify-center rounded-md border"
              >
                Close this window
              </button>
            </div>
          ) : null}
        </>
      ) : null}
      {status === "error" ? (
        <>
          <p className="text-sm text-red-500">
            {error ?? "Desktop handoff failed."}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Keep the desktop app open, then try again. If the app did not reopen
            automatically, open it manually and retry.
          </p>
          <Link className="text-sm text-blue-600 hover:underline" to="/app">
            Go to dashboard
          </Link>
        </>
      ) : null}
    </div>
  )
}
