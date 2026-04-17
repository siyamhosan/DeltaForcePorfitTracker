import type { ReactNode } from "react"

export type MarketingFeature = {
  title: string
  description: string
  icon: ReactNode
}

type MarketingPanelProps = {
  productName: string
  headline: string
  description: string
  features: MarketingFeature[]
  footer?: ReactNode
  logoText?: string
}

export function MarketingPanel({
  productName,
  headline,
  description,
  features,
  footer,
  logoText = "Δ",
}: MarketingPanelProps) {
  return (
    <div className="hidden lg:flex w-1/2 flex-col justify-between border-r bg-zinc-950 p-12 text-zinc-50 relative overflow-hidden">
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
        <div className="flex items-center gap-2 mb-16">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-950 font-bold text-xl">
            {logoText}
          </div>
          <span className="text-xl font-bold tracking-tight">{productName}</span>
        </div>

        <div className="max-w-md space-y-12">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight mb-4">{headline}</h2>
            <p className="text-zinc-400 text-lg leading-relaxed">{description}</p>
          </div>

          <div className="space-y-8">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300 shrink-0">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-medium text-zinc-100">{feature.title}</h3>
                  <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {footer ? (
        <div className="relative z-10 text-sm text-zinc-500">{footer}</div>
      ) : null}
    </div>
  )
}
