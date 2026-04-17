import { useEffect, useMemo, useState } from "react"
import { RiBarChartBoxLine, RiDashboardLine, RiImage2Line, RiMedal2Line } from "@remixicon/react"
import { DashboardShell } from "@workspace/ui/components/dashboard-shell"
import { EmptyStateCard } from "@workspace/ui/components/empty-state-card"
import { StatCard } from "@workspace/ui/components/stat-card"
import type { LeaderboardEntryDto } from "@workspace/domain"

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000/v1"

const navItems = [
  { name: "Overview", href: "overview", icon: RiDashboardLine },
  { name: "Uploads", href: "uploads", icon: RiImage2Line },
  { name: "Leaderboard", href: "leaderboard", icon: RiMedal2Line },
]

function App() {
  const [currentPath, setCurrentPath] = useState("overview")
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryDto[]>([])

  useEffect(() => {
    fetch(`${API_BASE}/leaderboard?period=all_time`)
      .then((res) => res.json())
      .then((data: { entries?: LeaderboardEntryDto[] }) => setLeaderboard(data.entries ?? []))
      .catch(() => setLeaderboard([]))
  }, [])

  const body = useMemo(() => {
    if (currentPath === "leaderboard") {
      return (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Global Leaderboard</h2>
          <div className="space-y-2">
            {leaderboard.slice(0, 15).map((entry) => (
              <div key={entry.userId} className="flex justify-between text-sm border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <span>#{entry.rank} {entry.displayName}</span>
                <span>${entry.totalProfit.toLocaleString()}</span>
              </div>
            ))}
            {leaderboard.length === 0 ? <p className="text-sm text-zinc-500">No leaderboard data yet.</p> : null}
          </div>
        </div>
      )
    }

    if (currentPath === "uploads") {
      return (
        <EmptyStateCard
          title="Desktop Upload Assistant"
          description="Use this screen for local screenshot organization and API upload flows. The same shared UI components are now used by desktop and web."
        />
      )
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Desktop shell reusing @workspace/ui and shared API contracts.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Sync Status"
            value="Connected"
            icon={<RiBarChartBoxLine className="h-5 w-5" />}
          />
          <StatCard
            title="Leaderboard Entries"
            value={String(leaderboard.length)}
            icon={<RiMedal2Line className="h-5 w-5" />}
          />
          <StatCard
            title="Capture Policy"
            value="Manual-Only"
            icon={<RiImage2Line className="h-5 w-5" />}
          />
        </div>
      </div>
    )
  }, [currentPath, leaderboard])

  return (
    <DashboardShell
      navItems={navItems}
      currentPath={currentPath}
      productName="Delta Force"
      userSlot={<span className="text-xs text-zinc-500 dark:text-zinc-400">Desktop Client</span>}
      renderNavItem={(item, className, content) => (
        <button
          key={item.name}
          type="button"
          onClick={() => setCurrentPath(item.href)}
          className={className}
        >
          {content}
        </button>
      )}
    >
      {body}
    </DashboardShell>
  )
}

export default App
