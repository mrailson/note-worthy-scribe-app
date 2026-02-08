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

    const analysisPrompt = `You are a supportive and constructive reviewer analysing a transcribed phone call or audio recording uploaded as evidence in an NHS GP practice complaint investigation.

Your role is to provide a balanced, fair, and staff-wellbeing-conscious review. You must recognise and highlight what was done well before offering any suggestions for improvement. Avoid explicit criticism of individual staff members. Frame all improvement areas as gentle, constructive suggestions using language such as "the practice may wish to consider", "it could be helpful to", or "one area for future reflection might be". Never use directive language like "must", "should", "failed to", or "needs to".

TRANSCRIPT:
${transcript.substring(0, 12000)}

Please provide a structured analysis covering the following areas. Be factual, balanced, constructive, and concise. Use British English throughout.

1. **Call Summary** (2-3 sentences): What was the call about? Who appears to be speaking?

2. **What Was Done Well**: Identify and highlight positive aspects of the interaction — professionalism, empathy, patience, de-escalation, clear communication, following procedure, or any other commendable behaviour from staff. Be specific where possible.

3. **Tone Assessment**:
   - Caller/Patient tone (e.g. calm, distressed, frustrated, polite, reasonable)
   - Staff tone (e.g. professional, empathetic, helpful, calm under pressure). Lead with positives. If there were challenges in tone, frame them compassionately — staff may have been under pressure, dealing with a difficult situation, or managing competing demands.

4. **Complaint Handling**: How was the complaint or issue handled during the call? Highlight any good practice first. If there are areas where the handling could be enhanced, frame these as constructive suggestions for future interactions.

5. **Patient Behaviour**: Note the patient's behaviour in a balanced way. If behaviour was challenging (e.g. raised voice, frustration), acknowledge the context — patients may be anxious, unwell, or distressed. If behaviour was reasonable, state that.

6. **Staff Wellbeing Considerations**: Acknowledge the emotional demands placed on staff during this interaction. Note any signs of pressure, difficult circumstances, or challenging behaviour they managed. Recognise resilience and professionalism shown.

7. **Constructive Suggestions for Future Practice**: Rather than criticisms, offer gentle, forward-looking suggestions the practice may wish to consider to further strengthen their approach. Use phrases like "the practice may wish to consider", "it could be beneficial to explore", or "a helpful addition might be". These should feel supportive, not punitive.

8. **Learning & Development Opportunities**: Identify any optional training or development opportunities that could support staff — framed positively as professional growth rather than remediation. For example, "the team may benefit from refresher training on X" rather than "staff need training". If no gaps are apparent, commend existing skills.

Keep each section brief (2-4 sentences). Do not fabricate details not present in the transcript. Always lead with positives and frame suggestions constructively.`;

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
