import { Navigate, Route, Routes } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { LeaderboardPage } from "./leaderboard-page"
import { OverviewPage } from "./overview-page"
import { UploadsPage } from "./uploads-page"

export function DashboardPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth()

  if (!isLoaded) {
    return <div className="flex min-h-screen bg-background w-full items-center justify-center"></div>
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />
  }

  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<OverviewPage getToken={getToken} />} />
        <Route path="/uploads" element={<UploadsPage getToken={getToken} />} />
        <Route path="/leaderboard" element={<LeaderboardPage getToken={getToken} />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </DashboardLayout>
  )
}
