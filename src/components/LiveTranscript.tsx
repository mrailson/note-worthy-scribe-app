import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TranscriptCleaner } from "@/utils/TranscriptCleaner";
import { getActiveMinConfidence, meetsConfidenceThreshold, withDefaultThresholds } from "@/utils/confidenceGating";
import { mergeLive } from "@/utils/TranscriptMerge";
import { type LiveChunk } from "@/utils/liveMerge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { medicalTermCorrector } from "@/utils/MedicalTermCorrector";
import { MedicalTermCorrectionDialog } from "@/components/MedicalTermCorrectionDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import EnhancedFindReplacePanel from "@/components/EnhancedFindReplacePanel";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  RefreshCw,
  Check,
  ChevronsUpDown,
  Building2,
  Video,
  Settings,
  Copy,
  FileDown
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

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
  meetingSettings?: {
    practiceId: string;
    meetingFormat: string;
    transcriberService?: 'whisper' | 'deepgram';
    transcriberThresholds?: {
      whisper: number;
      deepgram: number;
    };
  };
  onMeetingSettingsChange?: (settings: { 
    practiceId: string; 
    meetingFormat: string; 
    transcriberService?: 'whisper' | 'deepgram';
    transcriberThresholds?: {
      whisper: number;
      deepgram: number;
    };
  }) => void;
  defaultOpen?: boolean;
}

export const LiveTranscript = ({ 
  transcript, 
  confidence,
  showTimestamps, 
  onTimestampsToggle,
  attendees,
  meetingSettings,
  onMeetingSettingsChange,
  defaultOpen
}: LiveTranscriptProps) => {
  const [isTranscriptOpen, setIsTranscriptOpen] = useState<boolean>(defaultOpen ?? true);
  const [isLiveUpdateOpen, setIsLiveUpdateOpen] = useState(false); // New state for live updates
  const [isMeetingSettingsOpen, setIsMeetingSettingsOpen] = useState(false); // New state for meeting settings
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
  const [isRawExpanded, setIsRawExpanded] = useState(false);
  const [selectedText, setSelectedText] = useState<string>("");
  const [isMedicalCorrectionsLoaded, setIsMedicalCorrectionsLoaded] = useState<boolean>(false);
  
  // Meeting settings state
  const { user } = useAuth();
  const { toast } = useToast();
  const [practices, setPractices] = useState<Array<{id: string, name: string}>>([]);
  const [practiceSearchOpen, setPracticeSearchOpen] = useState(false);

  // Create transcript cleaner instance
  const transcriptCleaner = useMemo(() => new TranscriptCleaner(), []);

  // Editing state for cleaned transcript
  const [isEditingCleaned, setIsEditingCleaned] = useState(false);
  const [editedCleanedText, setEditedCleanedText] = useState("");
  
  // Load user's practices (with refetch when selector opens)
  const fetchUserPractices = async () => {
    if (!user?.id) return;
    try {
      const { data: userPracticeIds } = await supabase.rpc('get_user_practice_ids', {
        p_user_id: user.id
      });

      if (userPracticeIds && userPracticeIds.length > 0) {
        const { data: practicesData, error } = await supabase
          .from('gp_practices')
          .select('id, name')
          .in('id', userPracticeIds);

        if (error) throw error;
        setPractices(practicesData || []);
      } else {
        setPractices([]);
      }
    } catch (error) {
      console.error('Error loading practices:', error);
    }
  };

  // Initial load
  useEffect(() => {
    fetchUserPractices();
  }, [user?.id]);

  // Refresh when opening meeting settings or practice search popover
  useEffect(() => {
    if (practiceSearchOpen || isMeetingSettingsOpen) {
      fetchUserPractices();
    }
  }, [practiceSearchOpen, isMeetingSettingsOpen]);
  

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

  // Guard against double subscription (StrictMode)
  const subscribedRef = useRef(false);
  const processedSeqRef = useRef(new Set<number>());

  // Subscribe to transcription chunks for AI enhancement updates
  useEffect(() => {
    if (!user?.id) return;
    if (subscribedRef.current) return;

    const currentSessionId = sessionStorage.getItem('currentSessionId');
    if (!currentSessionId) return;

    subscribedRef.current = true;
    console.log('🔄 Setting up transcription chunks subscription for session:', currentSessionId, 'subscription-id:', Math.random().toString(36).substr(2, 9));

    const channel = supabase
      .channel('transcription-chunks')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meeting_transcription_chunks',
          filter: `session_id=eq.${currentSessionId}`
        },
        (payload) => {
          console.log('📝 New transcription chunk received:', payload);
          const r = payload.new;
          if (!r?.transcription_text) return;

          // replay/duplicate guard (StrictMode + reconnect safe)
          if (typeof r.seq === 'number') {
            if (processedSeqRef.current.has(r.seq)) return;
            processedSeqRef.current.add(r.seq);
          }

          // Always show latest raw text (interim or final) in the tiny box
          setLiveTranscriptText(r.transcription_text);

          // Only merge finals into the clean buffer
          if (r.is_final === false) return;

          setCleanedTranscript(prev => mergeLive(prev, r.transcription_text));
        }
      )
      .subscribe();

    return () => {
      subscribedRef.current = false;
      processedSeqRef.current.clear();
      supabase.removeChannel(channel);
    };
  }, [user?.id, isMedicalCorrectionsLoaded, meetingSettings]);

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

  // Update live transcript text when transcript prop changes (for live box only)
  useEffect(() => {
    if (transcript && transcript.trim()) {
      const processedTranscript = filterSystemMessages(transcript);
      setLiveTranscriptText(processedTranscript);
    }
  }, [transcript]);

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
      transcriptCleaner.cleanFinal(text) : text;
    
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

  // Build formatted cleaned text (paragraphs separated by blank lines)
  const getFormattedCleanedText = () => {
    // Only use cleanedTranscript - no fallback to avoid contamination
    const base = cleanedTranscript || "";
    return formatTranscriptWithTimestamps(base);
  };

  // Build simple HTML preserving paragraph spacing
  const buildCleanedHtml = () => {
    const text = getFormattedCleanedText();
    const paras = text
      .split("\n\n")
      .map((p) => `<p>${p.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)  
      .join("");
    return `<article><h2>AI-Enhanced Transcript</h2>${paras}</article>`;
  };

  const handleCopyCleaned = async () => {
    try {
      const plain = getFormattedCleanedText();
      // Prefer rich HTML copy when available
      if ((navigator as any).clipboard && (window as any).ClipboardItem) {
        const html = buildCleanedHtml();
        const item = new (window as any).ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        });
        await (navigator as any).clipboard.write([item]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(plain);
      }
      toast({ title: "Copied", description: "Cleaned transcript copied with formatting." });
    } catch (err) {
      try {
        await navigator.clipboard.writeText(getFormattedCleanedText());
        toast({ title: "Copied", description: "Cleaned transcript copied." });
      } catch (e) {
        toast({ title: "Copy failed", description: "Your browser blocked clipboard access.", variant: "destructive" as any });
      }
    }
  };

  const handleDownloadWord = async () => {
    try {
      const content = cleanedTranscript;

      const createParagraphsFromText = (text: string) => {
        const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
        return blocks.map((block) => {
          const lines = block.split("\n");
          return new Paragraph({
            children: lines.map((line, idx) => new TextRun({ text: line, break: idx > 0 ? 1 : undefined })),
            spacing: { after: 120 },
          });
        });
      };

      const paragraphs = createParagraphsFromText(content);

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({ text: "Final Transcript", heading: HeadingLevel.HEADING_1 }),
              ...paragraphs,
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const fileName = `Final-Transcript-${new Date().toISOString().slice(0, 10)}.docx`;
      saveAs(blob, fileName);
      toast({ title: "Downloaded", description: "Word document generated." });
    } catch (e) {
      toast({ title: "Export failed", description: "Could not generate Word document.", variant: "destructive" as any });
    }
  };

  return (
    <div className="space-y-4">
      {/* Live Transcript */}
      <Card className="shadow-medium">
        <Collapsible open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors py-2">
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
                     variant={isMeetingSettingsOpen ? 'default' : 'outline'}
                     size="sm"
                     onClick={() => setIsMeetingSettingsOpen(!isMeetingSettingsOpen)}
                   >
                     <Settings className="h-4 w-4 mr-2" />
                     Meeting Settings
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
                       buttonText="Update Medical Terms, Acronyms & Missheard Names"
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

              {/* Meeting Settings Section - Now Collapsible */}
              {isMeetingSettingsOpen && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gradient-to-r from-background to-accent/10 border rounded-lg">
                  {/* Practice Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Practice
                    </Label>
                    <Popover open={practiceSearchOpen} onOpenChange={setPracticeSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={practiceSearchOpen}
                          className="w-full justify-between"
                        >
                          {meetingSettings?.practiceId ? 
                            practices.find(practice => practice.id === meetingSettings.practiceId)?.name || "Select practice"
                            : "Select practice for this meeting"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search practice..." />
                          <CommandList>
                            <CommandEmpty>No practice found.</CommandEmpty>
                            <CommandGroup>
                              {practices.map((practice) => (
                                <CommandItem
                                  key={practice.id}
                                  value={practice.name}
                                  onSelect={() => {
                                    onMeetingSettingsChange?.({
                                      practiceId: practice.id,
                                      meetingFormat: meetingSettings?.meetingFormat || "teams"
                                    });
                                    setPracticeSearchOpen(false);
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      meetingSettings?.practiceId === practice.id ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  {practice.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">
                      Choose which practice this meeting is associated with
                    </p>
                  </div>

                  {/* Meeting Format Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      Meeting Format
                    </Label>
                    <Select 
                      value={meetingSettings?.meetingFormat || "teams"} 
                      onValueChange={(value) => {
                        onMeetingSettingsChange?.({
                          practiceId: meetingSettings?.practiceId || "",
                          meetingFormat: value
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select meeting format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="teams">Teams/Web Meeting</SelectItem>
                        <SelectItem value="face-to-face">Face to Face</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Specify whether this is an online or in-person meeting
                    </p>
                  </div>

                  {cleanedTranscript && (
                    <div className="col-span-1 md:col-span-2 space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Cleaned Transcript Actions
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={handleCopyCleaned}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy cleaned (keeps formatting)
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleDownloadWord}>
                          <FileDown className="h-4 w-4 mr-2" />
                          Word (.docx)
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Available once AI cleaning is active. Copies as rich text; Word export preserves spacing.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Two Feed Transcript System */}
              <div className="space-y-4">

                {/* Live (Interim) Transcript – 3 lines only */}
                <div className="p-3 bg-accent/20 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Live Transcript (Interim)
                    </span>
                    <Badge variant="outline" className="text-xs">may repeat</Badge>
                    <div className="ml-auto">
                      <Button size="sm" variant="ghost" onClick={() => setIsRawExpanded(v => !v)}>
                        {isRawExpanded ? "Collapse" : "Show more"}
                      </Button>
                    </div>
                  </div>

                  <div
                    className={`text-sm font-mono leading-relaxed bg-background/50 rounded-md border p-2 transition-all
                      ${isRawExpanded ? "max-h-64 overflow-y-auto" : "line-clamp-3 overflow-hidden"}`}
                    style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
                  >
                    {liveTranscriptText || (
                      <span className="text-muted-foreground italic">Listening… interim speech appears here</span>
                    )}
                  </div>
                </div>

                {/* Final (Clean) Transcript – authoritative */}
                <div className="p-4 bg-gradient-to-br from-primary/5 to-accent/20 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-foreground uppercase tracking-wide">
                      Final Transcript (Clean)
                    </span>
                    <Badge variant="default" className="text-xs">Finalised chunks</Badge>
                  </div>

                  <div className="mb-2 flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={handleCopyCleaned}>
                      Copy
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleDownloadWord}>
                      Download Word
                    </Button>
                  </div>

                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap min-h-[220px] max-h-[70vh] overflow-y-auto p-3 bg-background/80 rounded-md border"
                    style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
                  >
                    {cleanedTranscript ? (
                      <div className="text-foreground">{cleanedTranscript}</div>
                    ) : (
                      <span className="text-muted-foreground italic">
                        Final transcript will appear here once chunks are confirmed…
                      </span>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground">
                    Updated when chunks are finalised. May lag the live feed by ~1 minute.
                  </div>
                </div>

                {/* Find & Replace Panel for Clean Transcript */}
                {cleanedTranscript && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Find & Replace (misheard names)</Label>
                    <EnhancedFindReplacePanel
                      getCurrentText={() => cleanedTranscript}
                      onApply={(updated) => {
                        setCleanedTranscript(updated);
                        toast({
                          title: "Applied",
                          description: "Find & Replace changes applied successfully."
                        });
                      }}
                    />
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