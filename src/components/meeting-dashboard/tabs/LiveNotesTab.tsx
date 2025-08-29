import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  Edit, 
  Save, 
  Download,
  RefreshCw,
  Eye,
  History,
  Sparkles,
  CheckSquare,
  Users,
  Clock,
  X,
  GitBranch
} from "lucide-react";
import { useDashboard } from "../utils/DashboardContext";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface MeetingData {
  transcript: string;
  duration: number;
  wordCount: number;
  connectionStatus: string;
  id?: string;
  user_id?: string;
}

interface LiveNotes {
  id: string;
  meeting_id: string;
  user_id: string;
  session_id: string;
  current_version: number;
  notes_content: string;
  transcript_word_count: number;
  last_updated_at: string;
  processing_status: string;
}

interface LiveNotesTabProps {
  meetingData: MeetingData;
}

interface TranscriptLevel {
  id: string;
  label: string;
  description: string;
  content: string;
}

interface ActionItem {
  id: string;
  text: string;
  assignee?: string;
  priority: "high" | "medium" | "low";
  detected: boolean;
}

export const LiveNotesTab = ({ meetingData }: LiveNotesTabProps) => {
  const { liveNotes, updateLiveNotes, meetingConfig } = useDashboard();
  const [selectedLevel, setSelectedLevel] = useState("live_notes");
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveNotesData, setLiveNotesData] = useState<LiveNotes | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Mock transcript levels
  const [transcriptLevels, setTranscriptLevels] = useState<TranscriptLevel[]>([
    {
      id: "raw",
      label: "Raw Transcript",
      description: "Unprocessed speech-to-text output",
      content: meetingData.transcript || ""
    },
    {
      id: "cleaned",
      label: "Cleaned Transcript", 
      description: "Grammar and spelling corrections applied",
      content: ""
    },
    {
      id: "live_notes",
      label: "Live Meeting Notes", 
      description: "AI-generated meeting notes updated every 15 minutes",
      content: liveNotesData?.notes_content || "No live notes generated yet. Click 'Generate Live Notes' to create automated meeting notes."
    }
  ]);

  // Filter out system messages (silence detection, etc.)
  const filterSystemMessages = (text: string): string => {
    if (!text) return text;
    
    // Remove silence detection and system messages
    let filtered = text
      .replace(/\[silence detected\]/gi, '')
      .replace(/\[no audio detected\]/gi, '')
      .replace(/\[quiet period detected\]/gi, '')
      .replace(/\[pause detected\]/gi, '')
      .replace(/\[audio stopped\]/gi, '')
      .replace(/\[listening\.\.\.\]/gi, '')
      .replace(/\[waiting for audio\]/gi, '')
      .replace(/\[no speech detected\]/gi, '')
      .replace(/\[audio pause\]/gi, '')
      .replace(/\[silence\]/gi, '')
      .replace(/\[quiet\]/gi, '')
      .replace(/\[no sound\]/gi, '')
      .replace(/\[audio gap\]/gi, '')
      .replace(/\[recording paused\]/gi, '')
      .replace(/\[system message\]/gi, '')
      .replace(/if silence or background noise,?\s*return nothing\.?/gi, '')
      .replace(/if silence or background noise,?\s*return nothing/gi, '')
      // Clean up extra spaces and line breaks
      .replace(/\s+/g, ' ')
      .trim();
    
    return filtered;
  };

  // Load existing live notes for this meeting
  useEffect(() => {
    const loadLiveNotes = async () => {
      if (!meetingData?.id || !meetingData?.user_id) return;

      try {
        const { data, error } = await supabase
          .from('live_meeting_notes')
          .select('*')
          .eq('meeting_id', meetingData.id)
          .eq('user_id', meetingData.user_id)
          .single();

        if (data) {
          setLiveNotesData(data);
        }
      } catch (error) {
        console.log('No existing live notes found');
      }
    };

    loadLiveNotes();
  }, [meetingData?.id, meetingData?.user_id]);

  // Set up real-time subscription for live notes updates
  useEffect(() => {
    if (!meetingData?.id || !meetingData?.user_id) return;

    const channel = supabase
      .channel('live-notes-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_meeting_notes',
          filter: `meeting_id=eq.${meetingData.id}`
        },
        (payload) => {
          console.log('Live notes updated:', payload);
          if (payload.new && (payload.new as any).user_id === meetingData.user_id) {
            setLiveNotesData(payload.new as LiveNotes);
            toast({
              title: "Meeting Notes Updated",
              description: `Version ${(payload.new as any).current_version} generated automatically.`
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingData?.id, meetingData?.user_id, toast]);

  // Set up automatic note generation every 15 minutes (1 minute after Deep Clean)
  useEffect(() => {
    if (!meetingData?.id || !meetingData?.user_id) return;

    const generateNotesInterval = setInterval(() => {
      generateLiveNotes(false);
    }, 15 * 60 * 1000); // 15 minutes

    return () => {
      clearInterval(generateNotesInterval);
    };
  }, [meetingData?.id, meetingData?.user_id]);

  // Update transcript levels when live notes change
  useEffect(() => {
    if (!meetingData.transcript) return;

    const raw = filterSystemMessages(meetingData.transcript);
    
    // Simulate cleaned transcript (basic corrections)
    const cleaned = raw
      .replace(/\b(um|uh|er)\b/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/([.!?])\s*([a-z])/g, (match, punct, letter) => `${punct} ${letter.toUpperCase()}`)
      .trim();

    setTranscriptLevels(prev => prev.map(level => {
      switch (level.id) {
        case "raw": return { ...level, content: filterSystemMessages(meetingData.transcript || "") };
        case "cleaned": return { ...level, content: cleaned };
        case "live_notes": return { 
          ...level, 
          content: liveNotesData?.notes_content || "No live notes generated yet. Click 'Generate Live Notes' to create automated meeting notes."
        };
        default: return level;
      }
    }));

    // Extract mock action items
    const mockActionItems: ActionItem[] = [
      {
        id: "1",
        text: "Follow up on budget discussion",
        assignee: meetingConfig.attendees[0]?.name,
        priority: "high",
        detected: true
      },
      {
        id: "2", 
        text: "Schedule follow-up meeting",
        priority: "medium",
        detected: true
      }
    ];

    setActionItems(mockActionItems);
  }, [meetingData.transcript, meetingConfig, liveNotesData]);

  const currentLevel = transcriptLevels.find(level => level.id === selectedLevel);

  const generateLiveNotes = async (force = false) => {
    if (!meetingData?.id || !meetingData?.user_id) {
      toast({
        title: "Error",
        description: "Meeting information not available",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('live-meeting-notes-generator', {
        body: {
          meetingId: meetingData.id,
          userId: meetingData.user_id,
          sessionId: sessionId,
          forceGenerate: force
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Live Notes Generated",
          description: `Version ${data.version} created successfully (${data.wordCount} words processed)`,
        });
      } else {
        toast({
          title: "Generation Skipped",
          description: data.message,
        });
      }
    } catch (error) {
      console.error('Error generating live notes:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate live notes",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditContent(currentLevel?.content || "");
  };

  const handleSave = () => {
    if (selectedLevel === "live_notes") {
      updateLiveNotes(editContent);
    }
    
    setTranscriptLevels(prev => prev.map(level => 
      level.id === selectedLevel ? { ...level, content: editContent } : level
    ));
    
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditContent("");
  };

  const exportNotes = () => {
    const exportData = {
      meeting: {
        title: meetingConfig.title,
        date: new Date().toISOString(),
        duration: meetingData.duration,
        format: meetingConfig.format,
        attendees: meetingConfig.attendees
      },
      levels: transcriptLevels,
      liveNotes: liveNotesData,
      actionItems: actionItems
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `live-meeting-notes-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Controls Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Live Meeting Notes
              {liveNotesData && (
                <Badge variant="secondary" className="ml-2">
                  v{liveNotesData.current_version}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {transcriptLevels.map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      <div className="flex flex-col">
                        <span>{level.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {level.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedLevel === 'live_notes' && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <GitBranch className="w-3 h-3" />
                  {liveNotesData ? `${liveNotesData.transcript_word_count} words` : 'Not generated'}
                </Badge>
              )}
              
              {!isEditing ? (
                <div className="flex items-center gap-2">
                  {selectedLevel === 'live_notes' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateLiveNotes(false)}
                        disabled={isGenerating}
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className={cn("h-4 w-4", isGenerating && "animate-spin")} />
                        {isGenerating ? 'Generating...' : 'Generate Notes'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateLiveNotes(true)}
                        disabled={isGenerating}
                        className="flex items-center gap-2"
                      >
                        <Sparkles className="h-4 w-4" />
                        Force Update
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={handleEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportNotes}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancel}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              )}
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Content Editor - Portrait A4 Style */}
      <Card className="flex-1">
        <CardContent className="p-0 h-full">
          <div className="bg-gray-50 p-8 mx-auto" style={{ 
            maxWidth: '210mm', 
            minHeight: '297mm',
            aspectRatio: '210/297',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            {isEditing ? (
              <Textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-full min-h-[800px] font-sans text-sm resize-none border-none bg-white p-6"
                placeholder="Edit your meeting notes here..."
              />
            ) : (
              <div 
                className="w-full h-full min-h-[800px] bg-white p-6 text-sm leading-relaxed shadow-sm"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                {selectedLevel === 'live_notes' && !liveNotesData && !isGenerating && (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                    <FileText className="w-16 h-16 mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No Live Notes Generated</h3>
                    <p className="text-sm mb-4">Click "Generate Notes" to create automated meeting notes based on the current transcript.</p>
                    <Button onClick={() => generateLiveNotes(false)} disabled={isGenerating}>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Live Notes
                    </Button>
                  </div>
                )}
                
                {selectedLevel === 'live_notes' && isGenerating && (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                    <RefreshCw className="w-16 h-16 mb-4 animate-spin opacity-50" />
                    <h3 className="text-lg font-medium mb-2">Generating Live Notes...</h3>
                    <p className="text-sm">Processing transcript and creating meeting notes.</p>
                  </div>
                )}
                
                {(selectedLevel !== 'live_notes' || liveNotesData) && (
                  <div className="prose prose-sm max-w-none">
                    <div className="mb-4">
                      <Badge variant="outline">
                        {currentLevel?.label}
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-1">
                        {currentLevel?.description}
                      </p>
                    </div>
                    
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {currentLevel?.content || "No content available"}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Footer */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Processing Level</div>
              <div className="font-medium">{currentLevel?.label}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Content Length</div>
              <div className="font-medium">{currentLevel?.content.length || 0} chars</div>
            </div>
            <div>
              <div className="text-muted-foreground">Last Updated</div>
              <div className="font-medium">{liveNotesData?.last_updated_at ? new Date(liveNotesData.last_updated_at).toLocaleTimeString() : new Date().toLocaleTimeString()}</div>
            </div>
            {selectedLevel === 'live_notes' && liveNotesData && (
              <div>
                <div className="text-muted-foreground">Version</div>
                <div className="font-medium">v{liveNotesData.current_version}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};