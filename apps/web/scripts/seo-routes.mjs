const siteUrl = (process.env.VITE_SITE_URL ?? "https://dfstash.bzr.lt").replace(/\/$/, "")

export const seoRoutes = [
  {
    path: "/",
    title: "Delta Force Profit Tracker - Open Source Stash Tracking",
    description:
      "Track Delta Force stash value, profit trends, sessions, and leaderboard performance with screenshot OCR.",
    keywords: [
      "delta force stash tracker",
      "delta force profit tracker",
      "hawk ops profit tracking",
      "open source stash tracker",
    ],
    robots: "index, follow",
    includeInSitemap: true,
    body: `
<main style="font-family:Inter,system-ui,Arial,sans-serif;max-width:920px;margin:0 auto;padding:64px 24px;color:#18181b;">
  <h1 style="font-size:42px;line-height:1.1;margin:0 0 16px;">Delta Force stash and profit tracking for screenshot workflows</h1>
  <p style="font-size:20px;line-height:1.5;color:#3f3f46;margin:0 0 20px;">
    Upload stash screenshots, parse totals with OCR, and monitor trendlines with an open source stack.
  </p>
  <p style="font-size:16px;line-height:1.6;">
    Explore <a href="/features/stash-tracker">stash tracker</a>, <a href="/features/profit-calculator">profit calculator</a>,
    <a href="/features/ocr-stash-value">OCR stash value</a>, and <a href="/self-hosted-game-profit-tracker">self-hosted setup</a>.
  </p>
</main>`,
  },
  {
    path: "/sign-up",
    title: "Sign Up - Delta Force Profit Tracker",
    description:
      "Create your free account to track stash value, OCR uploads, and Delta Force profit sessions.",
    keywords: ["delta force tracker sign up", "profit tracker registration"],
    robots: "index, follow",
    includeInSitemap: true,
    body: `
<main style="font-family:Inter,system-ui,Arial,sans-serif;max-width:860px;margin:0 auto;padding:64px 24px;color:#18181b;">
  <h1 style="font-size:40px;line-height:1.1;margin:0 0 16px;">Create your Delta Force Profit Tracker account</h1>
  <p style="font-size:20px;color:#3f3f46;">
    Free sign-up with OCR stash tracking, sessions, and leaderboard analytics.
  </p>
</main>`,
  },
  {
    path: "/features/stash-tracker",
    title: "Delta Force Stash Tracker - OCR Snapshot Tracking",
    description: "Upload stash screenshots, parse totals with OCR, and monitor value history over time.",
    keywords: ["delta force stash tracker", "stash screenshot tracker", "ocr stash value tracker"],
    robots: "index, follow",
    includeInSitemap: true,
    body: "<main><h1>Delta Force stash tracker with OCR snapshots</h1><p>Track stash value changes with screenshot-driven updates.</p></main>",
  },
  {
    path: "/features/profit-calculator",
    title: "Delta Force Profit Calculator - Session Trends",
    description: "Measure session profit, duration, and progress with clear summaries and leaderboard context.",
    keywords: ["delta force profit calculator", "raid profit tracking", "session profit tracker"],
    robots: "index, follow",
    includeInSitemap: true,
    body: "<main><h1>Delta Force profit calculator with session context</h1><p>Analyze raid outcomes and long-term profit trends.</p></main>",
  },
  {
    path: "/features/ocr-stash-value",
    title: "OCR Stash Value Tracker - Delta Force",
    description: "Turn stash screenshots into clean values, confidence warnings, and upload history in seconds.",
    keywords: ["ocr stash tracker", "stash value OCR", "delta force ocr tool"],
    robots: "index, follow",
    includeInSitemap: true,
    body: "<main><h1>OCR stash value tracker</h1><p>Capture stash totals from screenshots with confidence checks.</p></main>",
  },
  {
    path: "/self-hosted-game-profit-tracker",
    title: "Self-Hosted Game Profit Tracker - Delta Force",
    description: "Deploy the open source stack with Docker and run stash/profit analytics on your own infrastructure.",
    keywords: ["self hosted game tracker", "self hosted profit tracker", "delta force docker tracker"],
    robots: "index, follow",
    includeInSitemap: true,
    body: "<main><h1>Self-hosted game profit tracker</h1><p>Own your data by running the open source stack with Docker.</p></main>",
  },
  {
    path: "/open-source-stash-analytics",
    title: "Open Source Stash Analytics for Delta Force",
    description: "Explore the repository, contribute features, and use community-driven stash analytics workflows.",
    keywords: ["open source stash analytics", "delta force open source tracker", "github stash tracker"],
    robots: "index, follow",
    includeInSitemap: true,
    body: "<main><h1>Open source stash analytics</h1><p>Contribute to transparent roadmap and release-driven progress.</p></main>",
  },
  {
    path: "/seo-scorecard",
    title: "SEO Growth Scorecard - Delta Force Profit Tracker",
    description: "Internal scorecard for SEO growth milestones and reporting cadence.",
    keywords: [],
    robots: "noindex, nofollow",
    includeInSitemap: false,
    body: "<main><h1>SEO growth scorecard</h1><p>Internal milestones, KPIs, and weekly review cadence.</p></main>",
  },
  {
    path: "/not-found",
    title: "Page Not Found - Delta Force Profit Tracker",
    description: "The page you requested does not exist.",
    keywords: [],
    robots: "noindex, nofollow",
    includeInSitemap: false,
    body: "<main><h1>Page not found</h1><p>The page you requested was not found.</p></main>",
  },
]

export const canonicalUrl = (path) => `${siteUrl}${path}`
export const sitemapRoutes = seoRoutes.filter((route) => route.includeInSitemap)
export const resolvedSiteUrl = siteUrl
