import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, FileText, Check, X, Clock, Calendar, Files, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface BatchPatient {
  id: string;
  patient_name: string | null;
  ai_extracted_name: string | null;
  nhs_number: string | null;
  dob: string | null;
  images_count: number | null;
  job_status: string | null;
  processing_error?: string | null;
  pdf_url: string | null;
  pdf_size_mb?: number | null;
  created_at: string;
  upload_started_at: string | null;
  upload_completed_at: string | null;
  ocr_started_at?: string | null;
  ocr_completed_at?: string | null;
  summary_started_at?: string | null;
  summary_completed_at?: string | null;
  pdf_created_at?: string | null;
  pdf_completed_at: string | null;
  batch_id: string | null;
  practice_ods: string | null;
  summary_json?: any;
}

interface BatchGroup {
  batchId: string;
  patients: BatchPatient[];
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  totalPagesScanned: number;
  processingTime: string;
  completedAt: Date;
  practiceName: string;
}

export default function BulkUploadHistory() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<BatchGroup[]>([]);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user?.id) {
      loadBatchHistory();
    }
  }, [user?.id]);

  const loadBatchHistory = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      // Fetch all patients with batch_id
      const { data: patients, error } = await supabase
        .from('lg_patients')
        .select('*')
        .eq('user_id', user.id)
        .not('batch_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!patients || patients.length === 0) {
        setBatches([]);
        return;
      }

      // Fetch summary JSON for each patient
      const patientsWithSummaries: BatchPatient[] = await Promise.all(
        patients.map(async (patient) => {
          let summaryData = null;
          
          if (patient.practice_ods && patient.id) {
            const summaryPath = `${patient.practice_ods}/${patient.id}/final/summary.json`;
            const { data: summaryFile } = await supabase.storage
              .from('lg')
              .download(summaryPath);
            
            if (summaryFile) {
              try {
                summaryData = JSON.parse(await summaryFile.text());
              } catch {}
            }
          }
          
          return { ...patient, summary_json: summaryData };
        })
      );

      // Group by batch_id
      const batchMap = new Map<string, BatchPatient[]>();
      patientsWithSummaries.forEach(p => {
        if (p.batch_id) {
          const existing = batchMap.get(p.batch_id) || [];
          existing.push(p);
          batchMap.set(p.batch_id, existing);
        }
      });

      // Only show completed batches (all files processed)
      const completedBatches: BatchGroup[] = [];
      
      batchMap.forEach((batchPatients, batchId) => {
        const allProcessed = batchPatients.every(p => 
          p.job_status === 'succeeded' || p.job_status === 'failed'
        );
        
        if (!allProcessed || batchPatients.length < 1) return;

        const totalFiles = batchPatients.length;
        const successfulFiles = batchPatients.filter(p => p.job_status === 'succeeded').length;
        const failedFiles = batchPatients.filter(p => p.job_status === 'failed').length;
        const totalPagesScanned = batchPatients.reduce((sum, p) => sum + (p.images_count || 0), 0);

        // Calculate processing time
        const firstUploadStart = batchPatients
          .map(p => p.upload_started_at ? new Date(p.upload_started_at).getTime() : Infinity)
          .reduce((min, t) => Math.min(min, t), Infinity);
        
        const lastPdfComplete = batchPatients
          .map(p => p.pdf_completed_at ? new Date(p.pdf_completed_at).getTime() : 0)
          .reduce((max, t) => Math.max(max, t), 0);

        const totalProcessingTimeMs = lastPdfComplete - firstUploadStart;
        const totalProcessingMins = Math.round(totalProcessingTimeMs / 60000);
        const totalProcessingSecs = Math.round((totalProcessingTimeMs % 60000) / 1000);

        completedBatches.push({
          batchId,
          patients: batchPatients,
          totalFiles,
          successfulFiles,
          failedFiles,
          totalPagesScanned,
          processingTime: `${totalProcessingMins}m ${totalProcessingSecs}s`,
          completedAt: new Date(lastPdfComplete),
          practiceName: batchPatients[0]?.practice_ods || 'Unknown Practice'
        });
      });

      // Sort by completion date descending
      completedBatches.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
      
      setBatches(completedBatches);
    } catch (err) {
      console.error('Error loading batch history:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleBatch = (batchId: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  const handleDownloadPdf = async (pdfPath: string) => {
    try {
      // Remove 'lg/' prefix if present since bucket is 'lg'
      const cleanPath = pdfPath.startsWith('lg/') ? pdfPath.slice(3) : pdfPath;
      
      const { data, error } = await supabase.storage
        .from('lg')
        .download(cleanPath);
      
      if (error || !data) {
        console.error('Error downloading PDF:', error);
        return;
      }
      
      // Create blob URL and trigger download
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = cleanPath.split('/').pop() || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
    }
  };

  const formatNhsNumber = (nhs: string | null): string => {
    if (!nhs) return '—';
    const cleaned = nhs.replace(/\s/g, '');
    if (cleaned.length !== 10) return nhs;
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  };

  const formatDateUK = (dateStr: string | null): string => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (batches.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Files className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No completed batch uploads yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Completed batches will appear here in the same format as the email report
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {batches.map(batch => (
        <Card key={batch.batchId} className="overflow-hidden">
          {/* Header - NHS Blue gradient */}
          <div 
            className="p-4 text-white"
            style={{ background: 'linear-gradient(135deg, #005eb8 0%, #003d7a 100%)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">LG Capture Batch Report</h2>
                <p className="text-sm opacity-90">
                  {batch.practiceName} • {format(batch.completedAt, "EEEE, d MMMM yyyy")} at {format(batch.completedAt, "HH:mm")}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white/20"
                onClick={() => toggleBatch(batch.batchId)}
              >
                {expandedBatches.has(batch.batchId) ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 divide-x border-b">
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-[#005eb8]">{batch.totalFiles}</div>
              <div className="text-xs text-muted-foreground uppercase">Files Processed</div>
            </div>
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{batch.successfulFiles}</div>
              <div className="text-xs text-muted-foreground uppercase">Successful</div>
            </div>
            <div className="p-4 text-center">
              <div className="text-2xl font-bold">{batch.totalPagesScanned}</div>
              <div className="text-xs text-muted-foreground uppercase">Total Pages</div>
            </div>
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-muted-foreground">{batch.processingTime}</div>
              <div className="text-xs text-muted-foreground uppercase">Processing Time</div>
            </div>
          </div>

          {/* Expanded content */}
          {expandedBatches.has(batch.batchId) && (
            <>
              {/* Files Table */}
              <div className="p-4 border-b">
                <h3 className="font-semibold mb-3">Files Summary</h3>
                <ScrollArea className="max-h-[300px]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-left">
                        <th className="p-3 font-semibold text-xs uppercase text-muted-foreground">Patient Name</th>
                        <th className="p-3 font-semibold text-xs uppercase text-muted-foreground">DOB</th>
                        <th className="p-3 font-semibold text-xs uppercase text-muted-foreground text-center">Pages</th>
                        <th className="p-3 font-semibold text-xs uppercase text-muted-foreground text-center">Summary</th>
                        <th className="p-3 font-semibold text-xs uppercase text-muted-foreground text-center">Meds</th>
                        <th className="p-3 font-semibold text-xs uppercase text-muted-foreground text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {batch.patients.map(patient => {
                        const patientName = patient.ai_extracted_name || patient.patient_name || '—';
                        const summaryItems = patient.summary_json 
                          ? (patient.summary_json.significant_past_history?.length || 0) +
                            (patient.summary_json.allergies?.length || 0) +
                            (patient.summary_json.immunisations?.length || 0) +
                            (patient.summary_json.procedures?.length || 0)
                          : 0;
                        const medsCount = patient.summary_json?.medications?.length || 0;

                        return (
                          <tr key={patient.id} className="hover:bg-muted/30">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span>{patientName}</span>
                                {patient.pdf_url && patient.job_status === 'succeeded' && (
                                  <button
                                    onClick={() => handleDownloadPdf(patient.pdf_url!)}
                                    className="text-[#005eb8] hover:text-[#003d7a] transition-colors"
                                    title="Download PDF"
                                  >
                                    <Download className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="p-3">{formatDateUK(patient.dob)}</td>
                            <td className="p-3 text-center">{patient.images_count || 0}</td>
                            <td className="p-3 text-center">{summaryItems > 0 ? `${summaryItems} items` : '—'}</td>
                            <td className="p-3 text-center">{medsCount > 0 ? medsCount : '—'}</td>
                            <td className="p-3 text-center">
                              {patient.job_status === 'succeeded' ? (
                                <Badge className="bg-green-500/10 text-green-600 border-green-200">
                                  <Check className="h-3 w-3 mr-1" />
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  <X className="h-3 w-3 mr-1" />
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>

              {/* Clinical Summary Details */}
              {batch.patients.some(p => p.job_status === 'succeeded' && p.summary_json) && (
                <div className="p-4">
                  <h3 className="font-semibold mb-3">Clinical Summary Details</h3>
                  <div className="space-y-3">
                    {batch.patients
                      .filter(p => p.job_status === 'succeeded' && p.summary_json)
                      .map(patient => {
                        const s = patient.summary_json;
                        const patientName = patient.ai_extracted_name || patient.patient_name || 'Unknown';
                        
                        const diagnosesCount = (s.significant_past_history?.length || 0) + (s.diagnoses?.length || 0);
                        
                        return (
                          <div 
                            key={patient.id} 
                            className="p-3 bg-muted/30 rounded-lg border-l-[3px]"
                            style={{ borderLeftColor: '#005eb8' }}
                          >
                            <h4 className="font-medium text-[#005eb8] mb-2">{patientName}</h4>
                            
                            {s.summary_line && (
                              <p className="text-sm mb-2"><strong>Summary:</strong> {s.summary_line}</p>
                            )}
                            
                            {s.social_history?.smoking_status && s.social_history.smoking_status !== 'unknown' && (
                              <p className="text-xs text-muted-foreground">
                                🚬 Smoking: {s.social_history.smoking_status}
                                {s.social_history.stopped_year && ` (stopped ${s.social_history.stopped_year})`}
                                {s.social_history.pack_years && `, ${s.social_history.pack_years} pack-years`}
                              </p>
                            )}
                            
                            {diagnosesCount > 0 && (
                              <p className="text-xs text-muted-foreground">Diagnoses: {diagnosesCount}</p>
                            )}
                            
                            {s.allergies?.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Allergies: {s.allergies.slice(0, 5).map((a: any) => 
                                  typeof a === 'string' ? a : a.name || a.allergen
                                ).join(', ')}
                                {s.allergies.length > 5 && ` +${s.allergies.length - 5} more`}
                              </p>
                            )}
                            
                            {s.medications?.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Medications: {s.medications.slice(0, 5).map((m: any) => 
                                  typeof m === 'string' ? m : m.name || m.medication
                                ).join(', ')}
                                {s.medications.length > 5 && ` +${s.medications.length - 5} more`}
                              </p>
                            )}
                            
                            {s.immunisation_summary ? (
                              <p className="text-xs text-muted-foreground">💉 Immunisations: {s.immunisation_summary}</p>
                            ) : s.immunisations?.length > 0 && (
                              <p className="text-xs text-muted-foreground">Immunisations: {s.immunisations.length}</p>
                            )}
                            
                            {s.verification_flags && (
                              <p className="text-xs text-green-600 mt-1">
                                {s.verification_flags.all_active_problems_coded && '✓ Problems coded '}
                                {s.verification_flags.allergies_verified && '✓ Allergies verified '}
                                {s.verification_flags.medications_verified && '✓ Medications verified'}
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      ))}
    </div>
  );
}
