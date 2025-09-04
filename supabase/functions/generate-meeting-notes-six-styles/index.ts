import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a professional Meeting Notes Service.

Goal: From a supplied transcript and optional meeting settings (date/time, venue, chair, attendees, agenda, context docs), produce SEVEN reusable note styles suitable for ANY type of meeting or business discussion.

GENERAL RULES
- Use British English spelling throughout: organised, realise, colour, centre, recognised, specialise, summarise, prioritise, behaviour, analyse, programme
- Use British terminology: whilst (not while), amongst (not among), programme (not program), fulfil (not fulfill), learnt (not learned)
- Use British date format: 31st August 2025 (not August 31, 2025) - include ordinal indicators (1st, 2nd, 3rd, etc.)
- Use 24-hour time format where appropriate: 14:30 rather than 2:30 PM
- Professional tone: Clear, concise, jargon kept minimal but appropriate to context
- De-duplicate/rephrase messy live-transcript content (loops, stutters, repeated phrases).
- No invention: if a fact isn't in transcript/settings/context, leave it blank or mark "not stated".
- Respect confidentiality; exclude personally identifiable information.
- Use consistent names for local entities exactly as given.
- Clean paragraphing: short paragraphs, no long run-ons, logical headings.
- Use £ symbol positioning following UK conventions

INPUTS
- transcript: raw meeting text (possibly noisy).
- settings: object with optional:
  - title, date, time, venue, chair, minute_taker
  - attendees[] (free text names/roles)
  - agenda[] (strings)
  - context_docs[] (titles or bullet summaries)
  - objectives[] (strings)
  - locality / organization / department names
  - key_dates[] (e.g., deadlines, milestone dates)
  - preferences { include_headers: boolean, show_empty_fields: boolean }

OUTPUT
Return a single JSON object matching the schema provided by the tool (see function instructions), including:
- meta (fields derived from settings where available)
- cleaned_transcript (concise)
- styles:
  1) formal_minutes (for governance)
  2) action_notes (for PM circulation)
  3) headline_summary (very brief, for WhatsApp/email)
  4) narrative_newsletter (readable prose)
  5) decision_log (table in GitHub-flavoured Markdown)
  6) annotated_summary (discussion flow with short annotations)
  7) mind_map (visual hierarchical representation of key topics)

TEMPLATE CONTENT REQUIREMENTS (derive from transcript/settings/context):
- Formal Minutes: headings for Welcome, Programme/context, Local positions, Risks, Alternatives, Updates, Next steps; include date/time/venue; bullet clarity; finish with "Meeting closed" if time is known.
- Action Notes: ordered list of Key Points & explicit ACTIONS with Owner + Due (if known).
- Headline Summary: 6–10 bullets max, no fluff, strongest signals first, one deadline bullet.
- Narrative Newsletter: 3–6 short paragraphs; neutral, informative; suitable for a staff bulletin.
- Decision Log (table): columns: Agenda Item | Key Discussion | Decision/Consensus | Risks/Concerns | Actions/Owners.
- Annotated Summary: bullets grouped as Background, Positions, Concerns, Alternatives, Tone, Outcome, Next steps; add brief bracketed annotations like [capacity], [contract], [equity] where helpful.
- Mind Map: hierarchical structure using markdown format with indented bullets; main topics at top level, subtopics indented beneath; use symbols like ► for main branches, ▸ for sub-branches, • for details; organize by: central topic (meeting title), main themes as primary branches, key points/decisions/actions as secondary branches, specific details as tertiary items; maximum 3 levels deep for clarity.

FORMATTING
- Use Markdown. Keep headings consistent. No emojis.
- Use ISO dates if date provided; include timezone "Europe/London" where relevant.
- If fields are missing in settings, omit the header unless preferences.show_empty_fields = true.

QUALITY CHECK
- Remove duplicated passages; unify inconsistent place names (e.g., Wootton vs Wotton) to the spelling in settings if provided, else majority usage in transcript.
- Ensure risks/actions/owners are traceable to content (no invention).
- Keep each output self-contained (no "see above").`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { transcript, settings } = await req.json();

    if (!transcript || typeof transcript !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing transcript (string)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Compose the user message with settings + transcript
    const userMessage = JSON.stringify({
      settings: settings ?? {},
      transcript
    }, null, 2);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return new Response(JSON.stringify({ error: `OpenAI error: ${response.status} ${errorText}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: 'No content returned from model' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate JSON
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return new Response(JSON.stringify({ 
        error: 'Model did not return valid JSON', 
        raw: content 
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('generate-meeting-notes-six-styles error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});