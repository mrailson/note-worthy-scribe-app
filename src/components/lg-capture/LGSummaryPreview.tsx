import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, AlertTriangle, Pill, Syringe, Stethoscope, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LGPatient } from '@/hooks/useLGCapture';

// Format date as DD-MMM-YYYY (e.g., 07-Sep-2023)
const formatUKDate = (dateStr: string | null | undefined): string => {
  if (!dateStr || dateStr === 'unknown' || dateStr === 'Unknown') return dateStr || 'unknown';
  try {
    // Handle various date formats
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleDateString('en-GB', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
};

interface SummaryData {
  summary_line: string;
  allergies: Array<{ substance: string; reaction: string; certainty: string; source: string }>;
  significant_past_history: Array<{ condition: string; first_noted: string; status: string }>;
  medications: Array<{ name: string; dose: string; route: string; frequency: string; start_date: string; status: string }>;
  immunisations: Array<{ vaccine: string; date: string }>;
  procedures: Array<{ name: string; date: string }>;
  family_history: Array<{ relation: string; condition: string; notes: string }>;
  risk_factors: Array<{ type: string; value: string; date: string }>;
  alerts: Array<{ type: string; note: string }>;
  free_text_findings: string;
}

interface LGSummaryPreviewProps {
  patient: LGPatient;
}

export function LGSummaryPreview({ patient }: LGSummaryPreviewProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      if (!patient.summary_json_url || patient.job_status !== 'succeeded') {
        setLoading(false);
        return;
      }

      try {
        const path = patient.summary_json_url.replace('lg/', '');
        const { data, error: downloadError } = await supabase.storage
          .from('lg')
          .download(path);

        if (downloadError) throw downloadError;

        const text = await data.text();
        const parsed = JSON.parse(text);
        setSummary(parsed);
      } catch (err) {
        console.error('Failed to load summary:', err);
        setError('Failed to load summary');
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [patient.summary_json_url, patient.job_status]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !summary) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Clinical Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Alerts Banner */}
        {summary.alerts.length > 0 && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
            <div className="flex items-center gap-2 text-destructive font-medium mb-2">
              <AlertTriangle className="h-4 w-4" />
              Important Alerts
            </div>
            <div className="space-y-1">
              {summary.alerts.map((alert, i) => (
                <div key={i} className="text-sm">
                  <Badge variant="destructive" className="mr-2">{alert.type}</Badge>
                  {alert.note}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Line */}
        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium">{summary.summary_line}</p>
        </div>

        <Tabs defaultValue="conditions" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="conditions">Conditions</TabsTrigger>
            <TabsTrigger value="medications">Meds</TabsTrigger>
            <TabsTrigger value="procedures">Procedures</TabsTrigger>
            <TabsTrigger value="other">Other</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[300px] mt-4">
            <TabsContent value="conditions" className="space-y-4 m-0">
              {/* Allergies */}
              {summary.allergies.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 text-destructive">Allergies</h4>
                  <div className="space-y-1">
                    {summary.allergies.map((allergy, i) => (
                      <div key={i} className="text-sm p-2 bg-destructive/5 rounded">
                        <span className="font-medium">{allergy.substance}</span>
                        {allergy.reaction && <span className="text-muted-foreground"> - {allergy.reaction}</span>}
                        <Badge variant="outline" className="ml-2 text-xs">{allergy.certainty}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Past History */}
              {summary.significant_past_history.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Stethoscope className="h-4 w-4" />
                    Past Medical History
                  </h4>
                  <div className="space-y-1">
                    {summary.significant_past_history.map((item, i) => (
                      <div key={i} className="text-sm p-2 bg-muted/30 rounded flex justify-between">
                        <span>{item.condition}</span>
                        <span className="text-muted-foreground">
                          {formatUKDate(item.first_noted)}
                          <Badge variant="outline" className="ml-2 text-xs">{item.status}</Badge>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="medications" className="space-y-4 m-0">
              {summary.medications.length > 0 ? (
                <div className="space-y-2">
                  {summary.medications.map((med, i) => (
                    <div key={i} className="text-sm p-2 bg-muted/30 rounded">
                      <div className="flex items-center gap-2">
                        <Pill className="h-4 w-4 text-primary" />
                        <span className="font-medium">{med.name}</span>
                        <Badge variant={med.status === 'current' ? 'default' : 'secondary'} className="text-xs">
                          {med.status}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground ml-6">
                        {[med.dose, med.route, med.frequency].filter(Boolean).join(' • ')}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No medications recorded</p>
              )}
            </TabsContent>

            <TabsContent value="procedures" className="space-y-4 m-0">
              {/* Procedures */}
              {summary.procedures.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Procedures</h4>
                  <div className="space-y-1">
                    {summary.procedures.map((proc, i) => (
                      <div key={i} className="text-sm p-2 bg-muted/30 rounded flex justify-between">
                        <span>{proc.name}</span>
                        <span className="text-muted-foreground">{formatUKDate(proc.date)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Immunisations */}
              {summary.immunisations.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Syringe className="h-4 w-4" />
                    Immunisations
                  </h4>
                  <div className="space-y-1">
                    {summary.immunisations.map((imm, i) => (
                      <div key={i} className="text-sm p-2 bg-muted/30 rounded flex justify-between">
                        <span>{imm.vaccine}</span>
                        <span className="text-muted-foreground">{formatUKDate(imm.date)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="other" className="space-y-4 m-0">
              {/* Family History */}
              {summary.family_history.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Family History
                  </h4>
                  <div className="space-y-1">
                    {summary.family_history.map((fh, i) => (
                      <div key={i} className="text-sm p-2 bg-muted/30 rounded">
                        <span className="font-medium">{fh.relation}:</span> {fh.condition}
                        {fh.notes && <span className="text-muted-foreground"> - {fh.notes}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk Factors */}
              {summary.risk_factors.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Risk Factors</h4>
                  <div className="space-y-1">
                    {summary.risk_factors.map((rf, i) => (
                      <div key={i} className="text-sm p-2 bg-muted/30 rounded flex justify-between">
                        <span>{rf.type}: {rf.value}</span>
                        <span className="text-muted-foreground">{formatUKDate(rf.date)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Free Text */}
              {summary.free_text_findings && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Additional Findings</h4>
                  <p className="text-sm text-muted-foreground p-2 bg-muted/30 rounded">
                    {summary.free_text_findings}
                  </p>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}
