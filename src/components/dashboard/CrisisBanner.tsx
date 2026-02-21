import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  if (account.risk_level === "healthy" || (!account.payroll_at_risk && account.risk_level !== "warning")) {
    return (
      <div className="flex items-center rounded-xl border border-float-green/20 bg-float-green/5 px-5 py-3">
        <span className="text-sm text-float-green font-medium">✓ Cashflow healthy — 47 days of runway. Payroll covered. No action needed.</span>
      </div>
    );
  }

  if (account.risk_level === "warning") {
    return (
      <div className="flex items-center justify-between rounded-xl border border-float-amber/20 bg-float-amber/5 px-5 py-3">
        <span className="text-sm text-float-amber font-medium">⚠ Warning — cashflow pressure detected this week.</span>
        <Button variant="ghost" size="sm" className="text-float-amber">View Invoices →</Button>
      </div>
    );
  }

  // Critical state
  return (
    <div className="rounded-xl border border-float-red/20 bg-float-red/5 p-6 space-y-4">
      <div className="flex items-center gap-2 text-float-red">
        <AlertTriangle size={20} />
        <span className="font-bold text-lg">PAYROLL AT RISK</span>
      </div>
      <p className="text-sm text-foreground">
        Next payroll: <span className="font-mono font-semibold">€8,400</span> · Friday Feb 27 · Shortfall: <span className="font-mono font-semibold text-float-red">€2,200</span>
      </p>
      <div className="text-center">
        <span className="font-mono text-4xl font-bold text-foreground tracking-wider">{countdown}</span>
      </div>
      <Button
        onClick={onFixIt}
        size="lg"
        className="w-full rounded-full bg-float-red-deep hover:bg-float-red text-primary-foreground font-bold text-base animate-pulse-red"
      >
        Fix It Now — Declare Mayday
      </Button>
    </div>
  );
}
