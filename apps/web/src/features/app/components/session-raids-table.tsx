import type { ActiveSessionRaidDto } from "@workspace/domain"

import {
  formatAbsoluteDateTime,
  formatStashDeltaMillion,
  formatTimeAgo,
  toMillionValue,
} from "../utils/format"

export function SessionRaidsTable({
  initialStashValue,
  raids,
}: {
  initialStashValue: number
  raids: ActiveSessionRaidDto[]
}) {
  if (raids.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No raids in this session.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[360px] text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/50">
          <tr>
            <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">#</th>
            <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">Time</th>
            <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">Stash</th>
            <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">
              Profit (vs last)
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {raids.map((raid, index) => {
            const olderStash =
              index < raids.length - 1 ? raids[index + 1]!.stashValue : initialStashValue
            const delta = raid.stashValue - olderStash
            const deltaClass =
              delta > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : delta < 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-zinc-500 dark:text-zinc-400"
            return (
              <tr key={raid.id} className="bg-white dark:bg-zinc-900/40">
                <td className="px-3 py-2 tabular-nums text-zinc-500">{index + 1}</td>
                <td
                  className="px-3 py-2 text-zinc-700 dark:text-zinc-300"
                  title={formatAbsoluteDateTime(raid.createdAt)}
                >
                  {formatTimeAgo(raid.createdAt)}
                </td>
                <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                  {toMillionValue(raid.stashValue)}
                </td>
                <td className={`px-3 py-2 font-medium tabular-nums ${deltaClass}`}>
                  {formatStashDeltaMillion(delta)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
