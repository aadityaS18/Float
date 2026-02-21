import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages, account_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build incident context if account_id is provided
    let incidentContext = "";
    if (account_id) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sb = createClient(supabaseUrl, supabaseKey);

        // Fetch resolved incidents with events
        const { data: incidents } = await sb
          .from("incidents")
          .select("title, description, severity, status, shortfall_amount, events, opened_at, closed_at")
          .eq("account_id", account_id)
          .order("opened_at", { ascending: false })
          .limit(20);

        // Fetch recent calls with outcomes
        const { data: calls } = await sb
          .from("calls")
          .select("client_name, status, outcome, duration_seconds, transcript")
          .eq("account_id", account_id)
          .order("initiated_at", { ascending: false })
          .limit(10);

        if (incidents && incidents.length > 0) {
          const summaries = incidents.map((inc) => {
            const evts = Array.isArray(inc.events) ? inc.events : [];
            const eventSummary = evts.map((e: any) => `${e.type}: ${e.message}`).join("; ");
            const shortfall = inc.shortfall_amount ? `€${(inc.shortfall_amount / 100).toFixed(2)}` : "N/A";
            return `- [${inc.severity}/${inc.status}] "${inc.title}" — Shortfall: ${shortfall}. Events: ${eventSummary || "none"}`;
          }).join("\n");

          incidentContext += `\n\n## Past Incidents (AI Learnings)\nYou have learned from these incidents. Reference them when relevant:\n${summaries}`;
        }

        if (calls && calls.length > 0) {
          const callSummaries = calls.map((c) => {
            return `- Call to ${c.client_name} [${c.status}]: Outcome: ${c.outcome || "pending"}${c.transcript ? `. Key transcript: ${c.transcript.slice(0, 200)}` : ""}`;
          }).join("\n");

          incidentContext += `\n\n## Call History (AI Learnings from Calls)\nYou learned from these collection calls. Reference outcomes and patterns:\n${callSummaries}`;
        }
      } catch (e) {
        console.error("Failed to fetch incident context:", e);
      }
    }

    const systemPrompt = `You are Float AI — an expert AI CFO assistant for small businesses. You help business owners understand their cashflow, invoices, payroll, and financial health.

Key facts:
- Money is stored in pence/cents. Always convert to euros when displaying amounts (divide by 100).
- You can analyze spending patterns, predict cashflow issues, and suggest optimizations.
- Be concise, actionable, and empathetic. Business owners are busy.
- Use markdown formatting for clarity: bold key numbers, use bullet points for lists.
- If asked about something outside finance, politely redirect.
- You continuously learn from past incidents and collection calls. When a user asks about past issues, payment patterns, or what happened before, reference your learnings.
- When referencing incidents, say "Based on what I've learned from incident..." or "From our past experience with..."${incidentContext}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
