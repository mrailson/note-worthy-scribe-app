import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, CheckCircle, XCircle, Scale, Save, Edit, ClipboardCheck } from 'lucide-react';
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

interface ComplianceCheck {
  id: string;
  compliance_item: string;
  is_compliant: boolean;
  evidence: string | null;
  notes: string | null;
  checked_at: string | null;
  checked_by: string | null;
}

export function InvestigationDecision({ complaintId, disabled = false }: InvestigationDecisionProps) {
  const [decision, setDecision] = useState<InvestigationDecision | null>(null);
  const [decisionType, setDecisionType] = useState<string>('');
  const [decisionReasoning, setDecisionReasoning] = useState('');
  const [correctiveActions, setCorrectiveActions] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [complianceChecks, setComplianceChecks] = useState<ComplianceCheck[]>([]);
  const [complianceSummary, setComplianceSummary] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('decision');

  useEffect(() => {
    fetchInvestigationDecision();
    fetchComplianceChecks();
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

  const fetchComplianceChecks = async () => {
    try {
      const { data: checks, error: checksError } = await supabase
        .from('complaint_compliance_checks')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: true });

      if (checksError) throw checksError;
      setComplianceChecks(checks || []);

      // Get compliance summary
      const { data: summary, error: summaryError } = await supabase
        .rpc('get_complaint_compliance_summary', { complaint_id_param: complaintId });

      if (summaryError) throw summaryError;
      if (summary && summary.length > 0) {
        setComplianceSummary(summary[0]);
      }
    } catch (error) {
      console.error('Error fetching compliance data:', error);
      toast.error('Failed to load compliance checks');
    }
  };

  const updateComplianceCheck = async (checkId: string, isCompliant: boolean) => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('complaint_compliance_checks')
        .update({ 
          is_compliant: isCompliant, 
          checked_at: new Date().toISOString(),
          checked_by: user.data.user.id 
        })
        .eq('id', checkId);

      if (error) throw error;

      // Update local state
      setComplianceChecks(prev => 
        prev.map(check => 
          check.id === checkId 
            ? { ...check, is_compliant: isCompliant, checked_at: new Date().toISOString() }
            : check
        )
      );

      // Refresh compliance summary
      fetchComplianceChecks();
      
      toast.success("Compliance check updated");
    } catch (error) {
      console.error('Error updating compliance check:', error);
      toast.error("Failed to update compliance check");
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
            Investigation Decision & Compliance
          </CardTitle>
          {decision && !editing && !disabled && activeTab === 'decision' && (
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="decision">Decision</TabsTrigger>
            <TabsTrigger value="compliance">Compliance Review</TabsTrigger>
          </TabsList>

          <TabsContent value="decision" className="space-y-4 mt-4">
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
                        className="pl-12"
                      />
                      {!disabled && (
                        <div className="absolute top-2 left-2">
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
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  <h3 className="text-lg font-medium">NHS Compliance Checklist</h3>
                </div>
                {complianceSummary && (
                  <Badge variant="outline" className="text-sm">
                    {complianceSummary.compliant_items} / {complianceSummary.total_items} Complete
                    ({complianceSummary.compliance_percentage}%)
                  </Badge>
                )}
              </div>

              {complianceSummary && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-900">Compliance Progress</span>
                    <span className="text-sm text-blue-800">{complianceSummary.compliance_percentage}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${complianceSummary.compliance_percentage}%` }}
                    ></div>
                  </div>
                  {complianceSummary.outstanding_items && complianceSummary.outstanding_items.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm text-blue-800 font-medium">Outstanding Items:</p>
                      <ul className="mt-1 text-sm text-blue-700">
                        {complianceSummary.outstanding_items.slice(0, 3).map((item, index) => (
                          <li key={index} className="truncate">• {item}</li>
                        ))}
                        {complianceSummary.outstanding_items.length > 3 && (
                          <li className="text-blue-600">...and {complianceSummary.outstanding_items.length - 3} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {complianceChecks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No compliance checks available for this complaint
                  </div>
                ) : (
                  complianceChecks.map((check) => (
                    <div 
                      key={check.id} 
                      className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        check.is_compliant 
                          ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                          : 'hover:bg-gray-50'
                      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                      onClick={() => !disabled && updateComplianceCheck(check.id, !check.is_compliant)}
                    >
                      <Checkbox
                        id={check.id}
                        checked={check.is_compliant}
                        onCheckedChange={(checked) => updateComplianceCheck(check.id, checked as boolean)}
                        disabled={disabled}
                        className="mt-1 pointer-events-none"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={check.id}
                          className={`text-sm cursor-pointer ${
                            check.is_compliant 
                              ? 'line-through text-muted-foreground' 
                              : ''
                          }`}
                        >
                          {check.compliance_item}
                        </Label>
                        {check.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{check.notes}</p>
                        )}
                        {check.checked_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Checked: {new Date(check.checked_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {check.is_compliant && (
                        <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}