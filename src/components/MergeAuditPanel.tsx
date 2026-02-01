import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Check, X, AlertTriangle, Layers } from 'lucide-react';
import { NormChunk, MergeResult } from '@/utils/BestOfBothMerger';

interface MergeAuditPanelProps {
  stats?: MergeResult['stats'];
  keptChunks?: NormChunk[];
  droppedChunks?: NormChunk[];
  isRecording?: boolean;
}

export const MergeAuditPanel: React.FC<MergeAuditPanelProps> = ({
  stats,
  keptChunks = [],
  droppedChunks = [],
  isRecording = false
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  if (!stats && keptChunks.length === 0 && droppedChunks.length === 0) {
    return null;
  }

  const totalChunks = (stats?.whisperChunks || 0) + (stats?.assemblyChunks || 0);
  const mergeEfficiency = totalChunks > 0 
    ? Math.round((stats?.keptCount || 0) / totalChunks * 100) 
    : 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed border-muted-foreground/30 bg-muted/20">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/40 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Merge Audit</CardTitle>
                {isRecording && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                    Live
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                {stats && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Check className="h-3 w-3 text-green-600" />
                      {stats.keptCount} kept
                    </span>
                    <span className="flex items-center gap-1">
                      <X className="h-3 w-3 text-red-500" />
                      {stats.droppedCount} dropped
                    </span>
                    {stats.overlapConflicts > 0 && (
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        {stats.overlapConflicts} conflicts
                      </span>
                    )}
                  </div>
                )}
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-4">
            {/* Stats Overview */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-background rounded-md p-2 text-center">
                  <div className="text-lg font-semibold text-blue-600">{stats.whisperChunks}</div>
                  <div className="text-xs text-muted-foreground">Whisper</div>
                </div>
                <div className="bg-background rounded-md p-2 text-center">
                  <div className="text-lg font-semibold text-purple-600">{stats.assemblyChunks}</div>
                  <div className="text-xs text-muted-foreground">Assembly</div>
                </div>
                <div className="bg-background rounded-md p-2 text-center">
                  <div className="text-lg font-semibold text-green-600">{stats.keptCount}</div>
                  <div className="text-xs text-muted-foreground">Kept</div>
                </div>
                <div className="bg-background rounded-md p-2 text-center">
                  <div className="text-lg font-semibold text-muted-foreground">{mergeEfficiency}%</div>
                  <div className="text-xs text-muted-foreground">Efficiency</div>
                </div>
              </div>
            )}

            {/* Dropped Chunks */}
            {droppedChunks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Dropped Chunks ({droppedChunks.length})
                </h4>
                <ScrollArea className="h-32 rounded-md border bg-background">
                  <div className="p-2 space-y-1">
                    {droppedChunks.slice(-20).map((chunk, i) => (
                      <div key={`dropped-${i}`} className="flex items-start gap-2 text-xs p-1 rounded hover:bg-muted/50">
                        <Badge 
                          variant="outline" 
                          className={`shrink-0 ${chunk.engine === 'assembly' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}
                        >
                          {chunk.engine === 'assembly' ? 'A' : 'W'}
                        </Badge>
                        <span className="text-muted-foreground truncate flex-1" title={chunk.text}>
                          {chunk.text.slice(0, 80)}{chunk.text.length > 80 ? '...' : ''}
                        </span>
                        <span className="text-muted-foreground/60 shrink-0">
                          {(chunk.conf * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Kept Chunks Preview */}
            {keptChunks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Kept Chunks (last 10)
                </h4>
                <ScrollArea className="h-24 rounded-md border bg-background">
                  <div className="p-2 space-y-1">
                    {keptChunks.slice(-10).map((chunk, i) => (
                      <div key={`kept-${i}`} className="flex items-start gap-2 text-xs p-1 rounded hover:bg-muted/50">
                        <Badge 
                          variant="outline" 
                          className={`shrink-0 ${chunk.engine === 'assembly' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}
                        >
                          {chunk.engine === 'assembly' ? 'A' : 'W'}
                        </Badge>
                        <span className="text-foreground truncate flex-1" title={chunk.text}>
                          {chunk.text.slice(0, 80)}{chunk.text.length > 80 ? '...' : ''}
                        </span>
                        <span className="text-green-600 shrink-0">
                          {(chunk.conf * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 text-[10px]">W</Badge>
                <span>Whisper</span>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="bg-purple-50 text-purple-700 text-[10px]">A</Badge>
                <span>Assembly</span>
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <span>Assembly-first policy • Jaccard 60% threshold</span>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
