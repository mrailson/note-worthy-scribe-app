import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Share2, Eye, Download, Trash2, Calendar, Clock, Mail, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastWrapper';
import { format } from 'date-fns';

interface SharedMeeting {
  id: string;
  meeting_id: string;
  shared_with_email: string;
  shared_at: string;
  access_level: 'view' | 'download';
  message?: string;
  meeting: {
    title: string;
    start_time: string;
    meeting_type: string;
  };
}

export function SharedMeetingsManager() {
  const [sharedMeetings, setSharedMeetings] = useState<SharedMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEmail, setFilterEmail] = useState('');
  const { user } = useAuth();

  const loadSharedMeetings = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('meeting_shares')
        .select(`
          id,
          meeting_id,
          shared_with_email,
          shared_at,
          access_level,
          message,
          meetings!inner (
            title,
            start_time,
            meeting_type
          )
        `)
        .eq('shared_by', user.id)
        .order('shared_at', { ascending: false });

      if (error) throw error;

      // Transform the data to match our interface
      const transformedData = data?.map(item => ({
        id: item.id,
        meeting_id: item.meeting_id,
        shared_with_email: item.shared_with_email,
        shared_at: item.shared_at,
        access_level: item.access_level as 'view' | 'download',
        message: item.message,
        meeting: {
          title: (item.meetings as any).title,
          start_time: (item.meetings as any).start_time,
          meeting_type: (item.meetings as any).meeting_type,
        }
      })) || [];

      setSharedMeetings(transformedData);
    } catch (error: any) {
      console.error('Error loading shared meetings:', error);
      showToast.error('Failed to load shared meetings', { section: 'meeting_manager' });
    } finally {
      setLoading(false);
    }
  };

  const revokeShare = async (shareId: string, meetingTitle: string, email: string) => {
    try {
      const { error } = await supabase
        .from('meeting_shares')
        .delete()
        .eq('id', shareId);

      if (error) throw error;

      showToast.success(`Revoked access to "${meetingTitle}" for ${email}`, { section: 'meeting_manager' });
      loadSharedMeetings(); // Reload the list
    } catch (error: any) {
      console.error('Error revoking share:', error);
      showToast.error('Failed to revoke access', { section: 'meeting_manager' });
    }
  };

  useEffect(() => {
    loadSharedMeetings();
  }, [user]);

  const filteredMeetings = sharedMeetings.filter(share =>
    filterEmail === '' || share.shared_with_email.toLowerCase().includes(filterEmail.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'do MMMM yyyy');
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'HH:mm');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            My Shared Meetings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          My Shared Meetings ({sharedMeetings.length})
        </CardTitle>
        <div className="flex items-center gap-2">
          <Label htmlFor="filter-email">Filter by email:</Label>
          <Input
            id="filter-email"
            placeholder="Search by email..."
            value={filterEmail}
            onChange={(e) => setFilterEmail(e.target.value)}
            className="max-w-xs"
          />
        </div>
      </CardHeader>
      <CardContent>
        {filteredMeetings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {filterEmail ? 'No shared meetings found for this email.' : 'You haven\'t shared any meetings yet.'}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMeetings.map((share) => (
              <div key={share.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h4 className="font-medium">{share.meeting.title}</h4>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(share.meeting.start_time)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatTime(share.meeting.start_time)}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {share.meeting.meeting_type}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{share.shared_with_email}</span>
                    <Badge variant={share.access_level === 'download' ? 'default' : 'outline'} className="text-xs">
                      {share.access_level === 'download' ? (
                        <>
                          <Download className="h-3 w-3 mr-1" />
                          Full Access
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3 mr-1" />
                          View Only
                        </>
                      )}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {share.message && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Share Message</DialogTitle>
                          </DialogHeader>
                          <div className="p-4 bg-muted rounded-lg">
                            <p className="text-sm">{share.message}</p>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke Access</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to revoke access to "{share.meeting.title}" for {share.shared_with_email}? 
                            They will no longer be able to view this meeting.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => revokeShare(share.id, share.meeting.title, share.shared_with_email)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Revoke Access
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Shared on {formatDate(share.shared_at)} at {formatTime(share.shared_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}