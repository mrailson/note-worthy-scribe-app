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
  Clock
} from "lucide-react";
import { useDashboard } from "../utils/DashboardContext";
import { cn } from "@/lib/utils";

interface MeetingData {
  transcript: string;
  duration: number;
  wordCount: number;
  connectionStatus: string;
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
  const [selectedLevel, setSelectedLevel] = useState("processed");
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      id: "processed",
      label: "AI-Enhanced",
      description: "Context-aware improvements and formatting",
      content: ""
    },
    {
      id: "final",
      label: "Meeting Notes",
      description: "Structured notes with key points and actions",
      content: liveNotes
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
      // Clean up extra spaces and line breaks
      .replace(/\s+/g, ' ')
      .trim();
    
    return filtered;
  };

  // Generate processed versions of transcript
  useEffect(() => {
    if (!meetingData.transcript) return;

    const raw = filterSystemMessages(meetingData.transcript);
    
    // Simulate cleaned transcript (basic corrections)
    const cleaned = raw
      .replace(/\b(um|uh|er)\b/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/([.!?])\s*([a-z])/g, (match, punct, letter) => `${punct} ${letter.toUpperCase()}`)
      .trim();

    // Simulate AI-enhanced version
    const processed = `Meeting Discussion Summary:

${cleaned}

Attendees Present:
${meetingConfig.attendees.map(a => `• ${a.name}${a.title ? ` (${a.title})` : ''}`).join('\n')}`;

    // Simulate structured meeting notes
    const structured = `MEETING NOTES - ${meetingConfig.title || 'General Meeting'}
Date: ${new Date().toLocaleDateString()}
Duration: ${Math.floor(meetingData.duration / 60)} minutes
Format: ${meetingConfig.format.toUpperCase()}

ATTENDEES:
${meetingConfig.attendees.map(a => `• ${a.name}${a.title ? ` - ${a.title}` : ''}${a.organization ? ` (${a.organization})` : ''}`).join('\n')}

AGENDA ITEMS:
${meetingConfig.agenda || 'No formal agenda provided'}

DISCUSSION SUMMARY:
${cleaned}

ACTION ITEMS:
• Follow up on key discussion points
• Schedule next meeting
• Share meeting notes with attendees

NEXT STEPS:
• To be determined based on discussion outcomes`;

    setTranscriptLevels(prev => prev.map(level => {
      switch (level.id) {
        case "raw": return { ...level, content: filterSystemMessages(meetingData.transcript || "") };
        case "cleaned": return { ...level, content: cleaned };
        case "processed": return { ...level, content: processed };
        case "final": return { ...level, content: liveNotes || structured };
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
      },
      {
        id: "3",
        text: "Prepare quarterly report",
        assignee: meetingConfig.attendees[1]?.name,
        priority: "low",
        detected: true
      }
    ];

    setActionItems(mockActionItems);
  }, [meetingData.transcript, meetingConfig, liveNotes]);

  const currentLevel = transcriptLevels.find(level => level.id === selectedLevel);

  const handleEdit = () => {
    setIsEditing(true);
    setEditContent(currentLevel?.content || "");
  };

  const handleSave = () => {
    if (selectedLevel === "final") {
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

  const enhanceWithAI = () => {
    setIsProcessing(true);
    // Simulate AI processing
    setTimeout(() => {
      setIsProcessing(false);
      // Would normally call AI enhancement service
    }, 2000);
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
      actionItems: actionItems
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-notes-${new Date().toISOString().split('T')[0]}.json`;
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
              
              {!isEditing ? (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={enhanceWithAI}
                    disabled={isProcessing}
                  >
                    <Sparkles className={cn("h-4 w-4 mr-2", isProcessing && "animate-pulse")} />
                    Enhance
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportNotes}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancel}>
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

      {/* Content Editor */}
      <Card className="flex-1">
        <CardContent className="p-0 h-full">
          {isEditing ? (
            <Textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="h-full resize-none border-none p-6 font-mono text-sm"
              placeholder="Edit meeting notes..."
            />
          ) : (
            <div className="h-full overflow-y-auto p-6">
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
        </CardContent>
      </Card>

      {/* Stats Footer */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
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
              <div className="font-medium">{new Date().toLocaleTimeString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};