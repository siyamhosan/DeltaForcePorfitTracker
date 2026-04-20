import { SignIn, SignUp, useAuth } from "@clerk/clerk-react"
import {
  RiBarChartBoxLine,
  RiCheckDoubleLine,
  RiGithubFill,
  RiHistoryLine,
  RiImageLine,
  RiMedal2Line,
  RiOpenSourceLine,
  RiUploadCloud2Line,
} from "@remixicon/react"
import { AuthShell } from "@workspace/ui/components/auth-shell"
import { MarketingPanel } from "@workspace/ui/components/marketing-panel"
import type { ReactNode } from "react"
import { Link, Navigate } from "react-router-dom"

import { getRouteSeo } from "@/seo/route-seo"
import { PREVIEW_IMG_DESKTOP, PREVIEW_IMG_WEB } from "@/seo/site-config"
import { SeoHead, buildPublicSchemas } from "@/seo/seo-head"

export function LandingPage({
  mode = "sign-in",
}: {
  mode?: "sign-in" | "sign-up"
}) {
  const { isLoaded, isSignedIn } = useAuth()
  const pathname = mode === "sign-up" ? "/sign-up" : "/"
  const seo = getRouteSeo(pathname)

  if (!isLoaded) {
    return (
      <>
        {seo ? (
          <SeoHead
            title={seo.title}
            description={seo.description}
            pathname={pathname}
            keywords={seo.keywords}
            robots={seo.robots}
            jsonLd={buildPublicSchemas(pathname)}
          />
        ) : null}
        <div className="flex min-h-screen w-full items-center justify-center bg-background"></div>
      </>
    )
  }

  if (isSignedIn) {
    return <Navigate to="/app" replace />
  }

  const marketingFeatures: Array<{
    title: string
    description: string
    icon: ReactNode
    wide?: boolean
  }> = [
    {
      title: "Stash from screenshots",
      description:
        "OCR reads total assets; values shown as millions (e.g. 36.4M).",
      icon: <RiImageLine className="h-5 w-5" />,
    },
    {
      title: "Confirm & warnings",
      description:
        "High confidence skips friction; else you confirm. Big jumps vs last stash warn you.",
      icon: <RiCheckDoubleLine className="h-5 w-5" />,
    },
    {
      title: "Dashboard",
      description:
        "Charts and summaries for how stash and profit move over time.",
      icon: <RiBarChartBoxLine className="h-5 w-5" />,
    },
    {
      title: "Uploads",
      description: "Previews, parsed amounts, and job status in one place.",
      icon: <RiUploadCloud2Line className="h-5 w-5" />,
    },
    {
      title: "Leaderboards",
      description: "See where you stand vs other players on tracked stats.",
      icon: <RiMedal2Line className="h-5 w-5" />,
    },
    {
      title: "Sessions",
      description:
        "Tie raids into runs with profit, duration, and clean closes—shipping soon.",
      icon: <RiHistoryLine className="h-5 w-5" />,
    },
    {
      title: "Free & open source",
      description:
        "Clerk sign-in; self-host the web, API, and OCR with Docker if you want.",
      icon: <RiOpenSourceLine className="h-5 w-5" />,
      wide: true,
    },
  ]

  return (
    <>
      {seo ? (
        <SeoHead
          title={seo.title}
          description={seo.description}
          pathname={pathname}
          keywords={seo.keywords}
          robots={seo.robots}
          jsonLd={buildPublicSchemas(pathname)}
        />
      ) : null}
      <AuthShell
        productName="Delta Force Profit Tracker"
        subtitle="Stash, profit, leaderboards - Delta Force: Hawk Ops"
        hint={
          <span>
            (Press{" "}
            <kbd className="rounded-md border bg-muted px-1.5 py-0.5 font-sans">
              d
            </kbd>{" "}
            for dark mode)
          </span>
        }
        leftPanel={
          <MarketingPanel
            productName="Delta Force Profit Tracker"
            headline="Profit tracking that fits your runs."
            description="Screenshot your stash, review the numbers, watch trends, and climb the boards."
            features={marketingFeatures}
            preview={
              <div className="grid gap-3 sm:grid-cols-2">
                <figure className="space-y-2">
                  <img
                    src={PREVIEW_IMG_WEB}
                    alt="Web dashboard with stash value charts and summaries"
                    className="w-full rounded-lg border border-zinc-800/80 shadow-md"
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption className="text-xs text-zinc-500">Web dashboard</figcaption>
                </figure>
                <figure className="space-y-2">
                  <img
                    src={PREVIEW_IMG_DESKTOP}
                    alt="Desktop tracker with hotkey capture and profit summary"
                    className="w-full rounded-lg border border-zinc-800/80 shadow-md"
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption className="text-xs text-zinc-500">Desktop hotkey capture</figcaption>
                </figure>
              </div>
            }
            footer={
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p>© {new Date().getFullYear()} Delta Force Profit Tracker</p>
                <a
                  href="https://github.com/siyamhosan/DeltaForcePorfitTracker"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-zinc-500 hover:underline"
                >
                  <RiGithubFill className="h-5 w-5 shrink-0" aria-hidden />
                  <span>Open source</span>
                </a>
                <div className="w-full text-xs text-zinc-500 dark:text-zinc-400">
                  <Link to="/features/stash-tracker" className="hover:underline">
                    Stash tracker
                  </Link>{" "}
                  ·{" "}
                  <Link to="/features/profit-calculator" className="hover:underline">
                    Profit calculator
                  </Link>{" "}
                  ·{" "}
                  <Link to="/features/ocr-stash-value" className="hover:underline">
                    OCR stash value
                  </Link>{" "}
                  ·{" "}
                  <Link to="/self-hosted-game-profit-tracker" className="hover:underline">
                    Self-hosted
                  </Link>{" "}
                  ·{" "}
                  <Link to="/open-source-stash-analytics" className="hover:underline">
                    Open source analytics
                  </Link>
                </div>
              </div>
            }
          />
        }
        authContent={
          mode === "sign-up" ? (
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/"
              forceRedirectUrl="/app"
            />
          ) : (
            <SignIn
              routing="path"
              path="/"
              signUpUrl="/sign-up"
              forceRedirectUrl="/app"
              withSignUp
            />
          )
        }
      />
    </>
  )
}
