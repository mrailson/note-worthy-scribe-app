import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, FileDown, MessageCircle, Sparkles, Loader2 } from "lucide-react";
import { TextOverviewEditor } from "./TextOverviewEditor";
import { MeetingDocumentsList } from "@/components/MeetingDocumentsList";
import { MeetingQAPanel } from "./MeetingQAPanel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ensureMeetingTitle } from "@/utils/manualTriggerNotes";
interface MeetingDetailsTabsProps {
  meetingId: string;
  meetingTitle: string;
  currentOverview: string;
  audioOverviewUrl?: string;
  audioOverviewText?: string;
  audioOverviewDuration?: number;
  meetingDurationMinutes?: number;
  onOverviewChange: (overview: string) => void;
  onRegenerateAudio?: () => void;
  onDocumentRemoved?: () => void;
  meetingAttendees?: string[];
  chairName?: string;
  className?: string;
  wordCount?: number;
  notesGenerationStatus?: string | null;
}

export const MeetingDetailsTabs = ({
  meetingId,
  meetingTitle,
  currentOverview,
  onOverviewChange,
  onDocumentRemoved,
  className = "",
  wordCount = 0,
  notesGenerationStatus
}: MeetingDetailsTabsProps) => {
  const [documentCount, setDocumentCount] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [localGenerationStatus, setLocalGenerationStatus] = useState(notesGenerationStatus);

  // Keep local status in sync with prop
  useEffect(() => {
    setLocalGenerationStatus(notesGenerationStatus);
  }, [notesGenerationStatus]);

  // Realtime subscription to detect when notes generation completes
  useEffect(() => {
    if (localGenerationStatus !== 'queued' && localGenerationStatus !== 'generating') return;

    const channel = supabase
      .channel(`meeting-notes-${meetingId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'meetings',
        filter: `id=eq.${meetingId}`
      }, async (payload: any) => {
        const newStatus = payload.new?.notes_generation_status;
        if (newStatus === 'completed') {
          // Re-fetch the overview
          const { data } = await supabase
            .from('meetings')
            .select('overview')
            .eq('id', meetingId)
            .maybeSingle();

          if (data?.overview) {
            onOverviewChange(data.overview);
          }
          setLocalGenerationStatus('completed');
          toast.success('Meeting notes generated successfully');
          supabase.removeChannel(channel);
        } else if (newStatus === 'failed' || newStatus === 'error') {
          setLocalGenerationStatus(newStatus);
          toast.error('Notes generation failed. Please try again.');
          supabase.removeChannel(channel);
        } else if (newStatus) {
          setLocalGenerationStatus(newStatus);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId, localGenerationStatus, onOverviewChange]);

  // Fetch document count
  useEffect(() => {
    const fetchDocumentCount = async () => {
      try {
        const { count, error } = await supabase
          .from('meeting_documents')
          .select('*', { count: 'exact', head: true })
          .eq('meeting_id', meetingId);

        if (error) {
          console.error('Error fetching document count:', error);
          return;
        }

        setDocumentCount(count || 0);
      } catch (error) {
        console.error('Error fetching document count:', error);
      }
    };

    fetchDocumentCount();
  }, [meetingId, onDocumentRemoved]);

  const handleGenerateNotes = async () => {
    try {
      setIsGenerating(true);
      // Flip status locally immediately so the "running" banner appears
      // without waiting for the realtime/DB round-trip.
      setLocalGenerationStatus('queued');

      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('id, word_count')
        .eq('id', meetingId)
        .maybeSingle();

      if (meetingError || !meeting) {
        throw new Error('Meeting not found or you do not have access to it');
      }

      await supabase
        .from('meetings')
        .update({ notes_generation_status: 'queued' })
        .eq('id', meetingId);

      const { error } = await supabase.functions.invoke('auto-generate-meeting-notes', {
        body: { meetingId, forceRegenerate: false }
      });

      if (error) throw error;

      // Safety net: ensure meeting title is descriptive even if notes were skipped
      ensureMeetingTitle(meetingId).catch(err => console.warn('⚠️ Title safety net failed:', err));

      // Re-sync local status from DB. If the edge function skipped because
      // notes already existed (status stays 'completed'), this clears the
      // optimistic 'queued' banner so the UI doesn't hang forever.
      const { data: refreshed } = await supabase
        .from('meetings')
        .select('notes_generation_status, overview')
        .eq('id', meetingId)
        .maybeSingle();

      if (refreshed?.notes_generation_status) {
        setLocalGenerationStatus(refreshed.notes_generation_status);
      }
      if (refreshed?.notes_generation_status === 'completed') {
        if (refreshed.overview) onOverviewChange(refreshed.overview);
        toast.info('Notes already generated for this meeting.');
      } else {
        toast.success('Note generation started! This may take a few moments.');
      }
    } catch (error: any) {
      console.error('Error generating notes:', error);
      toast.error(`Failed to generate notes: ${error.message || 'Unknown error'}`);
      await supabase
        .from('meetings')
        .update({ notes_generation_status: 'failed' })
        .eq('id', meetingId);
    } finally {
      setIsGenerating(false);
    }
  };

  const showGeneratePrompt = !currentOverview && wordCount >= 100 && localGenerationStatus !== 'queued' && localGenerationStatus !== 'generating';
  const showGeneratingStatus = (localGenerationStatus === 'queued' || localGenerationStatus === 'generating') && !currentOverview;

  return (
    <div className={`bg-card border border-border rounded-lg ${className}`}>
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-auto p-1">
          <TabsTrigger value="overview" className="flex items-center gap-2 py-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Meeting Overview</span>
            <span className="sm:hidden">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="ask-ai" className="flex items-center gap-2 py-2">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Ask AI</span>
            <span className="sm:hidden">AI</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2 py-2">
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">Documents</span>
            <span className="sm:hidden">Docs</span>
            {documentCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                {documentCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="p-4">
          {showGeneratingStatus && (
            <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Notes are being generated…</p>
                <p className="text-xs text-muted-foreground mt-0.5">This usually takes a minute or two. The page will update automatically.</p>
              </div>
            </div>
          )}

          {showGeneratePrompt && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Transcript available ({wordCount.toLocaleString()} words) but notes haven't been generated yet.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Generate an overview, summary, and key points from your transcript.
                  </p>
                  <Button
                    onClick={handleGenerateNotes}
                    disabled={isGenerating}
                    size="sm"
                    className="mt-3"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Generate Meeting Notes
                  </Button>
                </div>
              </div>
            </div>
          )}

          <TextOverviewEditor
            meetingId={meetingId}
            currentOverview={currentOverview}
            onOverviewChange={onOverviewChange}
          />
        </TabsContent>

        <TabsContent value="ask-ai" className="p-4">
          <MeetingQAPanel
            meetingId={meetingId}
            meetingTitle={meetingTitle}
          />
        </TabsContent>

        <TabsContent value="documents" className="p-4">
          <MeetingDocumentsList
            meetingId={meetingId}
            onDocumentRemoved={onDocumentRemoved}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
