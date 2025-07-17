import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Clock, Users, FileText, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MeetingData {
  id?: string;
  title: string;
  duration: string;
  wordCount: number;
  transcript: string;
  speakerCount: number;
  startTime: string;
}

export default function MeetingSummary() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasBeenSaved, setHasBeenSaved] = useState(false);

  useEffect(() => {
    // Get meeting data from navigation state
    const data = location.state as MeetingData;
    if (data && !hasBeenSaved) {
      setMeetingData(data);
      saveMeetingToDatabase(data);
      setHasBeenSaved(true);
    } else if (!data) {
      // If no data, redirect back to home
      navigate('/');
    }
  }, [location.state, navigate, hasBeenSaved]);

  const saveMeetingToDatabase = async (data: MeetingData) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Save meeting
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          title: data.title,
          user_id: user.id,
          start_time: data.startTime,
          end_time: new Date().toISOString(),
          duration_minutes: Math.floor(parseInt(data.duration.split(':')[0]) + parseInt(data.duration.split(':')[1]) / 60),
          status: 'completed',
          meeting_type: 'consultation'
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      // Save transcript
      if (data.transcript && meeting) {
        const { error: transcriptError } = await supabase
          .from('meeting_transcripts')
          .insert({
            meeting_id: meeting.id,
            content: data.transcript,
            speaker_name: 'Multiple Speakers',
            timestamp_seconds: 0,
            confidence_score: 0.8
          });

        if (transcriptError) throw transcriptError;
      }

      setMeetingData(prev => prev ? { ...prev, id: meeting.id } : null);
      
      toast({
        title: "Meeting Saved",
        description: "Your meeting has been successfully saved to the database",
      });

    } catch (error) {
      console.error('Error saving meeting:', error);
      toast({
        title: "Save Error",
        description: "Failed to save meeting data",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!meetingData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{meetingData.title}</h1>
            <p className="text-muted-foreground">Meeting Summary</p>
          </div>
          {isSaving && (
            <Badge variant="secondary" className="ml-auto">
              Saving...
            </Badge>
          )}
          {meetingData.id && (
            <Badge variant="default" className="ml-auto">
              <CheckCircle className="h-3 w-3 mr-1" />
              Saved
            </Badge>
          )}
        </div>

        {/* Meeting Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-primary">{meetingData.duration}</div>
              <div className="text-sm text-muted-foreground">Duration</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-primary">{meetingData.wordCount}</div>
              <div className="text-sm text-muted-foreground">Words Transcribed</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-primary">{meetingData.speakerCount}</div>
              <div className="text-sm text-muted-foreground">Speakers</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-primary">100%</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </CardContent>
          </Card>
        </div>

        {/* Meeting Transcript */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Complete Transcript
            </CardTitle>
          </CardHeader>
          <CardContent>
            {meetingData.transcript ? (
              <div className="bg-accent/30 p-4 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                  {meetingData.transcript}
                </pre>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No transcript available</p>
                <p className="text-sm">The meeting was recorded but no speech was detected</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <Button onClick={() => navigate('/meeting-history')}>
            View All Meetings
          </Button>
          <Button variant="outline" onClick={() => navigate('/')}>
            Start New Meeting
          </Button>
        </div>
      </div>
    </div>
  );
}