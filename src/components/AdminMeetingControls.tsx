import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import { Loader2, Clock, AlertCircle } from 'lucide-react';

export const AdminMeetingControls = () => {
  const { isSystemAdmin } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  if (!isSystemAdmin) return null;

  const runAutoCloseCheck = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-close-inactive-meetings');
      
      if (error) {
        console.error('Auto-close check failed:', error);
        showToast.error('Auto-close check failed: ' + error.message, { section: 'system' });
        return;
      }

      setLastResult(data);
      
      if (data?.closed_meetings > 0) {
        showToast.success(`Auto-closed ${data.closed_meetings} inactive meeting${data.closed_meetings > 1 ? 's' : ''}`, { section: 'system' });
      } else {
        showToast.info('No inactive meetings found to close', { section: 'system' });
      }
      
    } catch (error) {
      console.error('Error in auto-close check:', error);
      showToast.error('Error running auto-close check', { section: 'system' });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Meeting Auto-Close Service
          <Badge variant="secondary">Admin Only</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          <p>Automatically closes meetings that have been recording for 5+ minutes without new transcriptions and are not paused.</p>
          <p className="mt-1">This service runs automatically every 5 minutes, but you can trigger it manually here.</p>
        </div>
        
        <Button 
          onClick={runAutoCloseCheck}
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Running Auto-Close Check...
            </>
          ) : (
            <>
              <Clock className="w-4 h-4 mr-2" />
              Run Auto-Close Check Now
            </>
          )}
        </Button>

        {lastResult && (
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="h-4 w-4" />
              Last Check Results
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Meetings Checked:</span>
                <span className="ml-2 font-medium">{lastResult.checked_meetings}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Meetings Closed:</span>
                <span className="ml-2 font-medium">{lastResult.closed_meetings}</span>
              </div>
            </div>
            {lastResult.closed_meeting_ids && lastResult.closed_meeting_ids.length > 0 && (
              <div className="text-xs">
                <span className="text-muted-foreground">Closed Meeting IDs:</span>
                <div className="mt-1 font-mono text-xs break-all">
                  {lastResult.closed_meeting_ids.join(', ')}
                </div>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Last run: {new Date(lastResult.timestamp).toLocaleString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};