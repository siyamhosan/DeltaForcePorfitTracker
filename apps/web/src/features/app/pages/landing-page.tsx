import { SignIn, SignUp, useAuth } from "@clerk/clerk-react"
import { RiBarChartBoxLine, RiGithubFill, RiOpenSourceLine, RiShieldKeyholeLine } from "@remixicon/react"
import { AuthShell } from "@workspace/ui/components/auth-shell"
import { MarketingPanel } from "@workspace/ui/components/marketing-panel"
import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"

export function LandingPage({ mode = "sign-in" }: { mode?: "sign-in" | "sign-up" }) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return <div className="flex min-h-screen bg-background w-full items-center justify-center"></div>
  }

  if (isSignedIn) {
    return <Navigate to="/app" replace />
  }

  const marketingFeatures: Array<{ title: string; description: string; icon: ReactNode }> = [
    {
      title: "Free & Open Source",
      description: "100% free forever. Built transparently by the community, for the community.",
      icon: <RiOpenSourceLine className="w-6 h-6" />,
    },
    {
      title: "Advanced Analytics",
      description: "Deep insights into your trades with beautiful charts and performance metrics.",
      icon: <RiBarChartBoxLine className="w-6 h-6" />,
    },
    {
      title: "Secure by Design",
      description: "Your data is your own. Industry-leading security with Clerk authentication.",
      icon: <RiShieldKeyholeLine className="w-6 h-6" />,
    },
  ]

  return (
    <AuthShell
      productName="Delta Force Profit Tracker"
      subtitle="Free and open source profit tracking"
      hint={
        <span>
          (Press <kbd className="font-sans px-1.5 py-0.5 rounded-md border bg-muted">d</kbd> for dark mode)
        </span>
      }
      leftPanel={
        <MarketingPanel
          productName="Delta Force Profit Tracker"
          headline="Track your profits like a pro."
          description="The ultimate companion for traders and investors to monitor portfolios, analyze performance, and make data-driven decisions."
          features={marketingFeatures}
          footer={
            <div className="flex items-center justify-between">
              <p>© 2026 Delta Force Team</p>
              <a
                href="https://github.com/delta-force"
                target="_blank"
                rel="noreferrer"
                className="hover:text-zinc-300 transition-colors flex items-center gap-2"
              >
                <RiGithubFill className="w-5 h-5" />
                <span>View on GitHub</span>
              </a>
            </div>
          }
        />
      }
      authContent={
        mode === "sign-up" ? (
          <SignUp routing="path" path="/sign-up" signInUrl="/" forceRedirectUrl="/app" />
        ) : (
          <SignIn routing="path" path="/" signUpUrl="/sign-up" forceRedirectUrl="/app" />
        )
      }
    />
  )
}
