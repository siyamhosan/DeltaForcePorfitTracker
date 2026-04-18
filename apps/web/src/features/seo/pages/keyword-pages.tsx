import { Link } from "react-router-dom"

import { Button } from "@workspace/ui/components/button"

import { PUBLIC_ROUTE_SEO } from "@/seo/route-seo"
import { GITHUB_REPO_URL } from "@/seo/site-config"
import { SeoHead, buildPublicSchemas } from "@/seo/seo-head"

type KeywordPageProps = {
  pathname: string
  heading: string
  intro: string
  bullets: string[]
}

function KeywordPage({ pathname, heading, intro, bullets }: KeywordPageProps) {
  const seo = PUBLIC_ROUTE_SEO.find((route) => route.path === pathname)
  if (!seo) {
    return null
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
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-14">
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Delta Force Profit Tracker
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {heading}
          </h1>
          <p className="max-w-3xl text-base text-zinc-600 dark:text-zinc-300">{intro}</p>
        </header>

        <section className="rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Why players use this workflow
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-zinc-700 dark:text-zinc-300">
            {bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-zinc-200/70 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Try it now</h2>
          <p className="mt-2 text-zinc-700 dark:text-zinc-300">
            Start with a free account, upload a stash screenshot, and see your trendline immediately.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
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
            <Link to="/self-hosted-game-profit-tracker">self-hosted setup</Link>,{" "}
            <Link to="/open-source-stash-analytics">open source analytics</Link>.
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
      intro="Track stash value changes across uploads and sessions without manual spreadsheets."
      bullets={[
        "OCR parsing captures stash totals from screenshots in seconds.",
        "Warnings highlight large jumps so bad reads do not pollute your trend.",
        "Historical snapshots reveal long-term stash growth and volatility.",
      ]}
    />
  )
}

export function ProfitCalculatorFeaturePage() {
  return (
    <KeywordPage
      pathname="/features/profit-calculator"
      heading="Profit calculator for Delta Force sessions and trends"
      intro="Measure performance over time using stash deltas, session summaries, and leaderboard context."
      bullets={[
        "Track session-level wins, losses, and average profit per run.",
        "Use timeline data to find when gains accelerate or stagnate.",
        "Compare performance against leaderboard metrics to benchmark progress.",
      ]}
    />
  )
}

export function OcrFeaturePage() {
  return (
    <KeywordPage
      pathname="/features/ocr-stash-value"
      heading="OCR stash value tracking without manual number entry"
      intro="Upload screenshots, review confidence, and keep a clean stash history with transparent corrections."
      bullets={[
        "Confidence checks reduce bad reads before they impact analytics.",
        "Upload history keeps every parsed snapshot auditable.",
        "Fast review loops make OCR usable for daily runs.",
      ]}
    />
  )
}

export function SelfHostedPage() {
  return (
    <KeywordPage
      pathname="/self-hosted-game-profit-tracker"
      heading="Self-hosted game profit tracker stack"
      intro="Run the web app, API, and OCR services on your own infrastructure with Docker."
      bullets={[
        "Own your data by deploying the open-source stack privately.",
        "Use Docker-based workflows for repeatable setup and upgrades.",
        "Extend the platform with custom OCR or analytics components.",
      ]}
    />
  )
}

export function OpenSourceAnalyticsPage() {
  return (
    <KeywordPage
      pathname="/open-source-stash-analytics"
      heading="Open source stash analytics with community-driven improvements"
      intro="Contribute to a transparent roadmap focused on player-first tracking and measurable performance."
      bullets={[
        "Public issue tracker and PR workflow make feature progress visible.",
        "Release notes document every ranking, OCR, and analytics improvement.",
        "Community contributions improve both product quality and search authority.",
      ]}
    />
  )
}
