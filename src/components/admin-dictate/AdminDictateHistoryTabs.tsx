import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  Clock, 
  Download,
  Loader2
} from 'lucide-react';
import { useAdminDictation } from '@/hooks/useAdminDictation';
import { format } from 'date-fns';

interface AdminDictateHistoryTabsProps {
  onLoadDictation?: (content: string, templateType: string) => void;
}

export const AdminDictateHistoryTabs: React.FC<AdminDictateHistoryTabsProps> = ({
  onLoadDictation
}) => {
  const { history: dictations, isLoadingHistory: loadingDictations } = useAdminDictation();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const exportDictation = (dictation: any) => {
    const content = dictation.cleaned_content || dictation.content;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dictation-${format(new Date(dictation.created_at), 'yyyy-MM-dd-HHmm')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          History
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-[400px]">
          {loadingDictations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : dictations.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No dictations yet</p>
              <p className="text-sm mt-1">Your dictation history will appear here</p>
            </div>
          ) : (
            <div className="space-y-2 pr-4">
              {dictations.map((dictation) => (
                <div
                  key={dictation.id}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {dictation.template_type}
                        </Badge>
                        {dictation.is_draft && (
                          <Badge variant="secondary" className="text-xs">
                            Draft
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium truncate">
                        {dictation.title || 'Untitled Dictation'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(dictation.created_at), 'dd MMM yyyy, HH:mm')} • {dictation.word_count} words • {formatDuration(dictation.duration_seconds)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {(dictation.cleaned_content || dictation.content).substring(0, 100)}...
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => exportDictation(dictation)}
                        title="Export"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {onLoadDictation && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => onLoadDictation(dictation.cleaned_content || dictation.content, dictation.template_type)}
                        >
                          Load
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
