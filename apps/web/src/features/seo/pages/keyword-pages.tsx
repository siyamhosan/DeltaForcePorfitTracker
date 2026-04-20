import { Link } from "react-router-dom"

import { Button } from "@workspace/ui/components/button"

import { PUBLIC_ROUTE_SEO } from "@/seo/route-seo"
import {
  DESKTOP_APP_EXE_URL,
  GITHUB_REPO_URL,
  PREVIEW_IMG_DESKTOP,
  PREVIEW_IMG_WEB,
} from "@/seo/site-config"
import { SeoHead, buildPublicSchemas } from "@/seo/seo-head"

type KeywordPageProps = {
  pathname: string
  heading: string
  intro: string
  bullets: string[]
  /** Optional hero image for this page (defaults to web dashboard). */
  previewImage?: { src: string; alt: string }
  /** Short “how it works” steps tailored to the page topic. */
  steps: string[]
}

function KeywordPage({
  pathname,
  heading,
  intro,
  bullets,
  previewImage,
  steps,
}: KeywordPageProps) {
  const seo = PUBLIC_ROUTE_SEO.find((route) => route.path === pathname)
  if (!seo) {
    return null
  }

  const hero = previewImage ?? {
    src: PREVIEW_IMG_WEB,
    alt: "Delta Force Profit Tracker web dashboard with stash and profit charts",
  }

  return (
    <>
      <SeoHead
        title={seo.title}
        description={seo.description}
        pathname={pathname}
        keywords={seo.keywords}
        robots={seo.robots}
        jsonLd={buildPublicSchemas(pathname)}
      />
      <main className="max-w-5xl gap-10 px-6 py-14 mx-auto flex min-h-screen w-full flex-col">
        <header className="space-y-4">
          <p className="text-xs font-semibold text-zinc-500 tracking-[0.2em] uppercase">
            Delta Force Profit Tracker
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {heading}
          </h1>
          <p className="max-w-3xl text-base text-zinc-600 dark:text-zinc-300">
            {intro}
          </p>
        </header>

        <section className="border-zinc-200/70 bg-zinc-50 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50 overflow-hidden rounded-2xl border">
          <div className="gap-0 md:grid-cols-2 grid">
            <div className="p-6 md:p-8 flex flex-col justify-center">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                See the dashboard in action
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Real UI from the open-source project—upload a stash screenshot
                and your trendline updates automatically.
              </p>
              <div className="mt-5 gap-3 flex flex-wrap">
                <Link to="/sign-up">
                  <Button>Create free account</Button>
                </Link>
                <a
                  href={DESKTOP_APP_EXE_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Button variant="outline">
                    Download desktop app (Windows)
                  </Button>
                </a>
              </div>
            </div>
            <div className="border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 md:border-l md:border-t-0 border-t">
              <img
                src={hero.src}
                alt={hero.alt}
                className="border-zinc-200 shadow-sm dark:border-zinc-800 h-auto w-full rounded-lg border"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </section>

        <section className="border-zinc-200/70 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 rounded-2xl border">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Why players use this workflow
          </h2>
          <ul className="mt-4 space-y-2 pl-5 text-zinc-700 dark:text-zinc-300 list-disc">
            {bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </section>

        <section className="border-zinc-200/70 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 rounded-2xl border">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            How it works
          </h2>
          <ol className="mt-4 space-y-3 pl-5 text-zinc-700 dark:text-zinc-300 list-decimal">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="border-emerald-900/20 bg-emerald-950/40 p-6 dark:bg-emerald-950/25 rounded-2xl border">
          <h2 className="text-xl font-semibold text-emerald-950 dark:text-emerald-100">
            Privacy and fair play
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-emerald-950/90 dark:text-emerald-100/90">
            Your stash data stays tied to your account; we do not read game
            memory. Tracking is built on screenshots and OCR so you avoid ban
            risk from invasive tools. Sign-in uses Clerk—you can use Google or
            Twitch. Prefer full control? Self-host the stack with Docker from
            the repository.
          </p>
        </section>

        <section className="border-zinc-200/70 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-950 rounded-2xl border">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Try it now
          </h2>
          <p className="mt-2 text-zinc-700 dark:text-zinc-300">
            Start with a free account, upload a stash screenshot, and see your
            trendline immediately. The Windows desktop app adds hotkey capture
            so you can log runs without leaving the game for long.
          </p>
          <div className="mt-5 gap-3 flex flex-wrap">
            <Link to="/sign-up">
              <Button>Start free</Button>
            </Link>
            <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer noopener">
              <Button variant="outline">View source code</Button>
            </a>
          </div>
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Related: <Link to="/features/stash-tracker">stash tracker</Link>,{" "}
            <Link to="/features/profit-calculator">profit calculator</Link>,{" "}
            <Link to="/features/ocr-stash-value">OCR stash value</Link>,{" "}
            <Link to="/self-hosted-game-profit-tracker">self-hosted setup</Link>
            ,{" "}
            <Link to="/open-source-stash-analytics">open source analytics</Link>
            .
          </p>
        </section>
      </main>
    </>
  )
}

export function StashTrackerFeaturePage() {
  return (
    <KeywordPage
      pathname="/features/stash-tracker"
      heading="Delta Force stash tracker built for screenshot workflows"
      intro="Track stash value changes across uploads and sessions without manual spreadsheets. Built for Delta Force: Hawk Ops players who want long-term visibility into total assets and profit—free and open source."
      bullets={[
        "OCR parsing captures stash totals from screenshots in seconds.",
        "Warnings highlight large jumps so bad reads do not pollute your trend.",
        "Historical snapshots reveal long-term stash growth and volatility.",
        "Compare your trajectory with leaderboard context to see how you stack up.",
      ]}
      steps={[
        "Sign up with Google or Twitch and open the dashboard.",
        "Upload a stash screen from your profile or use the desktop app hotkey.",
        "Confirm the OCR read when prompted, then watch your stash timeline update.",
        "Review sessions and profit when you group raids for deeper analytics.",
      ]}
    />
  )
}

export function ProfitCalculatorFeaturePage() {
  return (
    <KeywordPage
      pathname="/features/profit-calculator"
      heading="Profit calculator for Delta Force sessions and trends"
      intro="Measure performance over time using stash deltas, session summaries, and leaderboard context. Ideal if you are optimizing runs and want a free alternative to paid stat services—your data stays under your account."
      bullets={[
        "Track session-level wins, losses, and average profit per run.",
        "Use timeline data to find when gains accelerate or stagnate.",
        "Compare performance against leaderboard metrics to benchmark progress.",
        "Export-friendly workflows: open source stack if you need CSV or custom analytics later.",
      ]}
      steps={[
        "Create snapshots after each raid or session using uploads or hotkey capture.",
        "Let the app compute deltas between stash readings for profit per session.",
        "Open overview and session views to see profit per hour and trends.",
        "Iterate on play style using what the charts show—not guesswork.",
      ]}
    />
  )
}

export function DeltaForceStatsPage() {
  return (
    <KeywordPage
      pathname="/features/delta-force-stats"
      heading="Delta Force Stats Tracker built for screenshot workflows"
      intro="Track your Delta Force stats across uploads and sessions without manual spreadsheets. Built for Delta Force: Hawk Ops players who want long-term visibility into total assets and profit—free and open source."
      bullets={[
        "OCR parsing captures stats totals from screenshots in seconds.",
        "Warnings highlight large jumps so bad reads do not pollute your trend.",
        "Historical snapshots reveal long-term stat growth and volatility.",
        "Compare your trajectory with leaderboard context to see how you stack up against other players.",
      ]}
      steps={[
        "Sign up with Google or Twitch and open the dashboard.",
        "Upload a stash screen from your profile or use the desktop app hotkey.",
        "Confirm the OCR read when prompted, then watch your stat timeline update.",
        "Review sessions and profit when you group raids for deeper analytics.",
      ]}
    />
  )
}

export function DeltaForceProfitTrackerPage() {
  return (
    <KeywordPage
      pathname="/features/delta-force-profit-tracker"
      heading="Profit calculator for Delta Force sessions and trends"
      intro="Measure performance over time using stash deltas, session summaries, and leaderboard context. Ideal if you are optimizing runs and want a free alternative to paid stat services—your data stays under your account."
      bullets={[
        "Track session-level wins, losses, and average profit per run.",
        "Use timeline data to find when gains accelerate or stagnate.",
        "Compare performance against leaderboard metrics to benchmark progress.",
        "Export-friendly workflows: open source stack if you need CSV or custom analytics later.",
      ]}
      steps={[
        "Create snapshots after each raid or session using uploads or hotkey capture.",
        "Let the app compute deltas between stash readings for profit per session.",
        "Open overview and session views to see profit per hour and trends.",
        "Iterate on play style using what the charts show—not guesswork.",
      ]}
    />
  )
}

export function OcrFeaturePage() {
  return (
    <KeywordPage
      pathname="/features/ocr-stash-value"
      heading="OCR stash value tracking without manual number entry"
      intro="Upload screenshots, review confidence, and keep a clean stash history with transparent corrections. DocTR-powered parsing keeps the loop fast for daily play."
      previewImage={{
        src: PREVIEW_IMG_DESKTOP,
        alt: "Delta Force desktop tracker with hotkey capture and profit summary",
      }}
      bullets={[
        "Confidence checks reduce bad reads before they impact analytics.",
        "Upload history keeps every parsed snapshot auditable.",
        "Fast review loops make OCR usable for daily runs.",
        "Desktop hotkey flow minimizes time out of game when logging stash.",
      ]}
      steps={[
        "Install the optional Windows desktop app or use the web uploader.",
        "Capture or upload a clear stash screen showing total assets.",
        "If confidence is high, values apply automatically; otherwise confirm once.",
        "Bad captures can be corrected before they affect your profit charts.",
      ]}
    />
  )
}

export function SelfHostedPage() {
  return (
    <KeywordPage
      pathname="/self-hosted-game-profit-tracker"
      heading="Self-hosted game profit tracker stack"
      intro="Run the web app, API, and OCR services on your own infrastructure with Docker. Best for clans, creators, or anyone who wants maximum transparency: fork the repo, deploy, and own the full pipeline."
      bullets={[
        "Own your data by deploying the open-source stack privately.",
        "Use Docker-based workflows for repeatable setup and upgrades.",
        "Extend the platform with custom OCR or analytics components.",
        "No subscription: align hosting cost with your community size.",
      ]}
      steps={[
        "Clone the GitHub repository and follow the developer quick start.",
        "Bring up API, Postgres, and OCR services with Docker Compose.",
        "Point the web app at your API and configure auth (Clerk) for your deployment.",
        "Iterate privately or share your fork with your squad.",
      ]}
    />
  )
}

export function OpenSourceAnalyticsPage() {
  return (
    <KeywordPage
      pathname="/open-source-stash-analytics"
      heading="Open source stash analytics with community-driven improvements"
      intro="Contribute to a transparent roadmap focused on player-first tracking and measurable performance. Stars, issues, and pull requests help the project show up for players searching for a free Delta Force stats tool."
      bullets={[
        "Public issue tracker and PR workflow make feature progress visible.",
        "Release notes document every ranking, OCR, and analytics improvement.",
        "Community contributions improve both product quality and search authority.",
        "Stack you can trust: React, Tauri, Elysia/Bun, Postgres, FastAPI OCR.",
      ]}
      steps={[
        "Read the README for architecture and local dev commands.",
        "Pick a good-first-issue or file a bug with screenshots.",
        "Submit PRs for UI, OCR tuning, or docs—CI and reviews keep quality high.",
        "Share the repo where Delta Force players look for tools and tips.",
      ]}
    />
  )
}
