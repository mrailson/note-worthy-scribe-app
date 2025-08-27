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
        .order('is_protected', { ascending: false })
        .order('is_flagged', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSearchHistory((data || []).map(item => ({
        id: item.id,
        title: item.title,
        brief_overview: item.brief_overview || undefined,
        messages: (item.messages as any) || [],
        created_at: item.created_at,
        updated_at: item.updated_at,
        is_protected: item.is_protected || false,
        is_flagged: item.is_flagged || false
      })));
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  };

  const clearAllHistory = async () => {
    if (!user) return;
    
    try {
      // Count protected items before deletion
      const { data: protectedItems } = await supabase
        .from('ai_4_pm_searches')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_protected', true);

      const protectedCount = protectedItems?.length || 0;

      // Delete only non-protected items
      const { error } = await supabase
        .from('ai_4_pm_searches')
        .delete()
        .eq('user_id', user.id)
        .eq('is_protected', false);

      if (error) throw error;
      
      // Update local state - keep only protected items
      setSearchHistory(prev => prev.filter(item => item.is_protected));
      
      if (protectedCount > 0) {
        toast.success(`Search history cleared. ${protectedCount} protected item${protectedCount > 1 ? 's' : ''} preserved.`);
      } else {
        toast.success('All search history cleared');
      }
    } catch (error) {
      console.error('Error clearing all history:', error);
      toast.error('Failed to clear history');
    }
  };

  const deleteSearch = async (searchId: string) => {
    if (!user) return;
    
    // Check if search is protected
    const searchItem = searchHistory.find(item => item.id === searchId);
    if (searchItem?.is_protected) {
      toast.error('Cannot delete protected search. Remove protection first.');
      return;
    }
    
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

  const toggleSearchFlag = async (searchId: string) => {
    if (!user) return;
    
    const searchItem = searchHistory.find(item => item.id === searchId);
    if (!searchItem) return;
    
    const newFlaggedState = !searchItem.is_flagged;
    
    try {
      const { error } = await supabase
        .from('ai_4_pm_searches')
        .update({ is_flagged: newFlaggedState })
        .eq('id', searchId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Update local state
      setSearchHistory(prev => 
        prev.map(item => 
          item.id === searchId 
            ? { ...item, is_flagged: newFlaggedState }
            : item
        )
      );
      
      toast.success(newFlaggedState ? 'Search flagged' : 'Flag removed');
    } catch (error) {
      console.error('Error toggling search flag:', error);
      toast.error('Failed to update flag');
    }
  };

  const toggleSearchProtection = async (searchId: string) => {
    if (!user) return;
    
    const searchItem = searchHistory.find(item => item.id === searchId);
    if (!searchItem) return;
    
    const newProtectedState = !searchItem.is_protected;
    
    try {
      const { error } = await supabase
        .from('ai_4_pm_searches')
        .update({ is_protected: newProtectedState })
        .eq('id', searchId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Update local state
      setSearchHistory(prev => 
        prev.map(item => 
          item.id === searchId 
            ? { ...item, is_protected: newProtectedState }
            : item
        )
      );
      
      toast.success(newProtectedState ? 'Search protected' : 'Protection removed');
    } catch (error) {
      console.error('Error toggling search protection:', error);
      toast.error('Failed to update protection');
    }
  };

  return {
    searchHistory,
    setSearchHistory,
    loadSearchHistoryList,
    clearAllHistory,
    deleteSearch,
    loadPreviousSearch,
    toggleSearchFlag,
    toggleSearchProtection
  };
};