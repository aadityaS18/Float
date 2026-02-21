import { useState, useEffect, useCallback, useMemo } from "react";
import { Phone, PhoneOff, Clock, CheckCircle2, XCircle, Loader2, PhoneCall, PhoneOutgoing, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TopBar } from "@/components/TopBar";
import { useAccount } from "@/hooks/useAccount";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "react-router-dom";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

type Call = Tables<"calls">;
type Invoice = Tables<"invoices">;

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  completed: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "bg-float-green/10 text-float-green border-float-green/20",
    label: "Completed",
  },
  failed: {
    icon: <XCircle className="h-4 w-4" />,
    color: "bg-float-red/10 text-float-red border-float-red/20",
    label: "Failed",
  },
  initiated: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    color: "bg-float-amber/10 text-float-amber border-float-amber/20",
    label: "Initiated",
  },
  "in-progress": {
    icon: <PhoneCall className="h-4 w-4" />,
    color: "bg-primary/10 text-primary border-primary/20",
    label: "In Progress",
  },
};

export default function CallsPage() {
  const { account } = useAccount();
  const { toast } = useToast();
  const location = useLocation();
  const [calls, setCalls] = useState<Call[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [callingInvoiceId, setCallingInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (!account) return;
    Promise.all([
      supabase.from("calls").select("*").eq("account_id", account.id).order("initiated_at", { ascending: false }),
      supabase.from("invoices").select("*").eq("account_id", account.id).in("status", ["overdue", "chasing", "unpaid"]),
    ]).then(([callsRes, invRes]) => {
      if (callsRes.data) setCalls(callsRes.data);
      if (invRes.data) setInvoices(invRes.data);
      setLoading(false);
    });
  }, [account]);

  useEffect(() => {
    if (!account) return;
    const channel = supabase
      .channel("calls-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "calls", filter: `account_id=eq.${account.id}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          setCalls((p) => [payload.new as Call, ...p]);
        } else if (payload.eventType === "UPDATE") {
          setCalls((p) => p.map((c) => (c.id === (payload.new as Call).id ? (payload.new as Call) : c)));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [account]);

  useEffect(() => {
    const state = location.state as { autoCallInvoice?: Invoice } | null;
    if (state?.autoCallInvoice && account && !loading) {
      startCall(state.autoCallInvoice);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, account, loading]);

  const startCall = useCallback(async (invoice: Invoice) => {
    if (!invoice.client_phone) {
      toast({ variant: "destructive", title: "No phone number", description: "Add a phone number to this client first in the Dashboard" });
      return;
    }
    setCallingInvoiceId(invoice.id);
    try {
      let callId: string | undefined;
      if (account) {
        const { data: callRecord } = await supabase.from("calls").insert({
          account_id: account.id,
          invoice_id: invoice.id,
          client_name: invoice.client_name,
          client_phone: invoice.client_phone,
          status: "initiated",
        }).select().single();
        callId = callRecord?.id;
      }

      const { data, error } = await supabase.functions.invoke("make-call", {
        body: {
          to: invoice.client_phone,
          clientName: invoice.client_name,
          invoiceNumber: invoice.invoice_number,
          invoiceId: invoice.id,
          amount: invoice.amount,
          dueDate: invoice.due_date ? format(new Date(invoice.due_date), "MMMM d, yyyy") : undefined,
          callId,
        },
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || "Failed to initiate call");
      }

      if (callId) {
        await supabase.from("calls").update({ status: "in-progress" }).eq("id", callId);
      }

      toast({
        title: "📞 Call initiated!",
        description: `Calling ${invoice.client_name} at ${invoice.client_phone}.`,
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Call failed", description: err.message });
    } finally {
      setCallingInvoiceId(null);
    }
  }, [toast, account]);

  const overdueInvoices = useMemo(
    () => invoices.filter((i) => i.status === "overdue" && i.client_phone),
    [invoices]
  );

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Stats
  const totalCalls = calls.length;
  const completedCalls = calls.filter((c) => c.status === "completed").length;
  const totalDuration = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
  const avgDuration = completedCalls > 0 ? Math.round(totalDuration / completedCalls) : 0;

  return (
    <>
      <TopBar title="Collection Calls" subtitle="AI-powered phone calls to chase overdue invoices" />

      <div className="space-y-6 p-4 lg:p-6">
        {/* Stats Row */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-fade-in-up" style={{ animationDelay: "50ms" }}>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Phone className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total Calls</p>
                <p className="text-xl font-semibold font-mono tabular-nums text-foreground">{totalCalls}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-float-green/10">
                <CheckCircle2 className="h-4 w-4 text-float-green" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Completed</p>
                <p className="text-xl font-semibold font-mono tabular-nums text-foreground">{completedCalls}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-float-amber/10">
                <PhoneOutgoing className="h-4 w-4 text-float-amber" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Ready to Call</p>
                <p className="text-xl font-semibold font-mono tabular-nums text-foreground">{overdueInvoices.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Avg Duration</p>
                <p className="text-xl font-semibold font-mono tabular-nums text-foreground">{formatDuration(avgDuration)}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Main content */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-5 animate-fade-in-up" style={{ animationDelay: "150ms" }}>
          {/* Overdue invoices to call */}
          <div className="lg:col-span-2">
            <Card className="flex flex-col overflow-hidden">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-float-red/10">
                  <PhoneOutgoing size={13} className="text-float-red" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Overdue — Ready to Call</CardTitle>
                  <p className="text-[10px] text-muted-foreground">Click to initiate an AI collection call</p>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : overdueInvoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                      <Phone className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No overdue invoices</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add phone numbers to overdue clients in the Dashboard
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[500px]">
                    <div className="space-y-1.5 p-3">
                      {overdueInvoices.map((inv) => {
                        const isCalling = callingInvoiceId === inv.id;
                        return (
                          <button
                            key={inv.id}
                            onClick={() => startCall(inv)}
                            disabled={!!callingInvoiceId}
                            className="group w-full rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-sm disabled:opacity-50"
                          >
                            <div className="flex items-start justify-between">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{inv.client_name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{inv.client_phone}</p>
                              </div>
                              <div className="text-right shrink-0 ml-3">
                                <p className="text-sm font-bold font-mono tabular-nums text-foreground">
                                  {formatCurrency(inv.amount)}
                                </p>
                                <p className="text-[10px] font-medium text-float-red">
                                  {inv.due_date && `Due ${format(new Date(inv.due_date), "MMM d")}`}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground">{inv.invoice_number}</span>
                              <div className="flex items-center gap-1.5">
                                {isCalling ? (
                                  <>
                                    <Loader2 size={12} className="animate-spin text-primary" />
                                    <span className="text-xs text-primary font-semibold">Calling…</span>
                                  </>
                                ) : (
                                  <>
                                    <Phone size={12} className="text-primary transition-transform group-hover:scale-110" />
                                    <span className="text-xs text-primary font-semibold">Call Now</span>
                                    <ArrowUpRight size={10} className="text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                                  </>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Call History */}
          <div className="lg:col-span-3">
            <Card className="flex flex-col overflow-hidden">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                  <Clock size={13} className="text-muted-foreground" />
                </div>
                <CardTitle className="text-sm font-semibold">Call History</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : calls.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                      <PhoneOff className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No calls yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Select an overdue invoice to make a collection call
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[500px]">
                    <div className="divide-y divide-border">
                      {calls.map((call) => {
                        const config = statusConfig[call.status || "initiated"];
                        const isSelected = selectedCall?.id === call.id;
                        return (
                          <button
                            key={call.id}
                            onClick={() => setSelectedCall(isSelected ? null : call)}
                            className={`w-full px-5 py-4 text-left transition-colors ${
                              isSelected ? "bg-primary/[0.03]" : "hover:bg-accent/50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${config.color}`}>
                                  {config.icon}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate">{call.client_name}</p>
                                  <p className="text-xs text-muted-foreground font-mono">{call.client_phone}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 ml-3">
                                {call.duration_seconds != null && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono tabular-nums">
                                    <Clock className="h-3 w-3" />
                                    {formatDuration(call.duration_seconds)}
                                  </span>
                                )}
                                <Badge variant="outline" className={`text-[10px] font-semibold ${config.color}`}>
                                  {config.label}
                                </Badge>
                              </div>
                            </div>
                            {call.initiated_at && (
                              <p className="mt-1.5 pl-11 text-[10px] text-muted-foreground">
                                {format(new Date(call.initiated_at), "MMM d, yyyy · h:mm a")}
                              </p>
                            )}
                            {isSelected && (
                              <div className="mt-3 ml-11 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                                {call.outcome && (
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Outcome</p>
                                    <p className="text-sm text-foreground">{call.outcome}</p>
                                  </div>
                                )}
                                {call.transcript && (
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Transcript</p>
                                    <p className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-foreground leading-relaxed">
                                      {call.transcript}
                                    </p>
                                  </div>
                                )}
                                {!call.outcome && !call.transcript && (
                                  <p className="text-xs text-muted-foreground italic">No transcript or outcome recorded for this call.</p>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </>
  );
}
