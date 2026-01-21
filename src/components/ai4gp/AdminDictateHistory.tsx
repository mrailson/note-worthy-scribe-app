import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, RefreshCw, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminDictationSession {
  id: string;
  content: string;
  cleaned_content: string | null;
  template_type: string;
  title: string | null;
  word_count: number;
  duration_seconds: number;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

interface AdminDictateHistoryProps {
  sessions: AdminDictationSession[];
  isLoading: boolean;
  onLoadSession: (session: AdminDictationSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onRefresh: () => void;
  formatDuration: (seconds: number) => string;
}

const TEMPLATE_LABELS: Record<string, string> = {
  'free': 'Free',
  'meeting-minutes': 'Meeting Minutes',
  'complaint-response': 'Complaint',
  'staff-letter': 'Staff Letter',
  'hr-record': 'HR Record',
  'significant-event': 'SEA',
  'policy-draft': 'Policy',
  'briefing-note': 'Briefing',
};

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function generateSummary(content: string, maxWords = 20): string {
  const cleaned = content.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  const words = cleaned.split(' ');
  if (words.length <= maxWords) return cleaned;
  return words.slice(0, maxWords).join(' ') + '...';
}

function formatSessionTitle(createdAt: string, content: string): string {
  const date = new Date(createdAt);
  const day = date.getDate();
  const month = date.toLocaleString('en-GB', { month: 'short' });
  const time = date.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' });
  
  const summary = generateSummary(content, 8);
  return `${day}${getOrdinalSuffix(day)} ${month} ${time} - ${summary}`;
}

export const AdminDictateHistory: React.FC<AdminDictateHistoryProps> = ({
  sessions,
  isLoading,
  onLoadSession,
  onDeleteSession,
  onRefresh,
  formatDuration,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="w-12 h-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-muted-foreground">No dictations yet</h3>
        <p className="text-sm text-muted-foreground/75 mt-1">
          Start dictating to see your history here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          {sessions.length} dictation{sessions.length !== 1 ? 's' : ''}
        </h3>
        <Button variant="ghost" size="sm" onClick={onRefresh} className="gap-2">
          <RefreshCw className="w-3 h-3" />
          Refresh
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 pr-4">
          {sessions.map((session) => (
            <Card
              key={session.id}
              className="p-3 cursor-pointer hover:bg-muted/50 transition-colors group"
              onClick={() => onLoadSession(session)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">
                      {session.title || formatSessionTitle(session.created_at, session.content)}
                    </span>
                    {session.is_draft && (
                      <Badge variant="secondary" className="text-xs">
                        Draft
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {generateSummary(session.content, 25)}
                  </p>
                  
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {TEMPLATE_LABELS[session.template_type] || session.template_type}
                    </Badge>
                    <span>{session.word_count} words</span>
                    <span>{formatDuration(session.duration_seconds)}</span>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
