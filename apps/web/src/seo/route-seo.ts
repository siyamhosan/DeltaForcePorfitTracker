export type RouteSeoConfig = {
  path: string
  title: string
  description: string
  keywords?: string[]
  robots?: string
  includeInSitemap?: boolean
}

export const PUBLIC_ROUTE_SEO: RouteSeoConfig[] = [
  {
    path: "/",
    title: "Delta Force Profit Tracker - Open Source Stash Tracking",
    description:
      "Track Delta Force stash value, profit trends, sessions, and leaderboard performance with screenshot OCR.",
    keywords: [
      "delta force stash tracker",
      "delta force profit tracker",
      "free delta force stats",
      "hawk ops profit tracking",
      "open source stash tracker",
    ],
    includeInSitemap: true,
  },
  {
    path: "/sign-up",
    title: "Sign Up - Delta Force Profit Tracker",
    description:
      "Create your free account to track stash value, OCR uploads, and Delta Force profit sessions.",
    keywords: ["delta force tracker sign up", "profit tracker registration"],
    includeInSitemap: true,
  },
  {
    path: "/features/stash-tracker",
    title: "Delta Force Stash Tracker - OCR Snapshot Tracking",
    description:
      "Upload stash screenshots, parse totals with OCR, and monitor value history over time.",
    keywords: [
      "delta force stash tracker",
      "stash screenshot tracker",
      "ocr stash value tracker",
      "free stash tracker delta force",
    ],
    includeInSitemap: true,
  },
  {
    path: "/features/profit-calculator",
    title: "Delta Force Profit Calculator - Session Trends",
    description:
      "Measure session profit, duration, and progress with clear summaries and leaderboard context.",
    keywords: ["delta force profit calculator", "raid profit tracking", "session profit tracker"],
    includeInSitemap: true,
  },
  {
    path: "/features/ocr-stash-value",
    title: "OCR Stash Value Tracker - Delta Force",
    description:
      "Turn stash screenshots into clean values, confidence warnings, and upload history in seconds.",
    keywords: ["ocr stash tracker", "stash value OCR", "delta force ocr tool"],
    includeInSitemap: true,
  },
  {
    path: "/self-hosted-game-profit-tracker",
    title: "Self-Hosted Game Profit Tracker - Delta Force",
    description:
      "Deploy the open source stack with Docker and run stash/profit analytics on your own infrastructure.",
    keywords: ["self hosted game tracker", "self hosted profit tracker", "delta force docker tracker"],
    includeInSitemap: true,
  },
  {
    path: "/open-source-stash-analytics",
    title: "Open Source Stash Analytics for Delta Force",
    description:
      "Explore the repository, contribute features, and use community-driven stash analytics workflows.",
    keywords: ["open source stash analytics", "delta force open source tracker", "github stash tracker"],
    includeInSitemap: true,
  },
  {
    path: "/seo-scorecard",
    title: "SEO Growth Scorecard - Delta Force Profit Tracker",
    description: "Internal scorecard for SEO growth milestones and reporting cadence.",
    robots: "noindex, nofollow",
    includeInSitemap: false,
  },
  {
    path: "/not-found",
    title: "Page Not Found - Delta Force Profit Tracker",
    description: "The page you requested does not exist.",
    robots: "noindex, nofollow",
    includeInSitemap: false,
  },
]

const ROUTE_SEO_MAP = new Map(PUBLIC_ROUTE_SEO.map((route) => [route.path, route]))

export function getRouteSeo(pathname: string): RouteSeoConfig | null {
  return ROUTE_SEO_MAP.get(pathname) ?? null
}
