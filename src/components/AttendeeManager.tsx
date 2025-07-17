import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Edit, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Attendee {
  id: string;
  name: string;
  email: string;
  title: string;
  organization: string;
  role: string;
  is_default: boolean;
}

interface AttendeeManagerProps {
  onAttendeesChange?: (attendees: Attendee[]) => void;
}

export const AttendeeManager = ({ onAttendeesChange }: AttendeeManagerProps) => {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    title: "Dr",
    organization: "",
    role: "",
    is_default: false
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchAttendees();
  }, []);

  const fetchAttendees = async () => {
    try {
      const { data, error } = await supabase
        .from('attendees')
        .select('*')
        .order('name');

      if (error) throw error;
      setAttendees(data || []);
      if (onAttendeesChange) {
        onAttendeesChange(data || []);
      }
    } catch (error) {
      console.error('Error fetching attendees:', error);
      toast({
        title: "Error",
        description: "Failed to fetch attendees",
        variant: "destructive",
      });
    }
  };

  const saveAttendee = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (isEditing) {
        const { error } = await supabase
          .from('attendees')
          .update({
            name: formData.name,
            email: formData.email,
            title: formData.title,
            organization: formData.organization,
            role: formData.role,
            is_default: formData.is_default
          })
          .eq('id', isEditing);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('attendees')
          .insert({
            user_id: user.id,
            name: formData.name,
            email: formData.email,
            title: formData.title,
            organization: formData.organization,
            role: formData.role,
            is_default: formData.is_default
          });

        if (error) throw error;
      }

      fetchAttendees();
      resetForm();
      toast({
        title: "Success",
        description: `Attendee ${isEditing ? 'updated' : 'added'} successfully`,
      });
    } catch (error) {
      console.error('Error saving attendee:', error);
      toast({
        title: "Error",
        description: "Failed to save attendee",
        variant: "destructive",
      });
    }
  };

  const deleteAttendee = async (id: string) => {
    try {
      const { error } = await supabase
        .from('attendees')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchAttendees();
      toast({
        title: "Success",
        description: "Attendee deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting attendee:', error);
      toast({
        title: "Error",
        description: "Failed to delete attendee",
        variant: "destructive",
      });
    }
  };

  const editAttendee = (attendee: Attendee) => {
    setFormData({
      name: attendee.name,
      email: attendee.email,
      title: attendee.title,
      organization: attendee.organization,
      role: attendee.role,
      is_default: attendee.is_default
    });
    setIsEditing(attendee.id);
    setIsAdding(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      title: "Dr",
      organization: "",
      role: "",
      is_default: false
    });
    setIsEditing(null);
    setIsAdding(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Attendee Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add/Edit Form */}
        {isAdding && (
          <div className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">
                {isEditing ? 'Edit Attendee' : 'Add New Attendee'}
              </h4>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Select value={formData.title} onValueChange={(value) => setFormData({...formData, title: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dr">Dr</SelectItem>
                    <SelectItem value="Mr">Mr</SelectItem>
                    <SelectItem value="Mrs">Mrs</SelectItem>
                    <SelectItem value="Ms">Ms</SelectItem>
                    <SelectItem value="Prof">Prof</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Full name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="email@example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="organization">Organization</Label>
                <Input
                  id="organization"
                  value={formData.organization}
                  onChange={(e) => setFormData({...formData, organization: e.target.value})}
                  placeholder="NHS Trust, GP Practice, etc."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  placeholder="Consultant, GP, Manager, etc."
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({...formData, is_default: e.target.checked})}
                  className="rounded"
                />
                <Label htmlFor="is_default">Make default attendee</Label>
              </div>
              
              <div className="space-x-2">
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
                <Button onClick={saveAttendee}>
                  <Check className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Add Button */}
        {!isAdding && (
          <Button variant="outline" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Attendee
          </Button>
        )}

        {/* Attendees List */}
        <div className="space-y-2">
          {attendees.map((attendee) => (
            <div key={attendee.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {attendee.title} {attendee.name}
                  {attendee.is_default && (
                    <Badge variant="secondary" className="text-xs">Default</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {attendee.email} • {attendee.role} • {attendee.organization}
                </div>
              </div>
              <div className="space-x-2">
                <Button variant="ghost" size="sm" onClick={() => editAttendee(attendee)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteAttendee(attendee.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          
          {attendees.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No attendees added yet. Click "Add Attendee" to get started.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};