import { useState } from 'react';
import { format } from 'date-fns';
import { History, Trash2, Download, ChevronDown, ChevronUp, Heart, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BPSession } from '@/hooks/useBPHistory';
import { BPReading } from '@/hooks/useBPCalculator';

interface BPHistorySectionProps {
  sessions: BPSession[];
  isLoading: boolean;
  onDelete: (sessionId: string) => void;
  onLoadSession: (readings: BPReading[], mode: 'standard' | 'sit-stand') => void;
}

export const BPHistorySection = ({ 
  sessions, 
  isLoading, 
  onDelete,
  onLoadSession
}: BPHistorySectionProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getCategoryBadgeVariant = (category: string | null) => {
    if (!category) return 'secondary';
    if (category.toLowerCase().includes('normal')) return 'default';
    if (category.toLowerCase().includes('stage 1') || category.toLowerCase().includes('elevated')) return 'secondary';
    if (category.toLowerCase().includes('stage 2') || category.toLowerCase().includes('severe')) return 'destructive';
    return 'secondary';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading history...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Heart className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No previous BP sessions found.</p>
            <p className="text-sm mt-1">Sessions are saved automatically when you calculate averages.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          History
          <Badge variant="outline" className="ml-2">{sessions.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.map((session) => (
          <Collapsible
            key={session.id}
            open={expandedId === session.id}
            onOpenChange={(open) => setExpandedId(open ? session.id : null)}
          >
            <div className="border rounded-lg p-3 bg-card hover:bg-muted/50 transition-colors">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {session.avg_systolic?.toFixed(0)}/{session.avg_diastolic?.toFixed(0)} mmHg
                        </span>
                        {session.mode === 'sit-stand' && (
                          <Badge variant="outline" className="text-xs">
                            <ArrowUpDown className="h-3 w-3 mr-1" />
                            Sit/Stand
                          </Badge>
                        )}
                        {session.nhs_category && (
                          <Badge variant={getCategoryBadgeVariant(session.nhs_category)} className="text-xs">
                            {session.nhs_category}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(session.created_at), "HH:mm 'on' dd/MM/yyyy")} • {session.included_count} readings
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {expandedId === session.id ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="pt-3 mt-3 border-t">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Systolic Range</div>
                    <div className="font-medium">{session.systolic_min} – {session.systolic_max}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Diastolic Range</div>
                    <div className="font-medium">{session.diastolic_min} – {session.diastolic_max}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Avg Pulse</div>
                    <div className="font-medium">{session.avg_pulse?.toFixed(0) || '—'} bpm</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">NICE Home BP</div>
                    <div className="font-medium">
                      {session.nice_systolic && session.nice_diastolic 
                        ? `${session.nice_systolic.toFixed(0)}/${session.nice_diastolic.toFixed(0)}`
                        : '—'
                      }
                    </div>
                  </div>
                </div>

                {session.mode === 'sit-stand' && session.sit_stand_averages && (
                  <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-2">Postural Assessment</div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Sitting:</span>{' '}
                        <span className="font-medium">
                          {session.sit_stand_averages.sitting?.systolic?.toFixed(0)}/
                          {session.sit_stand_averages.sitting?.diastolic?.toFixed(0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Standing:</span>{' '}
                        <span className="font-medium">
                          {session.sit_stand_averages.standing?.systolic?.toFixed(0)}/
                          {session.sit_stand_averages.standing?.diastolic?.toFixed(0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Drop:</span>{' '}
                        <span className="font-medium">
                          {session.sit_stand_averages.posturalDrop?.systolic?.toFixed(0)}/
                          {session.sit_stand_averages.posturalDrop?.diastolic?.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onLoadSession(session.readings, session.mode)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Load Readings
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDelete(session.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </CardContent>
    </Card>
  );
};
