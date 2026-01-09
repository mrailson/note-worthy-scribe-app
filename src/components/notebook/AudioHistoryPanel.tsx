import { useState, useEffect, useRef } from 'react';
import { Search, Play, Pause, Edit, Trash2, Copy, Calendar, Clock, FileText, Mic, Briefcase, GraduationCap, ClipboardList, Radio, FileCode, HeartPulse } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAudioOverviewHistory, type AudioSession } from '@/hooks/useAudioOverviewHistory';
import { showToast } from '@/utils/toastWrapper';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AudioHistoryPanelProps {
  onLoadSession: (session: AudioSession) => void;
}

export const AudioHistoryPanel = ({ onLoadSession }: AudioHistoryPanelProps) => {
  const { sessions, loading, loadSessions, deleteSession, duplicateSession } = useAudioOverviewHistory();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Debounced search - only triggers API call after 300ms of no typing
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      loadSessions(searchQuery || undefined);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, loadSessions]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Legacy inline audio playback removed – sessions now open in the main Audio Overview player

  const handleDelete = async () => {
    if (sessionToDelete) {
      await deleteSession(sessionToDelete);
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    }
  };

  const handleDuplicate = async (sessionId: string) => {
    await duplicateSession(sessionId);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStyleIcon = (style: string | null) => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      executive: Briefcase,
      training: GraduationCap,
      meeting: ClipboardList,
      podcast: Radio,
      technical: FileCode,
      patient: HeartPulse
    };
    const Icon = iconMap[style || 'executive'] || Briefcase;
    return <Icon className="h-3 w-3" />;
  };

  const getStyleLabel = (style: string | null) => {
    const labelMap: Record<string, string> = {
      executive: 'Executive',
      training: 'Training',
      meeting: 'Meeting',
      podcast: 'Podcast',
      technical: 'Technical',
      patient: 'Patient Info'
    };
    return labelMap[style || 'executive'] || 'Executive';
  };

  if (loading && sessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audio History</CardTitle>
          <CardDescription>Loading your saved audio sessions...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Audio History</CardTitle>
          <CardDescription>
            Browse and reopen your saved audio overview sessions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sessions by title or content..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Sessions List */}
          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <Mic className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No sessions match your search' : 'No saved audio sessions yet'}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Generate and save audio overviews to see them here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <Card key={session.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Title and badges */}
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold truncate">{session.title}</h3>
                          {session.audio_url && (
                            <Badge variant="secondary" className="shrink-0">
                              <Mic className="h-3 w-3 mr-1" />
                              Audio
                            </Badge>
                          )}
                        </div>

                        {/* Metadata */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
                          <Badge variant="outline" className="gap-1">
                            {getStyleIcon(session.script_style)}
                            <span>{getStyleLabel(session.script_style)}</span>
                          </Badge>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(session.created_at), 'dd MMM yyyy, HH:mm')}
                          </div>
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {session.word_count} words
                          </div>
                          {session.duration_seconds && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(session.duration_seconds)}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Mic className="h-3 w-3" />
                            {session.voice_name}
                          </div>
                        </div>

                        {/* Source documents */}
                        {session.source_documents.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {session.source_documents.slice(0, 3).map((doc, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {doc}
                              </Badge>
                            ))}
                            {session.source_documents.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{session.source_documents.length - 3} more
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Script preview */}
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {session.edited_script || session.original_script}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col gap-2 shrink-0">
                        {session.audio_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              onLoadSession(session);
                              showToast.success('Session loaded into Audio Overview. Use the main player to listen.', { section: 'ai4gp' });
                            }}
                            className="w-32"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Open in player
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => onLoadSession(session)}
                          className="w-20"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Load
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDuplicate(session.id)}
                          className="w-20"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSessionToDelete(session.id);
                            setDeleteDialogOpen(true);
                          }}
                          className="w-20 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Audio Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this audio session. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
