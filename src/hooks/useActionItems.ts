import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ActionItem {
  id: string;
  meeting_id: string;
  user_id: string;
  action_text: string;
  assignee_name: string;
  assignee_type: 'me' | 'chair' | 'attendee' | 'custom' | 'tbc';
  due_date: string;
  due_date_actual: string | null;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Completed';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ActionItemInput = Omit<ActionItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

const DUE_DATE_QUICK_PICKS = ['TBC', 'End of Week', 'End of Month', 'By Next Meeting', 'ASAP'] as const;
export type DueDateQuickPick = typeof DUE_DATE_QUICK_PICKS[number];

export const calculateActualDueDate = (quickPick: string): string | null => {
  const today = new Date();
  
  switch (quickPick) {
    case 'End of Week': {
      const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
      const friday = new Date(today);
      friday.setDate(today.getDate() + daysUntilFriday);
      return friday.toISOString().split('T')[0];
    }
    case 'End of Month': {
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return lastDay.toISOString().split('T')[0];
    }
    case 'End of Next Month': {
      const lastDayNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      return lastDayNextMonth.toISOString().split('T')[0];
    }
    case 'ASAP': {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }
    case 'By Next Meeting':
    case 'TBC':
      return null;
    default: {
      // Try to parse as a date string (e.g., "15 Jan 2026")
      const parsed = Date.parse(quickPick);
      if (!Number.isNaN(parsed)) {
        return new Date(parsed).toISOString().split('T')[0];
      }
      return null;
    }
  }
};

const normaliseKeyPart = (value: string | null | undefined) =>
  (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

const actionItemDedupeKey = (item: Pick<ActionItem, 'action_text' | 'assignee_name' | 'due_date' | 'priority' | 'status' | 'sort_order'>) =>
  [
    normaliseKeyPart(item.action_text),
    normaliseKeyPart(item.assignee_name),
    normaliseKeyPart(item.due_date),
    item.priority,
    item.status,
    String(item.sort_order),
  ].join('|');

const planActionItemsDedupe = (items: ActionItem[]) => {
  const seen = new Map<string, ActionItem>();
  const idsToDelete: string[] = [];

  for (const item of items) {
    const key = actionItemDedupeKey(item);
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, item);
      continue;
    }

    // Keep the earliest row (by created_at) and delete the rest.
    const existingTime = Date.parse(existing.created_at);
    const itemTime = Date.parse(item.created_at);

    const keepExisting =
      !Number.isNaN(existingTime) && !Number.isNaN(itemTime) ? existingTime <= itemTime : true;

    if (keepExisting) {
      idsToDelete.push(item.id);
    } else {
      idsToDelete.push(existing.id);
      seen.set(key, item);
    }
  }

  const uniqueItems = Array.from(seen.values()).sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.created_at.localeCompare(b.created_at);
  });

  return { uniqueItems, idsToDelete };
};

export const useActionItems = (meetingId: string) => {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [hasExtractedFromNotes, setHasExtractedFromNotes] = useState(false);
  const { toast } = useToast();

  // Parse action item text to extract assignee and due date
  const parseActionItemText = (text: string): { 
    actionText: string; 
    assignee: string; 
    dueDate: string;
    priority: 'High' | 'Medium' | 'Low';
  } => {
    let actionText = text;
    let assignee = 'TBC';
    let dueDate = 'TBC';
    let priority: 'High' | 'Medium' | 'Low' = 'Medium';

    // Extract assignee patterns like "— @Name" or "- @Name" or "(Assigned to: Name)"
    const assigneeMatch = text.match(/(?:—|–|-)\s*@?([A-Za-z\s.]+?)(?:\s*[\[(]|$)/i) ||
                          text.match(/\((?:Assigned to|Owner|Lead):\s*([^)]+)\)/i) ||
                          text.match(/@([A-Za-z\s.]+?)(?:\s|$)/);
    if (assigneeMatch) {
      assignee = assigneeMatch[1].trim();
      actionText = actionText.replace(assigneeMatch[0], '').trim();
    }

    // Extract due date patterns like "(End of Week)" or "(by 15th Jan)" or "[ASAP]"
    const dueDateMatch = text.match(/\((End of Week|End of Month|By Next Meeting|ASAP|TBC)\)/i) ||
                         text.match(/\[(End of Week|End of Month|By Next Meeting|ASAP|TBC)\]/i) ||
                         text.match(/\((?:by|due|deadline):\s*([^)]+)\)/i);
    if (dueDateMatch) {
      dueDate = dueDateMatch[1].trim();
      actionText = actionText.replace(dueDateMatch[0], '').trim();
    }

    // Extract priority patterns like "[High]" or "(High Priority)"
    const priorityMatch = text.match(/\[(High|Medium|Low)\]/i) ||
                          text.match(/\((High|Medium|Low)\s*Priority\)/i);
    if (priorityMatch) {
      priority = priorityMatch[1] as 'High' | 'Medium' | 'Low';
      actionText = actionText.replace(priorityMatch[0], '').trim();
    }

    // Clean up trailing punctuation and whitespace
    actionText = actionText.replace(/[—–-]\s*$/, '').trim();

    return { actionText, assignee, dueDate, priority };
  };

  // Extract action items from meeting notes
  const extractActionItemsFromNotes = async (notes: string): Promise<void> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const seenTexts = new Set<string>();
    const extractedItems: Array<{ text: string; assignee: string; dueDate: string; priority: 'High' | 'Medium' | 'Low' }> = [];

    // Method 1: Parse markdown TABLE format (| Action | Responsible Party | Deadline | Priority |)
    const tableMatch = notes.match(/# ACTION ITEMS\s*\n\|[^\n]+\|\s*\n\|[-|\s]+\|\s*\n([\s\S]*?)(?=\n#|\n\n#|$)/i);
    if (tableMatch && tableMatch[1]) {
      const tableRows = tableMatch[1].split('\n').filter(line => line.trim().startsWith('|'));
      
      for (const row of tableRows) {
        // Parse table row: | Action Text | Assignee | Deadline | Priority |
        const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell);
        if (cells.length >= 4) {
          const [actionText, assignee, deadline, priority] = cells;
          
          // Skip if action text is too short or is a header
          if (actionText.length < 10 || actionText.match(/^Action$/i)) continue;
          
          // Normalize and dedupe
          const normalizedText = actionText.toLowerCase().replace(/[^\w\s]/g, '').trim();
          if (seenTexts.has(normalizedText)) continue;
          seenTexts.add(normalizedText);
          
          extractedItems.push({
            text: actionText,
            assignee: assignee || 'TBC',
            dueDate: deadline || 'TBC',
            priority: (priority?.match(/High|Medium|Low/i)?.[0] as 'High' | 'Medium' | 'Low') || 'Medium',
          });
        }
      }
    }

    // Method 2: Parse bullet point format (fallback if no table found)
    if (extractedItems.length === 0) {
      const bulletMatch = notes.match(/#{1,3}\s*(?:ACTION ITEMS|Action Items)\s*\n([\s\S]*?)(?=\n#{1,3}\s+[A-Z]|$)/i);
      if (bulletMatch) {
        const section = bulletMatch[1] || bulletMatch[0];
        const lines = section.split('\n');

        for (const line of lines) {
          // Match bullet points: -, *, •, numbered lists
          const match = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.+)/);
          if (match && match[1].trim()) {
            const rawText = match[1].trim();
            
            // Skip header-like lines (bold section headers, titles)
            if (rawText.match(/^\*\*[^*]+\*\*:?\s*$/)) continue;
            if (rawText.match(/^(?:Action Items|Actions|Completed|Open|High Priority|Medium Priority|Low Priority)/i)) continue;
            if (rawText.length < 10) continue;
            
            const parsed = parseActionItemText(rawText);
            
            // Deduplicate by normalized text
            const normalizedText = parsed.actionText.toLowerCase().replace(/[^\w\s]/g, '').trim();
            if (seenTexts.has(normalizedText)) continue;
            if (normalizedText.length < 10) continue;
            
            seenTexts.add(normalizedText);
            extractedItems.push({
              text: parsed.actionText,
              assignee: parsed.assignee,
              dueDate: parsed.dueDate,
              priority: parsed.priority,
            });
          }
        }
      }
    }

    // Insert all extracted items in a batch
    if (extractedItems.length > 0) {
      console.log(`Extracted ${extractedItems.length} action items from notes`);
      
      const itemsToInsert = extractedItems.map((item, i) => ({
        meeting_id: meetingId,
        user_id: userData.user!.id,
        action_text: item.text,
        assignee_name: item.assignee,
        assignee_type: item.assignee === 'TBC' ? 'tbc' : 'custom' as const,
        due_date: item.dueDate,
        due_date_actual: calculateActualDueDate(item.dueDate),
        priority: item.priority,
        status: 'Open' as const,
        sort_order: i,
      }));

      await supabase.from('meeting_action_items').insert(itemsToInsert);

      // Refetch to get the newly created items
      const { data } = await supabase
        .from('meeting_action_items')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('sort_order', { ascending: true });
      
      setActionItems((data as ActionItem[]) || []);
    } else {
      console.log('No action items found in notes');
    }
  };

  // Fetch action items and extract from notes if needed
  const fetchActionItems = useCallback(async () => {
    if (!meetingId) return;
    
    try {
      setIsLoading(true);
      
      // First, fetch existing action items from the table
      const { data, error } = await supabase
        .from('meeting_action_items')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      
      const rawItems = (data as ActionItem[]) || [];
      
      // Dedupe action items and clean up duplicates in DB
      const { uniqueItems, idsToDelete } = planActionItemsDedupe(rawItems);
      
      // Delete duplicates in background
      if (idsToDelete.length > 0) {
        console.log(`Deleting ${idsToDelete.length} duplicate action items`);
        supabase
          .from('meeting_action_items')
          .delete()
          .in('id', idsToDelete)
          .then(() => console.log('Duplicate cleanup complete'));
      }
      
      setActionItems(uniqueItems);

      // If no items exist and we haven't tried extraction yet, extract from notes
      if (uniqueItems.length === 0 && !hasExtractedFromNotes) {
        setHasExtractedFromNotes(true);
        
        // Fetch the meeting summary to extract action items
        const { data: summaryData } = await supabase
          .from('meeting_summaries')
          .select('summary')
          .eq('meeting_id', meetingId)
          .maybeSingle();

        if (summaryData?.summary) {
          await extractActionItemsFromNotes(summaryData.summary);
        }
      }
    } catch (error) {
      console.error('Error fetching action items:', error);
    } finally {
      setIsLoading(false);
    }
  }, [meetingId, hasExtractedFromNotes]);

  useEffect(() => {
    fetchActionItems();
  }, [fetchActionItems]);

  // Add action item
  const addActionItem = async (actionText: string): Promise<ActionItem | null> => {
    try {
      setIsSaving(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const newItem = {
        meeting_id: meetingId,
        user_id: userData.user.id,
        action_text: actionText,
        assignee_name: 'TBC',
        assignee_type: 'tbc' as const,
        due_date: 'TBC',
        due_date_actual: null,
        priority: 'Medium' as const,
        status: 'Open' as const,
        sort_order: actionItems.length,
      };

      const { data, error } = await supabase
        .from('meeting_action_items')
        .insert(newItem)
        .select()
        .single();

      if (error) throw error;
      
      const typedData = data as ActionItem;
      setActionItems(prev => [...prev, typedData]);
      
      // Trigger background sync
      syncToMeetingNotes();
      
      return typedData;
    } catch (error) {
      console.error('Error adding action item:', error);
      toast({
        title: 'Error',
        description: 'Failed to add action item',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // Update action item
  const updateActionItem = async (id: string, updates: Partial<ActionItem>): Promise<boolean> => {
    try {
      // Optimistic update
      setActionItems(prev => 
        prev.map(item => item.id === id ? { ...item, ...updates } : item)
      );

      // Calculate actual due date if due_date changed
      let actualDueDate = updates.due_date_actual;
      if (updates.due_date && !updates.due_date_actual) {
        actualDueDate = calculateActualDueDate(updates.due_date);
      }

      const { error } = await supabase
        .from('meeting_action_items')
        .update({ ...updates, due_date_actual: actualDueDate, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        // Revert on error
        await fetchActionItems();
        throw error;
      }
      
      // Trigger background sync (silently)
      syncToMeetingNotes();
      
      return true;
    } catch (error) {
      console.error('Error updating action item:', error);
      return false;
    }
  };

  // Delete action item
  const deleteActionItem = async (id: string): Promise<boolean> => {
    try {
      // Optimistic update
      setActionItems(prev => prev.filter(item => item.id !== id));

      const { error } = await supabase
        .from('meeting_action_items')
        .delete()
        .eq('id', id);

      if (error) {
        await fetchActionItems();
        throw error;
      }
      
      // Trigger background sync
      syncToMeetingNotes();
      
      return true;
    } catch (error) {
      console.error('Error deleting action item:', error);
      return false;
    }
  };

  // Toggle status
  const toggleStatus = async (id: string): Promise<boolean> => {
    const item = actionItems.find(i => i.id === id);
    if (!item) return false;

    const newStatus = item.status === 'Completed' ? 'Open' : 'Completed';
    return updateActionItem(id, { status: newStatus });
  };

  // Reorder action items
  const reorderActionItems = async (reorderedItems: ActionItem[]): Promise<boolean> => {
    try {
      setActionItems(reorderedItems);

      const updates = reorderedItems.map((item, index) => ({
        id: item.id,
        sort_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from('meeting_action_items')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }
      
      return true;
    } catch (error) {
      console.error('Error reordering action items:', error);
      await fetchActionItems();
      return false;
    }
  };

  // Background sync to meeting notes
  const syncToMeetingNotes = async (showToast = false) => {
    try {
      setIsSyncing(true);
      // Call edge function to sync action items to meeting notes
      await supabase.functions.invoke('sync-meeting-action-items', {
        body: { meetingId },
      });
      setLastSyncedAt(new Date());
      if (showToast) {
        toast({
          title: 'Synced to notes',
          description: 'Action items have been updated in the meeting notes.',
        });
      }
    } catch (error) {
      console.error('Background sync failed:', error);
      if (showToast) {
        toast({
          title: 'Sync failed',
          description: 'Could not update meeting notes. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Manual sync trigger for user
  const manualSync = async () => {
    await syncToMeetingNotes(true);
  };

  // Clear all action items and re-extract from notes
  const clearAndReExtract = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      // Delete all existing action items for this meeting
      await supabase
        .from('meeting_action_items')
        .delete()
        .eq('meeting_id', meetingId);

      setActionItems([]);
      
      // Fetch the meeting summary to extract action items
      const { data: summaryData } = await supabase
        .from('meeting_summaries')
        .select('summary')
        .eq('meeting_id', meetingId)
        .maybeSingle();

      if (summaryData?.summary) {
        await extractActionItemsFromNotes(summaryData.summary);
      }
    } catch (error) {
      console.error('Error clearing and re-extracting:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openItemsCount = actionItems.filter(i => i.status !== 'Completed').length;

  return {
    actionItems,
    isLoading,
    isSaving,
    isSyncing,
    lastSyncedAt,
    openItemsCount,
    addActionItem,
    updateActionItem,
    deleteActionItem,
    toggleStatus,
    reorderActionItems,
    clearAndReExtract,
    manualSync,
    refetch: fetchActionItems,
  };
};
