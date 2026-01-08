import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Users, 
  Eye,
  UserCheck,
  AlertCircle
} from 'lucide-react';

interface PracticeUser {
  user_id: string;
  email: string;
  full_name: string;
  last_login: string | null;
  role: string;
  practice_role?: string | null;
  assigned_at: string;
  meeting_notes_access: boolean;
  gp_scribe_access: boolean;
  complaints_manager_access: boolean;
  ai4gp_access: boolean;
  enhanced_access: boolean;
  cqc_compliance_access: boolean;
  shared_drive_access: boolean;
  mic_test_service_access: boolean;
  api_testing_service_access: boolean;
  fridge_monitoring_access: boolean;
  nres_access?: boolean;
}

const practiceRoles = [
  { value: 'gp_partner', label: 'GP Partner' },
  { value: 'salaried_gp', label: 'Salaried GP' },
  { value: 'reception_team', label: 'Reception Team' },
  { value: 'admin_team', label: 'Admin Team' },
  { value: 'secretaries', label: 'Secretaries' }
];

// Organisation types that are NOT GP practices
const nonPracticeOrgTypes = ['Management', 'ICB', 'PCN', 'LMC', 'Neighbourhood'];

// Roles available for non-practice organisations
const organisationRoles = [
  { value: 'practice_user', label: 'User' },
  { value: 'practice_manager', label: 'Organisation Admin' }
];

export const PracticeUserManagement = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<PracticeUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<PracticeUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<PracticeUser | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [practiceInfo, setPracticeInfo] = useState<any>(null);
  const [isNonPracticeOrg, setIsNonPracticeOrg] = useState(false);
  const [currentUserHasNRES, setCurrentUserHasNRES] = useState(false);
  const [editingUserNRESAccess, setEditingUserNRESAccess] = useState(false);
  
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);

  const [userFormData, setUserFormData] = useState({
    email: '',
    full_name: '',
    role: 'practice_user',
    practice_role: '',
    module_access: {
      meeting_notes_access: true,
      gp_scribe_access: false,
      complaints_manager_access: false,
      ai4gp_access: false,
      enhanced_access: false,
      cqc_compliance_access: false,
      shared_drive_access: false,
      mic_test_service_access: false,
      api_testing_service_access: false,
      fridge_monitoring_access: false
    }
  });

  useEffect(() => {
    if (user) {
      loadPracticeInfo();
      loadPracticeUsers();
      checkCurrentUserNRESAccess();
    }
  }, [user]);

  const checkCurrentUserNRESAccess = async () => {
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from('user_service_activations')
      .select('id')
      .eq('user_id', user.id)
      .eq('service', 'nres')
      .maybeSingle();
    
    if (!error && data) {
      setCurrentUserHasNRES(true);
    }
  };

  // Auto-refresh when practice assignment changes
  useEffect(() => {
    const interval = setInterval(() => {
      if (user && !practiceInfo) {
        loadPracticeInfo();
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [user, practiceInfo]);

  const loadPracticeInfo = async () => {
    try {
      const { data: practiceId, error: practiceError } = await supabase
        .rpc('get_practice_manager_practice_id', { _user_id: user?.id });

      if (practiceError || !practiceId) {
        toast.error("Could not find practice assignment");
        return;
      }

      const { data: practice, error } = await supabase
        .from('practice_details')
        .select('practice_name')
        .eq('id', practiceId)
        .single();

      if (error) {
        // Try gp_practices table
        const { data: gpPractice, error: gpError } = await supabase
          .from('gp_practices')
          .select('name, organisation_type')
          .eq('id', practiceId)
          .single();

        if (gpError) {
          console.error('Error loading practice info:', error, gpError);
          return;
        }
        setPracticeInfo({ id: practiceId, name: gpPractice.name });
        setIsNonPracticeOrg(nonPracticeOrgTypes.includes(gpPractice.organisation_type || ''));
      } else {
        setPracticeInfo({ id: practiceId, name: practice.practice_name });
        setIsNonPracticeOrg(false);
      }
    } catch (error) {
      console.error('Error loading practice info:', error);
    }
  };

  const loadPracticeUsers = async () => {
    if (!practiceInfo?.id) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .rpc('get_practice_users', { p_practice_id: practiceInfo.id });

      if (error) throw error;
      
      // Fetch NRES access for all users
      const userIds = data?.map((u: any) => u.user_id) || [];
      const { data: nresActivations } = await supabase
        .from('user_service_activations')
        .select('user_id')
        .eq('service', 'nres')
        .in('user_id', userIds);
      
      const nresUserIds = new Set(nresActivations?.map(a => a.user_id) || []);
      
      setUsers(data?.map((user: any) => ({
        ...user,
        fridge_monitoring_access: user.fridge_monitoring_access ?? false,
        nres_access: nresUserIds.has(user.user_id)
      })) || []);
    } catch (error) {
      console.error('Error loading practice users:', error);
      toast.error("Failed to load practice users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (practiceInfo?.id) {
      loadPracticeUsers();
    }
  }, [practiceInfo]);

  const handleCreateUser = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('create-user-practice-manager', {
        body: {
          ...userFormData,
          send_welcome_email: sendWelcomeEmail,
          practice_name: practiceInfo?.name || 'Your Practice'
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        
        // Send welcome email if enabled and we have a password reset link
        if (sendWelcomeEmail && data.password_reset_link) {
          setSendingEmail(true);
          try {
            const { error: emailError } = await supabase.functions.invoke('send-user-welcome-email', {
              body: {
                user_email: userFormData.email,
                user_name: userFormData.full_name,
                password_reset_link: data.password_reset_link,
                user_role: userFormData.role,
                practice_name: practiceInfo?.name || 'Your Practice',
                module_access: {
                  ...userFormData.module_access,
                  translation_service_access: false,
                  cso_governance_access: false,
                  lg_capture_access: false,
                  bp_service_access: false
                }
              }
            });
            
            if (emailError) {
              console.error('Failed to send welcome email:', emailError);
              toast.error('User created but welcome email failed to send');
            } else {
              toast.success('Welcome email with password setup link sent to user');
            }
          } catch (emailErr) {
            console.error('Error sending welcome email:', emailErr);
            toast.error('User created but welcome email failed to send');
          } finally {
            setSendingEmail(false);
          }
        } else if (sendWelcomeEmail && !data.password_reset_link) {
          toast.info('User created but password reset link could not be generated. User can use "Forgot Password" to set their password.');
        }
        
        loadPracticeUsers();
        setShowUserModal(false);
        resetForm();
      } else {
        throw new Error(data.error || 'Failed to create user');
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    
    try {
      setLoading(true);
      
      // Only send role if it's actually being changed
      const roleChanged = userFormData.role !== editingUser.role;
      
      const { data, error } = await supabase.functions.invoke('update-user-practice-manager', {
        body: {
          user_id: editingUser.user_id,
          full_name: userFormData.full_name,
          ...(roleChanged && { role: userFormData.role }),
          practice_role: userFormData.practice_role,
          module_access: userFormData.module_access
        }
      });

      if (error) {
        // Try to extract the actual error message from the response
        const errorMsg = error.message || 'Failed to update user';
        throw new Error(errorMsg);
      }

      if (data?.success) {
        toast.success(data.message);
        loadPracticeUsers();
        setShowUserModal(false);
        resetForm();
        setEditingUser(null);
      } else {
        throw new Error(data?.error || 'Failed to update user');
      }
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(error.message || "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteUser = (user: PracticeUser) => {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  const handleRemoveUser = async () => {
    if (!userToDelete) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('remove-user-practice-manager', {
        body: { user_id: userToDelete.user_id }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        loadPracticeUsers();
      } else {
        throw new Error(data.error || 'Failed to remove user');
      }
    } catch (error: any) {
      console.error('Error removing user:', error);
      toast.error(error.message || "Failed to remove user");
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    }
  };

  const openEditModal = (user: PracticeUser) => {
    setEditingUser(user);
    setEditingUserNRESAccess(user.nres_access || false);
    setUserFormData({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      practice_role: user.practice_role || '',
      module_access: {
        meeting_notes_access: user.meeting_notes_access,
        gp_scribe_access: user.gp_scribe_access,
        complaints_manager_access: user.complaints_manager_access,
        ai4gp_access: user.ai4gp_access,
        enhanced_access: user.enhanced_access,
        cqc_compliance_access: user.cqc_compliance_access,
        shared_drive_access: false,
        mic_test_service_access: user.mic_test_service_access,
        api_testing_service_access: user.api_testing_service_access,
        fridge_monitoring_access: user.fridge_monitoring_access
      }
    });
    setShowUserModal(true);
  };

  const handleNRESAccessChange = async (checked: boolean) => {
    if (!editingUser) return;
    
    try {
      if (checked) {
        // Grant NRES access
        const { error } = await supabase
          .from('user_service_activations')
          .insert({
            user_id: editingUser.user_id,
            service: 'nres',
            activated_by: user?.id,
            activated_at: new Date().toISOString(),
          });

        if (error) {
          const msg = (error as any)?.message as string | undefined;
          const code = (error as any)?.code as string | undefined;
          const isDuplicate =
            code === '23505' || msg?.includes('user_service_activations_user_id_service_key');
          if (!isDuplicate) throw error;
        }
      } else {
        // Revoke NRES access
        const { error } = await supabase
          .from('user_service_activations')
          .delete()
          .eq('user_id', editingUser.user_id)
          .eq('service', 'nres');

        if (error) throw error;
      }
      
      setEditingUserNRESAccess(checked);
      toast.success(checked ? 'NRES access granted' : 'NRES access revoked');
    } catch (error) {
      console.error('Error updating NRES access:', error);
      toast.error('Failed to update NRES access');
    }
  };

  const resetForm = () => {
    setUserFormData({
      email: '',
      full_name: '',
      role: 'practice_user',
      practice_role: '',
      module_access: {
        meeting_notes_access: true,
        gp_scribe_access: false,
        complaints_manager_access: false,
        ai4gp_access: false,
        enhanced_access: false,
        cqc_compliance_access: false,
        shared_drive_access: false,
        mic_test_service_access: false,
        api_testing_service_access: false,
        fridge_monitoring_access: false
      }
    });
    setSendWelcomeEmail(true);
    setEditingUserNRESAccess(false);
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Practice User Management</h1>
            {practiceInfo && (
              <p className="text-muted-foreground mt-2">
                Managing users for: <span className="font-semibold">{practiceInfo.name}</span>
              </p>
            )}
          </div>
          <Button
            onClick={() => {
              resetForm();
              setEditingUser(null);
              setShowUserModal(true);
            }}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Practice Users ({filteredUsers.length})
                </CardTitle>
                <CardDescription>
                  Manage users assigned to your practice
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    {!isNonPracticeOrg && <TableHead>Practice Role</TableHead>}
                    <TableHead>Module Access</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={isNonPracticeOrg ? 6 : 7} className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isNonPracticeOrg ? 6 : 7} className="text-center py-8 text-muted-foreground">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.user_id}>
                        <TableCell className="font-medium">{user.full_name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'practice_user' ? 'secondary' : 'default'}>
                            {isNonPracticeOrg && user.role === 'practice_manager' 
                              ? 'Organisation Admin' 
                              : user.role === 'practice_user' ? 'Practice User' : user.role}
                          </Badge>
                        </TableCell>
                        {!isNonPracticeOrg && (
                          <TableCell>
                            {user.practice_role ? (
                              <Badge variant="outline">
                                {practiceRoles.find(r => r.value === user.practice_role)?.label || user.practice_role}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">Not set</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.meeting_notes_access && <Badge variant="outline" className="text-xs">Notes</Badge>}
                            {user.gp_scribe_access && <Badge variant="outline" className="text-xs">GP Scribe</Badge>}
                            {user.complaints_manager_access && <Badge variant="outline" className="text-xs">Complaints</Badge>}
                            {user.ai4gp_access && <Badge variant="outline" className="text-xs">AI4GP</Badge>}
                            {user.enhanced_access && <Badge variant="outline" className="text-xs">Enhanced</Badge>}
                            {user.cqc_compliance_access && <Badge variant="outline" className="text-xs">CQC</Badge>}
                            {user.shared_drive_access && <Badge variant="outline" className="text-xs">Drive</Badge>}
                            {user.fridge_monitoring_access && <Badge variant="outline" className="text-xs">Fridge Monitor</Badge>}
                            {user.nres_access && <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">NRES</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => confirmDeleteUser(user)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Modal */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Edit User' : 'Add New User'}
            </DialogTitle>
            <DialogDescription>
              {editingUser 
                ? 'Update user details and module access'
                : 'Create a new user and assign them to your practice'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, email: e.target.value }))}
                  disabled={!!editingUser}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={userFormData.full_name}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>
            </div>

            {/* Last logged in display for editing */}
            {editingUser && (
              <div className="p-3 bg-muted/50 rounded-md">
                <Label className="text-sm text-muted-foreground">Last Logged In</Label>
                <p className="text-sm font-medium mt-1">
                  {editingUser.last_login 
                    ? new Date(editingUser.last_login).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Never logged in'}
                </p>
              </div>
            )}

            {/* Role selection for non-practice organisations */}
            {isNonPracticeOrg && (
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={userFormData.role}
                  onValueChange={(value) => setUserFormData(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {organisationRoles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Practice role selection for GP practices only */}
            {!isNonPracticeOrg && (
              <div className="space-y-2">
                <Label htmlFor="practice_role">Practice Role</Label>
                <Select
                  value={userFormData.practice_role || undefined}
                  onValueChange={(value) => setUserFormData(prev => ({ ...prev, practice_role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={editingUser && !userFormData.practice_role ? "Select a practice role" : "Select a practice role"} />
                  </SelectTrigger>
                  <SelectContent>
                    {practiceRoles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}


            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Module Access</Label>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-6 h-3 rounded-full bg-muted border"></div>
                    <span>Off</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-6 h-3 rounded-full bg-primary"></div>
                    <span>On</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="meeting_notes_access"
                    checked={userFormData.module_access.meeting_notes_access}
                    onCheckedChange={(checked) => 
                      setUserFormData(prev => ({
                        ...prev,
                        module_access: { ...prev.module_access, meeting_notes_access: checked }
                      }))
                    }
                  />
                  <Label htmlFor="meeting_notes_access" className="text-sm">
                    Meeting Notes
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="complaints_manager_access"
                    checked={userFormData.module_access.complaints_manager_access}
                    onCheckedChange={(checked) => 
                      setUserFormData(prev => ({
                        ...prev,
                        module_access: { ...prev.module_access, complaints_manager_access: checked }
                      }))
                    }
                  />
                  <Label htmlFor="complaints_manager_access" className="text-sm">
                    Complaints Manager
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="ai4gp_access"
                    checked={userFormData.module_access.ai4gp_access}
                    onCheckedChange={(checked) => 
                      setUserFormData(prev => ({
                        ...prev,
                        module_access: { ...prev.module_access, ai4gp_access: checked }
                      }))
                    }
                  />
                  <Label htmlFor="ai4gp_access" className="text-sm">
                    AI4GP
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="fridge_monitoring_access"
                    checked={userFormData.module_access.fridge_monitoring_access}
                    onCheckedChange={(checked) => 
                      setUserFormData(prev => ({
                        ...prev,
                        module_access: { ...prev.module_access, fridge_monitoring_access: checked }
                      }))
                    }
                  />
                  <Label htmlFor="fridge_monitoring_access" className="text-sm">
                    Fridge Monitoring
                  </Label>
                </div>
              </div>
              
              {/* NRES Access - Only visible if current user has NRES access and editing */}
              {currentUserHasNRES && editingUser && (
                <div className="pt-3 mt-3 border-t border-border">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="nres_access"
                      checked={editingUserNRESAccess}
                      onCheckedChange={handleNRESAccessChange}
                    />
                    <Label htmlFor="nres_access" className="text-sm font-medium">
                      NRES Dashboard
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-10">
                    Grants access to the NRES New Models Pilot Dashboard
                  </p>
                </div>
              )}
            </div>

            {/* Send Welcome Email - Only for new users */}
            {!editingUser && (
              <div className="p-4 border border-border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="send_welcome_email" className="text-sm font-medium">
                      Send welcome email to user
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Email will include login URL, credentials and enabled modules
                    </p>
                  </div>
                  <Switch
                    id="send_welcome_email"
                    checked={sendWelcomeEmail}
                    onCheckedChange={setSendWelcomeEmail}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowUserModal(false);
                resetForm();
                setEditingUser(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingUser ? handleUpdateUser : handleCreateUser}
              disabled={loading || sendingEmail || !userFormData.email || !userFormData.full_name}
            >
              {loading ? 'Processing...' : sendingEmail ? 'Sending email...' : (editingUser ? 'Update User' : 'Create User')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <span className="font-semibold">{userToDelete?.full_name}</span> ({userToDelete?.email}) from your practice. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? 'Deleting...' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};