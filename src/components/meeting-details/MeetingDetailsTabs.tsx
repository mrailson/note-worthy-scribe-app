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

      toast.success('Note generation started! This may take a few moments.');
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

  const showGeneratePrompt = !currentOverview && wordCount >= 100 && notesGenerationStatus !== 'queued' && notesGenerationStatus !== 'generating';
  const showGeneratingStatus = notesGenerationStatus === 'queued' || notesGenerationStatus === 'generating';

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
