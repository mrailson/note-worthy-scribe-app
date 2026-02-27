import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UAParser } from 'ua-parser-js';

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

const getBrowserInfo = (): string => {
  try {
    const result = UAParser(navigator.userAgent);
    const browser = result.browser;
    const os = result.os;
    const device = result.device;
    const parts: string[] = [];
    if (browser.name) parts.push(`${browser.name}${browser.version ? ' ' + browser.version : ''}`);
    if (os.name) parts.push(`${os.name}${os.version ? ' ' + os.version : ''}`);
    if (device.type) parts.push(device.type);
    return parts.join(' / ') || navigator.userAgent.slice(0, 100);
  } catch {
    return navigator.userAgent.slice(0, 100);
  }
};

const fetchClientIp = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.functions.invoke('get-client-info');
    return data?.ip || null;
  } catch {
    return null;
  }
};

export const useVaultAuditLog = () => {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (entry: AuditLogEntry) => {
      if (!user?.id) return;

      const [profileResult, ip] = await Promise.all([
        supabase.from('profiles').select('full_name, email').eq('user_id', user.id).maybeSingle(),
        fetchClientIp(),
      ]);
      const profile = profileResult.data;

      await supabase.from('nres_vault_audit_log').insert({
        user_id: user.id,
        user_name: profile?.full_name || null,
        user_email: profile?.email || null,
        action: entry.action,
        target_type: entry.target_type,
        target_id: entry.target_id || null,
        target_name: entry.target_name || null,
        details: entry.details || null,
        browser_info: getBrowserInfo(),
        ip_address: ip,
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
    const [profileResult, ip] = await Promise.all([
      supabase.from('profiles').select('full_name, email').eq('user_id', userId).maybeSingle(),
      fetchClientIp(),
    ]);
    const profile = profileResult.data;

    await supabase.from('nres_vault_audit_log').insert({
      user_id: userId,
      user_name: profile?.full_name || null,
      user_email: profile?.email || null,
      action: entry.action,
      target_type: entry.target_type,
      target_id: entry.target_id || null,
      target_name: entry.target_name || null,
      details: entry.details || null,
      browser_info: getBrowserInfo(),
      ip_address: ip,
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
  browser_info: string | null;
  ip_address: string | null;
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
