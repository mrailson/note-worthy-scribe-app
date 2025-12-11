import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// TONE OPTIMISER v4.0 — UNIVERSAL, GOVERNANCE-SAFE VERSION
const SYSTEM_PROMPT = `You are an NHS governance editor responsible for ensuring that meeting minutes are professionally worded, neutral, and suitable for circulation to ICBs, partner organisations (e.g., PML, NHFT), Boards, auditors, and external regulators.

You must transform the text into a fully governance-safe, diplomatically worded document that contains no personal identifiers, no emotional language, no adversarial tone, no metaphors, and no informal expressions, while strictly preserving the factual meaning, decisions, actions, and risks.

Your purpose is to eliminate organisational risk by ensuring the minutes reflect the language style expected for:

NHS Board Packs

ICB Governance Papers

Audit Committee papers

FOI-disclosable documents

CQC evidence

Inter-practice and cross-Federation communication

NEVER remove facts, decisions, actions, risks, dates, or operational details — only adjust tone.`;

const USER_PROMPT_TEMPLATE = `Rewrite the following meeting-minutes text to make it fully NHS governance-safe, applying ALL rules below:

🔹 1. Remove adversarial, political, or critical language

Replace any wording implying:

blame

misconduct

financial motives

organisational conflict

aggression

"takeovers"

"redundancy" or "uselessness"

criticism of PML, NHFT, ICB, or any partner organisation

implication that an organisation is "extracting money", "seeking relevance", or "encroaching"

Rewrite into neutral, factual alternatives such as:

"members discussed concerns regarding alignment with PCN priorities…"

"operational challenges were noted…"

"potential future organisational changes were discussed…"

🔹 2. Remove metaphors, idioms, or vivid / dramatic speech

Identify and rewrite phrases such as:

"wolf ready to pounce"

"catch 22"

"lip service"

"playing both sides"

"fast and positioned-filled"

"touchy-feely issues"

Replace with:

"members expressed concern about…"

"noted constraints…"

"discussed the need to maintain constructive engagement…"

🔹 3. Remove informal quotations or conversational fragments

Eliminate direct quotes of informal remarks such as:

"more money, less hours"

"Super 10"

"unprofessional behaviour"

"strictly sticking to templates"

Convert them into:

"the candidate expressed a preference for alternative working arrangements"

"feedback highlighted opportunities to broaden the scope of practice"

🔹 4. Remove personal identifiers or sensitive references

Replace staff-specific or personal statements, such as:

names of staff in performance discussions

family relationships

private circumstances

With role-based descriptors:

"a pharmacist"

"a candidate for the role"

"an FCP"

Never include personal health, behaviour, personal relationships, or quotes about individuals.

🔹 5. Recast performance or capability issues using neutral governance language

Replace:

"failed a prescribing course"
→ "has not yet completed the prescribing qualification"

"lack of holistic care"
→ "feedback indicated opportunities to broaden the approach"

"displayed unprofessional behaviour"
→ "areas for development were noted"

🔹 6. Neutralise strong opinions or emotional tone

Replace:

"significant frustration"

"severe concerns"

"negative experiences"

"threat to autonomy"

With:

"operational challenges were noted"

"members expressed concerns"

"previous issues were acknowledged"

🔹 7. Maintain strict governance style

Use:

"members discussed…"

"the group noted…"

"concerns were raised…"

"options were explored…"

"it was agreed that…"

Avoid:

informal language

emotive verbs (e.g., "criticised", "blamed", "argued")

speculation or assumptions

🔹 8. Preserve structure and factual content

Do NOT remove:

decisions

actions

dates

financial figures

estates/legal/contracting details

workforce details

risks

Only adjust phrasing.

🔹 9. Final output must be suitable for:

publication in a Board Pack

circulation to the ICB

sharing with NHFT or PML

FOI response

CQC review

---

INPUT:

{{minutes_text}}

---

OUTPUT:

Return only the rewritten governance-safe minutes, with no commentary.`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('🎯 tone-audit-optimiser v4.0 invoked at:', new Date().toISOString());

  try {
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const { minutes_text } = await req.json();

    if (!minutes_text) {
      throw new Error('minutes_text is required');
    }

    console.log(`📊 Input length: ${minutes_text.length} characters`);

    // Build the user prompt with the minutes text
    const userPrompt = USER_PROMPT_TEMPLATE.replace('{{minutes_text}}', minutes_text);

    console.log('📤 Sending request to OpenAI GPT-5...');
    const apiStartTime = Date.now();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 16000
      }),
    });

    const apiEndTime = Date.now();
    console.log(`⚡ OpenAI response received in: ${apiEndTime - apiStartTime}ms`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI error:', response.status, errorData);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      if (response.status === 402) {
        throw new Error('Insufficient OpenAI credits.');
      }
      
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('📋 Response structure:', JSON.stringify(data, null, 2).slice(0, 500));
    
    // GPT-5 uses output_text, fallback to message.content for older models
    const polished_minutes = data.output_text || data.choices?.[0]?.message?.content || '';

    console.log(`✅ Polished output length: ${polished_minutes.length} characters`);
    console.log(`⏱️ Total processing time: ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({ polished_minutes }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Error in tone-audit-optimiser:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
