import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type VaultAuditAction =
  | 'create_folder'
  | 'upload_file'
  | 'delete_folder'
  | 'delete_file'
  | 'rename_folder'
  | 'rename_file'
  | 'move_folder'
  | 'move_file'
  | 'copy_file'
  | 'replace_file'
  | 'view_file'
  | 'download_file'
  | 'edit_description'
  | 'manage_access'
  | 'add_permission'
  | 'remove_permission'
  | 'navigate_folder';

interface AuditLogEntry {
  action: VaultAuditAction;
  target_type: 'folder' | 'file';
  target_id?: string;
  target_name?: string;
  details?: Record<string, unknown>;
}

export const useVaultAuditLog = () => {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (entry: AuditLogEntry) => {
      if (!user?.id) return;

      // Get user profile info
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', user.id)
        .maybeSingle();

      await supabase.from('nres_vault_audit_log').insert({
        user_id: user.id,
        user_name: profile?.full_name || null,
        user_email: profile?.email || null,
        action: entry.action,
        target_type: entry.target_type,
        target_id: entry.target_id || null,
        target_name: entry.target_name || null,
        details: entry.details || null,
      } as any);
    },
  });
};

// Lightweight fire-and-forget logger (no mutation overhead)
export const logVaultAction = async (
  userId: string,
  entry: AuditLogEntry
) => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', userId)
      .maybeSingle();

    await supabase.from('nres_vault_audit_log').insert({
      user_id: userId,
      user_name: profile?.full_name || null,
      user_email: profile?.email || null,
      action: entry.action,
      target_type: entry.target_type,
      target_id: entry.target_id || null,
      target_name: entry.target_name || null,
      details: entry.details || null,
    } as any);
  } catch (e) {
    console.error('Audit log failed:', e);
  }
};

export interface VaultAuditRecord {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  target_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export const useVaultAuditLogs = (page: number, pageSize: number = 50) => {
  return useQuery({
    queryKey: ['nres-vault-audit-logs', page, pageSize],
    queryFn: async () => {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('nres_vault_audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return {
        logs: (data || []) as VaultAuditRecord[],
        totalCount: count || 0,
      };
    },
  });
};
