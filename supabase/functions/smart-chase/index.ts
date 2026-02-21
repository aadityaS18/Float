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

    // Fetch unpaid/overdue invoices
    const { data: invoices } = await sb
      .from("invoices")
      .select("id, client_name, amount, due_date, status, client_phone, client_email, invoice_number")
      .eq("account_id", account_id)
      .in("status", ["unpaid", "overdue", "chasing"]);

    // Fetch past calls for context
    const { data: calls } = await sb
      .from("calls")
      .select("client_name, outcome, status")
      .eq("account_id", account_id)
      .order("initiated_at", { ascending: false })
      .limit(20);

    if (!invoices || invoices.length === 0) {
      return new Response(JSON.stringify({ rankings: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invoiceSummary = invoices.map((inv) => {
      const daysOverdue = inv.due_date
        ? Math.max(0, Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000))
        : 0;
      return `${inv.invoice_number} | ${inv.client_name} | €${(inv.amount / 100).toFixed(2)} | ${daysOverdue}d overdue | status: ${inv.status} | phone: ${inv.client_phone ? "yes" : "no"}`;
    }).join("\n");

    const callHistory = (calls || []).map((c) => `${c.client_name}: ${c.outcome || c.status}`).join("; ");

    const prompt = `You are an AI accounts receivable specialist. Rank these unpaid invoices by likelihood-to-pay and urgency to chase.

Invoices:
${invoiceSummary}

Past call outcomes: ${callHistory || "None"}

For each invoice, return a JSON array sorted by recommended chase priority (highest first). Each object:
- "invoice_id": the invoice ID
- "score": 1-100 likelihood to pay if chased now
- "priority": "high", "medium", or "low"  
- "reason": one-line explanation (max 80 chars)
- "best_channel": "call" or "email"
- "best_time": suggested time of day to chase (e.g. "Morning 9-11am")

Return ONLY the JSON array.`;

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
      return new Response(JSON.stringify({ rankings: [], error: "AI error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const raw = aiData.choices?.[0]?.message?.content ?? "[]";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let rankings: any[] = [];
    try { rankings = JSON.parse(cleaned); } catch { rankings = []; }

    return new Response(JSON.stringify({ rankings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart-chase error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
