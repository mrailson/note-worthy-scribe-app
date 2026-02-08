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

    const analysisPrompt = `You are a supportive, empathetic reviewer analysing a transcribed phone call or audio recording uploaded as evidence in an NHS GP practice complaint investigation.

YOUR PRIMARY PURPOSE is to support the wellbeing and professional development of frontline staff. GP practice staff work under extraordinary pressure — high workloads, emotional encounters, and complex situations. Your review must reflect understanding and compassion for that reality.

ABSOLUTE RULES:
- NEVER criticise individual staff members explicitly or implicitly
- NEVER use words like "failed", "poorly", "lacked", "inadequate", "unprofessional", "dismissive", "combative", "argumentative", "condescending", or "provocative" to describe staff behaviour
- NEVER say staff "should have", "needed to", or "must" do something
- ALWAYS lead every section with genuine positives — what went well, what was commendable
- Frame ALL improvement areas as gentle, optional, forward-looking suggestions using phrases like "the practice may wish to consider", "one approach that some practices find helpful is", "it could be worth exploring", or "a future consideration might be"
- Recognise that staff may have been under significant pressure, managing competing demands, or dealing with an exceptionally difficult situation
- If the interaction was challenging, acknowledge this compassionately and commend staff resilience

TRANSCRIPT:
${transcript.substring(0, 12000)}

Provide a structured analysis covering the following areas. Use British English throughout. Separate each section clearly with blank lines between paragraphs for readability.

## 1. Call Summary
2-3 sentences: What was the call about? Who appears to be speaking? Keep this purely factual.

## 2. What Was Done Well
This is the MOST IMPORTANT section. Identify and celebrate positive aspects — professionalism, patience, following procedure, offering solutions, remaining calm, showing empathy, clear communication, or any other commendable behaviour. Be specific and generous with recognition. Even in difficult calls, staff almost always demonstrate positive qualities worth highlighting.

## 3. Tone Assessment

**Caller/Patient Tone:** Describe the caller's tone factually (e.g. calm, distressed, frustrated, anxious). If the caller was challenging, acknowledge this with empathy — patients may be anxious, unwell, frightened, or distressed.

**Staff Tone:** Lead with positives. Highlight professionalism, patience, and composure. If the call was emotionally demanding, recognise the difficulty of maintaining composure under pressure. Avoid negative characterisations of staff tone entirely — instead, note the challenging circumstances they navigated.

## 4. How the Interaction Was Managed
Highlight good practice first — any attempts to help, follow procedure, offer alternatives, or resolve the situation. If there are areas where the approach could be enhanced for future interactions, frame these purely as optional suggestions the practice may wish to explore. Never frame this as criticism.

## 5. Patient Behaviour
Note the patient's behaviour factually and with empathy. If behaviour was challenging, acknowledge the context — patients often act out of fear, frustration, or distress. If behaviour was reasonable, state that warmly.

## 6. Staff Wellbeing Considerations
This section is essential. Acknowledge the emotional demands placed on staff during this interaction. Recognise any signs of pressure, difficult circumstances, or challenging behaviour they managed with professionalism. Commend resilience. Consider recommending wellbeing support if the interaction was particularly demanding.

## 7. Constructive Suggestions for Future Practice
Offer gentle, forward-looking suggestions framed as optional opportunities. Use phrases like "the practice may wish to consider", "some practices find it helpful to", "it could be beneficial to explore". These must feel supportive and empowering, not punitive or directive. Limit to 2-3 suggestions maximum.

## 8. Learning & Development Opportunities
Frame these positively as professional growth opportunities, not remediation. For example, "the team may enjoy exploring refresher training on X" rather than "staff need training". If no gaps are apparent, warmly commend existing skills and suggest the team continue their excellent approach.

Keep each section to 2-4 sentences. Do not fabricate details. Always lead with positives. The overall tone of this review should leave a reader feeling that staff are valued, supported, and appreciated.`;

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
