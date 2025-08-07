import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MessageSquare, 
  ChevronDown, 
  Clock,
  Users,
  Edit3,
  Plus,
  X,
  FileText
} from "lucide-react";

interface Speaker {
  id: string;
  name: string;
  color: string;
}

interface LiveTranscriptProps {
  transcript: string;
  showTimestamps: boolean;
  onTimestampsToggle: (show: boolean) => void;
  attendees?: string; // Comma-separated attendee names from meeting settings
}

export const LiveTranscript = ({ 
  transcript, 
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
      setLiveTranscriptText(transcript);
    }
    // Don't clear liveTranscriptText when transcript becomes empty - keep last content visible
  }, [transcript]);

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
    
    // Remove hallucinated phrases from transcript display
    const cleanedText = text
      .replace(/Thank you for watching\.?\s*/gi, '')
      .replace(/Thanks for watching\.?\s*/gi, '')
      .trim();
    
    const sentences = cleanedText.split('. ');
    return sentences.map((sentence, index) => {
      const timestamp = `${Math.floor(index * 0.5).toString().padStart(2, '0')}:${((index * 30) % 60).toString().padStart(2, '0')}`;
      return showTimestamps ? `[${timestamp}] ${sentence}` : sentence;
    }).join('. ');
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
                    
                    <div className="mt-2 text-xs text-muted-foreground">
                      💡 This section updates live as you speak - no disappearing or reappearing
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Full Transcript Archive */}
              <div className="min-h-[200px] p-4 bg-accent/20 rounded-lg border">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Full Transcript Archive</span>
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