import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Headphones, FileDown } from "lucide-react";
import { TextOverviewEditor } from "./TextOverviewEditor";
import { AudioOverviewPlayer } from "./AudioOverviewPlayer";
import { MeetingDocumentsList } from "@/components/MeetingDocumentsList";

interface MeetingDetailsTabsProps {
  meetingId: string;
  currentOverview: string;
  audioOverviewUrl?: string;
  audioOverviewText?: string;
  audioOverviewDuration?: number;
  meetingDurationMinutes?: number;
  onOverviewChange: (overview: string) => void;
  onRegenerateAudio?: (voiceProvider?: string, voiceId?: string, updatedText?: string, targetDuration?: number) => void;
  onDocumentRemoved?: () => void;
  className?: string;
}

export const MeetingDetailsTabs = ({
  meetingId,
  currentOverview,
  audioOverviewUrl,
  audioOverviewText,
  audioOverviewDuration,
  meetingDurationMinutes,
  onOverviewChange,
  onRegenerateAudio,
  onDocumentRemoved,
  className = ""
}: MeetingDetailsTabsProps) => {
  return (
    <div className={`bg-card border border-border rounded-lg ${className}`}>
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-auto p-1">
          <TabsTrigger value="overview" className="flex items-center gap-2 py-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Meeting Overview</span>
            <span className="sm:hidden">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="audio" className="flex items-center gap-2 py-2">
            <Headphones className="h-4 w-4" />
            <span className="hidden sm:inline">Audio Summary</span>
            <span className="sm:hidden">Audio</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2 py-2">
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">Documents</span>
            <span className="sm:hidden">Docs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="p-4">
          <TextOverviewEditor
            meetingId={meetingId}
            currentOverview={currentOverview}
            onOverviewChange={onOverviewChange}
          />
        </TabsContent>

        <TabsContent value="audio" className="p-4">
          <AudioOverviewPlayer
            meetingId={meetingId}
            audioOverviewUrl={audioOverviewUrl}
            audioOverviewText={audioOverviewText}
            audioOverviewDuration={audioOverviewDuration}
            meetingDurationMinutes={meetingDurationMinutes}
            onRegenerateAudio={onRegenerateAudio}
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
