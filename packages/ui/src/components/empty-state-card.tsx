import type { ReactNode } from "react"

type EmptyStateCardProps = {
  title: string
  description: string
  action?: ReactNode
}

export function EmptyStateCard({ title, description, action }: EmptyStateCardProps) {
  return (
    <div className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm text-center">
      <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">{title}</h3>
      <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-md mx-auto">{description}</p>
      {action}
    </div>
  )
}
