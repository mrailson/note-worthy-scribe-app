import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Edit3, Save, X, Copy, Download, RotateCcw } from "lucide-react";
import { useMeetingExport } from "@/hooks/useMeetingExport";
import { MeetingData } from "@/types/meetingTypes";

type ViewKey =
  | "formal_minutes"
  | "action_notes"
  | "headline_summary"
  | "narrative_newsletter"
  | "decision_log"
  | "annotated_summary";

type StyleUnion = string | { 
  markdown?: string; 
  table_markdown?: string; 
  title?: string; 
  suggested_filename?: string; 
};

type ApiResponse = {
  meta?: any;
  cleaned_transcript?: string;
  styles: Record<ViewKey, StyleUnion>;
};

interface SixStylesNotesGeneratorProps {
  meetingData: MeetingData | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function SixStylesNotesGenerator({ 
  meetingData, 
  isOpen, 
  onClose 
}: SixStylesNotesGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>("headline_summary");
  const [renderMode, setRenderMode] = useState<"rendered" | "raw">("rendered");
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [overrides, setOverrides] = useState<Partial<Record<ViewKey, string>>>({});

  const { generateWordDocument, copyToClipboard } = useMeetingExport(
    meetingData || {
      id: '',
      title: '',
      duration: '',
      wordCount: 0,
      transcript: '',
      speakerCount: 0,
      startTime: ''
    }, 
    {
      title: meetingData?.title || '',
      description: '',
      meetingType: 'general',
      meetingStyle: 'standard',
      attendees: '',
      agenda: '',
      transcriberService: 'whisper' as const,
      transcriberThresholds: {
        whisper: 0.30,
        deepgram: 0.80
      }
    }
  );

  // Helper functions
  function readBlock(block: StyleUnion | undefined): string {
    if (!block) return "";
    if (typeof block === "string") return block;
    return block.markdown || block.table_markdown || "";
  }

  function getActiveMarkdown(): string {
    if (!result) return "";
    const override = overrides[activeView];
    if (override) return override;
    return readBlock(result.styles?.[activeView]);
  }

  const tabs: Array<[ViewKey, string, string]> = [
    ["headline_summary", "Executive One Pager", "6-10 bullets, strongest signals first"],
    ["formal_minutes", "Formal Minutes (Normal)", "Standard governance format"],
    ["action_notes", "Formal Minutes (Detailed)", "Very detailed with all discussion points"],
    ["narrative_newsletter", "Informal Meeting Notes", "Key points and actions for circulation"],
    ["decision_log", "Newsletter Style", "Readable prose for staff bulletin"],
    ["annotated_summary", "Decision Log", "Structured table with decisions and actions"],
  ];

  const userFriendlyTabs: Array<[ViewKey, string, string]> = [
    ["headline_summary", "Executive One Pager", "6-10 bullets, strongest signals first"],
    ["formal_minutes", "Formal Minutes (Normal)", "Standard governance format"],
    ["action_notes", "Formal Minutes (Detailed)", "Very detailed with all discussion points"], 
    ["narrative_newsletter", "Informal Meeting Notes", "Key points and actions for circulation"],
    ["decision_log", "Newsletter Style", "Readable prose for staff bulletin"],
    ["annotated_summary", "Decision Log", "Structured table with decisions and actions"],
  ];

  async function generate() {
    if (!meetingData?.transcript?.trim()) {
      toast.error("No transcript available for this meeting");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setOverrides({});
    setIsEditing(false);
    
    try {
      // Prepare settings from meeting data
      const settings = {
        title: meetingData.title || "Meeting Notes",
        date: meetingData.startTime ? new Date(meetingData.startTime).toISOString().split('T')[0] : undefined,
        time: meetingData.startTime ? new Date(meetingData.startTime).toLocaleTimeString() : undefined,
        attendees: meetingData.attendees || [],
        agenda: meetingData.agenda ? meetingData.agenda.split(',').map(item => item.trim()) : [],
        locality: meetingData.practiceName || undefined,
        controls: { detail_level: 3 }
      };

      const { data, error: functionError } = await supabase.functions.invoke('generate-meeting-notes-six-styles', {
        body: { 
          transcript: meetingData.transcript,
          settings,
          detail_level: 3,
        }
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data as ApiResponse);
      toast.success("Six meeting note styles generated successfully!");
    } catch (e: any) {
      console.error('Generation error:', e);
      setError(e?.message || "Unexpected error");
      toast.error("Failed to generate meeting notes");
    } finally {
      setLoading(false);
    }
  }

  function startEdit() {
    setEditText(getActiveMarkdown());
    setIsEditing(true);
  }

  function saveEdit() {
    setOverrides(prev => ({ ...prev, [activeView]: editText }));
    setIsEditing(false);
    toast.success("Changes saved");
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditText("");
  }

  function resetEdit() {
    setOverrides(prev => {
      const newOverrides = { ...prev };
      delete newOverrides[activeView];
      return newOverrides;
    });
    setIsEditing(false);
    setEditText("");
    toast.success("Edits reset");
  }

  async function handleCopy() {
    const text = getActiveMarkdown();
    await copyToClipboard(text);
  }

  async function handleDownload() {
    const text = getActiveMarkdown();
    const currentTab = userFriendlyTabs.find(([key]) => key === activeView);
    const filename = `${meetingData?.title || 'Meeting Notes'} - ${currentTab?.[1] || activeView}`;
    await generateWordDocument(text, filename);
  }

  const activeText = getActiveMarkdown();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Six Meeting Note Styles
            <Badge variant="secondary">{meetingData?.title}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {!result && (
            <Card>
              <CardHeader>
                <CardTitle>Generate Professional Meeting Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Generate six different professional styles of meeting notes from your transcript:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  {userFriendlyTabs.map(([key, title, desc]) => (
                    <div key={key} className="border rounded-lg p-3">
                      <h4 className="font-medium text-sm">{title}</h4>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  ))}
                </div>
                <Button 
                  onClick={generate} 
                  disabled={loading || !meetingData?.transcript?.trim()}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Six Note Styles...
                    </>
                  ) : (
                    "Generate Six Note Styles"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {error && (
            <div className="text-destructive bg-destructive/10 p-3 rounded border border-destructive/20">
              {error}
            </div>
          )}

          {result && (
            <div className="flex-1 overflow-hidden">
              <Tabs value={activeView} onValueChange={(value) => {
                setActiveView(value as ViewKey);
                setIsEditing(false);
              }} className="h-full flex flex-col">
                <div className="flex flex-wrap gap-2 border-b pb-2 mb-4">
                  <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
                    {userFriendlyTabs.map(([key, label]) => (
                      <TabsTrigger key={key} value={key} className="text-xs">
                        {label.split(' ')[0]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  <div className="flex gap-2 ml-auto">
                    {!isEditing && (
                      <Button size="sm" variant="outline" onClick={startEdit}>
                        <Edit3 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    )}
                    {isEditing && (
                      <>
                        <Button size="sm" onClick={saveEdit}>
                          <Save className="w-4 h-4 mr-1" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                        <Button size="sm" variant="outline" onClick={resetEdit}>
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Reset
                        </Button>
                      </>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setRenderMode(renderMode === "rendered" ? "raw" : "rendered")}
                    >
                      {renderMode === "rendered" ? "Show Raw" : "Show Rendered"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCopy}>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </Button>
                    <Button size="sm" onClick={handleDownload}>
                      <Download className="w-4 h-4 mr-1" />
                      Word
                    </Button>
                  </div>
                </div>

                {userFriendlyTabs.map(([key, title, description]) => (
                  <TabsContent key={key} value={key} className="flex-1 overflow-hidden">
                    <div className="mb-2">
                      <h3 className="font-semibold">{title}</h3>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                    
                    <div className="border rounded-lg flex-1 overflow-hidden">
                      {isEditing && activeView === key ? (
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="h-96 resize-none font-mono text-sm"
                          placeholder="Edit your content here..."
                        />
                      ) : renderMode === "rendered" ? (
                        <div className="p-4 h-96 overflow-auto prose prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {activeText || "No content generated"}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <pre className="p-4 h-96 overflow-auto text-sm font-mono whitespace-pre-wrap">
                          {activeText || "No content generated"}
                        </pre>
                      )}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}