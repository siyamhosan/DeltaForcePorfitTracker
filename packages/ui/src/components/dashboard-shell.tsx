import type { ElementType, ReactNode } from "react"

type DashboardNavItem = {
  name: string
  href: string
  icon: ElementType
}

type DashboardShellProps = {
  navItems: DashboardNavItem[]
  currentPath: string
  productName: string
  userSlot?: ReactNode
  children: ReactNode
  logoText?: string
  renderNavItem: (item: DashboardNavItem, className: string, content: ReactNode) => ReactNode
}

export function DashboardShell({
  navItems,
  currentPath,
  productName,
  userSlot,
  children,
  logoText = "Δ",
  renderNavItem,
}: DashboardShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex w-64 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          <div className="flex h-0 flex-1 flex-col pt-5 pb-4">
            <div className="flex flex-shrink-0 items-center px-6 mb-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold">
                {logoText}
              </div>
              <span className="ml-3 text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                {productName}
              </span>
            </div>
            <nav className="mt-2 flex-1 space-y-1 bg-white dark:bg-zinc-950 px-3">
              {navItems.map((item) => {
                const isCurrent = currentPath === item.href
                const content = (
                  <>
                    <item.icon
                      className={`mr-3 h-5 w-5 flex-shrink-0 ${isCurrent ? "text-zinc-900 dark:text-white" : "text-zinc-400 group-hover:text-zinc-500 dark:group-hover:text-zinc-300"}`}
                      aria-hidden="true"
                    />
                    {item.name}
                  </>
                )

                return renderNavItem(
                  item,
                  `group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${isCurrent ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"}`,
                  content
                )
              })}
            </nav>
          </div>
          {userSlot ? (
            <div className="flex flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800 p-4">
              {userSlot}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden relative">
        <div className="sticky top-0 z-10 flex h-16 flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md lg:hidden">
          <div className="flex flex-1 items-center justify-between px-4 sm:px-6 w-full">
            <div className="flex items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold">
                {logoText}
              </div>
              <span className="ml-3 text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                {productName}
              </span>
            </div>
            {userSlot}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto focus:outline-none">
          <div className="py-6 pb-24 lg:pb-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">{children}</div>
          </div>
        </main>

        <div className="fixed inset-x-0 bottom-0 z-20 w-screen border-t border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-lg lg:hidden pb-safe">
          <nav
            className="grid h-16 w-full"
            style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
          >
            {navItems.map((item) => {
              const isCurrent = currentPath === item.href
              const content = (
                <>
                  <item.icon
                    className={`h-6 w-6 ${isCurrent ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"}`}
                    aria-hidden="true"
                  />
                  <span className="text-[10px] font-medium">{item.name}</span>
                </>
              )

              return renderNavItem(
                item,
                `flex flex-col items-center justify-center w-full h-full space-y-1 ${isCurrent ? "text-zinc-900 dark:text-white" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"}`,
                content
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )
}
