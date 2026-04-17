import { Navigate, Route, Routes } from "react-router-dom"

import { DashboardPage } from "./features/app/pages/dashboard-page"
import { LandingPage } from "./features/app/pages/landing-page"

export function AppRoot() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/sign-up" element={<LandingPage mode="sign-up" />} />
      <Route path="/app/*" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
