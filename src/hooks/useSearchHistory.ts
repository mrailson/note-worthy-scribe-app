import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import { SearchHistory, Message } from '@/types/ai4gp';

export const useSearchHistory = () => {
  const { user } = useAuth();
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);

  const loadSearchHistoryList = async () => {
    try {
      // LAZY LOAD: Only fetch metadata, NOT messages (which can be huge with base64 images/presentations)
      const { data, error } = await supabase
        .from('ai_4_pm_searches')
        .select('id, title, brief_overview, created_at, updated_at, is_protected, is_flagged, user_id')
        .eq('user_id', user?.id)
        .order('is_protected', { ascending: false })
        .order('is_flagged', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSearchHistory((data || []).map(item => ({
        id: item.id,
        title: item.title,
        brief_overview: item.brief_overview || undefined,
        messages: [], // Messages loaded on-demand when user clicks
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
        showToast.success(`Search history cleared. ${protectedCount} protected item${protectedCount > 1 ? 's' : ''} preserved.`, { section: 'ai4gp' });
      } else {
        showToast.success('All search history cleared', { section: 'ai4gp' });
      }
    } catch (error) {
      console.error('Error clearing all history:', error);
      showToast.error('Failed to clear history', { section: 'ai4gp' });
    }
  };

  const deleteSearch = async (searchId: string) => {
    if (!user) return;
    
    // Check if search is protected
    const searchItem = searchHistory.find(item => item.id === searchId);
    if (searchItem?.is_protected) {
      showToast.error('Cannot delete protected search. Remove protection first.', { section: 'ai4gp' });
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
      
      showToast.success('Search deleted', { section: 'ai4gp' });
    } catch (error) {
      console.error('Error deleting search:', error);
      showToast.error('Failed to delete search', { section: 'ai4gp' });
    }
  };

  // Load full messages for a specific search (on-demand)
  const loadFullSearch = async (searchId: string): Promise<Message[] | null> => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('ai_4_pm_searches')
        .select('messages')
        .eq('id', searchId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      // Format messages with proper types
      const messagesData = Array.isArray(data.messages) ? 
        (data.messages as any[]).map((msg: any, index: number) => ({
          id: msg.id || `loaded-${index}-${Date.now()}`,
          role: msg.role || 'user',
          content: msg.content || '',
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          files: msg.files || undefined,
          generatedImages: msg.generatedImages || undefined,
          generatedAudio: msg.generatedAudio || undefined,
          generatedPresentation: msg.generatedPresentation || undefined
        })) : [];
      
      return messagesData as Message[];
    } catch (error) {
      console.error('Error loading full search:', error);
      return null;
    }
  };

  const loadPreviousSearch = (search: SearchHistory, setMessages: (messages: Message[]) => void) => {
    // For backwards compatibility - but recommend using loadFullSearch instead
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
      
      showToast.success(newFlaggedState ? 'Search flagged' : 'Flag removed', { section: 'ai4gp' });
    } catch (error) {
      console.error('Error toggling search flag:', error);
      showToast.error('Failed to update flag', { section: 'ai4gp' });
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
      
      showToast.success(newProtectedState ? 'Search protected' : 'Protection removed', { section: 'ai4gp' });
    } catch (error) {
      console.error('Error toggling search protection:', error);
      showToast.error('Failed to update protection', { section: 'ai4gp' });
    }
  };

  return {
    searchHistory,
    setSearchHistory,
    loadSearchHistoryList,
    clearAllHistory,
    deleteSearch,
    loadPreviousSearch,
    loadFullSearch,
    toggleSearchFlag,
    toggleSearchProtection
  };
};