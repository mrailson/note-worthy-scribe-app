import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
}

const practiceRoles = [
  { value: 'gp_partner', label: 'GP Partner' },
  { value: 'salaried_gp', label: 'Salaried GP' },
  { value: 'reception_team', label: 'Reception Team' },
  { value: 'admin_team', label: 'Admin Team' },
  { value: 'secretaries', label: 'Secretaries' }
];

export const PracticeUserManagement = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<PracticeUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<PracticeUser | null>(null);
  const [practiceInfo, setPracticeInfo] = useState<any>(null);
  
  const [userFormData, setUserFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'user',
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
      api_testing_service_access: false
    }
  });

  useEffect(() => {
    if (user) {
      loadPracticeInfo();
      loadPracticeUsers();
    }
  }, [user]);

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
          .select('name')
          .eq('id', practiceId)
          .single();

        if (gpError) {
          console.error('Error loading practice info:', error, gpError);
          return;
        }
        setPracticeInfo({ id: practiceId, name: gpPractice.name });
      } else {
        setPracticeInfo({ id: practiceId, name: practice.practice_name });
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
      setUsers(data || []);
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
        body: userFormData
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
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
      
      const { data, error } = await supabase.functions.invoke('update-user-practice-manager', {
        body: {
          user_id: editingUser.user_id,
          full_name: userFormData.full_name,
          role: userFormData.role,
          practice_role: userFormData.practice_role,
          module_access: userFormData.module_access
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        loadPracticeUsers();
        setShowUserModal(false);
        resetForm();
        setEditingUser(null);
      } else {
        throw new Error(data.error || 'Failed to update user');
      }
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(error.message || "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user from your practice?')) {
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('remove-user-practice-manager', {
        body: { user_id: userId }
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
    }
  };

  const openEditModal = (user: PracticeUser) => {
    setEditingUser(user);
    setUserFormData({
      email: user.email,
      full_name: user.full_name,
      password: '',
      role: user.role,
      practice_role: user.practice_role || '',
      module_access: {
        meeting_notes_access: user.meeting_notes_access,
        gp_scribe_access: user.gp_scribe_access,
        complaints_manager_access: user.complaints_manager_access,
        ai4gp_access: user.ai4gp_access,
        enhanced_access: user.enhanced_access,
        cqc_compliance_access: user.cqc_compliance_access,
        shared_drive_access: user.shared_drive_access,
        mic_test_service_access: user.mic_test_service_access,
        api_testing_service_access: user.api_testing_service_access
      }
    });
    setShowUserModal(true);
  };

  const resetForm = () => {
    setUserFormData({
      email: '',
      full_name: '',
      password: '',
      role: 'user',
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
        api_testing_service_access: false
      }
    });
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
                    <TableHead>Practice Role</TableHead>
                    <TableHead>Module Access</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.user_id}>
                        <TableCell className="font-medium">{user.full_name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'user' ? 'secondary' : 'default'}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.practice_role ? (
                            <Badge variant="outline">
                              {practiceRoles.find(r => r.value === user.practice_role)?.label || user.practice_role}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.meeting_notes_access && <Badge variant="outline" className="text-xs">Notes</Badge>}
                            {user.gp_scribe_access && <Badge variant="outline" className="text-xs">GP Scribe</Badge>}
                            {user.complaints_manager_access && <Badge variant="outline" className="text-xs">Complaints</Badge>}
                            {user.ai4gp_access && <Badge variant="outline" className="text-xs">AI4GP</Badge>}
                            {user.enhanced_access && <Badge variant="outline" className="text-xs">Enhanced</Badge>}
                            {user.cqc_compliance_access && <Badge variant="outline" className="text-xs">CQC</Badge>}
                            {user.shared_drive_access && <Badge variant="outline" className="text-xs">Drive</Badge>}
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
                              onClick={() => handleRemoveUser(user.user_id)}
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

            <div className="space-y-2">
              <Label htmlFor="practice_role">Practice Role</Label>
              <Select
                value={userFormData.practice_role}
                onValueChange={(value) => setUserFormData(prev => ({ ...prev, practice_role: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a practice role" />
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

            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Minimum 8 characters"
                />
              </div>
            )}

            <div className="space-y-3">
              <Label>Module Access</Label>
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
              </div>
            </div>
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
              disabled={loading || !userFormData.email || !userFormData.full_name || (!editingUser && !userFormData.password)}
            >
              {loading ? 'Processing...' : (editingUser ? 'Update User' : 'Create User')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};