import { useState, useMemo } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Shield, Trash2, UserPlus, Users, Building2, Check, FolderOpen } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  practice_name?: string;
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
  const [selectedPractice, setSelectedPractice] = useState('');
  const [practiceLevel, setPracticeLevel] = useState('viewer');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [multiLevel, setMultiLevel] = useState('viewer');
  const [activeTab, setActiveTab] = useState('individual');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupLevel, setGroupLevel] = useState('viewer');

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

      const userIds = (data || []).map((p: any) => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      // Get practice names for existing permissions
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id, practice_id, gp_practices(name)')
        .in('user_id', userIds);

      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.user_id, p])
      );

      const practiceMap = new Map<string, string>();
      (userRoles || []).forEach((ur: any) => {
        if (ur.gp_practices && !practiceMap.has(ur.user_id)) {
          practiceMap.set(ur.user_id, (ur.gp_practices as { name: string }).name);
        }
      });

      return (data || []).map((p: any) => ({
        ...p,
        user_name: profileMap.get(p.user_id)?.full_name || 'Unknown',
        user_email: profileMap.get(p.user_id)?.email || '',
        practice_name: practiceMap.get(p.user_id) || null,
      })) as ExistingPermission[];
    },
    enabled: open,
  });

  // Fetch vault user groups
  const { data: vaultGroups = [] } = useQuery({
    queryKey: ['nres-vault-groups'],
    queryFn: async () => {
      const { data: groupsData, error } = await supabase
        .from('nres_vault_user_groups')
        .select('*')
        .order('name');
      if (error) throw error;

      const groupIds = (groupsData || []).map((g: any) => g.id);
      if (!groupIds.length) return (groupsData || []).map((g: any) => ({ ...g, memberIds: [] as string[] }));

      const { data: membersData } = await supabase
        .from('nres_vault_user_group_members')
        .select('group_id, user_id')
        .in('group_id', groupIds);

      return (groupsData || []).map((g: any) => ({
        ...g,
        memberIds: (membersData || []).filter((m: any) => m.group_id === g.id).map((m: any) => m.user_id),
      }));
    },
    enabled: open,
  });

  // Derive unique practices from NRES users
  const practices = useMemo(() => {
    const practiceSet = new Map<string, string[]>();
    (nresUsers || []).forEach((u) => {
      if (u.practice_name) {
        if (!practiceSet.has(u.practice_name)) {
          practiceSet.set(u.practice_name, []);
        }
        practiceSet.get(u.practice_name)!.push(u.user_id);
      }
    });
    return Array.from(practiceSet.entries())
      .map(([name, userIds]) => ({ name, userIds }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [nresUsers]);

  const existingUserIds = new Set(permissions?.map((p) => p.user_id) || []);
  const availableUsers = (nresUsers || []).filter(
    (u) => !existingUserIds.has(u.user_id) && u.user_id !== user?.id
  );

  // Users available for multi-select (not already permissioned)
  const availableForMulti = availableUsers;

  const addPermission = useMutation({
    mutationFn: async ({ userId, level }: { userId: string; level: string }) => {
      if (!user?.id) throw new Error('Missing user');

      const { error } = await supabase
        .from('shared_drive_permissions')
        .upsert(
          {
            target_id: targetId,
            target_type: targetType as any,
            user_id: userId,
            permission_level: level as any,
            actions:
              level === 'no_access'
                ? []
                : level === 'viewer'
                ? ['view']
                : ['view', 'edit', 'upload', 'delete'],
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
    },
    onError: (err: any) =>
      toast.error('Failed to set permission', { description: err.message }),
  });

  const handleAddSingle = async () => {
    if (!selectedUserId) return;
    await addPermission.mutateAsync({ userId: selectedUserId, level: selectedLevel });
    setSelectedUserId('');
    toast.success('Permission added');
  };

  const handleAddByPractice = async () => {
    if (!selectedPractice) return;
    const practice = practices.find((p) => p.name === selectedPractice);
    if (!practice) return;

    const usersToAdd = practice.userIds.filter(
      (id) => !existingUserIds.has(id) && id !== user?.id
    );

    if (usersToAdd.length === 0) {
      toast.info('All users from this practice already have permissions set');
      return;
    }

    let count = 0;
    for (const userId of usersToAdd) {
      await addPermission.mutateAsync({ userId, level: practiceLevel });
      count++;
    }
    setSelectedPractice('');
    toast.success(`Permission set for ${count} user${count !== 1 ? 's' : ''} from ${practice.name}`);
  };

  const handleAddMultiple = async () => {
    if (selectedUserIds.size === 0) return;

    let count = 0;
    for (const userId of selectedUserIds) {
      await addPermission.mutateAsync({ userId, level: multiLevel });
      count++;
    }
    setSelectedUserIds(new Set());
    toast.success(`Permission set for ${count} user${count !== 1 ? 's' : ''}`);
  };

  const handleAddByGroup = async () => {
    if (!selectedGroupId) return;
    const group = vaultGroups.find((g: any) => g.id === selectedGroupId);
    if (!group) return;

    const usersToAdd = (group.memberIds || []).filter(
      (id: string) => !existingUserIds.has(id) && id !== user?.id
    );

    if (usersToAdd.length === 0) {
      toast.info('All members of this group already have permissions set');
      return;
    }

    let count = 0;
    for (const userId of usersToAdd) {
      await addPermission.mutateAsync({ userId, level: groupLevel });
      count++;
    }
    setSelectedGroupId('');
    toast.success(`Permission set for ${count} user${count !== 1 ? 's' : ''} from ${group.name}`);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const selectAllAvailable = () => {
    setSelectedUserIds(new Set(availableForMulti.map((u) => u.user_id)));
  };

  const clearSelection = () => {
    setSelectedUserIds(new Set());
  };

  const [showRemoveAllConfirm, setShowRemoveAllConfirm] = useState(false);

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
    onError: (err: any) =>
      toast.error('Failed to remove permission', { description: err.message }),
  });

  const removeAllPermissions = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('shared_drive_permissions')
        .delete()
        .eq('target_id', targetId)
        .eq('target_type', targetType as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault-permissions', targetId] });
      queryClient.invalidateQueries({ queryKey: ['nres-vault'] });
      setShowRemoveAllConfirm(false);
      toast.success('All permissions removed');
    },
    onError: (err: any) =>
      toast.error('Failed to remove permissions', { description: err.message }),
  });

  const permissionLevelLabel = (level: string) => {
    switch (level) {
      case 'viewer':
        return 'Viewer';
      case 'editor':
        return 'Editor';
      case 'no_access':
        return 'No Access';
      default:
        return level;
    }
  };

  const permissionLevelColor = (level: string) => {
    switch (level) {
      case 'viewer':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'editor':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'no_access':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  // Group existing permissions by practice
  const groupedPermissions = useMemo(() => {
    if (!permissions) return [];
    const groups = new Map<string, ExistingPermission[]>();
    permissions.forEach((p) => {
      const practice = p.practice_name || 'Other';
      if (!groups.has(practice)) groups.set(practice, []);
      groups.get(practice)!.push(p);
    });
    return Array.from(groups.entries())
      .map(([name, perms]) => ({ name, permissions: perms }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [permissions]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[calc(100vh-8rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Manage Access
          </DialogTitle>
          <DialogDescription>
            Control who can access "<span className="font-medium">{targetName}</span>".
            By default, all NRES users have full access. Adding permissions here overrides the default.
          </DialogDescription>
        </DialogHeader>


        <div className="px-8 sm:px-10 py-6 space-y-6">
          {/* Add permissions section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Add Permissions</Label>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4 h-9">
                <TabsTrigger value="individual" className="text-xs gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" />
                  Individual
                </TabsTrigger>
                <TabsTrigger value="practice" className="text-xs gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  By Practice
                </TabsTrigger>
                <TabsTrigger value="group" className="text-xs gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5" />
                  By Group
                </TabsTrigger>
                <TabsTrigger value="multiple" className="text-xs gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Select Multiple
                </TabsTrigger>
              </TabsList>

              {/* Individual user */}
              <TabsContent value="individual" className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="flex-1 bg-white dark:bg-background">
                      <SelectValue placeholder="Select user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((u) => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          <span>{u.full_name || u.email || 'Unknown'}</span>
                          {u.practice_name && (
                            <span className="text-muted-foreground ml-1">
                              ({u.practice_name})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                      {availableUsers.length === 0 && (
                        <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                          No users available to add
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                    <SelectTrigger className="w-[130px] bg-white dark:bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="no_access">No Access</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAddSingle}
                    disabled={!selectedUserId || addPermission.isPending}
                    size="sm"
                    className="shrink-0"
                  >
                    <UserPlus className="h-4 w-4 mr-1.5" />
                    Add
                  </Button>
                </div>
              </TabsContent>

              {/* By Practice */}
              <TabsContent value="practice" className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Assign the same permission level to all users from a practice at once.
                </p>
                <div className="flex gap-2">
                  <Select value={selectedPractice} onValueChange={setSelectedPractice}>
                    <SelectTrigger className="flex-1 bg-white dark:bg-background">
                      <SelectValue placeholder="Select practice..." />
                    </SelectTrigger>
                    <SelectContent>
                      {practices.map((p) => (
                        <SelectItem key={p.name} value={p.name}>
                          <span>{p.name}</span>
                          <span className="text-muted-foreground ml-1">
                            ({p.userIds.length} user{p.userIds.length !== 1 ? 's' : ''})
                          </span>
                        </SelectItem>
                      ))}
                      {practices.length === 0 && (
                        <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                          No practices found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <Select value={practiceLevel} onValueChange={setPracticeLevel}>
                    <SelectTrigger className="w-[130px] bg-white dark:bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="no_access">No Access</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAddByPractice}
                    disabled={!selectedPractice || addPermission.isPending}
                    size="sm"
                    className="shrink-0"
                  >
                    <Building2 className="h-4 w-4 mr-1.5" />
                    Assign
                  </Button>
                </div>
                {selectedPractice && (
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5">
                    This will set{' '}
                    <span className="font-medium">{permissionLevelLabel(practiceLevel)}</span>{' '}
                    access for all users from{' '}
                    <span className="font-medium">{selectedPractice}</span> who don't already have
                    a permission set.
                  </div>
                )}
              </TabsContent>

              {/* By Group */}
              <TabsContent value="group" className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Assign the same permission level to all members of a user group.
                </p>
                {vaultGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No groups created yet. Create groups in Vault Settings.
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                      <SelectTrigger className="flex-1 bg-white dark:bg-background">
                        <SelectValue placeholder="Select group..." />
                      </SelectTrigger>
                      <SelectContent>
                        {vaultGroups.map((g: any) => (
                          <SelectItem key={g.id} value={g.id}>
                            <span>{g.name}</span>
                            <span className="text-muted-foreground ml-1">
                              ({(g.memberIds || []).length} member{(g.memberIds || []).length !== 1 ? 's' : ''})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={groupLevel} onValueChange={setGroupLevel}>
                      <SelectTrigger className="w-[130px] bg-white dark:bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="no_access">No Access</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleAddByGroup}
                      disabled={!selectedGroupId || addPermission.isPending}
                      size="sm"
                      className="shrink-0"
                    >
                      <FolderOpen className="h-4 w-4 mr-1.5" />
                      Assign
                    </Button>
                  </div>
                )}
                {selectedGroupId && (
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5">
                    This will set{' '}
                    <span className="font-medium">{permissionLevelLabel(groupLevel)}</span>{' '}
                    access for all members of{' '}
                    <span className="font-medium">{vaultGroups.find((g: any) => g.id === selectedGroupId)?.name}</span>{' '}
                    who don't already have a permission set.
                  </div>
                )}
              </TabsContent>

              {/* Select Multiple */}
              <TabsContent value="multiple" className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Tick users to assign, then choose a permission level.
                  </p>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAllAvailable}>
                      Select All
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearSelection}>
                      Clear
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-[200px] border rounded-md">
                  <div className="p-2 space-y-0.5">
                    {availableForMulti.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No users available to add
                      </p>
                    ) : (
                      availableForMulti.map((u) => (
                        <label
                          key={u.user_id}
                          className="flex items-center gap-3 px-2.5 py-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={selectedUserIds.has(u.user_id)}
                            onCheckedChange={() => toggleUserSelection(u.user_id)}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block">
                              {u.full_name || u.email || 'Unknown'}
                            </span>
                            {u.practice_name && (
                              <span className="text-xs text-muted-foreground truncate block">
                                {u.practice_name}
                              </span>
                            )}
                          </div>
                          {selectedUserIds.has(u.user_id) && (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </label>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {selectedUserIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedUserIds.size} selected —
                    </span>
                    <Select value={multiLevel} onValueChange={setMultiLevel}>
                      <SelectTrigger className="w-[130px] bg-white dark:bg-background h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="no_access">No Access</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleAddMultiple}
                      disabled={addPermission.isPending}
                      size="sm"
                      className="h-8"
                    >
                      <Users className="h-3.5 w-3.5 mr-1.5" />
                      Assign All
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Existing permissions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Current Permissions</Label>
              <div className="flex items-center gap-2">
                {permissions && permissions.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {permissions.length} user{permissions.length !== 1 ? 's' : ''}
                  </Badge>
                )}
                {showRemoveAllConfirm ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Are you sure?</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => removeAllPermissions.mutate()}
                      disabled={removeAllPermissions.isPending}
                    >
                      Remove All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setShowRemoveAllConfirm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => setShowRemoveAllConfirm(true)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove All
                  </Button>
                )}
              </div>
            </div>

            {/* Default access row — always visible */}
            <div className="flex items-center justify-between px-3 py-2.5 rounded-md bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/40 text-sm">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <span className="font-medium block">All NRES Users</span>
                  <span className="text-xs text-muted-foreground block">
                    Default read access for all NRES Dashboard users
                  </span>
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 shrink-0">
                Viewer
              </span>
            </div>

            {isLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
            ) : permissions && permissions.length > 0 ? (
              <ScrollArea className="max-h-[250px]">
                <div className="space-y-3">
                  {groupedPermissions.map((group) => (
                    <div key={group.name}>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
                        {group.name}
                      </p>
                      <div className="space-y-1">
                        {group.permissions.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/40 text-sm"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="min-w-0">
                                <span className="font-medium truncate block">
                                  {p.user_name}
                                </span>
                                {p.user_email && (
                                  <span className="text-muted-foreground text-xs truncate block">
                                    {p.user_email}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${permissionLevelColor(
                                  p.permission_level
                                )}`}
                              >
                                {permissionLevelLabel(p.permission_level)}
                              </span>
                              {p.is_inherited && (
                                <span className="text-xs text-muted-foreground">(inherited)</span>
                              )}
                              {!p.is_inherited && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => removePermission.mutate(p.id)}
                                  disabled={removePermission.isPending}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
