import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { account_id } = await req.json();
    if (!account_id) throw new Error("account_id required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch last 90 days of transactions
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const { data: transactions } = await sb
      .from("transactions")
      .select("amount, category, merchant_name, is_income, created, description")
      .eq("account_id", account_id)
      .gte("created", since.toISOString())
      .order("created", { ascending: false });

    if (!transactions || transactions.length < 5) {
      return new Response(JSON.stringify({ insights: [], message: "Not enough transaction data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a summary for the AI
    const txSummary = transactions.slice(0, 100).map((t) =>
      `${t.created}: ${t.is_income ? "IN" : "OUT"} €${(Math.abs(t.amount) / 100).toFixed(2)} — ${t.merchant_name || t.category || t.description || "unknown"}`
    ).join("\n");

    const prompt = `You are a financial anomaly detector for a small business. Analyze these recent transactions and identify anomalies — unusual spending, unexpected charges, patterns that break from norms, or suspicious duplicates.

Transactions (most recent first):
${txSummary}

Return a JSON array of anomalies found. Each object must have:
- "title": short title (max 60 chars)
- "message": explanation (max 150 chars)
- "type": one of "critical", "warning", "info"
- "action_label": suggested action button text (max 20 chars) or null
- "action_type": "view_transactions" or "chat" or null

Return ONLY the JSON array, no markdown. If no anomalies found, return [].`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResp.ok) {
      console.error("AI error:", aiResp.status);
      return new Response(JSON.stringify({ insights: [], error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const raw = aiData.choices?.[0]?.message?.content ?? "[]";
    // Strip markdown fences if present
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let anomalies: any[] = [];
    try { anomalies = JSON.parse(cleaned); } catch { anomalies = []; }

    // Upsert as ai_insights
    if (anomalies.length > 0) {
      const inserts = anomalies.slice(0, 5).map((a: any) => ({
        account_id,
        title: a.title,
        message: a.message,
        type: a.type || "warning",
        action_label: a.action_label || null,
        action_type: a.action_type || null,
        dismissed: false,
      }));
      await sb.from("ai_insights").insert(inserts);
    }

    return new Response(JSON.stringify({ insights: anomalies.slice(0, 5) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-anomalies error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
