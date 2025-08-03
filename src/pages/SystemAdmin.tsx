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
import { Textarea } from '@/components/ui/textarea';
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
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Eye,
  Key,
  UserCheck,
  AlertCircle,
  TrendingUp
} from 'lucide-react';

interface User {
  user_id: string;
  email: string;
  full_name: string;
  last_login: string | null;
  practice_assignments: Array<{
    practice_id: string;
    practice_name: string;
    role: string;
    assigned_at: string;
  }>;
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
  const [activeTab, setActiveTab] = useState('overview');
  const [securityTab, setSecurityTab] = useState('monitoring');
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
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
  
  // PCN management state
  const [pcns, setPcns] = useState<PCN[]>([]);
  const [pcnSearchQuery, setPcnSearchQuery] = useState('');
  
  // Neighbourhood management state
  const [neighbourhoods, setNeighbourhoods] = useState<Neighbourhood[]>([]);
  const [neighbourhoodSearchQuery, setNeighbourhoodSearchQuery] = useState('');

  // Connection monitoring state
  const [connectionStats, setConnectionStats] = useState({
    openaiConnections: 12,
    deepgramConnections: 0,
    elevenlabsConnections: 1,
    assemblyaiConnections: 2,
    supabaseDbConnections: 45,
    supabaseStorageConnections: 8,
    edgeFunctionConnections: 15
  });

  // Security monitoring state
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [supplierIncidents, setSupplierIncidents] = useState([]);

  // Enhanced security monitoring state
  const [authenticationLogs, setAuthenticationLogs] = useState([]);
  const [patientDataAccess, setPatientDataAccess] = useState([]);
  const [vulnerabilityScans, setVulnerabilityScans] = useState([]);
  const [complianceStatus, setComplianceStatus] = useState({
    nhsDigitalCompliance: { status: 'compliant', lastCheck: '2024-01-15' },
    cyberEssentials: { status: 'pending', lastCheck: '2024-01-10' },
    dataRetention: { status: 'compliant', lastCheck: '2024-01-12' },
    accessControl: { status: 'warning', lastCheck: '2024-01-14' }
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
      fetchSupplierIncidents();
      fetchSecurityEvents();
      fetchEnhancedSecurityData();
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
      const { data, error } = await supabase.rpc('get_users_with_practices');
      if (error) throw error;
      setUsers((data || []) as User[]);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const fetchPractices = async () => {
    try {
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

      const { data: pcnData, error: pcnError } = await supabase
        .from('primary_care_networks')
        .select('pcn_code, pcn_name');

      if (pcnError) throw pcnError;

      const pcnMap = new Map();
      pcnData?.forEach(pcn => {
        pcnMap.set(pcn.pcn_code, pcn.pcn_name);
      });

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
      const [usersData, meetingsData, practicesData, pcnsData] = await Promise.all([
        supabase.from('profiles').select('id'),
        supabase.from('meetings').select('id'),
        supabase.from('gp_practices').select('id'),
        supabase.from('primary_care_networks').select('id')
      ]);

      setDashboardStats({
        totalUsers: usersData.data?.length || 0,
        totalMeetings: meetingsData.data?.length || 0,
        totalPractices: practicesData.data?.length || 0,
        totalPCNs: pcnsData.data?.length || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const fetchSupplierIncidents = async () => {
    try {
      const { data, error } = await supabase
        .from('supplier_incidents')
        .select(`
          *,
          profiles!reported_by(full_name),
          gp_practices!practice_id(name)
        `)
        .order('reported_date', { ascending: false });

      if (error) throw error;
      setSupplierIncidents(data || []);
    } catch (error) {
      console.error('Error fetching supplier incidents:', error);
      toast.error("Failed to fetch supplier incidents");
    }
  };

  const fetchSecurityEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .order('event_timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSecurityEvents(data || []);
    } catch (error) {
      console.error('Error fetching security events:', error);
      toast.error("Failed to fetch security events");
    }
  };

  const fetchEnhancedSecurityData = async () => {
    // Mock data for demonstration - in real implementation, these would be proper API calls
    setAuthenticationLogs([
      { id: 1, timestamp: '2024-01-15 14:30:00', user: 'john.doe@nhs.uk', event: 'successful_login', ip: '192.168.1.100' },
      { id: 2, timestamp: '2024-01-15 14:25:00', user: 'jane.smith@nhs.uk', event: 'failed_login', ip: '192.168.1.101' },
      { id: 3, timestamp: '2024-01-15 14:20:00', user: 'admin@nhs.uk', event: 'mfa_challenge', ip: '192.168.1.102' }
    ]);

    setPatientDataAccess([
      { id: 1, timestamp: '2024-01-15 15:00:00', user: 'dr.brown@practice.nhs.uk', action: 'view_patient_record', patient_id: 'XXXX1234', duration: '5 min' },
      { id: 2, timestamp: '2024-01-15 14:45:00', user: 'nurse.green@practice.nhs.uk', action: 'update_patient_notes', patient_id: 'XXXX5678', duration: '2 min' }
    ]);

    setVulnerabilityScans([
      { id: 1, scan_date: '2024-01-14', type: 'Network Security', status: 'completed', findings: 3, critical: 0, high: 1, medium: 2 },
      { id: 2, scan_date: '2024-01-13', type: 'Application Security', status: 'completed', findings: 5, critical: 1, high: 2, medium: 2 }
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-green-600';
      case 'warning': return 'text-orange-500';
      case 'critical': return 'text-red-600';
      case 'pending': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'compliant': return <Badge className="bg-green-100 text-green-800">Compliant</Badge>;
      case 'warning': return <Badge className="bg-orange-100 text-orange-800">Warning</Badge>;
      case 'critical': return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
      case 'pending': return <Badge className="bg-blue-100 text-blue-800">Pending</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>;
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header onNewMeeting={() => {}} />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="flex items-center justify-center p-8">
              <div className="text-center">
                <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
                <p className="text-muted-foreground">
                  You need system administrator privileges to access this page.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onNewMeeting={() => {}} />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">System Administration</h1>
            <p className="text-muted-foreground">Manage users, system configuration, security, and monitoring</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto">
            <TabsTrigger value="overview" className="flex flex-col sm:flex-row items-center gap-1 text-xs sm:text-sm p-2 sm:p-3">
              <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Overview</span>
              <span className="sm:hidden">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="user-management" className="flex flex-col sm:flex-row items-center gap-1 text-xs sm:text-sm p-2 sm:p-3">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">User Management</span>
              <span className="sm:hidden">Users</span>
            </TabsTrigger>
            <TabsTrigger value="system-config" className="flex flex-col sm:flex-row items-center gap-1 text-xs sm:text-sm p-2 sm:p-3">
              <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">System Config</span>
              <span className="sm:hidden">Config</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex flex-col sm:flex-row items-center gap-1 text-xs sm:text-sm p-2 sm:p-3">
              <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Security & Compliance</span>
              <span className="sm:hidden">Security</span>
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex flex-col sm:flex-row items-center gap-1 text-xs sm:text-sm p-2 sm:p-3">
              <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">System Monitoring</span>
              <span className="sm:hidden">Monitor</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
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

            {/* Security Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Security Events</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    {securityEvents.filter(e => e.severity === 'critical').length}
                  </div>
                  <p className="text-xs text-muted-foreground">Critical events this week</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Compliance Status</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">85%</div>
                  <p className="text-xs text-muted-foreground">Overall compliance</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
                  <Shield className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-500">23</div>
                  <p className="text-xs text-muted-foreground">Last 24 hours</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Health</CardTitle>
                  <Activity className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">98%</div>
                  <p className="text-xs text-muted-foreground">Uptime</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* User Management Tab */}
          <TabsContent value="user-management" className="space-y-6">
            <Tabs defaultValue="users" className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
                <TabsTrigger value="users" className="text-xs sm:text-sm p-2">Users</TabsTrigger>
                <TabsTrigger value="practices" className="text-xs sm:text-sm p-2">Practices</TabsTrigger>
                <TabsTrigger value="pcns" className="text-xs sm:text-sm p-2">PCNs</TabsTrigger>
                <TabsTrigger value="neighbourhoods" className="text-xs sm:text-sm p-2">Areas</TabsTrigger>
              </TabsList>
              
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
                  <Button>
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
                        <TableHead>Practice Assignments</TableHead>
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
                          <TableRow key={user.user_id}>
                            <TableCell className="font-medium">{user.full_name}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {user.practice_assignments.slice(0, 2).map((assignment, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {assignment.role} - {assignment.practice_name}
                                  </Badge>
                                ))}
                                {user.practice_assignments.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{user.practice_assignments.length - 2} more
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
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
                  <Button>
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
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {practices
                        .filter(practice => 
                          practice.name.toLowerCase().includes(practiceSearchQuery.toLowerCase())
                        )
                        .map((practice) => (
                          <TableRow key={practice.id}>
                            <TableCell>{practice.name}</TableCell>
                            <TableCell>{practice.practice_code}</TableCell>
                            <TableCell>{practice.pcn_name || 'Unassigned'}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
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
                  <Button>
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
                        .filter(pcn => 
                          pcn.pcn_name.toLowerCase().includes(pcnSearchQuery.toLowerCase())
                        )
                        .map((pcn) => (
                          <TableRow key={pcn.id}>
                            <TableCell>{pcn.pcn_name}</TableCell>
                            <TableCell>{pcn.pcn_code}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
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
                  <Button>
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
                          neighbourhood.name.toLowerCase().includes(neighbourhoodSearchQuery.toLowerCase())
                        )
                        .map((neighbourhood) => (
                          <TableRow key={neighbourhood.id}>
                            <TableCell>{neighbourhood.name}</TableCell>
                            <TableCell>{neighbourhood.description}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* System Config Tab */}
          <TabsContent value="system-config" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Settings</CardTitle>
                  <CardDescription>Configure global system settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="maintenance-mode">Maintenance Mode</Label>
                    <Switch id="maintenance-mode" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="registration-enabled">User Registration</Label>
                    <Switch id="registration-enabled" defaultChecked />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                    <Input id="session-timeout" type="number" defaultValue="30" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Data Retention</CardTitle>
                  <CardDescription>Configure data retention policies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="meeting-retention">Meeting Data (days)</Label>
                    <Input id="meeting-retention" type="number" defaultValue="365" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="audit-retention">Audit Logs (days)</Label>
                    <Input id="audit-retention" type="number" defaultValue="2555" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backup-frequency">Backup Frequency</Label>
                    <Select defaultValue="daily">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Security & Compliance Tab */}
          <TabsContent value="security" className="space-y-6">
            <Tabs value={securityTab} onValueChange={setSecurityTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
                <TabsTrigger value="monitoring" className="text-xs sm:text-sm p-2">Auth</TabsTrigger>
                <TabsTrigger value="data-access" className="text-xs sm:text-sm p-2">Data</TabsTrigger>
                <TabsTrigger value="vulnerabilities" className="text-xs sm:text-sm p-2">Vulns</TabsTrigger>
                <TabsTrigger value="compliance" className="text-xs sm:text-sm p-2">Compliance</TabsTrigger>
              </TabsList>

              <TabsContent value="monitoring" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      Authentication Monitoring
                    </CardTitle>
                    <CardDescription>Monitor login attempts and authentication events</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Event</TableHead>
                          <TableHead>IP Address</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {authenticationLogs.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell>{log.timestamp}</TableCell>
                            <TableCell>{log.user}</TableCell>
                            <TableCell>{log.event}</TableCell>
                            <TableCell>{log.ip}</TableCell>
                            <TableCell>
                              <Badge variant={log.event === 'failed_login' ? 'destructive' : 'default'}>
                                {log.event === 'failed_login' ? 'Failed' : 'Success'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="data-access" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Patient Data Access Logs
                    </CardTitle>
                    <CardDescription>Monitor access to sensitive patient data</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Patient ID</TableHead>
                          <TableHead>Duration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {patientDataAccess.map((access: any) => (
                          <TableRow key={access.id}>
                            <TableCell>{access.timestamp}</TableCell>
                            <TableCell>{access.user}</TableCell>
                            <TableCell>{access.action}</TableCell>
                            <TableCell>{access.patient_id}</TableCell>
                            <TableCell>{access.duration}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="vulnerabilities" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      Vulnerability Management
                    </CardTitle>
                    <CardDescription>Security scan results and vulnerability tracking</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Scan Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Critical</TableHead>
                          <TableHead>High</TableHead>
                          <TableHead>Medium</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vulnerabilityScans.map((scan: any) => (
                          <TableRow key={scan.id}>
                            <TableCell>{scan.scan_date}</TableCell>
                            <TableCell>{scan.type}</TableCell>
                            <TableCell>
                              <Badge variant={scan.status === 'completed' ? 'default' : 'secondary'}>
                                {scan.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-red-600 font-medium">{scan.critical}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-orange-600 font-medium">{scan.high}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-yellow-600 font-medium">{scan.medium}</span>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="compliance" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Compliance Status
                      </CardTitle>
                      <CardDescription>Current compliance with healthcare standards</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {Object.entries(complianceStatus).map(([key, status]) => (
                        <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h4 className="font-medium">
                              {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Last checked: {status.lastCheck}
                            </p>
                          </div>
                          {getStatusBadge(status.status)}
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Compliance Trends
                      </CardTitle>
                      <CardDescription>Compliance metrics over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Overall Compliance</span>
                          <span className="text-lg font-bold text-green-600">85%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Data Protection</span>
                          <span className="text-lg font-bold text-green-600">92%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Access Control</span>
                          <span className="text-lg font-bold text-orange-500">78%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Audit Compliance</span>
                          <span className="text-lg font-bold text-green-600">95%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* System Monitoring Tab */}
          <TabsContent value="monitoring" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Connection Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    API Connections
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">OpenAI</span>
                      <span className="font-medium">{connectionStats.openaiConnections}/200</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Deepgram</span>
                      <span className="font-medium">{connectionStats.deepgramConnections}/100</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">ElevenLabs</span>
                      <span className="font-medium">{connectionStats.elevenlabsConnections}/50</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Supabase DB</span>
                      <span className="font-medium">{connectionStats.supabaseDbConnections}/60</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Security Events */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Recent Security Events
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {securityEvents.slice(0, 5).map((event, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="text-sm font-medium">{event.event_type}</p>
                          <p className="text-xs text-muted-foreground">{event.user_email}</p>
                        </div>
                        <Badge variant={event.severity === 'critical' ? 'destructive' : 'secondary'}>
                          {event.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Supplier Incidents */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Supplier Incidents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {supplierIncidents.slice(0, 3).map((incident: any, index) => (
                      <div key={index} className="p-3 border rounded">
                        <p className="text-sm font-medium">{incident.supplier_name}</p>
                        <p className="text-xs text-muted-foreground">{incident.incident_type}</p>
                        <Badge variant="outline" className="mt-1">
                          {incident.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SystemAdmin;