import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings, UserPlus, Trash2, Crown, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface VaultAdmin {
  id: string;
  user_id: string;
  is_super_admin: boolean;
  is_admin: boolean;
  created_at: string;
  email?: string;
}

interface VaultSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const VaultSettingsModal = ({ open, onOpenChange }: VaultSettingsModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [maxFileSize, setMaxFileSize] = useState(50);

  // Fetch vault settings
  const { data: settings } = useQuery({
    queryKey: ['nres-vault-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nres_vault_settings')
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch vault admins with profile emails
  const { data: admins = [] } = useQuery({
    queryKey: ['nres-vault-admins'],
    queryFn: async (): Promise<VaultAdmin[]> => {
      const { data, error } = await supabase
        .from('nres_vault_admins')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;

      // Fetch emails from profiles
      const userIds = (data || []).map((a: any) => a.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      const emailMap = new Map((profiles || []).map((p: any) => [p.id, p.email]));

      return (data || []).map((a: any) => ({
        ...a,
        email: emailMap.get(a.user_id) || 'Unknown',
      }));
    },
    enabled: open,
  });

  // Check if current user is super admin
  const isSuperAdmin = admins.some(
    (a) => a.user_id === user?.id && a.is_super_admin
  );

  useEffect(() => {
    if (settings) {
      setMaxFileSize(settings.max_file_size_mb);
    }
  }, [settings]);

  // Update max file size
  const updateSettings = useMutation({
    mutationFn: async (newMaxSize: number) => {
      if (!settings?.id) return;
      const { error } = await supabase
        .from('nres_vault_settings')
        .update({ max_file_size_mb: newMaxSize })
        .eq('id', settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nres-vault-settings'] });
      toast.success('Maximum file size updated');
    },
    onError: () => toast.error('Failed to update settings'),
  });

  // Add admin
  const addAdmin = useMutation({
    mutationFn: async (email: string) => {
      // Find user by email in profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .single();

      if (profileError || !profile) {
        throw new Error('User not found. They must have an active account.');
      }

      // Check if already an admin
      const { data: existing } = await supabase
        .from('nres_vault_admins')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existing) {
        throw new Error('This user is already a vault admin.');
      }

      const { error } = await supabase
        .from('nres_vault_admins')
        .insert({
          user_id: profile.id,
          is_admin: true,
          is_super_admin: false,
          added_by: user?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nres-vault-admins'] });
      setNewAdminEmail('');
      toast.success('Admin added successfully');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to add admin'),
  });

  // Remove admin
  const removeAdmin = useMutation({
    mutationFn: async (adminId: string) => {
      const { error } = await supabase
        .from('nres_vault_admins')
        .delete()
        .eq('id', adminId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nres-vault-admins'] });
      toast.success('Admin removed');
    },
    onError: () => toast.error('Failed to remove admin'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[calc(100vh-8rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Document Vault Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Max File Size */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Global Upload Limit
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label htmlFor="max-file-size" className="text-xs text-muted-foreground">
                  Maximum file size (MB)
                </Label>
                <Input
                  id="max-file-size"
                  type="number"
                  min={1}
                  max={500}
                  value={maxFileSize}
                  onChange={(e) => setMaxFileSize(Number(e.target.value))}
                  className="bg-white dark:bg-white/10 mt-1"
                />
              </div>
              <Button
                className="mt-5"
                size="sm"
                disabled={maxFileSize === settings?.max_file_size_mb || maxFileSize < 1}
                onClick={() => updateSettings.mutate(maxFileSize)}
              >
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Currently set to <strong>{settings?.max_file_size_mb ?? 50} MB</strong>. This applies to all users.
            </p>
          </div>

          <Separator />

          {/* Vault Admins */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Vault Administrators
            </h3>
            <p className="text-xs text-muted-foreground">
              Admins can manage folder permissions and vault settings. Super admins can add/remove other admins.
            </p>

            <div className="space-y-2">
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {admin.is_super_admin ? (
                      <Crown className="h-4 w-4 text-amber-500 shrink-0" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <span className="text-sm truncate">{admin.email}</span>
                    {admin.is_super_admin && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        Super Admin
                      </Badge>
                    )}
                  </div>
                  {isSuperAdmin && !admin.is_super_admin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                      onClick={() => removeAdmin.mutate(admin.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {isSuperAdmin && (
              <div className="flex items-center gap-2 pt-2">
                <Input
                  placeholder="Enter email address..."
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="bg-white dark:bg-white/10"
                  onKeyDown={(e) => e.key === 'Enter' && newAdminEmail.trim() && addAdmin.mutate(newAdminEmail)}
                />
                <Button
                  size="sm"
                  disabled={!newAdminEmail.trim() || addAdmin.isPending}
                  onClick={() => addAdmin.mutate(newAdminEmail)}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
