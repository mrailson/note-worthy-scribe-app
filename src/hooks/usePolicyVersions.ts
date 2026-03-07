import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PolicyVersion {
  id: string;
  policy_id: string;
  version_number: string;
  status: 'draft' | 'active' | 'superseded';
  content: any;
  change_type: string;
  change_summary: string;
  created_by: string | null;
  created_at: string;
  approved_by: string | null;
  next_review_date: string | null;
  superseded_at: string | null;
  user_id: string;
}

export type ChangeType = 'staff_update' | 'review_update' | 'content_change' | 'legislative_change' | 'full_rewrite';

export const CHANGE_TYPE_CONFIG: Record<ChangeType, { label: string; increment: 'minor' | 'major'; color: string; pillLabel: string }> = {
  staff_update: { label: 'Staff / Contact Update', increment: 'minor', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200', pillLabel: 'Staff' },
  review_update: { label: 'Review Date Update', increment: 'minor', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', pillLabel: 'Review' },
  content_change: { label: 'Policy Content Change', increment: 'minor', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', pillLabel: 'Minor' },
  legislative_change: { label: 'Legislative / Regulatory Change', increment: 'major', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', pillLabel: 'Legislative' },
  full_rewrite: { label: 'Full Policy Rewrite', increment: 'major', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', pillLabel: 'Major' },
};

export const getChangeTypePill = (changeType: string) => {
  if (changeType === 'initial') return { color: 'bg-muted text-muted-foreground', pillLabel: 'Initial' };
  const config = CHANGE_TYPE_CONFIG[changeType as ChangeType];
  return config || { color: 'bg-muted text-muted-foreground', pillLabel: changeType };
};

export const calculateNextVersion = (currentVersion: string, increment: 'minor' | 'major'): string => {
  const parts = currentVersion.split('.');
  const major = parseInt(parts[0]) || 1;
  const minor = parseInt(parts[1]) || 0;
  if (increment === 'major') return `${major + 1}.0`;
  return `${major}.${minor + 1}`;
};

export const usePolicyVersions = () => {
  const { user } = useAuth();
  const [versions, setVersions] = useState<Record<string, PolicyVersion[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchVersions = useCallback(async (policyId: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('policy_versions')
        .select('*')
        .eq('policy_id', policyId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVersions(prev => ({ ...prev, [policyId]: (data || []) as unknown as PolicyVersion[] }));
    } catch (error) {
      console.error('Error fetching policy versions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const ensureInitialVersion = useCallback(async (policyId: string, policyContent: string, metadata: any, createdAt: string) => {
    if (!user) return;
    // Check if any versions exist
    const { data: existing } = await supabase
      .from('policy_versions')
      .select('id')
      .eq('policy_id', policyId)
      .eq('user_id', user.id)
      .limit(1);

    if (existing && existing.length > 0) return;

    // Create initial v1.0
    const { error } = await supabase
      .from('policy_versions')
      .insert({
        policy_id: policyId,
        version_number: '1.0',
        status: 'active',
        content: { policy_content: policyContent, metadata },
        change_type: 'initial',
        change_summary: 'Policy created',
        created_by: user.email || 'System',
        approved_by: metadata?.approved_by || user.email || '',
        next_review_date: metadata?.review_date || null,
        user_id: user.id,
      } as any);

    if (error) console.error('Error creating initial version:', error);
    await fetchVersions(policyId);
  }, [user, fetchVersions]);

  const createVersion = useCallback(async (params: {
    policyId: string;
    currentVersion: string;
    changeType: ChangeType;
    changeSummary: string;
    policyContent: string;
    metadata: any;
    approvedBy: string;
    nextReviewDate: string;
  }) => {
    if (!user) return null;

    const config = CHANGE_TYPE_CONFIG[params.changeType];
    const newVersionNumber = calculateNextVersion(params.currentVersion, config.increment);
    const now = new Date().toISOString();

    try {
      // Supersede current active version
      await supabase
        .from('policy_versions')
        .update({ status: 'superseded', superseded_at: now } as any)
        .eq('policy_id', params.policyId)
        .eq('status', 'active')
        .eq('user_id', user.id);

      // Insert new active version
      const { data, error } = await supabase
        .from('policy_versions')
        .insert({
          policy_id: params.policyId,
          version_number: newVersionNumber,
          status: 'active',
          content: { policy_content: params.policyContent, metadata: params.metadata },
          change_type: params.changeType,
          change_summary: params.changeSummary,
          created_by: user.email || 'System',
          approved_by: params.approvedBy,
          next_review_date: params.nextReviewDate,
          user_id: user.id,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Update the policy_completions record
      const updatedMeta = {
        ...params.metadata,
        version: newVersionNumber,
        review_date: params.nextReviewDate,
      };
      await supabase
        .from('policy_completions')
        .update({
          policy_content: params.policyContent,
          metadata: updatedMeta,
          version: newVersionNumber,
          review_date: params.nextReviewDate,
          current_version_id: (data as any).id,
          updated_at: now,
        } as any)
        .eq('id', params.policyId)
        .eq('user_id', user.id);

      await fetchVersions(params.policyId);
      toast.success(`Version ${newVersionNumber} published successfully`);
      return data as unknown as PolicyVersion;
    } catch (error) {
      console.error('Error creating version:', error);
      toast.error('Failed to create new version');
      return null;
    }
  }, [user, fetchVersions]);

  const saveDraft = useCallback(async (params: {
    policyId: string;
    currentVersion: string;
    changeType: ChangeType;
    changeSummary: string;
    policyContent: string;
    metadata: any;
    approvedBy: string;
    nextReviewDate: string;
  }) => {
    if (!user) return null;

    const config = CHANGE_TYPE_CONFIG[params.changeType];
    const newVersionNumber = calculateNextVersion(params.currentVersion, config.increment);

    try {
      const { data, error } = await supabase
        .from('policy_versions')
        .insert({
          policy_id: params.policyId,
          version_number: newVersionNumber,
          status: 'draft',
          content: { policy_content: params.policyContent, metadata: params.metadata },
          change_type: params.changeType,
          change_summary: params.changeSummary,
          created_by: user.email || 'System',
          approved_by: params.approvedBy,
          next_review_date: params.nextReviewDate,
          user_id: user.id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      await fetchVersions(params.policyId);
      toast.success(`Draft v${newVersionNumber} saved`);
      return data as unknown as PolicyVersion;
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft');
      return null;
    }
  }, [user, fetchVersions]);

  return {
    versions,
    isLoading,
    fetchVersions,
    ensureInitialVersion,
    createVersion,
    saveDraft,
  };
};
