import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Download, CheckCircle2, Clock, AlertCircle, TrendingUp, ThumbsUp, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { downloadComplaintReport } from '@/utils/downloadComplaintReport';

interface AIReportData {
  complaintOverview: string;
  timelineCompliance: {
    acknowledged: {
      date: string;
      status: 'on-time' | 'late' | 'pending';
      daysFromReceived: number;
    };
    outcome: {
      date: string;
      status: 'on-time' | 'late' | 'pending';
      daysFromReceived: number;
    };
  };
  keyLearnings: Array<{
    learning: string;
    category: string;
    impact: 'high' | 'medium' | 'low';
  }>;
  practiceStrengths: string[];
  improvementSuggestions: Array<{
    suggestion: string;
    rationale: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  outcomeRationale: string;
}

export default function ComplaintAIReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<AIReportData | null>(null);
  const [complaint, setComplaint] = useState<any>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Date>(new Date());

  useEffect(() => {
    if (id) {
      loadReportData();
    }
  }, [id]);

  const loadReportData = async () => {
    try {
      setLoading(true);

      // Fetch complaint details
      const { data: complaintData, error: complaintError } = await supabase
        .from('complaints')
        .select(`
          *,
          complaint_outcomes (*),
          complaint_acknowledgements (*),
          complaint_notes (*),
          complaint_involved_parties (*)
        `)
        .eq('id', id)
        .single();

      if (complaintError) throw complaintError;
      setComplaint(complaintData);

      // Generate AI report
      const { data: aiReport, error: aiError } = await supabase.functions.invoke(
        'generate-complaint-ai-report',
        { body: { complaintId: id } }
      );

      if (aiError) {
        const errorMessage = aiError.message || 'Unknown error';
        console.error('Error loading report:', aiError);
        
        if (errorMessage.includes('Rate limit')) {
          toast.error('AI service rate limit reached. Please try again in a few moments.');
        } else if (errorMessage.includes('credits exhausted')) {
          toast.error('AI credits exhausted. Please add credits in your workspace settings.');
        } else if (errorMessage.includes('Failed to connect')) {
          toast.error('Unable to connect to AI service. Please try again in a moment.');
        } else {
          toast.error('Failed to generate AI report. Please try again.');
        }
        throw aiError;
      }
      setReportData(aiReport);
      setGeneratedAt(new Date());
    } catch (error) {
      console.error('Error loading report:', error);
      toast.error('Failed to load AI report');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    await loadReportData();
    setRegenerating(false);
    toast.success('Report regenerated successfully');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'on-time':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'late':
        return <AlertCircle className="h-5 w-5 text-amber-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const handleDownload = async () => {
    if (!reportData || !complaint) return;
    try {
      await downloadComplaintReport(reportData, complaint);
      toast.success('Report downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download report');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Clock className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Generating AI report...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!reportData || !complaint) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Unable to load report data</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(`/complaints/${id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Complaint
        </Button>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
            Regenerate Report
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download Report
          </Button>
        </div>
      </div>

      {/* Title Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-3xl mb-2">Complaint Review Report</CardTitle>
              <p className="text-muted-foreground">
                Reference: <span className="font-semibold text-foreground">{complaint.reference_number}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Received: <span className="font-semibold text-foreground">
                  {format(new Date(complaint.received_at || complaint.created_at), 'dd MMMM yyyy')}
                </span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Generated on {format(generatedAt, 'dd MMMM yyyy HH:mm')}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1 italic">
                This report is advisory and requires human review
              </p>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              {complaint.category}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Complaint Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-1 bg-primary rounded-full" />
            Complaint Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <p className="text-foreground leading-relaxed whitespace-pre-wrap">
            {reportData.complaintOverview}
          </p>
        </CardContent>
      </Card>

      {/* Timeline Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-1 bg-primary rounded-full" />
            Timeline & Compliance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Acknowledgement */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {getStatusIcon(reportData.timelineCompliance.acknowledged.status)}
                <div>
                  <p className="font-semibold text-foreground">Acknowledgement</p>
                  <p className="text-sm text-muted-foreground">
                    {reportData.timelineCompliance.acknowledged.date 
                      ? format(new Date(reportData.timelineCompliance.acknowledged.date), 'dd MMM yyyy')
                      : 'Not yet acknowledged'}
                  </p>
                </div>
              </div>
              <div className="ml-8 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">
                    {reportData.timelineCompliance.acknowledged.daysFromReceived} days
                  </span>
                  {' '}from receipt
                </p>
                <Badge 
                  variant="outline" 
                  className={`mt-2 ${
                    reportData.timelineCompliance.acknowledged.status === 'on-time' 
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {reportData.timelineCompliance.acknowledged.status === 'on-time' 
                    ? 'Within 3 days' 
                    : 'Outside target'}
                </Badge>
              </div>
            </div>

            {/* Outcome */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {getStatusIcon(reportData.timelineCompliance.outcome.status)}
                <div>
                  <p className="font-semibold text-foreground">Outcome Letter</p>
                  <p className="text-sm text-muted-foreground">
                    {reportData.timelineCompliance.outcome.date 
                      ? format(new Date(reportData.timelineCompliance.outcome.date), 'dd MMM yyyy')
                      : 'Not yet completed'}
                  </p>
                </div>
              </div>
              <div className="ml-8 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">
                    {reportData.timelineCompliance.outcome.daysFromReceived} days
                  </span>
                  {' '}from receipt
                </p>
                <Badge 
                  variant="outline"
                  className={`mt-2 ${
                    reportData.timelineCompliance.outcome.status === 'on-time' 
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : reportData.timelineCompliance.outcome.status === 'late'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-gray-50 text-gray-700 border-gray-200'
                  }`}
                >
                  {reportData.timelineCompliance.outcome.status === 'on-time' 
                    ? 'Within guidelines' 
                    : reportData.timelineCompliance.outcome.status === 'late'
                    ? 'Outside target'
                    : 'In progress'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Learnings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-1 bg-primary rounded-full" />
            Key Learnings Identified
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reportData.keyLearnings.map((learning, index) => (
              <div key={index} className="flex gap-4 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                <div className="flex-shrink-0">
                  <TrendingUp className="h-5 w-5 text-primary mt-1" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <p className="font-medium text-foreground">{learning.learning}</p>
                    <Badge variant="outline" className={getPriorityColor(learning.impact)}>
                      {learning.impact} impact
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Category: <span className="font-medium text-foreground">{learning.category}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Practice Strengths */}
      <Card className="border-green-200 bg-green-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-900">
            <ThumbsUp className="h-5 w-5" />
            What the Practice Did Well
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {reportData.practiceStrengths.map((strength, index) => (
              <li key={index} className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-foreground">{strength}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Improvement Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-1 bg-primary rounded-full" />
            Supportive Quality Improvement Suggestions
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            These suggestions are provided to support continuous improvement, not as criticism
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {reportData.improvementSuggestions.map((suggestion, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className={getPriorityColor(suggestion.priority)}>
                    {suggestion.priority}
                  </Badge>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground mb-2">{suggestion.suggestion}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {suggestion.rationale}
                    </p>
                  </div>
                </div>
                {index < reportData.improvementSuggestions.length - 1 && (
                  <Separator className="mt-4" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Outcome Rationale */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-1 bg-primary rounded-full" />
            Outcome Decision Rationale
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground leading-relaxed whitespace-pre-wrap">
            {reportData.outcomeRationale}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
