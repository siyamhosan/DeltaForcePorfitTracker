import { useMemo, useState } from "react"
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiArrowDownSLine,
  RiBarChartBoxLine,
  RiCheckDoubleLine,
  RiHistoryLine,
  RiMedal2Line,
  RiUploadCloud2Line,
} from "@remixicon/react"
import { Link } from "react-router-dom"
import { Button } from "@workspace/ui/components/button"
import { EmptyStateCard } from "@workspace/ui/components/empty-state-card"
import { StatCard } from "@workspace/ui/components/stat-card"

import { createApi } from "@/lib/api"
import { SessionRaidsTable } from "../components/session-raids-table"
import type { GetToken } from "../types"
import {
  formatAbsoluteDateTime,
  formatDuration,
  formatTimeAgo,
  toMillionValue,
} from "../utils/format"
import { cn } from "@workspace/ui/lib/utils"

function profitClassName(total: number) {
  if (total > 0) {
    return "text-emerald-600 dark:text-emerald-400"
  }
  if (total < 0) {
    return "text-red-600 dark:text-red-400"
  }
  return "text-zinc-900 dark:text-zinc-100"
}

export function OverviewPage({ getToken }: { getToken: GetToken }) {
  const api = useMemo(() => createApi(getToken), [getToken])
  const queryClient = useQueryClient()
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(
    () => new Set()
  )
  const overviewQuery = useQuery({
    queryKey: ["app", "overview"],
    queryFn: () => api.getOverview(),
  })
  const sessionsQuery = useQuery({
    queryKey: ["app", "sessions"],
    queryFn: () => api.getSessions(),
  })
  const activeSessionQuery = useQuery({
    queryKey: ["app", "session", "active"],
    queryFn: () => api.getActiveSession(),
    refetchInterval: 10_000,
  })
  const endSessionMutation = useMutation({
    mutationFn: () => api.endSession(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["app", "session", "active"],
        }),
        queryClient.invalidateQueries({ queryKey: ["app", "sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["app", "session"] }),
        queryClient.invalidateQueries({ queryKey: ["app", "overview"] }),
      ])
    },
  })

  const error =
    overviewQuery.error instanceof Error
      ? overviewQuery.error.message
      : sessionsQuery.error instanceof Error
        ? sessionsQuery.error.message
        : activeSessionQuery.error instanceof Error
          ? activeSessionQuery.error.message
          : null
  const overview = overviewQuery.data
  const sessions = sessionsQuery.data ?? []
  const activeSession = activeSessionQuery.data?.activeSession ?? null

  const sessionRaidQueries = useQueries({
    queries: sessions.map((session) => ({
      queryKey: ["app", "session", session.id, "raids"] as const,
      queryFn: () => api.getSessionRaids(session.id),
      enabled: expandedSessionIds.has(session.id),
    })),
  })

  function toggleSessionExpanded(sessionId: string) {
    setExpandedSessionIds((prev) => {
      const next = new Set(prev)
      if (next.has(sessionId)) {
        next.delete(sessionId)
      } else {
        next.add(sessionId)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200/70 bg-gradient-to-br from-zinc-50 via-white to-zinc-100 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Overview
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Live metrics powered by your uploaded stash snapshots.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link to="/app/uploads">
            <Button size="sm" className="gap-2">
              <RiUploadCloud2Line className="h-4 w-4" />
              Add Snapshot
            </Button>
          </Link>
          <Link to="/app/leaderboard">
            <Button size="sm" variant="outline" className="gap-2">
              <RiMedal2Line className="h-4 w-4" />
              View Leaderboard
            </Button>
          </Link>
          <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            {sessions.length} sessions tracked
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Profit"
          value={toMillionValue(overview?.totalProfit ?? 0)}
          icon={<RiBarChartBoxLine className="h-5 w-5" />}
        />
        <StatCard
          title="Total Raids"
          value={String(overview?.totalRaids ?? 0)}
          icon={<RiHistoryLine className="h-5 w-5" />}
        />
        <StatCard
          title="Win Rate"
          value={`${overview?.winRate ?? 0}%`}
          className="sm:col-span-2 lg:col-span-1"
          icon={<RiCheckDoubleLine className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Momentum
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {activeSession
              ? `Current session is active with ${activeSession.totalRaids} confirmed uploads.`
              : "No active session. Upload a stash screenshot to begin tracking momentum."}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Latest Stash
          </p>
          <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {toMillionValue(overview?.latestStashValue ?? 0)}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Updated from your most recent confirmed snapshot.
          </p>
        </div>
      </div>

      {activeSession ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Active Session
              </h2>
              <p
                className="mt-1 text-sm text-zinc-500 dark:text-zinc-400"
                title={formatAbsoluteDateTime(activeSession.startedAt)}
              >
                Started {formatTimeAgo(activeSession.startedAt)}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => endSessionMutation.mutate()}
              disabled={endSessionMutation.isPending}
            >
              {endSessionMutation.isPending ? "Ending..." : "End session"}
            </Button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Duration
              </p>
              <p className="text-sm font-semibold">
                {formatDuration(activeSession.durationSeconds)}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Initial Stash
              </p>
              <p className="text-sm font-semibold">
                {toMillionValue(activeSession.initialStashValue)}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Current Stash
              </p>
              <p className="text-sm font-semibold">
                {toMillionValue(activeSession.currentStashValue)}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Session Profit
              </p>
              <p className={`text-sm font-semibold ${profitClassName(activeSession.totalProfit)}`}>
                {toMillionValue(activeSession.totalProfit)}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Raids in this session ({activeSession.raids.length})
            </h3>
            <div className="mt-3">
              {activeSession.raids.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No confirmed snapshots yet. Confirm an upload to record a raid.
                </p>
              ) : (
                <SessionRaidsTable
                  initialStashValue={activeSession.initialStashValue}
                  raids={activeSession.raids}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}

      {sessions.length === 0 ? (
        <EmptyStateCard
          title="No tracked sessions yet"
          description="Upload your first stash screenshot and confirm it to start a session and begin tracking duration and profit."
          action={
            <Link to="/app/uploads">
              <Button>Go to uploads</Button>
            </Link>
          }
        />
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Recent Sessions
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Newest first. Click a session to load and show all raids.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {sessions.map((session, sessionIndex) => {
              const expanded = expandedSessionIds.has(session.id)
              const raidQuery = sessionRaidQueries[sessionIndex]
              const endTitle = session.endedAt
                ? formatAbsoluteDateTime(session.endedAt)
                : "Session still active"
              return (
                <div
                  key={session.id}
                  className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
                >
                  <button
                    type="button"
                    className="flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50"
                    onClick={() => toggleSessionExpanded(session.id)}
                    aria-expanded={expanded}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "w-fit rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          session.status === "active"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                            : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300"
                        )}
                      >
                        {session.status === "active" ? "Active" : "Ended"}
                      </span>
                      <RiArrowDownSLine
                        className={cn(
                          "h-5 w-5 shrink-0 text-zinc-500 transition-transform dark:text-zinc-400",
                          expanded && "rotate-180"
                        )}
                        aria-hidden
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      <div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          Start
                        </p>
                        <p
                          className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100"
                          title={formatAbsoluteDateTime(session.startedAt)}
                        >
                          {formatTimeAgo(session.startedAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          End
                        </p>
                        <p
                          className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100"
                          title={endTitle}
                        >
                          {session.endedAt ? formatTimeAgo(session.endedAt) : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          Duration
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {formatDuration(session.durationSeconds)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          Profit
                        </p>
                        <p
                          className={`mt-0.5 text-sm font-semibold ${profitClassName(session.totalProfit)}`}
                        >
                          {toMillionValue(session.totalProfit)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          Raids
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {session.totalRaids}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {expanded ? "Hide raids" : "Show raids"}
                    </p>
                  </button>
                  {expanded ? (
                    <div className="border-t border-zinc-200 bg-zinc-50/50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/30">
                      {raidQuery?.isLoading ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          Loading raids…
                        </p>
                      ) : raidQuery?.isError ? (
                        <p className="text-sm text-red-600 dark:text-red-400">
                          Could not load raids.
                        </p>
                      ) : (
                        <SessionRaidsTable
                          initialStashValue={session.initialStashValue}
                          raids={raidQuery?.data?.raids ?? []}
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
