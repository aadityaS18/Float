import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus, BarChart3 } from "lucide-react";

const benchmarks = [
  { metric: "Invoice Payment Time", you: "34 days", avg: "22 days", gap: "+12 days", status: "red" as const },
  { metric: "Recurring Cost Ratio", you: "67%", avg: "58%", gap: "+9%", status: "amber" as const },
  { metric: "Cash Reserve", you: "11 days", avg: "18 days", gap: "-7 days", status: "red" as const },
  { metric: "Revenue Consistency", you: "72/100", avg: "68/100", gap: "+4 pts", status: "green" as const },
  { metric: "Outstanding Invoice Ratio", you: "18%", avg: "12%", gap: "+6%", status: "amber" as const },
  { metric: "Payroll to Revenue", you: "29%", avg: "31%", gap: "-2%", status: "green" as const },
];

const statusStyle = {
  red: { bg: "bg-float-red/10", text: "text-float-red", border: "border-float-red/10", icon: ArrowDown },
  amber: { bg: "bg-float-amber/10", text: "text-float-amber", border: "border-float-amber/10", icon: Minus },
  green: { bg: "bg-float-green/10", text: "text-float-green", border: "border-float-green/10", icon: ArrowUp },
};

export function BenchmarkPanel() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
            <BarChart3 size={13} className="text-muted-foreground" />
          </div>
          <CardTitle className="text-sm font-semibold">Industry Benchmarks</CardTitle>
        </div>
        <Badge variant="secondary" className="text-[10px] font-normal">Dublin Restaurants · 6–15 Employees</Badge>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {benchmarks.map((b) => {
            const s = statusStyle[b.status];
            const Icon = s.icon;
            return (
              <div
                key={b.metric}
                className={`group/bench relative overflow-hidden rounded-xl border p-4 transition-all duration-200 hover:shadow-sm ${s.border}`}
              >
                {/* Subtle status indicator bar */}
                <div className={`absolute inset-y-0 left-0 w-[3px] ${s.bg}`} />
                
                <div className="flex items-start justify-between">
                  <div className="min-w-0 pl-1">
                    <p className="text-[11px] text-muted-foreground leading-tight">{b.metric}</p>
                    <p className="mt-2 font-mono text-lg font-bold tabular-nums text-foreground leading-none">{b.you}</p>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      Industry avg: <span className="font-medium text-foreground/70">{b.avg}</span>
                    </p>
                  </div>
                  <span className={`flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${s.bg} ${s.text}`}>
                    <Icon size={10} /> {b.gap}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[10px] text-muted-foreground/70">
          Benchmarks from anonymised aggregate data across similar businesses in your sector.
        </p>
      </CardContent>
    </Card>
  );
}
