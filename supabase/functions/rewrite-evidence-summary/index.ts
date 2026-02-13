import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { summary, style } = await req.json();

    if (!summary || !style) {
      return new Response(JSON.stringify({ error: "Missing summary or style" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt =
      style === "factual"
        ? `You are a professional evidence summariser for NHS complaint investigations. 
Rewrite the following AI summary to be STRICTLY FACTUAL ONLY. 
Remove ALL value judgements, opinions, tone assessments, sentiment analysis, and subjective interpretations.
Keep only verifiable facts: what was said, what happened, dates, names, clinical details, actions taken.
Do NOT include phrases like "appeared dismissive", "was empathetic", "seemed frustrated", "handled well/poorly".
Do NOT include tone assessment, behaviour assessment, or complaint handling quality sections.
Present the facts in clear numbered sections. Use plain English, no markdown formatting (no #, *, **).
Write in British English.`
        : `You are a supportive, constructive evidence summariser for NHS complaint investigations.
Rewrite the following AI summary to include gentle professional observations alongside the facts.
Use compassionate, non-judgemental language throughout. Frame observations as learning opportunities rather than criticisms.
For tone observations, use balanced phrasing such as "the conversation reflected…", "the interaction suggested…", or "it may be helpful to consider…".
Avoid harsh or accusatory language. Do NOT use words like "dismissive", "unprofessional", "failed", "poor", or "inadequate".
Instead use constructive alternatives like "there may be scope to enhance…", "a more patient-centred approach could include…", "communication could be strengthened by…".
Acknowledge positive aspects before noting areas for reflection.
Include: balanced tone observations, constructive reflections on the interaction, and supportive suggestions for future practice.
Present in clear numbered sections. Use plain English, no markdown formatting (no #, *, **).
Write in British English.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Here is the original summary to rewrite:\n\n${summary}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const rewritten = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ summary: rewritten }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("rewrite-evidence-summary error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
