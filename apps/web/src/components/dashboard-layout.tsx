import { UserButton, useClerk, useUser } from "@clerk/clerk-react"
import { Link, useLocation } from "react-router-dom"
import {
  RiCalendarScheduleLine,
  RiDashboardLine,
  RiImage2Line,
  RiKey2Line,
  RiMedal2Line,
  RiComputerLine,
} from "@remixicon/react"
import { DashboardShell } from "@workspace/ui/components/dashboard-shell"

interface DashboardLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: "Overview", href: "/app", icon: RiDashboardLine },
  { name: "Sessions", href: "/app/sessions", icon: RiCalendarScheduleLine },
  { name: "Uploads", href: "/app/uploads", icon: RiImage2Line },
  { name: "Leaderboard", href: "/app/leaderboard", icon: RiMedal2Line },
  { name: "Desktop App", href: "/app/desktop", icon: RiComputerLine },
  { name: "API Keys", href: "/app/api-keys", icon: RiKey2Line },
]

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const clerk = useClerk()
  const { user } = useUser()
  const location = useLocation()

  return (
    <DashboardShell
      navItems={navigation}
      currentPath={location.pathname}
      productName="Delta Force"
      userSlot={
        <div className="group block flex-shrink-0">
          <div className="gap-2 flex items-center">
            <UserButton />
            <button
              type="button"
              className="ml-1 lg:block hidden text-left"
              onClick={() => clerk.openUserProfile()}
            >
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 max-w-[140px] truncate">
                {user?.fullName || user?.primaryEmailAddress?.emailAddress}
              </p>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Manage account
              </p>
            </button>
          </div>
        </div>
      }
      renderNavItem={(item, className, content) => (
        <Link key={item.name} to={item.href} className={className}>
          {content}
        </Link>
      )}
    >
      {children}
    </DashboardShell>
  )
}
