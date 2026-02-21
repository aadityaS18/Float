import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Phone, PhoneOff, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccount } from "@/hooks/useAccount";
import { supabase } from "@/integrations/supabase/client";
import { useConversation } from "@elevenlabs/react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "react-router-dom";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

const AGENT_ID = "agent_0301khzyjj0ee34tfg0e1hcqjbjx";

type Call = Tables<"calls">;
type Invoice = Tables<"invoices">;

const statusIcon: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="h-4 w-4 text-float-green" />,
  failed: <XCircle className="h-4 w-4 text-float-red" />,
  initiated: <Loader2 className="h-4 w-4 animate-spin text-float-amber" />,
  "in-progress": <Phone className="h-4 w-4 text-primary" />,
};

const statusColor: Record<string, string> = {
  completed: "bg-float-green/10 text-float-green border-float-green/20",
  failed: "bg-float-red/10 text-float-red border-float-red/20",
  initiated: "bg-float-amber/10 text-float-amber border-float-amber/20",
  "in-progress": "bg-primary/10 text-primary border-primary/20",
};

export default function CallsPage() {
  const { account } = useAccount();
  const { toast } = useToast();
  const location = useLocation();
  const [calls, setCalls] = useState<Call[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [timerInterval, setTimerInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const autoCallTriggered = useRef(false);

  const conversation = useConversation({
    onConnect: () => {
      toast({ title: "Connected", description: "Voice agent is ready — speak now" });
      const interval = setInterval(() => setCallTimer((t) => t + 1), 1000);
      setTimerInterval(interval);
    },
    onDisconnect: () => {
      if (timerInterval) clearInterval(timerInterval);
      setCallTimer(0);
      setActiveInvoice(null);
    },
    onError: (error) => {
      console.error("Conversation error:", error);
      toast({ variant: "destructive", title: "Connection Error", description: "Voice agent disconnected" });
    },
  });

  // Fetch calls + overdue invoices
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

  // Realtime for calls
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

  // Auto-start call when navigated from Dashboard Chase button
  useEffect(() => {
    const state = location.state as { autoCallInvoice?: Invoice } | null;
    if (state?.autoCallInvoice && account && !autoCallTriggered.current && !loading) {
      autoCallTriggered.current = true;
      startCall(state.autoCallInvoice);
      // Clear the state so refreshing doesn't re-trigger
      window.history.replaceState({}, document.title);
    }
  }, [location.state, account, loading]);

  const startCall = useCallback(async (invoice: Invoice) => {
    if (!invoice.client_phone) {
      toast({ variant: "destructive", title: "No phone number", description: "Add a phone number to this client first in the Dashboard" });
      return;
    }
    setIsConnecting(true);
    setActiveInvoice(invoice);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error } = await supabase.functions.invoke("elevenlabs-conversation-token", {
        body: { agentId: AGENT_ID },
      });

      if (error || !data?.token) throw new Error(error?.message || "No token received");

      // Create call record
      if (account) {
        await supabase.from("calls").insert({
          account_id: account.id,
          invoice_id: invoice.id,
          client_name: invoice.client_name,
          client_phone: invoice.client_phone,
          status: "initiated",
        });
      }

      // Start conversation with context about the invoice
      const amountFormatted = formatCurrency(invoice.amount);
      const dueDate = invoice.due_date ? format(new Date(invoice.due_date), "MMMM d, yyyy") : "unknown";

      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
        overrides: {
          agent: {
            prompt: {
              prompt: `You are a professional but firm collections agent calling on behalf of a business. You are calling ${invoice.client_name} about an overdue invoice (${invoice.invoice_number}) for ${amountFormatted} that was due on ${dueDate}. Your goal is to collect full payment immediately. Be polite but persistent. Ask when they can pay. If they commit to paying, confirm the amount and timeline. Do not accept partial payment — the full amount of ${amountFormatted} is required. End the call by confirming next steps.`,
            },
            firstMessage: `Hello, this is a call regarding an overdue invoice. Am I speaking with someone from ${invoice.client_name}?`,
          },
        },
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to start", description: err.message });
      setActiveInvoice(null);
    } finally {
      setIsConnecting(false);
    }
  }, [conversation, toast, account]);

  const endCall = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const overdueInvoices = useMemo(
    () => invoices.filter((i) => i.status === "overdue" && i.client_phone),
    [invoices]
  );

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-foreground">Collection Calls</h1>
        <p className="text-sm text-muted-foreground">AI voice agent for chasing overdue invoices</p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Overdue invoices to call */}
        <div className="flex w-96 flex-col border-r border-border">
          {conversation.status === "connected" && activeInvoice ? (
            <div className="flex flex-col items-center gap-4 p-6">
              <Card className="w-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Active Call</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{activeInvoice.client_name}</p>
                    <p className="text-xs text-muted-foreground">{activeInvoice.client_phone}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Invoice: {activeInvoice.invoice_number} · {formatCurrency(activeInvoice.amount)}
                    </p>
                  </div>

                  <div className="flex flex-col items-center gap-3 rounded-xl bg-primary/5 p-6">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-float-green" />
                      <span className="text-sm font-medium text-foreground">
                        {conversation.isSpeaking ? "Agent speaking" : "Listening"}
                      </span>
                    </div>

                    <div className="flex h-10 items-end gap-0.5">
                      {Array.from({ length: 14 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-1 rounded-full bg-primary animate-soundwave"
                          style={{
                            "--wave-height": `${12 + Math.random() * 20}px`,
                            "--wave-duration": `${0.5 + Math.random() * 0.6}s`,
                            animationDelay: `${i * 0.05}s`,
                          } as React.CSSProperties}
                        />
                      ))}
                    </div>

                    <span className="font-mono text-lg tabular-nums text-foreground">
                      {formatDuration(callTimer)}
                    </span>
                  </div>

                  <Button onClick={endCall} variant="destructive" className="w-full">
                    <PhoneOff className="mr-2 h-4 w-4" /> End Call
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Overdue — Ready to Call</h2>
                <p className="text-xs text-muted-foreground">Click to start an AI collection call</p>
              </div>
              <ScrollArea className="flex-1">
                {loading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : overdueInvoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                    <Phone className="mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No overdue invoices with phone numbers</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add phone numbers to overdue clients in the Dashboard to enable calling
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {overdueInvoices.map((inv) => (
                      <button
                        key={inv.id}
                        onClick={() => startCall(inv)}
                        disabled={isConnecting}
                        className="w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent/50 disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">{inv.client_name}</p>
                            <p className="text-xs text-muted-foreground">{inv.client_phone}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold font-mono tabular-nums text-foreground">
                              {formatCurrency(inv.amount)}
                            </p>
                            <p className="text-[10px] text-float-red">
                              {inv.due_date && `Due ${format(new Date(inv.due_date), "MMM d")}`}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                          <Phone size={11} className="text-primary" />
                          <span className="text-xs text-primary font-medium">
                            {isConnecting ? "Connecting…" : "Start AI Call"}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Right: Call history */}
        <div className="flex-1 overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Call History</h2>
          </div>
          <ScrollArea className="h-[calc(100%-52px)] px-6">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : calls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Phone className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No calls yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Select an overdue invoice on the left to start a collection call
                </p>
              </div>
            ) : (
              <div className="space-y-2 py-4">
                {calls.map((call) => (
                  <button
                    key={call.id}
                    onClick={() => setSelectedCall(selectedCall?.id === call.id ? null : call)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      selectedCall?.id === call.id ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {statusIcon[call.status || "initiated"]}
                        <div>
                          <p className="text-sm font-medium text-foreground">{call.client_name}</p>
                          <p className="text-xs text-muted-foreground">{call.client_phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {call.duration_seconds && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDuration(call.duration_seconds)}
                          </span>
                        )}
                        <Badge variant="outline" className={statusColor[call.status || "initiated"]}>
                          {call.status}
                        </Badge>
                      </div>
                    </div>
                    {call.initiated_at && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {format(new Date(call.initiated_at), "MMM d, yyyy · h:mm a")}
                      </p>
                    )}
                    {selectedCall?.id === call.id && (
                      <div className="mt-3 space-y-2 border-t border-border pt-3">
                        {call.outcome && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Outcome</p>
                            <p className="text-sm text-foreground">{call.outcome}</p>
                          </div>
                        )}
                        {call.transcript && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Transcript</p>
                            <p className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-foreground">
                              {call.transcript}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
