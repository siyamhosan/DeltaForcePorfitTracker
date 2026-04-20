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
      "free delta force stats",
      "hawk ops profit tracking",
      "open source stash tracker",
    ],
    robots: "index, follow",
    includeInSitemap: true,
    body: `
<main style="font-family:Inter,system-ui,Arial,sans-serif;max-width:920px;margin:0 auto;padding:64px 24px;color:#18181b;">
  <h1 style="font-size:42px;line-height:1.1;margin:0 0 16px;">Delta Force stash and profit tracking for screenshot workflows</h1>
  <p style="font-size:20px;line-height:1.5;color:#3f3f46;margin:0 0 20px;">
    Free, open-source stash and profit analytics for Delta Force: Hawk Ops—no memory reading, no ban risk.
    Upload stash screenshots, parse totals with OCR, and monitor trendlines on web or Windows desktop.
  </p>
  <p style="font-size:16px;line-height:1.65;margin:0 0 16px;">
    Your data stays with your account; authentication is handled securely. Self-host the full stack with Docker if you want everything on your own infrastructure.
  </p>
  <p style="font-size:16px;line-height:1.65;margin:0 0 24px;">
    <a href="/sign-up" style="font-weight:600;">Create a free account</a> to upload your first screenshot, or explore
    <a href="/features/stash-tracker">stash tracker</a>, <a href="/features/profit-calculator">profit calculator</a>,
    <a href="/features/ocr-stash-value">OCR stash value</a>, and <a href="/self-hosted-game-profit-tracker">self-hosted setup</a>.
  </p>
  <h2 style="font-size:22px;margin:32px 0 12px;">How players use it</h2>
  <ul style="font-size:16px;line-height:1.65;margin:0;padding-left:1.25rem;color:#3f3f46;">
    <li>Log total assets after each run and watch profit trends over time.</li>
    <li>Use the optional desktop app for hotkey capture without long alt-tabs.</li>
    <li>Compare progress on leaderboards and refine farming routes with real numbers.</li>
  </ul>
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
    body: `<main style="font-family:Inter,system-ui,Arial,sans-serif;max-width:860px;margin:0 auto;padding:48px 24px;color:#18181b;">
<h1 style="font-size:36px;line-height:1.15;margin:0 0 12px;">Delta Force stash tracker with OCR snapshots</h1>
<p style="font-size:18px;color:#3f3f46;margin:0 0 16px;">Track stash value over time using uploads or the Windows desktop companion—no spreadsheets required.</p>
<p style="font-size:16px;line-height:1.65;margin:0 0 12px;">OCR reads your total assets from screenshots; confidence checks and warnings help keep bad reads out of your charts.</p>
<p style="font-size:16px;line-height:1.65;margin:0;"><a href="/sign-up">Sign up free</a> · <a href="/features/profit-calculator">Session profit trends</a> · <a href="/features/ocr-stash-value">OCR details</a></p>
</main>`,
  },
  {
    path: "/features/profit-calculator",
    title: "Delta Force Profit Calculator - Session Trends",
    description: "Measure session profit, duration, and progress with clear summaries and leaderboard context.",
    keywords: ["delta force profit calculator", "raid profit tracking", "session profit tracker"],
    robots: "index, follow",
    includeInSitemap: true,
    body: `<main style="font-family:Inter,system-ui,Arial,sans-serif;max-width:860px;margin:0 auto;padding:48px 24px;color:#18181b;">
<h1 style="font-size:36px;line-height:1.15;margin:0 0 12px;">Delta Force profit calculator with session context</h1>
<p style="font-size:18px;color:#3f3f46;margin:0 0 16px;">Measure profit per session, duration, and long-term trajectory from stash deltas—free and open source.</p>
<p style="font-size:16px;line-height:1.65;margin:0 0 12px;">Pair uploads with session views to see when your economy accelerates and how you rank versus the community leaderboard.</p>
<p style="font-size:16px;line-height:1.65;margin:0;"><a href="/sign-up">Create account</a> · <a href="/features/stash-tracker">Stash tracking</a> · <a href="/open-source-stash-analytics">Contribute on GitHub</a></p>
</main>`,
  },
  {
    path: "/features/ocr-stash-value",
    title: "OCR Stash Value Tracker - Delta Force",
    description: "Turn stash screenshots into clean values, confidence warnings, and upload history in seconds.",
    keywords: ["ocr stash tracker", "stash value OCR", "delta force ocr tool"],
    robots: "index, follow",
    includeInSitemap: true,
    body: `<main style="font-family:Inter,system-ui,Arial,sans-serif;max-width:860px;margin:0 auto;padding:48px 24px;color:#18181b;">
<h1 style="font-size:36px;line-height:1.15;margin:0 0 12px;">OCR stash value tracker for Delta Force</h1>
<p style="font-size:18px;color:#3f3f46;margin:0 0 16px;">Turn profile screenshots into structured stash history with DocTR-powered OCR and fast review when confidence is low.</p>
<p style="font-size:16px;line-height:1.65;margin:0 0 12px;">Use the web uploader or the desktop app hotkey flow to minimize time outside the game.</p>
<p style="font-size:16px;line-height:1.65;margin:0;"><a href="/sign-up">Start free</a> · <a href="/features/stash-tracker">Stash timeline</a> · <a href="/self-hosted-game-profit-tracker">Self-host OCR stack</a></p>
</main>`,
  },
  {
    path: "/self-hosted-game-profit-tracker",
    title: "Self-Hosted Game Profit Tracker - Delta Force",
    description: "Deploy the open source stack with Docker and run stash/profit analytics on your own infrastructure.",
    keywords: ["self hosted game tracker", "self hosted profit tracker", "delta force docker tracker"],
    robots: "index, follow",
    includeInSitemap: true,
    body: `<main style="font-family:Inter,system-ui,Arial,sans-serif;max-width:860px;margin:0 auto;padding:48px 24px;color:#18181b;">
<h1 style="font-size:36px;line-height:1.15;margin:0 0 12px;">Self-hosted game profit tracker</h1>
<p style="font-size:18px;color:#3f3f46;margin:0 0 16px;">Deploy the web app, API, Postgres, and OCR services with Docker so your squad or organization keeps data on infrastructure you control.</p>
<p style="font-size:16px;line-height:1.65;margin:0 0 12px;">Fork the repository, configure environment variables, and extend analytics or OCR pipelines for custom workflows.</p>
<p style="font-size:16px;line-height:1.65;margin:0;"><a href="/sign-up">Try hosted first</a> · <a href="/open-source-stash-analytics">Open source overview</a> · <a href="/features/ocr-stash-value">OCR behavior</a></p>
</main>`,
  },
  {
    path: "/open-source-stash-analytics",
    title: "Open Source Stash Analytics for Delta Force",
    description: "Explore the repository, contribute features, and use community-driven stash analytics workflows.",
    keywords: ["open source stash analytics", "delta force open source tracker", "github stash tracker"],
    robots: "index, follow",
    includeInSitemap: true,
    body: `<main style="font-family:Inter,system-ui,Arial,sans-serif;max-width:860px;margin:0 auto;padding:48px 24px;color:#18181b;">
<h1 style="font-size:36px;line-height:1.15;margin:0 0 12px;">Open source stash analytics</h1>
<p style="font-size:18px;color:#3f3f46;margin:0 0 16px;">Transparent roadmap, public issues, and community pull requests—built with React, Tauri, Elysia/Bun, Postgres, and FastAPI OCR.</p>
<p style="font-size:16px;line-height:1.65;margin:0 0 12px;">Ideal for players and developers who want a free Delta Force stats alternative with extensibility instead of a closed SaaS wall.</p>
<p style="font-size:16px;line-height:1.65;margin:0;"><a href="/sign-up">Use the hosted app</a> · <a href="/features/profit-calculator">Profit analytics</a> · <a href="/self-hosted-game-profit-tracker">Self-hosting guide</a></p>
</main>`,
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
