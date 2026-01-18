import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Trash2, Clock, Type, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface DictationSession {
  id: string;
  content: string;
  template_type: string;
  title: string | null;
  word_count: number;
  duration_seconds: number;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

interface DictationHistoryPanelProps {
  sessions: DictationSession[];
  isLoading: boolean;
  onLoadSession: (session: DictationSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onRefresh: () => void;
  formatDuration: (secs: number) => string;
}

const TEMPLATE_LABELS: Record<string, string> = {
  'free': 'Free',
  'consultation': 'Consultation',
  'referral': 'Referral',
  'patient-letter': 'Patient Letter',
  'clinical-note': 'Clinical Note',
  'sick-note': 'Fit Note',
};

export function DictationHistoryPanel({
  sessions,
  isLoading,
  onLoadSession,
  onDeleteSession,
  onRefresh,
  formatDuration,
}: DictationHistoryPanelProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Recent Dictations ({sessions.length})
        </h3>
        <Button variant="ghost" size="sm" onClick={onRefresh} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No dictations yet</p>
          <p className="text-sm">Start dictating to build your history</p>
        </div>
      ) : (
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className={cn(
                  'p-3 cursor-pointer transition-all hover:border-primary/50 hover:bg-accent/50',
                  session.is_draft && 'border-dashed'
                )}
                onClick={() => onLoadSession(session)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">
                        {session.title || format(new Date(session.created_at), 'dd MMM yyyy, HH:mm')}
                      </span>
                      {session.is_draft && (
                        <Badge variant="secondary" className="text-xs">Draft</Badge>
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {session.content.substring(0, 150)}...
                    </p>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {TEMPLATE_LABELS[session.template_type] || 'Free'}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Type className="h-3 w-3" />
                        <span>{session.word_count} words</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDuration(session.duration_seconds)}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
