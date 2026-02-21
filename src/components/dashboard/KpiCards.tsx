import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { TrendingDown, TrendingUp, Wallet, ShieldCheck, ShieldAlert, FileText, Activity } from "lucide-react";
import type { Account } from "@/hooks/useAccount";
import type { Tables } from "@/integrations/supabase/types";

type Invoice = Tables<"invoices">;

interface KpiCardsProps {
  account: Account | null;
  invoices: Invoice[];
}

export function KpiCards({ account, invoices }: KpiCardsProps) {
  const balance = 620000;
  const payroll = account?.payroll_amount ?? 840000;
  const atRisk = account?.payroll_at_risk ?? false;
  const shortfall = payroll - balance;
  const totalOutstanding = invoices
    .filter((i) => i.status !== "paid")
    .reduce((sum, i) => sum + i.amount, 0);
  const overdueCount = invoices.filter((i) => i.status === "overdue").length;
  const unpaidCount = invoices.filter((i) => i.status !== "paid").length;
  const runwayDays = atRisk ? 9 : 47;

  const cards = [
    {
      label: "Current Balance",
      icon: Wallet,
      value: formatCurrency(balance),
      sub: (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-0.5 text-xs text-float-red">
            <TrendingDown size={12} /> 2.1%
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-float-monzo" /> Live
          </span>
        </div>
      ),
      accent: false,
    },
    {
      label: "Payroll Coverage",
      icon: atRisk ? ShieldAlert : ShieldCheck,
      value: atRisk ? `−${formatCurrency(shortfall)}` : `+${formatCurrency(balance - payroll)}`,
      sub: (
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            atRisk ? "bg-float-red/10 text-float-red" : "bg-float-green/10 text-float-green"
          }`}>
            {atRisk ? "At Risk" : "Covered"}
          </span>
          <span className="text-[10px] text-muted-foreground">Due Fri Feb 27</span>
        </div>
      ),
      accent: atRisk,
    },
    {
      label: "Outstanding Invoices",
      icon: FileText,
      value: formatCurrency(totalOutstanding),
      sub: (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{unpaidCount} invoice{unpaidCount !== 1 ? "s" : ""}</span>
          {overdueCount > 0 && (
            <span className="rounded-full bg-float-red/10 px-1.5 py-0.5 text-[10px] font-semibold text-float-red">
              {overdueCount} overdue
            </span>
          )}
        </div>
      ),
      accent: false,
    },
    {
      label: "Runway",
      icon: Activity,
      value: `${runwayDays} days`,
      valueColor: runwayDays < 14 ? "text-float-red" : runwayDays < 30 ? "text-float-amber" : "text-float-green",
      sub: (
        <div className="space-y-1.5">
          <Progress value={Math.min(100, (runwayDays / 60) * 100)} className="h-1.5" />
          <span className="text-[10px] text-muted-foreground">Based on 30-day AI projection</span>
        </div>
      ),
      accent: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card
          key={card.label}
          className={`group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            card.accent ? "border-float-red/20 bg-float-red/[0.02]" : ""
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{card.label}</p>
              <card.icon size={15} className={`text-muted-foreground/50 transition-colors group-hover:text-muted-foreground ${card.accent ? "text-float-red/50" : ""}`} />
            </div>
            <p className={`mt-2 font-mono text-xl font-bold tabular-nums ${(card as any).valueColor ?? "text-foreground"}`}>
              {card.value}
            </p>
            <div className="mt-2">{card.sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
