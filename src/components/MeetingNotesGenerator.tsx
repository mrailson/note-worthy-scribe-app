import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Copy, FileText, Users, Calendar, MapPin, Clock, Settings, ChevronDown } from 'lucide-react';

interface MeetingSettings {
  title?: string;
  date?: string;
  time?: string;
  venue?: string;
  chair?: string;
  minute_taker?: string;
  attendees?: string[];
  agenda?: string[];
  context_docs?: string[];
  objectives?: string[];
  locality?: string;
  pcn?: string;
  icb?: string;
  key_dates?: string[];
  preferences?: { 
    include_headers?: boolean; 
    show_empty_fields?: boolean; 
  };
}

interface StyleBlock {
  title?: string;
  markdown?: string;
  table_markdown?: string;
  suggested_filename?: string;
}

interface ApiResponse {
  meta?: any;
  cleaned_transcript?: string;
  styles: {
    formal_minutes: string;
    action_notes: string;
    headline_summary: string;
    narrative_newsletter: string;
    decision_log: string;
    annotated_summary: string;
  };
}

type ActiveTab = 'formal_minutes' | 'action_notes' | 'headline_summary' | 'narrative_newsletter' | 'decision_log' | 'annotated_summary';
type IngestTab = 'paste' | 'audio' | 'file';

const tabConfig = [
  { key: 'formal_minutes' as ActiveTab, label: 'Formal Minutes', description: 'For governance meetings' },
  { key: 'action_notes' as ActiveTab, label: 'Action Notes', description: 'For PM circulation' },
  { key: 'headline_summary' as ActiveTab, label: 'Headline Summary', description: 'Brief for WhatsApp/email' },
  { key: 'narrative_newsletter' as ActiveTab, label: 'Newsletter', description: 'Readable prose format' },
  { key: 'decision_log' as ActiveTab, label: 'Decision Log', description: 'Structured table format' },
  { key: 'annotated_summary' as ActiveTab, label: 'Annotated Summary', description: 'Discussion flow with notes' }
];

export const MeetingNotesGenerator = () => {
  const [transcript, setTranscript] = useState('');
  const [settings, setSettings] = useState<MeetingSettings>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('formal_minutes');

  const [attendeesInput, setAttendeesInput] = useState('');
  const [agendaInput, setAgendaInput] = useState('');
  const [keyDatesInput, setKeyDatesInput] = useState('');

  // New ingestion states
  const [ingestTab, setIngestTab] = useState<IngestTab>('paste');
  const [ingestBusy, setIngestBusy] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);

  // Meeting settings collapsible state
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Transcript input collapsible state
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    if (!transcript.trim()) {
      toast.error('Please enter a transcript');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Parse comma-separated inputs
      const processedSettings = {
        ...settings,
        attendees: attendeesInput ? attendeesInput.split(',').map(x => x.trim()).filter(Boolean) : undefined,
        agenda: agendaInput ? agendaInput.split(',').map(x => x.trim()).filter(Boolean) : undefined,
        key_dates: keyDatesInput ? keyDatesInput.split(',').map(x => x.trim()).filter(Boolean) : undefined,
      };

      const { data, error: functionError } = await supabase.functions.invoke('generate-meeting-notes-six-styles', {
        body: { 
          transcript, 
          settings: processedSettings 
        }
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
      toast.success('Meeting notes generated successfully');
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to generate meeting notes');
      toast.error('Failed to generate meeting notes');
    } finally {
      setLoading(false);
    }
  };

  const getActiveMarkdown = () => {
    if (!result) return '';
    return result.styles[activeTab] || '';
  };

  const handleCopy = async () => {
    const text = getActiveMarkdown();
    if (text) {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    }
  };

  const handleUpload = async (kind: 'audio' | 'doc', file: File) => {
    setIngestBusy(true);
    setIngestMsg(kind === 'audio' ? 'Transcribing audio…' : 'Extracting text…');
    setError(null);

    try {
      const formData = new FormData();
      if (kind === 'audio') {
        formData.append('audio', file);
      } else {
        formData.append('doc', file);
      }

      const { data, error: functionError } = await supabase.functions.invoke('upload-to-text', {
        body: formData
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const extractedText = (data?.text || '').trim();
      if (!extractedText) {
        throw new Error('No text returned from file.');
      }

      // Replace the transcript with extracted text
      setTranscript(extractedText);
      setIngestMsg('Done. Transcript inserted.');
      toast.success(`${kind === 'audio' ? 'Audio transcribed' : 'Text extracted'} successfully`);
      
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed');
      setIngestMsg(null);
      toast.error(`Failed to ${kind === 'audio' ? 'transcribe audio' : 'extract text'}`);
    } finally {
      setIngestBusy(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">NHS Meeting Notes Generator</h1>
        <p className="text-muted-foreground">Generate six professional note styles for NHS primary care meetings</p>
      </div>

      {/* Ingestion Tabs */}
      <Card>
        <Collapsible open={transcriptOpen} onOpenChange={setTranscriptOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Transcript Input
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${transcriptOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="pt-0">
              <Tabs value={ingestTab} onValueChange={(value) => setIngestTab(value as IngestTab)}>
                <div className="flex items-center justify-between mb-4">
                  <TabsList className="grid w-full grid-cols-3 max-w-md">
                    <TabsTrigger value="paste" className="text-sm">
                      Paste Text
                    </TabsTrigger>
                    <TabsTrigger value="audio" className="text-sm">
                      Upload Audio
                    </TabsTrigger>
                    <TabsTrigger value="file" className="text-sm">
                      Upload Document
                    </TabsTrigger>
                  </TabsList>
                  {ingestBusy && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                      {ingestMsg}
                    </div>
                  )}
                </div>

                <TabsContent value="paste" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Paste or type your meeting transcript</Label>
                    <Textarea
                      placeholder="Paste your raw meeting transcript here..."
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      className="min-h-[200px] resize-y"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="audio" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Upload audio file for transcription</Label>
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                      <input
                        ref={audioInputRef}
                        type="file"
                        accept=".mp3,.wav,.m4a,.webm,.ogg,audio/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload('audio', file);
                        }}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => audioInputRef.current?.click()}
                        disabled={ingestBusy}
                        className="mb-2"
                      >
                        Choose Audio File
                      </Button>
                      <p className="text-sm text-muted-foreground">
                        Supported formats: MP3, WAV, M4A, WebM, OGG
                      </p>
                    </div>
                  </div>
                  {transcript && (
                    <div className="space-y-2">
                      <Label>Transcribed text (editable)</Label>
                      <Textarea
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        className="min-h-[150px] resize-y"
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="file" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Upload document file for text extraction</Label>
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".docx,.pdf,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload('doc', file);
                        }}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={ingestBusy}
                        className="mb-2"
                      >
                        Choose Document File
                      </Button>
                      <p className="text-sm text-muted-foreground">
                        Supported formats: DOCX, PDF, TXT
                      </p>
                    </div>
                  </div>
                  {transcript && (
                    <div className="space-y-2">
                      <Label>Extracted text (editable)</Label>
                      <Textarea
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        className="min-h-[150px] resize-y"
                      />
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Card>
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Meeting Settings (Optional)
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Meeting Title
                  </Label>
                  <Input
                    id="title"
                    placeholder="e.g., PCN Clinical Review Meeting"
                    value={settings.title || ''}
                    onChange={(e) => setSettings(s => ({ ...s, title: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={settings.date || ''}
                    onChange={(e) => setSettings(s => ({ ...s, date: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Time
                  </Label>
                  <Input
                    id="time"
                    placeholder="e.g., 14:00"
                    value={settings.time || ''}
                    onChange={(e) => setSettings(s => ({ ...s, time: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="venue" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Venue
                  </Label>
                  <Input
                    id="venue"
                    placeholder="e.g., Wootton Health Centre"
                    value={settings.venue || ''}
                    onChange={(e) => setSettings(s => ({ ...s, venue: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chair" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Chair
                  </Label>
                  <Input
                    id="chair"
                    placeholder="e.g., Dr. Smith"
                    value={settings.chair || ''}
                    onChange={(e) => setSettings(s => ({ ...s, chair: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minute_taker">Minute Taker</Label>
                  <Input
                    id="minute_taker"
                    placeholder="e.g., Jane Doe"
                    value={settings.minute_taker || ''}
                    onChange={(e) => setSettings(s => ({ ...s, minute_taker: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="locality">Locality</Label>
                  <Input
                    id="locality"
                    placeholder="e.g., Northamptonshire"
                    value={settings.locality || ''}
                    onChange={(e) => setSettings(s => ({ ...s, locality: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pcn">PCN Name</Label>
                  <Input
                    id="pcn"
                    placeholder="e.g., Wootton Vale PCN"
                    value={settings.pcn || ''}
                    onChange={(e) => setSettings(s => ({ ...s, pcn: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="icb">ICB Name</Label>
                  <Input
                    id="icb"
                    placeholder="e.g., Northamptonshire ICB"
                    value={settings.icb || ''}
                    onChange={(e) => setSettings(s => ({ ...s, icb: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="attendees">Attendees (comma separated)</Label>
                  <Input
                    id="attendees"
                    placeholder="e.g., Dr. Smith (Chair), Jane Doe (Practice Manager), John Brown (Pharmacist)"
                    value={attendeesInput}
                    onChange={(e) => setAttendeesInput(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agenda">Agenda Items (comma separated)</Label>
                  <Input
                    id="agenda"
                    placeholder="e.g., Welcome, QOF Review, Prescribing Updates, Any Other Business"
                    value={agendaInput}
                    onChange={(e) => setAgendaInput(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="key_dates">Key Dates (comma separated)</Label>
                  <Input
                    id="key_dates"
                    placeholder="e.g., QOF Submission: 31 March 2024, Annual Review: 15 April 2024"
                    value={keyDatesInput}
                    onChange={(e) => setKeyDatesInput(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <div className="flex justify-center">
        <Button 
          onClick={handleGenerate}
          disabled={loading || !transcript.trim()}
          size="lg"
          className="px-8"
        >
          {loading ? 'Generating...' : 'Generate Meeting Notes'}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Meeting Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ActiveTab)}>
              <div className="flex flex-wrap gap-2 mb-4">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                  {tabConfig.map((tab) => (
                    <TabsTrigger key={tab.key} value={tab.key} className="text-xs">
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <Button onClick={handleCopy} variant="outline" size="sm" className="ml-auto">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>

              {tabConfig.map((tab) => (
                <TabsContent key={tab.key} value={tab.key} className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    {tab.description}
                  </div>
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <pre className="whitespace-pre-wrap text-sm font-mono overflow-x-auto">
                      {getActiveMarkdown()}
                    </pre>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};