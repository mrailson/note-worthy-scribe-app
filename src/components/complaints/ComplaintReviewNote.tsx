import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, ChevronDown, ChevronUp, Clock, User } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

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
    created_at: string;
    created_by: string;
  };
  reviewerName?: string;
}

export function ComplaintReviewNote({
  conversation,
  reviewerName = 'System User',
}: ComplaintReviewNoteProps) {
  const [showTranscript, setShowTranscript] = useState(false);

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
            <CardTitle className="text-lg">AI Review Conversation Record</CardTitle>
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
          >
            <Download className="h-4 w-4 mr-1" />
            Download PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary statistics */}
        <div className="grid grid-cols-3 gap-4 p-3 bg-muted/30 rounded-lg">
          <div>
            <div className="text-xs text-muted-foreground">Challenges Identified</div>
            <div className="text-2xl font-bold">{conversation.challenges_identified.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Responses Given</div>
            <div className="text-2xl font-bold">{conversation.responses_given.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Recommendations</div>
            <div className="text-2xl font-bold">{conversation.recommendations.length}</div>
          </div>
        </div>

        {/* Review note content */}
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{conversation.conversation_summary}</ReactMarkdown>
        </div>

        {/* Challenges with severity badges */}
        {conversation.challenges_identified.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Challenges Identified:</h4>
            <ul className="space-y-1">
              {conversation.challenges_identified.map((challenge: any, idx: number) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <Badge variant={getSeverityColor(challenge.severity)} className="mt-0.5">
                    {challenge.severity}
                  </Badge>
                  <span>{challenge.challenge}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations with priority badges */}
        {conversation.recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Recommendations:</h4>
            <ul className="space-y-1">
              {conversation.recommendations.map((rec: any, idx: number) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <Badge variant={getPriorityColor(rec.priority)} className="mt-0.5">
                    {rec.priority}
                  </Badge>
                  <span>{rec.recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Transcript toggle */}
        <div className="border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full justify-between"
          >
            <span>Conversation Transcript</span>
            {showTranscript ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          {showTranscript && (
            <div className="mt-3 p-3 bg-muted/30 rounded-lg max-h-96 overflow-y-auto">
              <pre className="text-xs whitespace-pre-wrap font-mono">
                {conversation.conversation_transcript}
              </pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
