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
  organization_type?: 'practice' | 'neighbourhood_pcn' | 'icn' | 'nhse' | 'other';
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
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<AttendeeTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    title: 'Dr',
    organization: '',
    organization_type: 'practice' as 'practice' | 'neighbourhood_pcn' | 'icn' | 'nhse' | 'other',
    role: ''
  });
  const [templateFormData, setTemplateFormData] = useState({
    name: '',
    description: '',
    selectedAttendeeIds: [] as string[]
  });

  useEffect(() => {
    checkUserAccess();
  }, [user?.id]);

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
      const { data: userRoles } = await supabase
        .rpc('get_user_roles', { _user_id: user.id });
      
      if (userRoles && userRoles.length > 0) {
        const practiceIds = userRoles.map(role => role.practice_id).filter(Boolean);
        setUserPracticeIds(practiceIds);
        
        const hasAccess = userRoles.some(role => 
          role.role === 'practice_manager' || 
          role.role === 'system_admin' ||
          role.role === 'pcn_manager'
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
        setAttendees(data as Attendee[]);
        onAttendeesChange?.(data as Attendee[]);
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
        .from('attendee_templates')
        .select(`
          *,
          attendee_template_members (
            attendees (*)
          )
        `)
        .or(`practice_id.in.(${userPracticeIds.join(',')}),user_id.eq.${user.id}`)
        .order('template_name');

      if (error) throw error;
      if (data) {
        const formattedTemplates = data.map(template => ({
          id: template.id,
          template_name: template.template_name,
          description: template.description,
          is_default: template.is_default,
          attendees: (template.attendee_template_members?.map((tm: any) => tm.attendees) || []) as Attendee[]
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
            organization_type: formData.organization_type,
            role: formData.role || null,
          })
          .eq('id', editingId);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Attendee updated successfully"
        });
      } else {
        if (!user?.id) {
          throw new Error("User ID is required");
        }
        
        // Verify practice_id exists in practice_details before using
        let validPracticeId = null;
        if (userPracticeIds[0]) {
          const { data: practiceCheck } = await supabase
            .from('practice_details')
            .select('id')
            .eq('id', userPracticeIds[0])
            .single();
          
          if (practiceCheck) {
            validPracticeId = userPracticeIds[0];
          }
        }
        
        const { error } = await supabase
          .from('attendees')
          .insert({
            user_id: user.id,
            practice_id: validPracticeId,
            name: formData.name,
            email: formData.email || null,
            title: formData.title || null,
            organization: formData.organization || null,
            organization_type: formData.organization_type,
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
    } catch (error: any) {
      console.error('Error saving attendee:', error);
      toast({
        title: "Error",
        description: `Failed to save attendee: ${error?.message || 'Unknown error'}`,
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
      organization_type: attendee.organization_type || 'practice',
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
      organization_type: 'practice',
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
      if (isEditingTemplate && editingTemplateId) {
        // Update existing template
        const { error: templateError } = await supabase
          .from('attendee_templates')
          .update({
            template_name: templateFormData.name,
            description: templateFormData.description || null,
          })
          .eq('id', editingTemplateId);

        if (templateError) throw templateError;

        // Delete existing template members
        const { error: deleteError } = await supabase
          .from('attendee_template_members')
          .delete()
          .eq('template_id', editingTemplateId);

        if (deleteError) throw deleteError;

        // Insert new template members
        const templateMembers = templateFormData.selectedAttendeeIds.map(attendeeId => ({
          template_id: editingTemplateId,
          attendee_id: attendeeId
        }));

        const { error: linkError } = await supabase
          .from('attendee_template_members')
          .insert(templateMembers);

        if (linkError) throw linkError;

        toast({
          title: "Success",
          description: "Template updated successfully"
        });
      } else {
        // Create new template
        const { data: template, error: templateError } = await supabase
          .from('attendee_templates')
          .insert({
            user_id: user?.id,
            practice_id: userPracticeIds[0],
            template_name: templateFormData.name,
            description: templateFormData.description || null,
            is_default: false
          })
          .select()
          .single();

        if (templateError) throw templateError;

        const templateMembers = templateFormData.selectedAttendeeIds.map(attendeeId => ({
          template_id: template.id,
          attendee_id: attendeeId
        }));

        const { error: linkError } = await supabase
          .from('attendee_template_members')
          .insert(templateMembers);

        if (linkError) throw linkError;

        toast({
          title: "Success",
          description: "Template created successfully"
        });
      }

      resetTemplateForm();
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

  const editTemplate = (template: AttendeeTemplate) => {
    setTemplateFormData({
      name: template.template_name,
      description: template.description || '',
      selectedAttendeeIds: template.attendees.map(a => a.id)
    });
    setEditingTemplateId(template.id);
    setIsEditingTemplate(true);
    setIsManagingTemplates(true);
  };

  const resetTemplateForm = () => {
    setTemplateFormData({
      name: '',
      description: '',
      selectedAttendeeIds: []
    });
    setEditingTemplateId(null);
    setIsEditingTemplate(false);
    setIsManagingTemplates(false);
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('attendee_templates')
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

  const getOrgTypeInfo = (type?: string) => {
    switch (type) {
      case 'practice':
        return { icon: '🏥', label: 'Practice', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' };
      case 'neighbourhood_pcn':
        return { icon: '🤝', label: 'Neighbourhood/PCN', color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' };
      case 'icn':
        return { icon: '🏛️', label: 'ICN', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' };
      case 'nhse':
        return { icon: '📋', label: 'NHSE', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' };
      default:
        return { icon: '📋', label: 'Other', color: 'bg-grey-100 text-grey-700 dark:bg-grey-950 dark:text-grey-300' };
    }
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
              {renderAttendeeManagement()}
            </TabsContent>
            
            <TabsContent value="templates" className="space-y-4">
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {isEditing ? 'Edit Attendee' : 'Add New Attendee'}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Label htmlFor="name">Name *</Label>
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
                  placeholder="email@nhs.net"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="organization_type">Organisation Type *</Label>
                  <Select 
                    value={formData.organization_type} 
                    onValueChange={(value: 'practice' | 'neighbourhood_pcn' | 'icn' | 'nhse' | 'other') => 
                      setFormData({ ...formData, organization_type: value })
                    }
                  >
                    <SelectTrigger id="organization_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="practice">🏥 Practice</SelectItem>
                      <SelectItem value="neighbourhood_pcn">🤝 Neighbourhood/PCN</SelectItem>
                      <SelectItem value="icn">🏛️ ICN</SelectItem>
                      <SelectItem value="nhse">📋 NHSE</SelectItem>
                      <SelectItem value="other">📋 Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organization">Organisation Name</Label>
                  <Input
                    id="organization"
                    value={formData.organization}
                    onChange={(e) => setFormData({...formData, organization: e.target.value})}
                    placeholder="Oak Tree Surgery"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  placeholder="Clinical Lead, Practice Manager, etc."
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
                <Button onClick={saveAttendee} disabled={!formData.name}>
                  {isEditing ? 'Update' : 'Add'} Attendee
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Button */}
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add New Attendee
          </Button>
        )}

        {/* Attendee List */}
        <Card>
          <CardHeader>
            <CardTitle>Saved Attendees ({attendees.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {attendees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No attendees saved yet. Add your first attendee above.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {attendees.map(attendee => {
                  const orgInfo = getOrgTypeInfo(attendee.organization_type);
                  return (
                    <Card key={attendee.id} className="relative group hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-base truncate">{attendee.title ? `${attendee.title} ${attendee.name}` : attendee.name}</div>
                              {attendee.role && (
                                <div className="text-sm text-muted-foreground truncate">{attendee.role}</div>
                              )}
                            </div>
                            <Badge variant="outline" className={`${orgInfo.color} text-xs shrink-0`}>
                              {orgInfo.icon}
                            </Badge>
                          </div>

                          {attendee.email && (
                            <div className="text-sm truncate">
                              <a href={`mailto:${attendee.email}`} className="text-primary hover:underline">
                                {attendee.email}
                              </a>
                            </div>
                          )}

                          {attendee.organization && (
                            <div className="text-sm text-muted-foreground truncate">
                              {attendee.organization}
                            </div>
                          )}

                          <div className="flex gap-2 pt-2 border-t">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => editAttendee(attendee)}
                              className="flex-1"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              onClick={() => deleteAttendee(attendee.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </>
    );
  }

  function renderTemplateManagement() {
    return (
      <>
        {/* Template Creation Form */}
        {isManagingTemplates && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {isEditingTemplate ? 'Edit Attendee Template' : 'Create Attendee Template'}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={resetTemplateForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name *</Label>
                <Input
                  id="template-name"
                  value={templateFormData.name}
                  onChange={(e) => setTemplateFormData({...templateFormData, name: e.target.value})}
                  placeholder="e.g., Monthly Team Meeting"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-desc">Description</Label>
                <Input
                  id="template-desc"
                  value={templateFormData.description}
                  onChange={(e) => setTemplateFormData({...templateFormData, description: e.target.value})}
                  placeholder="Optional description"
                />
              </div>

              <div className="space-y-2">
                <Label>Select Attendees *</Label>
                <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
                  {attendees.map(attendee => (
                    <div key={attendee.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`template-${attendee.id}`}
                        checked={templateFormData.selectedAttendeeIds.includes(attendee.id)}
                        onCheckedChange={() => toggleAttendeeSelection(attendee.id)}
                      />
                      <Label htmlFor={`template-${attendee.id}`} className="flex-1 cursor-pointer">
                        {attendee.name}
                        {attendee.organization && (
                          <span className="text-sm text-muted-foreground ml-2">
                            ({attendee.organization})
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <Button variant="outline" onClick={resetTemplateForm}>
                  Cancel
                </Button>
                <Button onClick={saveTemplate}>
                  {isEditingTemplate ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Update Template
                    </>
                  ) : (
                    <>
                      <Bookmark className="h-4 w-4 mr-2" />
                      Create Template
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Template Button */}
        {!isManagingTemplates && (
          <Button 
            onClick={() => {
              resetTemplateForm();
              setIsManagingTemplates(true);
            }} 
            className="w-full md:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Template
          </Button>
        )}

        {/* Template List */}
        <Card>
          <CardHeader>
            <CardTitle>Saved Templates ({templates.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No templates saved yet. Create your first template above.
              </p>
            ) : (
              <div className="space-y-3">
                {templates.map(template => (
                  <Card key={template.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-semibold">{template.template_name}</div>
                            {template.description && (
                              <div className="text-sm text-muted-foreground mt-1">
                                {template.description}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {template.attendees.map((attendee: Attendee) => (
                                <Badge key={attendee.id} variant="secondary" className="text-xs">
                                  {attendee.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {onAttendeesChange && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  onAttendeesChange(template.attendees);
                                  toast({
                                    title: "Template Applied",
                                    description: `Applied ${template.attendees.length} attendees from "${template.template_name}"`
                                  });
                                }}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Apply
                              </Button>
                            )}
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => editTemplate(template)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => deleteTemplate(template.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </>
    );
  }
};
