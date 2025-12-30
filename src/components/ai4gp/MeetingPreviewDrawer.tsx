import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Clock, FileText, ExternalLink, Calendar, Loader2 } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TextOverviewEditor } from '@/components/meeting-details/TextOverviewEditor';
import { MeetingQAPanel } from '@/components/meeting-details/MeetingQAPanel';
import { MeetingDocumentsList } from '@/components/MeetingDocumentsList';
import { renderMinutesMarkdown } from '@/lib/minutesRenderer';

interface MeetingPreviewDrawerProps {
  meetingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MeetingDetails {
  id: string;
  title: string;
  start_time: string | null;
  created_at: string;
  duration_minutes: number | null;
  word_count: number | null;
  status: string | null;
  notes_style_2: string | null;
  overview: string | null;
}

export const MeetingPreviewDrawer = ({ meetingId, open, onOpenChange }: MeetingPreviewDrawerProps) => {
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<MeetingDetails | null>(null);
  const [overview, setOverview] = useState<string>('');
  const [documentCount, setDocumentCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (meetingId && open) {
      fetchMeetingData();
    }
  }, [meetingId, open]);

  const fetchMeetingData = async () => {
    if (!meetingId) return;
    
    setLoading(true);
    try {
      // Fetch meeting details including notes
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('id, title, start_time, created_at, duration_minutes, word_count, status, notes_style_2, overview')
        .eq('id', meetingId)
        .single();

      if (meetingError) throw meetingError;
      setMeeting(meetingData);

      // Fetch overview from meeting_overviews table if not on meeting directly
      const { data: overviewData } = await supabase
        .from('meeting_overviews')
        .select('overview')
        .eq('meeting_id', meetingId)
        .maybeSingle();

      setOverview(overviewData?.overview || meetingData?.overview || '');

      // Fetch document count
      const { count } = await supabase
        .from('meeting_documents')
        .select('*', { count: 'exact', head: true })
        .eq('meeting_id', meetingId);

      setDocumentCount(count || 0);
    } catch (error: any) {
      console.error('Error fetching meeting data:', error);
      toast.error('Failed to load meeting details');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFullMeeting = () => {
    onOpenChange(false);
    navigate(`/meeting-summary/${meetingId}`);
  };

  const handleOverviewChange = (newOverview: string) => {
    setOverview(newOverview);
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'Unknown';
    if (minutes < 60) return `${minutes} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  };

  const meetingDate = meeting?.start_time || meeting?.created_at;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : meeting ? (
          <>
            {/* Header */}
            <DrawerHeader className="border-b pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <DrawerTitle className="text-lg font-semibold truncate">
                    {meeting.title || 'Untitled Meeting'}
                  </DrawerTitle>
                  <DrawerDescription className="mt-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {meetingDate ? format(new Date(meetingDate), 'dd MMM yyyy, HH:mm') : 'No date'}
                      </Badge>
                      {meeting.duration_minutes && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(meeting.duration_minutes)}
                        </Badge>
                      )}
                      {meeting.word_count && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {meeting.word_count.toLocaleString()} words
                        </Badge>
                      )}
                    </div>
                  </DrawerDescription>
                </div>
              </div>
            </DrawerHeader>

            {/* Tabs Content */}
            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="overview" className="h-full flex flex-col">
                <TabsList className="mx-4 mt-2 w-fit">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="ask-ai">Ask AI</TabsTrigger>
                  <TabsTrigger value="documents" className="flex items-center gap-1">
                    Documents
                    {documentCount > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {documentCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-hidden">
                  <TabsContent value="overview" className="h-full m-0 p-4">
                    <ScrollArea className="h-[50vh]">
                      <div className="space-y-4 pr-4">
                        {/* Overview Section */}
                        <div>
                          <h3 className="text-sm font-medium mb-2">Meeting Overview</h3>
                          <TextOverviewEditor
                            meetingId={meeting.id}
                            currentOverview={overview}
                            onOverviewChange={handleOverviewChange}
                          />
                        </div>

                        {/* Notes Preview */}
                        {meeting.notes_style_2 && (
                          <div>
                            <h3 className="text-sm font-medium mb-2">Meeting Notes</h3>
                            <div 
                              className="prose prose-sm max-w-none text-muted-foreground bg-muted/30 rounded-lg p-3"
                              dangerouslySetInnerHTML={{ 
                                __html: renderMinutesMarkdown(
                                  meeting.notes_style_2.substring(0, 500) + 
                                  (meeting.notes_style_2.length > 500 ? '...' : '')
                                ) 
                              }}
                            />
                            {meeting.notes_style_2.length > 500 && (
                              <Button 
                                variant="link" 
                                size="sm" 
                                className="mt-1 p-0 h-auto"
                                onClick={handleOpenFullMeeting}
                              >
                                View full notes →
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="ask-ai" className="h-full m-0 p-4 overflow-hidden">
                    <ScrollArea className="h-[50vh]">
                      <MeetingQAPanel 
                        meetingId={meeting.id} 
                        meetingTitle={meeting.title || 'Meeting'}
                      />
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="documents" className="h-full m-0 p-4">
                    <ScrollArea className="h-[50vh]">
                      <MeetingDocumentsList 
                        meetingId={meeting.id}
                        onDocumentRemoved={fetchMeetingData}
                      />
                    </ScrollArea>
                  </TabsContent>
                </div>
              </Tabs>
            </div>

            {/* Footer */}
            <div className="border-t p-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleOpenFullMeeting} className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Open Full Meeting
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-50" />
            <p>Meeting not found</p>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
};
