import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Plus, Edit, Trash2, Check, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Attendee {
  id: string;
  name: string;
  email?: string;
  title?: string;
  organization?: string;
  organization_type?: 'practice' | 'neighbourhood_pcn' | 'icb' | 'lmc' | 'nhse' | 'other';
  role?: string;
}

interface MeetingAttendeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
  meetingTitle: string;
}

export const MeetingAttendeeModal = ({ isOpen, onClose, meetingId, meetingTitle }: MeetingAttendeeModalProps) => {
  const { user } = useAuth();
  const [allAttendees, setAllAttendees] = useState<Attendee[]>([]);
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // Add/Edit attendee form state
  const [isAddingAttendee, setIsAddingAttendee] = useState(false);
  const [editingAttendeeId, setEditingAttendeeId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    title: 'Dr',
    organization: '',
    organization_type: 'practice' as 'practice' | 'neighbourhood_pcn' | 'icb' | 'lmc' | 'nhse' | 'other',
    role: ''
  });

  // Autocomplete state
  const [orgSuggestions, setOrgSuggestions] = useState<Array<{ name: string; code?: string }>>([]);
  const [showOrgSuggestions, setShowOrgSuggestions] = useState(false);
  const orgInputRef = useRef<HTMLInputElement>(null);
  
  const [roleSuggestions, setRoleSuggestions] = useState<string[]>([]);
  const [showRoleSuggestions, setShowRoleSuggestions] = useState(false);
  const roleInputRef = useRef<HTMLInputElement>(null);

  // Predefined roles for GP practices and ICB
  const commonRoles = [
    'GP',
    'GP Partner',
    'Salaried GP',
    'Practice Manager',
    'Deputy Practice Manager',
    'Finance Manager',
    'Clinical Lead',
    'Practice Nurse',
    'Advanced Nurse Practitioner',
    'Healthcare Assistant',
    'Pharmacist',
    'Clinical Pharmacist',
    'Physiotherapist',
    'Mental Health Practitioner',
    'Social Prescriber',
    'Care Coordinator',
    'PCN Clinical Director',
    'PCN Manager',
    'ICB Manager',
    'ICB Clinical Lead',
    'Quality Improvement Lead',
    'Medical Secretary',
    'Receptionist',
    'Administrator',
    'IT Manager',
    'Communications Manager'
  ];

  useEffect(() => {
    if (isOpen && user) {
      fetchAttendees();
      fetchMeetingAttendees();
    }
  }, [isOpen, user, meetingId]);

  const fetchAttendees = async () => {
    if (!user) return;

    try {
      // Get user's practice IDs
      const { data: userRoles } = await supabase
        .rpc('get_user_roles', { _user_id: user.id });
      
      if (!userRoles || userRoles.length === 0) return;

      const practiceIds = userRoles.map(role => role.practice_id).filter(Boolean);

      // Fetch all attendees for user's practices
      const { data, error } = await supabase
        .from('attendees')
        .select('*')
        .in('practice_id', practiceIds)
        .order('name');

      if (error) throw error;
      setAllAttendees((data as Attendee[]) || []);
    } catch (error) {
      console.error('Error fetching attendees:', error);
      toast.error('Failed to load attendees');
    }
  };

  const fetchMeetingAttendees = async () => {
    try {
      const { data, error } = await supabase
        .from('meeting_attendees')
        .select('attendee_id')
        .eq('meeting_id', meetingId);

      if (error) throw error;
      setSelectedAttendeeIds(data?.map(ma => ma.attendee_id) || []);
    } catch (error) {
      console.error('Error fetching meeting attendees:', error);
    }
  };

  const toggleAttendee = (attendeeId: string) => {
    setSelectedAttendeeIds(prev =>
      prev.includes(attendeeId)
        ? prev.filter(id => id !== attendeeId)
        : [...prev, attendeeId]
    );
  };

  const saveAttendees = async () => {
    setIsSaving(true);
    try {
      // First, remove all existing meeting attendees
      await supabase
        .from('meeting_attendees')
        .delete()
        .eq('meeting_id', meetingId);

      // Then add the selected ones
      if (selectedAttendeeIds.length > 0) {
        const meetingAttendees = selectedAttendeeIds.map(attendee_id => ({
          meeting_id: meetingId,
          attendee_id
        }));

        const { error } = await supabase
          .from('meeting_attendees')
          .insert(meetingAttendees);

        if (error) throw error;

        // Silently update the transcript with attendee details
        const selectedAttendeesData = allAttendees.filter(a => selectedAttendeeIds.includes(a.id));
        
        if (selectedAttendeesData.length > 0) {
          // Format attendees information
          const attendeesText = selectedAttendeesData.map(attendee => {
            const orgBadge = getOrgTypeBadge(attendee.organization_type);
            return `${attendee.title ? attendee.title + ' ' : ''}${attendee.name}${attendee.role ? ' - ' + attendee.role : ''}${attendee.organization ? ' (' + attendee.organization + ', ' + orgBadge.label + ')' : ''}${attendee.email ? ' - ' + attendee.email : ''}`;
          }).join('\n');

          const attendeesSection = `\n\n### Confirmed Attendees:\n${attendeesText}\n`;

          // Get current transcript
          const { data: currentTranscript } = await supabase.rpc('get_meeting_full_transcript', {
            p_meeting_id: meetingId
          });

          if (currentTranscript && currentTranscript.length > 0) {
            const transcriptText = currentTranscript[0].transcript || '';
            
            // Remove old attendees section if it exists
            const updatedTranscript = transcriptText.replace(/\n\n### Confirmed Attendees:[\s\S]*?(?=\n\n|$)/, '') + attendeesSection;

            // Update the meeting transcript
            await supabase
              .from('meetings')
              .update({ 
                transcript: updatedTranscript,
                updated_at: new Date().toISOString()
              })
              .eq('id', meetingId);
          }
        }
      }

      onClose();
    } catch (error) {
      console.error('Error saving attendees:', error);
      toast.error('Failed to save attendees');
    } finally {
      setIsSaving(false);
    }
  };

  const saveNewAttendee = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    if (!user) return;

    try {
      // Get user's practice IDs
      const { data: userRoles } = await supabase
        .rpc('get_user_roles', { _user_id: user.id });
      
      if (!userRoles || userRoles.length === 0) {
        toast.error('No practice assigned to your account');
        return;
      }

      const practiceIds = userRoles.map(role => role.practice_id).filter(Boolean);

      if (editingAttendeeId) {
        // Update existing
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
          .eq('id', editingAttendeeId);

        if (error) throw error;
        toast.success('Attendee updated');
      } else {
        // Insert new
        const { error } = await supabase
          .from('attendees')
          .insert({
            user_id: user.id,
            practice_id: practiceIds[0],
            name: formData.name,
            email: formData.email || null,
            title: formData.title || null,
            organization: formData.organization || null,
            organization_type: formData.organization_type,
            role: formData.role || null,
          });

        if (error) throw error;
        toast.success('Attendee added');
      }

      resetForm();
      fetchAttendees();
    } catch (error) {
      console.error('Error saving attendee:', error);
      toast.error('Failed to save attendee');
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
    setEditingAttendeeId(attendee.id);
    setIsAddingAttendee(true);
  };

  const deleteAttendee = async (attendeeId: string) => {
    if (!confirm('Are you sure you want to delete this attendee?')) return;

    try {
      const { error } = await supabase
        .from('attendees')
        .delete()
        .eq('id', attendeeId);

      if (error) throw error;
      toast.success('Attendee deleted');
      fetchAttendees();
      setSelectedAttendeeIds(prev => prev.filter(id => id !== attendeeId));
    } catch (error) {
      console.error('Error deleting attendee:', error);
      toast.error('Failed to delete attendee');
    }
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
    setEditingAttendeeId(null);
    setIsAddingAttendee(false);
    setOrgSuggestions([]);
    setShowOrgSuggestions(false);
    setRoleSuggestions([]);
    setShowRoleSuggestions(false);
  };

  const fetchOrgSuggestions = async (query: string) => {
    if (!query || query.length < 2) {
      setOrgSuggestions([]);
      return;
    }

    try {
      let suggestions: Array<{ name: string; code?: string }> = [];

      // Search based on organization type
      if (formData.organization_type === 'practice') {
        const { data: practices, error } = await supabase
          .from('gp_practices')
          .select('name, practice_code')
          .or(`name.ilike.%${query}%,practice_code.ilike.%${query}%`)
          .limit(10);

        if (error) throw error;

        suggestions = practices?.map(p => ({
          name: p.name,
          code: p.practice_code || undefined
        })) || [];
      } else if (formData.organization_type === 'neighbourhood_pcn') {
        // Search for PCNs in gp_practices table (PCNs are also listed there)
        // or search for existing PCN organizations in attendees table
        const { data: existingPcns, error } = await supabase
          .from('attendees')
          .select('organization')
          .eq('organization_type', 'neighbourhood_pcn')
          .ilike('organization', `%${query}%`)
          .limit(10);

        if (error) throw error;

        // Get unique organization names
        const uniquePcns = [...new Set(existingPcns?.map(p => p.organization).filter(Boolean))];
        suggestions = uniquePcns.map(name => ({ name: name as string }));
      } else {
        // For ICB, LMC, NHSE, and Other - search existing organizations of that type
        const { data: existingOrgs, error } = await supabase
          .from('attendees')
          .select('organization')
          .eq('organization_type', formData.organization_type)
          .ilike('organization', `%${query}%`)
          .limit(10);

        if (error) throw error;

        // Get unique organization names
        const uniqueOrgs = [...new Set(existingOrgs?.map(o => o.organization).filter(Boolean))];
        suggestions = uniqueOrgs.map(name => ({ name: name as string }));
      }

      setOrgSuggestions(suggestions);
      setShowOrgSuggestions(suggestions.length > 0);
    } catch (error) {
      console.error('Error fetching organization suggestions:', error);
    }
  };

  const handleOrgInputChange = (value: string) => {
    setFormData({ ...formData, organization: value });
    fetchOrgSuggestions(value);
  };

  // Re-fetch suggestions when organization type changes
  const handleOrgTypeChange = (value: any) => {
    setFormData({ ...formData, organization_type: value, organization: '' });
    setOrgSuggestions([]);
    setShowOrgSuggestions(false);
  };

  const selectOrgSuggestion = (suggestion: { name: string; code?: string }) => {
    setFormData({ ...formData, organization: suggestion.name });
    setShowOrgSuggestions(false);
    setOrgSuggestions([]);
  };

  const handleRoleInputChange = (value: string) => {
    setFormData({ ...formData, role: value });
    
    if (value.length >= 1) {
      const filtered = commonRoles.filter(role => 
        role.toLowerCase().includes(value.toLowerCase())
      );
      setRoleSuggestions(filtered);
      setShowRoleSuggestions(filtered.length > 0);
    } else {
      setRoleSuggestions([]);
      setShowRoleSuggestions(false);
    }
  };

  const selectRoleSuggestion = (role: string) => {
    setFormData({ ...formData, role });
    setShowRoleSuggestions(false);
    setRoleSuggestions([]);
  };

  const getOrgTypeBadge = (type?: string) => {
    switch (type) {
      case 'practice':
        return { icon: '🏥', label: 'Practice', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' };
      case 'neighbourhood_pcn':
        return { icon: '🤝', label: 'PCN', className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' };
      case 'icb':
        return { icon: '🏛️', label: 'ICB', className: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' };
      case 'lmc':
        return { icon: '⚖️', label: 'LMC', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' };
      case 'nhse':
        return { icon: '📋', label: 'NHSE', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' };
      default:
        return { icon: '📋', label: 'Other', className: 'bg-grey-100 text-grey-700 dark:bg-grey-950 dark:text-grey-300' };
    }
  };

  const filteredAttendees = allAttendees.filter(attendee =>
    attendee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    attendee.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    attendee.organization?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Manage Attendees
          </DialogTitle>
          <DialogDescription>
            Manage attendees for: <span className="font-semibold">{meetingTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="quick-pick" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick-pick">Quick Pick ({selectedAttendeeIds.length})</TabsTrigger>
            <TabsTrigger value="manage">Manage Global List</TabsTrigger>
          </TabsList>

          <TabsContent value="quick-pick" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Attendees</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, email, or organisation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredAttendees.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    {searchQuery ? 'No attendees found matching your search' : 'No attendees available. Add them in the "Manage Global List" tab.'}
                  </CardContent>
                </Card>
              ) : (
                filteredAttendees.map(attendee => {
                  const orgBadge = getOrgTypeBadge(attendee.organization_type);
                  const isSelected = selectedAttendeeIds.includes(attendee.id);

                  return (
                    <Card key={attendee.id} className={`cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : ''}`} onClick={() => toggleAttendee(attendee.id)}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleAttendee(attendee.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold truncate">
                                {attendee.title ? `${attendee.title} ${attendee.name}` : attendee.name}
                              </span>
                              <Badge variant="outline" className={`${orgBadge.className} text-xs shrink-0`}>
                                {orgBadge.icon}
                              </Badge>
                            </div>
                            {attendee.email && (
                              <div className="text-sm text-muted-foreground truncate">{attendee.email}</div>
                            )}
                            {attendee.organization && (
                              <div className="text-sm text-muted-foreground truncate">{attendee.organization}</div>
                            )}
                            {attendee.role && (
                              <Badge variant="secondary" className="text-xs mt-1">{attendee.role}</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={saveAttendees} disabled={isSaving}>
                <Check className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Attendees'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="manage" className="space-y-4">
            {!isAddingAttendee && (
              <Button onClick={() => setIsAddingAttendee(true)} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add New Attendee
              </Button>
            )}

            {isAddingAttendee && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="title">Title</Label>
                      <Select value={formData.title} onValueChange={(value) => setFormData({ ...formData, title: value })}>
                        <SelectTrigger id="title">
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

                    <div className="space-y-1">
                      <Label htmlFor="name">Full Name * (First Last)</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Full name"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@nhs.net"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="org_type">Organisation Type *</Label>
                      <Select
                        value={formData.organization_type}
                        onValueChange={handleOrgTypeChange}
                      >
                        <SelectTrigger id="org_type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="practice">🏥 Practice</SelectItem>
                          <SelectItem value="neighbourhood_pcn">🤝 Neighbourhood/PCN</SelectItem>
                          <SelectItem value="icb">🏛️ ICB</SelectItem>
                          <SelectItem value="lmc">⚖️ LMC</SelectItem>
                          <SelectItem value="nhse">📋 NHSE</SelectItem>
                          <SelectItem value="other">📋 Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1 relative">
                      <Label htmlFor="organization">Organisation Name</Label>
                      <Input
                        ref={orgInputRef}
                        id="organization"
                        value={formData.organization}
                        onChange={(e) => handleOrgInputChange(e.target.value)}
                        onFocus={() => formData.organization.length >= 2 && setShowOrgSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowOrgSuggestions(false), 200)}
                        placeholder="Start typing practice name or ODS code..."
                        autoComplete="off"
                      />
                      {showOrgSuggestions && orgSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
                          {orgSuggestions.map((suggestion, idx) => (
                            <div
                              key={idx}
                              className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
                              onClick={() => selectOrgSuggestion(suggestion)}
                            >
                              <div className="font-medium">{suggestion.name}</div>
                              {suggestion.code && (
                                <div className="text-xs text-muted-foreground">ODS: {suggestion.code}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 relative">
                    <Label htmlFor="role">Role</Label>
                    <Input
                      ref={roleInputRef}
                      id="role"
                      value={formData.role}
                      onChange={(e) => handleRoleInputChange(e.target.value)}
                      onFocus={() => {
                        if (formData.role.length >= 1) {
                          const filtered = commonRoles.filter(role => 
                            role.toLowerCase().includes(formData.role.toLowerCase())
                          );
                          setRoleSuggestions(filtered);
                          setShowRoleSuggestions(filtered.length > 0);
                        }
                      }}
                      onBlur={() => setTimeout(() => setShowRoleSuggestions(false), 200)}
                      placeholder="Start typing role..."
                      autoComplete="off"
                    />
                    {showRoleSuggestions && roleSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
                        {roleSuggestions.map((role, idx) => (
                          <div
                            key={idx}
                            className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
                            onClick={() => selectRoleSuggestion(role)}
                          >
                            {role}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={resetForm}>
                      Cancel
                    </Button>
                    <Button onClick={saveNewAttendee}>
                      {editingAttendeeId ? 'Update' : 'Add'} Attendee
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {allAttendees.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    No attendees in the global list yet. Add your first attendee above.
                  </CardContent>
                </Card>
              ) : (
                allAttendees.map(attendee => {
                  const orgBadge = getOrgTypeBadge(attendee.organization_type);

                  return (
                    <Card key={attendee.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold truncate">
                                {attendee.title ? `${attendee.title} ${attendee.name}` : attendee.name}
                              </span>
                              <Badge variant="outline" className={`${orgBadge.className} text-xs shrink-0`}>
                                {orgBadge.icon}
                              </Badge>
                            </div>
                            {attendee.email && (
                              <div className="text-sm text-muted-foreground truncate">{attendee.email}</div>
                            )}
                            {attendee.organization && (
                              <div className="text-sm text-muted-foreground truncate">{attendee.organization}</div>
                            )}
                            {attendee.role && (
                              <Badge variant="secondary" className="text-xs mt-1">{attendee.role}</Badge>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="outline" size="sm" onClick={() => editAttendee(attendee)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => deleteAttendee(attendee.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
