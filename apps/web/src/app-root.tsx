import { Route, Routes } from "react-router-dom"

import { DashboardPage } from "./features/app/pages/dashboard-page"
import { LandingPage } from "./features/app/pages/landing-page"
import {
  OpenSourceAnalyticsPage,
  OcrFeaturePage,
  ProfitCalculatorFeaturePage,
  SelfHostedPage,
  StashTrackerFeaturePage,
} from "./features/seo/pages/keyword-pages"
import { NotFoundPage } from "./features/seo/pages/not-found-page"
import { SeoScorecardPage } from "./features/seo/pages/seo-scorecard-page"

export function AppRoot() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/sign-up" element={<LandingPage mode="sign-up" />} />
      <Route path="/features/stash-tracker" element={<StashTrackerFeaturePage />} />
      <Route path="/features/profit-calculator" element={<ProfitCalculatorFeaturePage />} />
      <Route path="/features/ocr-stash-value" element={<OcrFeaturePage />} />
      <Route path="/self-hosted-game-profit-tracker" element={<SelfHostedPage />} />
      <Route path="/open-source-stash-analytics" element={<OpenSourceAnalyticsPage />} />
      <Route path="/seo-scorecard" element={<SeoScorecardPage />} />
      <Route path="/app/*" element={<DashboardPage />} />
      <Route path="/not-found" element={<NotFoundPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
