import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { format, subDays } from "date-fns";
import { Sparkles } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Projection = Tables<"cashflow_projections">;

interface CashflowChartProps {
  projections: Projection[];
  payrollThreshold: number;
}

export function CashflowChart({ projections, payrollThreshold }: CashflowChartProps) {
  const today = new Date("2026-02-21");

  const chartData: { date: string; balance: number | null; projected: number | null }[] = [];

  // Historical mock
  let histBalance = 980000;
  for (let i = 30; i >= 1; i--) {
    const d = subDays(today, i);
    const dow = d.getDay();
    if (dow === 5 || dow === 6) histBalance += 120000;
    else histBalance -= 40000;
    if (d.getDate() === 1) histBalance -= 320000;
    chartData.push({ date: format(d, "MMM d"), balance: histBalance, projected: null });
  }

  // Today
  chartData.push({ date: "Today", balance: 620000, projected: 620000 });

  // Projections
  projections.forEach((p) => {
    const d = new Date(p.projection_date);
    if (d <= today) return;
    chartData.push({ date: format(d, "MMM d"), balance: null, projected: p.projected_balance });
  });

  const hasData = chartData.length > 1;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const val = payload[0]?.value ?? payload[1]?.value;
    if (val == null) return null;
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
        <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
        <p className="font-mono text-sm font-semibold text-foreground">{formatCurrency(val)}</p>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-sm font-semibold">Cashflow Forecast</CardTitle>
        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          <Sparkles size={10} /> AI-powered
        </span>
      </CardHeader>
      <CardContent className="pt-2">
        {!hasData ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No projection data — load demo data or connect Monzo to see your forecast
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="projectedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--float-red))" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="hsl(var(--float-red))" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v: number) => `€${(v / 100000).toFixed(0)}k`}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={45}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={payrollThreshold}
                stroke="hsl(var(--float-amber))"
                strokeDasharray="6 4"
                strokeOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="hsl(var(--primary))"
                fill="url(#balanceGrad)"
                strokeWidth={2}
                isAnimationActive
                animationDuration={1200}
                connectNulls={false}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--card))" }}
              />
              <Area
                type="monotone"
                dataKey="projected"
                stroke="hsl(var(--primary))"
                fill="url(#projectedGrad)"
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeOpacity={0.6}
                isAnimationActive
                animationDuration={1200}
                connectNulls={false}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--card))" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
