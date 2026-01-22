import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { FileText, FileAudio, Upload, Clipboard, Trash2, Loader2, CheckCircle2, AlertCircle, Sparkles, History, Plus } from 'lucide-react';
import { showToast } from '@/utils/toastWrapper';
import { AudioImport } from '@/components/gpscribe/AudioImport';
import { useMeetingImporter } from '@/hooks/useMeetingImporter';
import { FileImporter } from '@/utils/FileImporter';
import { DemoSamplesSelector } from './DemoSamplesSelector';
import { DemoMeeting } from '@/data/demoMeetings';
import { useNavigate } from 'react-router-dom';

interface MeetingImporterProps {
  onMeetingCreated?: (meetingId: string) => void;
  meetingConfig?: {
    title?: string;
    attendees: Array<{ name: string; title?: string; organization?: string }>;
    agenda?: string;
    format?: string;
  };
}

export const MeetingImporter: React.FC<MeetingImporterProps> = ({ 
  onMeetingCreated, 
  meetingConfig 
}) => {
  const [importText, setImportText] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const [importedMeetingId, setImportedMeetingId] = useState<string | null>(null);
  const { importMeeting, isImporting, progress, currentStep } = useMeetingImporter();
  const navigate = useNavigate();

  const handlePasteTranscript = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        showToast.error('No text found in clipboard', { section: 'meeting_manager' });
        return;
      }
      setImportText(text);
      showToast.success('Text pasted from clipboard', { section: 'meeting_manager' });
    } catch (error) {
      console.error('Failed to read clipboard:', error);
      showToast.error('Failed to read clipboard. Please paste manually.', { section: 'meeting_manager' });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (50MB limit for documents)
    if (file.size > 50 * 1024 * 1024) {
      showToast.error('File too large. Maximum size is 50MB.', { section: 'meeting_manager' });
      return;
    }

    try {
      showToast.info('Processing file...', { section: 'meeting_manager' });
      
      // Use FileImporter for Word/PDF files, or direct read for text
      if (file.name.endsWith('.docx') || file.name.endsWith('.doc') || file.name.endsWith('.pdf')) {
        const result = await FileImporter.importTranscriptFile(file);
        setImportText(result.content);
        showToast.success(`Loaded ${result.wordCount} words from ${file.name}`, { section: 'meeting_manager' });
      } else if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          if (text) {
            setImportText(text);
            showToast.success(`Loaded text from ${file.name}`, { section: 'meeting_manager' });
          }
        };
        reader.onerror = () => showToast.error('Failed to read file', { section: 'meeting_manager' });
        reader.readAsText(file);
      } else {
        showToast.error('Unsupported file type. Please upload .txt, .doc, .docx, or .pdf files', { section: 'meeting_manager' });
      }
    } catch (error) {
      console.error('File upload error:', error);
      showToast.error('Failed to process file', { section: 'meeting_manager' });
    }
    
    event.target.value = '';
  };

  const handleImportTranscript = async () => {
    if (!importText.trim()) {
      showToast.error('No text to import', { section: 'meeting_manager' });
      return;
    }

    const meetingData = {
      transcript: importText,
      title: meetingConfig?.title || 'Imported Meeting',
      attendees: meetingConfig?.attendees || [],
      agenda: meetingConfig?.agenda || '',
      format: meetingConfig?.format || 'imported',
      source: 'text_import' as const
    };

    try {
      const meetingId = await importMeeting(meetingData);
      setImportText('');
      setImportedMeetingId(meetingId);
      setImportSuccess(true);
      onMeetingCreated?.(meetingId);
    } catch (error) {
      console.error('Import failed:', error);
      showToast.error('Failed to import meeting', { section: 'meeting_manager' });
    }
  };

  const handleAudioImport = async (transcript: string) => {
    const meetingData = {
      transcript,
      title: meetingConfig?.title || 'Audio Import Meeting',
      attendees: meetingConfig?.attendees || [],
      agenda: meetingConfig?.agenda || '',
      format: meetingConfig?.format || 'imported',
      source: 'audio_import' as const
    };

    try {
      const meetingId = await importMeeting(meetingData);
      setImportedMeetingId(meetingId);
      setImportSuccess(true);
      onMeetingCreated?.(meetingId);
    } catch (error) {
      console.error('Audio import failed:', error);
      showToast.error('Failed to import audio', { section: 'meeting_manager' });
    }
  };

  const handleDemoSelect = async (demo: DemoMeeting) => {
    const meetingData = {
      transcript: demo.transcript,
      title: demo.title,
      attendees: demo.attendees,
      agenda: demo.agenda,
      format: demo.format,
      source: 'text_import' as const,
      isDemo: true,
      demoType: demo.type
    };

    try {
      const meetingId = await importMeeting(meetingData);
      setImportedMeetingId(meetingId);
      setImportSuccess(true);
      onMeetingCreated?.(meetingId);
    } catch (error) {
      console.error('Demo import failed:', error);
      showToast.error('Failed to load demo meeting', { section: 'meeting_manager' });
    }
  };

  const wordCount = importText.trim().split(/\s+/).filter(word => word.length > 0).length;

  const handleViewInHistory = () => {
    if (importedMeetingId) {
      navigate('/?tab=history', { 
        state: { 
          viewNotes: importedMeetingId,
          openModal: true,
          scrollToMeetingId: importedMeetingId
        } 
      });
    }
  };

  const handleImportAnother = () => {
    setImportSuccess(false);
    setImportedMeetingId(null);
    setImportText('');
  };

  // Show success panel after import
  if (importSuccess && importedMeetingId) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Meeting Imported Successfully!</h3>
              <p className="text-muted-foreground max-w-md">
                Your meeting has been imported and notes are now being generated. 
                You can view it in <strong>Meeting History</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button 
                onClick={handleViewInHistory}
                className="gap-2"
              >
                <History className="h-4 w-4" />
                View in Meeting History
              </Button>
              <Button 
                variant="outline"
                onClick={handleImportAnother}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Import Another Meeting
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Import Meeting Content
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
        {isImporting && (
          <div className="border rounded-lg p-4 bg-accent/10 space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="font-medium">Creating Meeting...</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">{currentStep}</p>
          </div>
        )}

        <Tabs defaultValue="demo" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="demo" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Demo Samples</span>
              <span className="xs:hidden">Demo</span>
            </TabsTrigger>
            <TabsTrigger value="text" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Import Text</span>
              <span className="xs:hidden">Text</span>
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <FileAudio className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Import Audio</span>
              <span className="xs:hidden">Audio</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="demo" className="space-y-4 mt-4">
            <DemoSamplesSelector 
              onSelectDemo={handleDemoSelect}
              disabled={isImporting}
            />
          </TabsContent>

          <TabsContent value="text" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePasteTranscript}
                disabled={isImporting}
              >
                <Clipboard className="h-4 w-4 mr-1" />
                Paste from Clipboard
              </Button>
              
              <div className="relative">
                <input
                  type="file"
                  accept=".txt,.doc,.docx,.pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isImporting}
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={isImporting}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Upload Document
                </Button>
              </div>
              
              <div className="text-xs text-muted-foreground">
                Supported: TXT, DOC, DOCX, PDF
              </div>

              {importText && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setImportText('')}
                  disabled={isImporting}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-text">Transcript or Meeting Content</Label>
              <Textarea
                id="import-text"
                placeholder="Paste your meeting transcript, consultation notes, or other meeting content here..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="min-h-[200px] resize-vertical"
                disabled={isImporting}
              />
              
              {importText && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{wordCount} words</span>
                  <span>{importText.length} characters</span>
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <Button
                onClick={handleImportTranscript}
                disabled={!importText.trim() || isImporting}
                className="px-8"
                size="lg"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating Meeting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Create Meeting & Generate Notes
                  </>
                )}
              </Button>
            </div>

            {meetingConfig && (
              <div className="border rounded-lg p-3 bg-muted/50">
                <div className="text-sm font-medium mb-1 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-info" />
                  Meeting Configuration Will Be Applied:
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {meetingConfig.title && <div>• Title: {meetingConfig.title}</div>}
                  {meetingConfig.attendees.length > 0 && <div>• {meetingConfig.attendees.length} attendees configured</div>}
                  {meetingConfig.agenda && <div>• Agenda: {meetingConfig.agenda.substring(0, 50)}...</div>}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="audio" className="mt-4">
            <AudioImport 
              onTranscriptReady={handleAudioImport}
              disabled={isImporting}
            />
            
            {meetingConfig && (
              <div className="border rounded-lg p-3 bg-muted/50 mt-4">
                <div className="text-sm font-medium mb-1 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-info" />
                  Meeting Configuration Will Be Applied:
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {meetingConfig.title && <div>• Title: {meetingConfig.title}</div>}
                  {meetingConfig.attendees.length > 0 && <div>• {meetingConfig.attendees.length} attendees configured</div>}
                  {meetingConfig.agenda && <div>• Agenda: {meetingConfig.agenda.substring(0, 50)}...</div>}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};