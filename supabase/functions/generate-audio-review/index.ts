import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { transcript, fileName } = await req.json();

    if (!transcript || transcript.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "No transcript provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating AI review for: ${fileName}, transcript length: ${transcript.length}`);

    const analysisPrompt = `You are analysing a transcribed phone call or audio recording that has been uploaded as evidence in an NHS GP practice complaint investigation.

TRANSCRIPT:
${transcript.substring(0, 12000)}

Please provide a structured analysis covering the following areas. Be factual, balanced, and concise. Use British English throughout.

1. **Call Summary** (2-3 sentences): What was the call about? Who appears to be speaking?

2. **Tone Assessment**:
   - Caller/Patient tone (e.g. calm, distressed, frustrated, aggressive, polite, reasonable)
   - Staff tone (e.g. professional, empathetic, dismissive, defensive, helpful, rude)

3. **Complaint Handling**: How was the complaint or issue handled during the call? Was the patient listened to? Were appropriate steps taken or offered?

4. **Patient Behaviour**: Note any concerning behaviour from the patient — rudeness, hostility, threats, unreasonable demands, abusive language. If behaviour was reasonable, state that.

5. **Staff Behaviour**: Note any concerning behaviour from staff — dismissiveness, lack of empathy, rudeness, failure to follow procedure. If behaviour was professional, state that.

6. **Key Lessons & Recommendations**: What lessons can the practice learn from this interaction? Any recommendations for improvement?

7. **Training Requirements**: Based on this interaction, identify any specific training needs for staff — communication skills, de-escalation, complaint handling, clinical knowledge, etc. If no training gaps are apparent, state that.

8. **Patient Education**: Are there any areas where the patient may benefit from better information or education about practice processes, NHS procedures, or managing expectations? If not applicable, state that.

Keep each section brief (2-4 sentences). Do not fabricate details not present in the transcript.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "user", content: analysisPrompt },
        ],
      }),
    });

    if (aiResponse.status === 429) {
      return new Response(
        JSON.stringify({
          review: `Audio transcribed (${transcript.split(/\s+/).length} words). AI analysis rate limited — try again later.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (aiResponse.status === 402) {
      return new Response(
        JSON.stringify({
          review: `Audio transcribed (${transcript.split(/\s+/).length} words). AI analysis unavailable — credit limit reached.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI analysis error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({
          review: `Audio transcribed (${transcript.split(/\s+/).length} words). AI analysis could not be generated.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const review =
      aiData.choices?.[0]?.message?.content?.trim() ||
      `Audio transcribed successfully (${transcript.split(/\s+/).length} words). AI analysis could not be generated.`;

    console.log(`✅ AI review generated for ${fileName}`);

    return new Response(
      JSON.stringify({ review }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating audio review:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
