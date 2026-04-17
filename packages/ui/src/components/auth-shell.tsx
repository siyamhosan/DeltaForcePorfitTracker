import type { ReactNode } from "react"

type AuthShellProps = {
  leftPanel?: ReactNode
  authContent: ReactNode
  productName: string
  subtitle: string
  hint?: ReactNode
  logoText?: string
}

export function AuthShell({
  leftPanel,
  authContent,
  productName,
  subtitle,
  hint,
  logoText = "Δ",
}: AuthShellProps) {
  return (
    <div className="flex min-h-screen bg-background w-full">
      {leftPanel}

      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center p-8 relative">
        {hint ? (
          <div className="absolute top-8 right-8 text-sm font-mono text-muted-foreground flex flex-col items-end gap-1">
            {hint}
          </div>
        ) : null}

        <div className="w-full max-w-[400px] flex flex-col gap-6">
          <div className="flex flex-col text-center space-y-2 lg:hidden mb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xl">
                {logoText}
              </div>
              <span className="text-xl font-bold tracking-tight">{productName}</span>
            </div>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <div className="w-full flex justify-center">{authContent}</div>
        </div>
      </div>
    </div>
  )
}
