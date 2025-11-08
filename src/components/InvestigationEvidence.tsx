import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, Download, Trash2, Mic, Play, Pause, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SpeechToText } from '@/components/SpeechToText';

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

export function InvestigationEvidence({ complaintId, disabled = false }: InvestigationEvidenceProps) {
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [audioTranscripts, setAudioTranscripts] = useState<AudioTranscript[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [evidenceType, setEvidenceType] = useState<string>('other');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [transcribing, setTranscribing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('files');

  useEffect(() => {
    fetchEvidenceFiles();
    fetchAudioTranscripts();
  }, [complaintId]);

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

      if (transcriptionError) throw transcriptionError;

      // Save transcript to database
      const { data, error } = await supabase
        .from('complaint_investigation_transcripts')
        .insert({
          complaint_id: complaintId,
          audio_file_id: audioFile.id,
          transcript_text: transcriptionData.text,
          transcription_confidence: transcriptionData.confidence || null,
          transcribed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      setAudioTranscripts(prev => [data, ...prev]);
      toast.success('Audio transcribed successfully');
    } catch (error) {
      console.error('Error transcribing audio:', error);
      toast.error('Failed to transcribe audio');
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

  const deleteFile = async (file: EvidenceFile) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('communication-files')
        .remove([file.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error } = await supabase
        .from('complaint_investigation_evidence')
        .delete()
        .eq('id', file.id);

      if (error) throw error;

      setEvidenceFiles(prev => prev.filter(f => f.id !== file.id));
      toast.success('Evidence file deleted');
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
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
                          onClick={() => deleteFile(file)}
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
                    <div key={transcript.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Volume2 className="h-4 w-4" />
                          <span className="font-medium">{audioFile?.file_name || 'Unknown file'}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(transcript.transcribed_at).toLocaleDateString()}
                          {transcript.transcription_confidence && (
                            <span className="ml-2">
                              Confidence: {Math.round(transcript.transcription_confidence * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">
                        {transcript.transcript_text}
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
  );
}