import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, AlertTriangle, Pill, Syringe, Stethoscope, Users, Building2, Cigarette } from 'lucide-react';
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
  diagnoses?: Array<{ condition: string; date_noted: string; status: string }>;
  surgeries?: Array<{ procedure: string; date: string; notes: string }>;
  allergies?: Array<{ allergen: string; reaction: string; year: string }>;
  immunisations?: Array<{ vaccine: string; date: string }>;
  family_history?: Array<{ relation: string; condition: string }>;
  social_history?: { smoking_status: string; stopped_year?: string; alcohol: string; occupation: string };
  reproductive_history?: { gravida: number; para: number; miscarriages: number; notes: string };
  hospital_findings?: Array<{ condition: string; date: string; outcome: string }>;
  medications?: Array<{ drug: string; dose: string; status: string }>;
  alerts?: Array<{ type: string; note: string }>;
  free_text_findings?: string;
  summary_metadata?: string;
  // Legacy field support
  significant_past_history?: Array<{ condition: string; first_noted: string; status: string }>;
  procedures?: Array<{ name: string; date: string }>;
  risk_factors?: Array<{ type: string; value: string; date: string }>;
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

  // Support both new schema (diagnoses) and legacy (significant_past_history)
  const conditions = summary.diagnoses ?? summary.significant_past_history ?? [];
  const surgeryList = summary.surgeries ?? summary.procedures?.map(p => ({ procedure: p.name, date: p.date, notes: '' })) ?? [];
  const allergyList = summary.allergies ?? [];
  const immunisationList = summary.immunisations ?? [];
  const familyHistoryList = summary.family_history ?? [];
  const medicationList = summary.medications ?? [];
  const alertList = summary.alerts ?? [];
  const hospitalFindings = summary.hospital_findings ?? [];

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
        {alertList.length > 0 && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
            <div className="flex items-center gap-2 text-destructive font-medium mb-2">
              <AlertTriangle className="h-4 w-4" />
              Important Alerts
            </div>
            <div className="space-y-1">
              {alertList.map((alert, i) => (
                <div key={i} className="text-sm">
                  <Badge variant="destructive" className="mr-2">{alert.type}</Badge>
                  {alert.note}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Line */}
        {summary.summary_line && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium">{summary.summary_line}</p>
          </div>
        )}

        <Tabs defaultValue="conditions" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="conditions">Diagnoses</TabsTrigger>
            <TabsTrigger value="medications">Meds</TabsTrigger>
            <TabsTrigger value="procedures">Surgeries</TabsTrigger>
            <TabsTrigger value="other">Other</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[300px] mt-4">
            <TabsContent value="conditions" className="space-y-4 m-0">
              {/* Allergies */}
              {allergyList.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 text-destructive">Allergies</h4>
                  <div className="space-y-1">
                    {allergyList.map((allergy, i) => (
                      <div key={i} className="text-sm p-2 bg-destructive/5 rounded">
                        <span className="font-medium">{allergy.allergen}</span>
                        {allergy.reaction && <span className="text-muted-foreground"> - {allergy.reaction}</span>}
                        {allergy.year && <Badge variant="outline" className="ml-2 text-xs">{allergy.year}</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Diagnoses / Past History */}
              {conditions.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Stethoscope className="h-4 w-4" />
                    Diagnoses
                  </h4>
                  <div className="space-y-1">
                    {conditions.map((item, i) => (
                      <div key={i} className="text-sm p-2 bg-muted/30 rounded flex justify-between">
                        <span>{item.condition}</span>
                        <span className="text-muted-foreground">
                          {formatUKDate('date_noted' in item ? item.date_noted : (item as any).first_noted)}
                          {item.status && <Badge variant="outline" className="ml-2 text-xs">{item.status}</Badge>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="medications" className="space-y-4 m-0">
              {medicationList.length > 0 ? (
                <div className="space-y-2">
                  {medicationList.map((med, i) => (
                    <div key={i} className="text-sm p-2 bg-muted/30 rounded">
                      <div className="flex items-center gap-2">
                        <Pill className="h-4 w-4 text-primary" />
                        <span className="font-medium">{med.drug}</span>
                        {med.status && <Badge variant="outline" className="text-xs">{med.status}</Badge>}
                      </div>
                      {med.dose && (
                        <div className="text-muted-foreground ml-6">{med.dose}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No medications recorded</p>
              )}
            </TabsContent>

            <TabsContent value="procedures" className="space-y-4 m-0">
              {/* Surgeries */}
              {surgeryList.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Surgeries</h4>
                  <div className="space-y-1">
                    {surgeryList.map((surgery, i) => (
                      <div key={i} className="text-sm p-2 bg-muted/30 rounded flex justify-between">
                        <span>{surgery.procedure}</span>
                        <span className="text-muted-foreground">{formatUKDate(surgery.date)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Immunisations */}
              {immunisationList.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Syringe className="h-4 w-4" />
                    Immunisations
                  </h4>
                  <div className="space-y-1">
                    {immunisationList.map((imm, i) => (
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
              {/* Social History */}
              {summary.social_history && (
                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Cigarette className="h-4 w-4" />
                    Social History
                  </h4>
                  <div className="space-y-1 text-sm p-2 bg-muted/30 rounded">
                    {summary.social_history.smoking_status && (
                      <div><span className="font-medium">Smoking:</span> {summary.social_history.smoking_status}
                        {summary.social_history.stopped_year && ` (stopped ${summary.social_history.stopped_year})`}
                      </div>
                    )}
                    {summary.social_history.alcohol && (
                      <div><span className="font-medium">Alcohol:</span> {summary.social_history.alcohol}</div>
                    )}
                    {summary.social_history.occupation && (
                      <div><span className="font-medium">Occupation:</span> {summary.social_history.occupation}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Hospital Findings */}
              {hospitalFindings.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Hospital Findings
                  </h4>
                  <div className="space-y-1">
                    {hospitalFindings.map((hf, i) => (
                      <div key={i} className="text-sm p-2 bg-muted/30 rounded">
                        <div className="flex justify-between">
                          <span className="font-medium">{hf.condition}</span>
                          <span className="text-muted-foreground">{formatUKDate(hf.date)}</span>
                        </div>
                        {hf.outcome && <div className="text-muted-foreground text-xs mt-1">{hf.outcome}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Family History */}
              {familyHistoryList.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Family History
                  </h4>
                  <div className="space-y-1">
                    {familyHistoryList.map((fh, i) => (
                      <div key={i} className="text-sm p-2 bg-muted/30 rounded">
                        <span className="font-medium">{fh.relation}:</span> {fh.condition}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reproductive History */}
              {summary.reproductive_history && (summary.reproductive_history.gravida > 0 || summary.reproductive_history.notes) && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Reproductive History</h4>
                  <div className="text-sm p-2 bg-muted/30 rounded">
                    {summary.reproductive_history.gravida > 0 && (
                      <div>
                        G{summary.reproductive_history.gravida} P{summary.reproductive_history.para}
                        {summary.reproductive_history.miscarriages > 0 && ` +${summary.reproductive_history.miscarriages} miscarriage(s)`}
                      </div>
                    )}
                    {summary.reproductive_history.notes && (
                      <div className="text-muted-foreground">{summary.reproductive_history.notes}</div>
                    )}
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
