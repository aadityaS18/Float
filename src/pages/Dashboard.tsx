import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/useAccount";
import { TopBar } from "@/components/TopBar";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { CashflowChart } from "@/components/dashboard/CashflowChart";
import { InvoiceTable } from "@/components/dashboard/InvoiceTable";
import { AiInsightsPanel } from "@/components/dashboard/AiInsightsPanel";
import { BenchmarkPanel } from "@/components/dashboard/BenchmarkPanel";
import { FixItModal } from "@/components/dashboard/FixItModal";
import { WeeklyDigestCard } from "@/components/dashboard/WeeklyDigestCard";
import { SmartChasePanel } from "@/components/dashboard/SmartChasePanel";
import { Button } from "@/components/ui/button";
import { Scan, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

type Invoice = Tables<"invoices">;
type Insight = Tables<"ai_insights">;
type Projection = Tables<"cashflow_projections">;
type Incident = Tables<"incidents">;

const ANOMALY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-anomalies`;

export default function DashboardPage() {
  const { account } = useAccount();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [projections, setProjections] = useState<Projection[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [showFixIt, setShowFixIt] = useState(false);
  const [scanningAnomalies, setScanningAnomalies] = useState(false);

  useEffect(() => {
    if (!account) return;
    const fetchAll = async () => {
      const [inv, ins, proj, inc] = await Promise.all([
        supabase.from("invoices").select("*").eq("account_id", account.id),
        supabase.from("ai_insights").select("*").eq("account_id", account.id).eq("dismissed", false),
        supabase.from("cashflow_projections").select("*").eq("account_id", account.id).order("projection_date"),
        supabase.from("incidents").select("*").eq("account_id", account.id),
      ]);
      if (inv.data) setInvoices(inv.data);
      if (ins.data) setInsights(ins.data);
      if (proj.data) setProjections(proj.data);
      if (inc.data) setIncidents(inc.data);
    };
    fetchAll();

    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices", filter: `account_id=eq.${account.id}` }, (payload) => {
        if (payload.eventType === "UPDATE") {
          setInvoices((prev) => prev.map((i) => (i.id === (payload.new as Invoice).id ? payload.new as Invoice : i)));
        } else if (payload.eventType === "INSERT") {
          setInvoices((prev) => [payload.new as Invoice, ...prev]);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_insights", filter: `account_id=eq.${account.id}` }, () => {
        supabase.from("ai_insights").select("*").eq("account_id", account.id).eq("dismissed", false).then(({ data }) => {
          if (data) setInsights(data);
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents", filter: `account_id=eq.${account.id}` }, () => {
        supabase.from("incidents").select("*").eq("account_id", account.id).then(({ data }) => {
          if (data) setIncidents(data);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [account]);

  const runAnomalyScan = useCallback(async () => {
    if (!account) return;
    setScanningAnomalies(true);
    try {
      const resp = await fetch(ANOMALY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ account_id: account.id }),
      });
      if (!resp.ok) throw new Error("Scan failed");
      const data = await resp.json();
      if (data.insights?.length > 0) {
        toast({ title: "Anomalies detected", description: `Found ${data.insights.length} anomalies in your transactions` });
      } else {
        toast({ title: "All clear", description: "No anomalies detected in recent transactions" });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Scan Error", description: e.message });
    } finally {
      setScanningAnomalies(false);
    }
  }, [account, toast]);

  const handleChaseInvoice = (inv: Invoice) => {
    if (!inv.client_phone) {
      toast({ variant: "destructive", title: "No phone number", description: "Add a phone number first" });
      return;
    }
    navigate("/calls", { state: { autoCallInvoice: inv } });
  };

  const openIncident = incidents.find((i) => i.status === "open" && i.severity === "P1");

  return (
    <>
      <TopBar title="Dashboard" subtitle={account?.business_name ?? undefined} insightCount={insights.length} />

      <div className="space-y-6 p-4 lg:p-6">

        {/* KPI Cards */}
        <section className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <KpiCards account={account} invoices={invoices} />
        </section>

        {/* Cashflow Chart */}
        <section className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <CashflowChart projections={projections} payrollThreshold={account?.payroll_amount ?? 840000} />
        </section>

        {/* Invoices + Insights + Smart Chase */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-5 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
          <div className="lg:col-span-3">
            <InvoiceTable
              invoices={invoices}
              onChase={() => setShowFixIt(true)}
              payrollAtRisk={account?.payroll_at_risk ?? false}
            />
          </div>
          <div className="lg:col-span-2 space-y-5">
            <AiInsightsPanel
              insights={insights}
              onDismiss={async (id) => {
                await supabase.from("ai_insights").update({ dismissed: true }).eq("id", id);
                setInsights((prev) => prev.filter((i) => i.id !== id));
              }}
              onAction={(type) => {
                if (type === "fix_it") setShowFixIt(true);
              }}
            />
            {/* Anomaly scan button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={runAnomalyScan}
              disabled={scanningAnomalies}
            >
              {scanningAnomalies ? <Loader2 size={12} className="mr-1.5 animate-spin" /> : <Scan size={12} className="mr-1.5" />}
              {scanningAnomalies ? "Scanning for anomalies…" : "Scan Transactions for Anomalies"}
            </Button>
          </div>
        </section>

        {/* Smart Chase + Weekly Digest */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2 animate-fade-in-up" style={{ animationDelay: "350ms" }}>
          <SmartChasePanel invoices={invoices} onChase={handleChaseInvoice} />
          <WeeklyDigestCard />
        </section>

        {/* Benchmarks */}
        <section className="animate-fade-in-up" style={{ animationDelay: "400ms" }}>
          <BenchmarkPanel />
        </section>
      </div>

      {showFixIt && openIncident && (
        <FixItModal incident={openIncident} onClose={() => setShowFixIt(false)} />
      )}
    </>
  );
}
