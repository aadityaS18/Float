import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { format, subDays, addDays } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import { Sparkles } from "lucide-react";

type Projection = Tables<"cashflow_projections">;

interface CashflowChartProps {
  projections: Projection[];
  payrollThreshold: number;
}

export function CashflowChart({ projections, payrollThreshold }: CashflowChartProps) {
  const today = new Date("2026-02-21");

  // Build chart data: 30 days historical + projections
  const chartData: { date: string; balance: number | null; projected: number | null; label?: string }[] = [];

  // Historical mock (simplified declining balance)
  let histBalance = 980000;
  for (let i = 30; i >= 1; i--) {
    const d = subDays(today, i);
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 5 || dayOfWeek === 6) histBalance += 120000;
    else histBalance -= 40000;
    if (d.getDate() === 1) histBalance -= 320000;
    chartData.push({
      date: format(d, "MMM d"),
      balance: histBalance,
      projected: null,
    });
  }

  // Today
  chartData.push({ date: "Today", balance: 620000, projected: 620000 });

  // Future projections
  projections.forEach((p) => {
    const d = new Date(p.projection_date);
    if (d <= today) return;
    chartData.push({
      date: format(d, "MMM d"),
      balance: null,
      projected: p.projected_balance,
      label: format(d, "yyyy-MM-dd") === "2026-02-27" ? "Payroll" : undefined,
    });
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const val = payload[0]?.value ?? payload[1]?.value;
    return (
      <div className="rounded-lg border border-border bg-card p-2 shadow-lg">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono font-semibold text-sm text-foreground">{formatCurrency(val)}</p>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Cashflow Forecast</CardTitle>
        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <Sparkles size={12} /> Powered by AI
        </span>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `€${(v / 100000).toFixed(0)}k`}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={payrollThreshold}
              stroke="hsl(var(--float-amber))"
              strokeDasharray="6 4"
              label={{ value: `Payroll: ${formatCurrency(payrollThreshold)}`, position: "right", fontSize: 10, fill: "hsl(var(--float-amber))" }}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.08}
              strokeWidth={2}
              isAnimationActive
              animationDuration={1500}
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey="projected"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--float-red))"
              fillOpacity={0.06}
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeOpacity={0.7}
              isAnimationActive
              animationDuration={1500}
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
