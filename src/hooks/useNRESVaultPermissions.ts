import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type VaultPermissionLevel = 'full_access' | 'owner' | 'editor' | 'viewer' | 'no_access';

export const useVaultPermission = (targetId: string | null, targetType: 'folder' | 'file') => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['nres-vault-permission', targetId, targetType, user?.id],
    queryFn: async (): Promise<VaultPermissionLevel> => {
      if (!user?.id || !targetId) return 'full_access';

      const { data, error } = await supabase.rpc('check_nres_vault_permission', {
        p_user_id: user.id,
        p_target_id: targetId,
        p_target_type: targetType,
      });

      if (error) {
        console.error('Error checking vault permission:', error);
        return 'full_access';
      }

      return (data as VaultPermissionLevel) || 'full_access';
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000,
  });
};

export const useIsVaultAdmin = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['is-vault-admin', user?.id],
    queryFn: async (): Promise<boolean> => {
      if (!user?.id) return false;

      // Check nres_vault_admins table first
      const { data: vaultAdmin } = await supabase
        .from('nres_vault_admins')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (vaultAdmin) return true;

      // Fallback to system-level roles
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) return false;
      return (data || []).some((r: any) => r.role === 'system_admin' || r.role === 'admin');
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
};

export const canUpload = (level: VaultPermissionLevel) =>
  ['full_access', 'owner', 'editor'].includes(level);

export const canDelete = (level: VaultPermissionLevel) =>
  ['full_access', 'owner'].includes(level);

export const canManageAccess = (level: VaultPermissionLevel, isAdmin: boolean, isCreator: boolean) =>
  isAdmin || isCreator;
