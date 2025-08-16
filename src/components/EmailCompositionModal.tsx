import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Users, Send, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface EmailCompositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiContent: string;
  userEmail?: string;
}

interface PracticeUser {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
}

export const EmailCompositionModal: React.FC<EmailCompositionModalProps> = ({
  isOpen,
  onClose,
  aiContent,
  userEmail = ''
}) => {
  const [toEmail, setToEmail] = useState(userEmail);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');
  const [subject, setSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [practiceUsers, setPracticeUsers] = useState<PracticeUser[]>([]);
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<PracticeUser[]>([]);

  // Auto-generate subject line based on AI content
  useEffect(() => {
    if (aiContent && !subject) {
      const firstLine = aiContent.split('\n')[0];
      let autoSubject = 'AI Generated Response';
      
      // Try to extract a meaningful subject from the content
      if (firstLine.length > 10 && firstLine.length < 100) {
        autoSubject = firstLine.replace(/[#*]/g, '').trim();
      } else if (aiContent.includes('NHS') || aiContent.includes('healthcare')) {
        autoSubject = 'NHS Healthcare Information';
      } else if (aiContent.includes('prescription') || aiContent.includes('medication')) {
        autoSubject = 'Prescription & Medication Information';
      } else if (aiContent.includes('patient') || aiContent.includes('consultation')) {
        autoSubject = 'Patient Consultation Information';
      }
      
      setSubject(autoSubject);
    }
  }, [aiContent, subject]);

  // Set initial email body with AI content
  useEffect(() => {
    if (aiContent && !emailBody) {
      const formattedBody = `Dear Colleague,

Please find below the AI-generated information you requested:

---

${aiContent}

---

Best regards,
${userEmail ? userEmail.split('@')[0] : 'Your Name'}`;
      setEmailBody(formattedBody);
    }
  }, [aiContent, emailBody, userEmail]);

  // Fetch practice users for CC suggestions
  useEffect(() => {
    const fetchPracticeUsers = async () => {
      try {
        const { data: currentUser } = await supabase.auth.getUser();
        if (!currentUser.user) return;

        // Get user's practice associations
        const { data: userPractices } = await supabase
          .from('user_roles')
          .select('practice_id')
          .eq('user_id', currentUser.user.id);

        if (!userPractices || userPractices.length === 0) return;

        const practiceIds = userPractices.map(up => up.practice_id);

        // Get all users in the same practices
        const { data: practiceMembers } = await supabase
          .from('user_roles')
          .select(`
            user_id,
            role,
            practices (name)
          `)
          .in('practice_id', practiceIds);

        if (practiceMembers) {
          // Get user profiles for the practice members
          const userIds = [...new Set(practiceMembers.map(pm => pm.user_id))];
          
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email, full_name')
            .in('id', userIds);

          if (profiles) {
            const usersWithRoles = profiles.map(profile => {
              const userRole = practiceMembers.find(pm => pm.user_id === profile.id);
              return {
                ...profile,
                role: userRole?.role || 'user'
              };
            }).filter(user => user.email && user.email !== userEmail); // Exclude current user

            setPracticeUsers(usersWithRoles);
          }
        }
      } catch (error) {
        console.error('Error fetching practice users:', error);
      }
    };

    if (isOpen) {
      fetchPracticeUsers();
    }
  }, [isOpen, userEmail]);

  // Filter users based on CC input
  useEffect(() => {
    if (ccInput.trim()) {
      const filtered = practiceUsers.filter(user =>
        user.email.toLowerCase().includes(ccInput.toLowerCase()) ||
        (user.full_name && user.full_name.toLowerCase().includes(ccInput.toLowerCase()))
      );
      setFilteredUsers(filtered);
      setShowUserSuggestions(filtered.length > 0);
    } else {
      setFilteredUsers([]);
      setShowUserSuggestions(false);
    }
  }, [ccInput, practiceUsers]);

  const handleAddCcEmail = (email: string) => {
    if (email && !ccEmails.includes(email) && email !== toEmail) {
      setCcEmails([...ccEmails, email]);
      setCcInput('');
      setShowUserSuggestions(false);
    }
  };

  const handleRemoveCcEmail = (emailToRemove: string) => {
    setCcEmails(ccEmails.filter(email => email !== emailToRemove));
  };

  const handleCcInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && ccInput.trim()) {
      e.preventDefault();
      if (ccInput.includes('@')) {
        handleAddCcEmail(ccInput.trim());
      }
    }
  };

  const handleSendEmail = () => {
    // TODO: Implement actual email sending
    console.log('Email data:', {
      to: toEmail,
      cc: ccEmails,
      subject,
      body: emailBody
    });
    
    // For now, just show a placeholder message
    alert('Email composition complete! Backend integration will be implemented later.');
    onClose();
  };

  const resetForm = () => {
    setToEmail(userEmail);
    setCcEmails([]);
    setCcInput('');
    setSubject('');
    setEmailBody('');
    setShowUserSuggestions(false);
  };

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, userEmail]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 bg-background border border-border z-50">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Compose Email
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 pb-6">
            {/* To Field */}
            <div className="space-y-2">
              <Label htmlFor="to-email">To</Label>
              <Input
                id="to-email"
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="recipient@example.com"
                className="w-full"
              />
            </div>

            {/* CC Field with Practice User Lookup */}
            <div className="space-y-2">
              <Label htmlFor="cc-email" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                CC (Add colleagues from your practice)
              </Label>
              
              {/* CC Email Tags */}
              {ccEmails.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 bg-muted rounded-md">
                  {ccEmails.map((email, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {email}
                      <button
                        onClick={() => handleRemoveCcEmail(email)}
                        className="hover:bg-destructive/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* CC Input with Suggestions */}
              <div className="relative">
                <Input
                  id="cc-email"
                  type="email"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyPress={handleCcInputKeyPress}
                  placeholder="Start typing email or name..."
                  className="w-full"
                />
                
                {/* User Suggestions Dropdown */}
                {showUserSuggestions && filteredUsers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleAddCcEmail(user.email)}
                        className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium text-sm">{user.full_name || user.email}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                        {user.role && (
                          <Badge variant="outline" className="text-xs">
                            {user.role}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Manual CC Add Button */}
              {ccInput.includes('@') && !showUserSuggestions && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddCcEmail(ccInput)}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add {ccInput}
                </Button>
              )}
            </div>

            {/* Subject Field */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject..."
                className="w-full"
              />
            </div>

            {/* Email Body */}
            <div className="space-y-2">
              <Label htmlFor="email-body">Message</Label>
              <Textarea
                id="email-body"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Compose your email..."
                className="min-h-[300px] w-full resize-none"
              />
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 pt-0 border-t">
          <div className="text-sm text-muted-foreground">
            {practiceUsers.length > 0 && (
              <span>{practiceUsers.length} practice colleagues available for CC</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendEmail}
              disabled={!toEmail || !subject || !emailBody}
              className="flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Send Email
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};