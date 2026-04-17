import { UserButton, useUser } from "@clerk/clerk-react"
import { Link, useLocation } from "react-router-dom"
import {
  RiDashboardLine,
  RiImage2Line,
  RiMedal2Line,
} from "@remixicon/react"
import { DashboardShell } from "@workspace/ui/components/dashboard-shell"

interface DashboardLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: "Overview", href: "/app", icon: RiDashboardLine },
  { name: "Uploads", href: "/app/uploads", icon: RiImage2Line },
  { name: "Leaderboard", href: "/app/leaderboard", icon: RiMedal2Line },
]

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user } = useUser()
  const location = useLocation()

  return (
    <DashboardShell
      navItems={navigation}
      currentPath={location.pathname}
      productName="Delta Force"
      userSlot={
        <div className="group block flex-shrink-0">
          <div className="flex items-center gap-2">
            <UserButton />
            <div className="ml-1 hidden lg:block">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[140px]">
                {user?.fullName || user?.primaryEmailAddress?.emailAddress}
              </p>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Manage account
              </p>
            </div>
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
