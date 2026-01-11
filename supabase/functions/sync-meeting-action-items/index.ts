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

    // Fetch all action items for this meeting
    const { data: actionItems, error: fetchError } = await supabase
      .from('meeting_action_items')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('sort_order', { ascending: true });

    if (fetchError) {
      console.error('Error fetching action items:', fetchError);
      throw fetchError;
    }

    // Fetch the current meeting summary
    const { data: summary, error: summaryError } = await supabase
      .from('meeting_summaries')
      .select('summary')
      .eq('meeting_id', meetingId)
      .single();

    if (summaryError && summaryError.code !== 'PGRST116') {
      console.error('Error fetching summary:', summaryError);
      throw summaryError;
    }

    // Generate the new action items markdown section
    const actionItemsMarkdown = generateActionItemsMarkdown(actionItems || []);

    // Update the summary with new action items section
    if (summary?.summary) {
      const updatedSummary = updateActionItemsInSummary(summary.summary, actionItemsMarkdown);
      
      const { error: updateError } = await supabase
        .from('meeting_summaries')
        .update({ 
          summary: updatedSummary,
          action_items: (actionItems || []).map(item => item.action_text),
          updated_at: new Date().toISOString()
        })
        .eq('meeting_id', meetingId);

      if (updateError) {
        console.error('Error updating summary:', updateError);
        throw updateError;
      }

      console.log(`Successfully synced ${actionItems?.length || 0} action items`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        syncedCount: actionItems?.length || 0 
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

  for (const item of openItems) {
    const assignee = item.assignee_name !== 'TBC' ? ` — @${item.assignee_name}` : '';
    const dueDate = item.due_date !== 'TBC' ? ` (${item.due_date})` : '';
    const priority = item.priority !== 'Medium' ? ` [${item.priority}]` : '';
    
    markdown += `- ${item.action_text}${assignee}${dueDate}${priority}\n`;
  }

  if (completedItems.length > 0) {
    markdown += '\n### Completed\n\n';
    for (const item of completedItems) {
      markdown += `- ~~${item.action_text}~~\n`;
    }
  }

  return markdown;
}

function updateActionItemsInSummary(summary: string, newActionItemsSection: string): string {
  // Find and replace the existing action items section
  const actionItemsRegex = /## Action Items[\s\S]*?(?=##[^#]|$)/i;
  
  if (actionItemsRegex.test(summary)) {
    return summary.replace(actionItemsRegex, newActionItemsSection + '\n');
  } else {
    // Append if no existing section
    return summary + '\n\n' + newActionItemsSection;
  }
}
