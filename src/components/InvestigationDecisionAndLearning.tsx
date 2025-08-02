import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gavel, Save, Edit, CheckCircle, Sparkles, Loader2, BookOpen } from 'lucide-react';
import { SpeechToText } from '@/components/SpeechToText';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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

  useEffect(() => {
    fetchInvestigationDecision();
  }, [complaintId]);

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
          setDecisionType(recommendation.decision);
          setDecisionReasoning(recommendation.reasoning);
          toast.success('Decision recommendation generated successfully');
        } catch (parseError) {
          // If JSON parsing fails, treat as text
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            Investigation Decision & Learning
          </CardTitle>
          {decision && !editing && !disabled && (
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
              <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm whitespace-pre-wrap">
                {decision.decision_reasoning}
              </div>
            </div>

            {decision.lessons_learned && (
              <div>
                <Label className="text-sm font-medium flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Lessons Learned
                </Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm whitespace-pre-wrap">
                  {decision.lessons_learned}
                </div>
              </div>
            )}
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
    </Card>
  );
}