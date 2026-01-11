import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useActionItemsCount = (meetingId: string) => {
  const [openItemsCount, setOpenItemsCount] = useState<number>(0);

  useEffect(() => {
    if (!meetingId) return;
    
    const fetchCount = async () => {
      const { data, error } = await supabase
        .from('meeting_action_items')
        .select('id, status, due_date, assignee_name')
        .eq('meeting_id', meetingId);
      
      if (!error && data) {
        const count = data.filter(item => {
          if (item.status === 'Completed') return false;
          const hasDueDate = item.due_date && item.due_date !== 'TBC' && item.due_date.trim() !== '';
          const hasAssignee = item.assignee_name && item.assignee_name !== 'TBC' && item.assignee_name.trim() !== '';
          return !hasDueDate || !hasAssignee;
        }).length;
        setOpenItemsCount(count);
      }
    };
    
    fetchCount();
  }, [meetingId]);

  return { openItemsCount };
};
