import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Users, 
  UserPlus, 
  X, 
  Shield, 
  Building2,
  Check,
  ChevronsUpDown,
  Loader2,
  Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastWrapper';
import { cn } from '@/lib/utils';

interface AccessGrant {
  id: string;
  granted_to_user_id: string;
  granted_by_user_id: string;
  can_edit: boolean;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

interface UserOption {
  id: string;
  email: string;
  full_name: string | null;
  practice_id: string | null;
}

interface Practice {
  id: string;
  name: string;
}

interface InspectionAccessManagerProps {
  sessionId: string;
  sessionPracticeId: string;
  isOwner: boolean;
}

export const InspectionAccessManager = ({ 
  sessionId, 
  sessionPracticeId,
  isOwner 
}: InspectionAccessManagerProps) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [accessGrants, setAccessGrants] = useState<AccessGrant[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [selectedPractice, setSelectedPractice] = useState<string>(sessionPracticeId);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [canEdit, setCanEdit] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Check if current user is system admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'system_admin')
        .single();
      
      setIsSystemAdmin(!!data);
    };
    checkAdmin();
  }, [user]);

  // Load access grants
  useEffect(() => {
    if (isOpen && sessionId) {
      loadAccessGrants();
      loadAvailableUsers();
      if (isSystemAdmin) {
        loadPractices();
        loadAllUsers();
      }
    }
  }, [isOpen, sessionId, isSystemAdmin]);

  // Filter users by practice for admins
  useEffect(() => {
    if (isSystemAdmin && selectedPractice) {
      const filteredUsers = allUsers.filter(u => 
        u.practice_id === selectedPractice || !u.practice_id
      );
      setAvailableUsers(filteredUsers);
    }
  }, [selectedPractice, allUsers, isSystemAdmin]);

  const loadAccessGrants = async () => {
    setIsLoading(true);
    try {
      const { data: grants, error } = await supabase
        .from('mock_inspection_access')
        .select('*')
        .eq('session_id', sessionId);

      if (error) throw error;

      // Fetch user details for each grant
      const grantsWithUsers = await Promise.all(
        (grants || []).map(async (grant) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('user_id', grant.granted_to_user_id)
            .single();
          
          return {
            ...grant,
            user_email: profile?.email,
            user_name: profile?.full_name
          };
        })
      );

      setAccessGrants(grantsWithUsers);
    } catch (error) {
      console.error('Error loading access grants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableUsers = async () => {
    try {
      // Load users from the same practice via user_roles table (where practice_id is stored)
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id, practice_id')
        .eq('practice_id', sessionPracticeId)
        .not('user_id', 'eq', user?.id);

      if (roleError) throw roleError;

      if (!roleData || roleData.length === 0) {
        if (!isSystemAdmin) {
          setAvailableUsers([]);
        }
        return;
      }

      // Get profile info for these users
      const userIds = roleData.map(r => r.user_id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', userIds);

      if (profileError) throw profileError;

      const practiceUsers = (profileData || []).map((p: any) => ({
        id: p.user_id,
        email: p.email,
        full_name: p.full_name,
        practice_id: sessionPracticeId
      }));

      if (!isSystemAdmin) {
        setAvailableUsers(practiceUsers);
      }
    } catch (error) {
      console.error('Error loading available users:', error);
    }
  };

  const loadAllUsers = async () => {
    try {
      // Get all users with their practice from user_roles
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id, practice_id')
        .not('user_id', 'eq', user?.id);

      if (roleError) throw roleError;

      // Get profile info
      const userIds = [...new Set((roleData || []).map(r => r.user_id))];
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', userIds);

      if (profileError) throw profileError;

      // Create practice lookup
      const practiceMap = new Map<string, string>();
      (roleData || []).forEach(r => {
        if (r.practice_id) practiceMap.set(r.user_id, r.practice_id);
      });

      const users = (profileData || []).map((p: any) => ({
        id: p.user_id,
        email: p.email,
        full_name: p.full_name,
        practice_id: practiceMap.get(p.user_id) || null
      }));

      setAllUsers(users);
    } catch (error) {
      console.error('Error loading all users:', error);
    }
  };

  const loadPractices = async () => {
    try {
      const { data, error } = await supabase
        .from('gp_practices')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setPractices(data || []);
    } catch (error) {
      console.error('Error loading practices:', error);
    }
  };

  const handleGrantAccess = async () => {
    if (!selectedUserId || !user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('mock_inspection_access')
        .insert({
          session_id: sessionId,
          granted_to_user_id: selectedUserId,
          granted_by_user_id: user.id,
          can_edit: canEdit
        });

      if (error) throw error;

      showToast.success('Access granted - User can now view this inspection.');

      setSelectedUserId('');
      setCanEdit(false);
      loadAccessGrants();
    } catch (error: any) {
      console.error('Error granting access:', error);
      showToast.error(error.message || 'Failed to grant access. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevokeAccess = async (grantId: string) => {
    try {
      const { error } = await supabase
        .from('mock_inspection_access')
        .delete()
        .eq('id', grantId);

      if (error) throw error;

      showToast.success('Access revoked - User can no longer view this inspection.');

      loadAccessGrants();
    } catch (error: any) {
      console.error('Error revoking access:', error);
      showToast.error(error.message || 'Failed to revoke access. Please try again.');
    }
  };

  const selectedUser = availableUsers.find(u => u.id === selectedUserId);
  const selectedPracticeName = practices.find(p => p.id === selectedPractice)?.name;

  // Filter out already-granted users
  const grantedUserIds = accessGrants.map(g => g.granted_to_user_id);
  const ungrantedUsers = availableUsers.filter(u => !grantedUserIds.includes(u.id));

  if (!isOwner && !isSystemAdmin) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Users className="h-4 w-4" />
          Manage Access
          {accessGrants.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {accessGrants.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Inspection Access Management
          </DialogTitle>
          <DialogDescription>
            Control who can view and edit this Mock CQC Inspection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Admin: Practice Selector */}
          {isSystemAdmin && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Filter by Practice
              </label>
              <Popover open={practiceOpen} onOpenChange={setPracticeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {selectedPracticeName || "Select practice..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 z-[100]">
                  <Command>
                    <CommandInput placeholder="Search practices..." />
                    <CommandList>
                      <CommandEmpty>No practice found.</CommandEmpty>
                      <CommandGroup>
                        {practices.map((practice) => (
                          <CommandItem
                            key={practice.id}
                            value={practice.name}
                            onSelect={() => {
                              setSelectedPractice(practice.id);
                              setPracticeOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedPractice === practice.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {practice.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Add User */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Grant Access to User
            </label>
            
            <div className="flex gap-2">
              <Popover open={userOpen} onOpenChange={setUserOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="flex-1 justify-between"
                  >
                    {selectedUser 
                      ? (selectedUser.full_name || selectedUser.email)
                      : "Select user..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 z-[100]">
                  <Command>
                    <CommandInput placeholder="Search users..." />
                    <CommandList>
                      <CommandEmpty>No users available.</CommandEmpty>
                      <CommandGroup>
                        {ungrantedUsers.map((u) => (
                          <CommandItem
                            key={u.id}
                            value={`${u.full_name || ''} ${u.email}`}
                            onSelect={() => {
                              setSelectedUserId(u.id);
                              setUserOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedUserId === u.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">{u.full_name || 'Unnamed'}</span>
                              <span className="text-xs text-muted-foreground">{u.email}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="canEdit"
                  checked={canEdit}
                  onCheckedChange={(checked) => setCanEdit(checked === true)}
                />
                <label 
                  htmlFor="canEdit" 
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  Allow editing
                </label>
              </div>
              
              <Button 
                onClick={handleGrantAccess}
                disabled={!selectedUserId || isSaving}
                size="sm"
                className="ml-auto"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Grant Access
              </Button>
            </div>
          </div>

          {/* Current Access List */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Current Access</label>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : accessGrants.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No additional users have access to this inspection.
              </p>
            ) : (
              <div className="space-y-2">
                {accessGrants.map((grant) => (
                  <div 
                    key={grant.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {grant.user_name || 'Unnamed User'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {grant.user_email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <Badge variant={grant.can_edit ? 'default' : 'secondary'} className="text-xs">
                        {grant.can_edit ? 'Can Edit' : 'View Only'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRevokeAccess(grant.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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