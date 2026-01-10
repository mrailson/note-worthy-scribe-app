import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  Upload, 
  Mic, 
  Clipboard, 
  Loader2, 
  Wand2,
  AlertCircle,
  CheckCircle2,
  FileAudio
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { 
  ConsultationType, 
  ConsultationCategory, 
  ConsultationNote,
  ScribeSettings,
  CONSULTATION_TYPE_LABELS,
  CONSULTATION_CATEGORY_LABELS
} from "@/types/scribe";
import { supabase } from "@/integrations/supabase/client";
import { showToast } from "@/utils/toastWrapper";
import { FileProcessorManager } from "@/utils/fileProcessors/FileProcessorManager";

interface ScribeImportPanelProps {
  settings: ScribeSettings;
  onNotesGenerated: (notes: ConsultationNote, transcript: string) => void;
}

type ImportTab = 'paste' | 'audio' | 'document';

export const ScribeImportPanel = ({ settings, onNotesGenerated }: ScribeImportPanelProps) => {
  const [activeImportTab, setActiveImportTab] = useState<ImportTab>('paste');
  const [pastedText, setPastedText] = useState('');
  const [consultationType, setConsultationType] = useState<ConsultationType>('f2f');
  const [consultationCategory, setConsultationCategory] = useState<ConsultationCategory>('general');
  
  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Audio processing
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioTranscript, setAudioTranscript] = useState('');
  
  // Document processing
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentText, setDocumentText] = useState('');

  // Get the current transcript based on active tab
  const getCurrentTranscript = (): string => {
    switch (activeImportTab) {
      case 'paste':
        return pastedText;
      case 'audio':
        return audioTranscript;
      case 'document':
        return documentText;
      default:
        return '';
    }
  };

  // Handle paste from clipboard
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPastedText(text);
        showToast.success('Text pasted from clipboard', { section: 'gpscribe' });
      }
    } catch (error) {
      console.error('Failed to paste:', error);
      showToast.error('Failed to paste from clipboard', { section: 'gpscribe' });
    }
  };

  // Audio file dropzone
  const onAudioDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setAudioFile(file);
    setAudioTranscript('');
    setIsProcessing(true);
    setProgress(10);
    setStatusMessage('Uploading audio file...');
    
    try {
      // Create form data for upload
      const formData = new FormData();
      formData.append('file', file);
      
      setProgress(30);
      setStatusMessage('Transcribing audio...');
      
      // Call the transcription edge function
      const { data, error } = await supabase.functions.invoke('mp3-transcription', {
        body: formData
      });
      
      if (error) throw error;
      
      setProgress(90);
      setStatusMessage('Processing transcript...');
      
      const transcript = data?.text || data?.transcript || '';
      
      if (!transcript) {
        throw new Error('No transcript returned from audio processing');
      }
      
      setAudioTranscript(transcript);
      setProgress(100);
      setStatusMessage('Transcription complete');
      showToast.success('Audio transcribed successfully', { section: 'gpscribe' });
      
    } catch (error) {
      console.error('Audio transcription error:', error);
      showToast.error('Failed to transcribe audio', { section: 'gpscribe' });
      setAudioFile(null);
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setProgress(0);
        setStatusMessage('');
      }, 2000);
    }
  }, []);

  const { getRootProps: getAudioRootProps, getInputProps: getAudioInputProps, isDragActive: isAudioDragActive } = useDropzone({
    onDrop: onAudioDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac']
    },
    maxFiles: 1,
    disabled: isProcessing
  });

  // Document file dropzone
  const onDocumentDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setDocumentFile(file);
    setDocumentText('');
    setIsProcessing(true);
    setProgress(10);
    setStatusMessage('Reading document...');
    
    try {
      setProgress(40);
      setStatusMessage('Extracting text...');
      
      // Use FileProcessorManager to extract text
      const processed = await FileProcessorManager.processFile(file);
      
      setProgress(90);
      setStatusMessage('Processing complete');
      
      if (!processed.content || processed.content.trim().length === 0) {
        throw new Error('No text content found in document');
      }
      
      setDocumentText(processed.content);
      setProgress(100);
      showToast.success('Document processed successfully', { section: 'gpscribe' });
      
    } catch (error) {
      console.error('Document processing error:', error);
      showToast.error('Failed to process document', { section: 'gpscribe' });
      setDocumentFile(null);
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setProgress(0);
        setStatusMessage('');
      }, 2000);
    }
  }, []);

  const { getRootProps: getDocRootProps, getInputProps: getDocInputProps, isDragActive: isDocDragActive } = useDropzone({
    onDrop: onDocumentDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/rtf': ['.rtf']
    },
    maxFiles: 1,
    disabled: isProcessing
  });

  // Generate consultation notes
  const handleGenerateNotes = async () => {
    const transcript = getCurrentTranscript();
    
    if (!transcript || transcript.trim().length < 50) {
      showToast.error('Please provide more text content (at least 50 characters)', { section: 'gpscribe' });
      return;
    }
    
    setIsGenerating(true);
    setProgress(20);
    setStatusMessage('Generating consultation notes...');
    
    try {
      setProgress(50);
      
      const { data, error } = await supabase.functions.invoke('generate-scribe-notes', {
        body: { 
          transcript,
          consultationType,
          outputFormat: 'heidi',
          noteFormat: settings.noteFormat,
          detailLevel: settings.consultationDetailLevel
        }
      });

      if (error) throw error;

      setProgress(90);
      setStatusMessage('Finalising notes...');

      // Build the note object
      const note: ConsultationNote = {
        soapNote: {
          S: data.S || data.history || '',
          O: data.O || data.examination || '',
          A: data.A || data.impression || '',
          P: data.P || data.plan || ''
        },
        heidiNote: data.consultationHeader !== undefined ? {
          consultationHeader: data.consultationHeader || '',
          history: data.history || '',
          examination: data.examination || '',
          impression: data.impression || '',
          plan: data.plan || ''
        } : undefined,
        noteFormat: data.noteFormat || settings.noteFormat,
        snomedCodes: data.snomedCodes || []
      };

      setProgress(100);
      showToast.success('Notes generated successfully', { section: 'gpscribe' });
      
      // Pass the generated notes back to parent
      onNotesGenerated(note, transcript);
      
    } catch (error) {
      console.error('Error generating notes:', error);
      showToast.error('Failed to generate notes. Please try again.', { section: 'gpscribe' });
    } finally {
      setIsGenerating(false);
      setTimeout(() => {
        setProgress(0);
        setStatusMessage('');
      }, 2000);
    }
  };

  const wordCount = getCurrentTranscript().split(/\s+/).filter(w => w.length > 0).length;
  const charCount = getCurrentTranscript().length;
  const hasContent = charCount >= 50;

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Import Transcript
        </CardTitle>
        <CardDescription>
          Paste a transcript, upload an audio file, or import a document to automatically generate consultation notes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Import method tabs */}
        <Tabs value={activeImportTab} onValueChange={(v) => setActiveImportTab(v as ImportTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="paste" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Paste Text</span>
              <span className="sm:hidden">Paste</span>
            </TabsTrigger>
            <TabsTrigger value="audio" className="gap-2">
              <Mic className="h-4 w-4" />
              <span className="hidden sm:inline">Audio</span>
              <span className="sm:hidden">Audio</span>
            </TabsTrigger>
            <TabsTrigger value="document" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Document</span>
              <span className="sm:hidden">Doc</span>
            </TabsTrigger>
          </TabsList>

          {/* Paste Text Tab */}
          <TabsContent value="paste" className="mt-4 space-y-4">
            <div className="flex justify-between items-center">
              <Label htmlFor="paste-text">Paste your transcript below</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePasteFromClipboard}
                className="gap-2"
              >
                <Clipboard className="h-4 w-4" />
                Paste from Clipboard
              </Button>
            </div>
            <Textarea
              id="paste-text"
              placeholder="Paste your consultation transcript here...

Example:
Patient presents with a 3-day history of productive cough and low-grade fever. No shortness of breath or chest pain. Has been taking paracetamol with some relief. Non-smoker, no significant past medical history..."
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              className="min-h-[250px] font-mono text-sm"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{wordCount} words</span>
              <span>{charCount} characters</span>
            </div>
          </TabsContent>

          {/* Audio Upload Tab */}
          <TabsContent value="audio" className="mt-4 space-y-4">
            <div
              {...getAudioRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isAudioDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <input {...getAudioInputProps()} />
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-full bg-primary/10 p-4">
                  <FileAudio className="h-8 w-8 text-primary" />
                </div>
                {audioFile ? (
                  <div className="space-y-1">
                    <p className="font-medium">{audioFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="font-medium">
                      {isAudioDragActive ? 'Drop your audio file here' : 'Drag and drop an audio file'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Supports MP3, WAV, M4A, OGG, FLAC, AAC (max 15MB)
                    </p>
                  </>
                )}
              </div>
            </div>

            {audioTranscript && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Transcription complete
                </div>
                <div className="bg-muted rounded-lg p-4 max-h-[200px] overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">{audioTranscript}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {audioTranscript.split(/\s+/).filter(w => w.length > 0).length} words
                </div>
              </div>
            )}
          </TabsContent>

          {/* Document Upload Tab */}
          <TabsContent value="document" className="mt-4 space-y-4">
            <div
              {...getDocRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDocDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <input {...getDocInputProps()} />
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-full bg-primary/10 p-4">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                {documentFile ? (
                  <div className="space-y-1">
                    <p className="font-medium">{documentFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(documentFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="font-medium">
                      {isDocDragActive ? 'Drop your document here' : 'Drag and drop a document'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Supports PDF, Word (DOC, DOCX), TXT (max 15MB)
                    </p>
                  </>
                )}
              </div>
            </div>

            {documentText && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Document processed
                </div>
                <div className="bg-muted rounded-lg p-4 max-h-[200px] overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">{documentText.slice(0, 1000)}{documentText.length > 1000 ? '...' : ''}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {documentText.split(/\s+/).filter(w => w.length > 0).length} words extracted
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Progress indicator */}
        {(isProcessing || isGenerating) && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">{statusMessage}</p>
          </div>
        )}

        {/* Consultation Settings */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-4">
          <h4 className="font-medium text-sm">Consultation Settings</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CONSULTATION_TYPE_LABELS) as ConsultationType[]).map((type) => (
                  <Button
                    key={type}
                    variant={consultationType === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => setConsultationType(type)}
                    className="text-xs"
                  >
                    {CONSULTATION_TYPE_LABELS[type]}
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CONSULTATION_CATEGORY_LABELS) as ConsultationCategory[]).map((cat) => (
                  <Button
                    key={cat}
                    variant={consultationCategory === cat ? "default" : "outline"}
                    size="sm"
                    onClick={() => setConsultationCategory(cat)}
                    className="text-xs"
                  >
                    {CONSULTATION_CATEGORY_LABELS[cat].replace(' Consultation', '')}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          className="w-full gap-2"
          size="lg"
          onClick={handleGenerateNotes}
          disabled={!hasContent || isProcessing || isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating Notes...
            </>
          ) : (
            <>
              <Wand2 className="h-5 w-5" />
              Generate Consultation Notes
            </>
          )}
        </Button>

        {!hasContent && charCount > 0 && (
          <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Please add at least 50 characters of content
          </p>
        )}
      </CardContent>
    </Card>
  );
};
