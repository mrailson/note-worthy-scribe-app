import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Copy, Download, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ExampleMeetingFlyout from './ExampleMeetingFlyout';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  decisions_and_actions?: string;
  secretariat_resolution?: string;
  [key: string]: any;
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
  const [activeTab, setActiveTab] = useState('decisions_and_actions');
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!transcript.trim()) {
      toast.error('Please provide a meeting transcript');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('generate-meeting-notes-six-styles', {
        body: {
          transcript: transcript.trim(),
          settings
        }
      });

      if (functionError) {
        throw new Error(functionError.message || 'Failed to generate meeting notes');
      }

      setGeneratedNotes(data.styles);
      toast.success('Meeting notes generated successfully');
    } catch (e: any) {
      console.error('Error generating notes:', e);
      setError(e.message || 'Failed to generate meeting notes');
      toast.error('Failed to generate meeting notes');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (e) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleDownload = async (text: string, filename: string) => {
    try {
      const { data: blob, error } = await supabase.functions.invoke('export-docx', {
        body: { 
          markdown: text, 
          filename 
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
      
      toast.success('Document downloaded');
    } catch (e: any) {
      toast.error(`Export failed: ${e.message}`);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setTranscript(content);
        toast.success('File uploaded successfully');
      };
      reader.readAsText(file);
    } else {
      toast.error('Please select a text file');
    }
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
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="decisions_and_actions">Decisions & Actions</TabsTrigger>
                  <TabsTrigger value="secretariat_resolution">Resolution Minutes</TabsTrigger>
                </TabsList>
                
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
                        `meeting-${activeTab.replace('_', '-')}`
                      )}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>

                  <TabsContent value="decisions_and_actions" className="mt-0">
                    <div className="prose prose-sm max-w-none dark:prose-invert bg-muted/30 p-4 rounded-md max-h-[400px] overflow-y-auto">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {generatedNotes.decisions_and_actions || 'No content generated'}
                      </ReactMarkdown>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="secretariat_resolution" className="mt-0">
                    <div className="prose prose-sm max-w-none dark:prose-invert bg-muted/30 p-4 rounded-md max-h-[400px] overflow-y-auto">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {generatedNotes.secretariat_resolution || 'No content generated'}
                      </ReactMarkdown>
                    </div>
                  </TabsContent>
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