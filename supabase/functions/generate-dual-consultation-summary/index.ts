import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, consultationType = "face-to-face" } = await req.json();

    if (!transcript) {
      throw new Error('Transcript is required');
    }

    const systemPrompt = `You are an NHS GP Consultation Scribe.  
Generate a consultation summary with two levels of detail:  

1. **GP Shorthand (Concise View)** – formatted for quick notes in GP style.  
   - Use short codes (e.g., 2/7, ↑T, abdo N, CVS NAD).  
   - Bullet point style, minimal words.  
   - Focus on history, exam, assessment, and plan in tight shorthand.  

2. **Standard Detail (Full View)** – formatted in clear, professional prose for medico-legal notes.  
   - Full sentences where needed.  
   - Use bold section headers (**Chief Complaint, History, Examination, Assessment, Plan**).  
   - Keep layout tidy with spacing between sections.  
   - Use plain English, no unexplained abbreviations.  

The output must include **both versions**.

Example structure:

---
### GP Shorthand
- CC: URTI sx 3/7  
- Hx: Sore throat (↑ on swallow, am worse), blocked nose, cough → now productive, subj fever+chills y'day, headache, hoarse, fatigue. PCM helped partially.  
- Ex: Throat erythema, no exudate. B/L tender cerv LN. Chest clear, afebrile.  
- A: Viral URTI (common cold)  
- P: Rest, fluids, PCM prn, lozenges/honey drinks. Off work 1–2d. SR: return if ↑fever, chest sx, no improv 10d. No abx. Viral explained.

---
### Standard Detail
**Chief Complaint:** Upper respiratory tract symptoms for 3 days  

**History of Presenting Complaint:**  
- 3-day history of sore throat (severe, worse on swallowing, worse in mornings)  
- Blocked nose  
- Cough (initially dry, now productive of clear sputum)  
- Subjective fever with chills yesterday  
- Headache, hoarse voice, fatigue  
- Taking paracetamol with partial relief  

**Examination:**  
- Erythematous throat without exudate  
- Bilateral tender cervical lymphadenopathy  
- Clear chest on auscultation  
- Afebrile during consultation  

**Assessment:** Viral upper respiratory tract infection (common cold)  

**Plan:**  
- Conservative management with rest and fluids  
- Continue paracetamol as required for symptom relief  
- Throat lozenges, honey/lemon drinks for throat symptoms  
- Advise off work 1–2 days  
- Safety netting: return if symptoms worsen, high fever, chest symptoms, or no improvement after 10 days  
- No antibiotics prescribed – viral cause explained
---

Please generate both formats based on the provided transcript.`;

    const userPrompt = `Please analyze this ${consultationType} consultation transcript and generate both GP Shorthand and Standard Detail summaries:

${transcript}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;

    // Parse the generated content to separate GP Shorthand and Standard Detail
    const sections = generatedContent.split('### Standard Detail');
    const gpShorthandMatch = sections[0].match(/### GP Shorthand\s*([\s\S]*)/);
    const standardDetailContent = sections[1] || '';

    const gpShorthand = gpShorthandMatch ? gpShorthandMatch[1].trim() : '';
    const standardDetail = standardDetailContent.trim();

    return new Response(JSON.stringify({ 
      success: true,
      gpShorthand,
      standardDetail,
      fullContent: generatedContent
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-dual-consultation-summary function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});