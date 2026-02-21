import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
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
  const runwayDays = atRisk ? 9 : 47;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Balance */}
      <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="p-5 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Current Balance</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground">{formatCurrency(balance)}</p>
          <p className="text-xs text-float-red font-mono">↓ 2.1% vs yesterday</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-float-monzo" />
            <span className="text-[10px] text-muted-foreground">Live from Monzo</span>
          </div>
        </CardContent>
      </Card>

      {/* Payroll Coverage */}
      <Card className={`transition-all hover:-translate-y-0.5 hover:shadow-md ${atRisk ? "border-float-red/30 bg-float-red/[0.03]" : ""}`}>
        <CardContent className="p-5 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Payroll Coverage</p>
          {atRisk ? (
            <>
              <span className="inline-flex items-center rounded-full bg-float-red/10 px-2 py-0.5 text-xs font-bold text-float-red">🔴 AT RISK</span>
              <p className="text-lg font-mono font-bold text-float-red tabular-nums">−{formatCurrency(shortfall)} shortfall</p>
            </>
          ) : (
            <>
              <span className="inline-flex items-center rounded-full bg-float-green/10 px-2 py-0.5 text-xs font-bold text-float-green">✓ Covered</span>
              <p className="text-lg font-mono font-bold text-float-green tabular-nums">+{formatCurrency(balance - payroll)} above</p>
            </>
          )}
          <p className="text-[10px] text-muted-foreground">Next payroll: {formatCurrency(payroll)} · Friday Feb 27</p>
        </CardContent>
      </Card>

      {/* Outstanding Invoices */}
      <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="p-5 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Outstanding Invoices</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground">{formatCurrency(totalOutstanding)}</p>
          <p className="text-xs text-muted-foreground">
            {invoices.filter((i) => i.status !== "paid").length} invoices
            {overdueCount > 0 && (
              <span className="ml-1 inline-flex items-center rounded-full bg-float-red/10 px-1.5 py-0.5 text-[10px] font-bold text-float-red">
                {overdueCount} overdue
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Runway */}
      <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="p-5 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Runway</p>
          <p className={`text-2xl font-bold font-mono tabular-nums ${runwayDays < 14 ? "text-float-red" : runwayDays < 30 ? "text-float-amber" : "text-float-green"}`}>
            {runwayDays} days
          </p>
          <Progress
            value={Math.min(100, (runwayDays / 60) * 100)}
            className="h-1.5 mt-2"
          />
          <p className="text-[10px] text-muted-foreground">Based on AI's 30-day analysis</p>
        </CardContent>
      </Card>
    </div>
  );
}
