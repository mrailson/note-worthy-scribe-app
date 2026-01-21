import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentContent, additionalContext } = await req.json();

    if (!documentContent) {
      return new Response(
        JSON.stringify({ error: "No document content provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an expert medical-legal report writer specialising in UK coronial inquests. Your task is to generate a comprehensive, structured Coroner's Report based on the provided clinical documentation.

## Report Structure

Generate the report using this standardised UK coronial format:

### CORONER'S REPORT

**Case Reference:** [Generate appropriate reference]
**Date of Report:** [Current date in DD/MM/YYYY format]
**Prepared by:** [Leave as "Reporting Clinician"]

---

#### 1. INTRODUCTION
- Brief overview of the case and purpose of this report
- State your qualifications and basis for providing this report (leave as placeholder)

#### 2. CHRONOLOGICAL SUMMARY OF EVENTS
- Timeline of key clinical events in date order
- Include dates, times where available
- Note all significant medical contacts and interventions

#### 3. CLINICAL HISTORY
- Relevant past medical history
- Medications
- Known conditions and comorbidities
- Previous investigations and treatments

#### 4. CIRCUMSTANCES LEADING TO DEATH
- Detailed narrative of the final illness/events
- Clinical presentation and deterioration
- Treatments provided
- Response to treatment

#### 5. CAUSE OF DEATH
- Based on the available documentation
- List in order: 1a, 1b, 1c, 2 (contributory factors)
- Note if cause is uncertain or requires post-mortem clarification

#### 6. KEY CLINICAL FINDINGS
- Relevant investigation results
- Examination findings
- Imaging results

#### 7. ANALYSIS AND OPINION
- Clinical interpretation of events
- Whether care was appropriate
- Any factors that may have contributed to the outcome
- Areas requiring clarification

#### 8. AREAS FOR CORONIAL CONSIDERATION
- Specific questions the Coroner may wish to explore
- Any concerns about care
- Matters requiring expert opinion

#### 9. DOCUMENTS REVIEWED
- List of all documents analysed for this report

---

## Guidelines:
- Use British English spelling and medical terminology
- Be factual and objective - avoid speculation
- Clearly distinguish between facts and opinions
- Flag any gaps in documentation
- Use appropriate medical terminology with lay explanations where helpful
- Maintain a formal, professional tone suitable for court proceedings
- If information is missing or unclear, state this explicitly
- Do NOT fabricate or assume facts not present in the documents`;

    const userPrompt = `Please generate a comprehensive Coroner's Report based on the following case documents:

${documentContent}

${additionalContext ? `\n\nAdditional Context/Focus Areas:\n${additionalContext}` : ''}

Generate a complete, structured report following the coronial format. Be thorough but concise, highlighting all clinically relevant information.`;

    console.log("Generating coroner's report...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();
    const report = data.choices?.[0]?.message?.content;

    if (!report) {
      throw new Error("No report generated");
    }

    console.log("Report generated successfully, length:", report.length);

    return new Response(
      JSON.stringify({ report }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating coroner's report:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
