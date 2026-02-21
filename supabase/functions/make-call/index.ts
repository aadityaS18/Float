import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!TWILIO_ACCOUNT_SID) throw new Error("TWILIO_ACCOUNT_SID is not configured");
    if (!TWILIO_AUTH_TOKEN) throw new Error("TWILIO_AUTH_TOKEN is not configured");
    if (!TWILIO_PHONE_NUMBER) throw new Error("TWILIO_PHONE_NUMBER is not configured");

    const { to, clientName, invoiceNumber, amount, dueDate, callId } = await req.json();

    if (!to) throw new Error("'to' phone number is required");
    if (!clientName) throw new Error("'clientName' is required");

    // Build TwiML inline — Twilio will speak this when the call connects
    const amountFormatted = `€${(amount / 100).toLocaleString("en-IE", { minimumFractionDigits: 2 })}`;
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy" language="en-GB">
    Hello, this is an automated call regarding an overdue invoice from The Cobblestone Kitchen.
    We are calling about invoice ${invoiceNumber || "on your account"}, for the amount of ${amountFormatted}, which was due on ${dueDate || "a previous date"}.
    This payment is now overdue and we kindly request immediate payment of the full amount of ${amountFormatted}.
    Please arrange payment as soon as possible to avoid further follow-up action.
    If you have already made this payment, please disregard this message.
    To discuss payment arrangements, please contact us directly.
    Thank you for your attention to this matter. Goodbye.
  </Say>
  <Pause length="2"/>
  <Say voice="Polly.Amy" language="en-GB">
    Once again, please pay the outstanding amount of ${amountFormatted} for invoice ${invoiceNumber || "on file"} at your earliest convenience. Thank you.
  </Say>
</Response>`;

    // Make the Twilio call
    const authString = base64Encode(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const params = new URLSearchParams();
    params.append("To", to);
    params.append("From", TWILIO_PHONE_NUMBER);
    params.append("Twiml", twiml);
    if (callId) params.append("StatusCallback", `${Deno.env.get("SUPABASE_URL")}/functions/v1/twilio-status-callback?callId=${callId}`);
    params.append("StatusCallbackEvent", "completed");

    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${authString}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio error:", JSON.stringify(twilioData));
      throw new Error(`Twilio API error: ${twilioData.message || twilioData.code || twilioResponse.status}`);
    }

    console.log("Call initiated:", twilioData.sid);

    return new Response(
      JSON.stringify({
        success: true,
        callSid: twilioData.sid,
        status: twilioData.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("make-call error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
