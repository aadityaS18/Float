import { useState, useMemo, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, ReferenceArea,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { format, subDays } from "date-fns";
import { Sparkles, TrendingDown, TrendingUp, Calendar, ArrowRight } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Projection = Tables<"cashflow_projections">;

interface CashflowChartProps {
  projections: Projection[];
  payrollThreshold: number;
}

type Range = "14d" | "30d" | "60d";

export function CashflowChart({ projections, payrollThreshold }: CashflowChartProps) {
  const [range, setRange] = useState<Range>("30d");
  const [animate, setAnimate] = useState(false);
  const today = new Date("2026-02-21");

  // Trigger animation on mount / range change
  useEffect(() => {
    setAnimate(false);
    const t = setTimeout(() => setAnimate(true), 50);
    return () => clearTimeout(t);
  }, [range]);

  const chartData = useMemo(() => {
    const histDays = range === "14d" ? 14 : range === "60d" ? 60 : 30;
    const data: { date: string; rawDate: Date; balance: number | null; projected: number | null; isToday?: boolean }[] = [];

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

    data.push({ date: "Today", rawDate: today, balance: 620000, projected: 620000, isToday: true });

    projections.forEach((p) => {
      const d = new Date(p.projection_date);
      if (d <= today) return;
      data.push({ date: format(d, "MMM d"), rawDate: d, balance: null, projected: p.projected_balance });
    });

    return data;
  }, [projections, range]);

  const hasData = chartData.length > 1;

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

  const todayIndex = chartData.findIndex((d) => d.isToday);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const balVal = payload.find((p: any) => p.dataKey === "balance")?.value;
    const projVal = payload.find((p: any) => p.dataKey === "projected")?.value;
    const val = balVal ?? projVal;
    if (val == null) return null;
    const isProjected = balVal == null;

    return (
      <div className="rounded-xl border border-border bg-card/95 backdrop-blur-sm px-4 py-3 shadow-2xl">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">
          {formatCurrency(val)}
        </p>
        {isProjected && (
          <p className="mt-0.5 flex items-center gap-1 text-[9px] text-primary font-medium">
            <Sparkles size={8} /> AI projected
          </p>
        )}
        {val < payrollThreshold && (
          <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-float-red">
            <TrendingDown size={10} /> Below payroll threshold
          </p>
        )}
      </div>
    );
  };

  const TodayDot = (props: any) => {
    const { cx, cy, index } = props;
    if (index !== todayIndex || !cx || !cy) return null;
    return (
      <g>
        <circle cx={cx} cy={cy} r={10} fill="hsl(var(--primary))" opacity={0.08}>
          <animate attributeName="r" values="8;12;8" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.1;0.04;0.1" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <circle cx={cx} cy={cy} r={5} fill="hsl(var(--primary))" opacity={0.15} />
        <circle cx={cx} cy={cy} r={3.5} fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth={2.5} />
      </g>
    );
  };

  // Custom cursor
  const CustomCursor = ({ points, height }: any) => {
    if (!points?.[0]) return null;
    return (
      <line
        x1={points[0].x}
        y1={0}
        x2={points[0].x}
        y2={height}
        stroke="hsl(var(--foreground))"
        strokeWidth={1}
        strokeOpacity={0.1}
        strokeDasharray="4 2"
      />
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
            <TrendingUp size={13} className="text-primary" />
          </div>
          <CardTitle className="text-sm font-semibold">Cashflow Forecast</CardTitle>
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
            <Sparkles size={10} /> AI-powered
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-accent/50 p-0.5">
          {(["14d", "30d", "60d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-all duration-200 ${
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
        <div className="flex gap-3 px-6 pb-3">
          <StatPill
            color="primary"
            label="Balance"
            value={formatCurrency(stats.currentBalance)}
            dot
          />
          <StatPill
            color="float-red"
            label="Lowest"
            value={formatCurrency(stats.lowestProjected)}
            icon={<TrendingDown size={10} />}
          />
          <StatPill
            color="float-green"
            label="Peak"
            value={formatCurrency(stats.highestHistorical)}
            icon={<TrendingUp size={10} />}
          />
          {stats.daysBelow > 0 && (
            <StatPill
              color="float-amber"
              label={`${stats.daysBelow}d below payroll`}
              icon={<Calendar size={10} />}
              warning
            />
          )}
        </div>
      )}

      <CardContent className="pt-0">
        {!hasData ? (
          <div className="flex h-72 flex-col items-center justify-center gap-2 text-center">
            <Sparkles size={24} className="text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No projection data</p>
            <p className="text-xs text-muted-foreground">Load demo data or connect Monzo to see your forecast</p>
          </div>
        ) : (
          <div className={`transition-opacity duration-700 ${animate ? "opacity-100" : "opacity-0"}`}>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ top: 16, right: 16, left: -4, bottom: 4 }}>
                <defs>
                  <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="40%" stopColor="hsl(var(--primary))" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="projectedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--float-amber))" stopOpacity={0.15} />
                    <stop offset="40%" stopColor="hsl(var(--float-amber))" stopOpacity={0.06} />
                    <stop offset="100%" stopColor="hsl(var(--float-amber))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dangerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--float-red))" stopOpacity={0.06} />
                    <stop offset="100%" stopColor="hsl(var(--float-red))" stopOpacity={0.01} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                  opacity={0.4}
                />

                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tickMargin={10}
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
                  width={52}
                  tickMargin={4}
                />
                <Tooltip content={<CustomTooltip />} cursor={<CustomCursor />} />

                {/* Danger zone below payroll threshold */}
                <ReferenceArea
                  y1={stats.min < 0 ? stats.min : 0}
                  y2={payrollThreshold}
                  fill="url(#dangerGrad)"
                />

                {/* Payroll threshold line */}
                <ReferenceLine
                  y={payrollThreshold}
                  stroke="hsl(var(--float-amber))"
                  strokeDasharray="6 4"
                  strokeOpacity={0.6}
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
                  strokeDasharray="4 3"
                  strokeOpacity={0.3}
                  label={{
                    value: "Today",
                    position: "top",
                    fill: "hsl(var(--primary))",
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                />

                {/* Historical balance */}
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="hsl(var(--primary))"
                  fill="url(#balanceGrad)"
                  strokeWidth={2.5}
                  isAnimationActive={animate}
                  animationDuration={2000}
                  animationEasing="ease-out"
                  animationBegin={0}
                  connectNulls={false}
                  dot={<TodayDot />}
                  activeDot={{
                    r: 5,
                    strokeWidth: 2.5,
                    fill: "hsl(var(--card))",
                    stroke: "hsl(var(--primary))",
                  }}
                />

                {/* Projected balance */}
                <Area
                  type="monotone"
                  dataKey="projected"
                  stroke="hsl(var(--float-amber))"
                  fill="url(#projectedGrad)"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  isAnimationActive={animate}
                  animationDuration={2000}
                  animationEasing="ease-out"
                  animationBegin={800}
                  connectNulls={false}
                  dot={false}
                  activeDot={{
                    r: 5,
                    strokeWidth: 2.5,
                    fill: "hsl(var(--card))",
                    stroke: "hsl(var(--float-amber))",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Legend */}
        {hasData && (
          <div className="flex items-center justify-center gap-5 pt-1 pb-1">
            <LegendItem color="bg-primary" label="Actual" />
            <LegendItem color="bg-float-amber" label="Projected" dashed />
            <LegendItem color="bg-float-amber/50" label="Payroll threshold" dashed />
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-4 rounded-sm bg-float-red/[0.06] border border-float-red/10" />
              <span className="text-[10px] text-muted-foreground">Danger zone</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function StatPill({ color, label, value, icon, dot, warning }: {
  color: string;
  label: string;
  value?: string;
  icon?: React.ReactNode;
  dot?: boolean;
  warning?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-all ${
      warning ? `border-${color}/20 bg-${color}/[0.03]` : "border-border bg-card"
    }`}>
      {dot && <div className={`h-2 w-2 rounded-full bg-${color}`} />}
      {icon && <span className={`text-${color}`}>{icon}</span>}
      <span className="text-[10px] text-muted-foreground">{label}</span>
      {value && (
        <span className={`font-mono text-xs font-semibold tabular-nums ${
          color === "float-red" ? "text-float-red" : "text-foreground"
        }`}>
          {value}
        </span>
      )}
    </div>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`h-0.5 w-5 rounded-full ${color}`}
        style={dashed ? { backgroundImage: `repeating-linear-gradient(90deg, currentColor 0 4px, transparent 4px 8px)` } : undefined}
      />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
