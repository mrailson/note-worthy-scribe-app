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
    case 'ASAP': {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }
    case 'By Next Meeting':
    case 'TBC':
    default:
      return null;
  }
};

export const useActionItems = (meetingId: string) => {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Fetch action items
  const fetchActionItems = useCallback(async () => {
    if (!meetingId) return;
    
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('meeting_action_items')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setActionItems((data as ActionItem[]) || []);
    } catch (error) {
      console.error('Error fetching action items:', error);
    } finally {
      setIsLoading(false);
    }
  }, [meetingId]);

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

  // Silent background sync to meeting notes
  const syncToMeetingNotes = async () => {
    try {
      // Call edge function to sync action items to meeting notes
      await supabase.functions.invoke('sync-meeting-action-items', {
        body: { meetingId },
      });
    } catch (error) {
      // Silent failure - don't show error to user
      console.error('Background sync failed:', error);
    }
  };

  // Extract action items from existing notes (for initial migration)
  const extractFromNotes = async (notes: string): Promise<void> => {
    if (actionItems.length > 0) return; // Already have items
    
    // Parse action items from markdown notes
    const actionItemsSection = notes.match(/## Action Items[\s\S]*?(?=##|$)/i);
    if (!actionItemsSection) return;

    const lines = actionItemsSection[0].split('\n');
    const items: string[] = [];

    for (const line of lines) {
      const match = line.match(/^[-*•]\s*(.+)/);
      if (match && match[1].trim()) {
        items.push(match[1].trim());
      }
    }

    for (const itemText of items) {
      await addActionItem(itemText);
    }
  };

  const openItemsCount = actionItems.filter(i => i.status !== 'Completed').length;

  return {
    actionItems,
    isLoading,
    isSaving,
    openItemsCount,
    addActionItem,
    updateActionItem,
    deleteActionItem,
    toggleStatus,
    reorderActionItems,
    extractFromNotes,
    refetch: fetchActionItems,
  };
};
