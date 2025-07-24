import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Users, 
  Calendar, 
  Building, 
  Network,
  BarChart3,
  Shield,
  Settings,
  Database,
  FileText,
  Clock
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name: string;
  last_login: string | null;
  created_at: string;
  roles: { role: string; practice_name: string | null; practice_id: string | null }[];
}

interface Practice {
  id: string;
  name: string;
  practice_code?: string;
  pcn_code?: string;
  pcn_name?: string;
  neighbourhood_id?: string;
  ics_code: string;
  ics_name: string;
  organisation_type: string;
}

interface PCN {
  id: string;
  pcn_name: string;
  pcn_code: string;
}

interface Neighbourhood {
  id: string;
  name: string;
  description?: string;
}

const SystemAdmin = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // User creation state
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    email: '',
    name: '',
    password: '',
    role: 'gp',
    practice_id: 'none',
    module_access: {
      meeting_notes_access: true,
      gp_scribe_access: false,
      complaints_manager_access: false,
      complaints_admin_access: false,
      replywell_access: false,
      ai_4_pm_access: false
    }
  });
  
  // PCN Manager practice assignments state
  const [pcnManagerPractices, setPcnManagerPractices] = useState<string[]>([]);
  const [showPcnPracticeSelector, setShowPcnPracticeSelector] = useState(false);
  
  // Dashboard state
  const [dashboardStats, setDashboardStats] = useState({
    totalUsers: 0,
    totalMeetings: 0,
    totalPractices: 0,
    totalPCNs: 0
  });
  
  // User management state
  const [users, setUsers] = useState<User[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  // Practice management state
  const [practices, setPractices] = useState<Practice[]>([]);
  const [practiceSearchQuery, setPracticeSearchQuery] = useState('');
  const [isPracticeDialogOpen, setIsPracticeDialogOpen] = useState(false);
  const [practiceDialogMode, setPracticeDialogMode] = useState<'add' | 'edit'>('add');
  const [selectedPractice, setSelectedPractice] = useState<Practice | null>(null);
  const [practiceForm, setPracticeForm] = useState({
    name: '',
    practice_code: '',
    ics_code: '',
    ics_name: '',
    organisation_type: '',
    pcn_code: '',
    neighbourhood_id: ''
  });
  
  // PCN management state
  const [pcns, setPcns] = useState<PCN[]>([]);
  const [pcnSearchQuery, setPcnSearchQuery] = useState('');
  const [isPCNDialogOpen, setIsPCNDialogOpen] = useState(false);
  const [pcnDialogMode, setPCNDialogMode] = useState<'add' | 'edit'>('add');
  const [selectedPCN, setSelectedPCN] = useState<PCN | null>(null);
  const [pcnForm, setPCNForm] = useState({
    pcn_code: '',
    pcn_name: ''
  });
  
  // Neighbourhood management state
  const [neighbourhoods, setNeighbourhoods] = useState<Neighbourhood[]>([]);
  const [neighbourhoodSearchQuery, setNeighbourhoodSearchQuery] = useState('');
  const [isNeighbourhoodDialogOpen, setIsNeighbourhoodDialogOpen] = useState(false);
  const [neighbourhoodDialogMode, setNeighbourhoodDialogMode] = useState<'add' | 'edit'>('add');
  const [selectedNeighbourhood, setSelectedNeighbourhood] = useState<Neighbourhood | null>(null);
  const [neighbourhoodForm, setNeighbourhoodForm] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    checkAccessPermissions();
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchPractices();
      fetchPCNs();
      fetchNeighbourhoods();
      fetchDashboardStats();
    }
  }, [isAdmin]);

  const checkAccessPermissions = async () => {
    if (!user) return;
    
    try {
      const { data: adminData, error } = await supabase
        .rpc('is_system_admin', { _user_id: user.id });
      
      if (error) throw error;
      setIsAdmin(adminData);
      
      if (!adminData) {
        toast.error("Access denied. System admin privileges required.");
      }
    } catch (error) {
      console.error('Error checking access permissions:', error);
      toast.error("Error checking permissions");
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: profilesData, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const usersWithData = profilesData?.map(profile => ({
        id: profile.user_id,
        email: profile.email,
        full_name: profile.full_name,
        last_login: profile.last_login,
        created_at: profile.created_at,
        roles: []
      })) || [];

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
      // Fetch practices data
      const { data: practicesData, error: practicesError } = await supabase
        .from('gp_practices')
        .select(`
          id, 
          name, 
          practice_code, 
          pcn_code,
          ics_code,
          ics_name,
          organisation_type,
          neighbourhood_id,
          neighbourhoods(name)
        `)
        .order('name');

      if (practicesError) throw practicesError;

      // Fetch PCN data to match with practices
      const { data: pcnData, error: pcnError } = await supabase
        .from('primary_care_networks')
        .select('pcn_code, pcn_name');

      if (pcnError) throw pcnError;

      // Create a map of PCN codes to names
      const pcnMap = new Map();
      pcnData?.forEach(pcn => {
        pcnMap.set(pcn.pcn_code, pcn.pcn_name);
      });

      // Map the practices data to include PCN names
      const practicesWithPCNNames = practicesData?.map(practice => ({
        ...practice,
        pcn_name: practice.pcn_code ? pcnMap.get(practice.pcn_code) : null
      })) || [];
      
      setPractices(practicesWithPCNNames);
    } catch (error) {
      console.error('Error fetching practices:', error);
      toast.error("Failed to fetch practices");
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
      toast.error("Failed to fetch PCNs");
    }
  };

  const fetchNeighbourhoods = async () => {
    try {
      const { data, error } = await supabase
        .from('neighbourhoods')
        .select('id, name, description')
        .order('name');

      if (error) throw error;
      setNeighbourhoods(data || []);
    } catch (error) {
      console.error('Error fetching neighbourhoods:', error);
      toast.error("Failed to fetch neighbourhoods");
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id');

      const { data: meetingsData } = await supabase
        .from('meetings')
        .select('id');

      const { data: practicesData } = await supabase
        .from('gp_practices')
        .select('id');

      const { data: pcnsData } = await supabase
        .from('primary_care_networks')
        .select('id');

      setDashboardStats({
        totalUsers: usersData?.length || 0,
        totalMeetings: meetingsData?.length || 0,
        totalPractices: practicesData?.length || 0,
        totalPCNs: pcnsData?.length || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const handleAddPractice = async () => {
    try {
      const { error } = await supabase
        .from('gp_practices')
        .insert({
          name: practiceForm.name,
          practice_code: practiceForm.practice_code,
          ics_code: practiceForm.ics_code,
          ics_name: practiceForm.ics_name,
          organisation_type: practiceForm.organisation_type,
          pcn_code: practiceForm.pcn_code || null,
          neighbourhood_id: practiceForm.neighbourhood_id || null
        });

      if (error) throw error;
      
      toast.success("Practice added successfully");
      setIsPracticeDialogOpen(false);
      setPracticeForm({
        name: '',
        practice_code: '',
        ics_code: '',
        ics_name: '',
        organisation_type: '',
        pcn_code: '',
        neighbourhood_id: ''
      });
      fetchPractices();
    } catch (error) {
      console.error('Error adding practice:', error);
      toast.error("Failed to add practice");
    }
  };

  const handleAddPCN = async () => {
    try {
      const { error } = await supabase
        .from('primary_care_networks')
        .insert({
          pcn_code: pcnForm.pcn_code,
          pcn_name: pcnForm.pcn_name
        });

      if (error) throw error;
      
      toast.success("PCN added successfully");
      setIsPCNDialogOpen(false);
      setPCNForm({ pcn_code: '', pcn_name: '' });
      fetchPCNs();
    } catch (error) {
      console.error('Error adding PCN:', error);
      toast.error("Failed to add PCN");
    }
  };

  const handleAddNeighbourhood = async () => {
    try {
      const { error } = await supabase
        .from('neighbourhoods')
        .insert({
          name: neighbourhoodForm.name,
          description: neighbourhoodForm.description || null
        });

      if (error) throw error;
      
      toast.success("Neighbourhood added successfully");
      setIsNeighbourhoodDialogOpen(false);
      setNeighbourhoodForm({ name: '', description: '' });
      fetchNeighbourhoods();
    } catch (error) {
      console.error('Error adding neighbourhood:', error);
      toast.error("Failed to add neighbourhood");
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleCreateUser = async () => {
    try {
      setLoading(true);
      
      if (!userForm.email || !userForm.name || !userForm.password) {
        toast.error("Please fill in all required fields");
        return;
      }

      // Create user via edge function
      const { data, error } = await supabase.functions.invoke('create-user-admin', {
        body: {
          email: userForm.email,
          name: userForm.name,
          password: userForm.password,
          role: userForm.role,
          practice_id: userForm.practice_id === 'none' ? null : userForm.practice_id,
          assigned_by: user?.id,
          module_access: userForm.module_access
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("User created successfully!");
        
        // If PCN manager, assign practices
        if (userForm.role === 'pcn_manager' && pcnManagerPractices.length > 0) {
          try {
            for (const practiceId of pcnManagerPractices) {
              await supabase
                .from('pcn_manager_practices')
                .insert({
                  user_id: data.user.id,
                  practice_id: practiceId,
                  assigned_by: user?.id
                });
            }
            toast.success("PCN Manager practice assignments created!");
          } catch (assignmentError) {
            console.error('Practice assignment error:', assignmentError);
            toast.warning("User created but practice assignments failed");
          }
        }
        
        // Send welcome email via EmailJS edge function
        try {
          const selectedPractice = practices.find(p => p.id === userForm.practice_id && userForm.practice_id !== 'none');
          
          await supabase.functions.invoke('send-email-via-emailjs', {
            body: {
              to_email: userForm.email,
              user_name: userForm.name,
              user_email: userForm.email,
              temporary_password: userForm.password,
              user_role: userForm.role,
              practice_name: selectedPractice?.name || 'Not assigned',
              template_type: 'welcome',
              // Pass module access information
              meeting_notes_access: userForm.module_access.meeting_notes_access,
              gp_scribe_access: userForm.module_access.gp_scribe_access,
              complaints_manager_access: userForm.module_access.complaints_manager_access,
              complaints_admin_access: userForm.module_access.complaints_admin_access,
              replywell_access: userForm.module_access.replywell_access,
              ai_4_pm_access: userForm.module_access.ai_4_pm_access
            }
          });
          
          toast.success("Welcome email sent successfully!");
        } catch (emailError) {
          console.error('Email sending error:', emailError);
          toast.warning("User created but email sending failed");
        }

        // Reset form and close dialog
        setUserForm({
          email: '',
          name: '',
          password: '',
          role: 'gp',
          practice_id: 'none',
          module_access: {
            meeting_notes_access: true,
            gp_scribe_access: false,
            complaints_manager_access: false,
            complaints_admin_access: false,
            replywell_access: false,
            ai_4_pm_access: false
          }
        });
        setPcnManagerPractices([]);
        setShowPcnPracticeSelector(false);
        setIsUserDialogOpen(false);
        fetchUsers();
      } else {
        throw new Error(data.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error(`Failed to create user: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (role: string) => {
    setUserForm(prev => ({ ...prev, role }));
    setShowPcnPracticeSelector(role === 'pcn_manager');
    if (role !== 'pcn_manager') {
      setPcnManagerPractices([]);
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <h1 className="text-2xl font-bold text-center">Access Denied</h1>
            <p className="text-center mt-4">You need system administrator privileges to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Header onNewMeeting={() => {}} />
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">System Administration</h1>
          <p className="text-muted-foreground">Manage users, practices, PCNs, and neighbourhoods</p>
        </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-8 mb-6">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="practices" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Practices
          </TabsTrigger>
          <TabsTrigger value="pcns" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            PCNs
          </TabsTrigger>
          <TabsTrigger value="neighbourhoods" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Neighbourhoods
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardStats.totalMeetings}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Practices</CardTitle>
                <Building className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardStats.totalPractices}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total PCNs</CardTitle>
                <Network className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardStats.totalPCNs}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <Input
                placeholder="Search users..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
            <Button onClick={() => setIsUserDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users
                  .filter(user => 
                    user.full_name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                    user.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                  )
                  .map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                      </TableCell>
                      <TableCell>
                        {user.roles.map((role, index) => (
                          <Badge key={index} variant="secondary" className="mr-1">
                            {role.role}
                          </Badge>
                        ))}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="practices" className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <Input
                placeholder="Search practices..."
                value={practiceSearchQuery}
                onChange={(e) => setPracticeSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
            <Button onClick={() => {
              setPracticeDialogMode('add');
              setIsPracticeDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Practice
            </Button>
          </div>

          <Card>
            <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Practice Name</TableHead>
                   <TableHead>Practice Code</TableHead>
                   <TableHead>PCN Name</TableHead>
                   <TableHead>PCN Code</TableHead>
                   <TableHead>Neighbourhood</TableHead>
                   <TableHead>Actions</TableHead>
                 </TableRow>
               </TableHeader>
              <TableBody>
                 {practices
                   .filter(practice => {
                     const searchLower = practiceSearchQuery.toLowerCase();
                     const nameMatch = practice.name.toLowerCase().includes(searchLower);
                     const codeMatch = practice.practice_code && practice.practice_code.toLowerCase().includes(searchLower);
                     const pcnCodeMatch = practice.pcn_code && practice.pcn_code.toLowerCase().includes(searchLower);
                     const pcnNameMatch = practice.pcn_name && practice.pcn_name.toLowerCase().includes(searchLower);
                     return nameMatch || codeMatch || pcnCodeMatch || pcnNameMatch;
                   })
                  .map((practice) => (
                     <TableRow key={practice.id}>
                       <TableCell>{practice.name}</TableCell>
                       <TableCell>{practice.practice_code}</TableCell>
                       <TableCell>{practice.pcn_name || 'Unassigned'}</TableCell>
                       <TableCell>{practice.pcn_code}</TableCell>
                       <TableCell>{practice.neighbourhood_id}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="mr-2">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="pcns" className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <Input
                placeholder="Search PCNs..."
                value={pcnSearchQuery}
                onChange={(e) => setPcnSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
            <Button onClick={() => {
              setPCNDialogMode('add');
              setIsPCNDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add PCN
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PCN Name</TableHead>
                  <TableHead>PCN Code</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pcns
                  .filter(pcn => {
                    const searchLower = pcnSearchQuery.toLowerCase();
                    const nameMatch = pcn.pcn_name.toLowerCase().includes(searchLower);
                    const codeMatch = pcn.pcn_code && pcn.pcn_code.toLowerCase().includes(searchLower);
                    return nameMatch || codeMatch;
                  })
                  .map((pcn) => (
                    <TableRow key={pcn.id}>
                      <TableCell>{pcn.pcn_name}</TableCell>
                      <TableCell>{pcn.pcn_code}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="mr-2">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="neighbourhoods" className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <Input
                placeholder="Search neighbourhoods..."
                value={neighbourhoodSearchQuery}
                onChange={(e) => setNeighbourhoodSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
            <Button onClick={() => {
              setNeighbourhoodDialogMode('add');
              setIsNeighbourhoodDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Neighbourhood
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {neighbourhoods
                  .filter(neighbourhood => 
                    neighbourhood.name.toLowerCase().includes(neighbourhoodSearchQuery.toLowerCase()) ||
                    neighbourhood.description?.toLowerCase().includes(neighbourhoodSearchQuery.toLowerCase())
                  )
                  .map((neighbourhood) => (
                    <TableRow key={neighbourhood.id}>
                      <TableCell>{neighbourhood.name}</TableCell>
                      <TableCell>{neighbourhood.description}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="mr-2">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Settings
                </CardTitle>
                <CardDescription>
                  Configure system security parameters and policies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Session Timeout</p>
                    <p className="text-sm text-muted-foreground">Automatic logout after inactivity</p>
                  </div>
                  <Badge variant="secondary">30 minutes</Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Password Requirements</p>
                    <p className="text-sm text-muted-foreground">Minimum password strength</p>
                  </div>
                  <Badge variant="secondary">12+ characters</Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Failed Login Attempts</p>
                    <p className="text-sm text-muted-foreground">Account lockout threshold</p>
                  </div>
                  <Badge variant="secondary">5 attempts</Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Data Retention</p>
                    <p className="text-sm text-muted-foreground">NHS compliance period</p>
                  </div>
                  <Badge variant="secondary">7 years</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Active Sessions
                </CardTitle>
                <CardDescription>
                  Monitor current user sessions and activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">Your Session</p>
                      <p className="text-sm text-muted-foreground">Active since login</p>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700">Active</Badge>
                  </div>
                  <div className="text-center py-4">
                    <Button variant="outline" size="sm">
                      View All Sessions
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                System Status
              </CardTitle>
              <CardDescription>
                Overview of system security and compliance status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <p className="font-medium">Database Security</p>
                  </div>
                  <p className="text-sm text-muted-foreground">RLS enabled on all tables</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <p className="font-medium">Audit Logging</p>
                  </div>
                  <p className="text-sm text-muted-foreground">All activities tracked</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
                    <p className="font-medium">Auth Configuration</p>
                  </div>
                  <p className="text-sm text-muted-foreground">Review settings needed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold">Audit Logs</h2>
              <p className="text-muted-foreground">Track all system activities and user actions</p>
            </div>
            <div className="flex items-center gap-2">
              <Select defaultValue="all">
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activities</SelectItem>
                  <SelectItem value="login">Login Events</SelectItem>
                  <SelectItem value="data">Data Changes</SelectItem>
                  <SelectItem value="security">Security Events</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-sm">
                    {new Date().toLocaleString()}
                  </TableCell>
                  <TableCell>System Admin</TableCell>
                  <TableCell>
                    <Badge variant="outline">VIEW</Badge>
                  </TableCell>
                  <TableCell>audit_logs</TableCell>
                  <TableCell>Accessed audit log interface</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">
                    {new Date(Date.now() - 300000).toLocaleString()}
                  </TableCell>
                  <TableCell>System Admin</TableCell>
                  <TableCell>
                    <Badge variant="outline">LOGIN</Badge>
                  </TableCell>
                  <TableCell>auth_events</TableCell>
                  <TableCell>Successful authentication</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>

          <div className="flex justify-center">
            <Button variant="outline">
              Load More Entries
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Data Retention Policies
                </CardTitle>
                <CardDescription>
                  NHS compliant data retention schedules
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Meeting Records</Label>
                  <Select defaultValue="7years">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7years">7 Years (NHS Standard)</SelectItem>
                      <SelectItem value="10years">10 Years</SelectItem>
                      <SelectItem value="forever">Indefinite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Complaint Records</Label>
                  <Select defaultValue="10years">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7years">7 Years</SelectItem>
                      <SelectItem value="10years">10 Years (NHS Standard)</SelectItem>
                      <SelectItem value="forever">Indefinite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Audit Logs</Label>
                  <Select defaultValue="7years">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7years">7 Years (NHS Standard)</SelectItem>
                      <SelectItem value="10years">10 Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  System Configuration
                </CardTitle>
                <CardDescription>
                  General system settings and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">System alerts and updates</p>
                  </div>
                  <Button variant="outline" size="sm">Configure</Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Backup Schedule</p>
                    <p className="text-sm text-muted-foreground">Automated data backups</p>
                  </div>
                  <Badge variant="secondary">Daily</Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Maintenance Window</p>
                    <p className="text-sm text-muted-foreground">System maintenance schedule</p>
                  </div>
                  <Badge variant="secondary">Sundays 2-4 AM</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>NHS Compliance Status</CardTitle>
              <CardDescription>
                Current compliance with NHS IT Governance requirements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span className="font-medium">Data Protection & GDPR</span>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">Compliant</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span className="font-medium">Audit Trail Requirements</span>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">Compliant</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
                    <span className="font-medium">Authentication Security</span>
                  </div>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Review Required</Badge>
                </div>
              </div>
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Action Required:</strong> Please review and update authentication settings in Supabase Dashboard:
                  Enable leaked password protection and reduce OTP expiry to 10-15 minutes.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Practice Dialog */}
      <Dialog open={isPracticeDialogOpen} onOpenChange={setIsPracticeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {practiceDialogMode === 'add' ? 'Add Practice' : 'Edit Practice'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="practice-name">Practice Name</Label>
              <Input
                id="practice-name"
                value={practiceForm.name}
                onChange={(e) => setPracticeForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="practice-code">Practice Code</Label>
              <Input
                id="practice-code"
                value={practiceForm.practice_code}
                onChange={(e) => setPracticeForm(prev => ({ ...prev, practice_code: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="ics-code">ICS Code</Label>
              <Input
                id="ics-code"
                value={practiceForm.ics_code}
                onChange={(e) => setPracticeForm(prev => ({ ...prev, ics_code: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="ics-name">ICS Name</Label>
              <Input
                id="ics-name"
                value={practiceForm.ics_name}
                onChange={(e) => setPracticeForm(prev => ({ ...prev, ics_name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="organisation-type">Organisation Type</Label>
              <Input
                id="organisation-type"
                value={practiceForm.organisation_type}
                onChange={(e) => setPracticeForm(prev => ({ ...prev, organisation_type: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="pcn-select">PCN</Label>
              <Select value={practiceForm.pcn_code} onValueChange={(value) => setPracticeForm(prev => ({ ...prev, pcn_code: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select PCN" />
                </SelectTrigger>
                <SelectContent>
                  {pcns.map((pcn) => (
                    <SelectItem key={pcn.id} value={pcn.pcn_code}>
                      {pcn.pcn_name} ({pcn.pcn_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="neighbourhood-select">Neighbourhood</Label>
              <Select value={practiceForm.neighbourhood_id} onValueChange={(value) => setPracticeForm(prev => ({ ...prev, neighbourhood_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Neighbourhood" />
                </SelectTrigger>
                <SelectContent>
                  {neighbourhoods.map((neighbourhood) => (
                    <SelectItem key={neighbourhood.id} value={neighbourhood.id}>
                      {neighbourhood.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPracticeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPractice}>
              {practiceDialogMode === 'add' ? 'Add Practice' : 'Update Practice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PCN Dialog */}
      <Dialog open={isPCNDialogOpen} onOpenChange={setIsPCNDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pcnDialogMode === 'add' ? 'Add PCN' : 'Edit PCN'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="pcn-code">PCN Code</Label>
              <Input
                id="pcn-code"
                value={pcnForm.pcn_code}
                onChange={(e) => setPCNForm(prev => ({ ...prev, pcn_code: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="pcn-name">PCN Name</Label>
              <Input
                id="pcn-name"
                value={pcnForm.pcn_name}
                onChange={(e) => setPCNForm(prev => ({ ...prev, pcn_name: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPCNDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPCN}>
              {pcnDialogMode === 'add' ? 'Add PCN' : 'Update PCN'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Neighbourhood Dialog */}
      <Dialog open={isNeighbourhoodDialogOpen} onOpenChange={setIsNeighbourhoodDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {neighbourhoodDialogMode === 'add' ? 'Add Neighbourhood' : 'Edit Neighbourhood'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="neighbourhood-name">Name</Label>
              <Input
                id="neighbourhood-name"
                value={neighbourhoodForm.name}
                onChange={(e) => setNeighbourhoodForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="neighbourhood-description">Description</Label>
              <Input
                id="neighbourhood-description"
                value={neighbourhoodForm.description}
                onChange={(e) => setNeighbourhoodForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNeighbourhoodDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNeighbourhood}>
              {neighbourhoodDialogMode === 'add' ? 'Add Neighbourhood' : 'Update Neighbourhood'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Creation Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account and send them welcome email with login credentials
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="user-name">Full Name</Label>
                <Input
                  id="user-name"
                  value={userForm.name}
                  onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <Label htmlFor="user-email">Email Address</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                />
            </div>
            
            {/* PCN Manager Practice Assignments */}
            {showPcnPracticeSelector && (
              <div>
                <Label>PCN Manager Practice Assignments</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Select multiple practices this PCN Manager will oversee
                </p>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {practices.map((practice) => (
                    <div key={practice.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`practice-${practice.id}`}
                        checked={pcnManagerPractices.includes(practice.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPcnManagerPractices(prev => [...prev, practice.id]);
                          } else {
                            setPcnManagerPractices(prev => prev.filter(id => id !== practice.id));
                          }
                        }}
                        className="rounded"
                      />
                      <Label htmlFor={`practice-${practice.id}`} className="text-sm">
                        {practice.name} {practice.pcn_code && `(${practice.pcn_code})`}
                      </Label>
                    </div>
                  ))}
                </div>
                {pcnManagerPractices.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Selected {pcnManagerPractices.length} practice(s)
                  </p>
                )}
              </div>
            )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="user-role">Role</Label>
                <Select value={userForm.role} onValueChange={handleRoleChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gp">GP / Clinician</SelectItem>
                    <SelectItem value="practice_manager">Practice Manager</SelectItem>
                    <SelectItem value="pcn_manager">PCN Manager</SelectItem>
                    <SelectItem value="complaints_manager">Complaints Manager</SelectItem>
                    <SelectItem value="system_admin">System Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="user-practice">Practice</Label>
                <Select value={userForm.practice_id} onValueChange={(value) => setUserForm(prev => ({ ...prev, practice_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select practice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Practice Assigned</SelectItem>
                    {practices.map((practice) => (
                      <SelectItem key={practice.id} value={practice.id}>
                        {practice.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="user-password">Temporary Password</Label>
              <div className="flex gap-2">
                <Input
                  id="user-password"
                  type="text"
                  value={userForm.password}
                  onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter temporary password"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setUserForm(prev => ({ ...prev, password: generateRandomPassword() }))}
                >
                  Generate
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-base font-medium">Module Access Permissions</Label>
              <div className="space-y-3 mt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="meeting-notes">Meeting Notes & Recording</Label>
                    <p className="text-sm text-muted-foreground">Access to GP Scribe and meeting functionality</p>
                  </div>
                  <Switch
                    id="meeting-notes"
                    checked={userForm.module_access.meeting_notes_access}
                    onCheckedChange={(checked) => 
                      setUserForm(prev => ({
                        ...prev, 
                        module_access: { ...prev.module_access, meeting_notes_access: checked }
                      }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="gp-scribe">GP Scribe Advanced Features</Label>
                    <p className="text-sm text-muted-foreground">Advanced consultation note generation</p>
                  </div>
                  <Switch
                    id="gp-scribe"
                    checked={userForm.module_access.gp_scribe_access}
                    onCheckedChange={(checked) => 
                      setUserForm(prev => ({
                        ...prev, 
                        module_access: { ...prev.module_access, gp_scribe_access: checked }
                      }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="complaints-manager">Complaints Management</Label>
                    <p className="text-sm text-muted-foreground">Manage and respond to patient complaints</p>
                  </div>
                  <Switch
                    id="complaints-manager"
                    checked={userForm.module_access.complaints_manager_access}
                    onCheckedChange={(checked) => 
                      setUserForm(prev => ({
                        ...prev, 
                        module_access: { ...prev.module_access, complaints_manager_access: checked }
                      }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="complaints-admin">Complaints Administration</Label>
                    <p className="text-sm text-muted-foreground">Full complaints system administration</p>
                  </div>
                  <Switch
                    id="complaints-admin"
                    checked={userForm.module_access.complaints_admin_access}
                    onCheckedChange={(checked) => 
                      setUserForm(prev => ({
                        ...prev, 
                        module_access: { ...prev.module_access, complaints_admin_access: checked }
                      }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="replywell">ReplyWell AI</Label>
                    <p className="text-sm text-muted-foreground">AI-powered communication assistance</p>
                  </div>
                  <Switch
                    id="replywell"
                    checked={userForm.module_access.replywell_access}
                    onCheckedChange={(checked) => 
                      setUserForm(prev => ({
                        ...prev, 
                        module_access: { ...prev.module_access, replywell_access: checked }
                      }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="ai-4-pm">AI4PM Assistant</Label>
                    <p className="text-sm text-muted-foreground">AI-powered practice management assistance</p>
                  </div>
                  <Switch
                    id="ai-4-pm"
                    checked={userForm.module_access.ai_4_pm_access}
                    onCheckedChange={(checked) => 
                      setUserForm(prev => ({
                        ...prev, 
                        module_access: { ...prev.module_access, ai_4_pm_access: checked }
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={loading}>
              {loading ? 'Creating User...' : 'Create User & Send Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
};

export default SystemAdmin;