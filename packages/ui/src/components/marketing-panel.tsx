import type { ReactNode } from "react"

export type MarketingFeature = {
  title: string
  description: string
  icon: ReactNode
  /** Widen card to full grid width (e.g. last row) */
  wide?: boolean
}

type MarketingPanelProps = {
  productName: string
  headline: string
  description: string
  features: MarketingFeature[]
  /** Optional visuals between the feature grid and the footer (e.g. product screenshots). */
  preview?: ReactNode
  footer?: ReactNode
  logoText?: string
}

export function MarketingPanel({
  productName,
  headline,
  description,
  features,
  preview,
  footer,
  logoText = "Δ",
}: MarketingPanelProps) {
  return (
    <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r bg-zinc-950 p-8 text-zinc-50 lg:flex xl:p-10">
      <div className="absolute inset-0 bg-zinc-900/20" />
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-950 font-bold text-xl">
            {logoText}
          </div>
          <span className="text-xl font-bold tracking-tight">{productName}</span>
        </div>

        <div className="flex w-full flex-col gap-6">
          <div>
            <h2 className="mb-2 text-2xl font-semibold tracking-tight lg:text-3xl">{headline}</h2>
            <p className="text-sm leading-relaxed text-zinc-400 lg:text-base">{description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className={`rounded-xl border border-zinc-800/90 bg-zinc-900/35 p-4 ${feature.wide ? "col-span-2" : ""}`}
              >
                <div className="flex gap-3">
                  <div className="shrink-0 rounded-lg bg-zinc-800 p-2 text-zinc-300 [&_svg]:h-5 [&_svg]:w-5">
                    {feature.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium leading-snug text-zinc-100">{feature.title}</h3>
                    <p className="mt-1 text-xs leading-snug text-zinc-500">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {preview ? <div className="relative z-10 mt-8">{preview}</div> : null}
      </div>

      {footer ? (
        <div className="relative z-10 text-sm text-zinc-500">{footer}</div>
      ) : null}
    </div>
  )
}
