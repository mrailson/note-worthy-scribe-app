import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Languages,
  X,
  Search,
  Flag,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Download,
  Trash2,
  FileText,
  Loader2,
  RefreshCcw
} from 'lucide-react';
import { useTranslationHistory, TranslationSession } from '@/hooks/useTranslationHistory';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { downloadDOCX, SessionMetadata } from '@/utils/docxExport';
import { downloadPatientDOCX, PatientSessionMetadata } from '@/utils/patientDocxExport';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface TranslationHistorySidebarProps {
  onSessionLoad: (sessionId: string, translations: any[], translationScores: any[]) => void;
  onClose: () => void;
  currentSessionId?: string | null;
}

export const TranslationHistorySidebar: React.FC<TranslationHistorySidebarProps> = ({
  onSessionLoad,
  onClose,
  currentSessionId
}) => {
  const navigate = useNavigate();
  
  const {
    sessions,
    loading,
    error,
    totalCount,
    hasMore,
    deleteSession,
    updateSession,
    loadSessions,
    loadSessionDetails
  } = useTranslationHistory();

  const [searchQuery, setSearchQuery] = useState('');
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [showProtectedOnly, setShowProtectedOnly] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [sessionToDelete, setSessionToDelete] = useState<{ id: string; title: string } | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Extract available languages from sessions
  const availableLanguages = useMemo(() => {
    const languages = new Set<string>();
    sessions.forEach(session => {
      if (session.patient_language) {
        languages.add(session.patient_language);
      }
      if (session.session_metadata?.languages) {
        session.session_metadata.languages.forEach(lang => languages.add(lang));
      }
    });
    return Array.from(languages).sort();
  }, [sessions]);

  const handleDownloadSession = async (session: TranslationSession, format: 'standard' | 'patient') => {
    try {
      console.log('🔽 Starting session download for:', session.id);
      
      const sessionData = await loadSessionDetails(session.id);
      
      if (!sessionData.translations || sessionData.translations.length === 0) {
        toast.error('No translations found in this session');
        return;
      }

      const baseMetadata = {
        sessionTitle: session.session_title,
        sessionStart: new Date(session.session_start),
        sessionEnd: session.session_end ? new Date(session.session_end) : new Date(),
        sessionDate: new Date(session.session_start),
        patientLanguage: session.patient_language,
        totalTranslations: session.total_translations,
        ...session.session_metadata
      };

      if (format === 'patient') {
        await downloadPatientDOCX(sessionData.translations, baseMetadata as PatientSessionMetadata, null);
        toast.success('Patient report downloaded successfully');
      } else {
        await downloadDOCX(sessionData.translations, baseMetadata as SessionMetadata, null, true, 'standard');
        toast.success('Standard report downloaded successfully');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download session report');
    }
  };

  const handleClearAllSessions = async () => {
    setIsClearingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke('clear-translation-sessions', {
        body: { preserveProtected: true }
      });

      if (error) throw error;

      toast.success(data.message || 'Translation sessions cleared successfully');
      
      // Refresh the sessions list
      await loadSessions();
      
    } catch (error: any) {
      console.error('Error clearing sessions:', error);
      toast.error(error.message || 'Failed to clear translation sessions');
    } finally {
      setIsClearingAll(false);
    }
  };

  // Filter sessions based on search and filters
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // Search filter
      if (searchQuery && !session.session_title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Flagged filter
      if (showFlaggedOnly && !session.is_flagged) {
        return false;
      }

      // Protected filter
      if (showProtectedOnly && !session.is_protected) {
        return false;
      }

      // Language filter
      if (selectedLanguage !== 'all') {
        const sessionLanguages = session.session_metadata?.languages || [session.patient_language];
        if (!sessionLanguages.includes(selectedLanguage)) {
          return false;
        }
      }

      return true;
    });
  }, [sessions, searchQuery, showFlaggedOnly, showProtectedOnly, selectedLanguage]);

  const handleDeleteSession = async (sessionId: string, sessionTitle: string) => {
    setSessionToDelete({ id: sessionId, title: sessionTitle });
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    
    setDeletingSessionId(sessionToDelete.id);
    try {
      await deleteSession(sessionToDelete.id);
    } catch (error) {
      // Error already handled in hook
    } finally {
      setDeletingSessionId(null);
      setSessionToDelete(null);
    }
  };

  const handleToggleFlag = async (sessionId: string, currentFlag: boolean) => {
    try {
      await updateSession(sessionId, { is_flagged: !currentFlag });
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleToggleProtection = async (sessionId: string, currentProtection: boolean) => {
    try {
      await updateSession(sessionId, { is_protected: !currentProtection });
    } catch (error) {
      // Error already handled in hook
    }
  };

  const getSafetyIcon = (safetyRating: 'safe' | 'warning' | 'unsafe') => {
    switch (safetyRating) {
      case 'safe':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'unsafe':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy HH:mm');
    } catch {
      return 'Invalid date';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const generateSessionPreview = (session: TranslationSession) => {
    const metadata = session.session_metadata;
    const languages = metadata?.languages?.join(', ') || session.patient_language;
    const duration = formatDuration(metadata?.sessionDuration);

    return {
      overview: `${session.total_translations} phrases in ${languages}`,
      duration,
      languages,
      translationCount: session.total_translations,
      createdAt: session.created_at,
      details: {
        'Duration': duration,
        'Average Accuracy': metadata?.averageAccuracy ? `${metadata.averageAccuracy}%` : 'N/A',
        'Average Confidence': metadata?.averageConfidence ? `${metadata.averageConfidence}%` : 'N/A',
        'Safety Rating': metadata?.overallSafetyRating || 'Unknown',
        'Created': formatDate(session.created_at),
        'Last Updated': formatDate(session.updated_at)
      }
    };
  };

  return (
    <div className="w-80 border-l border-border bg-background flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Translation History
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-3">
          <Button
            variant={showFlaggedOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFlaggedOnly(!showFlaggedOnly)}
            className="flex items-center gap-1"
          >
            <Flag className="h-3 w-3" />
            Flagged
          </Button>
          <Button
            variant={showProtectedOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowProtectedOnly(!showProtectedOnly)}
            className="flex items-center gap-1"
          >
            <Shield className="h-3 w-3" />
            Protected
          </Button>
        </div>

        {/* Language Filter */}
        {availableLanguages.length > 0 && (
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="w-full p-2 border border-border rounded-md bg-background text-sm"
          >
            <option value="all">All Languages</option>
            {availableLanguages.map(lang => (
              <option key={lang} value={lang}>
                {lang.charAt(0).toUpperCase() + lang.slice(1)}
              </option>
            ))}
          </select>
        )}

        {/* Action Buttons */}
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full flex items-center gap-2"
            onClick={() => loadSessions()}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </>
            )}
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="w-full flex items-center gap-2"
                disabled={sessions.length === 0}
              >
                <Trash2 className="h-4 w-4" />
                Clear All Sessions
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear All Translation Sessions?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all non-protected translation sessions. 
                  Protected sessions (marked with <Shield className="h-4 w-4 inline text-blue-500" />) will be preserved.
                  
                  <div className="mt-4 p-3 bg-muted rounded-md">
                    <div className="text-sm space-y-1">
                      <div>Total sessions: <strong>{sessions.length}</strong></div>
                      <div>Protected sessions: <strong>{sessions.filter(s => s.is_protected).length}</strong></div>
                      <div className="text-destructive">Sessions to be deleted: <strong>{sessions.filter(s => !s.is_protected).length}</strong></div>
                    </div>
                  </div>
                  
                  <p className="mt-4 text-sm text-muted-foreground">
                    This action cannot be undone.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearAllSessions}
                  disabled={isClearingAll}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isClearingAll ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    'Clear All'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Delete Session Confirmation Dialog */}
      <AlertDialog open={!!sessionToDelete} onOpenChange={() => setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Translation Session?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{sessionToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSession}
              disabled={!!deletingSessionId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingSessionId ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sessions List */}
      <div className="flex-1 overflow-hidden">
        {loading && sessions.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">
            <p>Error loading sessions</p>
            <Button variant="outline" size="sm" onClick={() => loadSessions()} className="mt-2">
              Retry
            </Button>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <p>No translation sessions found</p>
            {sessions.length > 0 && (
              <p className="text-sm mt-1">Try adjusting your search or filters</p>
            )}
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {filteredSessions.map((session) => {
                const preview = generateSessionPreview(session);
                return (
                  <TooltipProvider key={session.id}>
                    <div className="border border-border rounded-lg p-3 hover:shadow-md transition-shadow bg-card">
                      {/* Header with title and badges */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-sm text-foreground truncate">
                            {session.session_title}
                          </h4>
                          <p className="text-xs text-muted-foreground truncate">
                            {preview.overview}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          {session.is_flagged && (
                            <Flag className="h-3 w-3 text-yellow-500" />
                          )}
                          {session.is_protected && (
                            <Shield className="h-3 w-3 text-blue-500" />
                          )}
                          {getSafetyIcon(session.session_metadata?.overallSafetyRating || 'safe')}
                        </div>
                      </div>

                      {/* Session Stats - Enhanced Display */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(session.created_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {session.total_translations} phrases
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Languages className="h-3 w-3" />
                            {preview.languages}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {preview.duration}
                          </span>
                        </div>
                      </div>

                      {/* Single navigation link and delete button */}
                      <div className="flex justify-between items-center gap-2 pt-2 border-t border-border/50">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('🔗 CLICK: Button clicked for session:', session.id);
                            console.log('🔗 CLICK: Session title:', session.session_title);
                            console.log('🔗 CLICK: Total translations:', session.total_translations);
                            console.log('🔗 CLICK: Navigating to:', `/gp-translation/${session.id}`);
                            navigate(`/gp-translation/${session.id}`);
                          }}
                          className="h-6 px-2 text-xs flex-1"
                        >
                          View #{session.id.substring(0, 8)}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(session.id, session.session_title);
                          }}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          disabled={deletingSessionId === session.id}
                        >
                          {deletingSessionId === session.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </TooltipProvider>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          {filteredSessions.length} of {totalCount} sessions
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadSessions({ offset: sessions.length })}
              className="ml-2"
              disabled={loading}
            >
              Load More
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};