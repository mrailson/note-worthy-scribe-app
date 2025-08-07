import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { transcriptCleaner, RemovedSegment } from "@/utils/TranscriptCleaner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
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
  const [removedSegments, setRemovedSegments] = useState<RemovedSegment[]>([]);

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

  // Update live transcript text when transcript prop changes
  useEffect(() => {
    if (transcript && transcript.trim()) {
      const newSegment = transcript;
      
      if (isAutoCleaningEnabled) {
        // Use streaming cleaner with confidence filtering
        const cleanedNew = transcriptCleaner.cleanStreamingTranscript(cleanedTranscript, newSegment, confidence);
        setCleanedTranscript(cleanedNew);
        setLiveTranscriptText(cleanedNew); // Show cleaned version
      } else {
        setLiveTranscriptText(newSegment); // Show raw version
      }
    }
    // Don't clear liveTranscriptText when transcript becomes empty - keep last content visible
    
    // Update removed segments list
    setRemovedSegments(transcriptCleaner.getRemovedSegments());
  }, [transcript, isAutoCleaningEnabled, cleanedTranscript]);

  // Update removed segments periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setRemovedSegments(transcriptCleaner.getRemovedSegments());
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

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
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSpeakersOpen(!isSpeakersOpen)}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Speakers ({speakers.length})
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

              {/* Speaker Management */}
              {isSpeakersOpen && (
                <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Users className="h-4 w-4" />
                    Speaker Management
                  </div>
                  
                  {/* Current Speakers */}
                  {speakers.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Current Speakers:</Label>
                      <div className="flex flex-wrap gap-2">
                        {speakers.map(speaker => (
                          <Badge key={speaker.id} className={`${speaker.color} flex items-center gap-1`}>
                            {speaker.name}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-3 w-3 p-0 hover:bg-red-200"
                              onClick={() => removeSpeaker(speaker.id)}
                            >
                              <X className="h-2 w-2" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Add New Speaker */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter speaker name or initials"
                      value={newSpeakerName}
                      onChange={(e) => setNewSpeakerName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addSpeaker()}
                      className="flex-1"
                    />
                    <Button 
                      onClick={addSpeaker} 
                      disabled={!newSpeakerName.trim()}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Speaker
                    </Button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    💡 Speakers from meeting attendees are automatically added. You can add more speakers manually.
                  </p>
                </div>
              )}

              {/* Real-time cleaning status */}
              {isAutoCleaningEnabled && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                  <Sparkles className="h-3 w-3 text-green-600" />
                  <span>AI Cleaning Active: Removing hallucinations, fixing grammar, and improving readability</span>
                </div>
              )}

              {/* Live Updates Section - Hidden by Default */}
              <Collapsible open={isLiveUpdateOpen} onOpenChange={setIsLiveUpdateOpen}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span>Live Transcript Updates</span>
                      {isAutoCleaningEnabled && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Cleaned
                        </Badge>
                      )}
                      {liveTranscriptText && (
                        <Badge variant="secondary" className="ml-2">
                          {liveTranscriptText.split(' ').length} words
                        </Badge>
                      )}
                    </div>
                    <ChevronDown 
                      className={`h-4 w-4 transition-transform ${isLiveUpdateOpen ? 'rotate-180' : ''}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="mt-3">
                  <div className="min-h-[120px] p-4 bg-accent/20 rounded-lg border">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Most Recent Speech
                      </span>
                    </div>
                    
                    {/* Always visible container - content updates smoothly */}
                    <div 
                      className="text-sm leading-relaxed whitespace-pre-wrap min-h-[60px] p-3 bg-background/50 rounded-md border border-green-200/50"
                      style={{ 
                        transition: 'all 0.2s ease-in-out',
                        // Prevent layout shifts
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word'
                      }}
                    >
                      {liveTranscriptText ? (
                        <span className="text-foreground">
                          {formatTranscriptWithTimestamps(liveTranscriptText)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">
                          Listening for speech... words will appear here as you speak
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                      {isAutoCleaningEnabled ? (
                        <>
                          <Sparkles className="h-3 w-3 text-green-600" />
                          <span>Text is automatically cleaned and formatted in real-time</span>
                        </>
                      ) : (
                        <>
                          <span>💡 Raw transcript - enable AI Cleaning above for better formatting</span>
                        </>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Tabbed Interface for Transcript and Quality Control */}
              <Tabs defaultValue="transcript" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="transcript">Full Transcript Archive</TabsTrigger>
                  <TabsTrigger value="removed" className="relative">
                    Removed Segments
                    {removedSegments.length > 0 && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {removedSegments.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="transcript" className="mt-4">
                  <div className="min-h-[200px] p-4 bg-accent/20 rounded-lg border">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Complete Meeting Transcript</span>
                    </div>
                    {transcript || transcriptSegments.length > 0 ? (
                      <div className="text-sm leading-relaxed whitespace-pre-wrap opacity-75">
                        {formatTranscriptWithTimestamps(transcript)}
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-center py-8">
                        Complete transcript will be archived here...
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="removed" className="mt-4">
                  <div className="min-h-[200px] p-4 bg-accent/20 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">AI Quality Control - Removed Segments</span>
                      </div>
                      {removedSegments.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            transcriptCleaner.clearRemovedSegments();
                            setRemovedSegments([]);
                          }}
                        >
                          Clear List
                        </Button>
                      )}
                    </div>
                    
                    {removedSegments.length > 0 ? (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {removedSegments
                          .slice(-20) // Show last 20 removed segments
                          .reverse() // Most recent first
                          .map((segment, index) => (
                          <div 
                            key={index} 
                            className="p-3 bg-background/50 rounded-md border border-red-200/50 hover:border-red-300/50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant={segment.type === 'hallucination' ? 'destructive' : 
                                          segment.type === 'low-confidence' ? 'secondary' :
                                          segment.type === 'duplicate' ? 'outline' : 'default'}
                                  className="text-xs"
                                >
                                  {segment.type.replace('-', ' ')}
                                </Badge>
                                {segment.confidence && (
                                  <Badge variant="outline" className="text-xs">
                                    {Math.round(segment.confidence * 100)}% confidence
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(segment.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="text-sm text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-950/30 p-2 rounded">
                              "{segment.text}"
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              <strong>Reason:</strong> {segment.reason}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <Sparkles className="h-8 w-8 text-green-500" />
                          <span>No segments removed yet</span>
                          <span className="text-xs">AI cleaning will show removed hallucinations and low-quality segments here</span>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              
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