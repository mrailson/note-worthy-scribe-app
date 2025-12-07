import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Loader2, FileText, Check, X, Clock, Calendar, Files, ChevronDown, ChevronUp, Download, AlertCircle, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, formatDistanceToNow } from 'date-fns';

interface BatchPatient {
  id: string;
  patient_name: string | null;
  ai_extracted_name: string | null;
  nhs_number: string | null;
  dob: string | null;
  images_count: number | null;
  job_status: string | null;
  processing_error?: string | null;
  error_message?: string | null;
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
  processingFiles: number;
  totalPagesScanned: number;
  processingTime: string;
  completedAt: Date | null;
  submittedAt: Date;
  practiceName: string;
  isComplete: boolean;
}

interface BulkUploadHistoryProps {
  refreshTrigger?: number;
}

export default function BulkUploadHistory({ refreshTrigger = 0 }: BulkUploadHistoryProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pendingBatches, setPendingBatches] = useState<BatchGroup[]>([]);
  const [completedBatches, setCompletedBatches] = useState<BatchGroup[]>([]);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user?.id) {
      loadBatchHistory();
    }
  }, [user?.id, refreshTrigger]);

  // Set up real-time subscription for status updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('batch-status-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lg_patients',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          // Refresh when any patient status changes
          loadBatchHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        setPendingBatches([]);
        setCompletedBatches([]);
        return;
      }

      // Fetch summary JSON for completed patients only (for performance)
      const patientsWithSummaries: BatchPatient[] = await Promise.all(
        patients.map(async (patient) => {
          let summaryData = null;
          
          // Only fetch summary for completed patients
          if (patient.job_status === 'succeeded' && patient.practice_ods && patient.id) {
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

      const pending: BatchGroup[] = [];
      const completed: BatchGroup[] = [];
      
      batchMap.forEach((batchPatients, batchId) => {
        const successfulFiles = batchPatients.filter(p => p.job_status === 'succeeded').length;
        const failedFiles = batchPatients.filter(p => p.job_status === 'failed').length;
        const processingFiles = batchPatients.filter(p => 
          p.job_status !== 'succeeded' && p.job_status !== 'failed'
        ).length;
        
        const allProcessed = processingFiles === 0;
        const totalFiles = batchPatients.length;
        const totalPagesScanned = batchPatients.reduce((sum, p) => sum + (p.images_count || 0), 0);

        // Get submission time (earliest created_at)
        const submittedAt = new Date(
          Math.min(...batchPatients.map(p => new Date(p.created_at).getTime()))
        );

        // Calculate processing time (only for completed batches)
        let processingTime = '';
        let completedAt: Date | null = null;
        
        if (allProcessed) {
          const firstUploadStart = batchPatients
            .map(p => p.upload_started_at ? new Date(p.upload_started_at).getTime() : Infinity)
            .reduce((min, t) => Math.min(min, t), Infinity);
          
          const lastPdfComplete = batchPatients
            .map(p => p.pdf_completed_at ? new Date(p.pdf_completed_at).getTime() : 0)
            .reduce((max, t) => Math.max(max, t), 0);

          if (lastPdfComplete > 0) {
            completedAt = new Date(lastPdfComplete);
            const totalProcessingTimeMs = lastPdfComplete - firstUploadStart;
            const totalProcessingMins = Math.round(totalProcessingTimeMs / 60000);
            const totalProcessingSecs = Math.round((totalProcessingTimeMs % 60000) / 1000);
            processingTime = `${totalProcessingMins}m ${totalProcessingSecs}s`;
          }
        }

        const batchGroup: BatchGroup = {
          batchId,
          patients: batchPatients,
          totalFiles,
          successfulFiles,
          failedFiles,
          processingFiles,
          totalPagesScanned,
          processingTime,
          completedAt,
          submittedAt,
          practiceName: batchPatients[0]?.practice_ods || 'Unknown Practice',
          isComplete: allProcessed
        };

        if (allProcessed) {
          completed.push(batchGroup);
        } else {
          pending.push(batchGroup);
        }
      });

      // Sort: pending by submission time (newest first), completed by completion time (newest first)
      pending.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
      completed.sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0));
      
      setPendingBatches(pending);
      setCompletedBatches(completed);
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

  const handleDownloadPdf = async (patient: BatchPatient) => {
    try {
      const basePath = `${patient.practice_ods}/${patient.id}/final`;
      
      const { data: files, error: listError } = await supabase.storage
        .from('lg')
        .list(basePath, { limit: 20 });
      
      if (listError || !files) {
        console.error('Error listing files:', listError);
        return;
      }
      
      const pdfFiles = files.filter(f => f.name.endsWith('.pdf'));
      const targetFile = pdfFiles.find(f => f.name.startsWith('Lloyd_George')) || pdfFiles[0];
      
      if (!targetFile) {
        console.error('No PDF found in final folder');
        return;
      }
      
      const fullPath = `${basePath}/${targetFile.name}`;
      
      const { data, error } = await supabase.storage
        .from('lg')
        .download(fullPath);
      
      if (error || !data) {
        console.error('Error downloading PDF:', error);
        return;
      }
      
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = targetFile.name;
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

  const getPatientStatusBadge = (status: string | null) => {
    switch (status) {
      case 'succeeded':
        return <Badge className="bg-green-500/10 text-green-600 border-green-200"><Check className="h-3 w-3 mr-1" />Complete</Badge>;
      case 'failed':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      case 'queued':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200"><Clock className="h-3 w-3 mr-1" />Queued</Badge>;
      case 'uploading':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-200"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Uploading</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{status || 'Pending'}</Badge>;
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

  if (pendingBatches.length === 0 && completedBatches.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Files className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No batch uploads yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Drop PDF files in the Upload tab to start a batch
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* In Progress Batches */}
      {pendingBatches.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-600">
            <Timer className="h-5 w-5" />
            Processing ({pendingBatches.length})
          </h3>
          
          {pendingBatches.map(batch => {
            const progressPercent = batch.totalFiles > 0 
              ? Math.round(((batch.successfulFiles + batch.failedFiles) / batch.totalFiles) * 100)
              : 0;
            
            return (
              <Card key={batch.batchId} className="border-amber-200 bg-amber-50/30">
                {/* Header - Amber gradient for in-progress */}
                <div 
                  className="p-4 text-white rounded-t-lg"
                  style={{ background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <h2 className="text-lg font-semibold">Processing Batch</h2>
                      </div>
                      <p className="text-sm opacity-90">
                        Submitted {formatDistanceToNow(batch.submittedAt, { addSuffix: true })} • {format(batch.submittedAt, "HH:mm 'on' dd/MM/yyyy")}
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

                {/* Progress Bar */}
                <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-amber-700 font-medium">
                      {batch.successfulFiles + batch.failedFiles} of {batch.totalFiles} files processed
                    </span>
                    <span className="text-amber-600">{progressPercent}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-2 bg-amber-200" />
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-4 divide-x border-b">
                  <div className="p-3 text-center">
                    <div className="text-xl font-bold text-amber-600">{batch.totalFiles}</div>
                    <div className="text-xs text-muted-foreground uppercase">Total Files</div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-xl font-bold text-blue-600">{batch.processingFiles}</div>
                    <div className="text-xs text-muted-foreground uppercase">Processing</div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-xl font-bold text-green-600">{batch.successfulFiles}</div>
                    <div className="text-xs text-muted-foreground uppercase">Complete</div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-xl font-bold">{batch.totalPagesScanned}</div>
                    <div className="text-xs text-muted-foreground uppercase">Pages</div>
                  </div>
                </div>

                {/* Expanded file list */}
                {expandedBatches.has(batch.batchId) && (
                  <div className="p-4">
                    <ScrollArea className="max-h-[250px]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 text-left">
                            <th className="p-2 font-semibold text-xs uppercase text-muted-foreground">#</th>
                            <th className="p-2 font-semibold text-xs uppercase text-muted-foreground">Patient / File</th>
                            <th className="p-2 font-semibold text-xs uppercase text-muted-foreground text-center">Pages</th>
                            <th className="p-2 font-semibold text-xs uppercase text-muted-foreground text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {batch.patients.map((patient, idx) => {
                            const patientName = patient.ai_extracted_name || patient.patient_name || `File ${idx + 1}`;
                            const hasError = patient.job_status === 'failed' && (patient.error_message || patient.processing_error);
                            
                            return (
                              <tr key={patient.id} className="hover:bg-muted/30">
                                <td className="p-2 text-muted-foreground">{idx + 1}</td>
                                <td className="p-2">
                                  <div>
                                    <span>{patientName}</span>
                                    {hasError && (
                                      <p className="text-xs text-destructive mt-0.5 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        {patient.error_message || patient.processing_error}
                                      </p>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2 text-center">{patient.images_count || '—'}</td>
                                <td className="p-2 text-center">{getPatientStatusBadge(patient.job_status)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Completed Batches */}
      {completedBatches.length > 0 && (
        <div className="space-y-4">
          {pendingBatches.length > 0 && (
            <h3 className="text-lg font-semibold flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              Completed ({completedBatches.length})
            </h3>
          )}
          
          {completedBatches.map(batch => (
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
                      {batch.practiceName} • {batch.completedAt ? format(batch.completedAt, "EEEE, d MMMM yyyy 'at' HH:mm") : 'Unknown'}
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
                  <div className="text-2xl font-bold text-muted-foreground">{batch.processingTime || '—'}</div>
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
                                        onClick={() => handleDownloadPdf(patient)}
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
      )}
    </div>
  );
}
