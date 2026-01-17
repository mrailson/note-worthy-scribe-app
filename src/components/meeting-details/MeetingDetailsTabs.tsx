import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, FileDown, MessageCircle } from "lucide-react";
import { TextOverviewEditor } from "./TextOverviewEditor";
import { MeetingDocumentsList } from "@/components/MeetingDocumentsList";
import { MeetingQAPanel } from "./MeetingQAPanel";
import { supabase } from "@/integrations/supabase/client";

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
}

export const MeetingDetailsTabs = ({
  meetingId,
  meetingTitle,
  currentOverview,
  onOverviewChange,
  onDocumentRemoved,
  className = ""
}: MeetingDetailsTabsProps) => {
  const [documentCount, setDocumentCount] = useState<number>(0);

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
