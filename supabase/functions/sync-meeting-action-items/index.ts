import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ActionItem {
  id: string;
  action_text: string;
  assignee_name: string;
  due_date: string;
  priority: string;
  status: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { meetingId } = await req.json();

    if (!meetingId) {
      return new Response(
        JSON.stringify({ error: 'Meeting ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Syncing action items for meeting: ${meetingId}`);

    // Fetch all action items for this meeting (minimal columns for performance)
    const { data: actionItems, error: fetchError } = await supabase
      .from('meeting_action_items')
      .select('id, action_text, assignee_name, due_date, priority, status, sort_order')
      .eq('meeting_id', meetingId)
      .order('sort_order', { ascending: true });

    if (fetchError) {
      console.error('Error fetching action items:', fetchError);
      throw fetchError;
    }

    // Fetch the current meeting summary (if it exists)
    const { data: summaryRow, error: summaryError } = await supabase
      .from('meeting_summaries')
      .select('summary')
      .eq('meeting_id', meetingId)
      .maybeSingle();

    if (summaryError) {
      console.error('Error fetching summary:', summaryError);
      throw summaryError;
    }

    // If no meeting_summaries row yet, fall back to the latest saved Standard minutes on the meeting row.
    const baseSummary = summaryRow?.summary ?? (await (async () => {
      const { data: meetingRow } = await supabase
        .from('meetings')
        .select('notes_style_3')
        .eq('id', meetingId)
        .maybeSingle();

      return meetingRow?.notes_style_3 ?? '';
    })());

    // Generate the new action items markdown section
    const actionItemsMarkdown = generateActionItemsMarkdown(actionItems || []);

    // Update the summary with new action items section (or create it if missing)
    const updatedSummary = updateActionItemsInSummary(baseSummary, actionItemsMarkdown);

    // Upsert meeting_summaries table
    const { error: upsertError } = await supabase
      .from('meeting_summaries')
      .upsert(
        {
          meeting_id: meetingId,
          summary: updatedSummary,
          action_items: (actionItems || []).map((item) => item.action_text),
          key_points: [],
          decisions: [],
          next_steps: [],
          ai_generated: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'meeting_id' }
      );

    if (upsertError) {
      console.error('Error upserting summary:', upsertError);
      throw upsertError;
    }

    // ALSO update meetings.notes_style_3 so the main Notes modal shows the synced action items immediately
    const { error: meetingUpdateError } = await supabase
      .from('meetings')
      .update({ notes_style_3: updatedSummary })
      .eq('id', meetingId);

    if (meetingUpdateError) {
      console.warn('Warning: Could not update meetings.notes_style_3:', meetingUpdateError);
      // Don't throw - the main upsert succeeded
    }

    console.log(`Successfully synced ${actionItems?.length || 0} action items`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        syncedCount: actionItems?.length || 0,
        updatedSummary: updatedSummary,
        meetingUpdated: !meetingUpdateError
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function generateActionItemsMarkdown(actionItems: ActionItem[]): string {
  if (actionItems.length === 0) {
    return '## Action Items\n\nNo action items recorded for this meeting.\n';
  }

  let markdown = '## Action Items\n\n';
  
  const openItems = actionItems.filter(i => i.status !== 'Completed');
  const completedItems = actionItems.filter(i => i.status === 'Completed');

  // Track unique actions to prevent duplicates
  const seenActions = new Set<string>();

  for (const item of openItems) {
    const actionKey = item.action_text.toLowerCase().trim();
    if (seenActions.has(actionKey)) continue;
    seenActions.add(actionKey);

    const assignee = item.assignee_name !== 'TBC' ? ` — @${item.assignee_name}` : '';
    const dueDate = item.due_date !== 'TBC' ? ` (${item.due_date})` : '';
    const priority = ` [${item.priority || 'Medium'}]`;
    const status = ` {Open}`;
    
    markdown += `- ${item.action_text}${assignee}${dueDate}${priority}${status}\n`;
  }

  if (completedItems.length > 0) {
    markdown += '\n**Completed Items:**\n\n';
    for (const item of completedItems) {
      const actionKey = item.action_text.toLowerCase().trim();
      if (seenActions.has(actionKey)) continue;
      seenActions.add(actionKey);

      const assignee = item.assignee_name !== 'TBC' ? ` — @${item.assignee_name}` : '';
      markdown += `- ~~${item.action_text}~~${assignee} [Completed] {Done}\n`;
    }
  }

  return markdown;
}

function updateActionItemsInSummary(summary: string, newActionItemsSection: string): string {
  const sectionLines = newActionItemsSection.trimEnd().split(/\r?\n/);

  const original = (summary ?? '').toString();
  const lines = original.split(/\r?\n/);

  // Matches "## Action Items" or "# Action Items" (case-insensitive)
  const isActionItemsHeading = (line: string) =>
    /^#{1,3}\s*action\s+items?\s*:?\s*$/i.test(line.trim());

  // Matches action-related sub-headings that should be skipped during cleanup
  const isActionRelatedContent = (line: string) => {
    const trimmed = line.trim().toLowerCase();
    return (
      /^#{1,4}\s*(completed|open|pending|in\s*progress)\s*(items?)?\s*:?\s*$/i.test(trimmed) ||
      /^\*\*completed\s*items?\*\*\s*:?\s*$/i.test(trimmed) ||
      /^-\s*(~~)?.*?(~~)?\s*(?:—|–|-)\s*@/.test(line) || // Action item bullet
      /^-\s*\[.*?\]/.test(line) // Checkbox-style action item
    );
  };

  // Main section headings that signal END of action items section
  // Must be ## or # AND not be action-related
  const isNewMainSection = (line: string) => {
    const trimmed = line.trim();
    if (!/^#{1,2}\s+\S/.test(trimmed)) return false;
    // Exclude action-related headings
    if (/action\s+items?|completed|open|pending/i.test(trimmed)) return false;
    return true;
  };

  const out: string[] = [];
  let inserted = false;
  let skipping = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Start skipping when we hit an Action Items heading
    if (isActionItemsHeading(line)) {
      if (!inserted) {
        // Insert the new section once
        if (out.length && out[out.length - 1].trim() !== '') out.push('');
        out.push(...sectionLines);
        out.push('');
        inserted = true;
      }
      skipping = true;
      continue;
    }

    // Stop skipping when we hit a new main section (not action-related)
    if (skipping && isNewMainSection(line)) {
      skipping = false;
    }

    // Skip lines while in skipping mode
    if (skipping) {
      continue;
    }

    out.push(line);
  }

  // Remove excessive blank lines and clean up
  let cleaned = out.join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/(\*\*Completed Items:\*\*\s*\n\s*)+/gi, '**Completed Items:**\n') // Dedupe completed headers
    .trimEnd();

  if (!inserted) {
    return cleaned ? `${cleaned}\n\n${newActionItemsSection.trimEnd()}\n` : `${newActionItemsSection.trimEnd()}\n`;
  }

  return cleaned + '\n';
}
