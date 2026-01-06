import React, { useState, useEffect, useMemo } from 'react';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Mail, Loader2, Users, Search, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { stripMarkdown } from '@/utils/stripMarkdown';

// Text to strip from content
const CONTENT_PREFIX_TO_REMOVE = "Thank you for using our AI consultation service. Here is the information generated for you:";

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
  const [subject, setSubject] = useState('');
  const [isGeneratingSubject, setIsGeneratingSubject] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [showAdditionalNotes, setShowAdditionalNotes] = useState(false);
  const [includeWordDoc, setIncludeWordDoc] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Clean content: strip markdown and remove boilerplate prefix
  const cleanedContent = useMemo(() => {
    let content = stripMarkdown(messageContent);
    // Remove the boilerplate prefix if present
    if (content.startsWith(CONTENT_PREFIX_TO_REMOVE)) {
      content = content.slice(CONTENT_PREFIX_TO_REMOVE.length).trim();
    }
    return content;
  }, [messageContent]);

  // Generate AI subject when modal opens
  useEffect(() => {
    const generateSubject = async () => {
      if (!isOpen || !messageContent || subject) return;
      
      setIsGeneratingSubject(true);
      try {
        // Use a simple extraction approach - take first meaningful line or generate summary
        const lines = cleanedContent.split('\n').filter(l => l.trim().length > 10);
        
        if (lines.length > 0) {
          // Take first meaningful line and truncate
          let autoSubject = lines[0].trim();
          if (autoSubject.length > 60) {
            autoSubject = autoSubject.substring(0, 57) + '...';
          }
          setSubject(autoSubject);
        } else {
          setSubject('AI4PM Chat Summary');
        }
      } catch (error) {
        console.error('Error generating subject:', error);
        setSubject('AI4PM Chat Summary');
      } finally {
        setIsGeneratingSubject(false);
      }
    };

    generateSubject();
  }, [isOpen, cleanedContent]);

  // Get clean content for email

  // Fetch team members from the same practice
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!user?.id || !isOpen) return;

      setIsLoading(true);
      try {
        // Get current user's practice_id (user can have multiple roles/rows)
        const { data: userRoles, error: roleError } = await supabase
          .from('user_roles')
          .select('practice_id')
          .eq('user_id', user.id);

        if (roleError) {
          console.error('Error fetching user roles:', roleError);
          setTeamMembers([]);
          return;
        }

        const practiceId = userRoles?.find(r => r.practice_id)?.practice_id;

        if (!practiceId) {
          console.log('User not assigned to a practice');
          setTeamMembers([]);
          return;
        }
        // Fetch all users in the same practice
        const { data: practiceMembers, error: membersError } = await supabase
          .from('user_roles')
          .select('user_id, practice_role')
          .eq('practice_id', practiceId);

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
          chatContent: cleanedContent,
          senderName,
          additionalNotes: additionalNotes.trim() || undefined,
          includeWordDoc,
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
    setSubject('');
    setAdditionalNotes('');
    setShowAdditionalNotes(false);
    setIncludeWordDoc(true);
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
      <DialogContent 
        className="sm:max-w-[650px] max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col"
        style={{ 
          resize: 'both', 
          minWidth: '450px', 
          minHeight: '550px',
          overflow: 'auto'
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Email to Team Members
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2">
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
                        onCheckedChange={(checked) => {
                          // Prevent double-toggle from parent onClick
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMember(member.user_id);
                        }}
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

          <Collapsible open={showAdditionalNotes} onOpenChange={setShowAdditionalNotes}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                <span className="text-sm font-medium">Additional Notes (optional)</span>
                {showAdditionalNotes ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <Textarea
                id="notes"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Add any context or notes for the recipients..."
                className="min-h-[60px]"
              />
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-2">
            <Label>Content Preview</Label>
            <ScrollArea className="h-[250px] rounded-lg border overflow-hidden">
              <div className="bg-white dark:bg-zinc-900">
                {/* Email-style header */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4">
                  <h3 className="text-base font-semibold m-0">AI4PM Chat Summary</h3>
                  <p className="text-sm opacity-90 mt-1">Shared by {senderName}</p>
                </div>
                {/* Email-style content */}
                <div className="p-4 bg-gray-50 dark:bg-zinc-800/50">
                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-md border border-gray-200 dark:border-zinc-700 text-sm leading-relaxed">
                    {cleanedContent.split('\n').map((line, index) => (
                      <p key={index} className={`${line.trim() ? 'mb-2' : 'mb-4'} text-foreground`}>
                        {line || '\u00A0'}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Word Doc attachment toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="include-word-doc" className="cursor-pointer">
                Include Word document attachment
              </Label>
            </div>
            <Switch
              id="include-word-doc"
              checked={includeWordDoc}
              onCheckedChange={setIncludeWordDoc}
            />
          </div>
        </div>
        </ScrollArea>

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
