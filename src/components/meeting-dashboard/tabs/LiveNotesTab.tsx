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
  const [selectedLevel, setSelectedLevel] = useState("cleaned");
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

  // Function to format text into readable paragraphs
  const formatTextIntoParagraphs = (text: string): string => {
    if (!text) return "";
    
    // Clean up the text first
    let formatted = text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    // Split on natural paragraph indicators
    const paragraphBreaks = [
      /\.\s+(?=[A-Z].*?(?:meeting|discuss|agenda|topic|point|issue|question|concern|update|report|review|plan|decision|action|next|first|second|third|finally|also|however|therefore|additionally|furthermore|moreover|in conclusion|to summarize))/gi,
      /\.\s+(?=(?:So|Now|Next|First|Second|Third|Also|However|Therefore|Additionally|Furthermore|Moreover|In conclusion|To summarize|Speaking of|Regarding|About|Concerning|Moving on|Let's|We need|We should|I think|I believe|The issue|The problem|The main|A key|Another))/gi,
      /\.\s+(?=[A-Z].*?(?:list|size|numbers|patients|registrations|practices|capacity|appointments|winter|planning|feedback|complaints|telephony|training))/gi
    ];
    
    // Apply paragraph breaks
    for (const breakPattern of paragraphBreaks) {
      formatted = formatted.replace(breakPattern, (match) => {
        return match.replace(/\.\s+/, ".\n\n");
      });
    }
    
    // Break very long sentences (over 200 characters) at natural points
    const sentences = formatted.split(/\n\n/);
    const processedSentences = sentences.map(sentence => {
      if (sentence.length > 200) {
        // Look for natural breaking points within long sentences
        const breakPoints = [
          /,\s+(?=and|but|however|also|particularly|specifically|especially|meanwhile|therefore|moreover|furthermore)/gi,
          /;\s+/g,
          /\.\s+(?=[a-z])/g // Lowercase letter after period (likely continuation)
        ];
        
        for (const breakPoint of breakPoints) {
          sentence = sentence.replace(breakPoint, (match) => {
            return match.trim() + "\n\n";
          });
        }
      }
      return sentence;
    });
    
    return processedSentences
      .join("\n\n")
      .replace(/\n\n+/g, "\n\n") // Remove excessive line breaks
      .trim();
  };
  
  // Generate processed versions of transcript
  useEffect(() => {
    if (!meetingData.transcript) return;

    const raw = meetingData.transcript;
    
    // Simulate cleaned transcript (basic corrections) 
    const cleanedBase = raw
      .replace(/\b(um|uh|er)\b/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/([.!?])\s*([a-z])/g, (match, punct, letter) => `${punct} ${letter.toUpperCase()}`)
      .trim();
      
    // Apply paragraph formatting to cleaned version
    const cleaned = formatTextIntoParagraphs(cleanedBase);

    // Simulate AI-enhanced version with formatted paragraphs
    const processedContent = formatTextIntoParagraphs(cleanedBase);
    const processed = `Meeting Discussion Summary:

${processedContent}

Key Topics Covered:
• ${meetingConfig.agenda ? 'Agenda items as discussed' : 'Various business matters'}
• Participant feedback and insights
• Action items and next steps

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
        case "raw": return { ...level, content: raw };
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

  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);

  // Generate meeting notes using AI when "Meeting Notes" is selected
  const generateMeetingNotes = async () => {
    if (!meetingData.transcript) {
      console.log('No transcript available for meeting notes generation');
      return;
    }

    setIsGeneratingNotes(true);
    
    try {
      console.log('Generating meeting notes with AI...');
      
      const meetingContext = {
        title: meetingConfig.title,
        format: meetingConfig.format,
        attendees: meetingConfig.attendees,
        agenda: meetingConfig.agenda,
        contextText: meetingConfig.contextText || '',
        contextFiles: meetingConfig.contextFiles || [],
        transcript: meetingData.transcript,
        duration: meetingData.duration
      };

      const response = await fetch('/functions/v1/generate-live-meeting-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ meetingContext }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate meeting notes');
      }

      const result = await response.json();
      
      // Update the final transcript level with generated notes
      setTranscriptLevels(prev => prev.map(level => 
        level.id === 'final' ? { ...level, content: result.notes } : level
      ));
      
      updateLiveNotes(result.notes);
      
      console.log('Meeting notes generated successfully');
      
    } catch (error) {
      console.error('Error generating meeting notes:', error);
      // Fallback to structured template
      const fallbackNotes = generateFallbackNotes();
      setTranscriptLevels(prev => prev.map(level => 
        level.id === 'final' ? { ...level, content: fallbackNotes } : level
      ));
      updateLiveNotes(fallbackNotes);
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  // Fallback notes generator
  const generateFallbackNotes = () => {
    const cleanedTranscript = meetingData.transcript
      .replace(/\b(um|uh|er)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const formattedTranscript = formatTextIntoParagraphs(cleanedTranscript);
    
    return `# MEETING NOTES

**Meeting:** ${meetingConfig.title}
**Date:** ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
**Duration:** ${Math.floor(meetingData.duration / 60)} minutes
**Format:** ${meetingConfig.format?.toUpperCase()}

## ATTENDEES
${meetingConfig.attendees.map(a => `• ${a.name}${a.title ? ` - ${a.title}` : ''}${a.organization ? ` (${a.organization})` : ''}`).join('\n') || '• No attendees recorded'}

## AGENDA
${meetingConfig.agenda || 'No formal agenda provided'}

${meetingConfig.contextText ? `## BACKGROUND CONTEXT
${meetingConfig.contextText}` : ''}

## DISCUSSION SUMMARY
${formattedTranscript}

## ACTION ITEMS
• Review and distribute meeting notes
• Schedule follow-up meeting if required
• Address any unresolved items

## NEXT STEPS
• To be determined based on discussion outcomes
• Follow up on key decisions made during the meeting

---
*Generated on ${new Date().toLocaleString('en-GB')}*`;
  };

  // Auto-generate meeting notes when switching to "Meeting Notes" and when key content changes
  useEffect(() => {
    if (selectedLevel === 'final' && meetingData.transcript && !isGeneratingNotes) {
      const currentFinalContent = transcriptLevels.find(l => l.id === 'final')?.content || '';
      
      // Check if we need to regenerate (no content or basic template)
      if (!currentFinalContent || 
          currentFinalContent.includes('To be determined based on discussion outcomes') ||
          currentFinalContent.length < 200) {
        generateMeetingNotes();
      }
    }
  }, [selectedLevel, meetingData.transcript, meetingConfig.title, meetingConfig.attendees, meetingConfig.agenda, meetingConfig.contextText]);

  const enhanceWithAI = () => {
    if (selectedLevel === 'final') {
      generateMeetingNotes();
    } else {
      setIsProcessing(true);
      // Simulate AI processing for other levels
      setTimeout(() => {
        setIsProcessing(false);
      }, 2000);
    }
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
                <SelectContent className="bg-background border border-border shadow-lg z-50">
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
                    disabled={isProcessing || isGeneratingNotes}
                  >
                    <Sparkles className={cn("h-4 w-4 mr-2", (isProcessing || isGeneratingNotes) && "animate-pulse")} />
                    {isGeneratingNotes ? 'Generating...' : selectedLevel === 'final' ? 'Regenerate' : 'Enhance'}
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