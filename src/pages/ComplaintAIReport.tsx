import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Download, CheckCircle2, Clock, AlertCircle, TrendingUp, ThumbsUp, RefreshCw, Mail } from 'lucide-react';
import { ComplaintAudioOverviewPlayer } from '@/components/complaints/ComplaintAudioOverviewPlayer';
import { showToast } from '@/utils/toastWrapper';
import { format } from 'date-fns';
import { downloadComplaintReport } from '@/utils/downloadComplaintReport';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType } from 'docx';

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
  const [emailSending, setEmailSending] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Date>(new Date());
  const [audioOverview, setAudioOverview] = useState<any>(null);

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

      // Fetch audio overview if available
      const { data: audioData } = await supabase
        .from('complaint_audio_overviews')
        .select('*')
        .eq('complaint_id', id)
        .maybeSingle();

      if (audioData) {
        setAudioOverview(audioData);
      }

      // Generate AI report
      const { data: aiReport, error: aiError } = await supabase.functions.invoke(
        'generate-complaint-ai-report',
        { body: { complaintId: id } }
      );

      if (aiError) {
        const errorMessage = aiError.message || 'Unknown error';
        console.error('Error loading report:', aiError);
        
        if (errorMessage.includes('Rate limit')) {
          showToast.error('AI service rate limit reached. Please try again in a few moments.');
        } else if (errorMessage.includes('credits exhausted')) {
          showToast.error('AI credits exhausted. Please add credits in your workspace settings.');
        } else if (errorMessage.includes('Failed to connect')) {
          showToast.error('Unable to connect to AI service. Please try again in a moment.');
        } else {
          showToast.error('Failed to generate AI report. Please try again.');
        }
        throw aiError;
      }
      setReportData(aiReport);
      setGeneratedAt(new Date());
    } catch (error) {
      console.error('Error loading report:', error);
      showToast.error('Failed to load AI report');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    await loadReportData();
    setRegenerating(false);
    showToast.success('Report regenerated successfully', { section: 'complaints' });
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
      showToast.success('Report downloaded successfully', { section: 'complaints' });
    } catch (error) {
      console.error('Download error:', error);
      showToast.error('Failed to download report');
    }
  };

  const handleEmailReport = async () => {
    if (!reportData || !complaint) return;
    
    try {
      setEmailSending(true);
      
      // Generate Word document content
      const wordDocContent = generateWordDocContent(reportData, complaint);
      
      // Generate HTML message
      const htmlMessage = generateEmailHTML(reportData, complaint);
      
      // Generate proper DOCX as base64
      const base64Content = await generateComplaintDocxBase64(reportData, complaint);
      
      const receivedDate = complaint.received_at || complaint.created_at;
      
      const { error } = await supabase.functions.invoke('send-email-via-emailjs', {
        body: {
          template_type: 'ai_generated_content',
          to_email: 'malcolm.railson@nhs.net',
          subject: `Complaint Review Report - ${complaint.reference_number}`,
          message: htmlMessage,
          word_attachment: {
            content: base64Content,
            filename: `Complaint_Report_${complaint.reference_number}_${format(new Date(), 'yyyy-MM-dd')}.docx`,
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          }
        }
      });

      if (error) {
        console.error('Email error:', error);
        showToast.error('Failed to send email report');
        return;
      }

      showToast.success('Report emailed to GP Partners successfully', { section: 'complaints' });
    } catch (error) {
      console.error('Email error:', error);
      showToast.error('Failed to send email report');
    } finally {
      setEmailSending(false);
    }
  };
  
  const generateWordDocContent = (reportData: AIReportData, complaint: any): string => {
    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return 'Not yet completed';
      return format(new Date(dateStr), 'dd MMMM yyyy');
    };

    const receivedDate = complaint.received_at || complaint.created_at;

    return `COMPLAINT REVIEW REPORT
======================

Reference: ${complaint.reference_number}
Category: ${complaint.category}
Received: ${formatDate(receivedDate)}
Generated: ${format(new Date(), 'dd MMMM yyyy HH:mm')}

This report is advisory and requires human review

---

COMPLAINT OVERVIEW
==================

${reportData.complaintOverview}

---

TIMELINE & COMPLIANCE
=====================

Acknowledgement:
  Date: ${formatDate(reportData.timelineCompliance.acknowledged.date)}
  Days from Receipt: ${reportData.timelineCompliance.acknowledged.daysFromReceived}
  Status: ${reportData.timelineCompliance.acknowledged.status}

Outcome Letter:
  Date: ${formatDate(reportData.timelineCompliance.outcome.date)}
  Days from Receipt: ${reportData.timelineCompliance.outcome.daysFromReceived}
  Status: ${reportData.timelineCompliance.outcome.status}

---

KEY LEARNINGS IDENTIFIED
========================

${reportData.keyLearnings.map((learning, index) => `
${index + 1}. ${learning.learning}
   Category: ${learning.category} | Impact: ${learning.impact}
`).join('\n')}

---

WHAT THE PRACTICE DID WELL
===========================

${reportData.practiceStrengths.map((strength) => `✓ ${strength}`).join('\n')}

---

SUPPORTIVE QUALITY IMPROVEMENT SUGGESTIONS
===========================================

These suggestions are provided to support continuous improvement, not as criticism.

${reportData.improvementSuggestions.map((suggestion, index) => `
${index + 1}. ${suggestion.suggestion} [${suggestion.priority} priority]
   ${suggestion.rationale}
`).join('\n')}

---

OUTCOME DECISION RATIONALE
===========================

${reportData.outcomeRationale}

---

NHS Complaints Management System
`;
  };
  
  const generateEmailHTML = (reportData: AIReportData, complaint: any): string => {
    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return 'Not yet completed';
      return format(new Date(dateStr), 'dd MMMM yyyy');
    };

    const getStatusBadge = (status: string) => {
      const colors = {
        'on-time': 'background: #10b981; color: white;',
        'late': 'background: #f59e0b; color: white;',
        'pending': 'background: #6b7280; color: white;'
      };
      return `<span style="padding: 4px 12px; border-radius: 4px; font-size: 12px; ${colors[status as keyof typeof colors] || colors.pending}">${status}</span>`;
    };

    const receivedDate = complaint.received_at || complaint.created_at;

    return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
  
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; border-radius: 8px; margin-bottom: 30px; text-align: center;">
    <h1 style="margin: 0 0 10px 0; font-size: 32px;">Complaint Review Report</h1>
    <p style="margin: 5px 0; font-size: 18px;">Reference: <strong>${complaint.reference_number}</strong></p>
    <p style="margin: 5px 0; font-size: 14px;">Received: ${formatDate(receivedDate)}</p>
    <p style="margin: 5px 0; font-size: 14px;">Category: ${complaint.category}</p>
  </div>

  <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="color: #667eea; margin-top: 0;">Complaint Overview</h2>
    <p style="line-height: 1.8;">${reportData.complaintOverview}</p>
  </div>

  <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="color: #667eea; margin-top: 0;">Timeline & Compliance</h2>
    
    <table style="width: 100%; border-collapse: collapse; margin-top: 15px; border: 1px solid #e5e7eb;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Milestone</th>
          <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Date</th>
          <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Days</th>
          <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 12px; border: 1px solid #e5e7eb;">Acknowledgement</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb;">${formatDate(reportData.timelineCompliance.acknowledged.date)}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb;">${reportData.timelineCompliance.acknowledged.daysFromReceived}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb;">${getStatusBadge(reportData.timelineCompliance.acknowledged.status)}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #e5e7eb;">Outcome Letter</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb;">${formatDate(reportData.timelineCompliance.outcome.date)}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb;">${reportData.timelineCompliance.outcome.daysFromReceived}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb;">${getStatusBadge(reportData.timelineCompliance.outcome.status)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${reportData.keyLearnings.length > 0 ? `
  <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="color: #667eea; margin-top: 0;">Key Learnings</h2>
    ${reportData.keyLearnings.map((learning, index) => `
      <div style="margin-bottom: 15px; padding: 15px; background: #f9fafb; border-radius: 6px;">
        <p style="margin: 0 0 8px 0; font-weight: 600;">${index + 1}. ${learning.learning}</p>
        <p style="margin: 0; font-size: 14px; color: #6b7280;">Category: ${learning.category} | Impact: ${learning.impact}</p>
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${reportData.practiceStrengths.length > 0 ? `
  <div style="background: #ecfdf5; padding: 25px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #10b981;">
    <h2 style="color: #059669; margin-top: 0;">What the Practice Did Well</h2>
    <ul>
      ${reportData.practiceStrengths.map((strength) => `<li style="margin-bottom: 12px;">${strength}</li>`).join('')}
    </ul>
  </div>
  ` : ''}

  ${reportData.improvementSuggestions.length > 0 ? `
  <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="color: #667eea; margin-top: 0;">Improvement Suggestions</h2>
    ${reportData.improvementSuggestions.map((suggestion, index) => `
      <div style="margin-bottom: 20px; padding: 15px; background: #fef9f3; border-radius: 6px;">
        <p style="margin: 0 0 8px 0; font-weight: 600;">${index + 1}. ${suggestion.suggestion}</p>
        <p style="margin: 0; font-size: 14px; color: #6b7280;">${suggestion.rationale}</p>
      </div>
    `).join('')}
  </div>
  ` : ''}

  <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="color: #667eea; margin-top: 0;">Outcome Decision Rationale</h2>
    <p style="line-height: 1.8;">${reportData.outcomeRationale}</p>
  </div>

</div>
`;
  };

  const generateComplaintDocxBase64 = async (reportData: AIReportData, complaint: any): Promise<string> => {
    const received = format(new Date(complaint.received_at || complaint.created_at), 'dd MMMM yyyy');

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: 'Complaint Review Report',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Reference: ${complaint.reference_number}`, bold: true, size: 24 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: `Received: ${received}`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: `Generated: ${format(new Date(), 'dd MMMM yyyy HH:mm')}`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),

          new Paragraph({ text: 'Complaint Overview', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } }),
          new Paragraph({ text: reportData.complaintOverview, spacing: { after: 300 } }),

          new Paragraph({ text: 'Timeline & Compliance', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Milestone', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Days', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Status', bold: true })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Acknowledgement')] }),
                  new TableCell({ children: [new Paragraph(reportData.timelineCompliance.acknowledged.date ? format(new Date(reportData.timelineCompliance.acknowledged.date), 'dd MMM yyyy') : 'Not yet acknowledged')] }),
                  new TableCell({ children: [new Paragraph(String(reportData.timelineCompliance.acknowledged.daysFromReceived))] }),
                  new TableCell({ children: [new Paragraph(reportData.timelineCompliance.acknowledged.status === 'on-time' ? '✓ On time' : '⚠ Late')] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Outcome Letter')] }),
                  new TableCell({ children: [new Paragraph(reportData.timelineCompliance.outcome.date ? format(new Date(reportData.timelineCompliance.outcome.date), 'dd MMM yyyy') : 'Not yet completed')] }),
                  new TableCell({ children: [new Paragraph(String(reportData.timelineCompliance.outcome.daysFromReceived))] }),
                  new TableCell({ children: [new Paragraph(reportData.timelineCompliance.outcome.status === 'on-time' ? '✓ On time' : reportData.timelineCompliance.outcome.status === 'late' ? '⚠ Late' : '⏳ In progress')] }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: 'Key Learnings Identified', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } }),
          ...reportData.keyLearnings.flatMap((learning, index) => [
            new Paragraph({
              children: [new TextRun({ text: `${index + 1}. `, bold: true }), new TextRun({ text: learning.learning })],
              spacing: { after: 80 },
            }),
            new Paragraph({ children: [new TextRun({ text: `   Category: ${learning.category} | Impact: ${learning.impact}`, italics: true })], spacing: { after: 140 } }),
          ]),

          new Paragraph({ text: 'What the Practice Did Well', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } }),
          ...reportData.practiceStrengths.map((s) => new Paragraph({ children: [new TextRun({ text: `✓ ${s}` })], spacing: { after: 120 } })),

          new Paragraph({ text: 'Supportive Quality Improvement Suggestions', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } }),
          ...reportData.improvementSuggestions.map((s, i) => new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${s.suggestion} [${s.priority} priority]`, bold: true })], spacing: { after: 60 } })),
          ...reportData.improvementSuggestions.map((s) => new Paragraph({ text: `   ${s.rationale}`, spacing: { after: 160 } })),

          new Paragraph({ text: 'Outcome Decision Rationale', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } }),
          new Paragraph({ text: reportData.outcomeRationale, spacing: { after: 200 } }),
        ],
      }],
    });

    return await Packer.toBase64String(doc);
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
          <Button 
            variant="outline" 
            onClick={handleEmailReport}
            disabled={emailSending}
          >
            <Mail className={`mr-2 h-4 w-4 ${emailSending ? 'animate-pulse' : ''}`} />
            {emailSending ? 'Sending...' : 'Email to GP Partners'}
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
          <div className="flex items-start justify-between gap-4">
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
              {complaint.complaint_outcomes?.[0]?.outcome_type && (
                <p className="text-sm text-muted-foreground mt-1">
                  Status: <span className="font-semibold text-foreground">
                    {complaint.complaint_outcomes[0].outcome_type
                      .split('_')
                      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ')}
                  </span>
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                Generated on {format(generatedAt, 'dd MMMM yyyy HH:mm')}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1 italic">
                This report is advisory and requires human review
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <Badge variant="outline" className="text-lg px-4 py-2">
                {complaint.category}
              </Badge>
              <ComplaintAudioOverviewPlayer
                complaintId={id as string}
                audioOverviewUrl={audioOverview?.audio_overview_url}
                audioOverviewText={audioOverview?.audio_overview_text}
                audioOverviewDuration={audioOverview?.audio_overview_duration}
              />
            </div>
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
