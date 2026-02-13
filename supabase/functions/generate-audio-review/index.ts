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
    const { transcript, fileName, audioDuration, includeValueJudgements = false } = await req.json();

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

    console.log(`Generating AI call summary for: ${fileName}, transcript length: ${transcript.length}`);

    const durationLine = audioDuration
      ? `The audio recording is approximately ${Math.floor(audioDuration / 60)} minutes and ${audioDuration % 60} seconds long.`
      : '';

    const valueJudgementsSection = includeValueJudgements ? `

## 5. Tone Assessment
Assess the tone and demeanour of each party:
- **Patient/Caller tone**: (e.g., Calm, Frustrated, Dismissive, Anxious, Assertive)
- **Staff tone**: (e.g., Professional, Dismissive, Empathetic, Defensive)
- **Overall handling**: (e.g., Good, Needs Improvement, Poor)

## 6. Key Lessons and Recommendations
Based on the call, identify learning points and suggestions for practice improvement.` : '';

    const absoluteRules = includeValueJudgements
      ? `RULES:
- Use British English throughout
- Write in the third person
- You MAY comment on tone, attitude, demeanour, and emotions of any party
- You MAY offer opinions on call handling quality
- You MAY offer suggestions, recommendations, and lessons learned
- Keep assessments fair, balanced, and evidence-based
- Do NOT speculate beyond what is supported by the transcript`
      : `ABSOLUTE RULES:
- Report ONLY what was said and done — no interpretation, no judgement
- Do NOT comment on tone, attitude, demeanour, or emotions of any party
- Do NOT praise or criticise any party
- Do NOT offer suggestions, recommendations, or lessons learned
- Do NOT speculate about intent or motivation
- Use British English throughout
- Write in the third person
- Keep the summary concise and factual`;

    const analysisPrompt = `You are a ${includeValueJudgements ? 'detailed analyst' : 'factual summariser'} analysing a transcribed phone call or audio recording uploaded as evidence in an NHS GP practice complaint investigation.

YOUR PURPOSE is to produce a clear, ${includeValueJudgements ? 'comprehensive' : 'factual'}, third-person summary of the call.${includeValueJudgements ? '' : ' Do NOT offer opinions, commentary on tone, praise, criticism, suggestions, or recommendations. Simply state what happened.'}

${absoluteRules}

${durationLine}

TRANSCRIPT:
${transcript.substring(0, 12000)}

Provide a structured summary covering the following sections. Separate each section clearly with blank lines between paragraphs for readability.

## 1. Call Overview
2-3 sentences: State who appears to be involved in the call (e.g. patient, receptionist, GP), the apparent purpose of the call, and if identifiable, when it took place.${audioDuration ? ` The call duration was approximately ${Math.floor(audioDuration / 60)} minutes and ${audioDuration % 60} seconds.` : ''}

## 2. Key Points Discussed
List the main topics, requests, or issues raised during the call as factual bullet points. State what was said, not how it was said.

## 3. Actions or Outcomes
List any commitments made, next steps agreed, referrals mentioned, appointments booked, or resolutions reached during the call. If none were identified, state "No specific actions or outcomes were identified in the transcript."

## 4. Call Statistics
- **Word count**: ${transcript.split(/\\s+/).length} words transcribed
${audioDuration ? `- **Call duration**: approximately ${Math.floor(audioDuration / 60)} minutes ${audioDuration % 60} seconds` : '- **Call duration**: not available'}
- **Number of speakers**: estimate based on the transcript content
${valueJudgementsSection}

Keep each section concise. Do not fabricate details not present in the transcript.`;

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

    console.log(`✅ AI call summary generated for ${fileName}`);

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
