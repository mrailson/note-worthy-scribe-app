import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map frontend styles to meetings table columns
const styleColumnMap: Record<string, keyof any> = {
  detailed: 'notes_style_2',
  comprehensive: 'notes_style_3',
  executive: 'notes_style_4',
};

// Prompts per style (concise, British English with NHS/UK tone)
function buildSystemPrompt(style: 'detailed' | 'comprehensive' | 'executive') {
  const common = `You are an expert NHS/UK meeting scribe. Use British English spelling and professional tone.
- Use headings and bullet points.
- Include actions with owners and deadlines (24-hour times, dates with ordinal, e.g. 12th September 2025).
- Focus on decisions, clinical/governance items, practice/PCN impact, risks, and next steps.`;
  if (style === 'executive') {
    return `${common}\n\nCreate an EXECUTIVE SUMMARY for GP partners and practice management. Keep punchy and decision-focused.`;
  }
  if (style === 'detailed') {
    return `${common}\n\nCreate DETAILED minutes capturing operational agreements, resource implications, and outcomes.`;
  }
  return `${common}\n\nCreate VERY DETAILED (comprehensive) minutes with thorough context and clear structure.`;
}

function buildUserPrompt(title: string, transcript: string, style: string) {
  return `Meeting: ${title || 'Meeting'}\nStyle: ${style}\n\nTranscript:\n${transcript}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!openAIApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { meetingIds, styles, forceRegenerate = true } = await req.json();

    if (!Array.isArray(meetingIds) || meetingIds.length === 0) {
      return new Response(JSON.stringify({ error: 'meetingIds array is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!Array.isArray(styles) || styles.length === 0) {
      return new Response(JSON.stringify({ error: 'styles array is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const validStyles = styles.filter((s: string) => ['detailed', 'comprehensive', 'executive'].includes(s));
    if (validStyles.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid styles provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results: any[] = [];

    for (const meetingId of meetingIds) {
      try {
        // Fetch meeting title
        const { data: meeting, error: meetErr } = await supabase
          .from('meetings')
          .select('id, title')
          .eq('id', meetingId)
          .maybeSingle();
        if (meetErr) throw meetErr;
        if (!meeting) throw new Error('Meeting not found');

        // Get transcript via RPC helper
        const { data: transcriptRows, error: trxErr } = await supabase
          .rpc('get_meeting_full_transcript', { p_meeting_id: meetingId });
        if (trxErr) throw trxErr;
        const transcript: string = transcriptRows?.[0]?.transcript || '';
        if (!transcript || !transcript.trim()) {
          results.push({ meetingId, success: false, error: 'No transcript available' });
          continue;
        }

        // Generate sequentially per style to stay predictable
        const styleOutputs: Record<string, string> = {};
        for (const style of validStyles as Array<'detailed' | 'comprehensive' | 'executive'>) {
          try {
            const sys = buildSystemPrompt(style);
            const usr = buildUserPrompt(meeting.title, transcript, style);

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openAIApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: sys },
                  { role: 'user', content: usr }
                ],
                max_tokens: 2200,
                temperature: 0.7,
              }),
            });

            const data = await response.json();
            if (!response.ok) {
              const msg = data?.error?.message || 'OpenAI error';
              throw new Error(msg);
            }

            const content: string = data.choices?.[0]?.message?.content || '';
            styleOutputs[style] = content;

            // Update meetings table column for this style
            const column = styleColumnMap[style];
            if (column) {
              const updatePayload: Record<string, any> = { [column]: content, updated_at: new Date().toISOString() };
              const { error: updErr } = await supabase
                .from('meetings')
                .update(updatePayload)
                .eq('id', meetingId);
              if (updErr) throw updErr;
            }
          } catch (styleErr: any) {
            results.push({ meetingId, style, success: false, error: styleErr.message });
          }
        }

        results.push({ meetingId, success: true, generated: Object.keys(styleOutputs) });
      } catch (err: any) {
        results.push({ meetingId, success: false, error: err.message });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.length - successful;

    return new Response(JSON.stringify({ message: 'Notes styles processed', results, successful, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error in generate-notes-styles:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
