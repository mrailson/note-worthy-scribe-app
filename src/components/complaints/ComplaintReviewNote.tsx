import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, ChevronDown, ChevronUp, Clock, User, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ComplaintReviewNoteProps {
  conversation: {
    id: string;
    conversation_summary: string;
    conversation_transcript: string;
    challenges_identified: any[];
    responses_given: any[];
    recommendations: any[];
    conversation_duration: number;
    conversation_started_at: string;
    conversation_ended_at: string;
    created_at: string;
    created_by: string;
    complaint_id: string;
  };
  reviewerName?: string;
  onRegenerate?: (newSummary: string) => void;
}

export function ComplaintReviewNote({
  conversation,
  reviewerName = 'System User',
  onRegenerate,
}: ComplaintReviewNoteProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'significant': return 'destructive';
      case 'moderate': return 'default';
      case 'minor': return 'secondary';
      default: return 'outline';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      toast.info('Regenerating executive summary with updated compliance focus...');
      
      const { data, error } = await supabase.functions.invoke('process-review-conversation', {
        body: {
          complaintId: conversation.complaint_id,
          transcript: conversation.conversation_transcript,
          challenges: conversation.challenges_identified,
          responses: conversation.responses_given,
          recommendations: conversation.recommendations,
          duration: conversation.conversation_duration,
          startedAt: conversation.conversation_started_at,
          endedAt: conversation.conversation_ended_at,
        },
      });

      if (error) throw error;

      // Update the conversation in the database
      const { error: updateError } = await supabase
        .from('complaint_review_conversations')
        .update({ conversation_summary: data.review_note })
        .eq('id', conversation.id);

      if (updateError) throw updateError;

      toast.success('Executive summary regenerated successfully');
      
      if (onRegenerate) {
        onRegenerate(data.review_note);
      } else {
        // Reload the page to show the new summary
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Error regenerating summary:', error);
      toast.error('Failed to regenerate summary: ' + (error.message || 'Unknown error'));
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    // Create a printable version
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Complaint Review Note</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
            h1 { color: #1a1a1a; border-bottom: 2px solid #333; padding-bottom: 10px; }
            h2 { color: #333; margin-top: 20px; }
            .metadata { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .metadata p { margin: 5px 0; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 12px; margin-right: 5px; }
            .badge-high { background: #fee; color: #c00; }
            .badge-medium { background: #fef5e7; color: #856404; }
            .badge-low { background: #e8f5e9; color: #2e7d32; }
            ul { line-height: 1.6; }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <h1>AI Complaint Review Conversation Record</h1>
          <div class="metadata">
            <p><strong>Review Date:</strong> ${formatDate(conversation.conversation_started_at)}</p>
            <p><strong>Reviewer:</strong> ${reviewerName}</p>
            <p><strong>Duration:</strong> ${formatDuration(conversation.conversation_duration)}</p>
            <p><strong>Challenges Identified:</strong> ${conversation.challenges_identified.length}</p>
            <p><strong>Recommendations Made:</strong> ${conversation.recommendations.length}</p>
          </div>
          <div>${conversation.conversation_summary}</div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">AI Critical Friend Review Record</CardTitle>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(conversation.conversation_started_at)}
              </div>
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {reviewerName}
              </div>
              <Badge variant="outline">{formatDuration(conversation.conversation_duration)}</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={isRegenerating}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isRegenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
            >
              <Download className="h-4 w-4 mr-1" />
              Download PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Executive Summary - Always visible with NHS Blue styling */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-nhs-blue tracking-tight">Executive Summary</h3>
            <Badge variant="secondary" className="text-xs font-medium">Audio Review</Badge>
          </div>
          <div className="bg-gradient-to-br from-nhs-blue/5 to-nhs-blue-light/5 p-6 rounded-lg border-l-4 border-nhs-blue shadow-sm">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({node, ...props}) => <h1 className="text-lg font-bold text-nhs-blue mb-3 mt-4 first:mt-0" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-base font-bold text-nhs-blue mb-2 mt-3" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-sm font-semibold text-nhs-blue mb-2 mt-3" {...props} />,
                  p: ({node, ...props}) => <p className="text-foreground leading-relaxed mb-3 last:mb-0" {...props} />,
                  ul: ({node, ...props}) => <ul className="space-y-1 mb-3" {...props} />,
                  ol: ({node, ...props}) => <ol className="space-y-1 mb-3" {...props} />,
                  li: ({node, ...props}) => <li className="text-foreground leading-relaxed" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-semibold text-nhs-blue" {...props} />,
                }}
              >
                {conversation.conversation_summary}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        {/* Detailed conversation record - Collapsed by default */}
        <div className="border-t border-nhs-blue/20 pt-5 space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full justify-between hover:bg-nhs-blue/5"
          >
            <span className="font-semibold text-nhs-blue">Detailed Conversation Record</span>
            {showDetails ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {showDetails && (
            <div className="space-y-4 pl-2">
              {/* Challenges section - Collapsible */}
              {conversation.challenges_identified.length > 0 && (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowChallenges(!showChallenges)}
                    className="w-full justify-between px-0"
                  >
                    <span className="font-semibold text-sm">Challenges Identified ({conversation.challenges_identified.length})</span>
                    {showChallenges ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  {showChallenges && (
                    <ul className="space-y-2 pl-2">
                      {conversation.challenges_identified.map((challenge: any, idx: number) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <Badge variant={getSeverityColor(challenge.severity)} className="mt-0.5">
                            {challenge.severity}
                          </Badge>
                          <span>{challenge.challenge}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Recommendations section - Collapsible */}
              {conversation.recommendations.length > 0 && (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRecommendations(!showRecommendations)}
                    className="w-full justify-between px-0"
                  >
                    <span className="font-semibold text-sm">Recommendations ({conversation.recommendations.length})</span>
                    {showRecommendations ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  {showRecommendations && (
                    <ul className="space-y-2 pl-2">
                      {conversation.recommendations.map((rec: any, idx: number) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <Badge variant={getPriorityColor(rec.priority)} className="mt-0.5">
                            {rec.priority}
                          </Badge>
                          <span>{rec.recommendation}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Transcript section - Collapsible */}
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="w-full justify-between px-0"
                >
                  <span className="font-semibold text-sm">Full Conversation Transcript</span>
                  {showTranscript ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
                {showTranscript && (
                  <div className="p-3 bg-muted/30 rounded-lg max-h-96 overflow-y-auto">
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                      {conversation.conversation_transcript}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
