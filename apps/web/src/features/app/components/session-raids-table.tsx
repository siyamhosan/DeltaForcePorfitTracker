import type { ActiveSessionRaidDto } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"

import {
  formatAbsoluteWithTimeAgo,
  formatStashDeltaMillion,
  toMillionValue,
} from "../utils/format"

export function SessionRaidsTable({
  initialStashValue,
  raids,
  onDeleteUploadSnapshot,
  deletingUploadJobId,
}: {
  initialStashValue: number
  raids: ActiveSessionRaidDto[]
  onDeleteUploadSnapshot?: (uploadJobId: string) => void
  deletingUploadJobId?: string | null
}) {
  if (raids.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No raids in this session.
      </p>
    )
  }

  return (
    <div className="border-zinc-200 dark:border-zinc-800 overflow-x-auto rounded-lg border">
      <table className="text-sm w-full min-w-[360px] text-left">
        <thead className="border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/50 border-b">
          <tr>
            <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">
              #
            </th>
            <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">
              Time
            </th>
            <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">
              Stash
            </th>
            <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">
              Profit (vs last)
            </th>
            <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-zinc-200 dark:divide-zinc-800 divide-y">
          {raids.map((raid, index) => {
            const olderStash =
              index < raids.length - 1
                ? raids[index + 1]!.stashValue
                : initialStashValue
            const delta = raid.stashValue - olderStash
            const deltaClass =
              delta > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : delta < 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-zinc-500 dark:text-zinc-400"
            return (
              <tr key={raid.id} className="bg-white dark:bg-zinc-900/40">
                <td className="px-3 py-2 text-zinc-500 tabular-nums">
                  {index + 1}
                </td>
                <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                  {formatAbsoluteWithTimeAgo(raid.createdAt)}
                </td>
                <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                  {toMillionValue(raid.stashValue)}
                </td>
                <td
                  className={`px-3 py-2 font-medium tabular-nums ${deltaClass}`}
                >
                  {formatStashDeltaMillion(delta)}
                </td>
                <td className="px-3 py-2">
                  {raid.uploadJobId && onDeleteUploadSnapshot ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDeleteUploadSnapshot(raid.uploadJobId!)}
                      disabled={deletingUploadJobId === raid.uploadJobId}
                      className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      {deletingUploadJobId === raid.uploadJobId
                        ? "Deleting..."
                        : "Delete"}
                    </Button>
                  ) : (
                    <span className="text-xs text-zinc-400">-</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
