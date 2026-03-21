import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { MeetingGroup, AdditionalMember } from '@/types/contactTypes';
import { showToast } from '@/utils/toastWrapper';

export function useMeetingGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<MeetingGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('meeting_groups' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      if (error) throw error;
      setGroups((data as any[])?.map(g => ({
        ...g,
        contact_ids: g.contact_ids || [],
        additional_members: g.additional_members || [],
      })) || []);
    } catch (err: any) {
      console.error('Failed to fetch meeting groups:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const createGroup = async (group: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    contact_ids?: number[];
    additional_members?: AdditionalMember[];
  }) => {
    if (!user?.id) return null;
    try {
      const { data, error } = await supabase
        .from('meeting_groups' as any)
        .insert({
          ...group,
          user_id: user.id,
          contact_ids: group.contact_ids || [],
          additional_members: group.additional_members || [],
        } as any)
        .select()
        .single();
      if (error) throw error;
      const newGroup = { ...(data as any), contact_ids: (data as any).contact_ids || [], additional_members: (data as any).additional_members || [] };
      setGroups(prev => [...prev, newGroup].sort((a, b) => a.name.localeCompare(b.name)));
      showToast.success('Meeting group created');
      return newGroup as MeetingGroup;
    } catch (err: any) {
      showToast.error(`Failed to create group: ${err.message}`);
      return null;
    }
  };

  const updateGroup = async (id: string, updates: Partial<MeetingGroup>) => {
    try {
      const { error } = await supabase
        .from('meeting_groups' as any)
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
      setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
      showToast.success('Meeting group updated');
    } catch (err: any) {
      showToast.error(`Failed to update group: ${err.message}`);
    }
  };

  const deleteGroup = async (id: string) => {
    try {
      const { error } = await supabase
        .from('meeting_groups' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      setGroups(prev => prev.filter(g => g.id !== id));
      showToast.success('Meeting group deleted');
    } catch (err: any) {
      showToast.error(`Failed to delete group: ${err.message}`);
    }
  };

  return { groups, loading, fetchGroups, createGroup, updateGroup, deleteGroup };
}
