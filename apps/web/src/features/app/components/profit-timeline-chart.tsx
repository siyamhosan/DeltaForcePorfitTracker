import { useMemo } from "react"
import type { ActiveSessionDto, SessionHistoryItem } from "@workspace/domain"
import {
  ChartContainer,
  ChartTooltip,
  RechartsPrimitive,
} from "@workspace/ui/components/chart"

import { toMillionValue } from "../utils/format"

type ProfitTimelineChartProps = {
  sessions?: SessionHistoryItem[]
  activeSession?: ActiveSessionDto | null
  useDemoData?: boolean
  showHeader?: boolean
  compact?: boolean
}

type ProfitTimelinePoint = {
  id: string
  label: string
  startedAt: string
  sessionProfit: number
  cumulativeProfit: number
}

const chartConfig = {
  cumulative: {
    label: "Cumulative PnL",
    color: "hsl(var(--primary))",
  },
  session: {
    label: "Session PnL",
    color: "hsl(var(--primary))",
  },
}

function formatAxisProfit(value: number) {
  const prefix = value > 0 ? "+" : ""
  return `${prefix}${toMillionValue(value)}`
}

function formatTimelineLabel(dateIso: string) {
  const date = new Date(dateIso)
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

function buildDemoData(): ProfitTimelinePoint[] {
  // Demo data reflecting a single multi-hour session with realistic 0M -> 15M swings
  return [
    {
      id: "demo-1",
      label: "2:00 PM",
      startedAt: "2026-04-21T14:00:00.000Z",
      sessionProfit: -2.5,
      cumulativeProfit: -2.5,
    },
    {
      id: "demo-2",
      label: "2:45 PM",
      startedAt: "2026-04-21T14:45:00.000Z",
      sessionProfit: -1.2,
      cumulativeProfit: -3.7,
    },
    {
      id: "demo-3",
      label: "3:10 PM",
      startedAt: "2026-04-21T15:10:00.000Z",
      sessionProfit: +4.5,
      cumulativeProfit: +0.8,
    },
    {
      id: "demo-4",
      label: "3:50 PM",
      startedAt: "2026-04-21T15:50:00.000Z",
      sessionProfit: -5.0,
      cumulativeProfit: -4.2,
    },
    {
      id: "demo-5",
      label: "4:20 PM",
      startedAt: "2026-04-21T16:20:00.000Z",
      sessionProfit: +14.0,
      cumulativeProfit: +9.8,
    },
    {
      id: "demo-6",
      label: "5:00 PM",
      startedAt: "2026-04-21T17:00:00.000Z",
      sessionProfit: +8.2,
      cumulativeProfit: +18.0,
    },
    {
      id: "demo-7",
      label: "5:30 PM",
      startedAt: "2026-04-21T17:30:00.000Z",
      sessionProfit: +1.1,
      cumulativeProfit: +19.1,
    },
    {
      id: "demo-8",
      label: "6:15 PM",
      startedAt: "2026-04-21T18:15:00.000Z",
      sessionProfit: -2.0,
      cumulativeProfit: +17.1,
    },
  ]
}

function buildActiveSessionData(
  activeSession: ActiveSessionDto
): ProfitTimelinePoint[] {
  if (activeSession.raids.length === 0) {
    return []
  }

  const orderedRaids = [...activeSession.raids].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  let previousStash = activeSession.initialStashValue
  return orderedRaids.map((raid) => {
    const sessionProfit = Math.round((raid.stashValue - previousStash) * 10) / 10
    previousStash = raid.stashValue
    const cumulativeProfit =
      Math.round((raid.stashValue - activeSession.initialStashValue) * 10) / 10

    return {
      id: raid.id,
      label: formatTimelineLabel(raid.createdAt),
      startedAt: raid.createdAt,
      sessionProfit,
      cumulativeProfit,
    }
  })
}

export function ProfitTimelineChart({
  sessions = [],
  activeSession = null,
  useDemoData = true,
  showHeader = true,
  compact = false,
}: ProfitTimelineChartProps) {
  const data = useMemo<ProfitTimelinePoint[]>(() => {
    if (activeSession) {
      return buildActiveSessionData(activeSession)
    }

    if (useDemoData) {
      return buildDemoData()
    }

    const ordered = [...sessions].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    )

    let cumulativeProfit = 0
    return ordered.map((session) => {
      cumulativeProfit += session.totalProfit

      return {
        id: session.id,
        label: formatTimelineLabel(session.startedAt),
        startedAt: session.startedAt,
        sessionProfit: session.totalProfit,
        cumulativeProfit: Math.round(cumulativeProfit * 10) / 10,
      }
    })
  }, [activeSession, sessions, useDemoData])

  if (data.length === 0) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        No timeline points yet. Confirm snapshots to start plotting momentum.
      </div>
    )
  }

  const max = Math.max(...data.map((d) => d.cumulativeProfit))
  const min = Math.min(...data.map((d) => d.cumulativeProfit))
  
  let gradientOffset = 0
  if (max <= 0) {
    gradientOffset = 0
  } else if (min >= 0) {
    gradientOffset = 1
  } else {
    gradientOffset = max / (max - min)
  }

  return (
    <div className="space-y-4">
      {showHeader ? (
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Profit Timeline
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Cumulative PnL over time (top) with individual session performance (bottom).
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <ChartContainer
          config={chartConfig}
          className={compact ? "h-44 w-full" : "h-64 w-full"}
          initialDimension={{ width: 720, height: compact ? 176 : 256 }}
        >
          <RechartsPrimitive.AreaChart
            data={data}
            syncId="pnlTimeline"
            margin={
              compact
                ? { top: 14, right: 12, bottom: 8, left: 0 }
                : { top: 24, right: 12, bottom: 12, left: 0 }
            }
          >
            <defs>
              <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset={gradientOffset} stopColor="hsl(142 72% 40%)" stopOpacity={0.3} />
                <stop offset={gradientOffset} stopColor="hsl(0 72% 50%)" stopOpacity={0.3} />
              </linearGradient>
              <linearGradient id="splitStroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset={gradientOffset} stopColor="hsl(142 72% 40%)" stopOpacity={1} />
                <stop offset={gradientOffset} stopColor="hsl(0 72% 50%)" stopOpacity={1} />
              </linearGradient>
            </defs>
            <RechartsPrimitive.CartesianGrid vertical={false} />
            <RechartsPrimitive.XAxis
              dataKey="label"
              hide
            />
            <RechartsPrimitive.YAxis
              orientation="right"
              tickFormatter={formatAxisProfit}
              width={80}
              tickLine={false}
              axisLine={false}
              padding={{ top: 20, bottom: 20 }}
            />
            <RechartsPrimitive.ReferenceLine y={0} stroke="hsl(var(--border))" />
            <ChartTooltip
              cursor={true}
              content={({ active, payload }) => {
                if (!active || !payload?.length) {
                  return null
                }
                const point = payload[0]?.payload as ProfitTimelinePoint | undefined
                if (!point) {
                  return null
                }
                const cumulativeSign = point.cumulativeProfit > 0 ? "+" : ""
                const sessionSign = point.sessionProfit > 0 ? "+" : ""
                
                return (
                  <div className="min-w-48 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs shadow-xl">
                    <p className="font-medium text-foreground">
                      {new Date(point.startedAt).toLocaleString()}
                    </p>
                    <p className="mt-2 text-muted-foreground flex justify-between gap-4">
                      <span>Cumulative PnL</span>
                      <span
                        className={
                          point.cumulativeProfit > 0
                            ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                            : point.cumulativeProfit < 0
                              ? "text-red-600 dark:text-red-400 font-semibold"
                              : "text-zinc-500 dark:text-zinc-400 font-semibold"
                        }
                      >
                        {cumulativeSign}
                        {toMillionValue(point.cumulativeProfit)}
                      </span>
                    </p>
                    <p className="mt-1 text-muted-foreground flex justify-between gap-4">
                      <span>Session PnL</span>
                      <span
                        className={
                          point.sessionProfit > 0
                            ? "text-emerald-600 dark:text-emerald-400 font-medium"
                            : point.sessionProfit < 0
                              ? "text-red-600 dark:text-red-400 font-medium"
                              : "text-zinc-500 dark:text-zinc-400 font-medium"
                        }
                      >
                        {sessionSign}
                        {toMillionValue(point.sessionProfit)}
                      </span>
                    </p>
                  </div>
                )
              }}
            />
            <RechartsPrimitive.Area
              type="monotone"
              dataKey="cumulativeProfit"
              stroke="url(#splitStroke)"
              fill="url(#splitColor)"
              strokeWidth={2}
              activeDot={{ r: 6, fill: "hsl(var(--background))", strokeWidth: 2 }}
              isAnimationActive={false}
            >
              <RechartsPrimitive.LabelList
                dataKey="cumulativeProfit"
                content={(props: any) => {
                  const { x, y, value } = props
                  if (value === undefined || value === null) return null
                  const isNegative = value < 0
                  const textY = isNegative ? y + 16 : y - 10
                  const textValue = value > 0 ? `+${value}M` : `${value}M`
                  return (
                    <text
                      x={x}
                      y={textY}
                      fill="currentColor"
                      textAnchor="middle"
                      className="fill-foreground text-[11px] font-semibold"
                    >
                      {textValue}
                    </text>
                  )
                }}
              />
            </RechartsPrimitive.Area>
          </RechartsPrimitive.AreaChart>
        </ChartContainer>

        <ChartContainer
          config={chartConfig}
          className={compact ? "h-28 w-full" : "h-48 w-full"}
          initialDimension={{ width: 720, height: compact ? 112 : 192 }}
        >
          <RechartsPrimitive.BarChart
            data={data}
            syncId="pnlTimeline"
            margin={
              compact
                ? { top: 14, right: 12, bottom: 16, left: 0 }
                : { top: 24, right: 12, bottom: 24, left: 0 }
            }
          >
            <RechartsPrimitive.CartesianGrid vertical={false} />
            <RechartsPrimitive.XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={18}
              interval="preserveStartEnd"
            />
            <RechartsPrimitive.YAxis
              orientation="right"
              width={80}
              tickLine={false}
              axisLine={false}
              tick={false}
              padding={{ top: 20, bottom: 20 }}
            />
            <RechartsPrimitive.ReferenceLine y={0} stroke="hsl(var(--border))" />
            <ChartTooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
              content={() => null}
            />
            <RechartsPrimitive.Bar
              dataKey="sessionProfit"
              radius={[2, 2, 2, 2]}
              isAnimationActive={false}
              maxBarSize={40}
            >
              <RechartsPrimitive.LabelList
                dataKey="sessionProfit"
                content={(props: any) => {
                  const { x, y, width, height, value } = props
                  if (value === undefined || value === null) return null
                  const isNegative = value < 0
                  const topY = Math.min(y, y + height)
                  const bottomY = Math.max(y, y + height)
                  const textY = isNegative ? bottomY + 14 : topY - 6
                  const textValue = value > 0 ? `+${value}M` : `${value}M`
                  return (
                    <text
                      x={x + width / 2}
                      y={textY}
                      fill="currentColor"
                      textAnchor="middle"
                      className="fill-foreground text-[11px] font-medium"
                    >
                      {textValue}
                    </text>
                  )
                }}
              />
              {data.map((point) => (
                <RechartsPrimitive.Cell
                  key={point.id}
                  fill={
                    point.sessionProfit > 0
                      ? "hsl(142 72% 40%)"
                      : point.sessionProfit < 0
                        ? "hsl(0 72% 50%)"
                        : "hsl(220 9% 55%)"
                  }
                />
              ))}
            </RechartsPrimitive.Bar>
          </RechartsPrimitive.BarChart>
        </ChartContainer>
      </div>
      {useDemoData ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Demo mode: synchronized cumulative PnL area chart with individual session bars below.
        </p>
      ) : null}
    </div>
  )
}
