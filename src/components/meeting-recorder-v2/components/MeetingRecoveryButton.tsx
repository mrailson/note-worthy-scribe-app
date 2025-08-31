import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';
import { getStuckMeetings, recoverStuckMeeting } from '@/utils/meetingRecovery';
import { toast } from 'sonner';

interface StuckMeeting {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export const MeetingRecoveryButton: React.FC = () => {
  const [stuckMeetings, setStuckMeetings] = useState<StuckMeeting[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isRecovering, setIsRecovering] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);

  const checkForStuckMeetings = async () => {
    setIsChecking(true);
    try {
      const stuck = await getStuckMeetings();
      setStuckMeetings(stuck);
      setShowRecovery(true);
      
      if (stuck.length === 0) {
        toast.success('No stuck meetings found!');
      }
    } catch (error) {
      console.error('Failed to check for stuck meetings:', error);
      toast.error('Failed to check for stuck meetings');
    } finally {
      setIsChecking(false);
    }
  };

  const handleRecoverMeeting = async (meetingId: string) => {
    setIsRecovering(meetingId);
    try {
      const success = await recoverStuckMeeting(meetingId);
      if (success) {
        // Remove the recovered meeting from the list
        setStuckMeetings(prev => prev.filter(m => m.id !== meetingId));
      }
    } catch (error) {
      console.error('Failed to recover meeting:', error);
    } finally {
      setIsRecovering(null);
    }
  };

  if (!showRecovery) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={checkForStuckMeetings}
        disabled={isChecking}
        className="text-orange-600 border-orange-200 hover:bg-orange-50"
      >
        {isChecking ? (
          <>
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Checking...
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Check for Stuck Meetings
          </>
        )}
      </Button>
    );
  }

  if (stuckMeetings.length === 0) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          No stuck meetings found. All meetings are properly completed.
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRecovery(false)}
            className="ml-2 h-auto p-0 text-green-600 hover:text-green-700"
          >
            Hide
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-orange-200 bg-orange-50">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription className="space-y-3">
        <div className="text-orange-800">
          Found {stuckMeetings.length} stuck meeting{stuckMeetings.length > 1 ? 's' : ''} that may need recovery:
        </div>
        
        <div className="space-y-2">
          {stuckMeetings.map((meeting) => (
            <div key={meeting.id} className="flex items-center justify-between p-2 bg-white rounded border border-orange-200">
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900">{meeting.title}</div>
                <div className="text-xs text-gray-500">
                  Started: {new Date(meeting.created_at).toLocaleDateString()} at {new Date(meeting.created_at).toLocaleTimeString()}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">
                  Stuck in Recording
                </Badge>
                <Button
                  size="sm"
                  onClick={() => handleRecoverMeeting(meeting.id)}
                  disabled={isRecovering === meeting.id}
                  className="h-8 px-3 text-xs"
                >
                  {isRecovering === meeting.id ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      Recovering...
                    </>
                  ) : (
                    'Recover'
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={checkForStuckMeetings}
            disabled={isChecking}
            className="h-auto p-0 text-orange-600 hover:text-orange-700"
          >
            {isChecking ? 'Refreshing...' : 'Refresh'}
          </Button>
          <span className="text-orange-500">•</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRecovery(false)}
            className="h-auto p-0 text-orange-600 hover:text-orange-700"
          >
            Hide
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};