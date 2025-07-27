import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, XCircle, Scale, Save, Edit } from 'lucide-react';
import { SpeechToText } from '@/components/SpeechToText';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface InvestigationDecisionProps {
  complaintId: string;
  disabled?: boolean;
}

interface InvestigationDecision {
  id: string;
  decision_type: 'uphold' | 'reject' | 'partially_uphold';
  decision_reasoning: string;
  corrective_actions: string | null;
  lessons_learned: string | null;
  decided_by: string;
  decided_at: string;
  created_at: string;
  updated_at: string;
}

export function InvestigationDecision({ complaintId, disabled = false }: InvestigationDecisionProps) {
  const [decision, setDecision] = useState<InvestigationDecision | null>(null);
  const [decisionType, setDecisionType] = useState<string>('');
  const [decisionReasoning, setDecisionReasoning] = useState('');
  const [correctiveActions, setCorrectiveActions] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

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
        setCorrectiveActions(data.corrective_actions || '');
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
            decision_type: decisionType as any,
            decision_reasoning: decisionReasoning,
            corrective_actions: correctiveActions || null,
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
            decision_type: decisionType as any,
            decision_reasoning: decisionReasoning,
            corrective_actions: correctiveActions || null,
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
      setCorrectiveActions(decision.corrective_actions || '');
      setLessonsLearned(decision.lessons_learned || '');
      setEditing(false);
    }
  };

  const getDecisionIcon = (type: string) => {
    switch (type) {
      case 'uphold':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'reject':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'partially_uphold':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Scale className="h-4 w-4" />;
    }
  };

  const getDecisionLabel = (type: string) => {
    switch (type) {
      case 'uphold':
        return 'Uphold';
      case 'reject':
        return 'Reject';
      case 'partially_uphold':
        return 'Partially Uphold';
      default:
        return type;
    }
  };

  const getDecisionVariant = (type: string) => {
    switch (type) {
      case 'uphold':
        return 'default';
      case 'reject':
        return 'destructive';
      case 'partially_uphold':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Investigation Decision
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
              <Badge variant={getDecisionVariant(decision.decision_type)} className="flex items-center gap-1">
                {getDecisionIcon(decision.decision_type)}
                {getDecisionLabel(decision.decision_type)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {new Date(decision.decided_at).toLocaleDateString()}
              </span>
            </div>

            <div>
              <Label className="text-sm font-medium">Decision Reasoning</Label>
              <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm whitespace-pre-wrap">
                {decision.decision_reasoning}
              </div>
            </div>

            {decision.corrective_actions && (
              <div>
                <Label className="text-sm font-medium">Corrective Actions</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm whitespace-pre-wrap">
                  {decision.corrective_actions}
                </div>
              </div>
            )}

            {decision.lessons_learned && (
              <div>
                <Label className="text-sm font-medium">Lessons Learned</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm whitespace-pre-wrap">
                  {decision.lessons_learned}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="decision-type">Decision *</Label>
              <Select value={decisionType} onValueChange={setDecisionType} disabled={disabled}>
                <SelectTrigger>
                  <SelectValue placeholder="Select decision type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uphold">Uphold - Complaint is justified</SelectItem>
                  <SelectItem value="reject">Reject - Complaint is not justified</SelectItem>
                  <SelectItem value="partially_uphold">Partially Uphold - Some aspects are justified</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="decision-reasoning">Decision Reasoning *</Label>
              <div className="relative">
                <Textarea
                  id="decision-reasoning"
                  placeholder="Explain the reasoning behind this decision based on the investigation findings..."
                  value={decisionReasoning}
                  onChange={(e) => setDecisionReasoning(e.target.value)}
                  disabled={disabled || saving}
                  rows={5}
                  className="pr-12"
                />
                {!disabled && (
                  <div className="absolute top-2 right-2">
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

            {(decisionType === 'uphold' || decisionType === 'partially_uphold') && (
              <div>
                <Label htmlFor="corrective-actions">Corrective Actions</Label>
                <div className="relative">
                  <Textarea
                    id="corrective-actions"
                    placeholder="What actions will be taken to address the issues identified..."
                    value={correctiveActions}
                    onChange={(e) => setCorrectiveActions(e.target.value)}
                    disabled={disabled || saving}
                    rows={4}
                    className="pr-12"
                  />
                  {!disabled && (
                    <div className="absolute top-2 right-2">
                      <SpeechToText
                        onTranscription={(text) => {
                          setCorrectiveActions(prev => prev + (prev ? '\n\n' : '') + text);
                        }}
                        size="sm"
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="lessons-learned">Lessons Learned</Label>
              <div className="relative">
                <Textarea
                  id="lessons-learned"
                  placeholder="What can be learned from this complaint to prevent similar issues..."
                  value={lessonsLearned}
                  onChange={(e) => setLessonsLearned(e.target.value)}
                  disabled={disabled || saving}
                  rows={3}
                  className="pr-12"
                />
                {!disabled && (
                  <div className="absolute top-2 right-2">
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