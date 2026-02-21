import { useState, useEffect } from "react";
import { AlertTriangle, Clock, CheckCircle2, ChevronDown, ChevronRight, ShieldAlert, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccount } from "@/hooks/useAccount";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Incident = Tables<"incidents">;
type IncidentEvent = { type: string; timestamp: string; message: string };

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
  STRATEGY_COMPUTED: <Clock className="h-3.5 w-3.5 text-float-amber" />,
  PAYMENT_LINK_SENT: <CheckCircle2 className="h-3.5 w-3.5 text-primary" />,
  CALL_INITIATED: <Clock className="h-3.5 w-3.5 text-float-amber" />,
  CALL_COMPLETED: <CheckCircle2 className="h-3.5 w-3.5 text-float-green" />,
  PAYMENT_RECEIVED: <CheckCircle2 className="h-3.5 w-3.5 text-float-green" />,
  RESOLVED: <CheckCircle2 className="h-3.5 w-3.5 text-float-green" />,
};

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Incidents</h1>
          <p className="text-sm text-muted-foreground">
            {openCount > 0 ? `${openCount} active incident${openCount > 1 ? "s" : ""}` : "All clear"}
          </p>
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

      <ScrollArea className="flex-1 px-6">
        <div className="mx-auto max-w-4xl space-y-3 py-6">
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
                <Card key={incident.id} className={`transition-shadow ${expanded ? "shadow-md" : ""}`}>
                  <CardHeader
                    className="cursor-pointer pb-3"
                    onClick={() => setExpandedId(expanded ? null : incident.id)}
                  >
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
                                <div>
                                  <p className="text-sm text-foreground">{evt.message}</p>
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
                      {(incident.status === "open" || incident.status === "investigating") && (
                        <div className="ml-7 mt-4 flex gap-2 border-t border-border pt-4">
                          {incident.status === "open" && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(incident.id, "investigating")}>
                              Start Investigating
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => updateStatus(incident.id, "mitigated")}>
                            Mark Mitigated
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              addEvent(incident, "RESOLVED", "Incident resolved");
                              updateStatus(incident.id, "resolved");
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
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
