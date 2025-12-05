import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Download, 
  FolderDown, 
  Copy, 
  CheckCircle, 
  Clock, 
  Upload,
  Archive,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { LGValidationModal } from '@/components/lg-capture/LGValidationModal';
import { LGValidationAuditReport } from '@/components/lg-capture/LGValidationAuditReport';

interface LGPatientFile {
  id: string;
  patient_name: string | null;
  nhs_number: string | null;
  dob: string | null;
  images_count: number | null;
  created_at: string;
  pdf_url: string | null;
  pdf_part_urls: string[] | null;
  pdf_split: boolean | null;
  publish_status: string | null;
  downloaded_at: string | null;
  uploaded_to_s1_at: string | null;
  validated_at: string | null;
  archived_at: string | null;
  validation_result?: {
    clinical_system?: string;
    nhs_match?: boolean;
    dob_match?: boolean;
    file_detected?: boolean;
    confidence?: number;
    manual_override?: boolean;
    override_reason?: string | null;
  } | null;
}

const formatNhsNumber = (nhs: string | null): string => {
  if (!nhs) return '—';
  const clean = nhs.replace(/\s/g, '');
  if (clean.length !== 10) return nhs;
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

export default function LGCaptureFileView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patients, setPatients] = useState<LGPatientFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState('ready');
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [selectedPatientForValidation, setSelectedPatientForValidation] = useState<LGPatientFile | null>(null);

  useEffect(() => {
    if (user) {
      fetchPatients();
    }
  }, [user]);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      // Use explicit any to avoid TS2589 deep type instantiation error on lg_patients table
      const supabaseAny = supabase as any;
      const { data, error } = await supabaseAny
        .from('lg_patients')
        .select('id, patient_name, nhs_number, dob, images_count, created_at, pdf_url, pdf_part_urls, pdf_split, publish_status, downloaded_at, uploaded_to_s1_at, validated_at, archived_at, validation_result')
        .eq('user_id', user?.id)
        .eq('job_status', 'succeeded')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Cast the data to handle Json type for pdf_part_urls
      const typedData: LGPatientFile[] = (data || []).map((item: any) => ({
        id: item.id,
        patient_name: item.patient_name,
        nhs_number: item.nhs_number,
        dob: item.dob,
        images_count: item.images_count,
        created_at: item.created_at,
        pdf_url: item.pdf_url,
        pdf_part_urls: Array.isArray(item.pdf_part_urls) ? item.pdf_part_urls as string[] : null,
        pdf_split: item.pdf_split,
        publish_status: item.publish_status,
        downloaded_at: item.downloaded_at,
        uploaded_to_s1_at: item.uploaded_to_s1_at,
        validated_at: item.validated_at,
        archived_at: item.archived_at,
        validation_result: item.validation_result as LGPatientFile['validation_result']
      }));
      
      setPatients(typedData);
    } catch (err) {
      console.error('Error fetching patients:', err);
      toast.error('Failed to load patient files');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredPatients = () => {
    switch (activeTab) {
      case 'ready':
        return patients.filter(p => !p.downloaded_at && !p.archived_at);
      case 'downloaded':
        return patients.filter(p => p.downloaded_at && !p.uploaded_to_s1_at && !p.archived_at);
      case 'uploaded':
        return patients.filter(p => p.uploaded_to_s1_at && !p.archived_at);
      case 'archived':
        return patients.filter(p => p.archived_at);
      default:
        return patients;
    }
  };

  const filteredPatients = getFilteredPatients();

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredPatients.map(p => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const copyNhsNumber = (nhs: string | null) => {
    if (!nhs) return;
    const clean = nhs.replace(/\s/g, '');
    navigator.clipboard.writeText(clean);
    toast.success('NHS number copied');
  };

  const downloadSingleFile = async (patient: LGPatientFile) => {
    if (!patient.pdf_url) {
      toast.error('No PDF available for this patient');
      return;
    }

    try {
      // Get signed URL
      const { data: signedData, error: signedError } = await supabase.storage
        .from('lg')
        .createSignedUrl(patient.pdf_url, 3600);

      if (signedError || !signedData?.signedUrl) {
        throw new Error('Failed to get download URL');
      }

      // Download file
      const response = await fetch(signedData.signedUrl);
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${patient.nhs_number?.replace(/\s/g, '') || 'unknown'}_Lloyd_George.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Update downloaded_at
      await supabase
        .from('lg_patients')
        .update({ 
          downloaded_at: new Date().toISOString(),
          publish_status: 'downloaded'
        })
        .eq('id', patient.id);

      toast.success('File downloaded');
      fetchPatients();
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to download file');
    }
  };

  const downloadBulk = async () => {
    if (selectedIds.size === 0) {
      toast.error('No files selected');
      return;
    }

    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke('lg-bulk-download', {
        body: { patientIds: Array.from(selectedIds) }
      });

      if (error) throw error;

      if (data?.zipData) {
        // Convert base64 to blob
        const binaryString = atob(data.zipData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/zip' });
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.fileName || `LG_Export_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success(`Downloaded ${data.patientCount || selectedIds.size} patient files`);
        setSelectedIds(new Set());
        fetchPatients();
      }
    } catch (err) {
      console.error('Bulk download error:', err);
      toast.error('Failed to create bulk download');
    } finally {
      setDownloading(false);
    }
  };

  const markAsUploaded = async (patientId: string) => {
    try {
      await supabase
        .from('lg_patients')
        .update({ 
          uploaded_to_s1_at: new Date().toISOString(),
          publish_status: 'uploaded'
        })
        .eq('id', patientId);

      toast.success('Marked as uploaded to SystmOne');
      fetchPatients();
    } catch (err) {
      console.error('Error marking as uploaded:', err);
      toast.error('Failed to update status');
    }
  };

  const archivePatient = async (patientId: string) => {
    try {
      await supabase
        .from('lg_patients')
        .update({ 
          archived_at: new Date().toISOString(),
          publish_status: 'archived'
        })
        .eq('id', patientId);

      toast.success('Record archived');
      fetchPatients();
    } catch (err) {
      console.error('Error archiving:', err);
      toast.error('Failed to archive record');
    }
  };

  const getTabCount = (tab: string) => {
    switch (tab) {
      case 'ready':
        return patients.filter(p => !p.downloaded_at && !p.archived_at).length;
      case 'downloaded':
        return patients.filter(p => p.downloaded_at && !p.uploaded_to_s1_at && !p.archived_at).length;
      case 'uploaded':
        return patients.filter(p => p.uploaded_to_s1_at && !p.archived_at).length;
      case 'archived':
        return patients.filter(p => p.archived_at).length;
      default:
        return 0;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/lg-capture')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">LG Capture File Manager</h1>
              <p className="text-sm text-muted-foreground">Download and manage scanned Lloyd George records</p>
            </div>
          </div>
          <Button onClick={() => navigate('/lg-capture')} className="gap-2">
            <FileText className="h-4 w-4" />
            New Capture
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedIds(new Set()); }}>
              <TabsList className="flex w-full overflow-x-auto gap-1 h-auto flex-wrap sm:flex-nowrap">
                <TabsTrigger value="ready" className="gap-1 text-xs sm:text-sm px-2 sm:px-3 py-1.5 flex-shrink-0">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Ready</span> ({getTabCount('ready')})
                </TabsTrigger>
                <TabsTrigger value="downloaded" className="gap-1 text-xs sm:text-sm px-2 sm:px-3 py-1.5 flex-shrink-0">
                  <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Downloaded</span> ({getTabCount('downloaded')})
                </TabsTrigger>
                <TabsTrigger value="uploaded" className="gap-1 text-xs sm:text-sm px-2 sm:px-3 py-1.5 flex-shrink-0">
                  <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Uploaded</span> ({getTabCount('uploaded')})
                </TabsTrigger>
                <TabsTrigger value="archived" className="gap-1 text-xs sm:text-sm px-2 sm:px-3 py-1.5 flex-shrink-0">
                  <Archive className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Archived</span> ({getTabCount('archived')})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>

          <CardContent>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={filteredPatients.length > 0 && selectedIds.size === filteredPatients.length}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm text-muted-foreground">Select All</span>
                </div>
                {selectedIds.size > 0 && (
                  <Badge variant="secondary">{selectedIds.size} selected</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchPatients}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                {activeTab === 'ready' && selectedIds.size > 0 && (
                  <Button 
                    onClick={downloadBulk} 
                    disabled={downloading}
                    className="gap-2"
                  >
                    {downloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FolderDown className="h-4 w-4" />
                    )}
                    Download ZIP ({selectedIds.size})
                  </Button>
                )}
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No files in this category</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 pr-4 w-10"></th>
                      <th className="pb-3 pr-4 font-medium text-muted-foreground">Patient Name</th>
                      <th className="pb-3 pr-4 font-medium text-muted-foreground">NHS Number</th>
                      <th className="pb-3 pr-4 font-medium text-muted-foreground">DOB</th>
                      <th className="pb-3 pr-4 font-medium text-muted-foreground text-center">Pages</th>
                      <th className="pb-3 pr-4 font-medium text-muted-foreground">Scanned</th>
                      <th className="pb-3 font-medium text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPatients.map((patient) => (
                      <tr key={patient.id} className="border-b last:border-b-0 hover:bg-muted/50">
                        <td className="py-3 pr-4">
                          <Checkbox 
                            checked={selectedIds.has(patient.id)}
                            onCheckedChange={(checked) => handleSelectOne(patient.id, !!checked)}
                          />
                        </td>
                        <td className="py-3 pr-4 font-medium">{patient.patient_name || '—'}</td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{formatNhsNumber(patient.nhs_number)}</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={() => copyNhsNumber(patient.nhs_number)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-sm">{formatDate(patient.dob)}</td>
                        <td className="py-3 pr-4 text-center">
                          <Badge variant="outline">{patient.images_count || 0}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-sm text-muted-foreground">
                          {formatDateTime(patient.created_at)}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {activeTab === 'ready' && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => downloadSingleFile(patient)}
                                className="gap-1"
                              >
                                <Download className="h-3 w-3" />
                                Download
                              </Button>
                            )}
                            {activeTab === 'downloaded' && (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => downloadSingleFile(patient)}
                                  className="gap-1"
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPatientForValidation(patient);
                                    setValidationModalOpen(true);
                                  }}
                                  className="gap-1"
                                >
                                  <ShieldCheck className="h-3 w-3" />
                                  Validate & Upload
                                </Button>
                              </>
                            )}
                            {activeTab === 'uploaded' && (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => downloadSingleFile(patient)}
                                  className="gap-1"
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                                {!patient.validated_at ? (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      setSelectedPatientForValidation(patient);
                                      setValidationModalOpen(true);
                                    }}
                                    className="gap-1"
                                  >
                                    <ShieldCheck className="h-3 w-3" />
                                    Validate
                                  </Button>
                                ) : (
                                  <>
                                    <Badge 
                                      variant={patient.validation_result?.manual_override ? 'destructive' : 'default'}
                                      className="gap-1"
                                    >
                                      {patient.validation_result?.manual_override ? (
                                        <><AlertTriangle className="h-3 w-3" /> Override</>
                                      ) : (
                                        <><CheckCircle className="h-3 w-3" /> Validated</>
                                      )}
                                    </Badge>
                                    <LGValidationAuditReport patient={patient} />
                                  </>
                                )}
                                <Button 
                                  variant="secondary" 
                                  size="sm"
                                  onClick={() => archivePatient(patient.id)}
                                  className="gap-1"
                                >
                                  <Archive className="h-3 w-3" />
                                  Archive
                                </Button>
                              </>
                            )}
                            {activeTab === 'archived' && (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => downloadSingleFile(patient)}
                                  className="gap-1"
                                >
                                  <Download className="h-3 w-3" />
                                  Re-download
                                </Button>
                                {patient.validated_at && (
                                  <>
                                    <Badge 
                                      variant={patient.validation_result?.manual_override ? 'destructive' : 'default'}
                                      className="gap-1"
                                    >
                                      {patient.validation_result?.manual_override ? (
                                        <><AlertTriangle className="h-3 w-3" /> Override</>
                                      ) : (
                                        <><CheckCircle className="h-3 w-3" /> Validated</>
                                      )}
                                    </Badge>
                                    <LGValidationAuditReport patient={patient} />
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Validation Modal */}
      {selectedPatientForValidation && (
        <LGValidationModal
          open={validationModalOpen}
          onClose={() => {
            setValidationModalOpen(false);
            setSelectedPatientForValidation(null);
          }}
          patient={selectedPatientForValidation}
          onValidated={fetchPatients}
        />
      )}
    </div>
  );
}
