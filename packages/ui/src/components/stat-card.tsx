import type { ReactNode } from "react"

type StatCardProps = {
  title: string
  value: string
  icon: ReactNode
  className?: string
  valueClassName?: string
}

export function StatCard({ title, value, icon, className, valueClassName }: StatCardProps) {
  return (
    <div
      className={`rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm ${className ?? ""}`}
    >
      <div className="flex items-center gap-4 text-zinc-600 dark:text-zinc-400 mb-4">
        <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
          {icon}
        </div>
        <h3 className="font-medium">{title}</h3>
      </div>
      <p className={`text-3xl font-bold ${valueClassName ?? "text-zinc-900 dark:text-white"}`}>
        {value}
      </p>
    </div>
  )
}
