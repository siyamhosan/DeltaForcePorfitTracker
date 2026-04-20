import { useMemo } from "react"
import { RiMedal2Line } from "@remixicon/react"
import { useQuery } from "@tanstack/react-query"

import { createApi } from "@/lib/api"
import type { GetToken } from "../types"
import { toMillionValue } from "../utils/format"

export function LeaderboardPage({ getToken }: { getToken: GetToken }) {
  const api = useMemo(() => createApi(getToken), [getToken])
  const leaderboardQuery = useQuery({
    queryKey: ["app", "leaderboard"],
    queryFn: () => api.getLeaderboard(),
  })

  const error =
    leaderboardQuery.error instanceof Error
      ? leaderboardQuery.error.message
      : null
  const entries = leaderboardQuery.data?.entries ?? []

  return (
    <div className="gap-6 flex flex-col">
      <div className="border-zinc-200/70 dark:border-zinc-800 from-zinc-50 via-white to-zinc-100 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 p-6 shadow-sm rounded-2xl border bg-gradient-to-br">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Leaderboard
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Community ranking based on all-time confirmed raid profit.
        </p>
        {entries[0] ? (
          <div className="mt-4 border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/60 px-4 py-3 rounded-lg border">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Top Tracker
            </p>
            <p className="text-sm font-semibold">
              #{entries[0].rank} {entries[0].displayName} ·{" "}
              {toMillionValue(entries[0].totalProfit)}
            </p>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200 rounded-lg border">
          {error}
        </div>
      ) : null}

      <div className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm rounded-xl border">
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.userId}
              className="border-zinc-200 dark:border-zinc-800 px-3 py-2 flex items-center justify-between rounded-md border"
            >
              <div className="gap-3 flex items-center">
                <RiMedal2Line className="h-4 w-4 text-zinc-500" />
                <p className="text-sm font-medium">
                  #{entry.rank} {entry.displayName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">
                  {toMillionValue(entry.totalProfit)}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {entry.totalRaids} raids
                </p>
              </div>
            </div>
          ))}
          {entries.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 px-2 py-4">
              No leaderboard entries yet.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
