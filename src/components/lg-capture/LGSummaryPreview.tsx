import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { FileText, AlertTriangle, Pill, Syringe, Stethoscope, Users, Building2, Cigarette, Code2, Eye, ClipboardCheck, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LGPatient } from '@/hooks/useLGCapture';
import { LGImageVerificationModal, SnomedItemForVerification } from './LGImageVerificationModal';
import { LGSnomedAuditModal } from './LGSnomedAuditModal';
import { LGQualityGateModal } from './LGQualityGateModal';
// Format date as MMM-YYYY or DD-MMM-YYYY depending on available info
// Handles "Pre" prefix for first-mention dates (e.g., "Pre Oct 2020")
const formatUKDate = (dateStr: string | null | undefined): string => {
  if (!dateStr || dateStr === 'unknown' || dateStr === 'Unknown' || dateStr === '') return '';
  
  const str = dateStr.trim();
  
  // Pass through "Pre" dates without reformatting (e.g., "Pre Oct 2020", "Pre 2019")
  if (str.toLowerCase().startsWith('pre')) {
    return str;
  }
  
  // Check if it's just a year (4 digits)
  if (/^\d{4}$/.test(str)) {
    return str;
  }
  
  // Check for month-year patterns like "Mar 2019", "March 2019", "03/2019", "2019-03"
  const monthYearMatch = str.match(/^([A-Za-z]+)\s*[-/]?\s*(\d{4})$/) || 
                         str.match(/^(\d{1,2})[-/](\d{4})$/) ||
                         str.match(/^(\d{4})[-/](\d{1,2})$/);
  if (monthYearMatch) {
    try {
      // Try parsing to get proper month name
      const testDate = new Date(str);
      if (!isNaN(testDate.getTime())) {
        const month = testDate.toLocaleDateString('en-GB', { month: 'short' });
        const year = testDate.getFullYear();
        return `${month}-${year}`;
      }
      // If parsing fails, return as-is
      return str;
    } catch {
      return str;
    }
  }
  
  try {
    // Try full date parsing
    const date = new Date(str);
    if (isNaN(date.getTime())) return str;
    
    // Check if day is meaningful (not defaulted to 1st)
    const originalHasDay = /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(str) || 
                          /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str);
    
    const month = date.toLocaleDateString('en-GB', { month: 'short' });
    const year = date.getFullYear();
    
    if (originalHasDay) {
      const day = String(date.getDate()).padStart(2, '0');
      return `${day}-${month}-${year}`;
    }
    return `${month}-${year}`;
  } catch {
    return str;
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

interface SnomedEntry {
  term: string;
  code: string;
  from: string;
  confidence: number;
  evidence: string;
  date?: string;
  source_page?: number | null;
}

interface SnomedData {
  diagnoses?: SnomedEntry[];
  surgeries?: SnomedEntry[];
  allergies?: SnomedEntry[];
  immunisations?: SnomedEntry[];
}

interface LGSummaryPreviewProps {
  patient: LGPatient;
}

export function LGSummaryPreview({ patient }: LGSummaryPreviewProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [snomedData, setSnomedData] = useState<SnomedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSnomedUpdated = useCallback(() => {
    // Trigger reload of SNOMED data
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (patient.job_status !== 'succeeded') {
        setLoading(false);
        return;
      }

      // Only show loading on initial load, not on refresh
      if (refreshKey === 0) {
        setLoading(true);
      }

      try {
        // Load summary JSON
        if (patient.summary_json_url) {
          const summaryPath = patient.summary_json_url.replace('lg/', '');
          const { data: summaryData, error: summaryError } = await supabase.storage
            .from('lg')
            .download(summaryPath);

          if (!summaryError && summaryData) {
            const text = await summaryData.text();
            setSummary(JSON.parse(text));
          }
        }

        // Load SNOMED JSON with cache-busting for refreshes
        if (patient.snomed_json_url) {
          const snomedPath = patient.snomed_json_url.replace('lg/', '');
          
          // Force fresh download by using createSignedUrl with short expiry
          // This bypasses any browser caching
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('lg')
            .createSignedUrl(snomedPath, 60);
          
          if (!signedUrlError && signedUrlData?.signedUrl) {
            const response = await fetch(signedUrlData.signedUrl + `&_t=${Date.now()}`);
            if (response.ok) {
              const text = await response.text();
              setSnomedData(JSON.parse(text));
            }
          }
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load summary');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [patient.summary_json_url, patient.snomed_json_url, patient.job_status, refreshKey]);

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

        {/* SNOMED Read Codes Section */}
        {snomedData && (
          <SnomedCodesSection 
            snomedData={snomedData} 
            practiceOds={patient.practice_ods || ''}
            patientId={patient.id}
            patientName={patient.ai_extracted_name || patient.patient_name || ''}
            patientNhs={patient.ai_extracted_nhs || patient.nhs_number || ''}
            snomedJsonUrl={patient.snomed_json_url}
            onItemUpdated={handleSnomedUpdated}
          />
        )}
      </CardContent>
    </Card>
  );
}

// Helper component for SNOMED codes display
interface SnomedCodesSectionProps {
  snomedData: SnomedData;
  practiceOds: string;
  patientId: string;
  patientName: string;
  patientNhs: string;
  snomedJsonUrl: string | null;
  onItemUpdated: () => void;
}

function SnomedCodesSection({ snomedData, practiceOds, patientId, patientName, patientNhs, snomedJsonUrl, onItemUpdated }: SnomedCodesSectionProps) {
  const [selectedItem, setSelectedItem] = useState<SnomedItemForVerification | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isQualityGateOpen, setIsQualityGateOpen] = useState(false);

  // Collect all codeable items (exclude UNKNOWN codes)
  const codeableItems: Array<{ domain: string; term: string; code: string; date?: string; confidence: number; evidence?: string; source_page?: number | null; index: number }> = [];

  let idx = 0;

  // Diagnoses
  (snomedData.diagnoses ?? []).forEach(item => {
    if (item.code && item.code !== 'UNKNOWN') {
      codeableItems.push({ domain: 'Diagnosis', term: item.term, code: item.code, date: item.date, confidence: item.confidence, evidence: item.evidence, source_page: item.source_page, index: idx });
    }
    idx++;
  });

  // Surgeries
  (snomedData.surgeries ?? []).forEach(item => {
    if (item.code && item.code !== 'UNKNOWN') {
      codeableItems.push({ domain: 'Surgery', term: item.term, code: item.code, date: item.date, confidence: item.confidence, evidence: item.evidence, source_page: item.source_page, index: idx });
    }
    idx++;
  });

  // Allergies
  (snomedData.allergies ?? []).forEach(item => {
    if (item.code && item.code !== 'UNKNOWN') {
      codeableItems.push({ domain: 'Allergy', term: item.term, code: item.code, date: item.date, confidence: item.confidence, evidence: item.evidence, source_page: item.source_page, index: idx });
    }
    idx++;
  });

  // Immunisations
  (snomedData.immunisations ?? []).forEach(item => {
    if (item.code && item.code !== 'UNKNOWN') {
      codeableItems.push({ domain: 'Immunisation', term: item.term, code: item.code, date: item.date, confidence: item.confidence, evidence: item.evidence, source_page: item.source_page, index: idx });
    }
    idx++;
  });

  if (codeableItems.length === 0) return null;

  // Sort items: those with dates first, then those without (NK) at the bottom
  const sortedItems = [...codeableItems].sort((a, b) => {
    const aHasDate = !!a.date && a.date.trim() !== '';
    const bHasDate = !!b.date && b.date.trim() !== '';
    if (aHasDate && !bHasDate) return -1;
    if (!aHasDate && bHasDate) return 1;
    return 0;
  });

  const handleViewSource = (item: typeof codeableItems[0]) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="mt-6 pt-4 border-t">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            Suggested SNOMED Read Codes
          </h4>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsQualityGateOpen(true)}
              className="text-xs"
            >
              <Shield className="h-4 w-4 mr-1" />
              AI Quality Gate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAuditModalOpen(true)}
              className="text-xs"
            >
              <ClipboardCheck className="h-4 w-4 mr-1" />
              Manual Audit
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-2 px-2 font-medium">Type</th>
                <th className="text-left py-2 px-2 font-medium">Term</th>
                <th className="text-left py-2 px-2 font-medium">SNOMED Code</th>
                <th className="text-left py-2 px-2 font-medium">Date</th>
                <th className="text-center py-2 px-2 font-medium">Source</th>
                <th className="text-right py-2 px-2 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item, i) => {
                const dateDisplay = formatUKDate(item.date) || 'NK';
                const isUnknownDate = dateDisplay === 'NK';
                // Source page: add 2 for summary + index pages in PDF
                const hasSource = typeof item.source_page === 'number';
                const sourceDisplay = hasSource ? `Pg ${item.source_page! + 2}` : '—';
                const isLowConfidence = item.confidence <= 0.89;
                
                return (
                  <tr key={i} className="border-b border-muted/30 hover:bg-muted/20">
                    <td className="py-2 px-2">
                      <Badge variant="outline" className="text-xs">{item.domain}</Badge>
                    </td>
                    <td className="py-2 px-2">{item.term}</td>
                    <td className="py-2 px-2 font-mono text-xs text-muted-foreground">{item.code}</td>
                    <td className={`py-2 px-2 ${isUnknownDate ? 'text-muted-foreground/60 italic' : 'text-muted-foreground'}`}>
                      {dateDisplay}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {hasSource ? (
                        <Button
                          variant={isLowConfidence ? "outline" : "ghost"}
                          size="sm"
                          className={`h-7 px-2 text-xs ${isLowConfidence ? 'border-destructive/50 text-destructive hover:bg-destructive/10' : ''}`}
                          onClick={() => handleViewSource(item)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          {sourceDisplay}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">{sourceDisplay}</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <Badge 
                        variant={item.confidence > 0.89 ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {Math.round(item.confidence * 100)}%
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-2 italic">
          NK = Not Known. Click <Eye className="h-3 w-3 inline mx-0.5" /> to view source scan. Review items with low confidence before coding.
        </p>
      </div>

      <LGImageVerificationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        item={selectedItem}
        practiceOds={practiceOds}
        patientId={patientId}
        snomedJsonUrl={snomedJsonUrl}
        onItemUpdated={onItemUpdated}
      />

      <LGSnomedAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        items={codeableItems}
        practiceOds={practiceOds}
        patientId={patientId}
        patientName={patientName}
        patientNhs={patientNhs}
        snomedJsonUrl={snomedJsonUrl}
        onAuditComplete={onItemUpdated}
      />

      <LGQualityGateModal
        isOpen={isQualityGateOpen}
        onClose={() => setIsQualityGateOpen(false)}
        patientId={patientId}
        practiceOds={practiceOds}
        snomedItems={codeableItems.map(item => ({
          id: `item_${item.index}`,
          type: item.domain as 'Diagnosis' | 'Surgery' | 'Immunisation' | 'Allergy' | 'Other',
          term: item.term,
          snomed_code: item.code,
          date: item.date || null,
          confidence: item.confidence * 100,
          page_number: item.source_page ?? 0,
        }))}
        snomedJsonUrl={snomedJsonUrl}
        onComplete={onItemUpdated}
      />
    </>
  );
}
