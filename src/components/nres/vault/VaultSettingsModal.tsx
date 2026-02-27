import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings, UserPlus, Trash2, Crown, ShieldCheck, Users, Pencil, Plus, ClipboardList } from 'lucide-react';
import { VaultAuditLogTab } from './VaultAuditLogTab';
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
  full_name?: string;
}

interface NRESActivatedUser {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface VaultGroup {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  members: { user_id: string; full_name: string | null; email: string | null }[];
}

interface VaultSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const VaultSettingsModal = ({ open, onOpenChange }: VaultSettingsModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [maxFileSize, setMaxFileSize] = useState(50);
  const [activeTab, setActiveTab] = useState('settings');

  // Group editing state
  const [editingGroup, setEditingGroup] = useState<VaultGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Fetch NRES activated users
  const { data: nresUsers = [] } = useQuery({
    queryKey: ['nres-activated-users'],
    queryFn: async (): Promise<NRESActivatedUser[]> => {
      const { data: activations, error } = await supabase
        .from('user_service_activations')
        .select('user_id')
        .eq('service', 'nres');

      if (error || !activations?.length) return [];

      const userIds = [...new Set(activations.map((a) => a.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      return (profiles || []).map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
      }));
    },
    enabled: open,
  });

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

  // Fetch vault admins
  const { data: admins = [] } = useQuery({
    queryKey: ['nres-vault-admins'],
    queryFn: async (): Promise<VaultAdmin[]> => {
      const { data, error } = await supabase
        .from('nres_vault_admins')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;

      const userIds = (data || []).map((a: any) => a.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      return (data || []).map((a: any) => {
        const profile = profileMap.get(a.user_id);
        return {
          ...a,
          email: profile?.email || 'Unknown',
          full_name: profile?.full_name || null,
        };
      });
    },
    enabled: open,
  });

  // Fetch vault groups with members
  const { data: groups = [] } = useQuery({
    queryKey: ['nres-vault-groups', 'settings-modal'],
    queryFn: async (): Promise<VaultGroup[]> => {
      const { data: groupsData, error } = await supabase
        .from('nres_vault_user_groups')
        .select('*')
        .order('name');
      if (error) throw error;

      const groupIds = (groupsData || []).map((g: any) => g.id);
      if (!groupIds.length) return (groupsData || []).map((g: any) => ({ ...g, members: [] }));

      const { data: membersData } = await supabase
        .from('nres_vault_user_group_members')
        .select('group_id, user_id')
        .in('group_id', groupIds);

      const memberUserIds = [...new Set((membersData || []).map((m: any) => m.user_id))];
      const { data: profiles } = memberUserIds.length
        ? await supabase.from('profiles').select('user_id, full_name, email').in('user_id', memberUserIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      return (groupsData || []).map((g: any) => ({
        ...g,
        members: (membersData || [])
          .filter((m: any) => m.group_id === g.id)
          .map((m: any) => {
            const profile = profileMap.get(m.user_id);
            return {
              user_id: m.user_id,
              full_name: profile?.full_name || null,
              email: profile?.email || null,
            };
          }),
      }));
    },
    enabled: open,
  });

  const isSuperAdmin = admins.some((a) => a.user_id === user?.id && a.is_super_admin);

  // Users not already admins (for the dropdown)
  const availableUsersForAdmin = nresUsers.filter(
    (u) => !admins.some((a) => a.user_id === u.user_id)
  );

  useEffect(() => {
    if (settings) setMaxFileSize(settings.max_file_size_mb);
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

  // Add admin by user_id
  const addAdmin = useMutation({
    mutationFn: async (userId: string) => {
      const { data: existing } = await supabase
        .from('nres_vault_admins')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) throw new Error('This user is already a vault admin.');

      const { error } = await supabase
        .from('nres_vault_admins')
        .insert({ user_id: userId, is_admin: true, is_super_admin: false, added_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nres-vault-admins'] });
      setSelectedUserId('');
      toast.success('Admin added successfully');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to add admin'),
  });

  // Remove admin
  const removeAdmin = useMutation({
    mutationFn: async (adminId: string) => {
      const { error } = await supabase.from('nres_vault_admins').delete().eq('id', adminId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nres-vault-admins'] });
      toast.success('Admin removed');
    },
    onError: () => toast.error('Failed to remove admin'),
  });

  // Save group (create or update)
  const saveGroup = useMutation({
    mutationFn: async () => {
      if (!groupName.trim()) throw new Error('Group name is required');

      let groupId: string;

      if (editingGroup) {
        // Update
        const { error } = await supabase
          .from('nres_vault_user_groups')
          .update({ name: groupName.trim(), description: groupDescription.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', editingGroup.id);
        if (error) throw error;
        groupId = editingGroup.id;

        // Remove existing members
        await supabase.from('nres_vault_user_group_members').delete().eq('group_id', groupId);
      } else {
        // Create
        const { data, error } = await supabase
          .from('nres_vault_user_groups')
          .insert({ name: groupName.trim(), description: groupDescription.trim() || null, created_by: user?.id })
          .select('id')
          .single();
        if (error) throw error;
        groupId = data.id;
      }

      // Add members
      if (selectedGroupMembers.length > 0) {
        const { error } = await supabase
          .from('nres_vault_user_group_members')
          .insert(selectedGroupMembers.map((uid) => ({ group_id: groupId, user_id: uid })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nres-vault-groups'] });
      resetGroupForm();
      toast.success(editingGroup ? 'Group updated' : 'Group created');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save group'),
  });

  // Delete group
  const deleteGroup = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from('nres_vault_user_groups').delete().eq('id', groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nres-vault-groups'] });
      toast.success('Group deleted');
    },
    onError: () => toast.error('Failed to delete group'),
  });

  const resetGroupForm = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupDescription('');
    setSelectedGroupMembers([]);
    setIsCreatingGroup(false);
  };

  const startEditGroup = (group: VaultGroup) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description || '');
    setSelectedGroupMembers((group.members || []).map((m) => m.user_id));
    setIsCreatingGroup(true);
  };

  const toggleGroupMember = (userId: string) => {
    setSelectedGroupMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const getUserLabel = (u: NRESActivatedUser) => {
    if (u.full_name && u.email) return `${u.full_name} (${u.email})`;
    return u.full_name || u.email || u.user_id;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[calc(100vh-8rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Document Vault Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="settings" className="flex-1">
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex-1">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Groups
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex-1">
              <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          {/* ===== Settings Tab ===== */}
          <TabsContent value="settings">
            <div className="space-y-6 py-4">
              {/* Max File Size */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Global Upload Limit</h3>
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
                    <div key={admin.id} className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30">
                      <div className="flex items-center gap-2 min-w-0">
                        {admin.is_super_admin ? (
                          <Crown className="h-4 w-4 text-amber-500 shrink-0" />
                        ) : (
                          <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span className="text-sm truncate block">{admin.full_name || admin.email}</span>
                          {admin.full_name && (
                            <span className="text-xs text-muted-foreground truncate block">{admin.email}</span>
                          )}
                        </div>
                        {admin.is_super_admin && (
                          <Badge variant="outline" className="text-[10px] shrink-0">Super Admin</Badge>
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
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger className="bg-white dark:bg-white/10 flex-1">
                        <SelectValue placeholder="Select a user..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUsersForAdmin.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">No available users</div>
                        ) : (
                          availableUsersForAdmin
                            .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
                            .map((u) => (
                              <SelectItem key={u.user_id} value={u.user_id}>
                                {getUserLabel(u)}
                              </SelectItem>
                            ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={!selectedUserId || addAdmin.isPending}
                      onClick={() => addAdmin.mutate(selectedUserId)}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ===== Groups Tab ===== */}
          <TabsContent value="groups">
            <div className="space-y-4 py-4">
              {!isCreatingGroup ? (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      User Groups
                    </h3>
                    <Button size="sm" variant="outline" onClick={() => { resetGroupForm(); setIsCreatingGroup(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      New Group
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Create groups of users for easier permission management.
                  </p>

                  {groups.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No groups created yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {groups.map((group) => (
                        <div key={group.id} className="p-3 rounded-md border bg-muted/30 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium">{group.name}</span>
                              {group.description && (
                                <p className="text-xs text-muted-foreground">{group.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditGroup(group)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => deleteGroup.mutate(group.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {(group.members || []).length === 0 ? (
                              <span className="text-xs text-muted-foreground italic">No members</span>
                            ) : (
                              (group.members || []).map((m) => (
                                <Badge key={m.user_id} variant="secondary" className="text-[10px]">
                                  {m.full_name || m.email || 'Unknown'}
                                </Badge>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* Group create/edit form */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      {editingGroup ? 'Edit Group' : 'Create Group'}
                    </h3>
                    <Button size="sm" variant="ghost" onClick={resetGroupForm}>
                      Cancel
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="group-name" className="text-xs text-muted-foreground">Group Name</Label>
                      <Input
                        id="group-name"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="e.g. Clinical Leads"
                        className="bg-white dark:bg-white/10 mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="group-desc" className="text-xs text-muted-foreground">Description (optional)</Label>
                      <Input
                        id="group-desc"
                        value={groupDescription}
                        onChange={(e) => setGroupDescription(e.target.value)}
                        placeholder="Brief description..."
                        className="bg-white dark:bg-white/10 mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Members</Label>
                      <div className="mt-1 border rounded-md max-h-48 overflow-y-auto">
                        {nresUsers
                          .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
                          .map((u) => (
                            <label
                              key={u.user_id}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm border-b last:border-b-0"
                            >
                              <Checkbox
                                checked={selectedGroupMembers.includes(u.user_id)}
                                onCheckedChange={() => toggleGroupMember(u.user_id)}
                              />
                              <span className="truncate">{getUserLabel(u)}</span>
                            </label>
                          ))}
                        {nresUsers.length === 0 && (
                          <div className="px-3 py-4 text-xs text-muted-foreground text-center">No NRES users found</div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedGroupMembers.length} member{selectedGroupMembers.length !== 1 ? 's' : ''} selected
                      </p>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    disabled={!groupName.trim() || saveGroup.isPending}
                    onClick={() => saveGroup.mutate()}
                  >
                    {editingGroup ? 'Update Group' : 'Create Group'}
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="audit">
            <VaultAuditLogTab />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
