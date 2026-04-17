import { Elysia } from "elysia"

import { getLeaderboard } from "../../services/app-service"

export const leaderboardRoutes = new Elysia({ prefix: "/v1" }).get(
  "/leaderboard",
  async ({ query }) => {
    const period = typeof query.period === "string" ? query.period : "all_time"
    const entries = await getLeaderboard(period)
    return {
      period,
      entries,
    }
  }
)
