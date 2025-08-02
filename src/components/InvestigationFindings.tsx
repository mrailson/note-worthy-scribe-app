import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Save, Edit, CheckCircle, Sparkles, Loader2 } from 'lucide-react';
import { SpeechToText } from '@/components/SpeechToText';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface InvestigationFindingsProps {
  complaintId: string;
  disabled?: boolean;
}

interface InvestigationFinding {
  id: string;
  investigation_summary: string;
  evidence_notes: string | null;
  findings_text: string;
  investigation_date: string;
  investigated_by: string;
  created_at: string;
  updated_at: string;
}

export function InvestigationFindings({ complaintId, disabled = false }: InvestigationFindingsProps) {
  const [findings, setFindings] = useState<InvestigationFinding | null>(null);
  const [investigationSummary, setInvestigationSummary] = useState('');
  const [findingsText, setFindingsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [generatingFindings, setGeneratingFindings] = useState(false);

  useEffect(() => {
    fetchInvestigationFindings();
  }, [complaintId]);

  const fetchInvestigationFindings = async () => {
    try {
      const { data, error } = await supabase
        .from('complaint_investigation_findings')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFindings(data);
        setInvestigationSummary(data.investigation_summary);
        setFindingsText(data.findings_text);
        setEditing(false);
      } else {
        setEditing(true);
      }
    } catch (error) {
      console.error('Error fetching investigation findings:', error);
      toast.error('Failed to load investigation findings');
    }
  };

  const saveInvestigationFindings = async () => {
    if (!investigationSummary.trim() || !findingsText.trim()) {
      toast.error('Please provide both investigation summary and findings');
      return;
    }

    setSaving(true);
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('User not authenticated');
      }

      if (findings) {
        // Update existing findings
        const { data, error } = await supabase
          .from('complaint_investigation_findings')
          .update({
            investigation_summary: investigationSummary,
            findings_text: findingsText,
            updated_at: new Date().toISOString()
          })
          .eq('id', findings.id)
          .select()
          .single();

        if (error) throw error;
        setFindings(data);
      } else {
        // Create new findings
        const { data, error } = await supabase
          .from('complaint_investigation_findings')
          .insert({
            complaint_id: complaintId,
            investigation_summary: investigationSummary,
            findings_text: findingsText,
            investigated_by: user.data.user.id
          })
          .select()
          .single();

        if (error) throw error;
        setFindings(data);
      }

      setEditing(false);
      toast.success('Investigation findings saved successfully');
    } catch (error) {
      console.error('Error saving investigation findings:', error);
      toast.error('Failed to save investigation findings');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    setEditing(true);
  };

  const handleCancel = () => {
    if (findings) {
      setInvestigationSummary(findings.investigation_summary);
      setFindingsText(findings.findings_text);
      setEditing(false);
    }
  };

  const generateInvestigationSummary = async () => {
    setGeneratingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-investigation-assistant', {
        body: {
          complaint_id: complaintId,
          request_type: 'investigation_summary'
        }
      });

      if (error) throw error;

      if (data?.success && data?.content) {
        setInvestigationSummary(data.content);
        toast.success('Investigation summary generated successfully');
      } else {
        throw new Error(data?.error || 'Failed to generate summary');
      }
    } catch (error) {
      console.error('Error generating investigation summary:', error);
      toast.error('Failed to generate investigation summary');
    } finally {
      setGeneratingSummary(false);
    }
  };

  const generateDetailedFindings = async () => {
    setGeneratingFindings(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-investigation-assistant', {
        body: {
          complaint_id: complaintId,
          request_type: 'detailed_findings'
        }
      });

      if (error) throw error;

      if (data?.success && data?.content) {
        setFindingsText(data.content);
        toast.success('Detailed findings generated successfully');
      } else {
        throw new Error(data?.error || 'Failed to generate findings');
      }
    } catch (error) {
      console.error('Error generating detailed findings:', error);
      toast.error('Failed to generate detailed findings');
    } finally {
      setGeneratingFindings(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Investigation Findings
          </CardTitle>
          {findings && !editing && !disabled && (
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!editing && findings ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Investigation Complete
              </Badge>
              <span className="text-sm text-muted-foreground">
                {new Date(findings.investigation_date).toLocaleDateString()}
              </span>
            </div>

            <div>
              <Label className="text-sm font-medium">Investigation Summary</Label>
              <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm whitespace-pre-wrap">
                {findings.investigation_summary}
              </div>
            </div>


            <div>
              <Label className="text-sm font-medium">Detailed Findings</Label>
              <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm whitespace-pre-wrap">
                {findings.findings_text}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="investigation-summary">Investigation Summary *</Label>
                {!disabled && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generateInvestigationSummary}
                    disabled={generatingSummary || saving}
                    className="text-xs"
                  >
                    {generatingSummary ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1" />
                    )}
                    {generatingSummary ? 'Generating...' : 'AI Generate'}
                  </Button>
                )}
              </div>
              <div className="relative">
                <Textarea
                  id="investigation-summary"
                  placeholder="Provide a brief summary of how the investigation was conducted..."
                  value={investigationSummary}
                  onChange={(e) => setInvestigationSummary(e.target.value)}
                  disabled={disabled || saving}
                  rows={3}
                  className="pl-12"
                />
                {!disabled && (
                  <div className="absolute top-2 left-2">
                    <SpeechToText
                      onTranscription={(text) => {
                        setInvestigationSummary(prev => prev + (prev ? '\n\n' : '') + text);
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
                <Label htmlFor="findings-text">Detailed Findings *</Label>
                {!disabled && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generateDetailedFindings}
                    disabled={generatingFindings || saving}
                    className="text-xs"
                  >
                    {generatingFindings ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1" />
                    )}
                    {generatingFindings ? 'Generating...' : 'AI Generate'}
                  </Button>
                )}
              </div>
              <div className="relative">
                <Textarea
                  id="findings-text"
                  placeholder="Detail the key findings from your investigation..."
                  value={findingsText}
                  onChange={(e) => setFindingsText(e.target.value)}
                  disabled={disabled || saving}
                  rows={6}
                  className="pl-12"
                />
                {!disabled && (
                  <div className="absolute top-2 left-2">
                    <SpeechToText
                      onTranscription={(text) => {
                        setFindingsText(prev => prev + (prev ? '\n\n' : '') + text);
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
                onClick={saveInvestigationFindings}
                disabled={disabled || saving || !investigationSummary.trim() || !findingsText.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Findings'}
              </Button>
              {findings && (
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