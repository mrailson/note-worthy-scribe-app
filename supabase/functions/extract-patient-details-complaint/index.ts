import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "Text content is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a UK NHS patient data extraction assistant. Your task is to extract patient demographic information from the provided text.

Extract ONLY the following fields if present:
- patient_name: The patient's full name
- patient_dob: Date of birth (convert to YYYY-MM-DD format if possible)
- patient_nhs_number: UK NHS number (10 digits, may be formatted as XXX XXX XXXX)
- patient_contact_phone: Phone number (UK format preferred)
- patient_contact_email: Email address
- patient_address: Full postal address

IMPORTANT:
- Only extract data that is clearly present in the text
- Do not make up or guess any information
- NHS numbers should be returned as just digits (no spaces)
- Dates should be in YYYY-MM-DD format if you can determine the full date
- If only partial date info is available (e.g., just year), include what's available
- Return null for any field not found in the text

Respond ONLY with a valid JSON object containing the extracted fields.`;

    const userPrompt = `Extract patient details from the following text:

${text}`;

    console.log("Calling Lovable AI Gateway for patient extraction...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("AI response:", content);

    // Parse the JSON from the response
    let extractedData;
    try {
      // Try to extract JSON from the response (may be wrapped in markdown code blocks)
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                        content.match(/(\{[\s\S]*\})/);
      
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[1]);
      } else {
        extractedData = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      extractedData = {};
    }

    // Clean and validate NHS number if present
    if (extractedData.patient_nhs_number) {
      // Remove all non-digit characters
      extractedData.patient_nhs_number = extractedData.patient_nhs_number.replace(/\D/g, "");
      
      // Validate it's 10 digits
      if (extractedData.patient_nhs_number.length !== 10) {
        extractedData.patient_nhs_number = null;
      }
    }

    console.log("Extracted patient data:", extractedData);

    return new Response(
      JSON.stringify({
        success: true,
        patientData: {
          patient_name: extractedData.patient_name || null,
          patient_dob: extractedData.patient_dob || null,
          patient_nhs_number: extractedData.patient_nhs_number || null,
          patient_contact_phone: extractedData.patient_contact_phone || null,
          patient_contact_email: extractedData.patient_contact_email || null,
          patient_address: extractedData.patient_address || null,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in extract-patient-details-complaint:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to extract patient details" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
