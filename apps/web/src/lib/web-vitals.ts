import type { Metric } from "web-vitals"
import { onCLS, onINP, onLCP } from "web-vitals"

type WebVitalPayload = Metric & { route: string }

const endpoint = import.meta.env.VITE_WEB_VITALS_ENDPOINT

function sendWebVital(payload: WebVitalPayload) {
  if (!endpoint) {
    return
  }

  const body = JSON.stringify(payload)
  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, body)
    return
  }

  fetch(endpoint, {
    method: "POST",
    body,
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
    },
  }).catch(() => {
    // ignore analytics delivery failures
  })
}

function withRoute(metric: Metric): WebVitalPayload {
  return {
    ...metric,
    route: window.location.pathname,
  }
}

export function initWebVitals() {
  onCLS((metric) => sendWebVital(withRoute(metric)))
  onINP((metric) => sendWebVital(withRoute(metric)))
  onLCP((metric) => sendWebVital(withRoute(metric)))
}
