import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronRight, CheckCircle, XCircle, Edit3, Volume2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';

interface LowConfidenceChunk {
  id: string;
  chunk_number: number;
  transcription_text: string;
  confidence: number;
  original_confidence: number;
  transcriber_type: string;
  filter_reason: string;
  contextual_relevance_score?: number;
  ai_suggested_restoration?: boolean;
  user_action?: string;
  user_edited_text?: string;
  created_at: string;
  processed_at?: string;
}

interface LowConfidenceReviewProps {
  meetingId: string;
  sessionId: string;
  userId: string;
}

export function LowConfidenceReview({ meetingId, sessionId, userId }: LowConfidenceReviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [chunks, setChunks] = useState<LowConfidenceChunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingAI, setProcessingAI] = useState(false);
  const [editingChunk, setEditingChunk] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    if (isExpanded) {
      fetchLowConfidenceChunks();
    }
  }, [isExpanded, meetingId, sessionId]);

  const fetchLowConfidenceChunks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('low_confidence_chunks')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('session_id', sessionId)
        .order('chunk_number', { ascending: true });

      if (error) throw error;
      setChunks(data || []);
    } catch (error) {
      console.error('Error fetching low-confidence chunks:', error);
      showToast.error('Failed to load low-confidence chunks', { section: 'meeting_manager' });
    } finally {
      setLoading(false);
    }
  };

  const triggerAIProcessing = async () => {
    setProcessingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-context-restorer', {
        body: {
          meetingId,
          sessionId,
          batchSize: 20
        }
      });

      if (error) throw error;

      showToast.success(`AI processed ${data.processedCount} chunks, auto-restored ${data.restoredCount} chunks`, { section: 'meeting_manager' });
      await fetchLowConfidenceChunks(); // Refresh the list
    } catch (error) {
      console.error('Error triggering AI processing:', error);
      showToast.error('Failed to process chunks with AI', { section: 'meeting_manager' });
    } finally {
      setProcessingAI(false);
    }
  };

  const handleChunkAction = async (chunk: LowConfidenceChunk, action: string, editedText?: string) => {
    try {
      let updateData: any = { user_action: action };

      if (action === 'restored' || action === 'edited_restored') {
        // Add to main transcript
        const transcriptText = editedText || chunk.transcription_text;
        const { error: insertError } = await supabase
          .from('meeting_transcription_chunks')
          .insert({
            meeting_id: meetingId,
            session_id: sessionId,
            user_id: userId,
            chunk_number: chunk.chunk_number,
            transcription_text: transcriptText,
            confidence: Math.min(chunk.confidence + 0.1, 0.95), // Slight confidence boost
            created_at: chunk.created_at
          });

        if (insertError) throw insertError;

        if (editedText) {
          updateData.user_edited_text = editedText;
        }
      }

      // Update the low-confidence chunk status
      const { error: updateError } = await supabase
        .from('low_confidence_chunks')
        .update(updateData)
        .eq('id', chunk.id);

      if (updateError) throw updateError;

      showToast.success(`Chunk ${action.replace('_', ' ')}`, { section: 'meeting_manager' });
      await fetchLowConfidenceChunks();
    } catch (error) {
      console.error('Error handling chunk action:', error);
      showToast.error('Failed to update chunk', { section: 'meeting_manager' });
    }
  };

  const startEditing = (chunk: LowConfidenceChunk) => {
    setEditingChunk(chunk.id);
    setEditText(chunk.user_edited_text || chunk.transcription_text);
  };

  const saveEdit = async (chunk: LowConfidenceChunk) => {
    await handleChunkAction(chunk, 'edited_restored', editText);
    setEditingChunk(null);
    setEditText('');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  const getRelevanceColor = (score?: number) => {
    if (!score) return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    if (score >= 0.8) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (score >= 0.6) return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  const pendingChunks = chunks.filter(c => !c.user_action);
  const processedChunks = chunks.filter(c => c.user_action);

  return (
    <Card className="mt-4">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Low Confidence Review (Optional)
                {chunks.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {pendingChunks.length} pending
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerAIProcessing();
                  }}
                  disabled={processingAI || pendingChunks.length === 0}
                >
                  {processingAI ? 'Processing...' : '🤖 AI Review'}
                </Button>
                {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {loading ? (
              <div className="text-center py-4">Loading...</div>
            ) : chunks.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No low-confidence chunks captured yet. All transcription is being processed successfully!
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  This section shows audio segments that were filtered out due to low confidence or quality issues. 
                  Review these segments to restore any valuable content or confirm they should remain filtered.
                </div>

                {pendingChunks.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Pending Review ({pendingChunks.length})</h4>
                    <div className="space-y-2">
                      {pendingChunks.map((chunk) => (
                        <div key={chunk.id} className="border rounded p-3 bg-card">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Badge variant="outline">#{chunk.chunk_number}</Badge>
                              <Badge className={getConfidenceColor(chunk.confidence)}>
                                {Math.round(chunk.confidence * 100)}% conf
                              </Badge>
                              {chunk.contextual_relevance_score && (
                                <Badge className={getRelevanceColor(chunk.contextual_relevance_score)}>
                                  {Math.round(chunk.contextual_relevance_score * 100)}% relevant
                                </Badge>
                              )}
                              <Badge variant="outline">{chunk.filter_reason}</Badge>
                              {chunk.ai_suggested_restoration && (
                                <Badge className="bg-blue-100 text-blue-800">AI Suggests Restore</Badge>
                              )}
                            </div>
                          </div>

                          {editingChunk === chunk.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="min-h-16"
                                placeholder="Edit the transcription text..."
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => saveEdit(chunk)}>
                                  Save & Restore
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingChunk(null)}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="bg-muted/50 p-2 rounded text-sm font-mono mb-3">
                                "{chunk.transcription_text}"
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handleChunkAction(chunk, 'restored')}
                                  className="text-green-600 hover:bg-green-50"
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Restore
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => startEditing(chunk)}
                                  className="text-blue-600 hover:bg-blue-50"
                                >
                                  <Edit3 className="h-3 w-3 mr-1" />
                                  Edit & Restore
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handleChunkAction(chunk, 'ignored')}
                                  className="text-gray-600 hover:bg-gray-50"
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Keep Filtered
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handleChunkAction(chunk, 'marked_silence')}
                                  className="text-orange-600 hover:bg-orange-50"
                                >
                                  <Volume2 className="h-3 w-3 mr-1" />
                                  Mark as Silence
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {processedChunks.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Processed ({processedChunks.length})</h4>
                    <div className="space-y-2">
                      {processedChunks.slice(0, 5).map((chunk) => (
                        <div key={chunk.id} className="border rounded p-3 bg-muted/20">
                          <div className="flex items-center gap-2 text-sm mb-1">
                            <Badge variant="outline">#{chunk.chunk_number}</Badge>
                            <Badge 
                              className={
                                chunk.user_action === 'restored' || chunk.user_action === 'edited_restored' || chunk.user_action === 'ai_restored'
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }
                            >
                              {chunk.user_action?.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="text-sm font-mono">
                            "{chunk.user_edited_text || chunk.transcription_text}"
                          </div>
                        </div>
                      ))}
                      {processedChunks.length > 5 && (
                        <div className="text-sm text-muted-foreground text-center py-2">
                          ... and {processedChunks.length - 5} more processed chunks
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}