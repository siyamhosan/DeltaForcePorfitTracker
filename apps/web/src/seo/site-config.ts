export const SITE_URL = (
  import.meta.env.VITE_SITE_URL ?? "https://dfstash.bzr.lt"
).replace(/\/$/, "")
export const SITE_NAME = "Delta Force Profit Tracker"
export const SITE_DESCRIPTION =
  "Open source Delta Force stash and profit tracker with OCR uploads, sessions, and leaderboards."
export const SITE_OG_IMAGE = `${SITE_URL}/og/default.svg`
export const GITHUB_REPO_URL =
  "https://github.com/siyamhosan/DeltaForceProfitTracker"
/** Default branch assets for marketing (same paths as repo README screenshots). */
export const GITHUB_RAW_BASE =
  "https://raw.githubusercontent.com/siyamhosan/DeltaForcePorfitTracker/main"
export const PREVIEW_IMG_WEB = `${GITHUB_RAW_BASE}/imgs/web.png`
export const PREVIEW_IMG_DESKTOP = `${GITHUB_RAW_BASE}/imgs/desktop.png`
export const DESKTOP_APP_EXE_URL =
  "https://github.com/siyamhosan/DeltaForceProfitTracker/releases/download/v0.1.0/Delta.Force.Desktop.Tracker_0.1.0_x64-setup.exe"
