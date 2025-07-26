import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Users, 
  Plus, 
  Trash2, 
  UserPlus, 
  Building,
  Shield,
  Calendar,
  Mail,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";

interface User {
  user_id: string;
  email: string;
  full_name: string;
  last_login: string | null;
  practice_assignments: any[]; // Using any[] to handle JSON from database
}

interface Practice {
  id: string;
  practice_name?: string;
  name?: string; // For gp_practices
}

type AppRole = 'system_admin' | 'practice_manager' | 'gp' | 'administrator' | 'nurse' | 'receptionist' | 'user' | 'complaints_manager' | 'pcn_manager';

const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedPracticeId, setSelectedPracticeId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  if (!user) {
    return <LoginForm />;
  }

  useEffect(() => {
    fetchUsers();
    fetchPractices();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_users_with_practices');

      if (error) throw error;
      setUsers((data || []) as User[]);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const fetchPractices = async () => {
    try {
      // Fetch both practice_details and gp_practices
      const [practiceDetailsResponse, gpPracticesResponse] = await Promise.all([
        supabase.from('practice_details').select('id, practice_name'),
        supabase.from('gp_practices').select('id, name')
      ]);

      const allPractices = [
        ...(practiceDetailsResponse.data || []).map(p => ({ id: p.id, practice_name: p.practice_name })),
        ...(gpPracticesResponse.data || []).map(p => ({ id: p.id, practice_name: p.name }))
      ];

      setPractices(allPractices);
    } catch (error) {
      console.error('Error fetching practices:', error);
    }
  };

  const assignUserToPractice = async () => {
    if (!selectedUserId || !selectedPracticeId || !selectedRole) {
      toast.error("Please select user, practice, and role");
      return;
    }

    try {
      const { error } = await supabase.rpc('assign_user_to_practice', {
        p_user_id: selectedUserId,
        p_practice_id: selectedPracticeId,
        p_role: selectedRole as AppRole
      });

      if (error) throw error;

      toast.success("User assigned to practice successfully");
      setAssignDialogOpen(false);
      setSelectedUserId("");
      setSelectedPracticeId("");
      setSelectedRole("");
      fetchUsers();
    } catch (error) {
      console.error('Error assigning user to practice:', error);
      toast.error("Failed to assign user to practice");
    }
  };

  const removeUserFromPractice = async (userId: string, practiceId: string, role: string) => {
    try {
      const { error } = await supabase.rpc('remove_user_from_practice', {
        p_user_id: userId,
        p_practice_id: practiceId,
        p_role: role as AppRole
      });

      if (error) throw error;

      toast.success("User removed from practice successfully");
      fetchUsers();
    } catch (error) {
      console.error('Error removing user from practice:', error);
      toast.error("Failed to remove user from practice");
    }
  };

  const toggleUserExpansion = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'system_admin':
        return 'destructive';
      case 'practice_manager':
        return 'default';
      case 'complaints_manager':
        return 'secondary';
      case 'pcn_manager':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    const roleLabels: { [key: string]: string } = {
      system_admin: 'System Admin',
      practice_manager: 'Practice Manager',
      complaints_manager: 'Complaints Manager',
      pcn_manager: 'PCN Manager'
    };
    return roleLabels[role] || role;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header onNewMeeting={() => {}} />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading users...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onNewMeeting={() => {}} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">User Management</h1>
              <p className="text-muted-foreground">Manage user roles and practice assignments</p>
            </div>
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign User to Practice
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign User to Practice</DialogTitle>
                  <DialogDescription>
                    Assign a user to a practice with a specific role
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="user">Select User</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.user_id} value={user.user_id}>
                            {user.full_name} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="practice">Select Practice</Label>
                    <Select value={selectedPracticeId} onValueChange={setSelectedPracticeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a practice" />
                      </SelectTrigger>
                      <SelectContent>
                        {practices.map((practice) => (
                          <SelectItem key={practice.id} value={practice.id}>
                            {practice.practice_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="role">Select Role</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="practice_manager">Practice Manager</SelectItem>
                        <SelectItem value="complaints_manager">Complaints Manager</SelectItem>
                        <SelectItem value="pcn_manager">PCN Manager</SelectItem>
                        <SelectItem value="system_admin">System Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={assignUserToPractice} className="w-full">
                    Assign User
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                System Users
              </CardTitle>
              <CardDescription>
                Manage user access and practice assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Practice Assignments</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((userData) => (
                    <TableRow key={userData.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleUserExpansion(userData.user_id)}
                            className="p-0 h-auto"
                          >
                            {expandedUsers.has(userData.user_id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                          <div>
                            <div className="font-medium">{userData.full_name}</div>
                            {expandedUsers.has(userData.user_id) && (
                              <div className="mt-2 space-y-2">
                                {userData.practice_assignments.map((assignment, index) => (
                                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                    <div className="flex items-center gap-2">
                                      <Building className="h-4 w-4 text-muted-foreground" />
                                      <div>
                                        <div className="text-sm font-medium">{assignment.practice_name}</div>
                                        <div className="flex items-center gap-2">
                                          <Badge variant={getRoleColor(assignment.role)}>
                                            {getRoleLabel(assignment.role)}
                                          </Badge>
                                          <span className="text-xs text-muted-foreground">
                                            Assigned {format(new Date(assignment.assigned_at), 'dd/MM/yyyy')}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeUserFromPractice(
                                        userData.user_id,
                                        assignment.practice_id,
                                        assignment.role
                                      )}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {userData.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        {userData.last_login ? (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(userData.last_login), 'dd/MM/yyyy HH:mm')}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {userData.practice_assignments.slice(0, 2).map((assignment, index) => (
                            <Badge key={index} variant={getRoleColor(assignment.role)}>
                              {assignment.practice_name} ({getRoleLabel(assignment.role)})
                            </Badge>
                          ))}
                          {userData.practice_assignments.length > 2 && (
                            <Badge variant="outline">
                              +{userData.practice_assignments.length - 2} more
                            </Badge>
                          )}
                          {userData.practice_assignments.length === 0 && (
                            <span className="text-muted-foreground text-sm">No assignments</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUserId(userData.user_id);
                            setAssignDialogOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Assign
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;