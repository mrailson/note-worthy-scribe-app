import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Mail, Globe, Building2, Users, X, Check } from 'lucide-react';
import { useDistributionLists, DistributionList } from '@/hooks/useDistributionLists';
import { showToast } from '@/utils/toastWrapper';

interface Attendee {
  id: string;
  name: string;
  email?: string;
  title?: string;
  organization?: string;
  role?: string;
  scope?: 'global' | 'local';
}

interface DistributionListManagerProps {
  attendees: Attendee[];
  practiceId?: string;
}

export const DistributionListManager: React.FC<DistributionListManagerProps> = ({
  attendees,
  practiceId
}) => {
  const {
    distributionLists,
    isLoading,
    createDistributionList,
    updateDistributionList,
    deleteDistributionList
  } = useDistributionLists();

  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [expandedListId, setExpandedListId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    scope: 'local' as 'global' | 'local',
    selectedAttendeeIds: [] as string[]
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      scope: 'local',
      selectedAttendeeIds: []
    });
    setIsCreating(false);
    setIsEditing(false);
    setEditingListId(null);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setIsEditing(false);
    setEditingListId(null);
    setFormData({
      name: '',
      description: '',
      scope: 'local',
      selectedAttendeeIds: []
    });
  };

  const handleEdit = (list: DistributionList) => {
    setIsEditing(true);
    setIsCreating(true);
    setEditingListId(list.id);
    setFormData({
      name: list.name,
      description: list.description || '',
      scope: list.scope,
      selectedAttendeeIds: list.members.map(m => m.attendee_id)
    });
  };

  const handleDelete = async (listId: string) => {
    if (!confirm('Are you sure you want to delete this distribution list?')) return;
    await deleteDistributionList(listId);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showToast.error('Please enter a list name');
      return;
    }

    if (formData.selectedAttendeeIds.length === 0) {
      showToast.error('Please select at least one attendee');
      return;
    }

    // Check that all selected attendees have emails
    const attendeesWithoutEmail = formData.selectedAttendeeIds.filter(id => {
      const attendee = attendees.find(a => a.id === id);
      return !attendee?.email;
    });

    if (attendeesWithoutEmail.length > 0) {
      showToast.error('All selected attendees must have email addresses');
      return;
    }

    if (isEditing && editingListId) {
      await updateDistributionList({
        id: editingListId,
        name: formData.name,
        description: formData.description,
        scope: formData.scope,
        attendeeIds: formData.selectedAttendeeIds
      });
    } else {
      await createDistributionList({
        name: formData.name,
        description: formData.description,
        scope: formData.scope,
        practiceId,
        attendeeIds: formData.selectedAttendeeIds
      });
    }

    resetForm();
  };

  const toggleAttendee = (attendeeId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedAttendeeIds: prev.selectedAttendeeIds.includes(attendeeId)
        ? prev.selectedAttendeeIds.filter(id => id !== attendeeId)
        : [...prev.selectedAttendeeIds, attendeeId]
    }));
  };

  // Only show attendees with email addresses for distribution lists
  const emailAttendees = attendees.filter(a => a.email);

  return (
    <div className="space-y-4">
      {/* Info Card */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium mb-1">Distribution Lists</p>
              <p className="text-muted-foreground">
                Create email groups to quickly send meeting minutes to multiple recipients. 
                Only attendees with email addresses can be added.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Button */}
      {!isCreating && (
        <Button onClick={handleCreate} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Create Distribution List
        </Button>
      )}

      {/* Create/Edit Form */}
      {isCreating && (
        <Card className="border-primary/50">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">
                {isEditing ? 'Edit Distribution List' : 'New Distribution List'}
              </h4>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="list-name">List Name *</Label>
                <Input
                  id="list-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Partners Meeting, Clinical Team"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="list-description">Description</Label>
                <Textarea
                  id="list-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description..."
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  {formData.scope === 'global' ? (
                    <Globe className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Building2 className="h-4 w-4 text-green-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {formData.scope === 'global' ? 'Global List' : 'Practice List'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formData.scope === 'global' 
                        ? 'Available across all your practices' 
                        : 'Only visible to this practice'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.scope === 'global'}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, scope: checked ? 'global' : 'local' })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Select Members ({formData.selectedAttendeeIds.length} selected)</Label>
                <div className="max-h-[200px] overflow-y-auto space-y-1 border rounded-md p-2">
                  {emailAttendees.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No attendees with email addresses. Add email addresses to attendees first.
                    </p>
                  ) : (
                    emailAttendees.map(attendee => {
                      const isSelected = formData.selectedAttendeeIds.includes(attendee.id);
                      return (
                        <div
                          key={attendee.id}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                          }`}
                          onClick={() => toggleAttendee(attendee.id)}
                        >
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleAttendee(attendee.id)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {attendee.title ? `${attendee.title} ` : ''}{attendee.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{attendee.email}</p>
                          </div>
                          {attendee.scope === 'global' && (
                            <Badge variant="outline" className="text-xs shrink-0 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                              <Globe className="h-3 w-3 mr-1" />
                              Global
                            </Badge>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                <Check className="h-4 w-4 mr-2" />
                {isEditing ? 'Update' : 'Create'} List
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Lists */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Loading distribution lists...
          </CardContent>
        </Card>
      ) : distributionLists.length === 0 && !isCreating ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No distribution lists yet.</p>
            <p className="text-sm">Create one to quickly email meeting minutes to groups.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {distributionLists.map(list => {
            const isExpanded = expandedListId === list.id;
            const memberEmails = list.members
              .map(m => m.attendee?.email)
              .filter(Boolean);

            return (
              <Card key={list.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => setExpandedListId(isExpanded ? null : list.id)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{list.name}</h4>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            list.scope === 'global' 
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' 
                              : 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                          }`}
                        >
                          {list.scope === 'global' ? (
                            <><Globe className="h-3 w-3 mr-1" />Global</>
                          ) : (
                            <><Building2 className="h-3 w-3 mr-1" />Local</>
                          )}
                        </Badge>
                      </div>
                      {list.description && (
                        <p className="text-sm text-muted-foreground mb-2">{list.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{list.members.length} members</span>
                        <span>•</span>
                        <Mail className="h-3 w-3" />
                        <span>{memberEmails.length} emails</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(list)}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(list.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && list.members.length > 0 && (
                    <div className="mt-3 pt-3 border-t space-y-1">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Members:</p>
                      {list.members.map(member => (
                        <div key={member.id} className="flex items-center gap-2 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {member.attendee?.title ? `${member.attendee.title} ` : ''}
                            {member.attendee?.name}
                          </span>
                          <span className="text-muted-foreground">
                            ({member.attendee?.email})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
