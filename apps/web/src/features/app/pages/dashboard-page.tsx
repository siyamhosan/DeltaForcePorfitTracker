import { Navigate, Route, Routes, useLocation } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { SeoHead } from "@/seo/seo-head"
import { LeaderboardPage } from "./leaderboard-page"
import { OverviewPage } from "./overview-page"
import { ApiKeysPage } from "./api-keys-page"
import { SessionDetailPage } from "./session-detail-page"
import { SessionsPage } from "./sessions-page"
import { UploadsPage } from "./uploads-page"
import { DesktopTabPage } from "./desktop-tab-page"

export function DashboardPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { pathname } = useLocation()

  if (!isLoaded) {
    return <div className="flex min-h-screen bg-background w-full items-center justify-center"></div>
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />
  }

  return (
    <>
      <SeoHead
        title="App Dashboard - Delta Force Profit Tracker"
        description="Signed-in dashboard for stash snapshots, sessions, and leaderboard data."
        pathname={pathname}
        robots="noindex, nofollow"
      />
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<OverviewPage getToken={getToken} />} />
          <Route path="/sessions" element={<SessionsPage getToken={getToken} />} />
          <Route path="/sessions/:sessionId" element={<SessionDetailPage getToken={getToken} />} />
          <Route path="/uploads" element={<UploadsPage getToken={getToken} />} />
          <Route path="/leaderboard" element={<LeaderboardPage getToken={getToken} />} />
          <Route path="/desktop" element={<DesktopTabPage />} />
          <Route path="/api-keys" element={<ApiKeysPage getToken={getToken} />} />
          <Route path="*" element={<Navigate to="/not-found" replace />} />
        </Routes>
      </DashboardLayout>
    </>
  )
}
