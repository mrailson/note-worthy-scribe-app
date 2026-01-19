import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Clock, CheckCircle, AlertCircle, Trash2, Users, Plus, Edit, Sparkles, Loader2 } from "lucide-react";

interface RequestInformationPanelProps {
  complaintId: string;
  practiceId?: string | null;
  disabled?: boolean;
}

// Uses the secure view which excludes access_token for security
interface InvolvedParty {
  id: string;
  staff_name: string;
  staff_email: string;
  staff_role: string;
  response_text: string | null;
  response_submitted_at: string | null;
  response_requested_at: string;
  access_token_expires_at: string;
  access_token_last_used_at: string;
  complaint_id: string;
  created_at: string;
  // From secure view - token status without exposing actual token
  has_access_token: boolean;
  token_status: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  is_active: boolean;
}

export function RequestInformationPanel({ complaintId, practiceId, disabled = false }: RequestInformationPanelProps) {
  const [parties, setParties] = useState<InvolvedParty[]>([]);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [newParty, setNewParty] = useState({
    name: "",
    email: "",
    role: "",
    notes: "",
  });
  const [sending, setSending] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<string>("");
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddTeamDialog, setShowAddTeamDialog] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [newTeamMember, setNewTeamMember] = useState({
    name: "",
    email: "",
    role: "",
    phone: "",
  });
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);

  useEffect(() => {
    fetchInvolvedParties();
    fetchTeamMembers();

    const channel = supabase
      .channel('involved-parties-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'complaint_involved_parties',
          filter: `complaint_id=eq.${complaintId}`,
        },
        () => {
          fetchInvolvedParties();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [complaintId]);

  const fetchTeamMembers = async () => {
    try {
      // Filter by practice if provided, else fall back to user-owned rows
      if (practiceId) {
        const { data, error } = await supabase
          .from('complaint_team_members')
          .select('*')
          .eq('practice_id', practiceId)
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setTeamMembers(data || []);
      } else {
        // fallback: show user's own members
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from('complaint_team_members')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
        setTeamMembers(data || []);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const fetchInvolvedParties = async () => {
    try {
      // Use secure view that excludes access_token to prevent token exposure
      const { data, error } = await supabase
        .from('complaint_involved_parties_secure')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('response_requested_at', { ascending: false });

      if (error) throw error;
      setParties(data || []);
    } catch (error) {
      console.error('Error fetching involved parties:', error);
      toast.error('Failed to load information requests');
    }
  };

  const handleSelectTeamMember = (memberId: string) => {
    const member = teamMembers.find(m => m.id === memberId);
    if (member) {
      setNewParty({
        name: member.name,
        email: member.email,
        role: member.role,
        notes: "",
      });
      setSelectedTeamMemberId(memberId);
    }
  };

  const handleAddTeamMember = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('complaint_team_members')
        .insert({
          user_id: user.id,
          practice_id: practiceId ?? null,
          name: newTeamMember.name,
          email: newTeamMember.email,
          role: newTeamMember.role,
          phone: newTeamMember.phone || null,
        });

      if (error) throw error;

      setNewTeamMember({ name: "", email: "", role: "", phone: "" });
      setShowAddTeamDialog(false);
      fetchTeamMembers();
    } catch (error) {
      console.error('Error adding team member:', error);
      toast.error("Failed to add team member. Please try again.");
    }
  };

  const handleEditTeamMember = async () => {
    if (!editingMember) return;

    try {
      const { error } = await supabase
        .from('complaint_team_members')
        .update({
          name: editingMember.name,
          email: editingMember.email,
          role: editingMember.role,
          phone: editingMember.phone,
        })
        .eq('id', editingMember.id);

      if (error) throw error;

      setEditingMember(null);
      setShowEditDialog(false);
      fetchTeamMembers();
    } catch (error) {
      console.error('Error updating team member:', error);
      toast.error("Failed to update team member. Please try again.");
    }
  };

  const handleDeleteTeamMember = async (id: string) => {
    // Close any confirmation UI immediately to avoid modal/focus lock issues
    setDeleteConfirmId(null);

    try {
      const { error } = await supabase
        .from('complaint_team_members')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      fetchTeamMembers();
    } catch (error) {
      console.error('Error deleting team member:', error);
      toast.error("Failed to remove team member. Please try again.");
    }
  };

  const handleSendRequest = async () => {
    if (!newParty.name || !newParty.email || !newParty.role) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-complaint-notifications', {
        body: {
          complaintId: complaintId,
          involvedParties: [{
            staffName: newParty.name,
            staffEmail: newParty.email,
            staffRole: newParty.role,
            notes: newParty.notes || null
          }]
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      const emailResults = data?.emailResults || [];
      const failedEmails = emailResults.filter((result: any) => result.status === 'failed');
      
      if (failedEmails.length > 0) {
        console.error('Failed emails:', failedEmails);
        throw new Error('Failed to send information request email');
      }

      setNewParty({ name: "", email: "", role: "", notes: "" });
      setSelectedTeamMemberId("");
      setShowRequestDialog(false);
      fetchInvolvedParties();
    } catch (error) {
      console.error('Error sending request:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send information request');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteRequest = async (partyId: string) => {
    try {
      const { error } = await supabase
        .from('complaint_involved_parties')
        .delete()
        .eq('id', partyId);

      if (error) throw error;

      fetchInvolvedParties();
    } catch (error) {
      console.error('Error deleting request:', error);
      toast.error('Failed to delete request');
    }
  };

  const handleLoadDemo = async () => {
    if (!newParty.name || !newParty.role) {
      toast.error('Please select a name and role first');
      return;
    }

    setIsGeneratingDemo(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-staff-demo-notes', {
        body: {
          complaintId,
          staffRole: newParty.role,
          staffName: newParty.name
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.notes) {
        setNewParty({ ...newParty, notes: data.notes });
        toast.success(`Demo notes loaded for ${newParty.role}`);
      } else {
        throw new Error('No notes generated');
      }
    } catch (error) {
      console.error('Error generating demo notes:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate demo notes');
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  const getStatusBadge = (party: InvolvedParty) => {
    const daysSinceSent = Math.floor(
      (new Date().getTime() - new Date(party.response_requested_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (party.response_submitted_at) {
      return (
        <Badge variant="default" className="flex items-center gap-1 bg-green-500 hover:bg-green-600">
          <CheckCircle className="h-3 w-3" />
          Responded
        </Badge>
      );
    }

    if (daysSinceSent > 5) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Overdue
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    );
  };

  return (
    <>
      <Card className="border-primary/20 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Request Information/Feedback
            </CardTitle>
            {!disabled && (
              <Button onClick={() => setShowRequestDialog(true)} size="lg" className="gap-2">
                <Mail className="h-5 w-5" />
                Request Information/Feedback
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {parties.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No information requests sent yet</p>
              <p className="text-sm mt-1">Click "Request Information/Feedback" to send your first request</p>
            </div>
          ) : (
            <div className="space-y-3">
              {parties.map((party) => (
                <div key={party.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-64">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{party.staff_name}</span>
                        {getStatusBadge(party)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {party.staff_role}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {party.staff_email}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        Requested: {new Date(party.response_requested_at).toLocaleDateString('en-GB', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      {party.response_submitted_at && (
                        <div className="text-xs text-green-600 mt-1">
                          Responded: {new Date(party.response_submitted_at).toLocaleDateString('en-GB', { 
                            day: 'numeric', 
                            month: 'short', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {party.response_submitted_at ? (
                        <div>
                          <div className="text-sm font-medium text-muted-foreground mb-2">
                            Response received on {new Date(party.response_submitted_at).toLocaleDateString('en-GB', { 
                              day: 'numeric', 
                              month: 'long', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}:
                          </div>
                          <div className="p-3 bg-background rounded border text-sm whitespace-pre-wrap">
                            {party.response_text}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          {!disabled && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteRequest(party.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete Request
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showRequestDialog} onOpenChange={(open) => {
        setShowRequestDialog(open);
        if (!open) {
          setNewParty({ name: "", email: "", role: "", notes: "" });
          setSelectedTeamMemberId("");
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4">
            <DialogTitle>Request Information from Staff Member</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="request" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="request" className="gap-2">
                <Mail className="h-4 w-4" />
                Request Information/Feedback
              </TabsTrigger>
              <TabsTrigger value="team" className="gap-2">
                <Users className="h-4 w-4" />
                Manage Team
              </TabsTrigger>
            </TabsList>

            <TabsContent value="request" className="space-y-6 px-6 py-1">
              {teamMembers.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="quick-select">Quick Select from Team</Label>
                  <Select
                    value={selectedTeamMemberId}
                    onValueChange={handleSelectTeamMember}
                  >
                    <SelectTrigger id="quick-select">
                      <SelectValue placeholder="Select a team member..." />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name} - {member.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={newParty.name}
                  onChange={(e) => setNewParty({ ...newParty, name: e.target.value })}
                  placeholder="Enter staff member's name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={newParty.role}
                  onValueChange={(value) => setNewParty({ ...newParty, role: value })}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Reception Team">Reception Team</SelectItem>
                    <SelectItem value="GP Partner">GP Partner</SelectItem>
                    <SelectItem value="GP Salaried">GP Salaried</SelectItem>
                    <SelectItem value="GP Trainee">GP Trainee</SelectItem>
                    <SelectItem value="Practice Nurse">Practice Nurse</SelectItem>
                    <SelectItem value="Practice Manager">Practice Manager</SelectItem>
                    <SelectItem value="ARRS Staff">ARRS Staff</SelectItem>
                    <SelectItem value="Admin Team">Admin Team</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newParty.email}
                  onChange={(e) => setNewParty({ ...newParty, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="notes">Additional Notes (Optional)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadDemo}
                    disabled={isGeneratingDemo || !newParty.name || !newParty.role}
                    className="h-8 gap-1.5 text-xs"
                  >
                    {isGeneratingDemo ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        Load Demo
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  id="notes"
                  value={newParty.notes}
                  onChange={(e) => setNewParty({ ...newParty, notes: e.target.value })}
                  placeholder="Any specific questions or context..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRequestDialog(false);
                    setNewParty({ name: "", email: "", role: "", notes: "" });
                    setSelectedTeamMemberId("");
                  }}
                  disabled={sending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendRequest}
                  disabled={!newParty.name || !newParty.email || !newParty.role || sending}
                >
                  {sending ? "Sending..." : "Send Request"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="team" className="space-y-6 px-6 py-1">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Manage your practice team members for quick selection
                </p>
                <Button
                  onClick={() => setShowAddTeamDialog(true)}
                  size="sm"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Member
                </Button>
              </div>

              {teamMembers.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">No team members yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add your first team member to enable quick selection
                  </p>
                  <Button
                    onClick={() => setShowAddTeamDialog(true)}
                    size="sm"
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Team Member
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{member.name}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {member.role}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                        {member.phone && (
                          <p className="text-sm text-muted-foreground">{member.phone}</p>
                        )}
                      </div>
                      {deleteConfirmId === member.id ? (
                        <div className="flex flex-col items-end gap-2">
                          <p className="text-xs text-muted-foreground">Remove this member?</p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteTeamMember(member.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingMember(member);
                              setShowEditDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmId(member.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddTeamDialog} onOpenChange={setShowAddTeamDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Name *</Label>
              <Input
                id="new-name"
                value={newTeamMember.name}
                onChange={(e) => setNewTeamMember({ ...newTeamMember, name: e.target.value })}
                placeholder="Enter name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-role">Role *</Label>
              <Select
                value={newTeamMember.role}
                onValueChange={(value) => setNewTeamMember({ ...newTeamMember, role: value })}
              >
                <SelectTrigger id="new-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Reception Team">Reception Team</SelectItem>
                  <SelectItem value="GP Partner">GP Partner</SelectItem>
                  <SelectItem value="GP Salaried">GP Salaried</SelectItem>
                  <SelectItem value="GP Trainee">GP Trainee</SelectItem>
                  <SelectItem value="Practice Nurse">Practice Nurse</SelectItem>
                  <SelectItem value="Practice Manager">Practice Manager</SelectItem>
                  <SelectItem value="ARRS Staff">ARRS Staff</SelectItem>
                  <SelectItem value="Admin Team">Admin Team</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Email *</Label>
              <Input
                id="new-email"
                type="email"
                value={newTeamMember.email}
                onChange={(e) => setNewTeamMember({ ...newTeamMember, email: e.target.value })}
                placeholder="Enter email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-phone">Phone (Optional)</Label>
              <Input
                id="new-phone"
                value={newTeamMember.phone}
                onChange={(e) => setNewTeamMember({ ...newTeamMember, phone: e.target.value })}
                placeholder="Enter phone number"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddTeamDialog(false);
                setNewTeamMember({ name: "", email: "", role: "", phone: "" });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddTeamMember}
              disabled={!newTeamMember.name || !newTeamMember.email || !newTeamMember.role}
            >
              Add Member
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
          </DialogHeader>
          {editingMember && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={editingMember.name}
                  onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role *</Label>
                <Select
                  value={editingMember.role}
                  onValueChange={(value) => setEditingMember({ ...editingMember, role: value })}
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Reception Team">Reception Team</SelectItem>
                    <SelectItem value="GP Partner">GP Partner</SelectItem>
                    <SelectItem value="GP Salaried">GP Salaried</SelectItem>
                    <SelectItem value="GP Trainee">GP Trainee</SelectItem>
                    <SelectItem value="Practice Nurse">Practice Nurse</SelectItem>
                    <SelectItem value="Practice Manager">Practice Manager</SelectItem>
                    <SelectItem value="ARRS Staff">ARRS Staff</SelectItem>
                    <SelectItem value="Admin Team">Admin Team</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingMember.email}
                  onChange={(e) => setEditingMember({ ...editingMember, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone (Optional)</Label>
                <Input
                  id="edit-phone"
                  value={editingMember.phone || ""}
                  onChange={(e) => setEditingMember({ ...editingMember, phone: e.target.value })}
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowEditDialog(false);
                setEditingMember(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleEditTeamMember}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}