import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChunkStatus } from "@/hooks/useChunkTracker";
import { BarChart3, Clock, MessageSquare, Target, TrendingUp, Filter } from "lucide-react";
import { format } from "date-fns";

interface ChunkStatusModalProps {
  chunks: ChunkStatus[];
  stats: {
    total: number;
    successful: number;
    lowConfidence: number;
    filtered: number;
    totalWords: number;
    avgConfidence: number;
    successRate: number;
  };
  onClear: () => void;
}

export function ChunkStatusModal({ chunks, stats, onClear }: ChunkStatusModalProps) {
  const getStatusColor = (status: ChunkStatus['status']) => {
    switch (status) {
      case 'success': return 'bg-green-500';
      case 'low_confidence': return 'bg-yellow-500';
      case 'filtered': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadgeVariant = (status: ChunkStatus['status']) => {
    switch (status) {
      case 'success': return 'default';
      case 'low_confidence': return 'secondary';
      case 'filtered': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="touch-manipulation min-h-[44px]">
          <BarChart3 className="h-4 w-4 mr-2" />
          Chunk Status ({chunks.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Transcript Chunk Analysis
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Total Chunks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">{stats.totalWords} words</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Success Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(stats.successRate)}%</div>
                <Progress value={stats.successRate} className="mt-1" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Avg Confidence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(stats.avgConfidence * 100)}%</div>
                <Progress value={stats.avgConfidence * 100} className="mt-1" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Low Quality
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.lowConfidence + stats.filtered}</div>
                <div className="text-xs text-muted-foreground">chunks processed</div>
              </CardContent>
            </Card>
          </div>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-green-500"></div>
                  <span>Success: {stats.successful}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-yellow-500"></div>
                  <span>Low Confidence: {stats.lowConfidence}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-red-500"></div>
                  <span>Filtered: {stats.filtered}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline View */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Chunk Timeline
              </CardTitle>
              <Button
                onClick={onClear}
                variant="outline"
                size="sm"
                disabled={chunks.length === 0}
              >
                Clear All
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {chunks.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No chunks recorded yet. Start recording to see chunk analysis.
                    </div>
                  ) : (
                    chunks.slice().reverse().map((chunk) => (
                      <div
                        key={chunk.id}
                        className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className={`w-2 h-2 rounded-full mt-2 ${getStatusColor(chunk.status)}`} />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-muted-foreground">
                              {format(chunk.timestamp, 'HH:mm:ss')}
                            </span>
                            <Badge variant={getStatusBadgeVariant(chunk.status)} className="text-xs">
                              {chunk.status.replace('_', ' ')}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {Math.round(chunk.confidence * 100)}%
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {chunk.wordCount} words
                            </Badge>
                            {chunk.speaker && (
                              <Badge variant="outline" className="text-xs">
                                {chunk.speaker}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-sm">
                            <span className={chunk.isFinal ? "" : "text-muted-foreground italic"}>
                              {chunk.text}
                            </span>
                          </div>
                          
                          {chunk.reason && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Reason: {chunk.reason}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}