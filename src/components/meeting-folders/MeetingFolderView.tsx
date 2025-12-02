import { useState } from "react";
import { Folder, ChevronLeft, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MeetingHistoryList } from "@/components/MeetingHistoryList";

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  meeting_type: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  status: string;
  created_at: string;
  location?: string | null;
  format?: string | null;
  transcript_count?: number;
  summary_exists?: boolean;
  overview?: string | null;
  word_count?: number;
  document_count?: number;
  notes_generation_status?: string;
  live_transcript_text?: string | null;
  folder_id?: string | null;
}

interface MeetingFolder {
  id: string;
  name: string;
  colour: string;
  description?: string | null;
}

interface MeetingFolderViewProps {
  folders: MeetingFolder[];
  meetings: Meeting[];
  onEdit: (meetingId: string) => void;
  onViewSummary: (meetingId: string) => void;
  onViewTranscript: (meetingId: string) => void;
  onDelete: (meetingId: string) => void;
  onRefresh: () => void;
  loading: boolean;
  isSelectMode: boolean;
  selectedMeetings: string[];
  onSelectMeeting: (meetingId: string, checked: boolean) => void;
  onMeetingUpdate: (meetingId: string, updatedTitle: string) => void;
  onDocumentsUploaded: (meetingId: string, uploadedFiles: any[]) => void;
  showRecordingPlayback: boolean;
  onFolderAssigned: (meetingId: string, folderId: string | null) => void;
}

export function MeetingFolderView({
  folders,
  meetings,
  onEdit,
  onViewSummary,
  onViewTranscript,
  onDelete,
  onRefresh,
  loading,
  isSelectMode,
  selectedMeetings,
  onSelectMeeting,
  onMeetingUpdate,
  onDocumentsUploaded,
  showRecordingPlayback,
  onFolderAssigned,
}: MeetingFolderViewProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Calculate meeting count per folder
  const getMeetingCount = (folderId: string | null): number => {
    return meetings.filter(m => m.folder_id === folderId).length;
  };

  // Get meetings for selected folder
  const getFilteredMeetings = (): Meeting[] => {
    if (selectedFolderId === null) {
      return meetings.filter(m => !m.folder_id);
    }
    return meetings.filter(m => m.folder_id === selectedFolderId);
  };

  // Get folder name for header
  const getSelectedFolderName = (): string => {
    if (selectedFolderId === null) return "Unfiled Meetings";
    const folder = folders.find(f => f.id === selectedFolderId);
    return folder?.name || "Unknown Folder";
  };

  // Folder list view
  if (selectedFolderId === undefined) {
    const unfiledCount = getMeetingCount(null);

    return (
      <div className="space-y-4 pb-20">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold text-foreground">Browse by Folder</h2>
          <p className="text-sm text-muted-foreground mt-1">Tap a folder to view meetings</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Unfiled folder */}
          <Card
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setSelectedFolderId(null)}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center min-h-[120px]">
              <FolderOpen className="h-10 w-10 mb-2 text-muted-foreground" />
              <h3 className="font-medium text-foreground text-center mb-1">Unfiled</h3>
              <p className="text-xs text-muted-foreground">
                {unfiledCount} {unfiledCount === 1 ? 'meeting' : 'meetings'}
              </p>
            </CardContent>
          </Card>

          {/* User folders */}
          {folders.map((folder) => {
            const count = getMeetingCount(folder.id);
            return (
              <Card
                key={folder.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelectedFolderId(folder.id)}
              >
                <CardContent className="p-4 flex flex-col items-center justify-center min-h-[120px]">
                  <Folder
                    className="h-10 w-10 mb-2"
                    style={{ color: folder.colour }}
                  />
                  <h3 className="font-medium text-foreground text-center mb-1 line-clamp-2">
                    {folder.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {count} {count === 1 ? 'meeting' : 'meetings'}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Folder content view
  const filteredMeetings = getFilteredMeetings();
  const folderName = getSelectedFolderName();

  return (
    <div className="space-y-4 pb-20">
      {/* Back button and header */}
      <div className="sticky top-0 z-10 bg-background pb-4">
        <Button
          variant="ghost"
          onClick={() => setSelectedFolderId(undefined)}
          className="mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Folders
        </Button>

        <div className="flex items-center gap-2">
          <Folder className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold text-foreground">{folderName}</h2>
            <p className="text-sm text-muted-foreground">
              {filteredMeetings.length} {filteredMeetings.length === 1 ? 'meeting' : 'meetings'}
            </p>
          </div>
        </div>
      </div>

      {/* Meeting list */}
      {filteredMeetings.length > 0 ? (
        <MeetingHistoryList
          meetings={filteredMeetings}
          onEdit={onEdit}
          onViewSummary={onViewSummary}
          onViewTranscript={onViewTranscript}
          onDelete={onDelete}
          onRefresh={onRefresh}
          loading={loading}
          isSelectMode={isSelectMode}
          selectedMeetings={selectedMeetings}
          onSelectMeeting={onSelectMeeting}
          onMeetingUpdate={onMeetingUpdate}
          onDocumentsUploaded={onDocumentsUploaded}
          showRecordingPlayback={showRecordingPlayback}
          onFolderAssigned={onFolderAssigned}
        />
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No meetings in this folder</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
