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

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Fetch recent data
    const [txRes, invRes, incRes, accRes] = await Promise.all([
      sb.from("transactions").select("amount, is_income, category, merchant_name, created")
        .eq("account_id", account_id).gte("created", weekAgo.toISOString()),
      sb.from("invoices").select("amount, status, client_name, due_date, paid_at")
        .eq("account_id", account_id),
      sb.from("incidents").select("title, severity, status, shortfall_amount, opened_at")
        .eq("account_id", account_id).gte("opened_at", weekAgo.toISOString()),
      sb.from("accounts").select("business_name, payroll_amount, currency").eq("id", account_id).single(),
    ]);

    const transactions = txRes.data || [];
    const invoices = invRes.data || [];
    const incidents = incRes.data || [];
    const account = accRes.data;

    const totalIn = transactions.filter((t) => t.is_income).reduce((s, t) => s + t.amount, 0);
    const totalOut = transactions.filter((t) => !t.is_income).reduce((s, t) => s + Math.abs(t.amount), 0);
    const overdueInvoices = invoices.filter((i) => i.status === "overdue");
    const paidThisWeek = invoices.filter((i) => i.paid_at && new Date(i.paid_at) >= weekAgo);

    const context = `Business: ${account?.business_name || "Unknown"}
Currency: ${account?.currency || "EUR"}
This week's income: €${(totalIn / 100).toFixed(2)}
This week's expenses: €${(totalOut / 100).toFixed(2)}
Net: €${((totalIn - totalOut) / 100).toFixed(2)}
Total transactions: ${transactions.length}
Overdue invoices: ${overdueInvoices.length} totaling €${(overdueInvoices.reduce((s, i) => s + i.amount, 0) / 100).toFixed(2)}
Invoices paid this week: ${paidThisWeek.length}
New incidents: ${incidents.length}
Payroll amount: €${((account?.payroll_amount || 0) / 100).toFixed(2)}

Top expenses by category:
${Object.entries(
  transactions.filter((t) => !t.is_income).reduce((acc: Record<string, number>, t) => {
    const cat = t.category || "Other";
    acc[cat] = (acc[cat] || 0) + Math.abs(t.amount);
    return acc;
  }, {})
).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 5).map(([cat, amt]) => `  ${cat}: €${((amt as number) / 100).toFixed(2)}`).join("\n")}`;

    const prompt = `You are Float AI, an expert CFO assistant. Generate a concise weekly financial digest for this small business.

${context}

Return a JSON object with:
- "summary": 2-3 sentence executive summary (max 200 chars)
- "highlights": array of 3-5 key highlights, each { "label": "short label", "value": "formatted value", "trend": "up" | "down" | "neutral", "good": true/false }
- "recommendations": array of 2-3 actionable recommendations (strings, max 100 chars each)
- "risk_score": 1-10 overall financial health (10 = excellent)
- "risk_label": "Healthy" | "Caution" | "At Risk" | "Critical"

Return ONLY the JSON object.`;

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
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const raw = aiData.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let digest: any = {};
    try { digest = JSON.parse(cleaned); } catch { digest = { summary: "Unable to generate digest", highlights: [], recommendations: [], risk_score: 5, risk_label: "Unknown" }; }

    return new Response(JSON.stringify(digest), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-digest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
