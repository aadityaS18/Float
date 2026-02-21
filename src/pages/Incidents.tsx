import { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle, Clock, CheckCircle2, ChevronDown, ChevronRight,
  ShieldAlert, Loader2, Sparkles, Brain, PhoneCall, CreditCard,
  Zap, BookOpen, TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccount } from "@/hooks/useAccount";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { format, formatDistanceToNow } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Incident = Tables<"incidents">;
type IncidentEvent = { type: string; timestamp: string; message: string };

/* ── Config maps ─────────────────────────────────────────── */

const severityColor: Record<string, string> = {
  P1: "bg-float-red/10 text-float-red border-float-red/20",
  P2: "bg-float-amber/10 text-float-amber border-float-amber/20",
  P3: "bg-primary/10 text-primary border-primary/20",
};

const severityIcon: Record<string, React.ReactNode> = {
  P1: <ShieldAlert className="h-4 w-4 text-float-red" />,
  P2: <AlertTriangle className="h-4 w-4 text-float-amber" />,
  P3: <Clock className="h-4 w-4 text-primary" />,
};

const statusColor: Record<string, string> = {
  open: "bg-float-red/10 text-float-red border-float-red/20",
  investigating: "bg-float-amber/10 text-float-amber border-float-amber/20",
  mitigated: "bg-primary/10 text-primary border-primary/20",
  resolved: "bg-float-green/10 text-float-green border-float-green/20",
  closed: "bg-muted text-muted-foreground border-border",
};

const eventTypeIcon: Record<string, React.ReactNode> = {
  DETECTED: <AlertTriangle className="h-3.5 w-3.5 text-float-red" />,
  STRATEGY_COMPUTED: <Brain className="h-3.5 w-3.5 text-primary" />,
  PAYMENT_LINK_SENT: <CreditCard className="h-3.5 w-3.5 text-primary" />,
  CALL_INITIATED: <PhoneCall className="h-3.5 w-3.5 text-float-amber" />,
  CALL_COMPLETED: <CheckCircle2 className="h-3.5 w-3.5 text-float-green" />,
  PAYMENT_RECEIVED: <CheckCircle2 className="h-3.5 w-3.5 text-float-green" />,
  RESOLVED: <CheckCircle2 className="h-3.5 w-3.5 text-float-green" />,
};

/* ── Component ───────────────────────────────────────────── */

export default function IncidentsPage() {
  const { account } = useAccount();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");

  useEffect(() => {
    if (!account) return;
    supabase
      .from("incidents")
      .select("*")
      .eq("account_id", account.id)
      .order("opened_at", { ascending: false })
      .then(({ data }) => {
        if (data) setIncidents(data);
        setLoading(false);
      });
  }, [account]);

  // Realtime
  useEffect(() => {
    if (!account) return;
    const channel = supabase
      .channel("incidents-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents", filter: `account_id=eq.${account.id}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          setIncidents((p) => [payload.new as Incident, ...p]);
        } else if (payload.eventType === "UPDATE") {
          setIncidents((p) => p.map((inc) => (inc.id === (payload.new as Incident).id ? (payload.new as Incident) : inc)));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [account]);

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === "resolved" || status === "closed") {
      updates.closed_at = new Date().toISOString();
    }
    await supabase.from("incidents").update(updates).eq("id", id);
  };

  const addEvent = async (incident: Incident, type: string, message: string) => {
    const events = (Array.isArray(incident.events) ? incident.events : []) as IncidentEvent[];
    events.push({ type, timestamp: new Date().toISOString(), message });
    await supabase.from("incidents").update({ events }).eq("id", incident.id);
  };

  const filtered = incidents.filter((i) => {
    if (filter === "open") return i.status === "open" || i.status === "investigating";
    if (filter === "closed") return i.status === "resolved" || i.status === "closed" || i.status === "mitigated";
    return true;
  });

  const openCount = incidents.filter((i) => i.status === "open" || i.status === "investigating").length;
  const resolvedCount = incidents.filter((i) => i.status === "resolved" || i.status === "closed").length;

  // Count total learnings (events across all incidents)
  const totalEvents = useMemo(
    () => incidents.reduce((sum, inc) => sum + (Array.isArray(inc.events) ? (inc.events as IncidentEvent[]).length : 0), 0),
    [incidents]
  );

  const callEvents = useMemo(
    () => incidents.reduce((sum, inc) => {
      const evts = (Array.isArray(inc.events) ? inc.events : []) as IncidentEvent[];
      return sum + evts.filter((e) => e.type === "CALL_COMPLETED" || e.type === "CALL_INITIATED").length;
    }, 0),
    [incidents]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Zap size={16} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Incidents</h1>
              <p className="text-xs text-muted-foreground">
                Powered by <span className="font-semibold text-foreground">Incident.io</span> · AI continuously learning
              </p>
            </div>
          </div>
          <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
            {(["all", "open", "closed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* AI Learning Stats Banner */}
        <div className="mt-4 flex gap-3">
          <LearningStatCard
            icon={<Brain size={14} className="text-primary" />}
            label="Learnings Captured"
            value={totalEvents}
          />
          <LearningStatCard
            icon={<PhoneCall size={14} className="text-float-amber" />}
            label="Learning from Calls"
            value={callEvents}
          />
          <LearningStatCard
            icon={<CheckCircle2 size={14} className="text-float-green" />}
            label="Incidents Resolved"
            value={resolvedCount}
          />
          <LearningStatCard
            icon={<TrendingUp size={14} className="text-primary" />}
            label="Active Incidents"
            value={openCount}
            highlight={openCount > 0}
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-6">
        <div className="mx-auto max-w-4xl space-y-3 py-6">
          {/* AI Learning Summary Panel */}
          {!loading && resolvedCount > 0 && (
            <AiLearningSummary incidents={incidents} />
          )}
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="mb-3 h-10 w-10 text-float-green/40" />
              <p className="text-sm text-muted-foreground">
                {filter === "all" ? "No incidents recorded" : `No ${filter} incidents`}
              </p>
            </div>
          ) : (
            filtered.map((incident) => {
              const events = (Array.isArray(incident.events) ? incident.events : []) as IncidentEvent[];
              const expanded = expandedId === incident.id;

              return (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  events={events}
                  expanded={expanded}
                  onToggle={() => setExpandedId(expanded ? null : incident.id)}
                  onUpdateStatus={updateStatus}
                  onAddEvent={addEvent}
                />
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function LearningStatCard({ icon, label, value, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={`flex flex-1 items-center gap-2.5 rounded-lg border px-3.5 py-2.5 ${
      highlight ? "border-float-red/20 bg-float-red/[0.03]" : "border-border bg-card"
    }`}>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
        {icon}
      </div>
      <div>
        <p className="font-mono text-lg font-semibold tabular-nums text-foreground leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function IncidentCard({ incident, events, expanded, onToggle, onUpdateStatus, onAddEvent }: {
  incident: Incident;
  events: IncidentEvent[];
  expanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (id: string, status: string) => Promise<void>;
  onAddEvent: (incident: Incident, type: string, message: string) => Promise<void>;
}) {
  const isActive = incident.status === "open" || incident.status === "investigating";

  return (
    <Card className={`transition-shadow ${expanded ? "shadow-md" : ""}`}>
      <CardHeader className="cursor-pointer pb-3" onClick={onToggle}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {expanded ? (
              <ChevronDown className="mt-0.5 h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="mt-0.5 h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <div className="flex items-center gap-2">
                {severityIcon[incident.severity]}
                <CardTitle className="text-base">{incident.title}</CardTitle>
              </div>
              {incident.description && (
                <p className="mt-1 text-sm text-muted-foreground">{incident.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={severityColor[incident.severity]}>
              {incident.severity}
            </Badge>
            <Badge variant="outline" className={statusColor[incident.status] || ""}>
              {incident.status}
            </Badge>
            {incident.shortfall_amount && (
              <span className="font-mono text-sm tabular-nums text-float-red">
                {formatCurrency(incident.shortfall_amount)}
              </span>
            )}
          </div>
        </div>
        {incident.opened_at && (
          <p className="ml-7 mt-1 text-xs text-muted-foreground">
            Opened {format(new Date(incident.opened_at), "MMM d, yyyy · h:mm a")}
            {incident.closed_at && ` · Closed ${format(new Date(incident.closed_at), "MMM d, yyyy · h:mm a")}`}
          </p>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {/* AI Learning Context */}
          {events.length > 0 && (
            <div className="ml-7 mb-4 flex items-center gap-2 rounded-lg border border-primary/10 bg-primary/[0.03] px-3 py-2">
              <Sparkles size={13} className="shrink-0 text-primary" />
              <p className="text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">Learning from this incident</span>
                {" · "}{events.length} event{events.length !== 1 ? "s" : ""} tracked
                {events.some((e) => e.type === "CALL_COMPLETED") && " · Call insights captured"}
                {events.some((e) => e.type === "PAYMENT_RECEIVED") && " · Payment patterns recorded"}
              </p>
            </div>
          )}

          {/* Timeline */}
          <div className="ml-7 border-l-2 border-border pl-4">
            {events.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">No events recorded</p>
            ) : (
              events.map((evt, i) => (
                <div key={i} className="relative mb-4 last:mb-0">
                  <div className="absolute -left-[1.35rem] top-0.5 h-3 w-3 rounded-full border-2 border-border bg-card" />
                  <div className="flex items-start gap-2">
                    {eventTypeIcon[evt.type] || <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-foreground">{evt.message}</p>
                        {(evt.type === "CALL_COMPLETED" || evt.type === "STRATEGY_COMPUTED") && (
                          <Badge variant="outline" className="h-4 border-primary/20 bg-primary/5 px-1.5 text-[9px] font-semibold text-primary">
                            <BookOpen size={8} className="mr-0.5" /> AI Learned
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(evt.timestamp), "MMM d · h:mm:ss a")}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Actions */}
          {isActive && (
            <div className="ml-7 mt-4 flex gap-2 border-t border-border pt-4">
              {incident.status === "open" && (
                <Button size="sm" variant="outline" onClick={() => onUpdateStatus(incident.id, "investigating")}>
                  Start Investigating
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onUpdateStatus(incident.id, "mitigated")}>
                Mark Mitigated
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onAddEvent(incident, "RESOLVED", "Incident resolved");
                  onUpdateStatus(incident.id, "resolved");
                }}
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Resolve
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/* ── AI Learning Summary Panel ───────────────────────────── */

function AiLearningSummary({ incidents }: { incidents: Incident[] }) {
  const resolved = incidents.filter((i) => i.status === "resolved" || i.status === "closed");
  
  const allEvents = resolved.flatMap((inc) => {
    const evts = (Array.isArray(inc.events) ? inc.events : []) as IncidentEvent[];
    return evts.map((e) => ({ ...e, incidentTitle: inc.title }));
  });

  const callLearnings = allEvents.filter((e) => e.type === "CALL_COMPLETED");
  const paymentLearnings = allEvents.filter((e) => e.type === "PAYMENT_RECEIVED");
  const strategyLearnings = allEvents.filter((e) => e.type === "STRATEGY_COMPUTED");

  const totalShortfallRecovered = resolved
    .filter((i) => i.shortfall_amount)
    .reduce((sum, i) => sum + (i.shortfall_amount || 0), 0);

  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-primary/10 bg-gradient-to-br from-primary/[0.02] to-transparent">
      <CardHeader
        className="cursor-pointer pb-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Brain size={14} className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">AI Learning Summary</CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Aggregated insights from {resolved.length} resolved incident{resolved.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary text-[10px]">
              <Sparkles size={9} className="mr-1" /> {allEvents.length} learnings
            </Badge>
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <p className="font-mono text-lg font-semibold tabular-nums text-float-green leading-none">
                {totalShortfallRecovered > 0 ? `€${(totalShortfallRecovered / 100).toLocaleString()}` : "€0"}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">Shortfall Addressed</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <p className="font-mono text-lg font-semibold tabular-nums text-primary leading-none">
                {callLearnings.length}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">Call Outcomes Learned</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <p className="font-mono text-lg font-semibold tabular-nums text-float-amber leading-none">
                {strategyLearnings.length}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">Strategies Computed</p>
            </div>
          </div>

          {/* Key Learnings */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Key Learnings</p>
            
            {callLearnings.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-3">
                <PhoneCall size={13} className="mt-0.5 shrink-0 text-float-amber" />
                <div>
                  <p className="text-xs font-medium text-foreground">Learning from Calls</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {callLearnings.length} collection call{callLearnings.length !== 1 ? "s" : ""} completed. 
                    AI has learned debtor response patterns and optimal contact timing from these interactions.
                  </p>
                  <div className="mt-2 space-y-1">
                    {callLearnings.slice(0, 3).map((cl, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground">
                        <span className="font-medium text-foreground">via Incident:</span> {cl.incidentTitle} — {cl.message}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {paymentLearnings.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-3">
                <CreditCard size={13} className="mt-0.5 shrink-0 text-float-green" />
                <div>
                  <p className="text-xs font-medium text-foreground">Learning from Payments</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {paymentLearnings.length} payment{paymentLearnings.length !== 1 ? "s" : ""} received via incidents. 
                    AI has learned which collection strategies lead to faster payment.
                  </p>
                  <div className="mt-2 space-y-1">
                    {paymentLearnings.slice(0, 3).map((pl, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground">
                        <span className="font-medium text-foreground">via Incident:</span> {pl.incidentTitle} — {pl.message}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {strategyLearnings.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-3">
                <Brain size={13} className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-medium text-foreground">Learning from Strategies</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {strategyLearnings.length} resolution strateg{strategyLearnings.length !== 1 ? "ies" : "y"} computed. 
                    AI refines its crisis response playbook with each incident.
                  </p>
                </div>
              </div>
            )}

            {callLearnings.length === 0 && paymentLearnings.length === 0 && strategyLearnings.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
                <Sparkles size={13} className="text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground">
                  Incidents resolved but no detailed event learnings captured yet. Future incidents will build the AI knowledge base.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
