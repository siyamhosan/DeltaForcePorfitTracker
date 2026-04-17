import { SignIn, SignUp, useAuth } from "@clerk/clerk-react"
import { Button } from "@workspace/ui/components/button"
import { AuthShell } from "@workspace/ui/components/auth-shell"
import { EmptyStateCard } from "@workspace/ui/components/empty-state-card"
import { MarketingPanel } from "@workspace/ui/components/marketing-panel"
import { StatCard } from "@workspace/ui/components/stat-card"
import {
  RiBarChartBoxLine,
  RiOpenSourceLine,
  RiShieldKeyholeLine,
  RiGithubFill,
  RiCheckDoubleLine,
  RiArrowRightLine,
  RiHistoryLine,
} from "@remixicon/react"
import { DashboardLayout } from "./components/dashboard-layout"
import { Routes, Route, Navigate } from "react-router-dom"

function DashboardPage() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return <div className="flex min-h-screen bg-background w-full items-center justify-center"></div>
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Overview</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Welcome to your Delta Force Profit Tracker dashboard.</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Total Profit"
            value="$0.00"
            icon={<RiBarChartBoxLine className="w-5 h-5" />}
          />
          <StatCard
            title="Total Trades"
            value="0"
            icon={<RiHistoryLine className="w-5 h-5" />}
          />
          <StatCard
            title="Win Rate"
            value="0%"
            className="sm:col-span-2 lg:col-span-1"
            icon={<RiCheckDoubleLine className="w-5 h-5" />}
          />
        </div>

        <EmptyStateCard
          title="No data yet"
          description="You haven't added any trades yet. Start tracking your profits to see your dashboard come alive."
          action={
            <Button className="gap-2">
              Add First Trade
              <RiArrowRightLine className="w-4 h-4" />
            </Button>
          }
        />
      </div>
    </DashboardLayout>
  )
}

function LandingPage({ mode = "sign-in" }: { mode?: "sign-in" | "sign-up" }) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return <div className="flex min-h-screen bg-background w-full items-center justify-center"></div>
  }

  if (isSignedIn) {
    return <Navigate to="/app" replace />
  }

  const marketingFeatures = [
    {
      title: "Free & Open Source",
      description:
        "100% free forever. Built transparently by the community, for the community.",
      icon: <RiOpenSourceLine className="w-6 h-6" />,
    },
    {
      title: "Advanced Analytics",
      description:
        "Deep insights into your trades with beautiful charts and performance metrics.",
      icon: <RiBarChartBoxLine className="w-6 h-6" />,
    },
    {
      title: "Secure by Design",
      description:
        "Your data is your own. Industry-leading security with Clerk authentication.",
      icon: <RiShieldKeyholeLine className="w-6 h-6" />,
    },
  ]

  return (
    <AuthShell
      productName="Delta Force Profit Tracker"
      subtitle="Free and open source profit tracking"
      hint={
        <span>
          (Press{" "}
          <kbd className="font-sans px-1.5 py-0.5 rounded-md border bg-muted">d</kbd>{" "}
          for dark mode)
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
          />
        )
      }
    />
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/sign-up" element={<LandingPage mode="sign-up" />} />
      <Route path="/app/*" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}