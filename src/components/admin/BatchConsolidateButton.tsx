import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Database, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface ConsolidationResult {
  meetingId: string;
  status: 'success' | 'error';
  chunksProcessed?: number;
  cleanedChunks?: number;
  pendingChunks?: number;
  totalWords?: number;
  transcriptLength?: number;
  error?: string;
}

export const BatchConsolidateButton: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{
    totalMeetings: number;
    successCount: number;
    errorCount: number;
    results: ConsolidationResult[];
  } | null>(null);

  const handleBatchConsolidate = async () => {
    if (!confirm('This will consolidate chunks for ALL meetings in the system. This may take several minutes. Continue?')) {
      return;
    }

    setIsProcessing(true);
    setResults(null);

    try {
      console.log('🔄 Starting batch consolidation...');

      const { data, error } = await supabase.functions.invoke('batch-consolidate-meetings');

      if (error) {
        console.error('Batch consolidation error:', error);
        toast.error('Failed to consolidate meetings');
        return;
      }

      if (data?.success) {
        setResults(data);
        toast.success(`Consolidated ${data.successCount} meetings successfully!`);
      } else {
        toast.error('Batch consolidation failed');
      }
    } catch (error) {
      console.error('Error during batch consolidation:', error);
      toast.error('Failed to consolidate meetings');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Batch Consolidate All Meetings</h3>
            <p className="text-sm text-muted-foreground">
              This will process all meetings with transcription chunks and consolidate them into complete transcripts.
              This recovers any lost transcript data from chunks that didn't make it into the final transcript.
            </p>
          </div>

          <Button
            onClick={handleBatchConsolidate}
            disabled={isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Consolidate All Meetings
              </>
            )}
          </Button>
        </div>
      </Card>

      {results && (
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Results</h3>
              <div className="flex gap-2">
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {results.successCount} Success
                </Badge>
                {results.errorCount > 0 && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    {results.errorCount} Errors
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Meetings</p>
                <p className="text-2xl font-semibold">{results.totalMeetings}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Succeeded</p>
                <p className="text-2xl font-semibold text-green-600">{results.successCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Failed</p>
                <p className="text-2xl font-semibold text-red-600">{results.errorCount}</p>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Detailed Results
              </h4>
              <ScrollArea className="h-64 rounded-md border">
                <div className="p-4 space-y-2">
                  {results.results.map((result, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        result.status === 'success'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-mono text-xs">{result.meetingId}</p>
                          {result.status === 'success' && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {result.chunksProcessed} chunks ({result.cleanedChunks} cleaned, {result.pendingChunks} pending) → {result.totalWords?.toLocaleString()} words
                            </p>
                          )}
                          {result.status === 'error' && (
                            <p className="text-xs text-red-600 mt-1">{result.error}</p>
                          )}
                        </div>
                        <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
                          {result.status === 'success' ? (
                            <CheckCircle className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
