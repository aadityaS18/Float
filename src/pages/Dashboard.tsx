import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/useAccount";
import { TopBar } from "@/components/TopBar";
import { CrisisBanner } from "@/components/dashboard/CrisisBanner";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { CashflowChart } from "@/components/dashboard/CashflowChart";
import { InvoiceTable } from "@/components/dashboard/InvoiceTable";
import { AiInsightsPanel } from "@/components/dashboard/AiInsightsPanel";
import { BenchmarkPanel } from "@/components/dashboard/BenchmarkPanel";
import { FixItModal } from "@/components/dashboard/FixItModal";
import type { Tables } from "@/integrations/supabase/types";

type Invoice = Tables<"invoices">;
type Insight = Tables<"ai_insights">;
type Projection = Tables<"cashflow_projections">;
type Incident = Tables<"incidents">;

export default function DashboardPage() {
  const { account } = useAccount();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [projections, setProjections] = useState<Projection[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [showFixIt, setShowFixIt] = useState(false);

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

  const openIncident = incidents.find((i) => i.status === "open" && i.severity === "P1");

  return (
    <>
      <TopBar title="Dashboard" subtitle={account?.business_name ?? undefined} insightCount={insights.length} />

      <div className="space-y-8 p-5 lg:px-8 lg:py-6">

        {/* Crisis Banner */}
        {account?.payroll_at_risk && (
          <section className="animate-fade-in-up">
            <CrisisBanner account={account} onFixIt={() => setShowFixIt(true)} />
          </section>
        )}

        {/* KPI Cards */}
        <section className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <SectionHeader title="Overview" />
          <KpiCards account={account} invoices={invoices} />
        </section>

        {/* Cashflow Chart */}
        <section className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <SectionHeader title="Cashflow Forecast" />
          <CashflowChart projections={projections} payrollThreshold={account?.payroll_amount ?? 840000} />
        </section>

        {/* Invoices + Insights */}
        <section className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
          <SectionHeader title="Receivables & Insights" />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <InvoiceTable
                invoices={invoices}
                onChase={() => setShowFixIt(true)}
                payrollAtRisk={account?.payroll_at_risk ?? false}
              />
            </div>
            <div className="lg:col-span-2">
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
            </div>
          </div>
        </section>

        {/* Benchmarks */}
        <section className="animate-fade-in-up" style={{ animationDelay: "400ms" }}>
          <SectionHeader title="Performance" />
          <BenchmarkPanel />
        </section>
      </div>

      {showFixIt && openIncident && (
        <FixItModal incident={openIncident} onClose={() => setShowFixIt(false)} />
      )}
    </>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="h-1 w-1 rounded-full bg-primary" />
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="h-px flex-1 bg-border/50" />
    </div>
  );
}
