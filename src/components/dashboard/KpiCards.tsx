import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { TrendingDown, TrendingUp, Wallet, ShieldCheck, ShieldAlert, FileText, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
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
      change: { value: "2.1%", negative: true },
      badge: (
        <span className="flex items-center gap-1 rounded-full bg-float-monzo/10 px-2 py-0.5 text-[9px] font-semibold text-float-monzo">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-float-monzo" /> Monzo Live
        </span>
      ),
      accentColor: "primary",
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
      accentColor: atRisk ? "float-red" : "float-green",
      danger: atRisk,
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
      accentColor: overdueCount > 0 ? "float-amber" : "primary",
    },
    {
      label: "Runway",
      icon: Activity,
      value: `${runwayDays} days`,
      valueColor: runwayDays < 14 ? "text-float-red" : runwayDays < 30 ? "text-float-amber" : "text-float-green",
      sub: (
        <div className="space-y-1.5">
          <Progress
            value={Math.min(100, (runwayDays / 60) * 100)}
            className="h-1.5"
          />
          <span className="text-[10px] text-muted-foreground">Based on 30-day AI projection</span>
        </div>
      ),
      accentColor: runwayDays < 14 ? "float-red" : runwayDays < 30 ? "float-amber" : "float-green",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const IconComp = card.icon;
        return (
          <Card
            key={card.label}
            className={`group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
              card.danger
                ? "border-float-red/25 shadow-[0_0_24px_-8px_hsl(var(--float-red)/0.12)]"
                : "hover:shadow-primary/[0.06]"
            }`}
          >
            {/* Top accent */}
            <div className={`absolute inset-x-0 top-0 h-[3px] bg-${card.accentColor} transition-all duration-300 group-hover:h-1`} />

            <CardContent className="p-5 pt-6">
              <div className="flex items-start justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{card.label}</p>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 ${
                  card.danger
                    ? "bg-float-red/10 text-float-red"
                    : "bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                }`}>
                  <IconComp size={16} strokeWidth={2} />
                </div>
              </div>

              <p className={`mt-3 font-mono text-[1.65rem] font-bold tabular-nums leading-none ${(card as any).valueColor ?? "text-foreground"}`}>
                {card.value}
              </p>

              <div className="mt-3">
                {card.change && (
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-0.5 text-xs font-medium ${
                      card.change.negative ? "text-float-red" : "text-float-green"
                    }`}>
                      {card.change.negative ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                      {card.change.value}
                    </span>
                    {card.badge}
                  </div>
                )}
                {card.sub}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
