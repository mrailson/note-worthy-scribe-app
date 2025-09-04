import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, Download, Trash2, Shield, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CQCEvidenceProps {
  complaintId: string;
  practiceId?: string;
  disabled?: boolean;
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

export function CQCEvidence({ complaintId, practiceId, disabled = false }: CQCEvidenceProps) {
  const [evidenceRecords, setEvidenceRecords] = useState<CQCEvidenceRecord[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceType, setEvidenceType] = useState<string>('');
  const [cqcDomain, setCqcDomain] = useState<string>('');
  const [kloeReference, setKloeReference] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('evidence');

  useEffect(() => {
    fetchCQCEvidence();
  }, [complaintId, practiceId]);

  const fetchCQCEvidence = async () => {
    try {
      let query = supabase
        .from('cqc_evidence')
        .select('*')
        .order('created_at', { ascending: false });

      // Filter by practice_id if available, otherwise show all for the user
      if (practiceId) {
        query = query.eq('practice_id', practiceId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Filter to show complaint-related evidence
      const complaintRelatedEvidence = data?.filter(record => 
        record.title?.includes(complaintId) || 
        record.description?.includes(complaintId) ||
        record.evidence_type === 'complaint_compliance_report'
      ) || [];
      
      setEvidenceRecords(complaintRelatedEvidence);
    } catch (error) {
      console.error('Error fetching CQC evidence:', error);
      toast.error('Failed to load CQC evidence');
    }
  };

  const handleFileUpload = async () => {
    if (!title || !evidenceType) {
      toast.error('Please provide a title and evidence type');
      return;
    }

    setUploading(true);
    try {
      let filePath = null;
      let fileName = null;
      let fileSize = null;

      // Upload file if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const uploadFileName = `cqc-evidence/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('communication-files')
          .upload(uploadFileName, selectedFile);

        if (uploadError) throw uploadError;
        
        filePath = uploadData.path;
        fileName = selectedFile.name;
        fileSize = selectedFile.size;
      }

      // Save evidence record to database
      const { data, error } = await supabase
        .from('cqc_evidence')
        .insert({
          practice_id: practiceId,
          title,
          description: description || null,
          evidence_type: evidenceType,
          cqc_domain: cqcDomain || null,
          kloe_reference: kloeReference || null,
          file_name: fileName,
          file_path: filePath,
          file_size: fileSize,
          tags: tags ? tags.split(',').map(tag => tag.trim()) : null,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      setEvidenceRecords(prev => [data, ...prev]);
      
      // Reset form
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setEvidenceType('');
      setCqcDomain('');
      setKloeReference('');
      setTags('');
      
      toast.success('CQC evidence uploaded successfully');
    } catch (error) {
      console.error('Error uploading CQC evidence:', error);
      toast.error('Failed to upload CQC evidence');
    } finally {
      setUploading(false);
    }
  };

  const downloadFile = async (record: CQCEvidenceRecord) => {
    if (!record.file_path) {
      toast.error('No file associated with this evidence');
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('communication-files')
        .download(record.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = record.file_name || 'cqc-evidence-file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  const deleteEvidence = async (record: CQCEvidenceRecord) => {
    try {
      // Delete file from storage if it exists
      if (record.file_path) {
        const { error: storageError } = await supabase.storage
          .from('communication-files')
          .remove([record.file_path]);

        if (storageError) console.error('Error deleting file from storage:', storageError);
      }

      // Delete from database
      const { error } = await supabase
        .from('cqc_evidence')
        .delete()
        .eq('id', record.id);

      if (error) throw error;

      setEvidenceRecords(prev => prev.filter(r => r.id !== record.id));
      toast.success('CQC evidence deleted');
    } catch (error) {
      console.error('Error deleting evidence:', error);
      toast.error('Failed to delete evidence');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDomainColor = (domain: string | null) => {
    const colors = {
      safe: 'bg-blue-100 text-blue-800',
      effective: 'bg-green-100 text-green-800',
      caring: 'bg-purple-100 text-purple-800',
      responsive: 'bg-orange-100 text-orange-800',
      well_led: 'bg-red-100 text-red-800'
    };
    return colors[domain as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          CQC Evidence Repository
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="evidence">Evidence Records</TabsTrigger>
            <TabsTrigger value="upload">Add Evidence</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="evidence-title">Title *</Label>
                <Input
                  id="evidence-title"
                  placeholder="Evidence title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={disabled || uploading}
                />
              </div>

              <div>
                <Label htmlFor="evidence-description">Description</Label>
                <Textarea
                  id="evidence-description"
                  placeholder="Describe this evidence..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={disabled || uploading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="evidence-type">Evidence Type *</Label>
                  <Select value={evidenceType} onValueChange={setEvidenceType} disabled={disabled}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="complaint_compliance_report">Complaint Compliance Report</SelectItem>
                      <SelectItem value="policy_document">Policy Document</SelectItem>
                      <SelectItem value="training_record">Training Record</SelectItem>
                      <SelectItem value="audit_report">Audit Report</SelectItem>
                      <SelectItem value="meeting_minutes">Meeting Minutes</SelectItem>
                      <SelectItem value="certificate">Certificate</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="cqc-domain">CQC Domain</Label>
                  <Select value={cqcDomain} onValueChange={setCqcDomain} disabled={disabled}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select domain" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="safe">Safe</SelectItem>
                      <SelectItem value="effective">Effective</SelectItem>
                      <SelectItem value="caring">Caring</SelectItem>
                      <SelectItem value="responsive">Responsive</SelectItem>
                      <SelectItem value="well_led">Well Led</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="kloe-reference">KLOE Reference</Label>
                  <Input
                    id="kloe-reference"
                    placeholder="e.g., W1, S2, etc."
                    value={kloeReference}
                    onChange={(e) => setKloeReference(e.target.value)}
                    disabled={disabled || uploading}
                  />
                </div>

                <div>
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    placeholder="tag1, tag2, tag3"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    disabled={disabled || uploading}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="evidence-file">File (Optional)</Label>
                <Input
                  id="evidence-file"
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  disabled={disabled || uploading}
                  accept="*/*"
                />
              </div>

              <Button
                onClick={handleFileUpload}
                disabled={disabled || uploading || !title || !evidenceType}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Adding...' : 'Add CQC Evidence'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="evidence" className="space-y-4">
            {evidenceRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No CQC evidence records found for this complaint</p>
                <p className="text-sm">Generated reports and uploaded evidence will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {evidenceRecords.map((record) => (
                  <div key={record.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{record.title}</h4>
                          {record.cqc_domain && (
                            <Badge className={getDomainColor(record.cqc_domain)}>
                              {record.cqc_domain.replace('_', ' ').toUpperCase()}
                            </Badge>
                          )}
                          {record.kloe_reference && (
                            <Badge variant="outline">{record.kloe_reference}</Badge>
                          )}
                        </div>
                        
                        {record.description && (
                          <p className="text-sm text-muted-foreground mb-2">{record.description}</p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Type: {record.evidence_type.replace('_', ' ')}</span>
                          <span>Added: {new Date(record.created_at).toLocaleDateString()}</span>
                          {record.file_size && (
                            <span>Size: {formatFileSize(record.file_size)}</span>
                          )}
                        </div>
                        
                        {record.tags && record.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {record.tags.map((tag, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        {record.file_path && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadFile(record)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {!disabled && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteEvidence(record)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}