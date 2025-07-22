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
import { Checkbox } from "@/components/ui/checkbox";
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
  BarChart3,
  Eye,
  Send
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Header } from "@/components/Header";
import emailjs from '@emailjs/browser';

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

interface RecentMeeting {
  id: string;
  title: string;
  start_time: string;
  duration_minutes: number;
  user_id: string;
  user_name: string;
  user_email: string;
  practice_name: string | null;
  created_at: string;
}

export default function SystemAdmin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [pcns, setPcns] = useState<PCN[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPracticeManager, setIsPracticeManager] = useState(false);
  const [userPracticeId, setUserPracticeId] = useState<string | null>(null);
  const [recentMeetings, setRecentMeetings] = useState<RecentMeeting[]>([]);
  
  // Add User Dialog State
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("");
  const [newUserPractice, setNewUserPractice] = useState("");
  const [newUserPCN, setNewUserPCN] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  
  // Module Access State for New User
  const [newUserMeetingNotesAccess, setNewUserMeetingNotesAccess] = useState(true);
  const [newUserGpScribeAccess, setNewUserGpScribeAccess] = useState(false);
  const [newUserComplaintsManagerAccess, setNewUserComplaintsManagerAccess] = useState(false);
  const [newUserComplaintsAdminAccess, setNewUserComplaintsAdminAccess] = useState(false);
  const [newUserReplyWellAccess, setNewUserReplyWellAccess] = useState(false);
  
  // Email Preview Dialog State
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [emailPreviewContent, setEmailPreviewContent] = useState("");
  
  // Edit User Dialog State
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserRole, setEditUserRole] = useState("");
  const [editUserPractice, setEditUserPractice] = useState("");
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  
  // Module Access State for Edit User
  const [editUserMeetingNotesAccess, setEditUserMeetingNotesAccess] = useState(true);
  const [editUserGpScribeAccess, setEditUserGpScribeAccess] = useState(false);
  const [editUserComplaintsManagerAccess, setEditUserComplaintsManagerAccess] = useState(false);
  const [editUserComplaintsAdminAccess, setEditUserComplaintsAdminAccess] = useState(false);
  const [editUserReplyWellAccess, setEditUserReplyWellAccess] = useState(false);

  // Dashboard Stats
  const [dashboardStats, setDashboardStats] = useState({
    totalUsers: 0,
    totalMeetings: 0,
    totalMeetingHours: 0,
    activeUsers: 0
  });

  useEffect(() => {
    checkAccessPermissions();
  }, [user]);

  useEffect(() => {
    if (isAdmin || isPracticeManager) {
      fetchUsers();
      fetchPractices();
      fetchPCNs();
      fetchDashboardStats();
      fetchRecentMeetings();
    }
  }, [isAdmin, isPracticeManager]);

  const checkAccessPermissions = async () => {
    if (!user) return;
    
    try {
      // Check if user is system admin
      const { data: adminData, error: adminError } = await supabase
        .rpc('is_system_admin', { _user_id: user.id });
      
      if (adminError) throw adminError;
      setIsAdmin(adminData);
      
      if (adminData) {
        // User is system admin, no need to check practice manager
        return;
      }
      
      // Check if user is practice manager
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role, practice_id')
        .eq('user_id', user.id)
        .eq('role', 'practice_manager')
        .maybeSingle();
      
      if (roleError) throw roleError;
      
      if (roleData) {
        setIsPracticeManager(true);
        setUserPracticeId(roleData.practice_id);
      } else {
        // User has no access
        toast.error("Access denied. System admin or practice manager privileges required.");
      }
    } catch (error) {
      console.error('Error checking access permissions:', error);
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
          gp_practices(practice_name:name)
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
            practice_name: role.gp_practices?.practice_name || null,
            practice_id: role.practice_id
          })),
          meeting_stats: {
            total_meetings: userMeetings.length,
            total_duration_minutes: totalDuration,
            meetings_last_30_days: meetingsLast30Days
          }
        };
      }) || [];

      // Filter users based on role
      let filteredUsers = usersWithData;
      if (isPracticeManager && userPracticeId) {
        // Practice managers can only see users in their practice
        filteredUsers = usersWithData.filter(user => 
          user.roles.some(role => role.practice_id === userPracticeId)
        );
      }

      setUsers(filteredUsers);
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

  const fetchRecentMeetings = async () => {
    try {
      // First fetch meetings
      const { data: meetingsData, error: meetingsError } = await supabase
        .from('meetings')
        .select(`
          id,
          title,
          start_time,
          duration_minutes,
          created_at,
          user_id
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (meetingsError) throw meetingsError;

      if (!meetingsData || meetingsData.length === 0) {
        setRecentMeetings([]);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(meetingsData.map(m => m.user_id))];

      // Fetch user profiles with practice information
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          full_name,
          email
        `)
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Fetch user roles with practice information
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          practice_id,
          gp_practices(name)
        `)
        .in('user_id', userIds);

      if (rolesError) throw rolesError;

      // Create lookup maps
      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
      const practicesMap = new Map();
      
      rolesData?.forEach(role => {
        if (!practicesMap.has(role.user_id)) {
          practicesMap.set(role.user_id, role.gp_practices?.name || null);
        }
      });

      const formattedMeetings: RecentMeeting[] = meetingsData.map(meeting => {
        const profile = profilesMap.get(meeting.user_id);
        const practiceName = practicesMap.get(meeting.user_id);
        
        return {
          id: meeting.id,
          title: meeting.title,
          start_time: meeting.start_time,
          duration_minutes: meeting.duration_minutes || 0,
          user_id: meeting.user_id,
          user_name: profile?.full_name || 'Unknown User',
          user_email: profile?.email || '',
          practice_name: practiceName || null,
          created_at: meeting.created_at
        };
      });

      setRecentMeetings(formattedMeetings);
    } catch (error) {
      console.error('Error fetching recent meetings:', error);
      toast.error('Failed to fetch recent meetings');
    }
  };

  const getDefaultPassword = () => {
    return "letmein1st";
  };

  const generateEmailPreview = () => {
    const tempPassword = getDefaultPassword();
    const practiceId = newUserPractice === "none" ? null : newUserPractice;
    const practiceName = practices.find(p => p.id === practiceId)?.practice_name || "No practice assigned";
    
    return `Dear ${newUserName},

Welcome to Notewell AI Meeting Notes Service!

Your account has been successfully created with the following details:

• Email: ${newUserEmail}
• Role: ${newUserRole.replace('_', ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())}
• Practice: ${practiceName}
• Temporary Password: ${tempPassword}

ABOUT NOTEWELL AI MEETING NOTES SERVICE:

Notewell AI is a revolutionary healthcare meeting documentation service designed specifically for NHS practices and healthcare organisations. Our platform transforms how you capture, organise, and share meeting insights.

KEY FEATURES:
✓ Real-time AI transcription during meetings
✓ Automatic generation of meeting summaries and action items
✓ NHS-compliant data security and privacy protection
✓ Integration with healthcare workflows
✓ Searchable meeting archives
✓ Customisable templates for different meeting types
✓ Automated distribution of meeting notes to attendees

GETTING STARTED:
1. Visit: https://notewell.dialai.co.uk/
2. Sign in using your email address: ${newUserEmail}
3. Use your temporary password: ${tempPassword}
4. You'll be prompted to change your password on first login

SECURITY NOTE:
Please change your temporary password immediately after logging in for security purposes.

If you have any questions or need assistance, please don't hesitate to contact our support team.

Best regards,
The Notewell AI Team

---
This is an automated message. Please do not reply to this email.`;
  };

  const handlePreviewEmail = () => {
    if (!newUserEmail || !newUserName || !newUserRole) {
      toast.error("Please fill in all required fields first");
      return;
    }
    
    const preview = generateEmailPreview();
    setEmailPreviewContent(preview);
    setEmailPreviewOpen(true);
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserName || !newUserRole) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsCreatingUser(true);
    
    try {
      // Use default password "letmein1st"
      const tempPassword = getDefaultPassword();
      // For practice managers, always use their practice ID
      const practiceId = isPracticeManager ? userPracticeId : (newUserPractice === "none" ? null : newUserPractice);
      
      // Create user via edge function with admin privileges
      const { data: createUserData, error: createUserError } = await supabase.functions.invoke('create-user-admin', {
        body: {
          email: newUserEmail,
          name: newUserName,
          password: tempPassword,
          role: newUserRole,
          practice_id: practiceId,
          assigned_by: user?.id,
          module_access: {
            meeting_notes_access: newUserMeetingNotesAccess,
            gp_scribe_access: newUserGpScribeAccess,
            complaints_manager_access: newUserComplaintsManagerAccess,
            complaints_admin_access: newUserComplaintsAdminAccess,
            replywell_access: newUserReplyWellAccess
          }
        }
      });

      if (createUserError) {
        console.error("Error creating user:", createUserError);
        throw createUserError;
      }

      if (!createUserData?.success) {
        throw new Error(createUserData?.error || "Failed to create user");
      }

      console.log("User created successfully:", createUserData);

      // Send welcome email using EmailJS
      try {
        const welcomeEmailContent = `
<p>Dear ${newUserName},</p>

<p>Welcome to Notewell AI Meeting Notes Service!</p>

<p>Your account has been successfully created with the following details:</p>

<ul>
<li>Email: ${newUserEmail}</li>
<li>Role: ${newUserRole.replace('_', ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())}</li>
<li>Practice: ${practices.find(p => p.id === practiceId)?.practice_name || "No practice assigned"}</li>
<li>Temporary Password: ${tempPassword}</li>
</ul>

<h3>ABOUT NOTEWELL AI MEETING NOTES SERVICE:</h3>

<p>Notewell AI is a revolutionary healthcare meeting documentation service designed specifically for NHS practices and healthcare organisations. Our platform transforms how you capture, organise, and share meeting insights.</p>

<h3>KEY FEATURES:</h3>
<ul>
<li>✓ Real-time AI transcription during meetings</li>
<li>✓ Automatic generation of meeting summaries and action items</li>
<li>✓ NHS-compliant data security and privacy protection</li>
<li>✓ Integration with healthcare workflows</li>
<li>✓ Searchable meeting archives</li>
<li>✓ Customisable templates for different meeting types</li>
<li>✓ Automated distribution of meeting notes to attendees</li>
</ul>

<h3>GETTING STARTED:</h3>
<ol>
<li>Visit: <a href="https://notewell.dialai.co.uk/" target="_blank">https://notewell.dialai.co.uk/</a></li>
<li>Sign in using your email address: ${newUserEmail}</li>
<li>Use your temporary password: ${tempPassword}</li>
<li>You'll be prompted to change your password on first login</li>
</ol>

<h3>SECURITY NOTE:</h3>
<p>Please change your temporary password immediately after logging in for security purposes.</p>

<p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>

<p>Best regards,<br>
The Notewell AI Team</p>

<hr>
<p><em>This is an automated message. Please do not reply to this email.</em></p>
        `;

        await emailjs.send(
          'notewell', // Your correct EmailJS service ID
          'template_n236grs', // Your correct EmailJS template ID
          {
            to_email: newUserEmail,
            subject: "Welcome to Notewell AI Meeting Notes Service",
            message: welcomeEmailContent,
            to_name: newUserName
          },
          'OknbPskm8GVoUZFiD' // Your actual EmailJS public key
        );

        toast.success("User created successfully and welcome email sent");
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
        toast.error("User created successfully, but welcome email failed to send");
      }
      
      await fetchUsers();
      setNewUserEmail("");
      setNewUserName("");
      setNewUserRole("");
      setNewUserPractice("");
      setNewUserPCN("");
      setNewUserMeetingNotesAccess(true);
      setNewUserGpScribeAccess(false);
      setNewUserComplaintsManagerAccess(false);
      setNewUserComplaintsAdminAccess(false);
      setNewUserReplyWellAccess(false);
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

  const handleEditUser = async (userData: User) => {
    setEditingUser(userData);
    // Set current role and practice if user has any
    if (userData.roles.length > 0) {
      setEditUserRole(userData.roles[0].role);
      setEditUserPractice(userData.roles[0].practice_id || "none");
    } else {
      setEditUserRole("");
      setEditUserPractice("none");
    }
    
    // Fetch current module access settings from user_roles table
    try {
      const { data: roleData, error } = await supabase
        .from('user_roles')
        .select('meeting_notes_access, gp_scribe_access, complaints_manager_access, complaints_admin_access, replywell_access')
        .eq('user_id', userData.id)
        .single();
      
      if (error) {
        console.error('Error fetching user module access:', error);
        // Set defaults if no data found
        setEditUserMeetingNotesAccess(true);
        setEditUserGpScribeAccess(false);
        setEditUserComplaintsManagerAccess(false);
        setEditUserComplaintsAdminAccess(false);
        setEditUserReplyWellAccess(false);
      } else {
        setEditUserMeetingNotesAccess(roleData?.meeting_notes_access ?? true);
        setEditUserGpScribeAccess(roleData?.gp_scribe_access ?? false);
        setEditUserComplaintsManagerAccess(roleData?.complaints_manager_access ?? false);
        setEditUserComplaintsAdminAccess(roleData?.complaints_admin_access ?? false);
        setEditUserReplyWellAccess(roleData?.replywell_access ?? false);
      }
    } catch (error) {
      console.error('Error loading module access:', error);
      // Set defaults on error
      setEditUserMeetingNotesAccess(true);
      setEditUserGpScribeAccess(false);
      setEditUserComplaintsManagerAccess(false);
      setEditUserComplaintsAdminAccess(false);
      setEditUserReplyWellAccess(false);
    }
    
    setEditUserOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser || !editUserRole) {
      toast.error("Please select a role");
      return;
    }

    setIsUpdatingUser(true);
    
    try {
      // Remove existing roles for this user
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', editingUser.id);

      // Add new role with module access settings
      // For practice managers, always use their practice ID
      const practiceId = isPracticeManager ? userPracticeId : (editUserPractice === "none" ? null : editUserPractice);
      
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: editingUser.id,
          role: editUserRole as any,
          practice_id: practiceId,
          assigned_by: user?.id,
          meeting_notes_access: editUserMeetingNotesAccess,
          gp_scribe_access: editUserGpScribeAccess,
          complaints_manager_access: editUserComplaintsManagerAccess,
          complaints_admin_access: editUserComplaintsAdminAccess,
          replywell_access: editUserReplyWellAccess
        });

      if (error) throw error;
      
      toast.success("User updated successfully");
      setEditUserOpen(false);
      setEditingUser(null);
      await fetchUsers();
      
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error("Failed to update user");
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleDeleteUser = async (userData: User) => {
    if (!confirm(`Are you sure you want to delete user ${userData.full_name}? This action cannot be undone.`)) {
      return;
    }

    try {
      // First remove all roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userData.id);

      // Then delete the profile
      await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userData.id);

      // Finally delete from auth (this requires admin privileges)
      const { error: authError } = await supabase.functions.invoke('delete-user-admin', {
        body: { user_id: userData.id }
      });

      if (authError) {
        console.error('Error deleting user from auth:', authError);
        toast.error("User profile deleted but auth account may still exist");
      } else {
        toast.success("User deleted successfully");
      }
      
      await fetchUsers();
      
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error("Failed to delete user");
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

  if (!isAdmin && !isPracticeManager) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You need system administrator or practice manager privileges to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Header onNewMeeting={() => {}} />
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {isPracticeManager ? "Practice Management" : "System Administration"}
              </h1>
              <p className="text-muted-foreground">
                {isPracticeManager ? "Manage users and settings for your practice" : "Manage users, roles, and system analytics"}
              </p>
            </div>
          </div>

          {/* Main Content with Tabs */}
          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-6 bg-muted p-1 rounded-md h-12">
              <TabsTrigger value="dashboard" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
                <BarChart3 className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
                <Users className="h-4 w-4" />
                User Management
              </TabsTrigger>
              <TabsTrigger value="practices" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
                <Building2 className="h-4 w-4" />
                Practices
              </TabsTrigger>
              <TabsTrigger value="meetings" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
                <Calendar className="h-4 w-4" />
                Meetings
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
                <Shield className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
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
            
            {/* Recent Meetings Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Meetings
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentMeetings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent meetings found
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Meeting Title</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Practice</TableHead>
                          <TableHead>Start Date & Time</TableHead>
                          <TableHead>Duration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentMeetings.map((meeting) => (
                          <TableRow key={meeting.id}>
                            <TableCell className="font-medium">
                              {meeting.title || 'Untitled Meeting'}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{meeting.user_name}</div>
                                <div className="text-sm text-muted-foreground">{meeting.user_email}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {meeting.practice_name ? (
                                <Badge variant="outline" className="text-xs">
                                  {meeting.practice_name}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">No Practice</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {format(new Date(meeting.start_time), 'MMM dd, yyyy')}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {format(new Date(meeting.start_time), 'HH:mm')}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">
                                  {meeting.duration_minutes > 0 
                                    ? `${Math.floor(meeting.duration_minutes / 60)}h ${meeting.duration_minutes % 60}m`
                                    : '0m'
                                  }
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">User Management</h2>
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
                          {isAdmin && <SelectItem value="practice_manager">Practice Manager</SelectItem>}
                          {isAdmin && <SelectItem value="system_admin">System Admin</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="practice">Practice {isPracticeManager ? "(Assigned Practice)" : "(Optional)"}</Label>
                      <Select 
                        value={isPracticeManager ? userPracticeId || "none" : newUserPractice} 
                        onValueChange={isPracticeManager ? () => {} : setNewUserPractice}
                        disabled={isPracticeManager}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a practice" />
                        </SelectTrigger>
                        <SelectContent>
                          {!isPracticeManager && <SelectItem value="none">No Practice</SelectItem>}
                          {isPracticeManager ? (
                            practices.filter(p => p.id === userPracticeId).map(practice => (
                              <SelectItem key={practice.id} value={practice.id}>
                                {practice.practice_name}
                              </SelectItem>
                            ))
                          ) : (
                            practices.map(practice => (
                              <SelectItem key={practice.id} value={practice.id}>
                                {practice.practice_name}
                              </SelectItem>
                            ))
                          )}
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
                    
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Module Access</Label>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="meeting-notes-access"
                            checked={newUserMeetingNotesAccess}
                            onCheckedChange={(checked) => setNewUserMeetingNotesAccess(checked === true)}
                          />
                          <Label htmlFor="meeting-notes-access" className="text-sm font-normal">
                            Meeting Notes
                          </Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="gp-scribe-access"
                            checked={newUserGpScribeAccess}
                            onCheckedChange={(checked) => setNewUserGpScribeAccess(checked === true)}
                          />
                          <Label htmlFor="gp-scribe-access" className="text-sm font-normal">
                            GP Scribe
                          </Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="complaints-manager-access"
                            checked={newUserComplaintsManagerAccess}
                            onCheckedChange={(checked) => setNewUserComplaintsManagerAccess(checked === true)}
                          />
                          <Label htmlFor="complaints-manager-access" className="text-sm font-normal">
                            Complaints Manager
                          </Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="complaints-admin-access"
                            checked={newUserComplaintsAdminAccess}
                            onCheckedChange={(checked) => setNewUserComplaintsAdminAccess(checked === true)}
                          />
                          <Label htmlFor="complaints-admin-access" className="text-sm font-normal">
                            Complaints Manager Admin
                          </Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="replywell-access"
                            checked={newUserReplyWellAccess}
                            onCheckedChange={(checked) => setNewUserReplyWellAccess(checked === true)}
                          />
                          <Label htmlFor="replywell-access" className="text-sm font-normal">
                            ReplyWell
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddUserOpen(false)}>
                      Cancel
                    </Button>
                    <Button variant="outline" onClick={handlePreviewEmail}>
                      <Eye className="h-4 w-4 mr-2" />
                      Preview Email
                    </Button>
                    <Button onClick={handleCreateUser} disabled={isCreatingUser}>
                      <Send className="h-4 w-4 mr-2" />
                      {isCreatingUser ? "Creating..." : "Create & Send"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Users</CardTitle>
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
                        <TableHead>Practice/PCN</TableHead>
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
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {user.roles.length > 0 ? (
                                user.roles.map((role, index) => (
                                  <div key={index} className="mb-1">
                                    {role.practice_name || (
                                      <span className="text-muted-foreground">No practice assigned</span>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <span className="text-muted-foreground">No practice assigned</span>
                              )}
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
                               <Button 
                                 variant="outline" 
                                 size="sm"
                                 onClick={() => handleEditUser(user)}
                               >
                                 <Edit className="h-3 w-3" />
                               </Button>
                               <Button 
                                 variant="outline" 
                                 size="sm" 
                                 className="text-destructive"
                                 onClick={() => handleDeleteUser(user)}
                               >
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
          </TabsContent>

          {/* Practices Tab */}
          <TabsContent value="practices" className="space-y-6">
            <h2 className="text-2xl font-bold">Practice Management</h2>
            <p className="text-muted-foreground">Manage GP practices and Primary Care Networks</p>
            {/* Add practice management content here */}
          </TabsContent>

          {/* Meetings Tab */}
          <TabsContent value="meetings" className="space-y-6">
            <h2 className="text-2xl font-bold">Meeting Analytics</h2>
            <p className="text-muted-foreground">View meeting statistics and analytics</p>
            {/* Add meeting analytics content here */}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <h2 className="text-2xl font-bold">System Settings</h2>
            <p className="text-muted-foreground">Configure system-wide settings and preferences</p>
            {/* Add system settings content here */}
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Email Preview Dialog */}
      <Dialog open={emailPreviewOpen} onOpenChange={setEmailPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Preview of the welcome email that will be sent to the new user.
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="whitespace-pre-wrap text-sm font-mono">
              {emailPreviewContent}
            </pre>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailPreviewOpen(false)}>
              Close Preview
            </Button>
            <Button onClick={() => {
              setEmailPreviewOpen(false);
              handleCreateUser();
            }} disabled={isCreatingUser}>
              <Send className="h-4 w-4 mr-2" />
              {isCreatingUser ? "Creating..." : "Create User & Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit User Dialog */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update the user's role and practice assignment.
            </DialogDescription>
          </DialogHeader>
          
          {editingUser && (
            <div className="space-y-4">
              <div>
                <Label>User</Label>
                <div className="p-2 bg-muted rounded">
                  <div className="font-medium">{editingUser.full_name}</div>
                  <div className="text-sm text-muted-foreground">{editingUser.email}</div>
                </div>
              </div>
              
              <div>
                <Label htmlFor="edit-role">Role</Label>
                <Select value={editUserRole} onValueChange={setEditUserRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="receptionist">Receptionist</SelectItem>
                    <SelectItem value="nurse">Nurse</SelectItem>
                    <SelectItem value="administrator">Administrator</SelectItem>
                    <SelectItem value="gp">GP</SelectItem>
                    {isAdmin && <SelectItem value="practice_manager">Practice Manager</SelectItem>}
                    {isAdmin && <SelectItem value="system_admin">System Admin</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="edit-practice">Practice {isPracticeManager ? "(Assigned Practice)" : ""}</Label>
                <Select 
                  value={isPracticeManager ? userPracticeId || "none" : editUserPractice} 
                  onValueChange={isPracticeManager ? () => {} : setEditUserPractice}
                  disabled={isPracticeManager}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a practice" />
                  </SelectTrigger>
                  <SelectContent>
                    {!isPracticeManager && <SelectItem value="none">No Practice</SelectItem>}
                    {isPracticeManager ? (
                      practices.filter(p => p.id === userPracticeId).map(practice => (
                        <SelectItem key={practice.id} value={practice.id}>
                          {practice.practice_name}
                        </SelectItem>
                      ))
                    ) : (
                      practices.map(practice => (
                        <SelectItem key={practice.id} value={practice.id}>
                          {practice.practice_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-3">
                <Label className="text-base font-medium">Module Access</Label>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-meeting-notes-access"
                      checked={editUserMeetingNotesAccess}
                      onCheckedChange={(checked) => setEditUserMeetingNotesAccess(checked === true)}
                    />
                    <Label htmlFor="edit-meeting-notes-access" className="text-sm font-normal">
                      Meeting Notes
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-gp-scribe-access"
                      checked={editUserGpScribeAccess}
                      onCheckedChange={(checked) => setEditUserGpScribeAccess(checked === true)}
                    />
                    <Label htmlFor="edit-gp-scribe-access" className="text-sm font-normal">
                      GP Scribe
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-complaints-manager-access"
                      checked={editUserComplaintsManagerAccess}
                      onCheckedChange={(checked) => setEditUserComplaintsManagerAccess(checked === true)}
                    />
                    <Label htmlFor="edit-complaints-manager-access" className="text-sm font-normal">
                      Complaints Manager
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-complaints-admin-access"
                      checked={editUserComplaintsAdminAccess}
                      onCheckedChange={(checked) => setEditUserComplaintsAdminAccess(checked === true)}
                    />
                    <Label htmlFor="edit-complaints-admin-access" className="text-sm font-normal">
                      Complaints Manager Admin
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-replywell-access"
                      checked={editUserReplyWellAccess}
                      onCheckedChange={(checked) => setEditUserReplyWellAccess(checked === true)}
                    />
                    <Label htmlFor="edit-replywell-access" className="text-sm font-normal">
                      ReplyWell
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={isUpdatingUser}>
              {isUpdatingUser ? "Updating..." : "Update User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}