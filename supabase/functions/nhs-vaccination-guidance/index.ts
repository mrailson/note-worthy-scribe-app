import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_task } = await req.json();

    console.log('NHS Vaccination Guidance request:', { user_task });

    // Step 1: Fetch NHS England long-read page
    console.log('Fetching NHS England AW 2025/26 vaccination programme page...');
    
    const nhseResponse = await fetch(
      'https://www.england.nhs.uk/long-read/flu-and-covid-19-seasonal-vaccination-programme-autumn-winter-2025-26/',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NHS-Guidance-Bot/1.0)',
        },
        signal: AbortSignal.timeout(20000)
      }
    );

    if (!nhseResponse.ok) {
      throw new Error(`Failed to fetch NHS England page: ${nhseResponse.status}`);
    }

    const nhseHtml = await nhseResponse.text();
    console.log(`Successfully fetched NHS page (${nhseHtml.length} characters)`);

    // Step 2: Use OpenAI to parse and process the content
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const systemMessage = `You are an NHS UK primary care assistant for GPs. Use ONLY UK primary care sources.

PRIMARY SOURCE OF TRUTH (must be parsed FIRST and MUST NOT be contradicted):
NHS England long-read (AW 2025/26):
https://www.england.nhs.uk/long-read/flu-and-covid-19-seasonal-vaccination-programme-autumn-winter-2025-26/

RULES
1) Do not use generic web search. Rely on the fetched HTML passed in {{nhse_html}}. If it is empty or not retrievable, respond with:
   "Unable to fetch the NHS England AW 2025/26 vaccination programme page. Please try again later."
   and STOP.
2) Extract EXACT wording from the page sections:
   - "Eligibility" (COVID-19 cohorts)
   - "Programme dates" (COVID-19 and Flu timing)
   Paste those bullets VERBATIM (no rewording, no extra cohorts).
3) If the user's claim conflicts with the page, correct it politely and show the exact bullets with a citation to the same URL.
4) Output must begin with a short Verification Panel, then the answer, then a References block.
5) Style: UK GP tone, concise, factual; NHS/NICE compliant phrasing. No speculation.

OUTPUT FORMAT (strict)
Verification Panel:
- Source: NHS England long-read (AW 2025/26)
- URL: https://www.england.nhs.uk/long-read/flu-and-covid-19-seasonal-vaccination-programme-autumn-winter-2025-26/
- Last reviewed on page: <extract page "last updated" date if present, else write "not stated">
- Checked now: <today's date, Europe/London>

<Your answer or letter>

References:
- NHS England long-read (AW 2025/26): https://www.england.nhs.uk/long-read/flu-and-covid-19-seasonal-vaccination-programme-autumn-winter-2025-26/`;

    const userMessage = `Task: ${user_task}

Page HTML (source of truth):
${nhseHtml}

Steps:
1) Parse the HTML above.
2) Locate the "Eligibility" and "Programme dates" sections for AW 2025/26.
3) Paste those bullets verbatim into the output (no changes).
4) Answer the user_task based ONLY on those bullets.`;

    console.log('Sending request to OpenAI...');

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini',
        max_tokens: 2200,
        temperature: 0.2,
        top_p: 0.1,
        frequency_penalty: 0,
        presence_penalty: 0,
        messages: [
          {
            role: 'system',
            content: systemMessage
          },
          {
            role: 'user',
            content: userMessage
          }
        ]
      })
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const guidance = openaiData.choices[0].message.content;

    console.log('Successfully generated NHS vaccination guidance');

    return new Response(
      JSON.stringify({ 
        guidance,
        source_url: 'https://www.england.nhs.uk/long-read/flu-and-covid-19-seasonal-vaccination-programme-autumn-winter-2025-26/'
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );

  } catch (error) {
    console.error('Error in NHS vaccination guidance:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate NHS vaccination guidance',
        details: error.message,
        fallback_guidance: 'Unable to fetch the NHS England AW 2025/26 vaccination programme page. Please try again later or visit https://www.england.nhs.uk/long-read/flu-and-covid-19-seasonal-vaccination-programme-autumn-winter-2025-26/ directly.'
      }),
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );
  }
});