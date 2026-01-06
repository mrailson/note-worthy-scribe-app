import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Mail, Loader2, Users, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface TeamMember {
  user_id: string;
  email: string;
  full_name: string | null;
  practice_role: string | null;
}

interface EmailToTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageContent: string;
  senderName: string;
}

export const EmailToTeamModal: React.FC<EmailToTeamModalProps> = ({
  isOpen,
  onClose,
  messageContent,
  senderName,
}) => {
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [subject, setSubject] = useState('AI4PM Chat Summary');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch team members from the same practice
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!user?.id || !isOpen) return;

      setIsLoading(true);
      try {
        // First get the current user's practice_id
        const { data: userRole, error: roleError } = await supabase
          .from('user_roles')
          .select('practice_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (roleError) {
          console.error('Error fetching user role:', roleError);
          setTeamMembers([]);
          return;
        }

        if (!userRole?.practice_id) {
          console.log('User not assigned to a practice');
          setTeamMembers([]);
          return;
        }

        // Fetch all users in the same practice
        const { data: practiceMembers, error: membersError } = await supabase
          .from('user_roles')
          .select('user_id, practice_role')
          .eq('practice_id', userRole.practice_id)
          .neq('user_id', user.id); // Exclude current user

        if (membersError) {
          console.error('Error fetching practice members:', membersError);
          setTeamMembers([]);
          return;
        }

        if (!practiceMembers || practiceMembers.length === 0) {
          setTeamMembers([]);
          return;
        }

        // Fetch profile details for each member using user_id (which references auth.users.id)
        const userIds = practiceMembers.map(m => m.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, user_id, email, full_name')
          .in('user_id', userIds);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
          setTeamMembers([]);
          return;
        }

        // Combine the data - match on user_id field
        const members: TeamMember[] = practiceMembers.map(member => {
          const profile = profiles?.find(p => p.user_id === member.user_id);
          return {
            user_id: member.user_id,
            email: profile?.email || '',
            full_name: profile?.full_name || null,
            practice_role: member.practice_role,
          };
        }).filter(m => m.email); // Only include members with emails

        setTeamMembers(members);
      } catch (error) {
        console.error('Error fetching team members:', error);
        setTeamMembers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeamMembers();
  }, [user?.id, isOpen]);

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAll = () => {
    const filteredIds = filteredMembers.map(m => m.user_id);
    setSelectedMembers(prev => {
      const allSelected = filteredIds.every(id => prev.includes(id));
      if (allSelected) {
        return prev.filter(id => !filteredIds.includes(id));
      } else {
        return [...new Set([...prev, ...filteredIds])];
      }
    });
  };

  const handleSend = async () => {
    if (selectedMembers.length === 0) {
      toast.error('Please select at least one team member');
      return;
    }

    const selectedEmails = teamMembers
      .filter(m => selectedMembers.includes(m.user_id))
      .map(m => m.email);

    if (selectedEmails.length === 0) {
      toast.error('No valid email addresses found');
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-chat-email', {
        body: {
          recipientEmails: selectedEmails,
          subject,
          chatContent: messageContent,
          senderName,
          additionalNotes: additionalNotes.trim() || undefined,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Email sent to ${selectedEmails.length} team member${selectedEmails.length > 1 ? 's' : ''}`);
        handleClose();
      } else {
        throw new Error(data?.error || 'Failed to send email');
      }
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error(error.message || 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setSelectedMembers([]);
    setSubject('AI4PM Chat Summary');
    setAdditionalNotes('');
    setSearchQuery('');
    onClose();
  };

  const filteredMembers = teamMembers.filter(member => {
    const search = searchQuery.toLowerCase();
    return (
      member.email.toLowerCase().includes(search) ||
      (member.full_name?.toLowerCase().includes(search) ?? false) ||
      (member.practice_role?.toLowerCase().includes(search) ?? false)
    );
  });

  const formatRole = (role: string | null) => {
    if (!role) return 'Team Member';
    return role.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Email to Team Members
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Team member selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Recipients</Label>
              {teamMembers.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="text-xs h-7"
                >
                  {filteredMembers.every(m => selectedMembers.includes(m.user_id)) 
                    ? 'Deselect All' 
                    : 'Select All'}
                </Button>
              )}
            </div>
            
            {teamMembers.length > 3 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search team members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}

            <ScrollArea className="h-[200px] border rounded-md p-2">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                  <Users className="w-8 h-8 mb-2 opacity-50" />
                  {teamMembers.length === 0 
                    ? 'No team members found in your practice'
                    : 'No matching team members'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredMembers.map((member) => (
                    <div
                      key={member.user_id}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent transition-colors ${
                        selectedMembers.includes(member.user_id) ? 'bg-accent' : ''
                      }`}
                      onClick={() => toggleMember(member.user_id)}
                    >
                      <Checkbox
                        checked={selectedMembers.includes(member.user_id)}
                        onCheckedChange={() => toggleMember(member.user_id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {member.full_name || member.email}
                        </div>
                        {member.full_name && (
                          <div className="text-xs text-muted-foreground truncate">
                            {member.email}
                          </div>
                        )}
                      </div>
                      {member.practice_role && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {formatRole(member.practice_role)}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            
            {selectedMembers.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {selectedMembers.length} recipient{selectedMembers.length > 1 ? 's' : ''} selected
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (optional)</Label>
            <Textarea
              id="notes"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Add any context or notes for the recipients..."
              className="min-h-[60px]"
            />
          </div>

          <div className="space-y-2">
            <Label>Content Preview</Label>
            <div className="bg-muted/50 p-3 rounded-md max-h-[100px] overflow-y-auto text-sm text-muted-foreground whitespace-pre-wrap">
              {messageContent.length > 300 
                ? messageContent.substring(0, 300) + '...' 
                : messageContent || 'No content to preview'}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || selectedMembers.length === 0}>
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
