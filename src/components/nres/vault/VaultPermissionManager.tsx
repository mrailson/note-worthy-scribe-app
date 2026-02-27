import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNRESUserAccess } from '@/hooks/useNRESUserAccess';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Shield, Trash2, UserPlus } from 'lucide-react';

interface VaultPermissionManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetId: string;
  targetType: 'folder' | 'file';
  targetName: string;
}

interface ExistingPermission {
  id: string;
  user_id: string;
  permission_level: string;
  is_inherited: boolean;
  user_name?: string;
  user_email?: string;
}

export const VaultPermissionManager = ({
  open,
  onOpenChange,
  targetId,
  targetType,
  targetName,
}: VaultPermissionManagerProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: nresUsers } = useNRESUserAccess();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('viewer');

  // Fetch existing permissions for this item
  const { data: permissions, isLoading } = useQuery({
    queryKey: ['vault-permissions', targetId, targetType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_drive_permissions')
        .select('id, user_id, permission_level, is_inherited')
        .eq('target_id', targetId)
        .eq('target_type', targetType as any);

      if (error) throw error;

      // Enrich with user names
      const userIds = (data || []).map((p: any) => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.user_id, p])
      );

      return (data || []).map((p: any) => ({
        ...p,
        user_name: profileMap.get(p.user_id)?.full_name || 'Unknown',
        user_email: profileMap.get(p.user_id)?.email || '',
      })) as ExistingPermission[];
    },
    enabled: open,
  });

  const addPermission = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedUserId) throw new Error('Missing data');

      const { error } = await supabase
        .from('shared_drive_permissions')
        .upsert(
          {
            target_id: targetId,
            target_type: targetType as any,
            user_id: selectedUserId,
            permission_level: selectedLevel as any,
            actions: selectedLevel === 'no_access' ? [] :
              selectedLevel === 'viewer' ? ['view'] :
              ['view', 'edit', 'upload', 'delete'],
            is_inherited: false,
            granted_by: user.id,
          },
          { onConflict: 'target_id,target_type,user_id' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault-permissions', targetId] });
      queryClient.invalidateQueries({ queryKey: ['nres-vault'] });
      setSelectedUserId('');
      toast.success('Permission updated');
    },
    onError: (err: any) => toast.error('Failed to set permission', { description: err.message }),
  });

  const removePermission = useMutation({
    mutationFn: async (permissionId: string) => {
      const { error } = await supabase
        .from('shared_drive_permissions')
        .delete()
        .eq('id', permissionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault-permissions', targetId] });
      queryClient.invalidateQueries({ queryKey: ['nres-vault'] });
      toast.success('Permission removed');
    },
    onError: (err: any) => toast.error('Failed to remove permission', { description: err.message }),
  });

  const existingUserIds = new Set(permissions?.map((p) => p.user_id) || []);
  const availableUsers = (nresUsers || []).filter(
    (u) => !existingUserIds.has(u.user_id) && u.user_id !== user?.id
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Manage Access
          </DialogTitle>
          <DialogDescription>
            Control who can access "{targetName}". By default, all NRES users have full access.
            Adding a user here overrides their default access level.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new permission */}
          <div className="space-y-2">
            <Label>Add User Restriction</Label>
            <div className="flex gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select user..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name || u.email || 'Unknown'}{' '}
                      {u.practice_name && (
                        <span className="text-muted-foreground">({u.practice_name})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="no_access">No Access</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="icon"
                onClick={() => addPermission.mutate()}
                disabled={!selectedUserId || addPermission.isPending}
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Existing permissions */}
          <div className="space-y-2">
            <Label>Current Permissions</Label>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : permissions?.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No specific permissions set. All NRES users have full access.
              </p>
            ) : (
              <div className="space-y-1">
                {permissions?.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm"
                  >
                    <div>
                      <span className="font-medium">{p.user_name}</span>
                      {p.user_email && (
                        <span className="text-muted-foreground ml-1 text-xs">
                          ({p.user_email})
                        </span>
                      )}
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-muted">
                        {p.permission_level}
                      </span>
                      {p.is_inherited && (
                        <span className="ml-1 text-xs text-muted-foreground">(inherited)</span>
                      )}
                    </div>
                    {!p.is_inherited && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removePermission.mutate(p.id)}
                        disabled={removePermission.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
