export function toMillionValue(value: number) {
  return `${value.toFixed(1)}M`
}

export function formatAbsoluteDateTime(isoOrDate: string | Date) {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
  return date.toLocaleString()
}

export function formatAbsoluteWithTimeAgo(isoOrDate: string | Date) {
  return `${formatAbsoluteDateTime(isoOrDate)} (${formatTimeAgo(isoOrDate)})`
}

/** Relative time in the past, e.g. "just now", "5 minutes ago", "2 days ago". */
export function formatTimeAgo(isoOrDate: string | Date) {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)

  if (!Number.isFinite(diffSec)) {
    return formatAbsoluteDateTime(date)
  }

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

  if (diffSec < 0) {
    return formatAbsoluteDateTime(date)
  }
  if (diffSec < 45) {
    return "just now"
  }

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) {
    return rtf.format(-diffMin, "minute")
  }

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) {
    return rtf.format(-diffHour, "hour")
  }

  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) {
    return rtf.format(-diffDay, "day")
  }

  const diffWeek = Math.floor(diffDay / 7)
  if (diffWeek < 5) {
    return rtf.format(-diffWeek, "week")
  }

  const diffMonth = Math.floor(diffDay / 30)
  if (diffMonth < 12) {
    return rtf.format(-diffMonth, "month")
  }

  const diffYear = Math.floor(diffDay / 365)
  return rtf.format(-diffYear, "year")
}

/** Delta vs previous stash (millions), e.g. +12.3M or -4.0M */
export function formatStashDeltaMillion(delta: number) {
  const rounded = Math.round(delta * 10) / 10
  if (rounded === 0) {
    return "0.0M"
  }
  const sign = rounded > 0 ? "+" : "-"
  return `${sign}${Math.abs(rounded).toFixed(1)}M`
}

export function normalizeMillionValue(value: number) {
  return Math.round(value * 10) / 10
}

export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":")
}

export function formatProfitPerHour(totalProfit: number, durationSeconds: number) {
  if (durationSeconds <= 0) {
    return "0.0M/h"
  }
  const hours = durationSeconds / 3600
  const perHour = Math.round((totalProfit / hours) * 10) / 10
  const sign = perHour > 0 ? "+" : ""
  return `${sign}${perHour.toFixed(1)}M/h`
}

export function parseMillionInput(value: string) {
  const normalized = value.trim().toUpperCase().replace(",", "")
  if (!normalized) {
    return null
  }

  const withoutSuffix = normalized.endsWith("M") ? normalized.slice(0, -1) : normalized
  if (!/^\d{1,4}(\.\d)?$/.test(withoutSuffix)) {
    return null
  }

  const parsed = Number(withoutSuffix)
  if (Number.isNaN(parsed)) {
    return null
  }

  return normalizeMillionValue(parsed)
}
