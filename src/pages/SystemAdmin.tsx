import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Search, Edit, Trash2, Users, Calendar, Building, Network } from 'lucide-react';

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
      const { data, error } = await supabase
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

      if (error) throw error;
      setPractices(data || []);
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
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">System Administration</h1>
        <p className="text-muted-foreground">Manage users, practices, PCNs, and neighbourhoods</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="practices">Practices</TabsTrigger>
          <TabsTrigger value="pcns">PCNs</TabsTrigger>
          <TabsTrigger value="neighbourhoods">Neighbourhoods</TabsTrigger>
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
                  <TableHead>PCN Code</TableHead>
                  <TableHead>Neighbourhood</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {practices
                  .filter(practice => 
                    practice.name.toLowerCase().includes(practiceSearchQuery.toLowerCase()) ||
                    practice.practice_code?.toLowerCase().includes(practiceSearchQuery.toLowerCase())
                  )
                  .map((practice) => (
                    <TableRow key={practice.id}>
                      <TableCell>{practice.name}</TableCell>
                      <TableCell>{practice.practice_code}</TableCell>
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
    </div>
  );
};

export default SystemAdmin;