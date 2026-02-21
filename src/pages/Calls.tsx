import { useState, useEffect, useCallback } from "react";
import { Phone, PhoneOff, Mic, MicOff, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccount } from "@/hooks/useAccount";
import { supabase } from "@/integrations/supabase/client";
import { useConversation } from "@elevenlabs/react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Call = Tables<"calls">;

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
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [agentId, setAgentId] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [timerInterval, setTimerInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      toast({ title: "Connected", description: "Voice agent is ready" });
      const interval = setInterval(() => setCallTimer((t) => t + 1), 1000);
      setTimerInterval(interval);
    },
    onDisconnect: () => {
      if (timerInterval) clearInterval(timerInterval);
      setCallTimer(0);
    },
    onError: (error) => {
      console.error("Conversation error:", error);
      toast({ variant: "destructive", title: "Connection Error", description: "Voice agent disconnected" });
    },
  });

  // Fetch calls
  useEffect(() => {
    if (!account) return;
    supabase
      .from("calls")
      .select("*")
      .eq("account_id", account.id)
      .order("initiated_at", { ascending: false })
      .then(({ data }) => {
        if (data) setCalls(data);
        setLoading(false);
      });
  }, [account]);

  // Realtime subscription
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

  const startVoiceAgent = useCallback(async () => {
    if (!agentId.trim()) {
      toast({ variant: "destructive", title: "Missing Agent ID", description: "Enter your ElevenLabs Agent ID to start a call" });
      return;
    }
    setIsConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error } = await supabase.functions.invoke("elevenlabs-conversation-token", {
        body: { agentId: agentId.trim() },
      });

      if (error || !data?.token) throw new Error(error?.message || "No token received");

      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to start", description: err.message });
    } finally {
      setIsConnecting(false);
    }
  }, [agentId, conversation, toast]);

  const endVoiceAgent = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-foreground">Calls</h1>
        <p className="text-sm text-muted-foreground">AI-powered voice calls for invoice collection</p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Voice agent */}
        <div className="flex w-96 flex-col border-r border-border p-6">
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Voice Agent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  ElevenLabs Agent ID
                </label>
                <input
                  type="text"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="agent_..."
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  disabled={conversation.status === "connected"}
                />
              </div>

              {conversation.status === "connected" ? (
                <div className="space-y-4">
                  {/* Active call UI */}
                  <div className="flex flex-col items-center gap-3 rounded-xl bg-primary/5 p-6">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-float-green" />
                      <span className="text-sm font-medium text-foreground">
                        {conversation.isSpeaking ? "Agent speaking" : "Listening"}
                      </span>
                    </div>

                    {/* Soundwave */}
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

                  <Button onClick={endVoiceAgent} variant="destructive" className="w-full">
                    <PhoneOff className="mr-2 h-4 w-4" /> End Call
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={startVoiceAgent}
                  disabled={isConnecting || !agentId.trim()}
                  className="w-full"
                >
                  {isConnecting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting…</>
                  ) : (
                    <><Phone className="mr-2 h-4 w-4" /> Start Voice Agent</>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Set up a conversational AI agent in the{" "}
            <a href="https://elevenlabs.io/app/conversational-ai" target="_blank" rel="noreferrer" className="text-primary underline">
              ElevenLabs dashboard
            </a>{" "}
            and paste the Agent ID above. The agent can make collection calls on your behalf.
          </p>
        </div>

        {/* Right: Call history */}
        <div className="flex-1 overflow-hidden">
          <div className="px-6 py-4">
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
                  Calls initiated through the Fix It flow will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-2 pb-6">
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
