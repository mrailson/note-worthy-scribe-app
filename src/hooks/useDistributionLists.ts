import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastWrapper';

export interface DistributionList {
  id: string;
  name: string;
  description?: string;
  scope: 'global' | 'local';
  practice_id?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  members: DistributionListMember[];
}

export interface DistributionListMember {
  id: string;
  list_id: string;
  attendee_id: string;
  created_at: string;
  attendee?: {
    id: string;
    name: string;
    email?: string;
    title?: string;
    organization?: string;
    role?: string;
  };
}

interface CreateDistributionListParams {
  name: string;
  description?: string;
  scope: 'global' | 'local';
  practiceId?: string;
  attendeeIds: string[];
}

interface UpdateDistributionListParams {
  id: string;
  name: string;
  description?: string;
  scope: 'global' | 'local';
  attendeeIds: string[];
}

export const useDistributionLists = (practiceIds: string[] = []) => {
  const { user } = useAuth();
  const [distributionLists, setDistributionLists] = useState<DistributionList[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDistributionLists = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch distribution lists with their members and attendee details
      const { data, error: fetchError } = await supabase
        .from('distribution_lists')
        .select(`
          *,
          distribution_list_members (
            id,
            list_id,
            attendee_id,
            created_at,
            attendees (
              id,
              name,
              email,
              title,
              organization,
              role
            )
          )
        `)
        .eq('user_id', user.id)
        .order('name');

      if (fetchError) throw fetchError;

      // Transform the data to match our interface
      const transformedLists: DistributionList[] = (data || []).map((list: any) => ({
        id: list.id,
        name: list.name,
        description: list.description,
        scope: list.scope as 'global' | 'local',
        practice_id: list.practice_id,
        user_id: list.user_id,
        created_at: list.created_at,
        updated_at: list.updated_at,
        members: (list.distribution_list_members || []).map((member: any) => ({
          id: member.id,
          list_id: member.list_id,
          attendee_id: member.attendee_id,
          created_at: member.created_at,
          attendee: member.attendees
        }))
      }));

      setDistributionLists(transformedLists);
    } catch (err: any) {
      console.error('Error fetching distribution lists:', err);
      setError(err.message || 'Failed to fetch distribution lists');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDistributionLists();
  }, [fetchDistributionLists]);

  const createDistributionList = async (params: CreateDistributionListParams): Promise<boolean> => {
    if (!user?.id) {
      showToast.error('You must be logged in to create a distribution list');
      return false;
    }

    try {
      // Create the distribution list
      const { data: newList, error: createError } = await supabase
        .from('distribution_lists')
        .insert({
          user_id: user.id,
          practice_id: params.practiceId || null,
          name: params.name,
          description: params.description || null,
          scope: params.scope
        })
        .select()
        .single();

      if (createError) throw createError;

      // Add members if provided
      if (params.attendeeIds.length > 0) {
        const members = params.attendeeIds.map(attendeeId => ({
          list_id: newList.id,
          attendee_id: attendeeId
        }));

        const { error: membersError } = await supabase
          .from('distribution_list_members')
          .insert(members);

        if (membersError) throw membersError;
      }

      showToast.success('Distribution list created');
      await fetchDistributionLists();
      return true;
    } catch (err: any) {
      console.error('Error creating distribution list:', err);
      showToast.error(`Failed to create distribution list: ${err.message}`);
      return false;
    }
  };

  const updateDistributionList = async (params: UpdateDistributionListParams): Promise<boolean> => {
    if (!user?.id) {
      showToast.error('You must be logged in to update a distribution list');
      return false;
    }

    try {
      // Update the distribution list
      const { error: updateError } = await supabase
        .from('distribution_lists')
        .update({
          name: params.name,
          description: params.description || null,
          scope: params.scope
        })
        .eq('id', params.id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Delete existing members
      const { error: deleteError } = await supabase
        .from('distribution_list_members')
        .delete()
        .eq('list_id', params.id);

      if (deleteError) throw deleteError;

      // Add new members
      if (params.attendeeIds.length > 0) {
        const members = params.attendeeIds.map(attendeeId => ({
          list_id: params.id,
          attendee_id: attendeeId
        }));

        const { error: membersError } = await supabase
          .from('distribution_list_members')
          .insert(members);

        if (membersError) throw membersError;
      }

      showToast.success('Distribution list updated');
      await fetchDistributionLists();
      return true;
    } catch (err: any) {
      console.error('Error updating distribution list:', err);
      showToast.error(`Failed to update distribution list: ${err.message}`);
      return false;
    }
  };

  const deleteDistributionList = async (listId: string): Promise<boolean> => {
    if (!user?.id) {
      showToast.error('You must be logged in to delete a distribution list');
      return false;
    }

    try {
      const { error: deleteError } = await supabase
        .from('distribution_lists')
        .delete()
        .eq('id', listId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      showToast.success('Distribution list deleted');
      await fetchDistributionLists();
      return true;
    } catch (err: any) {
      console.error('Error deleting distribution list:', err);
      showToast.error(`Failed to delete distribution list: ${err.message}`);
      return false;
    }
  };

  const getEmailsFromList = (listId: string): string[] => {
    const list = distributionLists.find(l => l.id === listId);
    if (!list) return [];
    
    return list.members
      .map(m => m.attendee?.email)
      .filter((email): email is string => !!email);
  };

  return {
    distributionLists,
    isLoading,
    error,
    fetchDistributionLists,
    createDistributionList,
    updateDistributionList,
    deleteDistributionList,
    getEmailsFromList
  };
};
