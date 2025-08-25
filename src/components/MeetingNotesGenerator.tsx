import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Copy, FileText, Users, Calendar, MapPin, Clock, Settings } from 'lucide-react';

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
    formal_minutes: StyleBlock;
    action_notes: StyleBlock;
    headline_summary: StyleBlock;
    narrative_newsletter: StyleBlock;
    decision_log: { title?: string; table_markdown: string; suggested_filename?: string };
    annotated_summary: StyleBlock;
  };
}

type ActiveTab = 'formal_minutes' | 'action_notes' | 'headline_summary' | 'narrative_newsletter' | 'decision_log' | 'annotated_summary';

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
    if (activeTab === 'decision_log') {
      return result.styles.decision_log.table_markdown || '';
    }
    return (result.styles as any)[activeTab]?.markdown || '';
  };

  const handleCopy = async () => {
    const text = getActiveMarkdown();
    if (text) {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">NHS Meeting Notes Generator</h1>
        <p className="text-muted-foreground">Generate six professional note styles for NHS primary care meetings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transcript Input
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Paste your raw meeting transcript here..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="min-h-[200px] resize-y"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Meeting Settings (Optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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