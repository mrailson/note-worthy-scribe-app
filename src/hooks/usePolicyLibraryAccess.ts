import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { PolicyCompletion } from './usePolicyCompletions';

export type PolicyAccessLevel = 'none' | 'read' | 'edit';

export interface PolicyLibraryAccessRecord {
  id: string;
  user_id: string;
  practice_id: string;
  access_level: PolicyAccessLevel;
  granted_by: string;
  created_at: string;
  updated_at: string;
}

export interface PracticeUserWithAccess {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  access_level: PolicyAccessLevel;
}

export const usePolicyLibraryAccess = () => {
  const { user } = useAuth();
  const [isPracticeManager, setIsPracticeManager] = useState(false);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [practiceName, setPracticeName] = useState<string | null>(null);
  const [myAccessLevel, setMyAccessLevel] = useState<PolicyAccessLevel | null>(null);
  const [practiceUsers, setPracticeUsers] = useState<PracticeUserWithAccess[]>([]);
  const [practicePolicies, setPracticePolicies] = useState<PolicyCompletion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);

  // Check if current user is a PM and get their practice_id
  const checkPMStatus = useCallback(async () => {
    if (!user) return;
    try {
      const { data: pmPracticeId } = await supabase
        .rpc('get_practice_manager_practice_id', { _user_id: user.id });

      if (pmPracticeId) {
        setIsPracticeManager(true);
        // Find the practice_details record for this gp_practices id
        const { data: gpPractice } = await supabase
          .from('gp_practices')
          .select('name')
          .eq('id', pmPracticeId)
          .single();

        if (gpPractice) {
          // Match to practice_details by name
          const { data: pd } = await supabase
            .from('practice_details')
            .select('id, practice_name')
            .ilike('practice_name', `%${gpPractice.name.replace(/^The\s+/i, '')}%`)
            .limit(1)
            .single();

          if (pd) {
            setPracticeId(pd.id);
            setPracticeName(pd.practice_name);
          } else {
            // Fallback: use the PM's own practice_details
            const { data: ownPd } = await supabase
              .from('practice_details')
              .select('id, practice_name')
              .eq('user_id', user.id)
              .limit(1)
              .single();
            if (ownPd) {
              setPracticeId(ownPd.id);
              setPracticeName(ownPd.practice_name);
            }
          }
        }
        setMyAccessLevel('edit'); // PM always has full access
      } else {
        setIsPracticeManager(false);
        // Check if this user has been granted access to any practice
        const { data: accessRecord } = await supabase
          .from('policy_library_access')
          .select('practice_id, access_level')
          .eq('user_id', user.id)
          .neq('access_level', 'none')
          .limit(1)
          .single();

        if (accessRecord) {
          setPracticeId(accessRecord.practice_id);
          setMyAccessLevel(accessRecord.access_level as PolicyAccessLevel);
          // Get practice name
          const { data: pd } = await supabase
            .from('practice_details')
            .select('practice_name')
            .eq('id', accessRecord.practice_id)
            .single();
          if (pd) setPracticeName(pd.practice_name);
        } else {
          setPracticeId(null);
          setMyAccessLevel(null);
          setPracticeName(null);
        }
      }
    } catch (error) {
      console.error('Error checking PM status:', error);
    }
  }, [user]);

  // Load practice users with their access levels (PM only)
  const loadPracticeUsers = useCallback(async () => {
    if (!user || !practiceId || !isPracticeManager) return;
    setIsLoadingUsers(true);
    try {
      // Get the gp_practices id for this practice
      const { data: pd } = await supabase
        .from('practice_details')
        .select('practice_name')
        .eq('id', practiceId)
        .single();

      if (!pd) return;

      // Find matching gp_practice
      const { data: gpPractices } = await supabase
        .from('gp_practices')
        .select('id');

      // Use the get_practice_users RPC to get users at this practice
      let gpPracticeId: string | null = null;
      if (gpPractices) {
        for (const gp of gpPractices) {
          const { data: gpData } = await supabase
            .from('gp_practices')
            .select('id, name')
            .eq('id', gp.id)
            .single();
          if (gpData) {
            const gpName = gpData.name.replace(/^The\s+/i, '').toLowerCase();
            const pdName = pd.practice_name.replace(/^The\s+/i, '').toLowerCase();
            if (gpName === pdName || gpName.includes(pdName) || pdName.includes(gpName)) {
              gpPracticeId = gpData.id;
              break;
            }
          }
        }
      }

      if (!gpPracticeId) return;

      const { data: users, error } = await supabase
        .rpc('get_practice_users', { p_practice_id: gpPracticeId });

      if (error) throw error;

      // Get existing access records for this practice
      const { data: accessRecords } = await supabase
        .from('policy_library_access')
        .select('*')
        .eq('practice_id', practiceId);

      const accessMap = new Map(
        (accessRecords || []).map(r => [r.user_id, r.access_level as PolicyAccessLevel])
      );

      const usersWithAccess: PracticeUserWithAccess[] = (users || [])
        .filter((u: any) => u.user_id !== user.id) // Exclude the PM themselves
        .map((u: any) => ({
          user_id: u.user_id,
          email: u.email || '',
          full_name: u.full_name || u.email || 'Unknown',
          role: u.role || 'practice_user',
          access_level: accessMap.get(u.user_id) || 'none',
        }));

      setPracticeUsers(usersWithAccess);
    } catch (error) {
      console.error('Error loading practice users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [user, practiceId, isPracticeManager]);

  // Load practice policies (for users with access)
  const loadPracticePolicies = useCallback(async () => {
    if (!user || !practiceId) return;
    setIsLoadingPolicies(true);
    try {
      const { data, error } = await supabase
        .from('policy_completions')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setPracticePolicies((data || []) as unknown as PolicyCompletion[]);
    } catch (error) {
      console.error('Error loading practice policies:', error);
    } finally {
      setIsLoadingPolicies(false);
    }
  }, [user, practiceId]);

  // Set access level for a user (PM only)
  const setUserAccess = useCallback(async (
    targetUserId: string,
    accessLevel: PolicyAccessLevel
  ): Promise<boolean> => {
    if (!user || !practiceId || !isPracticeManager) return false;
    try {
      if (accessLevel === 'none') {
        // Delete the record
        await supabase
          .from('policy_library_access')
          .delete()
          .eq('user_id', targetUserId)
          .eq('practice_id', practiceId);
      } else {
        // Upsert
        const { error } = await supabase
          .from('policy_library_access')
          .upsert({
            user_id: targetUserId,
            practice_id: practiceId,
            access_level: accessLevel,
            granted_by: user.id,
          }, {
            onConflict: 'user_id,practice_id',
          });

        if (error) throw error;
      }

      // Update local state
      setPracticeUsers(prev =>
        prev.map(u =>
          u.user_id === targetUserId ? { ...u, access_level: accessLevel } : u
        )
      );

      return true;
    } catch (error) {
      console.error('Error setting user access:', error);
      toast.error('Failed to update access level');
      return false;
    }
  }, [user, practiceId, isPracticeManager]);

  // Save all access changes at once
  const saveAllAccess = useCallback(async (
    changes: Array<{ userId: string; accessLevel: PolicyAccessLevel }>
  ): Promise<boolean> => {
    if (!user || !practiceId || !isPracticeManager) return false;
    try {
      for (const change of changes) {
        const success = await setUserAccess(change.userId, change.accessLevel);
        if (!success) return false;
      }
      toast.success('Access levels updated successfully');
      return true;
    } catch (error) {
      console.error('Error saving access changes:', error);
      toast.error('Failed to save access changes');
      return false;
    }
  }, [user, practiceId, isPracticeManager, setUserAccess]);

  useEffect(() => {
    checkPMStatus();
  }, [checkPMStatus]);

  useEffect(() => {
    if (isPracticeManager && practiceId) {
      loadPracticeUsers();
    }
  }, [isPracticeManager, practiceId, loadPracticeUsers]);

  useEffect(() => {
    if (practiceId && (myAccessLevel === 'read' || myAccessLevel === 'edit' || isPracticeManager)) {
      loadPracticePolicies();
    }
  }, [practiceId, myAccessLevel, isPracticeManager, loadPracticePolicies]);

  const hasAccess = myAccessLevel === 'read' || myAccessLevel === 'edit' || isPracticeManager;
  const canEdit = myAccessLevel === 'edit' || isPracticeManager;
  const canDelete = isPracticeManager;

  return {
    isPracticeManager,
    practiceId,
    practiceName,
    myAccessLevel,
    hasAccess,
    canEdit,
    canDelete,
    practiceUsers,
    practicePolicies,
    isLoading,
    isLoadingUsers,
    isLoadingPolicies,
    setUserAccess,
    saveAllAccess,
    loadPracticeUsers,
    loadPracticePolicies,
  };
};
