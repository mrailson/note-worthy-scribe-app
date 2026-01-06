import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gavel, Save, Edit, CheckCircle, Sparkles, Loader2, BookOpen, FileText, Download, Eye, Mail, Info, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FormattedLetterContent } from '@/components/FormattedLetterContent';

import { SpeechToText } from '@/components/SpeechToText';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';

interface InvestigationDecisionAndLearningProps {
  complaintId: string;
  disabled?: boolean;
}

interface InvestigationDecision {
  id: string;
  complaint_id: string;
  decision_type: 'uphold' | 'reject' | 'partially_uphold';
  decision_reasoning: string;
  lessons_learned: string | null;
  decided_by: string;
  decided_at: string;
  created_at: string;
  updated_at: string;
}

export function InvestigationDecisionAndLearning({ complaintId, disabled = false }: InvestigationDecisionAndLearningProps) {
  const [decision, setDecision] = useState<InvestigationDecision | null>(null);
  const [decisionType, setDecisionType] = useState<string>('');
  const [decisionReasoning, setDecisionReasoning] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [generatingDecision, setGeneratingDecision] = useState(false);
  const [generatingReasoning, setGeneratingReasoning] = useState(false);
  const [generatingLessons, setGeneratingLessons] = useState(false);
  const [generatingOutcomeLetter, setGeneratingOutcomeLetter] = useState(false);
  const [outcomeLetter, setOutcomeLetter] = useState<string>('');
  const [showOutcomeLetter, setShowOutcomeLetter] = useState(false);
  const [editingOutcomeLetter, setEditingOutcomeLetter] = useState(false);
  const [editedOutcomeLetter, setEditedOutcomeLetter] = useState<string>('');
  const [savingOutcomeLetter, setSavingOutcomeLetter] = useState(false);
  const [existingOutcome, setExistingOutcome] = useState<any>(null);
  const [complaintReferenceNumber, setComplaintReferenceNumber] = useState<string>('');
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    fetchInvestigationDecision();
    fetchExistingOutcome();
    fetchComplaintDetails();
  }, [complaintId]);

  const fetchComplaintDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select('reference_number')
        .eq('id', complaintId)
        .single();

      if (error) throw error;

      if (data) {
        setComplaintReferenceNumber(data.reference_number);
      }
    } catch (error) {
      console.error('Error fetching complaint details:', error);
    }
  };

  const fetchExistingOutcome = async () => {
    try {
      const { data, error } = await supabase
        .from('complaint_outcomes')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingOutcome(data);
        setOutcomeLetter(data.outcome_letter || '');
      }
    } catch (error) {
      console.error('Error fetching existing outcome:', error);
    }
  };

  const fetchInvestigationDecision = async () => {
    try {
      const { data, error } = await supabase
        .from('complaint_investigation_decisions')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setDecision(data as InvestigationDecision);
        setDecisionType(data.decision_type);
        setDecisionReasoning(data.decision_reasoning);
        setLessonsLearned(data.lessons_learned || '');
        setEditing(false);
      } else {
        setEditing(true);
      }
    } catch (error) {
      console.error('Error fetching investigation decision:', error);
      toast.error('Failed to load investigation decision');
    }
  };

  const saveInvestigationDecision = async () => {
    if (!decisionType || !decisionReasoning.trim()) {
      toast.error('Please provide both decision type and reasoning');
      return;
    }

    setSaving(true);
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('User not authenticated');
      }

      if (decision) {
        // Update existing decision
        const { data, error } = await supabase
          .from('complaint_investigation_decisions')
          .update({
            decision_type: decisionType as 'uphold' | 'reject' | 'partially_uphold',
            decision_reasoning: decisionReasoning,
            lessons_learned: lessonsLearned || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', decision.id)
          .select()
          .single();

        if (error) throw error;
        setDecision(data as InvestigationDecision);
      } else {
        // Create new decision
        const { data, error } = await supabase
          .from('complaint_investigation_decisions')
          .insert({
            complaint_id: complaintId,
            decision_type: decisionType as 'uphold' | 'reject' | 'partially_uphold',
            decision_reasoning: decisionReasoning,
            lessons_learned: lessonsLearned || null,
            decided_by: user.data.user.id
          })
          .select()
          .single();

        if (error) throw error;
        setDecision(data as InvestigationDecision);
      }

      setEditing(false);
      toast.success('Investigation decision saved successfully');
    } catch (error) {
      console.error('Error saving investigation decision:', error);
      toast.error('Failed to save investigation decision');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    setEditing(true);
  };

  const handleCancel = () => {
    if (decision) {
      setDecisionType(decision.decision_type);
      setDecisionReasoning(decision.decision_reasoning);
      setLessonsLearned(decision.lessons_learned || '');
      setEditing(false);
    }
  };

  const generateDecisionRecommendation = async () => {
    setGeneratingDecision(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-investigation-assistant', {
        body: {
          complaint_id: complaintId,
          request_type: 'decision_recommendation'
        }
      });

      if (error) throw error;

      if (data?.success && data?.content) {
        try {
          const recommendation = JSON.parse(data.content);
          
          // Extract decision type if available
          if (recommendation.decision) {
            setDecisionType(recommendation.decision);
          }
          
          // Handle reasoning - could be a string or nested object
          let reasoning = '';
          if (typeof recommendation.reasoning === 'string') {
            reasoning = recommendation.reasoning;
          } else if (typeof recommendation.reasoning === 'object') {
            // If reasoning is an object, extract text content
            reasoning = Object.values(recommendation.reasoning).join('\n\n');
          } else if (recommendation.analysis || recommendation.conclusion) {
            // Handle common JSON structures
            const parts = [];
            if (recommendation.analysis) parts.push(recommendation.analysis);
            if (recommendation.conclusion) parts.push(recommendation.conclusion);
            reasoning = parts.join('\n\n');
          } else {
            // Fallback: use the entire JSON content as text
            reasoning = JSON.stringify(recommendation, null, 2).replace(/[{}"]/g, '').replace(/,/g, '');
          }
          
          setDecisionReasoning(reasoning);
          toast.success('Decision recommendation generated successfully');
        } catch (parseError) {
          // If JSON parsing fails, treat as plain text
          setDecisionReasoning(data.content);
          toast.success('Decision recommendation generated successfully');
        }
      } else {
        throw new Error(data?.error || 'Failed to generate decision recommendation');
      }
    } catch (error) {
      console.error('Error generating decision recommendation:', error);
      toast.error('Failed to generate decision recommendation');
    } finally {
      setGeneratingDecision(false);
    }
  };

  const generateDecisionReasoning = async () => {
    setGeneratingReasoning(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-investigation-assistant', {
        body: {
          complaint_id: complaintId,
          request_type: 'decision_reasoning'
        }
      });

      if (error) throw error;

      if (data?.success && data?.content) {
        setDecisionReasoning(data.content);
        toast.success('Decision reasoning generated successfully');
      } else {
        throw new Error(data?.error || 'Failed to generate decision reasoning');
      }
    } catch (error) {
      console.error('Error generating decision reasoning:', error);
      toast.error('Failed to generate decision reasoning');
    } finally {
      setGeneratingReasoning(false);
    }
  };

  const generateLessonsLearned = async () => {
    setGeneratingLessons(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-investigation-assistant', {
        body: {
          complaint_id: complaintId,
          request_type: 'lessons_learned'
        }
      });

      if (error) throw error;

      if (data?.success && data?.content) {
        setLessonsLearned(data.content);
        toast.success('Lessons learned generated successfully');
      } else {
        throw new Error(data?.error || 'Failed to generate lessons learned');
      }
    } catch (error) {
      console.error('Error generating lessons learned:', error);
      toast.error('Failed to generate lessons learned');
    } finally {
      setGeneratingLessons(false);
    }
  };

  const generateOutcomeLetter = async () => {
    if (!decision) return;

    setGeneratingOutcomeLetter(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-complaint-outcome-letter', {
        body: {
          complaintId,
          outcomeType: decision.decision_type,
          outcomeSummary: decision.decision_reasoning
        }
      });

      if (error) throw error;

      if (data && data.outcomeLetter) {
        const newOutcomeLetter = data.outcomeLetter;
        setOutcomeLetter(newOutcomeLetter);
        
        // Save to database and create audit log
        await saveOutcomeLetterToDatabase(newOutcomeLetter, true);
        
        setShowOutcomeLetter(true);
        toast.success('Outcome letter generated successfully');
      } else {
        throw new Error('No outcome letter generated');
      }
    } catch (error) {
      console.error('Error generating outcome letter:', error);
      toast.error('Failed to generate outcome letter');
    } finally {
      setGeneratingOutcomeLetter(false);
    }
  };

  const mapDecisionTypeToOutcomeType = (decisionType: string) => {
    switch (decisionType) {
      case 'uphold':
        return 'upheld';
      case 'reject':
        return 'not_upheld';
      case 'partially_uphold':
        return 'partially_upheld';
      default:
        return decisionType;
    }
  };

  const saveOutcomeLetterToDatabase = async (letterContent: string, isGenerated = false) => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('User not authenticated');
      }

      if (existingOutcome) {
        // Update existing outcome
        const { error } = await supabase
          .from('complaint_outcomes')
          .update({ 
            outcome_letter: letterContent,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingOutcome.id);

        if (error) throw error;
        
        // Update complaint status to closed if not already
        const { error: statusError } = await supabase
          .from('complaints')
          .update({ 
            status: 'closed',
            closed_at: new Date().toISOString()
          })
          .eq('id', complaintId)
          .neq('status', 'closed'); // Only update if not already closed

        if (statusError) {
          console.error('Failed to update complaint status:', statusError);
          // Don't throw error here, outcome letter was still saved successfully
        } else {
          // Generate CQC compliance report when complaint is completed
          try {
            console.log('Generating CQC compliance report for completed complaint:', complaintId);
            const { data: cqcReportData, error: cqcError } = await supabase.functions.invoke(
              'generate-cqc-compliance-report',
              { body: { complaintId } }
            );
            
            if (cqcError) {
              console.error('Failed to generate CQC compliance report:', cqcError);
              // Don't fail the main process, just log the error
            } else {
              console.log('CQC compliance report generated successfully:', cqcReportData?.evidenceRecord?.id);
              toast.success('CQC compliance report generated automatically');
            }
          } catch (cqcReportError) {
            console.error('Error generating CQC compliance report:', cqcReportError);
            // Continue without failing the main process
          }
        }
      } else {
        // Create new outcome (this would require decision data)
        if (!decision) return;
        
        const { data, error } = await supabase
          .from('complaint_outcomes')
          .insert({
            complaint_id: complaintId,
            outcome_type: mapDecisionTypeToOutcomeType(decision.decision_type),
            outcome_summary: decision.decision_reasoning,
            outcome_letter: letterContent,
            decided_by: user.data.user.id
          })
          .select()
          .single();

        if (error) throw error;
        setExistingOutcome(data);
        
        // Status will be automatically updated by the database trigger
      }

      // Add audit log
      await supabase.functions.invoke('log-complaint-activity', {
        body: {
          complaintId,
          actionType: isGenerated ? 'outcome_letter_generated' : 'outcome_letter_edited',
          actionDescription: isGenerated 
            ? 'Outcome letter generated using AI' 
            : 'Outcome letter manually edited',
          newValues: { outcome_letter_length: letterContent.length }
        }
      });

    } catch (error) {
      console.error('Error saving outcome letter:', error);
      throw error;
    }
  };

  const handleEditOutcomeLetter = () => {
    setEditedOutcomeLetter(outcomeLetter);
    setEditingOutcomeLetter(true);
  };

  const handleSaveOutcomeLetter = async () => {
    if (!editedOutcomeLetter.trim()) {
      toast.error('Outcome letter cannot be empty');
      return;
    }

    setSavingOutcomeLetter(true);
    try {
      await saveOutcomeLetterToDatabase(editedOutcomeLetter, false);
      setOutcomeLetter(editedOutcomeLetter);
      setEditingOutcomeLetter(false);
      toast.success('Outcome letter saved successfully');
    } catch (error) {
      console.error('Error saving outcome letter:', error);
      toast.error('Failed to save outcome letter');
    } finally {
      setSavingOutcomeLetter(false);
    }
  };

  const handleCancelEditOutcomeLetter = () => {
    setEditedOutcomeLetter('');
    setEditingOutcomeLetter(false);
  };

  const handleDownloadOutcomeLetter = async () => {
    if (!outcomeLetter) {
      toast.error('No outcome letter available for download');
      return;
    }
    
    try {
      console.log('=== OUTCOME LETTER DOWNLOAD DEBUG (InvestigationDecisionAndLearning) ===');
      console.log('Starting outcome letter download...');
      console.log('Letter content length:', outcomeLetter.length);
      console.log('Letter content preview:', outcomeLetter.substring(0, 100) + '...');
      
      // Use the proper letter formatter that handles markdown
      const { createLetterDocument } = await import('@/utils/letterFormatter');
      const { Packer } = await import('docx');
      
      console.log('Creating document with proper markdown formatting...');
      const doc = await createLetterDocument(
        outcomeLetter, 
        'outcome', 
        complaintReferenceNumber || `COMP${complaintId.substring(0, 8)}`
      );

      console.log('Document structure created successfully');
      
      const buffer = await Packer.toBlob(doc);
      console.log('Document converted to blob, size:', buffer.size, 'bytes');
      
      if (buffer.size === 0) {
        throw new Error('Generated document is empty');
      }
      
      const filename = complaintReferenceNumber 
        ? `${complaintReferenceNumber}-outcome-letter.docx`
        : `complaint-${complaintId}-outcome-letter.docx`;
      
      console.log('Using filename:', filename);

      // Create and trigger download
      const url = URL.createObjectURL(buffer);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      console.log('Triggering download for file:', link.download);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('Download completed successfully');
      toast.success('Outcome letter downloaded successfully');
      
      // Add audit log for download (non-blocking)
      try {
        await supabase.functions.invoke('log-complaint-activity', {
          body: {
            complaintId,
            actionType: 'outcome_letter_downloaded',
            actionDescription: 'Outcome letter downloaded as DOCX file'
          }
        });
        console.log('Audit log added successfully');
      } catch (auditError) {
        console.error('Failed to log download activity:', auditError);
        // Don't fail the download for audit log issues
      }
    } catch (error) {
      console.error('=== OUTCOME LETTER DOWNLOAD ERROR ===');
      console.error('Error details:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      toast.error(`Failed to download outcome letter: ${error.message}`);
    }
  };

  const getDecisionBadgeVariant = (type: string) => {
    switch (type) {
      case 'uphold':
        return 'destructive';
      case 'reject':
        return 'secondary';
      case 'partially_uphold':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getDecisionLabel = (type: string) => {
    switch (type) {
      case 'uphold':
        return 'Upheld';
      case 'reject':
        return 'Rejected';
      case 'partially_uphold':
        return 'Partially Upheld';
      default:
        return type;
    }
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger className="flex items-center gap-2 hover:no-underline">
                <CardTitle className="flex items-center gap-2">
                  <Gavel className="h-5 w-5" />
                  Investigation Decision & Learning
                </CardTitle>
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              {decision && !editing && !disabled && (
                <Button variant="outline" size="sm" onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* CQC Compliance Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">CQC Compliance Documentation</p>
                    <p className="text-blue-700">
                      When this complaint is completed, a comprehensive CQC compliance report will be automatically generated 
                      and stored in your evidence repository. This report demonstrates how your practice has met NHS complaint 
                      handling procedures and regulatory requirements.
                    </p>
                  </div>
                </div>
              </div>

              {!editing && decision ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Decision Made
                    </Badge>
                    <Badge variant={getDecisionBadgeVariant(decision.decision_type)}>
                      {getDecisionLabel(decision.decision_type)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(decision.decided_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Decision Reasoning (CQC Audit Ready)</Label>
                    <div className="mt-1 p-4 bg-background/50 border rounded-lg">
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ 
                          __html: renderNHSMarkdown(decision.decision_reasoning || "")
                        }} 
                      />
                    </div>
                  </div>

                  {decision.lessons_learned && (
                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Lessons Learned
                      </Label>
                      <div className="mt-1 p-4 bg-background/50 border rounded-lg">
                        <div 
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ 
                            __html: renderNHSMarkdown(decision.lessons_learned || "")
                          }} 
                        />
                      </div>
                    </div>
                  )}

                  {/* Outcome Letter Section */}
                  <div className="pt-4 border-t space-y-4">
                    {outcomeLetter ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Outcome Letter</h4>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setShowOutcomeLetter(true)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={handleDownloadOutcomeLetter}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Export DOCX
                            </Button>
                          </div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-md text-sm">
                          <p className="text-muted-foreground">
                            Outcome letter has been generated and saved. 
                            {outcomeLetter.length} characters.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        onClick={generateOutcomeLetter}
                        disabled={disabled || generatingOutcomeLetter}
                        className="w-full"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        {generatingOutcomeLetter ? 'Generating Letter...' : 'Create Outcome Letter'}
                      </Button>
                    )}
                  </div>

                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="decision-type">Decision *</Label>
                      {!disabled && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={generateDecisionRecommendation}
                          disabled={generatingDecision || saving}
                          className="text-xs"
                        >
                          {generatingDecision ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3 mr-1" />
                          )}
                          {generatingDecision ? 'Generating...' : 'AI Recommend'}
                        </Button>
                      )}
                    </div>
                    <Select
                      value={decisionType}
                      onValueChange={setDecisionType}
                      disabled={disabled || saving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select investigation decision" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uphold">Uphold - Complaint is justified</SelectItem>
                        <SelectItem value="reject">Reject - Complaint is not justified</SelectItem>
                        <SelectItem value="partially_uphold">Partially Uphold - Some aspects justified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="decision-reasoning">Decision Reasoning (CQC Audit Ready) *</Label>
                      {!disabled && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={generateDecisionReasoning}
                          disabled={generatingReasoning || saving}
                          className="text-xs"
                        >
                          {generatingReasoning ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3 mr-1" />
                          )}
                          {generatingReasoning ? 'Generating...' : 'AI Generate'}
                        </Button>
                      )}
                    </div>
                    <div className="relative">
                      <Textarea
                        id="decision-reasoning"
                        placeholder="Provide comprehensive reasoning that would satisfy a CQC audit, referencing NHS standards, evidence, and duty of candour..."
                        value={decisionReasoning}
                        onChange={(e) => setDecisionReasoning(e.target.value)}
                        disabled={disabled || saving}
                        rows={6}
                        className="pl-12"
                      />
                      {!disabled && (
                        <div className="absolute top-2 left-2">
                          <SpeechToText
                            onTranscription={(text) => {
                              setDecisionReasoning(prev => prev + (prev ? '\n\n' : '') + text);
                            }}
                            size="sm"
                            className="text-sm"
                          />
                        </div>
                      )}
                    </div>
                    {/* Live formatted preview to avoid raw ** and ### showing */}
                    {decisionReasoning?.trim() && (
                      <div className="mt-3">
                        <Label className="text-xs text-muted-foreground">Preview</Label>
                        <div className="mt-1 p-4 bg-background/50 border rounded-lg">
                          <div
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: renderNHSMarkdown(decisionReasoning) }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="lessons-learned" className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Lessons Learned
                      </Label>
                      {!disabled && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={generateLessonsLearned}
                          disabled={generatingLessons || saving}
                          className="text-xs"
                        >
                          {generatingLessons ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3 mr-1" />
                          )}
                          {generatingLessons ? 'Generating...' : 'AI Generate'}
                        </Button>
                      )}
                    </div>
                    <div className="relative">
                      <Textarea
                        id="lessons-learned"
                        placeholder="Identify key lessons learned and improvement opportunities to prevent future occurrences..."
                        value={lessonsLearned}
                        onChange={(e) => setLessonsLearned(e.target.value)}
                        disabled={disabled || saving}
                        rows={4}
                        className="pl-12"
                      />
                      {!disabled && (
                        <div className="absolute top-2 left-2">
                          <SpeechToText
                            onTranscription={(text) => {
                              setLessonsLearned(prev => prev + (prev ? '\n\n' : '') + text);
                            }}
                            size="sm"
                            className="text-sm"
                          />
                        </div>
                      )}
                    </div>
                    {/* Live formatted preview to avoid raw ** and ### showing */}
                    {lessonsLearned?.trim() && (
                      <div className="mt-3">
                        <Label className="text-xs text-muted-foreground">Preview</Label>
                        <div className="mt-1 p-4 bg-background/50 border rounded-lg">
                          <div
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: renderNHSMarkdown(lessonsLearned) }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={saveInvestigationDecision}
                      disabled={disabled || saving || !decisionType || !decisionReasoning.trim()}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Save Decision'}
                    </Button>
                    {decision && (
                      <Button variant="outline" onClick={handleCancel} disabled={saving}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Outcome Letter Dialog */}
      <Dialog open={showOutcomeLetter} onOpenChange={setShowOutcomeLetter}>
        <DialogContent className="p-0 max-w-none max-h-none w-[85vw] h-[85vh] resize overflow-auto border-2 border-gray-300" style={{ resize: 'both', minWidth: '600px', minHeight: '400px' }}>
          <div className="flex flex-col h-full">
            <DialogHeader className="flex-shrink-0 p-6 border-b">
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Outcome Letter - {complaintReferenceNumber}
              </DialogTitle>
              <DialogDescription>
                View, edit, download, or regenerate the outcome letter for this complaint
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex flex-col gap-4 flex-1 min-h-0 p-6 overflow-hidden">
              {/* Action buttons */}
              <div className="flex gap-2 justify-end border-b pb-4 flex-shrink-0">
                {!editingOutcomeLetter ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleEditOutcomeLetter}
                      disabled={disabled}
                      className="flex items-center gap-2"
                    >
                      <Edit className="h-4 w-4" />
                      Edit Letter
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDownloadOutcomeLetter}
                      disabled={!outcomeLetter}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download DOCX
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setShowOutcomeLetter(false);
                        generateOutcomeLetter();
                      }}
                      disabled={generatingOutcomeLetter}
                    >
                      {generatingOutcomeLetter ? 'Regenerating...' : 'Regenerate Letter'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleCancelEditOutcomeLetter}
                      disabled={savingOutcomeLetter}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveOutcomeLetter}
                      disabled={savingOutcomeLetter || !editedOutcomeLetter.trim()}
                      className="flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {savingOutcomeLetter ? 'Saving...' : 'Save Letter'}
                    </Button>
                  </>
                )}
              </div>
              
              {/* Letter content */}
              <div className="flex-1 min-h-0">
                {!editingOutcomeLetter ? (
                  <ScrollArea className="h-full">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <FormattedLetterContent content={outcomeLetter} />
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-full flex flex-col">
                    <Textarea
                      value={editedOutcomeLetter}
                      onChange={(e) => setEditedOutcomeLetter(e.target.value)}
                      className="flex-1 min-h-0 font-mono text-sm resize-none border focus:ring-2 p-4 bg-white text-black"
                      placeholder="Edit the outcome letter content..."
                    />
                  </div>
                )}
              </div>
            </div>
            {/* Resize indicator */}
            <div className="absolute bottom-0 right-0 w-4 h-4 cursor-nw-resize opacity-50 hover:opacity-75">
              <svg width="16" height="16" viewBox="0 0 16 16" className="text-gray-400">
                <path d="M16 0v16H0z" fill="none"/>
                <path d="M16 16l-6-6M16 12l-2-2M16 8l-2-2" stroke="currentColor" strokeWidth="1" fill="none"/>
              </svg>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
