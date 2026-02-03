import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface DrugMonograph {
  drugName: string;
  indications: string[];
  dosing: {
    adult: string;
    elderly?: string;
    renalAdjustment?: string;
    paediatric?: string;
  };
  contraindications: string[];
  cautions: string[];
  interactions: string[];
  sideEffects: {
    common: string[];
    serious: string[];
  };
  monitoring: string[];
  pregnancyBreastfeeding: string;
  patientCounselling: string[];
  bnfChapter?: string;
  lastUpdated?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { drugName } = await req.json();

    if (!drugName || typeof drugName !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Drug name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitise input
    const sanitisedDrugName = drugName.trim().substring(0, 100);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert NHS clinical pharmacist providing BNF (British National Formulary) drug information for UK healthcare professionals.

CRITICAL SAFETY RULES:
1. ONLY provide information that would be found in the official BNF
2. NEVER fabricate drug information, dosages, or interactions
3. Always include appropriate cautions and contraindications
4. Use UK spelling and terminology (e.g., "paediatric" not "pediatric")
5. If uncertain about any information, indicate this clearly
6. Always recommend verification with the official BNF

You must respond with a valid JSON object matching this exact structure:
{
  "drugName": "string",
  "indications": ["array of licensed indications"],
  "dosing": {
    "adult": "standard adult dosing",
    "elderly": "elderly adjustments if applicable",
    "renalAdjustment": "renal dose adjustments if applicable",
    "paediatric": "paediatric dosing if applicable"
  },
  "contraindications": ["absolute contraindications"],
  "cautions": ["relative cautions and warnings"],
  "interactions": ["clinically significant drug interactions"],
  "sideEffects": {
    "common": ["common side effects (>1%)"],
    "serious": ["serious side effects requiring attention"]
  },
  "monitoring": ["required monitoring"],
  "pregnancyBreastfeeding": "pregnancy and breastfeeding safety information",
  "patientCounselling": ["key counselling points for patients"],
  "bnfChapter": "BNF chapter classification"
}`;

    const userPrompt = `Provide comprehensive BNF monograph information for: ${sanitisedDrugName}

Include all standard BNF sections with accurate, current information based on UK prescribing guidelines.`;

    console.log(`BNF lookup requested for: ${sanitisedDrugName}`);

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
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for factual accuracy
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse JSON from response (handle markdown code blocks)
    let monograph: DrugMonograph;
    try {
      let jsonStr = content;
      
      // Remove markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      
      monograph = JSON.parse(jsonStr.trim());
      
      // Validate required fields
      if (!monograph.drugName || !monograph.indications || !monograph.dosing) {
        throw new Error("Invalid monograph structure");
      }
      
      // Add timestamp
      monograph.lastUpdated = new Date().toISOString();
      
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("Raw content:", content);
      throw new Error("Failed to parse drug information. Please try again.");
    }

    console.log(`BNF lookup successful for: ${sanitisedDrugName}`);

    return new Response(
      JSON.stringify({ 
        monograph,
        disclaimer: "This information is AI-generated from BNF guidelines. Always verify with the official BNF before prescribing."
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("BNF lookup error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to retrieve drug information" 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
