import { SeoHead } from "@/seo/seo-head"

const authorityLoop = [
  "Publish product updates in GitHub releases with keyworded change summaries.",
  "Repurpose release highlights into community posts with links to feature pages.",
  "Maintain integration showcases that attract links from gaming/tool communities.",
  "Track monthly referring domains growth to commercial-intent routes.",
]

const milestones = [
  {
    period: "30 days",
    targets: [
      "All public routes indexed and /app routes excluded.",
      "Sitemap accepted in Search Console with no critical errors.",
      "Baseline branded CTR and impression trend captured.",
    ],
  },
  {
    period: "60 days",
    targets: [
      "Non-branded impressions increase on stash/profit/OCR clusters.",
      "At least 5 external links to feature or open-source pages.",
      "CWV p75 shows no severe LCP/INP/CLS regressions.",
    ],
  },
  {
    period: "90 days",
    targets: [
      "Sustained MoM non-branded clicks growth.",
      "Organic-to-signup conversion improves versus baseline.",
      "Keyword cluster pages generate recurring assisted signups.",
    ],
  },
]

export function SeoScorecardPage() {
  return (
    <>
      <SeoHead
        title="SEO Growth Scorecard - Delta Force Profit Tracker"
        description="Internal scorecard for 30/60/90 day SEO growth milestones."
        pathname="/seo-scorecard"
        robots="noindex, nofollow"
      />
      <main className="max-w-4xl gap-8 px-6 py-12 mx-auto flex w-full flex-col">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          SEO Growth Scorecard
        </h1>
        <section className="border-zinc-200/70 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 rounded-2xl border">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Authority and distribution loop
          </h2>
          <ul className="mt-4 space-y-2 pl-5 text-zinc-700 dark:text-zinc-300 list-disc">
            {authorityLoop.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="border-zinc-200/70 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-950 rounded-2xl border">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            30 / 60 / 90 day milestones
          </h2>
          <div className="mt-4 space-y-5">
            {milestones.map((milestone) => (
              <article key={milestone.period}>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {milestone.period}
                </h3>
                <ul className="mt-2 space-y-1 pl-5 text-zinc-700 dark:text-zinc-300 list-disc">
                  {milestone.targets.map((target) => (
                    <li key={target}>{target}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  )
}
