import { useEffect, useState } from "react";
import { AlertTriangle, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { Account } from "@/hooks/useAccount";

interface CrisisBannerProps {
  account: Account | null;
  onFixIt: () => void;
}

export function CrisisBanner({ account, onFixIt }: CrisisBannerProps) {
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!account?.payroll_at_risk) return;
    const payrollDate = new Date("2026-02-27T17:00:00Z");
    const timer = setInterval(() => {
      const now = new Date();
      const diff = payrollDate.getTime() - now.getTime();
      if (diff <= 0) { setCountdown("00:00:00"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [account?.payroll_at_risk]);

  if (!account) return null;

  const payroll = account.payroll_amount ?? 840000;
  const balance = 620000;
  const shortfall = payroll - balance;

  // Healthy
  if (account.risk_level === "healthy" || (!account.payroll_at_risk && account.risk_level !== "warning")) {
    return null; // Crisis banner only shows for warning/critical
  }

  // Warning
  if (account.risk_level === "warning") {
    return (
      <div className="flex items-center justify-between rounded-xl border border-float-amber/20 bg-float-amber/[0.04] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-float-amber/10">
            <AlertTriangle size={14} className="text-float-amber" />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground">Cashflow pressure detected</span>
            <p className="text-[11px] text-muted-foreground">Potential shortfall this week — review your outstanding invoices</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-xs font-medium text-float-amber hover:text-float-amber">
          View details →
        </Button>
      </div>
    );
  }

  // Critical
  return (
    <div className="overflow-hidden rounded-2xl border border-float-red/20 bg-gradient-to-br from-float-red/[0.04] via-float-red/[0.02] to-transparent">
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-float-red/10 animate-pulse-red">
              <AlertTriangle size={16} className="text-float-red" />
            </div>
            <div>
              <span className="text-sm font-bold uppercase tracking-wide text-float-red">Payroll at Risk</span>
              <p className="text-[11px] text-muted-foreground">8 employees waiting — action required</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
            <Clock size={12} />
            <span>Friday Feb 27</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <CrisisStatBox label="Payroll Due" value={formatCurrency(payroll)} />
          <CrisisStatBox label="Balance" value={formatCurrency(balance)} />
          <CrisisStatBox label="Shortfall" value={`−${formatCurrency(shortfall)}`} danger />
        </div>

        <div className="mt-6 flex items-center justify-between rounded-xl border border-border/50 bg-card/50 p-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Time remaining</p>
            <p className="mt-1 font-mono text-4xl font-bold tabular-nums tracking-wider text-foreground">{countdown}</p>
          </div>
          <Button
            onClick={onFixIt}
            size="lg"
            className="rounded-xl bg-float-red-deep px-8 font-bold text-primary-foreground shadow-lg transition-all hover:bg-float-red hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] animate-pulse-red"
          >
            <Zap size={16} className="mr-2" />
            Fix It Now
          </Button>
        </div>
      </div>
    </div>
  );
}

function CrisisStatBox({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded-xl p-4 text-center ${danger ? "bg-float-red/[0.05] border border-float-red/10" : "bg-card border border-border"}`}>
      <p className={`text-[10px] font-medium uppercase tracking-wider ${danger ? "text-float-red" : "text-muted-foreground"}`}>{label}</p>
      <p className={`mt-2 font-mono text-xl font-bold tabular-nums leading-none ${danger ? "text-float-red" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
