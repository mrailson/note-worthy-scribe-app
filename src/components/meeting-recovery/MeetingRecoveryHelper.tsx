import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';
import { manualTriggerAutoNotes } from '@/utils/manualTriggerNotes';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import { ManualNoteGenerationButton } from './ManualNoteGenerationButton';

interface StuckMeeting {
  id: string;
  title: string;
  created_at: string;
  status: string;
  notes_generation_status: string;
  word_count: number;
}

export const MeetingRecoveryHelper = () => {
  const [stuckMeetings, setStuckMeetings] = useState<StuckMeeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState<string | null>(null);

  const findStuckMeetings = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Find meetings that are completed but don't have notes generated yet
      const { data: meetings, error } = await supabase
        .from('meetings')
        .select('id, title, created_at, status, notes_generation_status, word_count')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .in('notes_generation_status', ['not_started', 'failed', 'insufficient_content'])
        .gt('word_count', 0)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        showToast.error('Failed to find stuck meetings', { section: 'meeting_manager' });
        return;
      }

      setStuckMeetings(meetings || []);
      
      if (!meetings || meetings.length === 0) {
        showToast.success('No stuck meetings found! All meetings appear to be processed correctly.', { section: 'meeting_manager' });
      } else {
        showToast.info(`Found ${meetings.length} meetings that may need recovery`, { section: 'meeting_manager' });
      }
    } catch (error) {
      console.error('Error finding stuck meetings:', error);
      showToast.error('Failed to search for stuck meetings', { section: 'meeting_manager' });
    } finally {
      setLoading(false);
    }
  };

  const recoverMeeting = async (meetingId: string) => {
    setRecovering(meetingId);
    try {
      const success = await manualTriggerAutoNotes(meetingId);
      if (success) {
        // Remove from stuck meetings list
        setStuckMeetings(prev => prev.filter(m => m.id !== meetingId));
      }
    } catch (error) {
      console.error('Recovery failed:', error);
    } finally {
      setRecovering(null);
    }
  };

  const forceStopMeeting = async (meetingId: string) => {
    setRecovering(meetingId);
    try {
      // Direct database update using service role
      const { data, error } = await supabase.functions.invoke('force-stop-meeting', {
        body: { meetingId }
      });
      
      if (error) {
        console.error('Force stop failed:', error);
        return;
      }
      
      if (data?.success) {
        // Remove from stuck meetings list
        setStuckMeetings(prev => prev.filter(m => m.id !== meetingId));
      }
    } catch (error) {
      console.error('Force stop error:', error);
    } finally {
      setRecovering(null);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Meeting Recovery Helper
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Find and recover meetings that got stuck during the recording process and didn't generate notes automatically.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={findStuckMeetings}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Find Stuck Meetings
            </>
          )}
        </Button>

        {stuckMeetings.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium">Meetings Needing Recovery:</h3>
            {stuckMeetings.map((meeting) => (
              <div 
                key={meeting.id} 
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">{meeting.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(meeting.created_at).toLocaleString()} • 
                    {meeting.word_count} words • 
                    Status: {meeting.notes_generation_status}
                  </p>
                </div>
                <div className="flex gap-2">
                  <ManualNoteGenerationButton 
                    meetingId={meeting.id}
                    hasExistingNotes={false}
                    isInsufficientContent={meeting.notes_generation_status === 'insufficient_content'}
                  />
                  <Button
                    size="sm"
                    onClick={() => recoverMeeting(meeting.id)}
                    disabled={recovering === meeting.id}
                    variant="outline"
                  >
                    {recovering === meeting.id ? (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        Recovering...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Recover
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => forceStopMeeting(meeting.id)}
                    disabled={recovering === meeting.id}
                    variant="destructive"
                  >
                    {recovering === meeting.id ? (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        Stopping...
                      </>
                    ) : (
                      'Stop'
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};