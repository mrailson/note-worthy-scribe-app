import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
} from "@/components/ui/alert-dialog";
import {
  Search,
  Filter,
  Flag,
  Shield,
  Trash2,
  Download,
  Languages,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  X,
  Calendar,
  Users,
  FileText,
  Loader2
} from 'lucide-react';
import { useTranslationHistory, TranslationSession } from '@/hooks/useTranslationHistory';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { downloadDOCX, SessionMetadata } from '@/utils/docxExport';
import { TranslationEntry } from '@/components/TranslationHistory';
import { TranslationScore } from '@/utils/translationScoring';
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
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);

  const handleDownloadSession = async (session: TranslationSession) => {
    try {
      // Try to load session details, but fallback to session data if it fails
      let translations: TranslationEntry[] = [];
      let sessionDetails;
      
      try {
        sessionDetails = await loadSessionDetails(session.id);
        translations = sessionDetails.translations || [];
      } catch (loadError) {
        console.warn('Could not load detailed session data, using basic session info:', loadError);
        // Create a basic translation entry when detailed data isn't available
        translations = [];
      }

      // Create session metadata
      const metadata: SessionMetadata = {
        sessionDate: new Date(session.created_at),
        sessionStart: new Date(session.session_start),
        sessionEnd: session.session_end ? new Date(session.session_end) : new Date(),
        patientLanguage: session.patient_language,
        totalTranslations: session.total_translations,
        sessionDuration: session.session_metadata?.sessionDuration || 0,
        overallSafetyRating: session.session_metadata?.overallSafetyRating || 'safe',
        averageAccuracy: session.session_metadata?.averageAccuracy || 100,
        averageConfidence: session.session_metadata?.averageConfidence || 100,
      };

      // Create translation scores from session metadata or defaults
      const translationScores: TranslationScore[] = translations.map((t, index) => ({
        accuracy: t.accuracy || 100,
        confidence: t.confidence || 100,
        safetyFlag: t.safetyFlag || 'safe' as const,
        medicalTermsDetected: t.medicalTermsDetected || [],
        issues: (t as any).detectedIssues || [],
        detectedIssues: (t as any).detectedIssues || []
      }));

      // If no translations available, create a basic document with session info
      if (translations.length === 0) {
        translations = [{
          id: '1',
          speaker: 'gp' as const,
          originalText: 'Session summary not available - detailed translations could not be loaded',
          translatedText: 'Resumen de la sesión no disponible - no se pudieron cargar las traducciones detalladas',
          originalLanguage: 'English',
          targetLanguage: session.patient_language || 'Spanish',
          timestamp: new Date(session.session_start)
        }];
      }

      await downloadDOCX(translations, metadata, translationScores);
      toast.success('Session report downloaded successfully');
      
    } catch (error) {
      console.error('Error downloading session:', error);
      toast.error('Failed to download session report');
    }
  };

  const handleClearAllSessions = async () => {
    try {
      setIsClearingAll(true);
      
      const { data, error } = await supabase.functions.invoke('clear-translation-sessions');
      
      if (error) throw error;

      // Reload sessions to reflect changes
      await loadSessions({ limit: 50, offset: 0 });
      
      toast.success(data.message || 'Successfully cleared translation sessions');
      
    } catch (error) {
      console.error('Error clearing sessions:', error);
      toast.error('Failed to clear all sessions');
    } finally {
      setIsClearingAll(false);
    }
  };

  // Get unique languages from sessions
  const availableLanguages = useMemo(() => {
    const languages = new Set<string>();
    sessions.forEach(session => {
      if (session.session_metadata?.languages) {
        session.session_metadata.languages.forEach(lang => languages.add(lang));
      } else if (session.patient_language && session.patient_language !== 'multiple') {
        languages.add(session.patient_language);
      }
    });
    return Array.from(languages).sort();
  }, [sessions]);

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
    if (window.confirm(`Are you sure you want to delete "${sessionTitle}"?`)) {
      setDeletingSessionId(sessionId);
      try {
        await deleteSession(sessionId);
      } catch (error) {
        // Error already handled in hook
      } finally {
        setDeletingSessionId(null);
      }
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

  const generateSessionPreview = (session: TranslationSession) => {
    const metadata = session.session_metadata;
    const languages = metadata?.languages?.join(', ') || session.patient_language;
    const duration = metadata?.sessionDuration ? 
      `${Math.floor(metadata.sessionDuration / 60)}m ${metadata.sessionDuration % 60}s` : 
      'Unknown duration';

    return {
      overview: `${session.total_translations} translations in ${languages}`,
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

        {/* Clear All Button */}
        <div className="mt-3 pt-3 border-t border-border">
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

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {error && (
          <Alert className="m-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading sessions...</span>
          </div>
        )}

        <ScrollArea className="h-full">
          <div className="p-4 space-y-3">
            {filteredSessions.length === 0 && !loading && (
              <div className="text-center text-muted-foreground py-8">
                <Languages className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No translation sessions found</p>
                {searchQuery && (
                  <p className="text-xs mt-1">Try adjusting your search or filters</p>
                )}
              </div>
            )}

            {filteredSessions.map((session) => {
              const preview = generateSessionPreview(session);
              const isCurrentSession = currentSessionId === session.id;

              console.log('🔍 SIDEBAR: Rendering session in list:', {
                id: session.id,
                title: session.session_title,
                totalTranslations: session.total_translations,
                sessionStart: session.session_start,
                preview: preview.overview
              });

              return (
                <TooltipProvider key={session.id}>
                  <div
                    className={`
                      p-3 border border-border rounded-lg hover:border-primary/50 transition-colors
                      ${isCurrentSession ? 'bg-primary/5 border-primary' : 'bg-card'}
                    `}
                  >
                    {/* Session Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">
                          {session.session_title}
                        </h3>
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

                    {/* Session Stats */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {session.total_translations}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(session.created_at)}
                      </span>
                    </div>

                    {/* Single navigation link */}
                    <div className="flex justify-center pt-2 border-t border-border/50">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('🔗 CLICK: Button clicked for session:', session.id);
                          console.log('🔗 CLICK: Session title:', session.session_title);
                          console.log('🔗 CLICK: Total translations:', session.total_translations);
                          console.log('🔗 CLICK: Navigating to:', `/translation-tool/${session.id}`);
                          navigate(`/translation-tool/${session.id}`);
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        View #{session.id.substring(0, 8)}
                      </Button>
                    </div>

                    {/* Detailed Preview Tooltip */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="absolute inset-0" />
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        <div className="space-y-2">
                          <p className="font-medium">{session.session_title}</p>
                          <div className="space-y-1 text-xs">
                            {Object.entries(preview.details).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="text-muted-foreground">{key}:</span>
                                <span>{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              );
            })}
          </div>
        </ScrollArea>
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
            >
              Load more
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};