import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, X, Users, Plus, Bookmark } from 'lucide-react';

interface Attendee {
  id: string;
  name: string;
  email?: string;
  title?: string;
  organization?: string;
  role?: string;
}

interface AttendeeTemplate {
  id: string;
  template_name: string;
  description?: string;
  is_default: boolean;
  attendees: Attendee[];
}

interface MeetingCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
  initialTitle: string;
  onSaveForLater: (data: MeetingContextData) => void;
  onGenerateNow: (data: MeetingContextData) => void;
}

interface MeetingContextData {
  title: string;
  format: string;
  location: string;
  agenda: string;
  selectedAttendees: Attendee[];
  participants: string[];
}

const MEETING_FORMATS = [
  { value: 'face-to-face', label: 'Face-to-Face' },
  { value: 'online', label: 'Online/Virtual' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'phone', label: 'Phone Conference' }
];

export const MeetingCompletionModal: React.FC<MeetingCompletionModalProps> = ({
  isOpen,
  onClose,
  meetingId,
  initialTitle,
  onSaveForLater,
  onGenerateNow
}) => {
  const { user } = useAuth();
  const [title, setTitle] = useState(initialTitle);
  const [format, setFormat] = useState<string>('');
  const [location, setLocation] = useState('');
  const [agenda, setAgenda] = useState('');
  const [selectedAttendees, setSelectedAttendees] = useState<Attendee[]>([]);
  const [attendeeTemplates, setAttendeeTemplates] = useState<AttendeeTemplate[]>([]);
  const [availableAttendees, setAvailableAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(false);
  const [rememberAsList, setRememberAsList] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateNameInput, setShowTemplateNameInput] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAttendeeData();
    }
  }, [isOpen]);

  const fetchAttendeeData = async () => {
    try {
      // Get user's practice IDs
      const { data: userRoles } = await supabase
        .rpc('get_user_roles', { _user_id: user?.id });
      
      if (!userRoles || userRoles.length === 0) return;

      const practiceIds = userRoles.map(role => role.practice_id).filter(Boolean);
      
      // Fetch available attendees for user's practices
      const { data: attendees } = await supabase
        .from('attendees')
        .select('*')
        .in('practice_id', practiceIds);

      if (attendees) {
        setAvailableAttendees(attendees);
      }

      // Fetch attendee templates for user's practices
      const { data: templates } = await supabase
        .from('meeting_attendee_templates')
        .select(`
          *,
          template_attendees (
            attendees (*)
          )
        `)
        .in('practice_id', practiceIds);

      if (templates) {
        const formattedTemplates = templates.map(template => ({
          id: template.id,
          template_name: template.template_name,
          description: template.description,
          is_default: template.is_default,
          attendees: template.template_attendees?.map(ta => ta.attendees) || []
        }));
        setAttendeeTemplates(formattedTemplates);
      }
    } catch (error) {
      console.error('Error fetching attendee data:', error);
      toast({
        title: "Error",
        description: "Failed to load attendee data",
        variant: "destructive"
      });
    }
  };

  const handleAddAttendee = (attendee: Attendee) => {
    if (!selectedAttendees.find(a => a.id === attendee.id)) {
      setSelectedAttendees(prev => [...prev, attendee]);
    }
  };

  const handleRemoveAttendee = (attendeeId: string) => {
    setSelectedAttendees(prev => prev.filter(a => a.id !== attendeeId));
  };

  const handleApplyTemplate = (template: AttendeeTemplate) => {
    setSelectedAttendees(template.attendees);
    toast({
      title: "Template Applied",
      description: `Applied "${template.template_name}" template`
    });
  };

  const saveAsTemplate = async () => {
    if (!templateName.trim() || selectedAttendees.length === 0) {
      toast({
        title: "Error",
        description: "Please enter a template name and select attendees",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: userRoles } = await supabase
        .rpc('get_user_roles', { _user_id: user?.id });
      
      const practiceId = userRoles?.[0]?.practice_id;
      if (!practiceId) return;

      // Create the template
      const { data: template, error: templateError } = await supabase
        .from('meeting_attendee_templates')
        .insert({
          practice_id: practiceId,
          template_name: templateName,
          description: `Template created from meeting completion`,
          created_by: user?.id,
          is_default: false
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Link attendees to template
      const templateAttendees = selectedAttendees.map(attendee => ({
        template_id: template.id,
        attendee_id: attendee.id
      }));

      const { error: linkError } = await supabase
        .from('template_attendees')
        .insert(templateAttendees);

      if (linkError) throw linkError;

      toast({
        title: "Template Saved",
        description: `"${templateName}" template created successfully`
      });

      setTemplateName('');
      setShowTemplateNameInput(false);
      fetchAttendeeData(); // Refresh templates
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive"
      });
    }
  };

  const handleSaveForLater = () => {
    const contextData: MeetingContextData = {
      title,
      format,
      location,
      agenda,
      selectedAttendees,
      participants: selectedAttendees.map(a => a.name)
    };

    if (rememberAsList && selectedAttendees.length > 0) {
      setShowTemplateNameInput(true);
      return;
    }

    onSaveForLater(contextData);
  };

  const handleGenerateNow = () => {
    const contextData: MeetingContextData = {
      title,
      format,
      location,
      agenda,
      selectedAttendees,
      participants: selectedAttendees.map(a => a.name)
    };

    if (rememberAsList && selectedAttendees.length > 0) {
      setShowTemplateNameInput(true);
      return;
    }

    onGenerateNow(contextData);
  };

  const handleClose = () => {
    // Default to "Save for Later" when modal is dismissed
    handleSaveForLater();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Your Meeting</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Meeting Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Meeting Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter meeting title..."
            />
          </div>

          {/* Meeting Format & Location */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="format">Meeting Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {MEETING_FORMATS.map(fmt => (
                    <SelectItem key={fmt.value} value={fmt.value}>
                      {fmt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Meeting location..."
              />
            </div>
          </div>

          {/* Agenda */}
          <div className="space-y-2">
            <Label htmlFor="agenda">Agenda</Label>
            <Textarea
              id="agenda"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="Meeting agenda and key discussion points..."
              rows={3}
            />
          </div>

          {/* Attendee Templates */}
          {attendeeTemplates.length > 0 && (
            <div className="space-y-2">
              <Label>Quick Templates</Label>
              <div className="flex flex-wrap gap-2">
                {attendeeTemplates.map(template => (
                  <Button
                    key={template.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleApplyTemplate(template)}
                    className="flex items-center gap-2"
                  >
                    <Bookmark className="h-4 w-4" />
                    {template.template_name}
                    <Badge variant="secondary">{template.attendees.length}</Badge>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Available Attendees */}
          <div className="space-y-2">
            <Label>Add Attendees</Label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {availableAttendees.map(attendee => (
                <Button
                  key={attendee.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddAttendee(attendee)}
                  disabled={selectedAttendees.some(a => a.id === attendee.id)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {attendee.name}
                  {attendee.title && (
                    <Badge variant="secondary">{attendee.title}</Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>

          {/* Selected Attendees */}
          {selectedAttendees.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Attendees ({selectedAttendees.length})</Label>
              <Card className="p-4">
                <div className="flex flex-wrap gap-2">
                  {selectedAttendees.map(attendee => (
                    <Badge
                      key={attendee.id}
                      variant="default"
                      className="flex items-center gap-2 px-3 py-1"
                    >
                      <Users className="h-3 w-3" />
                      {attendee.name}
                      {attendee.title && ` (${attendee.title})`}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => handleRemoveAttendee(attendee.id)}
                      />
                    </Badge>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Remember as Template */}
          {selectedAttendees.length > 0 && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rememberList"
                checked={rememberAsList}
                onCheckedChange={(checked) => setRememberAsList(checked === true)}
              />
              <Label htmlFor="rememberList">Remember this attendee list as a template</Label>
            </div>
          )}

          {/* Template Name Input */}
          {showTemplateNameInput && (
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name</Label>
              <div className="flex gap-2">
                <Input
                  id="templateName"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Enter template name..."
                />
                <Button onClick={saveAsTemplate} disabled={!templateName.trim()}>
                  Save Template
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowTemplateNameInput(false);
                    setRememberAsList(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between pt-6 border-t">
          <Button variant="outline" onClick={handleClose}>
            Save for Later
          </Button>
          <Button onClick={handleGenerateNow} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Meeting Notes Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};