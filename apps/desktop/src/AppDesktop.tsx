import { useCallback, useEffect, useRef, useState } from "react"
import { useMemo } from "react"
import { invoke } from "@tauri-apps/api/core"
import {
  RiComputerLine,
  RiLoginCircleLine,
  RiLogoutCircleRLine,
  RiMoonClearLine,
  RiRefreshLine,
  RiSunLine,
} from "@remixicon/react"
import type {
  ActiveSessionDto,
  DashboardOverviewDto,
  ReopenableSessionDto,
  UploadJobDto,
} from "@workspace/domain"
import { ApiError, createDesktopApi } from "./lib/api"

const AUTH_TOKEN_STORAGE_KEY = "desktop.auth.token"
const HOTKEY_STORAGE_KEY = "desktop.capture.hotkey"
const HOTKEY_ENABLED_STORAGE_KEY = "desktop.capture.enabled"
const CAPTURE_MONITOR_INDEX_STORAGE_KEY = "desktop.capture.monitorIndex"
const CAPTURE_SAVE_DEBUG_COPY_STORAGE_KEY = "desktop.capture.saveDebugCopy"
const THEME_STORAGE_KEY = "desktop.theme.mode"
const NOTIFY_CAPTURE_START_STORAGE_KEY = "desktop.notify.captureStart"
const NOTIFY_CAPTURE_SUCCESS_STORAGE_KEY = "desktop.notify.captureSuccess"
const NOTIFY_CAPTURE_FAILURE_STORAGE_KEY = "desktop.notify.captureFailure"
const SOUND_CAPTURE_START_STORAGE_KEY = "desktop.sound.captureStart"
const SOUND_CAPTURE_SUCCESS_STORAGE_KEY = "desktop.sound.captureSuccess"
const SOUND_CAPTURE_FAILURE_STORAGE_KEY = "desktop.sound.captureFailure"
const DEFAULT_CAPTURE_HOTKEY = "Ctrl+Shift+F8"
const WEB_BASE_URL = import.meta.env.VITE_WEB_URL ?? "http://localhost:4173"
const DESKTOP_CALLBACK_URL = "dftstash://auth/callback"
const isDesktopTauriRuntime =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

type ThemeMode = "light" | "dark"
type CaptureResponse = {
  imageBase64: string
}
type MonitorOption = {
  index: number
  label: string
}

function parseTokenFromDeepLink(inputUrl: string): string | null {
  try {
    const parsedUrl = new URL(inputUrl)
    return parsedUrl.searchParams.get("token")
  } catch {
    return null
  }
}

async function openExternalUrl(url: string) {
  if (!isDesktopTauriRuntime) {
    window.open(url, "_blank", "noopener,noreferrer")
    return
  }
  const { openUrl } = await import("@tauri-apps/plugin-opener")
  await openUrl(url)
}

function toCurrencyText(amount: number | null | undefined) {
  const safeValue =
    typeof amount === "number" && Number.isFinite(amount) ? amount : 0
  return `${safeValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}M`
}

function formatDurationHms(totalSeconds: number) {
  const safe = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.floor(totalSeconds))
    : 0
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  return `${minutes}m ${seconds}s`
}

async function sendDesktopNotification(title: string, body: string) {
  if (!isDesktopTauriRuntime) return
  try {
    const { isPermissionGranted, requestPermission, sendNotification } =
      await import("@tauri-apps/plugin-notification")
    let granted = await isPermissionGranted()
    if (!granted) {
      const permission = await requestPermission()
      granted = permission === "granted"
    }
    if (!granted) return
    sendNotification({ title, body })
  } catch {
    // Keep silent so notification issues never break capture flow.
  }
}

async function playSystemSound(kind: "capture" | "success" | "failure") {
  if (isDesktopTauriRuntime) {
    await invoke("play_feedback_sound", { kind }).catch(() => undefined)
    return
  }
  if (kind === "capture") {
    playSignalTone([{ frequency: 640, durationMs: 120 }])
    return
  }
  if (kind === "success") {
    playSignalTone([
      { frequency: 720, durationMs: 120 },
      { frequency: 940, durationMs: 140 },
    ])
    return
  }
  playSignalTone([
    { frequency: 420, durationMs: 120 },
    { frequency: 340, durationMs: 160 },
  ])
}

function playSignalTone(
  pattern: Array<{ frequency: number; durationMs: number; gain?: number }>
) {
  if (typeof window === "undefined" || pattern.length === 0) return
  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!AudioContextCtor) return
  const context = new AudioContextCtor()
  const now = context.currentTime
  let cursor = now

  for (const tone of pattern) {
    const oscillator = context.createOscillator()
    const gainNode = context.createGain()
    oscillator.type = "sine"
    oscillator.frequency.value = tone.frequency
    gainNode.gain.value = tone.gain ?? 0.05
    oscillator.connect(gainNode)
    gainNode.connect(context.destination)
    oscillator.start(cursor)
    oscillator.stop(cursor + tone.durationMs / 1000)
    cursor += tone.durationMs / 1000 + 0.03
  }

  window.setTimeout(() => {
    void context.close()
  }, Math.max(800, (cursor - now) * 1000 + 200))
}

export default function AppDesktop() {
  const [authToken, setAuthToken] = useState<string | null>(() =>
    window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
  )
  const [authIssue, setAuthIssue] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState("Desktop Client")
  const [overview, setOverview] = useState<DashboardOverviewDto | null>(null)
  const [uploads, setUploads] = useState<UploadJobDto[]>([])
  const [activeSession, setActiveSession] = useState<ActiveSessionDto | null>(
    null
  )
  const [reopenableSession, setReopenableSession] =
    useState<ReopenableSessionDto | null>(null)
  const [captureHotkey, setCaptureHotkey] = useState(
    () =>
      window.localStorage.getItem(HOTKEY_STORAGE_KEY) ?? DEFAULT_CAPTURE_HOTKEY
  )
  const [captureEnabled, setCaptureEnabled] = useState(
    () => window.localStorage.getItem(HOTKEY_ENABLED_STORAGE_KEY) !== "false"
  )
  const [captureMonitorIndex, setCaptureMonitorIndex] = useState<number>(() => {
    const rawValue = window.localStorage.getItem(
      CAPTURE_MONITOR_INDEX_STORAGE_KEY
    )
    const parsed = rawValue ? Number(rawValue) : 0
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0
  })
  const [saveDebugCopy, setSaveDebugCopy] = useState(
    () =>
      window.localStorage.getItem(CAPTURE_SAVE_DEBUG_COPY_STORAGE_KEY) ===
      "true"
  )
  const [notifyCaptureStart, setNotifyCaptureStart] = useState(
    () => window.localStorage.getItem(NOTIFY_CAPTURE_START_STORAGE_KEY) === "true"
  )
  const [notifyCaptureSuccess, setNotifyCaptureSuccess] = useState(
    () => window.localStorage.getItem(NOTIFY_CAPTURE_SUCCESS_STORAGE_KEY) === "true"
  )
  const [notifyCaptureFailure, setNotifyCaptureFailure] = useState(
    () => window.localStorage.getItem(NOTIFY_CAPTURE_FAILURE_STORAGE_KEY) !== "false"
  )
  const [soundCaptureStart, setSoundCaptureStart] = useState(
    () => window.localStorage.getItem(SOUND_CAPTURE_START_STORAGE_KEY) === "true"
  )
  const [soundCaptureSuccess, setSoundCaptureSuccess] = useState(
    () => window.localStorage.getItem(SOUND_CAPTURE_SUCCESS_STORAGE_KEY) !== "false"
  )
  const [soundCaptureFailure, setSoundCaptureFailure] = useState(
    () => window.localStorage.getItem(SOUND_CAPTURE_FAILURE_STORAGE_KEY) !== "false"
  )
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    () =>
      (window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode) ?? "dark"
  )
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [captureStatus, setCaptureStatus] = useState("Capture is idle.")
  const [availableMonitors, setAvailableMonitors] = useState<MonitorOption[]>(
    []
  )
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false)
  const captureInFlightRef = useRef(false)

  const api = useMemo(
    () => (authToken ? createDesktopApi(authToken) : null),
    [authToken]
  )

  const clearAuth = useCallback((reason?: string) => {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    setAuthToken(null)
    setAuthIssue(reason ?? null)
    setDisplayName("Desktop Client")
    setOverview(null)
    setUploads([])
    setActiveSession(null)
    setReopenableSession(null)
  }, [])

  const refreshData = useCallback(async () => {
    if (!api) return
    try {
      const [
        me,
        overviewResponse,
        uploadsResponse,
        activeSessionResponse,
        reopenableSessionResponse,
      ] = await Promise.all([
        api.me(),
        api.getOverview(),
        api.getUploads(),
        api.getActiveSession(),
        api.getReopenableLastSession(),
      ])
      setDisplayName(me.displayName ?? "Desktop Player")
      setOverview(overviewResponse)
      setUploads(uploadsResponse)
      setActiveSession(activeSessionResponse.activeSession)
      setReopenableSession(reopenableSessionResponse.reopenableSession)
      setAuthIssue(null)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearAuth(
          "Your desktop API key is invalid or revoked. Reconnect from website."
        )
      }
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to load desktop data."
      )
    }
  }, [api, clearAuth])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark")
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode)
  }, [themeMode])

  useEffect(() => {
    if (!statusMessage) return
    const timeoutId = window.setTimeout(() => {
      setStatusMessage(null)
    }, 4000)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [statusMessage])

  useEffect(() => {
    if (!api) return
    void refreshData()
  }, [api, refreshData])

  useEffect(() => {
    if (!isDesktopTauriRuntime) return
    void invoke<MonitorOption[]>("list_capture_monitors")
      .then((monitors) => setAvailableMonitors(monitors))
      .catch(() => setAvailableMonitors([]))
  }, [])

  useEffect(() => {
    const handleDeepLink = (incomingUrl: string) => {
      const token = parseTokenFromDeepLink(incomingUrl)
      if (!token) return
      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
      setAuthToken(token)
      setAuthIssue(null)
      setStatusMessage("Desktop app connected successfully.")
    }

    const load = async () => {
      if (!isDesktopTauriRuntime) return
      const { getCurrent, onOpenUrl } =
        await import("@tauri-apps/plugin-deep-link")
      const urls = await getCurrent()
      urls?.forEach(handleDeepLink)
      const unlisten = await onOpenUrl((incomingUrls) =>
        incomingUrls.forEach(handleDeepLink)
      )
      return unlisten
    }

    let dispose: (() => void) | undefined
    void load().then((unlisten) => {
      dispose = unlisten
    })
    return () => dispose?.()
  }, [])

  useEffect(() => {
    if (!authToken || !isDesktopTauriRuntime) return
    const applyHotkey = async () => {
      const { unregisterAll, register } =
        await import("@tauri-apps/plugin-global-shortcut")
      await unregisterAll().catch(() => undefined)
      await invoke("set_fallback_hotkey", {
        shortcut: captureHotkey,
        enabled: captureEnabled,
      }).catch(() => undefined)
      if (captureEnabled) {
        await register(captureHotkey, () => {
          void handleCapture()
        }).catch(() => undefined)
      }
    }
    void applyHotkey()
  }, [authToken, captureEnabled, captureHotkey])

  const saveSettings = useCallback(() => {
    window.localStorage.setItem(HOTKEY_STORAGE_KEY, captureHotkey)
    window.localStorage.setItem(
      HOTKEY_ENABLED_STORAGE_KEY,
      captureEnabled ? "true" : "false"
    )
    window.localStorage.setItem(
      CAPTURE_MONITOR_INDEX_STORAGE_KEY,
      String(captureMonitorIndex)
    )
    window.localStorage.setItem(
      CAPTURE_SAVE_DEBUG_COPY_STORAGE_KEY,
      saveDebugCopy ? "true" : "false"
    )
    window.localStorage.setItem(
      NOTIFY_CAPTURE_START_STORAGE_KEY,
      notifyCaptureStart ? "true" : "false"
    )
    window.localStorage.setItem(
      NOTIFY_CAPTURE_SUCCESS_STORAGE_KEY,
      notifyCaptureSuccess ? "true" : "false"
    )
    window.localStorage.setItem(
      NOTIFY_CAPTURE_FAILURE_STORAGE_KEY,
      notifyCaptureFailure ? "true" : "false"
    )
    window.localStorage.setItem(
      SOUND_CAPTURE_START_STORAGE_KEY,
      soundCaptureStart ? "true" : "false"
    )
    window.localStorage.setItem(
      SOUND_CAPTURE_SUCCESS_STORAGE_KEY,
      soundCaptureSuccess ? "true" : "false"
    )
    window.localStorage.setItem(
      SOUND_CAPTURE_FAILURE_STORAGE_KEY,
      soundCaptureFailure ? "true" : "false"
    )
    setStatusMessage("Settings saved.")
  }, [
    captureEnabled,
    captureHotkey,
    captureMonitorIndex,
    notifyCaptureFailure,
    notifyCaptureStart,
    notifyCaptureSuccess,
    saveDebugCopy,
    soundCaptureFailure,
    soundCaptureStart,
    soundCaptureSuccess,
  ])

  const handleCapture = useCallback(async () => {
    if (!api || captureInFlightRef.current) return
    captureInFlightRef.current = true
    setCaptureStatus("Capturing...")
    if (notifyCaptureStart) {
      void sendDesktopNotification(
        "DFStash capture",
        "Screenshot captured. Processing in background..."
      )
    }
    if (soundCaptureStart) {
      void playSystemSound("capture")
    }
    try {
      const captureResult = await invoke<CaptureResponse>(
        "capture_monitor_png_base64",
        {
          monitorIndex: captureMonitorIndex,
          saveDebugCopy,
        }
      )
      const uploadResult = await api.createUpload({
        filename: `desktop-capture-${Date.now()}.jpg`,
        imageBase64: captureResult.imageBase64,
        source: "desktop_client",
      })

      if (uploadResult.job.status === "failed") {
        setCaptureStatus("Capture failed OCR checks and was marked as failed.")
        if (notifyCaptureFailure) {
          void sendDesktopNotification(
            "DFStash capture failed",
            "Screenshot could not be processed and was marked as failed."
          )
        }
        if (soundCaptureFailure) {
          void playSystemSound("failure")
        }
      } else {
        setCaptureStatus("Capture uploaded successfully.")
        if (notifyCaptureSuccess) {
          void sendDesktopNotification(
            "DFStash capture complete",
            uploadResult.autoConfirmed
              ? "Capture uploaded and auto-confirmed."
              : "Capture uploaded successfully."
          )
        }
        if (soundCaptureSuccess) {
          void playSystemSound("success")
        }
      }
      await refreshData()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearAuth(
          "Your desktop API key is invalid or revoked. Reconnect from website."
        )
      }
      setCaptureStatus(
        error instanceof Error ? error.message : "Capture failed."
      )
      if (notifyCaptureFailure) {
        void sendDesktopNotification(
          "DFStash capture failed",
          error instanceof Error ? error.message : "Capture failed."
        )
      }
      if (soundCaptureFailure) {
        void playSystemSound("failure")
      }
    } finally {
      captureInFlightRef.current = false
    }
  }, [
    api,
    captureMonitorIndex,
    clearAuth,
    notifyCaptureFailure,
    notifyCaptureStart,
    notifyCaptureSuccess,
    refreshData,
    saveDebugCopy,
    soundCaptureFailure,
    soundCaptureStart,
    soundCaptureSuccess,
  ])

  const handleEndSession = useCallback(async () => {
    if (!api) return
    try {
      const response = await api.endSession()
      if (response.endedSession) {
        setStatusMessage("Current session ended.")
      } else {
        setStatusMessage("No active session to end.")
      }
      await refreshData()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearAuth(
          "Your desktop API key is invalid or revoked. Reconnect from website."
        )
      }
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Failed to end current session."
      )
    }
  }, [api, clearAuth, refreshData])

  const handleReopenSession = useCallback(async () => {
    if (!api) return
    try {
      const response = await api.reopenLastSession()
      if (response.reopenedSession) {
        setStatusMessage("Last session reopened.")
      } else {
        setStatusMessage("No reopenable session available.")
      }
      await refreshData()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearAuth(
          "Your desktop API key is invalid or revoked. Reconnect from website."
        )
      }
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Failed to reopen last session."
      )
    }
  }, [api, clearAuth, refreshData])

  const handleTestNotification = useCallback(async () => {
    await sendDesktopNotification(
      "DFStash notification test",
      "If you can see this, desktop notifications are working."
    )
    setStatusMessage(
      "Notification test sent. If nothing appeared, check Windows notification permission and Focus Assist."
    )
  }, [])

  useEffect(() => {
    if (!isRecordingHotkey) return
    const handler = (event: KeyboardEvent) => {
      event.preventDefault()
      const parts: string[] = []
      if (event.ctrlKey) parts.push("Ctrl")
      if (event.altKey) parts.push("Alt")
      if (event.shiftKey) parts.push("Shift")
      if (event.metaKey) parts.push("Win")
      if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) return
      parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key)
      setCaptureHotkey(parts.join("+"))
      setIsRecordingHotkey(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isRecordingHotkey])

  if (!authToken) {
    return (
      <div className="bg-zinc-100 p-8 dark:bg-zinc-950 flex h-screen items-center justify-center">
        <div className="max-w-3xl border-zinc-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 w-full rounded-2xl border">
          <div className="gap-8 lg:grid-cols-2 grid">
            <div>
              <h1 className="text-3xl font-bold">
                Welcome to Delta Force Tracker
              </h1>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
                Desktop-first capture app with hotkeys, monitor targeting,
                background tray mode, and account-linked auth.
              </p>
            </div>
            <div className="border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-950 rounded-xl border">
              <h2 className="text-lg font-semibold">Connect desktop app</h2>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Sign in on website and return automatically via deep link.
              </p>
              {authIssue ? (
                <p className="mt-3 rounded border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200 border">
                  {authIssue}
                </p>
              ) : null}
              <button
                type="button"
                className="mt-4 gap-2 bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900 inline-flex w-full items-center justify-center rounded-md"
                onClick={() => {
                  const callbackParam = encodeURIComponent(DESKTOP_CALLBACK_URL)
                  void openExternalUrl(
                    `${WEB_BASE_URL}/desktop/connect?callback=${callbackParam}`
                  )
                }}
              >
                <RiLoginCircleLine className="h-4 w-4" />
                Connect with website
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-zinc-100 dark:bg-zinc-950 flex h-screen">
      <aside className="w-64 border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 lg:block hidden border-r">
        <p className="text-xs tracking-wider text-zinc-500 uppercase">
          Desktop App
        </p>
        <h1 className="mt-1 text-lg font-bold">Delta Force Tracker</h1>
        <div className="mt-6 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
          <p>User: {displayName}</p>
          <p>Profit: {toCurrencyText(overview?.totalProfit)}</p>
          <p>Latest stash: {toCurrencyText(overview?.latestStashValue)}</p>
        </div>
      </aside>

      <main className="min-w-0 flex flex-1 flex-col">
        <header className="border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 flex items-center justify-between border-b">
          <div className="gap-2 flex items-center">
            <RiComputerLine className="h-5 w-5" />
            <span className="font-semibold">Desktop Capture Client</span>
          </div>
          <div className="gap-2 flex items-center">
            <button
              type="button"
              className="gap-1 border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 inline-flex items-center rounded-md border"
              onClick={() =>
                setThemeMode((prev) => (prev === "dark" ? "light" : "dark"))
              }
            >
              {themeMode === "dark" ? (
                <RiSunLine className="h-3.5 w-3.5" />
              ) : (
                <RiMoonClearLine className="h-3.5 w-3.5" />
              )}
              {themeMode === "dark" ? "Light" : "Dark"}
            </button>
            <button
              type="button"
              className="gap-1 border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 inline-flex items-center rounded-md border"
              onClick={() => clearAuth()}
            >
              <RiLogoutCircleRLine className="h-3.5 w-3.5" />
              Log out
            </button>
          </div>
        </header>

        <div className="hide-scrollbar space-y-4 p-4 lg:p-6 overflow-y-auto">
          {statusMessage ? (
            <p className="border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 rounded-md border">
              {statusMessage}
            </p>
          ) : null}

          <section className="border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 rounded-xl border">
            <div className="gap-2 flex flex-wrap items-center justify-between">
              <h2 className="text-lg font-semibold">Capture</h2>
              <button
                type="button"
                className="bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-md"
                onClick={() => void handleCapture()}
              >
                Capture now
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {captureStatus}
            </p>
          </section>

          <section className="border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 rounded-xl border">
            <div className="gap-2 flex flex-wrap items-center justify-between">
              <div className="gap-2 flex items-center">
                <h2 className="text-lg font-semibold">
                  {activeSession ? "Current Session" : "Last Session"}
                </h2>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    activeSession
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : reopenableSession
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {activeSession
                    ? "ACTIVE"
                    : reopenableSession
                      ? "LAST AVAILABLE"
                      : "NO SESSION"}
                </span>
              </div>
              {activeSession ? (
                <button
                  type="button"
                  onClick={() => void handleEndSession()}
                  disabled={!activeSession}
                  className="mt-2 gap-2 border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300 inline-flex items-center rounded-md border disabled:cursor-not-allowed disabled:opacity-50"
                >
                  End session
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleReopenSession()}
                  disabled={!reopenableSession || !!activeSession}
                  className="gap-2 border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300 inline-flex items-center rounded-md border disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reopen session
                </button>
              )}
            </div>
            {activeSession ? (
              <div className="mt-3 gap-3 sm:grid-cols-3 grid">
                <div className="border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 rounded-md border">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Active session profit
                  </p>
                  <p
                    className={`rounded px-2 py-1 font-semibold inline-flex ${
                      activeSession.totalProfit >= 0
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                    }`}
                  >
                    {activeSession.totalProfit >= 0
                      ? "+"
                      : activeSession.totalProfit < 0
                        ? "-"
                        : ""}
                    {toCurrencyText(Math.abs(activeSession.totalProfit))}
                  </p>
                </div>
                <div className="border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 rounded-md border">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Total raids
                  </p>
                  <p className="font-semibold">{activeSession.totalRaids}</p>
                </div>
                <div className="border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 rounded-md border">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Duration
                  </p>
                  <p className="font-semibold">
                    {formatDurationHms(activeSession.durationSeconds)}
                  </p>
                </div>
              </div>
            ) : reopenableSession ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Last session can be reopened for up to 1 hour after ending.
                </p>
                <div className="gap-3 sm:grid-cols-3 grid">
                  <div className="border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 rounded-md border">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Last session profit
                    </p>
                    <p
                      className={`rounded px-2 py-1 font-semibold inline-flex ${
                        reopenableSession.session.totalProfit >= 0
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                      }`}
                    >
                      {reopenableSession.session.totalProfit >= 0
                        ? "+"
                        : reopenableSession.session.totalProfit < 0
                          ? "-"
                          : ""}
                      {toCurrencyText(
                        Math.abs(reopenableSession.session.totalProfit)
                      )}
                    </p>
                  </div>
                  <div className="border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 rounded-md border">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Last session duration
                    </p>
                    <p className="font-semibold">
                      {formatDurationHms(
                        reopenableSession.session.durationSeconds
                      )}
                    </p>
                  </div>
                  <div className="border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 rounded-md border">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Reopen window
                    </p>
                    <p className="font-semibold">
                      {formatDurationHms(reopenableSession.remainingSeconds)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                No active or reopenable last session right now.
              </p>
            )}
          </section>

          <section className="gap-4 xl:grid-cols-2 grid">
            <div className="space-y-4 border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 rounded-xl border">
              <h3 className="text-lg font-semibold">Config</h3>
              <label className="gap-1 text-sm flex flex-col">
                <span className="font-medium">Hotkey</span>
                <div className="gap-2 flex">
                  <input
                    value={captureHotkey}
                    onChange={(event) => setCaptureHotkey(event.target.value)}
                    className="border-zinc-300 px-3 py-2 dark:border-zinc-700 w-full rounded-md border bg-transparent"
                  />
                  <button
                    type="button"
                    className="border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700 rounded-md border"
                    onClick={() => setIsRecordingHotkey((prev) => !prev)}
                  >
                    {isRecordingHotkey ? "Stop" : "Record"}
                  </button>
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Use a combo that does not conflict with in-game controls.
                </span>
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Capture
                  </p>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Enable hotkey</span>
                    <input
                      type="checkbox"
                      checked={captureEnabled}
                      onChange={(event) => setCaptureEnabled(event.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Save debug copy to Desktop</span>
                    <input
                      type="checkbox"
                      checked={saveDebugCopy}
                      onChange={(event) => setSaveDebugCopy(event.target.checked)}
                    />
                  </label>
                </div>

                <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Notifications
                  </p>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Notify when captured</span>
                    <input
                      type="checkbox"
                      checked={notifyCaptureStart}
                      onChange={(event) => setNotifyCaptureStart(event.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Notify on success</span>
                    <input
                      type="checkbox"
                      checked={notifyCaptureSuccess}
                      onChange={(event) => setNotifyCaptureSuccess(event.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Notify on failure</span>
                    <input
                      type="checkbox"
                      checked={notifyCaptureFailure}
                      onChange={(event) => setNotifyCaptureFailure(event.target.checked)}
                    />
                  </label>
                </div>

                <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Sound Cues
                  </p>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Sound on capture</span>
                    <input
                      type="checkbox"
                      checked={soundCaptureStart}
                      onChange={(event) => setSoundCaptureStart(event.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Sound on success</span>
                    <input
                      type="checkbox"
                      checked={soundCaptureSuccess}
                      onChange={(event) => setSoundCaptureSuccess(event.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Sound on failure</span>
                    <input
                      type="checkbox"
                      checked={soundCaptureFailure}
                      onChange={(event) => setSoundCaptureFailure(event.target.checked)}
                    />
                  </label>
                </div>

                <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Actions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700"
                      onClick={() => void handleTestNotification()}
                    >
                      Test notification
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700"
                      onClick={() => void playSystemSound("success")}
                    >
                      Test sound
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                      onClick={saveSettings}
                    >
                      Save settings
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 rounded-xl border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Monitors</h3>
                <button
                  type="button"
                  className="gap-1 border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 inline-flex items-center rounded-md border"
                  onClick={() => {
                    void invoke<MonitorOption[]>("list_capture_monitors")
                      .then((monitors) => setAvailableMonitors(monitors))
                      .catch(() => setAvailableMonitors([]))
                  }}
                >
                  <RiRefreshLine className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>
              {availableMonitors.map((monitor) => {
                const selected = monitor.index === captureMonitorIndex
                return (
                  <button
                    key={monitor.index}
                    type="button"
                    onClick={() => setCaptureMonitorIndex(monitor.index)}
                    className={`px-3 py-2 text-sm w-full rounded-md border text-left ${
                      selected
                        ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
                        : "border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    {monitor.label}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 rounded-xl border">
            <h3 className="text-lg font-semibold">Recent uploads</h3>
            <div className="mt-3 space-y-2">
              {uploads.slice(0, 10).map((job) => (
                <div
                  key={job.id}
                  className="border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 flex items-center justify-between rounded-md border"
                >
                  <span>{new Date(job.createdAt).toLocaleString()}</span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {job.status}
                  </span>
                  <span>
                    {job.confirmedStashValue === null
                      ? "-"
                      : toCurrencyText(job.confirmedStashValue)}
                  </span>
                </div>
              ))}
              {uploads.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No uploads yet.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
