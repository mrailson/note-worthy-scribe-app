import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Download, Eye, Calendar, User, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface CQCReportModalProps {
  complaintId: string;
  complaintReference: string;
}

interface CQCEvidenceRecord {
  id: string;
  title: string;
  description: string | null;
  evidence_type: string;
  cqc_domain: string | null;
  kloe_reference: string | null;
  file_name: string | null;
  file_path: string | null;
  file_size: number | null;
  tags: string[] | null;
  status: string;
  created_at: string;
  uploaded_by: string | null;
}

export function CQCReportModal({ complaintId, complaintReference }: CQCReportModalProps) {
  const [open, setOpen] = useState(false);
  const [reports, setReports] = useState<CQCEvidenceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<CQCEvidenceRecord | null>(null);

  const fetchCQCReports = async () => {
    if (!open) return;
    
    setLoading(true);
    try {
      // First get the practice_id from the complaint
      const { data: complaintData, error: complaintError } = await supabase
        .from('complaints')
        .select('practice_id')
        .eq('id', complaintId)
        .single();

      if (complaintError) throw complaintError;

      let query = supabase.from('cqc_evidence').select('*');

      // Handle practice_id filter - only add if not null
      if (complaintData.practice_id) {
        query = query.eq('practice_id', complaintData.practice_id);
      }

      // Add the OR condition for compliance reports or complaint reference
      query = query.or(`evidence_type.eq.complaint_compliance_report,evidence_type.eq.compliance_report,title.ilike.%${complaintReference}%,tags.cs.{"${complaintReference}"}`);
      
      // Order by creation date
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching CQC reports:', error);
      toast.error('Failed to load CQC compliance reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCQCReports();
  }, [open, complaintId]);

  const downloadReport = async (report: CQCEvidenceRecord) => {
    if (!report.file_path) {
      toast.error('No file available for download');
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('cqc-evidence')
        .download(report.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.file_name || `cqc-report-${report.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Report downloaded successfully');
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Failed to download report');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const getDomainColor = (domain: string | null) => {
    const colors = {
      'Safe': 'bg-blue-100 text-blue-800',
      'Effective': 'bg-green-100 text-green-800',
      'Caring': 'bg-purple-100 text-purple-800',
      'Responsive': 'bg-orange-100 text-orange-800',
      'Well-led': 'bg-red-100 text-red-800'
    };
    return colors[domain as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          View CQC Reports
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            CQC Compliance Reports - {complaintReference}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading CQC compliance reports...
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-8">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No CQC Reports Generated</h3>
                <p className="text-muted-foreground">
                  No CQC compliance reports have been generated for this complaint yet.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {reports.map((report) => (
                  <Card key={report.id} className="border-blue-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            {report.title}
                          </CardTitle>
                          {report.description && (
                            <p className="text-sm text-muted-foreground">
                              {report.description}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          {report.status === 'active' && (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              Active
                            </Badge>
                          )}
                          {report.cqc_domain && (
                            <Badge className={getDomainColor(report.cqc_domain)}>
                              {report.cqc_domain}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          Generated: {format(new Date(report.created_at), 'dd/MM/yyyy HH:mm')}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-4 w-4" />
                          Type: {report.evidence_type.replace('_', ' ').toUpperCase()}
                        </div>
                        {report.kloe_reference && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Shield className="h-4 w-4" />
                            KLOE: {report.kloe_reference}
                          </div>
                        )}
                        {report.file_size && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <FileText className="h-4 w-4" />
                            Size: {formatFileSize(report.file_size)}
                          </div>
                        )}
                      </div>

                      {report.tags && report.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {report.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedReport(report)}
                          className="flex items-center gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </Button>
                        
                        {report.file_path && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadReport(report)}
                            className="flex items-center gap-2"
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Report Details Modal */}
        {selectedReport && (
          <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
            <DialogContent className="max-w-2xl max-h-[85vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {selectedReport.title}
                </DialogTitle>
              </DialogHeader>
              
              <ScrollArea className="max-h-[70vh]">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Evidence Type</label>
                      <p className="text-sm text-muted-foreground">
                        {selectedReport.evidence_type.replace('_', ' ').toUpperCase()}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">CQC Domain</label>
                      <p className="text-sm text-muted-foreground">
                        {selectedReport.cqc_domain || 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">KLOE Reference</label>
                      <p className="text-sm text-muted-foreground">
                        {selectedReport.kloe_reference || 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Status</label>
                      <p className="text-sm text-muted-foreground">
                        {selectedReport.status.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {selectedReport.description && (
                    <div>
                      <label className="text-sm font-medium">Full Report Content</label>
                      <div className="mt-2 p-4 bg-gray-50 rounded-lg border max-h-96 overflow-y-auto">
                        <div className="prose prose-sm max-w-none">
                          {selectedReport.description.split('\n').map((paragraph, index) => (
                            <p key={index} className="mb-3 text-sm leading-relaxed">
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedReport.tags && selectedReport.tags.length > 0 && (
                    <div>
                      <label className="text-sm font-medium">Tags</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {selectedReport.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">File Information</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedReport.file_name || 'No file attached'}
                        </p>
                        {selectedReport.file_size && (
                          <p className="text-xs text-muted-foreground">
                            Size: {formatFileSize(selectedReport.file_size)}
                          </p>
                        )}
                      </div>
                      
                      {selectedReport.file_path && (
                        <Button
                          onClick={() => downloadReport(selectedReport)}
                          className="flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Download Report
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}