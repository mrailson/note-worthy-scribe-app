import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Share2, Mail, Users, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastWrapper';

interface ShareMeetingDialogProps {
  meetingId: string;
  meetingTitle: string;
  children: React.ReactNode;
}

export function ShareMeetingDialog({ meetingId, meetingTitle, children }: ShareMeetingDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [accessLevel, setAccessLevel] = useState<'view' | 'download'>('view');
  const [message, setMessage] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const { user } = useAuth();

  const handleShare = async () => {
    if (!email.trim()) {
      showToast.error('Please enter an email address', { section: 'meeting_manager' });
      return;
    }

    if (!user) {
      showToast.error('You must be logged in to share meetings', { section: 'meeting_manager' });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast.error('Please enter a valid email address', { section: 'meeting_manager' });
      return;
    }

    setIsSharing(true);

    try {
      const { error } = await supabase
        .from('meeting_shares')
        .insert({
          meeting_id: meetingId,
          shared_by: user.id,
          shared_with_email: email.toLowerCase().trim(),
          access_level: accessLevel,
          message: message.trim() || null
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          showToast.error('This meeting has already been shared with this email address', { section: 'meeting_manager' });
        } else {
          throw error;
        }
        return;
      }

      showToast.success(`Meeting "${meetingTitle}" shared successfully with ${email}`, { section: 'meeting_manager' });
      
      // Reset form
      setEmail('');
      setMessage('');
      setAccessLevel('view');
      setIsOpen(false);
      
    } catch (error: any) {
      console.error('Error sharing meeting:', error);
      showToast.error('Failed to share meeting. Please try again.', { section: 'meeting_manager' });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Meeting
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <h4 className="font-medium text-sm">{meetingTitle}</h4>
            <p className="text-xs text-muted-foreground mt-1">
              This meeting will be shared with the specified user
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="access-level" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Access Level
            </Label>
            <Select value={accessLevel} onValueChange={(value: 'view' | 'download') => setAccessLevel(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select access level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">View Only - Can view meeting details and transcripts</SelectItem>
                <SelectItem value="download">Full Access - Can view and download all files</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Optional Message</Label>
            <Textarea
              id="message"
              placeholder="Add a message to include with the shared meeting..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleShare} disabled={isSharing || !email.trim()}>
              {isSharing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Sharing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Share Meeting
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}