import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Users, 
  UserPlus, 
  Shield, 
  Activity, 
  Clock, 
  FileText, 
  TrendingUp,
  Edit,
  Trash2,
  Building2,
  Calendar,
  BarChart3
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface User {
  id: string;
  email: string;
  full_name: string;
  last_login: string | null;
  created_at: string;
  roles: { role: string; practice_name: string | null; practice_id: string | null }[];
  meeting_stats: {
    total_meetings: number;
    total_duration_minutes: number;
    meetings_last_30_days: number;
  };
}

interface Practice {
  id: string;
  practice_name: string;
  practice_code?: string;
  pcn_code?: string;
}

interface PCN {
  id: string;
  pcn_name: string;
  pcn_code: string;
}

export default function SystemAdmin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [pcns, setPcns] = useState<PCN[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Add User Dialog State
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("");
  const [newUserPractice, setNewUserPractice] = useState("");
  const [newUserPCN, setNewUserPCN] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Dashboard Stats
  const [dashboardStats, setDashboardStats] = useState({
    totalUsers: 0,
    totalMeetings: 0,
    totalMeetingHours: 0,
    activeUsers: 0
  });

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchPractices();
      fetchPCNs();
      fetchDashboardStats();
    }
  }, [isAdmin]);

  const checkAdminAccess = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .rpc('is_system_admin', { _user_id: user.id });
      
      if (error) throw error;
      setIsAdmin(data);
      
      if (!data) {
        toast.error("Access denied. System admin privileges required.");
      }
    } catch (error) {
      console.error('Error checking admin access:', error);
      toast.error("Error checking permissions");
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch users with their profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          role,
          practice_id,
          practice_details(practice_name)
        `);

      if (rolesError) throw rolesError;

      // Fetch meeting stats for each user
      const { data: meetingStats, error: meetingError } = await supabase
        .from('meetings')
        .select('user_id, duration_minutes, created_at');

      if (meetingError) throw meetingError;

      // Process the data
      const usersWithData = profilesData?.map(profile => {
        const userRoles = rolesData?.filter(role => role.user_id === profile.user_id) || [];
        const userMeetings = meetingStats?.filter(meeting => meeting.user_id === profile.user_id) || [];
        
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const meetingsLast30Days = userMeetings.filter(
          meeting => new Date(meeting.created_at) >= thirtyDaysAgo
        ).length;

        const totalDuration = userMeetings.reduce(
          (sum, meeting) => sum + (meeting.duration_minutes || 0), 0
        );

        return {
          id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          last_login: profile.last_login,
          created_at: profile.created_at,
          roles: userRoles.map(role => ({
            role: role.role,
            practice_name: role.practice_details?.practice_name || null,
            practice_id: role.practice_id
          })),
          meeting_stats: {
            total_meetings: userMeetings.length,
            total_duration_minutes: totalDuration,
            meetings_last_30_days: meetingsLast30Days
          }
        };
      }) || [];

      setUsers(usersWithData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const fetchPractices = async () => {
    try {
      // Get all practices from gp_practices table instead of just practice_details
      const { data, error } = await supabase
        .from('gp_practices')
        .select('id, name, practice_code, pcn_code')
        .order('name');

      if (error) throw error;
      
      // Map the data to match our interface
      const practicesData = data?.map(practice => ({
        id: practice.id,
        practice_name: practice.name,
        practice_code: practice.practice_code,
        pcn_code: practice.pcn_code
      })) || [];
      
      setPractices(practicesData);
    } catch (error) {
      console.error('Error fetching practices:', error);
    }
  };

  const fetchPCNs = async () => {
    try {
      const { data, error } = await supabase
        .from('primary_care_networks')
        .select('id, pcn_name, pcn_code')
        .order('pcn_name');

      if (error) throw error;
      setPcns(data || []);
    } catch (error) {
      console.error('Error fetching PCNs:', error);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const { data: usersData } = await supabase
        .from('profiles')
        .select('last_login');

      const { data: meetingsData } = await supabase
        .from('meetings')
        .select('duration_minutes');

      const activeUsers = usersData?.filter(user => {
        if (!user.last_login) return false;
        const lastLogin = new Date(user.last_login);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        return lastLogin >= thirtyDaysAgo;
      }).length || 0;

      const totalHours = meetingsData?.reduce(
        (sum, meeting) => sum + (meeting.duration_minutes || 0), 0
      ) / 60 || 0;

      setDashboardStats({
        totalUsers: usersData?.length || 0,
        totalMeetings: meetingsData?.length || 0,
        totalMeetingHours: Math.round(totalHours * 10) / 10,
        activeUsers
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const generateRandomPassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserName || !newUserRole) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsCreatingUser(true);
    
    try {
      // Generate a random temporary password
      const tempPassword = generateRandomPassword();
      
      // Create the user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newUserEmail,
        password: tempPassword,
        email_confirm: true
      });

      if (authError) throw authError;

      // Create user role
      if (authData.user) {
        const practiceId = newUserPractice === "none" ? null : newUserPractice;
        
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: authData.user.id,
            role: newUserRole as any,
            practice_id: practiceId,
            assigned_by: user?.id
          });

        if (roleError) throw roleError;

        // Send welcome email
        try {
          const { error: emailError } = await supabase.functions.invoke('send-welcome-email', {
            body: {
              to_email: newUserEmail,
              user_name: newUserName,
              user_email: newUserEmail,
              temporary_password: tempPassword,
              user_role: newUserRole,
              practice_name: practices.find(p => p.id === practiceId)?.practice_name || "No practice assigned"
            }
          });

          if (emailError) {
            console.error('Error sending welcome email:', emailError);
            toast.error("User created successfully, but welcome email failed to send");
          } else {
            toast.success("User created successfully and welcome email sent");
          }
        } catch (emailError) {
          console.error('Error sending welcome email:', emailError);
          toast.error("User created successfully, but welcome email failed to send");
        }
      }
      
      await fetchUsers();
      setNewUserEmail("");
      setNewUserName("");
      setNewUserRole("");
      setNewUserPractice("");
      setNewUserPCN("");
      setAddUserOpen(false);
      
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || "Failed to create user");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const assignRole = async (userId: string, role: string, practiceId?: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: role as any, // Cast to any to handle the enum type
          practice_id: practiceId || null,
          assigned_by: user?.id
        });

      if (error) throw error;
      
      toast.success("Role assigned successfully");
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error assigning role:', error);
      toast.error("Failed to assign role");
    }
  };

  const removeRole = async (userId: string, role: string, practiceId?: string) => {
    try {
      let query = supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role as any); // Cast to any to handle the enum type

      if (practiceId) {
        query = query.eq('practice_id', practiceId);
      } else {
        query = query.is('practice_id', null);
      }

      const { error } = await query;

      if (error) throw error;
      
      toast.success("Role removed successfully");
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error removing role:', error);
      toast.error("Failed to remove role");
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors = {
      'system_admin': 'bg-red-100 text-red-800',
      'practice_manager': 'bg-blue-100 text-blue-800',
      'gp': 'bg-green-100 text-green-800',
      'administrator': 'bg-purple-100 text-purple-800',
      'nurse': 'bg-pink-100 text-pink-800',
      'receptionist': 'bg-yellow-100 text-yellow-800',
      'user': 'bg-gray-100 text-gray-800'
    };
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatRole = (role: string) => {
    return role.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You need system administrator privileges to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">System Administration</h1>
            <p className="text-muted-foreground">Manage users, roles, and system analytics</p>
          </div>
          
          <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Create a new user account and assign initial roles.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>
                
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                
                <div>
                  <Label htmlFor="role">Initial Role</Label>
                  <Select value={newUserRole} onValueChange={setNewUserRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="receptionist">Receptionist</SelectItem>
                      <SelectItem value="nurse">Nurse</SelectItem>
                      <SelectItem value="administrator">Administrator</SelectItem>
                      <SelectItem value="gp">GP</SelectItem>
                      <SelectItem value="practice_manager">Practice Manager</SelectItem>
                      <SelectItem value="system_admin">System Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="practice">Practice (Optional)</Label>
                  <Select value={newUserPractice} onValueChange={setNewUserPractice}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a practice" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Practice</SelectItem>
                      {practices.map(practice => (
                        <SelectItem key={practice.id} value={practice.id}>
                          {practice.practice_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="pcn">Primary Care Network (Optional)</Label>
                  <Select value={newUserPCN} onValueChange={setNewUserPCN}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a PCN" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No PCN</SelectItem>
                      {pcns.map(pcn => (
                        <SelectItem key={pcn.id} value={pcn.id}>
                          {pcn.pcn_name} ({pcn.pcn_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddUserOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateUser} disabled={isCreatingUser}>
                  {isCreatingUser ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats.totalUsers}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users (30d)</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats.activeUsers}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats.totalMeetings}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Meeting Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats.totalMeetingHours}h</div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading users...</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Meetings (30d)</TableHead>
                    <TableHead>Total Meetings</TableHead>
                    <TableHead>Meeting Hours</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(user => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.full_name}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {user.roles.map((role, index) => (
                            <Badge 
                              key={index} 
                              variant="secondary" 
                              className={getRoleBadgeColor(role.role)}
                            >
                              {formatRole(role.role)}
                              {role.practice_name && ` @ ${role.practice_name}`}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.last_login ? 
                          format(new Date(user.last_login), 'MMM d, yyyy') : 
                          'Never'
                        }
                      </TableCell>
                      <TableCell>{user.meeting_stats.meetings_last_30_days}</TableCell>
                      <TableCell>{user.meeting_stats.total_meetings}</TableCell>
                      <TableCell>{Math.round(user.meeting_stats.total_duration_minutes / 60 * 10) / 10}h</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm" className="text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}