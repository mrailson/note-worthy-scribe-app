import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patientId, question, conversationHistory, summaryJson, snomedJson, patientName, nhsNumber } = await req.json();

    console.log("LG Ask AI - Question:", question);
    console.log("Patient:", patientName, "NHS:", nhsNumber);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context from the extracted data
    let context = `You are a helpful AI assistant analysing a digitised Lloyd George medical record for a patient.\n\n`;
    context += `Patient: ${patientName || 'Unknown'}\n`;
    context += `NHS Number: ${nhsNumber || 'Unknown'}\n\n`;

    if (summaryJson) {
      context += `## Clinical Summary Extracted from Record:\n`;
      context += JSON.stringify(summaryJson, null, 2) + "\n\n";
    }

    if (snomedJson) {
      context += `## SNOMED CT Codes Extracted:\n`;
      if (Array.isArray(snomedJson)) {
        snomedJson.forEach((item: any) => {
          context += `- ${item.term || item.name} (Code: ${item.snomed_code || item.code}, Domain: ${item.domain || 'Unknown'}, Page: ${item.source_page || 'N/A'}, Confidence: ${item.confidence ? Math.round(item.confidence * 100) + '%' : 'N/A'})\n`;
        });
      } else if (snomedJson.items) {
        snomedJson.items.forEach((item: any) => {
          context += `- ${item.term || item.name} (Code: ${item.snomed_code || item.code}, Domain: ${item.domain || 'Unknown'}, Page: ${item.source_page || 'N/A'}, Confidence: ${item.confidence ? Math.round(item.confidence * 100) + '%' : 'N/A'})\n`;
        });
      }
      context += "\n";
    }

    context += `## Instructions:
- Answer questions about this patient's Lloyd George record based ONLY on the extracted data above.
- Always cite the source page number when available (e.g., "According to page 3...").
- If the information is not in the extracted data, say so clearly.
- Be concise but thorough.
- Use British English spelling.
- Format dates as DD/MM/YYYY.
- If asked about medications, diagnoses, or procedures, list them with their page references.
`;

    // Build messages array
    const messages = [
      { role: "system", content: context },
      ...(conversationHistory || []).map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: "user", content: question },
    ];

    console.log("Sending to Lovable AI...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please top up your Lovable AI credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "I could not generate a response.";

    console.log("Answer generated successfully");

    return new Response(
      JSON.stringify({ answer }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("LG Ask AI error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
