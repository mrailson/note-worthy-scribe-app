import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { generateMeetingDocxBase64, generateMeetingFilename } from "../_shared/generateMeetingDocx.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple markdown to HTML converter (since we can't use 'marked' in Deno edge functions)
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Code
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Line breaks and paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  // Lists (basic support)
  html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');

  // Wrap in paragraph tags
  if (!html.includes('<p>')) {
    html = '<p>' + html + '</p>';
  }

  return html;
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { markdown, filename, meetingId, title } = body || {};

    if (typeof markdown !== "string" || !markdown.trim()) {
      return new Response(JSON.stringify({ error: "Body requires { markdown: string }" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── NHS-styled meeting docx path (footer w/ model stamp) ───────────────
    // When the caller supplies meetingId, route through the shared
    // generateMeetingDocxBase64 helper so the output matches the in-app
    // styling and carries the model-provenance footer.
    if (meetingId && typeof meetingId === 'string') {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );

        const { data: meeting } = await supabase
          .from('meetings')
          .select('id, title, start_time, duration_minutes, participants, meeting_format, meeting_location, notes_model_used')
          .eq('id', meetingId)
          .maybeSingle();

        const startTime = meeting?.start_time ? new Date(meeting.start_time as string) : null;
        const meetingDate = startTime
          ? startTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          : undefined;
        const meetingTime = startTime
          ? startTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT'
          : undefined;
        const attendees = Array.isArray(meeting?.participants) && (meeting!.participants as any[]).length > 0
          ? (meeting!.participants as any[]).join(', ')
          : undefined;

        const cleanTitle = (title || meeting?.title || 'Meeting Notes') as string;

        const base64Content = await generateMeetingDocxBase64({
          summaryContent: markdown,
          title: cleanTitle,
          details: {
            date: meetingDate,
            time: meetingTime,
            location: (meeting as any)?.meeting_format || (meeting as any)?.meeting_location || undefined,
            attendees,
          },
          modelUsed: (meeting as any)?.notes_model_used || undefined,
        });

        const outFilename = generateMeetingFilename(cleanTitle, startTime || new Date(), 'docx');
        const bytes = base64ToUint8Array(base64Content);

        return new Response(bytes, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${outFilename}"`,
          },
        });
      } catch (mErr) {
        console.error('⚠️ meeting-docx path failed, falling back to legacy HTML export:', mErr);
        // fall through to legacy renderer below
      }
    }

    // ── Legacy non-meeting HTML-as-.doc path (unchanged behaviour) ─────────
    console.log('Converting markdown to HTML...');
    const html = markdownToHtml(markdown);

    console.log('Creating Word document...');
    const page = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; line-height: 1.4; }
  h1,h2,h3,h4 { margin: 0.6em 0 0.25em; color: #2c3e50; }
  h1 { font-size: 24px; }
  h2 { font-size: 20px; }
  h3 { font-size: 16px; }
  p { margin: 0.3em 0 0.6em; }
  table { border-collapse: collapse; width: 100%; margin: 0.6em 0; }
  th, td { border: 1px solid #bbb; padding: 8px 12px; vertical-align: top; }
  th { background-color: #f8f9fa; font-weight: bold; }
  ul, ol { margin: 0.3em 0 0.6em 1.25em; }
  li { margin: 0.2em 0; }
  code { font-family: 'Courier New', monospace; background-color: #f1f1f1; padding: 2px 4px; }
  strong { font-weight: bold; }
  em { font-style: italic; }
</style>
</head><body>${html}</body></html>`;

    const encoder = new TextEncoder();
    const fileBuffer = encoder.encode(page);

    const safe = (filename || "meeting-notes").replace(/[^a-z0-9\-_]+/gi, "-");

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/msword",
        "Content-Disposition": `attachment; filename="${safe}.doc"`,
      },
    });

  } catch (error) {
    console.error('Error in export-docx function:', error);
    return new Response(JSON.stringify({ error: (error as any).message || 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
