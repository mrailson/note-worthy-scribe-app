import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Send, UserPlus, Eye, Clock, CheckCircle, AlertCircle, Trash2, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface RequestInformationPanelProps {
  complaintId: string;
  disabled?: boolean;
}

interface InvolvedParty {
  id: string;
  staff_name: string;
  staff_email: string;
  staff_role: string;
  response_text: string | null;
  response_submitted_at: string | null;
  response_requested_at: string;
  access_token: string;
  access_token_expires_at: string;
  access_token_last_used_at: string;
  complaint_id: string;
  created_at: string;
}

export function RequestInformationPanel({ complaintId, disabled = false }: RequestInformationPanelProps) {
  const [parties, setParties] = useState<InvolvedParty[]>([]);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [newParty, setNewParty] = useState({
    name: '',
    email: '',
    role: '',
    notes: ''
  });
  const [sending, setSending] = useState(false);
  const [expandedResponses, setExpandedResponses] = useState<Set<string>>(new Set());

  const toggleResponseExpanded = (partyId: string) => {
    setExpandedResponses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(partyId)) {
        newSet.delete(partyId);
      } else {
        newSet.add(partyId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    fetchInvolvedParties();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('involved-parties-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'complaint_involved_parties',
          filter: `complaint_id=eq.${complaintId}`
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

  const fetchInvolvedParties = async () => {
    try {
      const { data, error } = await supabase
        .from('complaint_involved_parties')
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

  const handleSendRequest = async () => {
    if (!newParty.name || !newParty.email || !newParty.role) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSending(true);
    try {
      // Call the edge function to send the email
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

      // Check email results
      const emailResults = data?.emailResults || [];
      const failedEmails = emailResults.filter((result: any) => result.status === 'failed');
      
      if (failedEmails.length > 0) {
        console.error('Failed emails:', failedEmails);
        throw new Error('Failed to send information request email');
      }

      toast.success('Information request sent successfully');
      setShowRequestDialog(false);
      setNewParty({ name: '', email: '', role: '', notes: '' });
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

      toast.success('Request deleted successfully');
      fetchInvolvedParties();
    } catch (error) {
      console.error('Error deleting request:', error);
      toast.error('Failed to delete request');
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
    <Card className="border-primary/20 shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Request Information
          </CardTitle>
          {!disabled && (
            <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2">
                  <UserPlus className="h-5 w-5" />
                  Request Information
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Request Information from Staff Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={newParty.name}
                      onChange={(e) => setNewParty(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Dr. Smith, Reception Team"
                    />
                  </div>

                  <div>
                    <Label htmlFor="role">Role *</Label>
                    <Select value={newParty.role} onValueChange={(value) => setNewParty(prev => ({ ...prev, role: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Reception Team">Reception Team</SelectItem>
                        <SelectItem value="GP Partner">GP Partner</SelectItem>
                        <SelectItem value="GP">GP</SelectItem>
                        <SelectItem value="Practice Nurse">Practice Nurse</SelectItem>
                        <SelectItem value="Practice Manager">Practice Manager</SelectItem>
                        <SelectItem value="Healthcare Assistant">Healthcare Assistant</SelectItem>
                        <SelectItem value="Other Clinician">Other Clinician</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newParty.email}
                      onChange={(e) => setNewParty(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@example.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="notes">Specific Questions (Optional)</Label>
                    <Textarea
                      id="notes"
                      value={newParty.notes}
                      onChange={(e) => setNewParty(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Any specific questions or areas to focus on..."
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSendRequest} 
                      disabled={sending || !newParty.name || !newParty.email || !newParty.role}
                      className="flex-1"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {sending ? 'Sending...' : 'Send Request'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowRequestDialog(false)}
                      disabled={sending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {parties.length === 0 ? (
          <div className="text-centre py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No information requests sent yet</p>
            <p className="text-sm mt-1">Click "Request Information" to send your first request</p>
          </div>
        ) : (
          <div className="space-y-3">
            {parties.map((party) => {
              const isExpanded = expandedResponses.has(party.id);
              return (
                <div key={party.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colours">
                  <div className="flex items-start gap-4">
                    {/* Left side - Staff info */}
                    <div className="flex-shrink-0 w-64">
                      <div className="flex items-centre gap-2 mb-1">
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

                    {/* Right side - Response or action buttons */}
                    <div className="flex-1 min-w-0">
                      {party.response_submitted_at ? (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-muted-foreground">Response:</span>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => toggleResponseExpanded(party.id)}
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-4 w-4 mr-1" />
                                  Show Less
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4 mr-1" />
                                  Show More
                                </>
                              )}
                            </Button>
                          </div>
                          <div className={`p-3 bg-background rounded border text-sm whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-3'}`}>
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
              );
            })}
          </div>
        )}
      </CardContent>

    </Card>
  );
}
