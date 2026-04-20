import { useMemo } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"

import { createApi } from "@/lib/api"
import type { GetToken } from "../types"
import {
  formatAbsoluteDateTime,
  formatDuration,
  formatProfitPerHour,
  formatTimeAgo,
  toMillionValue,
} from "../utils/format"

function profitClassName(total: number) {
  if (total > 0) {
    return "text-emerald-600 dark:text-emerald-400"
  }
  if (total < 0) {
    return "text-red-600 dark:text-red-400"
  }
  return "text-zinc-900 dark:text-zinc-100"
}

const PAGE_SIZE = 12

export function SessionsPage({ getToken }: { getToken: GetToken }) {
  const api = useMemo(() => createApi(getToken), [getToken])
  const [searchParams, setSearchParams] = useSearchParams()
  const pageRaw = Number(searchParams.get("page") ?? "1")
  const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1

  const sessionsQuery = useQuery({
    queryKey: ["app", "sessions", "paginated", page, PAGE_SIZE],
    queryFn: () => api.getSessionsPaginated(page, PAGE_SIZE),
  })

  const sessions = sessionsQuery.data?.items ?? []
  const totalPages = sessionsQuery.data?.totalPages ?? 1

  function goToPage(nextPage: number) {
    const clamped = Math.max(1, Math.min(totalPages, nextPage))
    setSearchParams({ page: String(clamped) })
  }

  return (
    <div className="gap-6 flex flex-col">
      <div className="border-zinc-200/70 from-zinc-50 via-white to-zinc-100 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 rounded-2xl border bg-gradient-to-br">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Sessions
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Full session history with detailed metrics and drill-down view.
        </p>
      </div>

      {sessionsQuery.isLoading ? (
        <div className="border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 rounded-xl border">
          Loading sessions...
        </div>
      ) : sessionsQuery.isError ? (
        <div className="border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/30 dark:text-red-300 rounded-xl border">
          Could not load sessions.
        </div>
      ) : sessions.length === 0 ? (
        <div className="border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 rounded-xl border">
          No sessions yet.
        </div>
      ) : (
        <div className="gap-4 sm:grid-cols-2 xl:grid-cols-3 grid">
          {sessions.map((session) => (
            <Link
              key={session.id}
              to={`/app/sessions/${session.id}`}
              className="border-zinc-200 bg-white p-4 shadow-sm hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 rounded-xl border transition-colors"
            >
              <div className="gap-2 flex items-center justify-between">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    session.status === "active"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {session.status}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {session.totalRaids} raids
                </span>
              </div>

              <div className="mt-3 space-y-2">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Started {formatTimeAgo(session.startedAt)}
                </p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {formatAbsoluteDateTime(session.startedAt)}
                </p>
                <div className="gap-2 pt-1 text-sm grid grid-cols-2">
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Profit
                    </p>
                    <p
                      className={`font-semibold ${profitClassName(session.totalProfit)}`}
                    >
                      {toMillionValue(session.totalProfit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Profit / h
                    </p>
                    <p
                      className={`font-semibold ${profitClassName(session.totalProfit)}`}
                    >
                      {formatProfitPerHour(
                        session.totalProfit,
                        session.durationSeconds
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Duration
                    </p>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {formatDuration(session.durationSeconds)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Final Stash
                    </p>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {toMillionValue(session.currentStashValue)}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          disabled={page <= 1}
          onClick={() => goToPage(page - 1)}
        >
          Previous
        </Button>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Page {page} of {totalPages}
        </p>
        <Button
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => goToPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
