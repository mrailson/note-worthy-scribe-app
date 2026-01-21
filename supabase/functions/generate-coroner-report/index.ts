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

    // Step 1: Pre-flight validation - check if documents are legitimate clinical content
    console.log("Running pre-flight document validation...");
    
    const validationPrompt = `You are a medical document validator. Analyse the following content and determine if it contains legitimate clinical or medical documentation suitable for a Coroner's Report.

VALIDATION CRITERIA:
1. Contains recognisable medical/clinical terminology
2. References patient care, treatments, diagnoses, or clinical events
3. Has coherent structure (dates, times, clinical notes, or medical records)
4. Is not random text, gibberish, lorem ipsum, or unrelated content
5. Contains information relevant to a death investigation or clinical timeline

Respond with ONLY a JSON object in this exact format:
{
  "isValid": true/false,
  "confidence": 0-100,
  "documentType": "brief description of what the documents appear to be",
  "concerns": ["list of any concerns about document quality or authenticity"],
  "recommendation": "PROCEED" or "REJECT" or "REVIEW_REQUIRED"
}

If the content is clearly not medical documentation (e.g., random text, unrelated content, gibberish), set isValid to false and recommendation to "REJECT".
If the content has some medical elements but quality concerns, set recommendation to "REVIEW_REQUIRED".
Only set recommendation to "PROCEED" if confident the documents are legitimate clinical records.`;

    const validationResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: validationPrompt },
          { role: "user", content: `Validate this document content:\n\n${documentContent.substring(0, 10000)}` },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!validationResponse.ok) {
      console.error("Validation request failed:", validationResponse.status);
      // Continue with report generation if validation fails - don't block on validation errors
    } else {
      const validationData = await validationResponse.json();
      const validationResult = validationData.choices?.[0]?.message?.content;
      
      if (validationResult) {
        console.log("Validation result:", validationResult);
        
        try {
          // Parse the JSON response, handling potential markdown code blocks
          let jsonStr = validationResult.trim();
          if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
          }
          
          const validation = JSON.parse(jsonStr);
          
          if (validation.recommendation === "REJECT") {
            console.log("Document validation REJECTED:", validation.concerns);
            return new Response(
              JSON.stringify({ 
                error: "Document validation failed",
                validationDetails: {
                  isValid: validation.isValid,
                  confidence: validation.confidence,
                  documentType: validation.documentType,
                  concerns: validation.concerns,
                  message: "The uploaded documents do not appear to contain legitimate clinical or medical documentation. Please upload genuine clinical records, medical notes, or relevant healthcare documentation."
                }
              }),
              { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          if (validation.recommendation === "REVIEW_REQUIRED") {
            console.log("Document validation requires review:", validation.concerns);
            // Continue but log the concerns - could be extended to return warnings to the user
          }
          
          console.log("Document validation PASSED - proceeding with report generation");
        } catch (parseError) {
          console.error("Failed to parse validation response:", parseError);
          // Continue with report generation if parsing fails
        }
      }
    }

    // Step 2: Generate the Coroner's Report
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
        model: "google/gemini-3-pro-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 12000,
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
