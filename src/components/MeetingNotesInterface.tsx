import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Copy, Download, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import ExampleMeetingFlyout from './ExampleMeetingFlyout';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SimpleFileUpload } from '@/components/SimpleFileUpload';
import { useFileUpload } from '@/hooks/useFileUpload';
import { FileUploadArea } from '@/components/ai4gp/FileUploadArea';
import type { UploadedFile } from '@/types/ai4gp';

interface MeetingSettings {
  title: string;
  practice: string;
  date: string;
  time: string;
  venue: string;
  chair: string;
  attendees: string;
}

interface GeneratedNotes {
  formal_board?: string;
  informal_team?: string;
  agenda_based?: string;
  narrative_complex?: string;
  resolution_style?: string;
  brainstorming_session?: string;
  hr_performance?: string;
  gp_partnership?: string;
  supplier_negotiation?: string;
  executive_confidential?: string;
  [key: string]: any;
}

interface StyleNames {
  [key: string]: string;
}

export default function MeetingNotesInterface() {
  const [transcript, setTranscript] = useState('');
  const [settings, setSettings] = useState<MeetingSettings>({
    title: '',
    practice: '',
    date: '',
    time: '',
    venue: '',
    chair: '',
    attendees: ''
  });
  const [loading, setLoading] = useState(false);
  const [generatedNotes, setGeneratedNotes] = useState<GeneratedNotes | null>(null);
  const [styleNames, setStyleNames] = useState<StyleNames>({});
  const [activeTab, setActiveTab] = useState('formal_board');
  const [error, setError] = useState<string | null>(null);
  const [agendaFiles, setAgendaFiles] = useState<UploadedFile[]>([]);
  const [contextFiles, setContextFiles] = useState<UploadedFile[]>([]);
  
  const { processFiles, isProcessing } = useFileUpload();

  const handleGenerate = async () => {
    if (!transcript.trim()) {
      showToast.error('Please provide a meeting transcript', { section: 'meeting_manager' });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('generate-meeting-notes-ten-styles', {
        body: {
          transcript: transcript.trim(),
          settings,
          agendaFiles: agendaFiles.length > 0 ? agendaFiles : undefined,
          contextFiles: contextFiles.length > 0 ? contextFiles : undefined
        }
      });

      if (functionError) {
        throw new Error(functionError.message || 'Failed to generate meeting notes');
      }

      setGeneratedNotes(data.styles);
      setStyleNames(data.styleNames || {});
      showToast.success('Meeting notes generated successfully', { section: 'meeting_manager' });
    } catch (e: any) {
      console.error('Error generating notes:', e);
      setError(e.message || 'Failed to generate meeting notes');
      showToast.error('Failed to generate meeting notes', { section: 'meeting_manager' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast.success('Copied to clipboard', { section: 'meeting_manager' });
    } catch (e) {
      showToast.error('Failed to copy to clipboard', { section: 'meeting_manager' });
    }
  };

  const handleDownload = async (text: string, filename: string, meetingId?: string) => {
    try {
      const { data: blob, error } = await supabase.functions.invoke('export-docx', {
        body: {
          markdown: text,
          filename,
          // When meetingId is supplied the edge function routes through the
          // NHS-styled docx generator and stamps the model in the footer.
          ...(meetingId ? { meetingId } : {}),
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      const url = URL.createObjectURL(new Blob([blob]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      
      showToast.success('Document downloaded', { section: 'meeting_manager' });
    } catch (e: any) {
      showToast.error(`Export failed: ${e.message}`, { section: 'meeting_manager' });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setTranscript(content);
        showToast.success('File uploaded successfully', { section: 'meeting_manager' });
      };
      reader.readAsText(file);
    } else {
      showToast.error('Please select a text file', { section: 'meeting_manager' });
    }
  };

  const handleAgendaUpload = async (files: File[]) => {
    try {
      const processedFiles = await processFiles(files as unknown as FileList);
      setAgendaFiles(prev => [...prev, ...processedFiles]);
    } catch (error) {
      console.error('Error processing agenda files:', error);
    }
  };

  const handleContextUpload = async (files: File[]) => {
    try {
      const processedFiles = await processFiles(files as unknown as FileList);
      setContextFiles(prev => [...prev, ...processedFiles]);
    } catch (error) {
      console.error('Error processing context files:', error);
    }
  };

  const removeAgendaFile = (index: number) => {
    setAgendaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeContextFile = (index: number) => {
    setContextFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Header with Example Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Meeting Notes Summariser</h2>
          <p className="text-sm text-muted-foreground">
            Generate professional meeting minutes from transcripts
          </p>
        </div>
        <ExampleMeetingFlyout />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Meeting Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Transcript Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="transcript">Meeting Transcript</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Text File
                  </Button>
                </div>
              </div>
              <Textarea
                id="transcript"
                placeholder="Paste or type the meeting transcript here..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="min-h-[200px]"
              />
            </div>

            {/* Meeting Settings */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="title">Meeting Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Partners' Meeting"
                  value={settings.title}
                  onChange={(e) => setSettings({...settings, title: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="practice">Practice Name</Label>
                <Input
                  id="practice"
                  placeholder="e.g., Oak Lane Medical Practice"
                  value={settings.practice}
                  onChange={(e) => setSettings({...settings, practice: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={settings.date}
                  onChange={(e) => setSettings({...settings, date: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={settings.time}
                  onChange={(e) => setSettings({...settings, time: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="chair">Chair</Label>
                <Input
                  id="chair"
                  placeholder="e.g., Dr Smith"
                  value={settings.chair}
                  onChange={(e) => setSettings({...settings, chair: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="attendees">Attendees</Label>
                <Input
                  id="attendees"
                  placeholder="e.g., Partners, Practice Manager"
                  value={settings.attendees}
                  onChange={(e) => setSettings({...settings, attendees: e.target.value})}
                />
              </div>
            </div>

            {/* Meeting Agenda Upload */}
            <div className="space-y-2">
              <Label>Meeting Agenda Documents</Label>
              <SimpleFileUpload 
                onFileUpload={handleAgendaUpload}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.tiff,.tif"
                maxSize={10}
                multiple={true}
              />
              {agendaFiles.length > 0 && (
                <FileUploadArea 
                  uploadedFiles={agendaFiles}
                  onRemoveFile={removeAgendaFile}
                />
              )}
            </div>

            {/* Meeting Context Upload */}
            <div className="space-y-2">
              <Label>Meeting Context Documents</Label>
              <SimpleFileUpload 
                onFileUpload={handleContextUpload}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.tiff,.tif"
                maxSize={10}
                multiple={true}
              />
              {contextFiles.length > 0 && (
                <FileUploadArea 
                  uploadedFiles={contextFiles}
                  onRemoveFile={removeContextFile}
                />
              )}
            </div>

            <Button 
              onClick={handleGenerate} 
              disabled={loading || !transcript.trim()}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Notes...
                </>
              ) : (
                'Generate Meeting Notes'
              )}
            </Button>

            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Output Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Generated Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {generatedNotes ? (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="mb-4">
                  <TabsList className="grid w-full grid-cols-5 h-auto p-1">
                    <TabsTrigger value="formal_board" className="text-xs px-2 py-2">
                      Formal Board
                    </TabsTrigger>
                    <TabsTrigger value="informal_team" className="text-xs px-2 py-2">
                      Informal Team
                    </TabsTrigger>
                    <TabsTrigger value="agenda_based" className="text-xs px-2 py-2">
                      Agenda-Based
                    </TabsTrigger>
                    <TabsTrigger value="narrative_complex" className="text-xs px-2 py-2">
                      Narrative
                    </TabsTrigger>
                    <TabsTrigger value="resolution_style" className="text-xs px-2 py-2">
                      Resolution
                    </TabsTrigger>
                  </TabsList>
                  <TabsList className="grid w-full grid-cols-5 h-auto p-1 mt-2">
                    <TabsTrigger value="brainstorming_session" className="text-xs px-2 py-2">
                      Brainstorming
                    </TabsTrigger>
                    <TabsTrigger value="hr_performance" className="text-xs px-2 py-2">
                      HR Performance
                    </TabsTrigger>
                    <TabsTrigger value="gp_partnership" className="text-xs px-2 py-2">
                      GP Partnership
                    </TabsTrigger>
                    <TabsTrigger value="supplier_negotiation" className="text-xs px-2 py-2">
                      Supplier
                    </TabsTrigger>
                    <TabsTrigger value="executive_confidential" className="text-xs px-2 py-2">
                      Executive
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <div className="mt-4 space-y-3">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(generatedNotes[activeTab] || '')}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(
                        generatedNotes[activeTab] || '', 
                        `meeting-${activeTab.replace(/_/g, '-')}`
                      )}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>

                  {/* Dynamic tab content for all 10 styles */}
                  {Object.keys(generatedNotes).map((styleKey) => (
                    <TabsContent key={styleKey} value={styleKey} className="mt-0">
                      <div className="prose prose-sm max-w-none dark:prose-invert bg-muted/30 p-4 rounded-md max-h-[400px] overflow-y-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {generatedNotes[styleKey] || 'No content generated'}
                        </ReactMarkdown>
                      </div>
                    </TabsContent>
                  ))}
                </div>
              </Tabs>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <div className="text-sm">No meeting notes generated yet</div>
                <div className="text-xs mt-1">
                  Enter a transcript and click generate to create meeting notes
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}