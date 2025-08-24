import { useState, useEffect, useMemo } from "react";
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
  };
  onMeetingSettingsChange?: (settings: { practiceId: string; meetingFormat: string; transcriberService?: 'whisper' | 'deepgram' }) => void;
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

  // Subscribe to transcription chunks for AI enhancement updates
  useEffect(() => {
    if (!user?.id) return;

    const currentSessionId = sessionStorage.getItem('currentSessionId');
    if (!currentSessionId) return;

    console.log('🔄 Setting up transcription chunks subscription for session:', currentSessionId);

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
          const chunk = payload.new;
          if (chunk.transcription_text) {
            // Apply medical corrections if loaded
            let processedText = chunk.transcription_text;
            if (isMedicalCorrectionsLoaded && medicalTermCorrector.hasCorrections()) {
              processedText = medicalTermCorrector.applyCorrections(processedText);
            }
            
            // Update cleaned transcript with new chunk using overlap-aware cleaner
            setCleanedTranscript(prev => {
              const newText = transcriptCleaner.cleanStreamingAppend(prev, processedText, chunk.confidence_score ?? undefined);
              console.log('✨ Updated AI enhanced transcript with cleaned chunk (length:', newText.length, ')');
              return newText;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isMedicalCorrectionsLoaded]);

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

  // Update live transcript text when transcript prop changes (RAW TRANSCRIPT ONLY)
  useEffect(() => {
    if (transcript && transcript.trim()) {
      let processedTranscript = filterSystemMessages(transcript);
      
      // Apply medical term corrections if loaded
      if (isMedicalCorrectionsLoaded && medicalTermCorrector.hasCorrections()) {
        processedTranscript = medicalTermCorrector.applyCorrections(processedTranscript);
      }
      
      console.log('🔄 Processing raw transcript update (length:', processedTranscript.length, ')');
      
      // Always keep the full transcript history - no clearing
      // ONLY update liveTranscriptText, NOT cleanedTranscript (which is handled by AI chunks subscription)
      if (isAutoCleaningEnabled) {
        // Use streaming cleaner with confidence filtering for live display
        const cleanedNew = transcriptCleaner.cleanStreamingAppend(liveTranscriptText, processedTranscript, confidence);
        setLiveTranscriptText(cleanedNew); // Show cleaned version for live display
        console.log('✨ Updated live transcript with cleaned version (length:', cleanedNew.length, ')');
      } else {
        setLiveTranscriptText(processedTranscript); // Show processed version
        console.log('📝 Updated live transcript with raw version (length:', processedTranscript.length, ')');
      }
    }
    // NEVER clear liveTranscriptText - always preserve transcript history
    // NEVER update cleanedTranscript here - only AI chunks subscription should do that
  }, [transcript, isAutoCleaningEnabled, isMedicalCorrectionsLoaded]);

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
    const base = cleanedTranscript || transcript || "";
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
      const content = getFormattedCleanedText();

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
              new Paragraph({ text: "AI-Enhanced Transcript", heading: HeadingLevel.HEADING_1 }),
              ...paragraphs,
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const fileName = `Cleaned-Transcript-${new Date().toISOString().slice(0, 10)}.docx`;
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
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        id="timestamps-toggle"
                        checked={showTimestamps}
                        onCheckedChange={onTimestampsToggle}
                      />
                      <Label htmlFor="timestamps-toggle" className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        Show Timestamps
                      </Label>
                    </div>
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

                  {(cleanedTranscript || (transcript && isAutoCleaningEnabled)) && (
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

                  {/* Action buttons */}
                  <div className="mb-2 flex items-center gap-2 flex-wrap">
                    {/* Copy and Download buttons (always visible when transcript exists) */}
                    <>
                      <Button size="sm" variant="outline" onClick={handleCopyCleaned}>
                        <Copy className="h-4 w-4 mr-2" /> Copy Cleaned
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleDownloadWord}>
                        <FileDown className="h-4 w-4 mr-2" /> Download Word
                      </Button>
                    </>
                    
                    {/* Edit controls */}
                    {!isEditingCleaned ? (
                      <Button size="sm" variant="outline" onClick={() => { setIsEditingCleaned(true); setEditedCleanedText(getFormattedCleanedText()); }}>
                        <Edit3 className="h-4 w-4 mr-2" /> Edit
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => { setCleanedTranscript(editedCleanedText); setIsEditingCleaned(false); setLiveTranscriptText(editedCleanedText); try { localStorage.setItem('cleanedTranscriptDraft', editedCleanedText); } catch (e) {} toast({ title: "Saved", description: "Transcript updated." }); }}>
                          <Check className="h-4 w-4 mr-2" /> Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setIsEditingCleaned(false)}>
                          <X className="h-4 w-4 mr-2" /> Cancel
                        </Button>
                      </>
                    )}
                  </div>
                  
                   <div 
                     className="text-sm leading-relaxed whitespace-pre-wrap min-h-[200px] max-h-[80vh] overflow-y-auto p-4 bg-background/80 rounded-md border border-primary/10 shadow-sm select-text cursor-text scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40"
                     style={{ 
                       transition: 'all 0.2s ease-in-out',
                       wordWrap: 'break-word',
                       overflowWrap: 'break-word',
                       userSelect: 'text',
                       scrollbarWidth: 'thin'
                     }}
                     onMouseUp={handleTextSelection}
                   >
                    {isEditingCleaned ? (
                      <Textarea
                        value={editedCleanedText}
                        onChange={(e) => setEditedCleanedText(e.target.value)}
                        rows={12}
                      />
                    ) : (cleanedTranscript || (transcript && isAutoCleaningEnabled)) ? (
                      <div className="space-y-2">
                        <div className="text-foreground leading-relaxed whitespace-pre-wrap">
                          {showTimestamps ? (
                            // Display with timestamps - split by sentences and add timestamps
                            (cleanedTranscript || transcript).split(/[.!?]+/).filter(s => s.trim()).map((sentence, index) => {
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
                            })
                          ) : (
                            // Display without timestamps - show full accumulated transcript
                            <div className="text-foreground leading-relaxed">
                              {cleanedTranscript || transcript}
                            </div>
                          )}
                         </div>
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

                {/* Find & Replace Panel */}
                {(cleanedTranscript || transcript) && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Find & Replace (misheard names)</Label>
                    <EnhancedFindReplacePanel
                      getCurrentText={() => getFormattedCleanedText()}
                      onApply={(updated) => {
                        setCleanedTranscript(updated);
                        setLiveTranscriptText(updated);
                        if (isEditingCleaned) setEditedCleanedText(updated);
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