import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FileText, Upload, Download, Trash2, Mic, Play, Pause, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SpeechToText } from '@/components/SpeechToText';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

interface InvestigationEvidenceProps {
  complaintId: string;
  disabled?: boolean;
}

interface EvidenceFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  evidence_type: string;
  description: string | null;
  uploaded_at: string;
}

interface AudioTranscript {
  id: string;
  audio_file_id: string;
  transcript_text: string;
  transcription_confidence: number | null;
  transcribed_at: string;
}
interface ComplaintDetails {
  reference_number: string;
  patient_name: string;
  incident_date: string;
  complaint_title: string;
  category: string;
  status: string;
  practice_name: string | null;
}

export function InvestigationEvidence({ complaintId, disabled = false }: InvestigationEvidenceProps) {
  const [complaintDetails, setComplaintDetails] = useState<ComplaintDetails | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [audioTranscripts, setAudioTranscripts] = useState<AudioTranscript[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [evidenceType, setEvidenceType] = useState<string>('other');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [transcribing, setTranscribing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('files');
  const [transcriptionModal, setTranscriptionModal] = useState<{
    isOpen: boolean;
    fileName: string;
    text: string;
    confidence: number | null;
  }>({
    isOpen: false,
    fileName: '',
    text: '',
    confidence: null
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    file: EvidenceFile | null;
  }>({
    isOpen: false,
    file: null
  });
  const [transcriptDeleteConfirmation, setTranscriptDeleteConfirmation] = useState<{
    isOpen: boolean;
    transcript: AudioTranscript | null;
  }>({
    isOpen: false,
    transcript: null
  });

  useEffect(() => {
    fetchComplaintDetails();
    fetchEvidenceFiles();
    fetchAudioTranscripts();
  }, [complaintId]);

  const fetchComplaintDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select(`
          reference_number, 
          patient_name, 
          incident_date, 
          complaint_title, 
          category, 
          status,
          gp_practices (name)
        `)
        .eq('id', complaintId)
        .single();

      if (error) throw error;
      setComplaintDetails({
        ...data,
        practice_name: data.gp_practices?.name || null
      });
    } catch (error) {
      console.error('Error fetching complaint details:', error);
    }
  };

  const fetchEvidenceFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('complaint_investigation_evidence')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setEvidenceFiles(data || []);
    } catch (error) {
      console.error('Error fetching evidence files:', error);
      toast.error('Failed to load evidence files');
    }
  };

  const fetchAudioTranscripts = async () => {
    try {
      const { data, error } = await supabase
        .from('complaint_investigation_transcripts')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('transcribed_at', { ascending: false });

      if (error) throw error;
      setAudioTranscripts(data || []);
    } catch (error) {
      console.error('Error fetching audio transcripts:', error);
      toast.error('Failed to load audio transcripts');
    }
  };

  const formatTranscriptIntoParagraphs = (text: string): string[] => {
    return text.split(/(?<=[.!?])\s+(?=[A-Z])|(?<=\?)\s+|(?<=\.)\s{2,}/).reduce((acc: string[][], sentence) => {
      const lastGroup = acc[acc.length - 1];
      if (!lastGroup || lastGroup.length >= 4 || (lastGroup.join(' ').length > 400)) {
        acc.push([sentence]);
      } else {
        lastGroup.push(sentence);
      }
      return acc;
    }, [] as string[][]).map(paragraph => paragraph.join(' '));
  };

  const downloadTranscriptAsWord = async (
    text: string = transcriptionModal.text,
    fileName: string = transcriptionModal.fileName,
    confidence: number | null = transcriptionModal.confidence
  ) => {
    if (!complaintDetails) {
      toast.error('Complaint details not available');
      return;
    }

    try {
      const paragraphs = formatTranscriptIntoParagraphs(text);
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Title
            new Paragraph({
              children: [
                new TextRun({
                  text: "Audio Transcription Record",
                  bold: true,
                  size: 36,
                })
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 400 }
            }),
            
            // Complaint Reference
            new Paragraph({
              children: [
                new TextRun({
                  text: `Complaint Reference: ${complaintDetails.reference_number}`,
                  bold: true,
                  size: 28,
                })
              ],
              spacing: { after: 300 }
            }),
            
            // Divider line effect via border
            new Paragraph({
              children: [],
              border: {
                bottom: {
                  color: "999999",
                  space: 1,
                  size: 6,
                  style: BorderStyle.SINGLE,
                }
              },
              spacing: { after: 300 }
            }),
            
            // Complaint Details Section
            new Paragraph({
              children: [
                new TextRun({ text: "Complaint Details", bold: true, size: 24 })
              ],
              spacing: { after: 200 }
            }),
            
            ...(complaintDetails.practice_name ? [
              new Paragraph({
                children: [
                  new TextRun({ text: "Practice: ", bold: true }),
                  new TextRun({ text: complaintDetails.practice_name })
                ],
                spacing: { after: 120 }
              })
            ] : []),
            
            new Paragraph({
              children: [
                new TextRun({ text: "Patient Name: ", bold: true }),
                new TextRun({ text: complaintDetails.patient_name })
              ],
              spacing: { after: 120 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({ text: "Incident Date: ", bold: true }),
                new TextRun({ text: new Date(complaintDetails.incident_date).toLocaleDateString('en-GB') })
              ],
              spacing: { after: 120 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({ text: "Complaint Title: ", bold: true }),
                new TextRun({ text: complaintDetails.complaint_title })
              ],
              spacing: { after: 120 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({ text: "Category: ", bold: true }),
                new TextRun({ text: complaintDetails.category })
              ],
              spacing: { after: 120 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({ text: "Status: ", bold: true }),
                new TextRun({ text: complaintDetails.status })
              ],
              spacing: { after: 300 }
            }),
            
            // Audio File Details
            new Paragraph({
              children: [],
              border: {
                bottom: {
                  color: "999999",
                  space: 1,
                  size: 6,
                  style: BorderStyle.SINGLE,
                }
              },
              spacing: { after: 300 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({ text: "Audio File Details", bold: true, size: 24 })
              ],
              spacing: { after: 200 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({ text: "File Name: ", bold: true }),
                new TextRun({ text: fileName })
              ],
              spacing: { after: 120 }
            }),
            
            ...(confidence ? [
              new Paragraph({
                children: [
                  new TextRun({ text: "Transcription Confidence: ", bold: true }),
                  new TextRun({ text: `${Math.round(confidence * 100)}%` })
                ],
                spacing: { after: 120 }
              })
            ] : []),
            
            new Paragraph({
              children: [
                new TextRun({ text: "Transcription Date: ", bold: true }),
                new TextRun({ text: new Date().toLocaleDateString('en-GB') })
              ],
              spacing: { after: 300 }
            }),
            
            // Transcript Section
            new Paragraph({
              children: [],
              border: {
                bottom: {
                  color: "999999",
                  space: 1,
                  size: 6,
                  style: BorderStyle.SINGLE,
                }
              },
              spacing: { after: 300 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({ text: "Transcript", bold: true, size: 24 })
              ],
              spacing: { after: 300 }
            }),
            
            // Transcript paragraphs with nice spacing
            ...paragraphs.map(para => 
              new Paragraph({
                children: [
                  new TextRun({ text: para, size: 22 })
                ],
                spacing: { after: 240, line: 360 }
              })
            ),
            
            // Footer
            new Paragraph({
              children: [],
              spacing: { before: 400 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({
                  text: `Document generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
                  italics: true,
                  size: 18,
                  color: "666666"
                })
              ],
              alignment: AlignmentType.RIGHT
            })
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      const outputFileName = `Transcript_${complaintDetails.reference_number}_${fileName.replace(/\.[^/.]+$/, '')}.docx`;
      saveAs(blob, outputFileName);
      toast.success('Transcript downloaded successfully');
    } catch (error) {
      console.error('Error generating Word document:', error);
      toast.error('Failed to generate Word document');
    }
  };
  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);
    try {
      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${complaintId}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('communication-files')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Save file metadata to database
      const { data, error } = await supabase
        .from('complaint_investigation_evidence')
        .insert({
          complaint_id: complaintId,
          file_name: selectedFile.name,
          file_path: uploadData.path,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          evidence_type: evidenceType,
          description: description || null,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      setEvidenceFiles(prev => [data, ...prev]);
      setSelectedFile(null);
      setEvidenceType('other');
      setDescription('');
      
      toast.success('Evidence file uploaded successfully');
    } catch (error) {
      console.error('Error uploading file:', error);
      const message = error && typeof error === 'object' && 'message' in (error as any)
        ? String((error as any).message)
        : JSON.stringify(error);
      toast.error(`Upload failed: ${message}`);
    } finally {
      setUploading(false);
    }
  };

  const confirmDeleteTranscript = (transcript: AudioTranscript) => {
    setTranscriptDeleteConfirmation({ isOpen: true, transcript });
  };

  const deleteTranscript = async () => {
    const transcript = transcriptDeleteConfirmation.transcript;
    if (!transcript) return;

    try {
      const { error } = await supabase
        .from('complaint_investigation_transcripts')
        .delete()
        .eq('id', transcript.id);

      if (error) throw error;

      setAudioTranscripts(prev => prev.filter(t => t.id !== transcript.id));
      toast.success('Transcript deleted successfully');
    } catch (error) {
      console.error('Error deleting transcript:', error);
      toast.error('Failed to delete transcript');
    } finally {
      setTranscriptDeleteConfirmation({ isOpen: false, transcript: null });
    }
  };

  const transcribeAudio = async (audioFile: EvidenceFile) => {
    // Check if it's an audio file by MIME type or evidence type
    const isAudioFile = audioFile.file_type?.startsWith('audio/') || 
                        audioFile.evidence_type === 'audio' ||
                        /\.(mp3|wav|m4a|ogg|webm)$/i.test(audioFile.file_name);
    
    if (!isAudioFile) {
      toast.error('Selected file is not an audio file');
      return;
    }

    setTranscribing(audioFile.id);
    try {
      console.log('Starting audio transcription for file:', audioFile.file_name);
      
      // Check file size first (limit to 25MB)
      if (audioFile.file_size > 25 * 1024 * 1024) {
        throw new Error('Audio file too large. Maximum size is 25MB.');
      }

      // Download the audio file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('communication-files')
        .download(audioFile.file_path);

      if (downloadError) throw downloadError;

      console.log('Audio file downloaded, size:', fileData.size);

      // Convert to base64 for the transcription service
      const arrayBuffer = await fileData.arrayBuffer();
      let base64Audio;
      
      // Use a more memory-efficient approach for large files
      if (arrayBuffer.byteLength > 10 * 1024 * 1024) { // 10MB+
        // For large files, use chunks to avoid memory issues
        const chunkSize = 1024 * 1024; // 1MB chunks
        const chunks = [];
        const uint8Array = new Uint8Array(arrayBuffer);
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          let chunkString = '';
          for (let j = 0; j < chunk.length; j++) {
            chunkString += String.fromCharCode(chunk[j]);
          }
          chunks.push(chunkString);
        }
        
        base64Audio = btoa(chunks.join(''));
        console.log('Large file converted to base64');
      } else {
        // For smaller files, use the standard approach
        const uint8Array = new Uint8Array(arrayBuffer);
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binaryString += String.fromCharCode(uint8Array[i]);
        }
        base64Audio = btoa(binaryString);
        console.log('Small file converted to base64');
      }

      // Call the transcription service with file type information
      const { data: transcriptionData, error: transcriptionError } = await supabase.functions
        .invoke('speech-to-text', {
          body: { 
            audio: base64Audio,
            mimeType: audioFile.file_type,
            fileName: audioFile.file_name
          }
        });

      if (transcriptionError) {
        console.error('Transcription service error:', transcriptionError);
        throw transcriptionError;
      }

      console.log('Transcription response:', transcriptionData);

      if (!transcriptionData?.text) {
        console.error('No transcription text returned:', transcriptionData);
        throw new Error('No transcription text was returned from the service');
      }

      // Save transcript to database
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('You must be signed in to transcribe audio');

      const { data, error } = await supabase
        .from('complaint_investigation_transcripts')
        .insert({
          complaint_id: complaintId,
          audio_file_id: audioFile.id,
          transcript_text: transcriptionData.text,
          transcription_confidence: transcriptionData.confidence || null,
          transcribed_by: authData.user.id
        })
        .select()
        .single();

      if (error) {
        console.error('Database save error:', error);
        throw error;
      }

      setAudioTranscripts(prev => [data, ...prev]);
      
      // Show transcription in modal
      setTranscriptionModal({
        isOpen: true,
        fileName: audioFile.file_name,
        text: transcriptionData.text,
        confidence: transcriptionData.confidence || null
      });
      
      toast.success('Audio transcribed successfully');
    } catch (error) {
      console.error('Error transcribing audio:', error);
      const message = error && typeof error === 'object' && 'message' in (error as any)
        ? String((error as any).message)
        : JSON.stringify(error);
      toast.error('Failed to transcribe audio', {
        description: message || 'Unknown error'
      });
    } finally {
      setTranscribing(null);
    }
  };

  const downloadFile = async (file: EvidenceFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('communication-files')
        .download(file.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  const confirmDeleteFile = (file: EvidenceFile) => {
    setDeleteConfirmation({
      isOpen: true,
      file: file
    });
  };

  const deleteFile = async () => {
    const file = deleteConfirmation.file;
    if (!file) return;

    setDeleteConfirmation({ isOpen: false, file: null });

    try {
      console.log('Attempting to delete evidence file:', file.id, file.file_name);

      // Delete from database first (this will trigger audit logging)
      const { error: dbError } = await supabase
        .from('complaint_investigation_evidence')
        .delete()
        .eq('id', file.id);

      if (dbError) {
        console.error('Database delete error:', dbError);
        throw new Error(`Database error: ${dbError.message}`);
      }

      // Then delete from storage
      const { error: storageError } = await supabase.storage
        .from('communication-files')
        .remove([file.file_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Don't throw - file is already deleted from DB, just warn
        toast.error('File deleted from database but storage cleanup failed');
        setEvidenceFiles(prev => prev.filter(f => f.id !== file.id));
        return;
      }

      setEvidenceFiles(prev => prev.filter(f => f.id !== file.id));
      toast.success('Evidence file deleted successfully');
      
      console.log('Evidence file deleted successfully:', file.file_name);
    } catch (error) {
      console.error('Error deleting evidence file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete file';
      toast.error(errorMessage);
    }
  };

  const getEvidenceTypeLabel = (type: string) => {
    const types = {
      email: 'Email',
      pdf: 'PDF Document',
      image: 'Image',
      audio: 'Audio Recording',
      other: 'Other'
    };
    return types[type as keyof typeof types] || type;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <AlertDialog open={deleteConfirmation.isOpen} onOpenChange={(open) => !open && setDeleteConfirmation({ isOpen: false, file: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Evidence File?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You are about to permanently delete:</p>
              <p className="font-semibold text-foreground">{deleteConfirmation.file?.file_name}</p>
              <p>This will:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Remove the file from investigation evidence</li>
                <li>Delete any associated audio transcripts</li>
                <li>Remove the file from secure storage</li>
              </ul>
              <p className="font-semibold text-destructive mt-3">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteFile} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete File
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={transcriptDeleteConfirmation.isOpen} onOpenChange={(open) => !open && setTranscriptDeleteConfirmation({ isOpen: false, transcript: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transcript?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Are you sure you want to delete this transcript?</p>
              <p className="font-semibold text-destructive mt-3">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTranscript} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Transcript
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={transcriptionModal.isOpen} onOpenChange={(open) => setTranscriptionModal(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Volume2 className="h-5 w-5 text-primary" />
              Audio Transcription
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{transcriptionModal.fileName}</span>
              {transcriptionModal.confidence && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {Math.round(transcriptionModal.confidence * 100)}% confidence
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            <div className="bg-muted/50 p-6 rounded-lg border">
              <div className="prose prose-sm md:prose-base max-w-none dark:prose-invert space-y-4">
                {transcriptionModal.text.split(/(?<=[.!?])\s+(?=[A-Z])|(?<=\?)\s+|(?<=\.)\s{2,}/).reduce((acc: string[][], sentence, index, arr) => {
                  // Group sentences into paragraphs of roughly 3-4 sentences
                  const lastGroup = acc[acc.length - 1];
                  if (!lastGroup || lastGroup.length >= 4 || (lastGroup.join(' ').length > 400)) {
                    acc.push([sentence]);
                  } else {
                    lastGroup.push(sentence);
                  }
                  return acc;
                }, [] as string[][]).map((paragraph, idx) => (
                  <p key={idx} className="text-base leading-relaxed text-foreground">
                    {paragraph.join(' ')}
                  </p>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => downloadTranscriptAsWord()}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Word
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(transcriptionModal.text);
                toast.success('Transcription copied to clipboard');
              }}
            >
              Copy to Clipboard
            </Button>
            <Button onClick={() => setTranscriptionModal(prev => ({ ...prev, isOpen: false }))}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Investigation Evidence
          </CardTitle>
        </CardHeader>
        <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="files">Evidence Files</TabsTrigger>
            <TabsTrigger value="upload">Upload Evidence</TabsTrigger>
            <TabsTrigger value="transcripts">Audio Transcripts</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="evidence-file">Select Evidence File</Label>
                <Input
                  id="evidence-file"
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  disabled={disabled || uploading}
                  accept="*/*"
                />
              </div>

              <div>
                <Label htmlFor="evidence-type">Evidence Type</Label>
                <Select value={evidenceType} onValueChange={setEvidenceType} disabled={disabled}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select evidence type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="pdf">PDF Document</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="audio">Audio Recording</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Describe this evidence..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={disabled || uploading}
                />
              </div>

              <Button
                onClick={handleFileUpload}
                disabled={disabled || uploading || !selectedFile}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload Evidence'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="files" className="space-y-4">
            {evidenceFiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No evidence files uploaded yet
              </div>
            ) : (
              <div className="space-y-3">
                {evidenceFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{file.file_name}</span>
                        <Badge variant="secondary">{getEvidenceTypeLabel(file.evidence_type)}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatFileSize(file.file_size)} • {new Date(file.uploaded_at).toLocaleDateString()}
                      </div>
                      {file.description && (
                        <div className="text-sm text-muted-foreground mt-1">{file.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {(file.evidence_type === 'audio' || 
                        file.file_type?.startsWith('audio/') ||
                        /\.(mp3|wav|m4a|ogg|webm)$/i.test(file.file_name)) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => transcribeAudio(file)}
                          disabled={transcribing === file.id}
                        >
                          <Mic className="h-4 w-4 mr-1" />
                          {transcribing === file.id ? 'Transcribing...' : 'Transcribe'}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => downloadFile(file)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      {!disabled && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => confirmDeleteFile(file)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transcripts" className="space-y-4">
            {audioTranscripts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No audio transcripts available yet
              </div>
            ) : (
              <div className="space-y-4">
                {audioTranscripts.map((transcript) => {
                  const audioFile = evidenceFiles.find(f => f.id === transcript.audio_file_id);
                  return (
                    <div key={transcript.id} className="p-5 border rounded-lg bg-card">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b">
                        <div className="flex items-center gap-2">
                          <Volume2 className="h-5 w-5 text-primary" />
                          <span className="font-semibold text-base">{audioFile?.file_name || 'Unknown file'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">{new Date(transcript.transcribed_at).toLocaleDateString()}</span>
                          {transcript.transcription_confidence && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                              {Math.round(transcript.transcription_confidence * 100)}% confidence
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadTranscriptAsWord(
                              transcript.transcript_text,
                              audioFile?.file_name || 'transcript',
                              transcript.transcription_confidence
                            )}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Word
                          </Button>
                          {!disabled && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => confirmDeleteTranscript(transcript)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="bg-muted/50 p-5 rounded-lg border">
                        <div className="prose prose-sm md:prose-base max-w-none dark:prose-invert space-y-4">
                          {transcript.transcript_text.split(/(?<=[.!?])\s+(?=[A-Z])|(?<=\?)\s+|(?<=\.)\s{2,}/).reduce((acc: string[][], sentence) => {
                            const lastGroup = acc[acc.length - 1];
                            if (!lastGroup || lastGroup.length >= 4 || (lastGroup.join(' ').length > 400)) {
                              acc.push([sentence]);
                            } else {
                              lastGroup.push(sentence);
                            }
                            return acc;
                          }, [] as string[][]).map((paragraph, idx) => (
                            <p key={idx} className="text-base leading-relaxed text-foreground">
                              {paragraph.join(' ')}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
    </>
  );
}