import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMeetingRecorder } from '@/hooks/useMeetingRecorder';
import { AudioControls } from './AudioControls';
import { TranscriptDisplay } from './TranscriptDisplay';
import { MeetingSettings } from './MeetingSettings';
import { MeetingHistoryList } from './MeetingHistoryList';

interface MeetingRecorderContainerProps {
  onTranscriptUpdate: (transcript: string) => void;
  onDurationUpdate: (duration: string) => void;
  onWordCountUpdate: (count: number) => void;
  initialSettings?: {
    title: string;
    description: string;
    meetingType: string;
  };
}

export const MeetingRecorderContainer = ({
  onTranscriptUpdate,
  onDurationUpdate,
  onWordCountUpdate,
  initialSettings
}: MeetingRecorderContainerProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Meeting recorder hook
  const {
    isRecording,
    duration,
    transcript,
    wordCount,
    connectionStatus,
    realtimeTranscripts,
    meetingSettings,
    formattedDuration,
    startRecording,
    stopRecording,
    updateSettings
  } = useMeetingRecorder({
    initialSettings,
    onTranscriptUpdate,
    onDurationUpdate,
    onWordCountUpdate
  });

  // Meeting history state
  const [meetings, setMeetings] = useState<any[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMeetings, setSelectedMeetings] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Load meeting history
  useEffect(() => {
    if (user) {
      loadMeetingHistory();
    }
  }, [user]);

  // Filter meetings based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredMeetings(meetings);
    } else {
      const filtered = meetings.filter(meeting =>
        meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meeting.meeting_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meeting.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMeetings(filtered);
    }
  }, [meetings, searchQuery]);

  const loadMeetingHistory = async () => {
    if (!user) return;

    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select(`
          *,
          meeting_transcripts(count),
          meeting_summaries(count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const meetingsWithCounts = data.map(meeting => ({
        ...meeting,
        transcript_count: meeting.meeting_transcripts?.[0]?.count || 0,
        summary_exists: (meeting.meeting_summaries?.[0]?.count || 0) > 0
      }));

      setMeetings(meetingsWithCounts);
    } catch (error: any) {
      console.error('Error loading meeting history:', error);
      toast.error('Failed to load meeting history');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Meeting history handlers
  const handleEditMeeting = (meetingId: string) => {
    navigate(`/?edit=${meetingId}`);
  };

  const handleViewSummary = (meetingId: string) => {
    navigate(`/meeting-summary?id=${meetingId}`);
  };

  const handleViewTranscript = (meetingId: string) => {
    navigate(`/meetings/${meetingId}`);
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setMeetings(prev => prev.filter(m => m.id !== meetingId));
      toast.success('Meeting deleted successfully');
    } catch (error: any) {
      console.error('Error deleting meeting:', error);
      toast.error('Failed to delete meeting');
    }
  };

  const handleSelectMeeting = (meetingId: string, checked: boolean) => {
    if (checked) {
      setSelectedMeetings(prev => [...prev, meetingId]);
    } else {
      setSelectedMeetings(prev => prev.filter(id => id !== meetingId));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedMeetings.length === 0) return;

    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .in('id', selectedMeetings)
        .eq('user_id', user?.id);

      if (error) throw error;

      setMeetings(prev => prev.filter(m => !selectedMeetings.includes(m.id)));
      setSelectedMeetings([]);
      setIsSelectMode(false);
      toast.success(`${selectedMeetings.length} meetings deleted`);
    } catch (error: any) {
      console.error('Error deleting meetings:', error);
      toast.error('Failed to delete selected meetings');
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="recorder" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="recorder">Recorder</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Recording Controls Tab */}
        <TabsContent value="recorder" className="space-y-4 mt-6">
          <AudioControls
            isRecording={isRecording}
            duration={formattedDuration}
            connectionStatus={connectionStatus}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
          />
        </TabsContent>

        {/* Transcript Display Tab */}
        <TabsContent value="transcript" className="space-y-4 mt-6">
          <TranscriptDisplay
            transcript={transcript}
            realtimeTranscripts={realtimeTranscripts}
            wordCount={wordCount}
            isRecording={isRecording}
          />
        </TabsContent>

        {/* Meeting Settings Tab */}
        <TabsContent value="settings" className="space-y-4 mt-6">
          <MeetingSettings
            onSettingsChange={updateSettings}
            initialSettings={meetingSettings}
          />
        </TabsContent>

        {/* Meeting History Tab */}
        <TabsContent value="history" className="space-y-4 mt-6">
          <div className="space-y-4">
            {/* Search and Controls */}
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="text"
                placeholder="Search meetings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setIsSelectMode(!isSelectMode)}
                  className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
                >
                  {isSelectMode ? 'Cancel Select' : 'Select Multiple'}
                </button>
                {isSelectMode && selectedMeetings.length > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/80"
                  >
                    Delete Selected ({selectedMeetings.length})
                  </button>
                )}
              </div>
            </div>

            {/* Meeting List */}
            <MeetingHistoryList
              meetings={filteredMeetings}
              onEdit={handleEditMeeting}
              onViewSummary={handleViewSummary}
              onViewTranscript={handleViewTranscript}
              onDelete={handleDeleteMeeting}
              loading={loadingHistory}
              isSelectMode={isSelectMode}
              selectedMeetings={selectedMeetings}
              onSelectMeeting={handleSelectMeeting}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};