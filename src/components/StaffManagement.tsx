import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Users, Plus, Edit, Trash2, Clock, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { getWeek } from "date-fns";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'gp' | 'phlebotomist' | 'hca' | 'nurse' | 'paramedic' | 'receptionist';
  hourly_rate?: number;
  gp_onsite_rate?: number;
  gp_remote_rate?: number;
  is_active: boolean;
  notes?: string;
}

interface HoursSummary {
  staff_member_id: string;
  total_hours: number;
  total_shifts: number;
  week_number: number;
  month: number;
  year: number;
}

export const StaffManagement = () => {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [weeklyHours, setWeeklyHours] = useState<HoursSummary[]>([]);
  const [monthlyHours, setMonthlyHours] = useState<HoursSummary[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'gp' as 'gp' | 'phlebotomist' | 'hca' | 'nurse' | 'paramedic' | 'receptionist',
    hourly_rate: '',
    gp_onsite_rate: '',
    gp_remote_rate: '',
    notes: '',
  });

  useEffect(() => {
    fetchStaffMembers();
    fetchHoursSummary();
  }, []);

  const fetchStaffMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setStaffMembers(data || []);
    } catch (error) {
      toast.error('Failed to fetch staff members');
      console.error('Error:', error);
    }
  };

  const fetchHoursSummary = async () => {
    try {
      const currentWeek = getWeek(new Date());
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Fetch weekly hours
      const { data: weeklyData, error: weeklyError } = await supabase
        .from('staff_hours_summary')
        .select('*')
        .eq('week_number', currentWeek)
        .eq('year', currentYear);

      if (weeklyError) throw weeklyError;

      // Fetch monthly hours  
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('staff_hours_summary')
        .select('*')
        .eq('month', currentMonth)
        .eq('year', currentYear);

      if (monthlyError) throw monthlyError;

      setWeeklyHours(weeklyData || []);
      setMonthlyHours(monthlyData || []);
    } catch (error) {
      toast.error('Failed to fetch hours summary');
      console.error('Error:', error);
    }
  };

  const handleSubmit = async () => {
    console.log('Submit button clicked');
    console.log('Form data:', formData);
    
    // Basic validation
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    
    if (!formData.email.trim()) {
      toast.error('Email is required');
      return;
    }
    
    try {
      const staffData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone?.trim() || null,
        role: formData.role,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        gp_onsite_rate: formData.gp_onsite_rate ? parseFloat(formData.gp_onsite_rate) : null,
        gp_remote_rate: formData.gp_remote_rate ? parseFloat(formData.gp_remote_rate) : null,
        notes: formData.notes?.trim() || null,
        is_active: true,
      };

      console.log('Staff data to submit:', staffData);

      if (editingStaff) {
        console.log('Updating existing staff member:', editingStaff.id);
        const { error } = await supabase
          .from('staff_members')
          .update(staffData)
          .eq('id', editingStaff.id);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        toast.success('Staff member updated successfully');
      } else {
        console.log('Adding new staff member');
        const { data, error } = await supabase
          .from('staff_members')
          .insert([staffData])
          .select();

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        
        console.log('Successfully added staff member:', data);
        toast.success('Staff member added successfully');
      }

      setIsAddDialogOpen(false);
      setEditingStaff(null);
      setFormData({ name: '', email: '', phone: '', role: 'gp', hourly_rate: '', gp_onsite_rate: '', gp_remote_rate: '', notes: '' });
      fetchStaffMembers();
    } catch (error) {
      console.error('Submit error details:', error);
      toast.error(`Failed to save staff member: ${error.message || 'Unknown error'}`);
    }
  };

  const handleEdit = (staff: StaffMember) => {
    setEditingStaff(staff);
    setFormData({
      name: staff.name,
      email: staff.email,
      phone: staff.phone || '',
      role: staff.role,
      hourly_rate: staff.hourly_rate?.toString() || '',
      gp_onsite_rate: staff.gp_onsite_rate?.toString() || '',
      gp_remote_rate: staff.gp_remote_rate?.toString() || '',
      notes: staff.notes || '',
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('staff_members')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      toast.success('Staff member deactivated');
      fetchStaffMembers();
    } catch (error) {
      toast.error('Failed to deactivate staff member');
      console.error('Error:', error);
    }
  };

  const getRoleDisplay = (role: string) => {
    const roleMap = {
      gp: 'GP',
      phlebotomist: 'Phlebotomist',
      hca: 'HCA',
      nurse: 'Nurse',
      paramedic: 'Paramedic',
      receptionist: 'Receptionist'
    };
    return roleMap[role as keyof typeof roleMap] || role;
  };

  const getStaffHours = (staffId: string, type: 'weekly' | 'monthly') => {
    const data = type === 'weekly' ? weeklyHours : monthlyHours;
    const summary = data.find(h => h.staff_member_id === staffId);
    return summary ? { hours: summary.total_hours, shifts: summary.total_shifts } : { hours: 0, shifts: 0 };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Staff Management
          </CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingStaff(null);
                setFormData({ name: '', email: '', phone: '', role: 'gp', hourly_rate: '', gp_onsite_rate: '', gp_remote_rate: '', notes: '' });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Staff
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone (Optional)</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={formData.role} onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gp">GP</SelectItem>
                      <SelectItem value="phlebotomist">Phlebotomist</SelectItem>
                      <SelectItem value="hca">HCA</SelectItem>
                      <SelectItem value="nurse">Nurse</SelectItem>
                      <SelectItem value="paramedic">Paramedic</SelectItem>
                      <SelectItem value="receptionist">Receptionist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="hourly_rate">Hourly Rate (Optional)</Label>
                  <Input
                    id="hourly_rate"
                    type="number"
                    step="0.01"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="gp_onsite_rate">On Site Rate for GP (Optional)</Label>
                  <Input
                    id="gp_onsite_rate"
                    type="number"
                    step="0.01"
                    value={formData.gp_onsite_rate}
                    onChange={(e) => setFormData({ ...formData, gp_onsite_rate: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="gp_remote_rate">Remote Rate for GP (Optional)</Label>
                  <Input
                    id="gp_remote_rate"
                    type="number"
                    step="0.01"
                    value={formData.gp_remote_rate}
                    onChange={(e) => setFormData({ ...formData, gp_remote_rate: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes/Details (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g., Can only work Wednesdays, preferred location, etc."
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit}>
                    {editingStaff ? 'Update' : 'Add'} Staff
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="staff" className="w-full">
          <TabsList>
            <TabsTrigger value="staff">Staff Directory</TabsTrigger>
            <TabsTrigger value="hours">Hours Tracking</TabsTrigger>
          </TabsList>
          
          <TabsContent value="staff">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>GP On-Site</TableHead>
                  <TableHead>GP Remote</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffMembers.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">{staff.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getRoleDisplay(staff.role)}</Badge>
                    </TableCell>
                    <TableCell>{staff.email}</TableCell>
                    <TableCell>{staff.phone || '-'}</TableCell>
                    <TableCell>{staff.hourly_rate ? `£${staff.hourly_rate}` : '-'}</TableCell>
                    <TableCell>{staff.gp_onsite_rate ? `£${staff.gp_onsite_rate}` : '-'}</TableCell>
                    <TableCell>{staff.gp_remote_rate ? `£${staff.gp_remote_rate}` : '-'}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="text-sm text-muted-foreground truncate" title={staff.notes || ''}>
                        {staff.notes || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(staff)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(staff.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {staffMembers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-4">
                      No staff members found. Add your first staff member to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>
          
          <TabsContent value="hours">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-4 w-4" />
                    Weekly Hours
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff Member</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Shifts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffMembers.map((staff) => {
                        const hours = getStaffHours(staff.id, 'weekly');
                        return (
                          <TableRow key={staff.id}>
                            <TableCell>{staff.name}</TableCell>
                            <TableCell>{hours.hours.toFixed(1)}h</TableCell>
                            <TableCell>{hours.shifts}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-4 w-4" />
                    Monthly Hours
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff Member</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Shifts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffMembers.map((staff) => {
                        const hours = getStaffHours(staff.id, 'monthly');
                        return (
                          <TableRow key={staff.id}>
                            <TableCell>{staff.name}</TableCell>
                            <TableCell>{hours.hours.toFixed(1)}h</TableCell>
                            <TableCell>{hours.shifts}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
