import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Plus, Edit, Trash2, Check, X, Bookmark, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Attendee {
  id: string;
  name: string;
  email?: string;
  title?: string;
  organization?: string;
  role?: string;
  is_default?: boolean;
  practice_id?: string;
}

interface AttendeeTemplate {
  id: string;
  template_name: string;
  description?: string;
  is_default: boolean;
  attendees: Attendee[];
}

interface AttendeeManagerProps {
  onAttendeesChange?: (attendees: Attendee[]) => void;
  showTemplateManagement?: boolean;
}

export const AttendeeManager: React.FC<AttendeeManagerProps> = ({ 
  onAttendeesChange, 
  showTemplateManagement = false 
}) => {
  const { user } = useAuth();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [templates, setTemplates] = useState<AttendeeTemplate[]>([]);
  const [userPracticeIds, setUserPracticeIds] = useState<string[]>([]);
  const [hasManagementAccess, setHasManagementAccess] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isManagingTemplates, setIsManagingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AttendeeTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    title: 'Dr',
    organization: '',
    role: ''
  });
  const [templateFormData, setTemplateFormData] = useState({
    name: '',
    description: '',
    selectedAttendeeIds: [] as string[]
  });

  useEffect(() => {
    checkUserAccess();
  }, []);

  useEffect(() => {
    if (userPracticeIds.length > 0) {
      fetchAttendees();
      if (showTemplateManagement) {
        fetchTemplates();
      }
    }
  }, [userPracticeIds, showTemplateManagement]);

  const checkUserAccess = async () => {
    if (!user?.id) return;

    try {
      // Get user's practice assignments and roles
      const { data: userRoles } = await supabase
        .rpc('get_user_roles', { _user_id: user.id });
      
      if (userRoles && userRoles.length > 0) {
        const practiceIds = userRoles.map(role => role.practice_id).filter(Boolean);
        setUserPracticeIds(practiceIds);
        
        // Check if user has management access (Practice Manager or GP)
        const hasAccess = userRoles.some(role => 
          role.role === 'practice_manager' || role.role === 'system_admin'
        );
        setHasManagementAccess(hasAccess);
      }
    } catch (error) {
      console.error('Error checking user access:', error);
    }
  };

  const fetchAttendees = async () => {
    if (!user?.id || userPracticeIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('attendees')
        .select('*')
        .in('practice_id', userPracticeIds)
        .order('name');

      if (error) throw error;
      if (data) {
        setAttendees(data);
        onAttendeesChange?.(data);
      }
    } catch (error) {
      console.error('Error fetching attendees:', error);
      toast({
        title: "Error",
        description: "Failed to fetch attendees",
        variant: "destructive"
      });
    }
  };

  const fetchTemplates = async () => {
    if (!user?.id || userPracticeIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('meeting_attendee_templates')
        .select(`
          *,
          template_attendees (
            attendees (*)
          )
        `)
        .in('practice_id', userPracticeIds)
        .order('template_name');

      if (error) throw error;
      if (data) {
        const formattedTemplates = data.map(template => ({
          id: template.id,
          template_name: template.template_name,
          description: template.description,
          is_default: template.is_default,
          attendees: template.template_attendees?.map(ta => ta.attendees) || []
        }));
        setTemplates(formattedTemplates);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Error",
        description: "Failed to fetch templates",
        variant: "destructive"
      });
    }
  };

  const saveAttendee = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive"
      });
      return;
    }

    if (userPracticeIds.length === 0) {
      toast({
        title: "Error",
        description: "No practice assigned to your account",
        variant: "destructive"
      });
      return;
    }

    try {
      if (isEditing && editingId) {
        const { error } = await supabase
          .from('attendees')
          .update({
            name: formData.name,
            email: formData.email || null,
            title: formData.title || null,
            organization: formData.organization || null,
            role: formData.role || null,
          })
          .eq('id', editingId);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Attendee updated successfully"
        });
      } else {
        const { error } = await supabase
          .from('attendees')
          .insert({
            user_id: user?.id,
            practice_id: userPracticeIds[0], // Use first practice ID
            name: formData.name,
            email: formData.email || null,
            title: formData.title || null,
            organization: formData.organization || null,
            role: formData.role || null,
          });

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Attendee added successfully"
        });
      }

      resetForm();
      fetchAttendees();
    } catch (error) {
      console.error('Error saving attendee:', error);
      toast({
        title: "Error",
        description: "Failed to save attendee",
        variant: "destructive"
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
        description: "Attendee deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting attendee:', error);
      toast({
        title: "Error",
        description: "Failed to delete attendee",
        variant: "destructive"
      });
    }
  };

  const editAttendee = (attendee: Attendee) => {
    setFormData({
      name: attendee.name,
      email: attendee.email || '',
      title: attendee.title || 'Dr',
      organization: attendee.organization || '',
      role: attendee.role || ''
    });
    setEditingId(attendee.id);
    setIsEditing(true);
    setIsAdding(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      title: 'Dr',
      organization: '',
      role: ''
    });
    setEditingId(null);
    setIsEditing(false);
    setIsAdding(false);
  };

  const saveTemplate = async () => {
    if (!templateFormData.name.trim() || templateFormData.selectedAttendeeIds.length === 0) {
      toast({
        title: "Error",
        description: "Please enter a template name and select attendees",
        variant: "destructive"
      });
      return;
    }

    try {
      // Create the template
      const { data: template, error: templateError } = await supabase
        .from('meeting_attendee_templates')
        .insert({
          practice_id: userPracticeIds[0],
          template_name: templateFormData.name,
          description: templateFormData.description,
          created_by: user?.id,
          is_default: false
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Link attendees to template
      const templateAttendees = templateFormData.selectedAttendeeIds.map(attendeeId => ({
        template_id: template.id,
        attendee_id: attendeeId
      }));

      const { error: linkError } = await supabase
        .from('template_attendees')
        .insert(templateAttendees);

      if (linkError) throw linkError;

      toast({
        title: "Success",
        description: "Template created successfully"
      });

      setTemplateFormData({
        name: '',
        description: '',
        selectedAttendeeIds: []
      });
      setIsManagingTemplates(false);
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive"
      });
    }
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('meeting_attendee_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Template deleted successfully"
      });
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive"
      });
    }
  };

  const toggleAttendeeSelection = (attendeeId: string) => {
    setTemplateFormData(prev => ({
      ...prev,
      selectedAttendeeIds: prev.selectedAttendeeIds.includes(attendeeId)
        ? prev.selectedAttendeeIds.filter(id => id !== attendeeId)
        : [...prev.selectedAttendeeIds, attendeeId]
    }));
  };

  if (!hasManagementAccess) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2" />
            <p>You don't have permission to manage attendees.</p>
            <p className="text-sm">Contact your practice manager for access.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Attendee Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showTemplateManagement ? (
          <Tabs defaultValue="attendees">
            <TabsList>
              <TabsTrigger value="attendees">Attendees</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>
            
            <TabsContent value="attendees" className="space-y-4">
              {/* Attendee management content */}
              {renderAttendeeManagement()}
            </TabsContent>
            
            <TabsContent value="templates" className="space-y-4">
              {/* Template management content */}
              {renderTemplateManagement()}
            </TabsContent>
          </Tabs>
        ) : (
          renderAttendeeManagement()
        )}
      </CardContent>
    </Card>
  );

  function renderAttendeeManagement() {
    return (
      <>
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
                <Label htmlFor="organization">Organisation</Label>
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

            <div className="flex items-center justify-end space-x-2">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={saveAttendee}>
                <Check className="h-4 w-4 mr-2" />
                Save
              </Button>
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
      </>
    );
  }

  function renderTemplateManagement() {
    return (
      <>
        {/* Template Form */}
        {isManagingTemplates && (
          <div className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Create New Template</h4>
              <Button variant="ghost" size="sm" onClick={() => setIsManagingTemplates(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="templateName">Template Name</Label>
                <Input
                  id="templateName"
                  value={templateFormData.name}
                  onChange={(e) => setTemplateFormData({...templateFormData, name: e.target.value})}
                  placeholder="Enter template name..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="templateDescription">Description</Label>
                <Input
                  id="templateDescription"
                  value={templateFormData.description}
                  onChange={(e) => setTemplateFormData({...templateFormData, description: e.target.value})}
                  placeholder="Optional description..."
                />
              </div>

              <div className="space-y-2">
                <Label>Select Attendees</Label>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {attendees.map(attendee => (
                    <div key={attendee.id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={templateFormData.selectedAttendeeIds.includes(attendee.id)}
                        onCheckedChange={() => toggleAttendeeSelection(attendee.id)}
                      />
                      <Label className="text-sm">
                        {attendee.title} {attendee.name} ({attendee.role})
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsManagingTemplates(false)}>
                  Cancel
                </Button>
                <Button onClick={saveTemplate}>
                  <Bookmark className="h-4 w-4 mr-2" />
                  Save Template
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Add Template Button */}
        {!isManagingTemplates && (
          <Button variant="outline" onClick={() => setIsManagingTemplates(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        )}

        {/* Templates List */}
        <div className="space-y-2">
          {templates.map((template) => (
            <div key={template.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium flex items-center gap-2">
                  <Bookmark className="h-4 w-4" />
                  {template.template_name}
                  {template.is_default && (
                    <Badge variant="secondary" className="text-xs">Default</Badge>
                  )}
                  <Badge variant="outline">{template.attendees.length} attendees</Badge>
                </div>
                {template.description && (
                  <div className="text-sm text-muted-foreground">{template.description}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  Attendees: {template.attendees.map(a => a.name).join(', ')}
                </div>
              </div>
              <div className="space-x-2">
                <Button variant="ghost" size="sm" onClick={() => deleteTemplate(template.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          
          {templates.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No templates created yet. Click "Create Template" to get started.
            </div>
          )}
        </div>
      </>
    );
  }
};