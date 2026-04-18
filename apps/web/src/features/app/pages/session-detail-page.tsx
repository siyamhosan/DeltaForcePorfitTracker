import { useMemo, useState } from "react"
import { Link, Navigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { createApi } from "@/lib/api"
import { SessionRaidsTable } from "../components/session-raids-table"
import type { GetToken } from "../types"
import {
  formatAbsoluteDateTime,
  formatDuration,
  formatProfitPerHour,
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

export function SessionDetailPage({ getToken }: { getToken: GetToken }) {
  const { sessionId } = useParams<{ sessionId: string }>()
  const api = useMemo(() => createApi(getToken), [getToken])
  const queryClient = useQueryClient()
  const [pendingDeleteUploadId, setPendingDeleteUploadId] = useState<string | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")

  if (!sessionId) {
    return <Navigate to="/app/sessions" replace />
  }

  const sessionQuery = useQuery({
    queryKey: ["app", "session", sessionId, "detail"],
    queryFn: () => api.getSessionById(sessionId),
  })
  const raidsQuery = useQuery({
    queryKey: ["app", "session", sessionId, "raids"],
    queryFn: () => api.getSessionRaids(sessionId),
  })
  const deleteSnapshotMutation = useMutation({
    mutationFn: (uploadId: string) => api.deleteUploadSnapshot(uploadId),
    onSuccess: async () => {
      setPendingDeleteUploadId(null)
      setDeleteConfirmText("")
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["app", "session", sessionId, "detail"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["app", "session", sessionId, "raids"],
        }),
        queryClient.invalidateQueries({ queryKey: ["app", "sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["app", "overview"] }),
        queryClient.invalidateQueries({ queryKey: ["app", "leaderboard"] }),
      ])
    },
  })

  const session = sessionQuery.data?.session
  const raids = raidsQuery.data?.raids ?? []

  if (sessionQuery.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
        Could not load session details.
      </div>
    )
  }

  if (sessionQuery.isLoading || !session) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        Loading session details...
      </div>
    )
  }

  function closeDeleteDialog() {
    setPendingDeleteUploadId(null)
    setDeleteConfirmText("")
    deleteSnapshotMutation.reset()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200/70 bg-gradient-to-br from-zinc-50 via-white to-zinc-100 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Session Details
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400">
              Started {formatAbsoluteDateTime(session.startedAt)}
            </p>
          </div>
          <Link to="/app/sessions">
            <Button variant="outline">Back to Sessions</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Status</p>
          <p className="mt-1 text-base font-semibold capitalize text-zinc-900 dark:text-zinc-100">
            {session.status}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Duration</p>
          <p className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {formatDuration(session.durationSeconds)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Profit</p>
          <p className={`mt-1 text-base font-semibold ${profitClassName(session.totalProfit)}`}>
            {toMillionValue(session.totalProfit)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Profit / h</p>
          <p className={`mt-1 text-base font-semibold ${profitClassName(session.totalProfit)}`}>
            {formatProfitPerHour(session.totalProfit, session.durationSeconds)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Raids</p>
          <p className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {session.totalRaids}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Session Raids
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Detailed snapshot timeline for this session.
        </p>
        <div className="mt-4">
          <SessionRaidsTable
            initialStashValue={session.initialStashValue}
            raids={raids}
            onDeleteUploadSnapshot={(uploadJobId) => {
              setPendingDeleteUploadId(uploadJobId)
              setDeleteConfirmText("")
            }}
            deletingUploadJobId={pendingDeleteUploadId}
          />
        </div>
      </div>

      <Dialog
        open={pendingDeleteUploadId !== null}
        onOpenChange={(open) => !open && closeDeleteDialog()}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete Snapshot</DialogTitle>
            <DialogDescription>
              This permanently deletes the selected snapshot. If this is the last snapshot in its
              session, that session will be deleted too. Type <strong>DELETE</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(event) => setDeleteConfirmText(event.target.value.toUpperCase())}
            placeholder="Type DELETE"
            className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-red-900 placeholder:text-red-400 dark:border-red-800 dark:bg-zinc-950 dark:text-red-200 dark:placeholder:text-red-400"
          />
          {deleteSnapshotMutation.error instanceof Error ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {deleteSnapshotMutation.error.message}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                onClick={closeDeleteDialog}
                disabled={deleteSnapshotMutation.isPending}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={() =>
                pendingDeleteUploadId &&
                deleteSnapshotMutation.mutate(pendingDeleteUploadId)
              }
              disabled={deleteSnapshotMutation.isPending || deleteConfirmText !== "DELETE"}
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
            >
              {deleteSnapshotMutation.isPending ? "Deleting..." : "Yes, Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

