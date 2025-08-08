import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { transcriptCleaner } from "@/utils/TranscriptCleaner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { medicalTermCorrector } from "@/utils/MedicalTermCorrector";
import { MedicalTermCorrectionDialog } from "@/components/MedicalTermCorrectionDialog";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageSquare, 
  ChevronDown, 
  Clock,
  Users,
  Edit3,
  Plus,
  X,
  FileText,
  Sparkles,
  RefreshCw
} from "lucide-react";

interface Speaker {
  id: string;
  name: string;
  color: string;
}

interface LiveTranscriptProps {
  transcript: string;
  confidence?: number; // Add confidence prop
  showTimestamps: boolean;
  onTimestampsToggle: (show: boolean) => void;
  attendees?: string; // Comma-separated attendee names from meeting settings
}

export const LiveTranscript = ({ 
  transcript, 
  confidence,
  showTimestamps, 
  onTimestampsToggle,
  attendees 
}: LiveTranscriptProps) => {
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(true);
  const [isLiveUpdateOpen, setIsLiveUpdateOpen] = useState(false); // New state for live updates
  const [isSpeakersOpen, setIsSpeakersOpen] = useState(false);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [newSpeakerName, setNewSpeakerName] = useState("");
  const [currentSpeaker, setCurrentSpeaker] = useState<string>("");
  const [transcriptSegments, setTranscriptSegments] = useState<Array<{
    text: string;
    speaker: string;
    timestamp: string;
  }>>([]);
  
  // State for live transcript display
  const [liveTranscriptText, setLiveTranscriptText] = useState<string>("");
  const [cleanedTranscript, setCleanedTranscript] = useState<string>("");
  const [isAutoCleaningEnabled, setIsAutoCleaningEnabled] = useState<boolean>(true);
  const [selectedText, setSelectedText] = useState<string>("");
  const [isMedicalCorrectionsLoaded, setIsMedicalCorrectionsLoaded] = useState<boolean>(false);
  

  // Generate speaker colors
  const speakerColors = [
    "bg-blue-100 text-blue-800",
    "bg-green-100 text-green-800", 
    "bg-purple-100 text-purple-800",
    "bg-orange-100 text-orange-800",
    "bg-pink-100 text-pink-800",
    "bg-indigo-100 text-indigo-800"
  ];

  // Initialize speakers from attendees when component loads
  useEffect(() => {
    if (attendees && attendees.trim()) {
      const attendeeNames = attendees.split(',').map(name => name.trim()).filter(name => name);
      const initialSpeakers: Speaker[] = attendeeNames.map((name, index) => ({
        id: `speaker-${index}`,
        name: name,
        color: speakerColors[index % speakerColors.length]
      }));
      setSpeakers(initialSpeakers);
    }
  }, [attendees]);

  // Load medical term corrections on component mount
  useEffect(() => {
    const loadMedicalCorrections = async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (user.user) {
          await medicalTermCorrector.loadCorrections(user.user.id);
        } else {
          await medicalTermCorrector.loadCorrections();
        }
        setIsMedicalCorrectionsLoaded(true);
      } catch (error) {
        console.error('Error loading medical corrections:', error);
      }
    };

    loadMedicalCorrections();
  }, []);

  // Update live transcript text when transcript prop changes
  useEffect(() => {
    if (transcript && transcript.trim()) {
      let processedTranscript = transcript;
      
      // Apply medical term corrections if loaded
      if (isMedicalCorrectionsLoaded && medicalTermCorrector.hasCorrections()) {
        processedTranscript = medicalTermCorrector.applyCorrections(transcript);
      }
      
      if (isAutoCleaningEnabled) {
        // Use streaming cleaner with confidence filtering
        const cleanedNew = transcriptCleaner.cleanStreamingTranscript(cleanedTranscript, processedTranscript, confidence);
        setCleanedTranscript(cleanedNew);
        setLiveTranscriptText(cleanedNew); // Show cleaned version
      } else {
        setLiveTranscriptText(processedTranscript); // Show processed version
      }
    }
    // Don't clear liveTranscriptText when transcript becomes empty - keep last content visible
  }, [transcript, isAutoCleaningEnabled, cleanedTranscript, isMedicalCorrectionsLoaded]);

  // Handle text selection for corrections
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString().trim());
    }
  };

  const addSpeaker = () => {
    if (newSpeakerName.trim()) {
      const newSpeaker: Speaker = {
        id: `speaker-${Date.now()}`,
        name: newSpeakerName.trim(),
        color: speakerColors[speakers.length % speakerColors.length]
      };
      setSpeakers([...speakers, newSpeaker]);
      setNewSpeakerName("");
    }
  };

  const removeSpeaker = (speakerId: string) => {
    setSpeakers(speakers.filter(s => s.id !== speakerId));
    if (currentSpeaker === speakerId) {
      setCurrentSpeaker("");
    }
  };

  const addTranscriptSegment = () => {
    if (transcript && currentSpeaker) {
      const speakerName = speakers.find(s => s.id === currentSpeaker)?.name || "Unknown";
      const timestamp = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      setTranscriptSegments([...transcriptSegments, {
        text: transcript,
        speaker: speakerName,
        timestamp
      }]);
    }
  };

  const formatTranscriptWithSpeakers = () => {
    if (transcriptSegments.length === 0) return transcript;
    
    return transcriptSegments.map((segment, index) => {
      const timeDisplay = showTimestamps ? `[${segment.timestamp}] ` : '';
      return `${timeDisplay}${segment.speaker}: ${segment.text}`;
    }).join('\n\n');
  };

  const formatTranscriptWithTimestamps = (text: string) => {
    if (!text) return "";
    
    if (transcriptSegments.length > 0) {
      return formatTranscriptWithSpeakers();
    }
    
    // Clean transcript using our cleaning service
    const cleanedText = isAutoCleaningEnabled ? 
      transcriptCleaner.cleanTranscript(text, {
        removeHallucinations: true,
        fixGrammar: true,
        addPunctuation: true,
        removeFiller: false,
        mergeFragments: true
      }) : text;
    
    if (showTimestamps) {
      const sentences = cleanedText.split(/[.!?]+/).filter(s => s.trim());
      return sentences.map((sentence, index) => {
        const timestamp = `${Math.floor(index * 0.5).toString().padStart(2, '0')}:${((index * 30) % 60).toString().padStart(2, '0')}`;
        return `[${timestamp}] ${sentence.trim()}.`;
      }).join('\n\n');
    }
    
    // Format as paragraphs for better readability
    return cleanedText.split(/[.!?]+/).filter(s => s.trim()).map(s => s.trim() + '.').join('\n\n');
  };

  return (
    <div className="space-y-4">
      {/* Live Transcript */}
      <Card className="shadow-medium">
        <Collapsible open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Live Meeting Transcript
                </div>
                <ChevronDown 
                  className={`h-4 w-4 transition-transform ${isTranscriptOpen ? 'rotate-180' : ''}`}
                />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant={showTimestamps ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onTimestampsToggle(!showTimestamps)}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Timestamps
                  </Button>
                  
                  <Button
                    variant={isAutoCleaningEnabled ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setIsAutoCleaningEnabled(!isAutoCleaningEnabled)}
                    className="flex items-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span className="hidden sm:inline">AI Cleaning</span>
                    <span className="sm:hidden">Clean</span>
                  </Button>

                  <MedicalTermCorrectionDialog
                    selectedText={selectedText}
                    onCorrectionAdded={async () => {
                      // Refresh corrections when new ones are added
                      const { data: user } = await supabase.auth.getUser();
                      if (user.user) {
                        await medicalTermCorrector.refreshCorrections(user.user.id);
                      }
                      setIsMedicalCorrectionsLoaded(true);
                    }}
                  />
                </div>
                
                {transcript && speakers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Select value={currentSpeaker} onValueChange={setCurrentSpeaker}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Select speaker" />
                      </SelectTrigger>
                      <SelectContent>
                        {speakers.map(speaker => (
                          <SelectItem key={speaker.id} value={speaker.id}>
                            {speaker.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      size="sm" 
                      onClick={addTranscriptSegment}
                      disabled={!currentSpeaker}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                )}
              </div>


              {/* Latest Transcript Section */}
              <div className="space-y-4">
                <div className="min-h-[120px] p-4 bg-accent/20 rounded-lg border">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Latest Transcription
                    </span>
                    <Badge variant="outline" className="text-xs">Raw</Badge>
                  </div>
                  
                  <div 
                    className="text-sm leading-relaxed whitespace-pre-wrap min-h-[60px] p-3 bg-background/50 rounded-md border"
                    style={{ 
                      transition: 'all 0.2s ease-in-out',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word'
                    }}
                  >
                    {transcript ? (
                      <span className="text-foreground font-mono">
                        {transcript}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">
                        Listening for speech... raw transcription will appear here
                      </span>
                    )}
                  </div>
                  
                  {confidence && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Confidence: {Math.round(confidence * 100)}%</span>
                    </div>
                  )}
                </div>

                {/* AI-Cleaned and Formatted Section */}
                <div className="min-h-[120px] p-4 bg-gradient-to-br from-primary/5 to-accent/20 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                    <span className="text-sm font-medium text-foreground uppercase tracking-wide">
                      AI-Enhanced Transcript
                    </span>
                    <Badge variant="default" className="text-xs">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Cleaned
                    </Badge>
                  </div>
                  
                  <div 
                    className="text-sm leading-relaxed whitespace-pre-wrap min-h-[60px] p-4 bg-background/80 rounded-md border border-primary/10 shadow-sm select-text cursor-text"
                    style={{ 
                      transition: 'all 0.2s ease-in-out',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      userSelect: 'text'
                    }}
                    onMouseUp={handleTextSelection}
                  >
                    {cleanedTranscript || (transcript && isAutoCleaningEnabled) ? (
                      <div className="space-y-2">
                        {(cleanedTranscript || transcript).split(/[.!?]+/).filter(s => s.trim()).map((sentence, index) => {
                          const timestamp = new Date();
                          timestamp.setSeconds(timestamp.getSeconds() + (index * 10));
                          const timeStr = timestamp.toLocaleTimeString('en-GB', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          });
                          
                          return (
                            <div key={index} className="flex items-start gap-3 p-2 hover:bg-accent/30 rounded-md transition-colors">
                              <div className="flex items-center gap-2 min-w-fit">
                                <Clock className="h-3 w-3 text-primary/70" />
                                <Badge variant="outline" className="text-xs px-2 py-0.5 font-mono">
                                  {timeStr}
                                </Badge>
                              </div>
                              <span className="text-foreground leading-relaxed">
                                {sentence.trim()}.
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">
                        AI-cleaned and formatted transcript will appear here with timestamps...
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-3 space-y-2">
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Sparkles className="h-3 w-3 text-primary" />
                      <span>Enhanced with AI: Grammar corrected, medical terms fixed, timestamps added</span>
                    </div>
                    {isMedicalCorrectionsLoaded && medicalTermCorrector.hasCorrections() && (
                      <div className="text-xs text-green-600 bg-green-50 p-2 rounded border border-green-200">
                        💡 Select any text above to add medical term corrections • 
                        {medicalTermCorrector.getCorrections().size} correction(s) active
                      </div>
                    )}
                  </div>
                </div>
              </div>

              
              {transcriptSegments.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {transcriptSegments.length} speaker segment(s) recorded
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
};