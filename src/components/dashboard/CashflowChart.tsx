import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, ReferenceArea,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { format, subDays } from "date-fns";
import { Sparkles, TrendingDown, TrendingUp, Calendar } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Projection = Tables<"cashflow_projections">;

interface CashflowChartProps {
  projections: Projection[];
  payrollThreshold: number;
}

type Range = "14d" | "30d" | "60d";

export function CashflowChart({ projections, payrollThreshold }: CashflowChartProps) {
  const [range, setRange] = useState<Range>("30d");
  const today = new Date("2026-02-21");

  const chartData = useMemo(() => {
    const histDays = range === "14d" ? 14 : range === "60d" ? 60 : 30;
    const data: { date: string; rawDate: Date; balance: number | null; projected: number | null; isToday?: boolean }[] = [];

    // Historical
    let bal = 980000;
    for (let i = Math.max(histDays, 60); i >= 1; i--) {
      const d = subDays(today, i);
      const dow = d.getDay();
      if (dow === 5 || dow === 6) bal += 120000;
      else bal -= 40000;
      if (d.getDate() === 1) bal -= 320000;
      if (i <= histDays) {
        data.push({ date: format(d, "MMM d"), rawDate: d, balance: bal, projected: null });
      }
    }

    // Today
    data.push({ date: "Today", rawDate: today, balance: 620000, projected: 620000, isToday: true });

    // Projections
    projections.forEach((p) => {
      const d = new Date(p.projection_date);
      if (d <= today) return;
      data.push({ date: format(d, "MMM d"), rawDate: d, balance: null, projected: p.projected_balance });
    });

    return data;
  }, [projections, range]);

  const hasData = chartData.length > 1;

  // Calculate stats
  const stats = useMemo(() => {
    const historicalValues = chartData.filter((d) => d.balance !== null).map((d) => d.balance!);
    const projectedValues = chartData.filter((d) => d.projected !== null).map((d) => d.projected!);
    const allValues = [...historicalValues, ...projectedValues];

    const currentBalance = 620000;
    const lowestProjected = projectedValues.length > 0 ? Math.min(...projectedValues) : currentBalance;
    const highestHistorical = historicalValues.length > 0 ? Math.max(...historicalValues) : currentBalance;
    const trend = projectedValues.length >= 2
      ? projectedValues[projectedValues.length - 1] - projectedValues[0]
      : 0;

    const daysBelow = projectedValues.filter((v) => v < payrollThreshold).length;

    return { currentBalance, lowestProjected, highestHistorical, trend, daysBelow, min: Math.min(...allValues), max: Math.max(...allValues) };
  }, [chartData, payrollThreshold]);

  // Find the "Today" index for reference line
  const todayIndex = chartData.findIndex((d) => d.isToday);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const balVal = payload.find((p: any) => p.dataKey === "balance")?.value;
    const projVal = payload.find((p: any) => p.dataKey === "projected")?.value;
    const val = balVal ?? projVal;
    if (val == null) return null;
    const isProjected = balVal == null;

    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-xl">
        <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-foreground">
          {formatCurrency(val)}
        </p>
        {isProjected && (
          <p className="mt-0.5 text-[9px] text-muted-foreground italic">AI projected</p>
        )}
        {val < payrollThreshold && (
          <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-float-red">
            <TrendingDown size={10} /> Below payroll threshold
          </p>
        )}
      </div>
    );
  };

  // Custom dot that shows "Today" marker
  const TodayDot = (props: any) => {
    const { cx, cy, index } = props;
    if (index !== todayIndex || !cx || !cy) return null;
    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill="hsl(var(--primary))" opacity={0.2} />
        <circle cx={cx} cy={cy} r={3.5} fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth={2} />
      </g>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">Cashflow Forecast</CardTitle>
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            <Sparkles size={10} /> AI-powered
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-accent/50 p-0.5">
          {(["14d", "30d", "60d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
                range === r
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r === "14d" ? "2W" : r === "30d" ? "1M" : "2M"}
            </button>
          ))}
        </div>
      </CardHeader>

      {/* Summary stats */}
      {hasData && (
        <div className="flex gap-4 px-6 pb-2">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-[10px] text-muted-foreground">Balance</span>
            <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
              {formatCurrency(stats.currentBalance)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingDown size={11} className="text-float-red" />
            <span className="text-[10px] text-muted-foreground">Lowest</span>
            <span className="font-mono text-xs font-semibold tabular-nums text-float-red">
              {formatCurrency(stats.lowestProjected)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp size={11} className="text-float-green" />
            <span className="text-[10px] text-muted-foreground">Peak</span>
            <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
              {formatCurrency(stats.highestHistorical)}
            </span>
          </div>
          {stats.daysBelow > 0 && (
            <div className="flex items-center gap-1.5">
              <Calendar size={11} className="text-float-amber" />
              <span className="text-[10px] font-medium text-float-amber">
                {stats.daysBelow} day{stats.daysBelow !== 1 ? "s" : ""} below payroll
              </span>
            </div>
          )}
        </div>
      )}

      <CardContent className="pt-1">
        {!hasData ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
            <Sparkles size={24} className="text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No projection data</p>
            <p className="text-xs text-muted-foreground">Load demo data or connect Monzo to see your forecast</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -4, bottom: 4 }}>
              <defs>
                <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                  <stop offset="80%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="projectedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--float-amber))" stopOpacity={0.12} />
                  <stop offset="80%" stopColor="hsl(var(--float-amber))" stopOpacity={0.02} />
                  <stop offset="100%" stopColor="hsl(var(--float-amber))" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
                opacity={0.5}
              />

              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                tickMargin={8}
              />
              <YAxis
                tickFormatter={(v: number) => {
                  const k = v / 100;
                  if (k >= 10000) return `€${(k / 1000).toFixed(0)}k`;
                  if (k >= 1000) return `€${(k / 1000).toFixed(1)}k`;
                  return `€${k.toFixed(0)}`;
                }}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={50}
                tickMargin={4}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />

              {/* Danger zone below payroll threshold */}
              <ReferenceArea
                y1={stats.min < 0 ? stats.min : 0}
                y2={payrollThreshold}
                fill="hsl(var(--float-red))"
                fillOpacity={0.03}
              />

              {/* Payroll threshold line */}
              <ReferenceLine
                y={payrollThreshold}
                stroke="hsl(var(--float-amber))"
                strokeDasharray="8 4"
                strokeOpacity={0.5}
                strokeWidth={1.5}
                label={{
                  value: `Payroll ${formatCurrency(payrollThreshold)}`,
                  position: "right",
                  fill: "hsl(var(--float-amber))",
                  fontSize: 9,
                  fontWeight: 600,
                }}
              />

              {/* "Today" vertical line */}
              <ReferenceLine
                x="Today"
                stroke="hsl(var(--primary))"
                strokeDasharray="4 4"
                strokeOpacity={0.4}
                label={{
                  value: "Today",
                  position: "top",
                  fill: "hsl(var(--primary))",
                  fontSize: 9,
                  fontWeight: 600,
                }}
              />

              {/* Historical balance */}
              <Area
                type="monotone"
                dataKey="balance"
                stroke="hsl(var(--primary))"
                fill="url(#balanceGrad)"
                strokeWidth={2.5}
                isAnimationActive
                animationDuration={1500}
                animationEasing="ease-out"
                connectNulls={false}
                dot={<TodayDot />}
                activeDot={{ r: 5, strokeWidth: 2.5, fill: "hsl(var(--card))", stroke: "hsl(var(--primary))" }}
              />

              {/* Projected balance */}
              <Area
                type="monotone"
                dataKey="projected"
                stroke="hsl(var(--float-amber))"
                fill="url(#projectedGrad)"
                strokeWidth={2}
                strokeDasharray="8 4"
                isAnimationActive
                animationDuration={1500}
                animationEasing="ease-out"
                connectNulls={false}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2.5, fill: "hsl(var(--card))", stroke: "hsl(var(--float-amber))" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {/* Legend */}
        {hasData && (
          <div className="flex items-center justify-center gap-6 pt-2 pb-1">
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 rounded-full bg-primary" />
              <span className="text-[10px] text-muted-foreground">Actual</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 rounded-full bg-float-amber" style={{ backgroundImage: "repeating-linear-gradient(90deg, hsl(var(--float-amber)) 0 4px, transparent 4px 8px)" }} />
              <span className="text-[10px] text-muted-foreground">Projected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 rounded-full bg-float-amber/50" style={{ backgroundImage: "repeating-linear-gradient(90deg, hsl(var(--float-amber)) 0 4px, transparent 4px 8px)" }} />
              <span className="text-[10px] text-muted-foreground">Payroll threshold</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-4 rounded-sm bg-float-red/[0.06]" />
              <span className="text-[10px] text-muted-foreground">Danger zone</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
