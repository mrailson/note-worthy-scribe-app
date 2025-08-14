import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SearchHistory, Message } from '@/types/ai4gp';

export const useSearchHistory = () => {
  const { user } = useAuth();
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);

  const loadSearchHistoryList = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_4_pm_searches')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSearchHistory((data || []).map(item => ({
        id: item.id,
        title: item.title,
        brief_overview: item.brief_overview || undefined,
        messages: (item.messages as any) || [],
        created_at: item.created_at,
        updated_at: item.updated_at
      })));
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  };

  const clearAllHistory = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('ai_4_pm_searches')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Clear local state
      setSearchHistory([]);
      
      toast.success('All search history cleared');
    } catch (error) {
      console.error('Error clearing all history:', error);
      toast.error('Failed to clear history');
    }
  };

  const deleteSearch = async (searchId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('ai_4_pm_searches')
        .delete()
        .eq('id', searchId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Remove from local state
      setSearchHistory(prev => prev.filter(item => item.id !== searchId));
      
      toast.success('Search deleted');
    } catch (error) {
      console.error('Error deleting search:', error);
      toast.error('Failed to delete search');
    }
  };

  const loadPreviousSearch = (search: SearchHistory, setMessages: (messages: Message[]) => void) => {
    setMessages(search.messages);
  };

  useEffect(() => {
    if (user) {
      loadSearchHistoryList();
    }
  }, [user]);

  return {
    searchHistory,
    setSearchHistory,
    loadSearchHistoryList,
    clearAllHistory,
    deleteSearch,
    loadPreviousSearch
  };
};