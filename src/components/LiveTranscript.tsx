import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { transcriptCleaner } from "@/utils/TranscriptCleaner";
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
  ChevronUp,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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
  };
  onMeetingSettingsChange?: (settings: { practiceId: string; meetingFormat: string }) => void;
  defaultOpen?: boolean;
  onCleanedTranscriptChange?: (cleanedText: string) => void; // New callback prop
}

export const LiveTranscript = ({ 
  transcript, 
  confidence,
  showTimestamps, 
  onTimestampsToggle,
  attendees,
  meetingSettings,
  onMeetingSettingsChange,
  defaultOpen,
  onCleanedTranscriptChange
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
  
  // NEW: Growing raw transcript that accumulates all segments
  const [growingRawTranscript, setGrowingRawTranscript] = useState<string>("");
  
  // Modal state for Latest Transcription
  const [isLatestTranscriptModalOpen, setIsLatestTranscriptModalOpen] = useState(false);
  
  // Meeting settings state
  const { user } = useAuth();
  const { toast } = useToast();
  const [practices, setPractices] = useState<Array<{id: string, name: string}>>([]);
  const [practiceSearchOpen, setPracticeSearchOpen] = useState(false);

  // Editing state for cleaned transcript
  const [isEditingCleaned, setIsEditingCleaned] = useState(false);
  const [editedCleanedText, setEditedCleanedText] = useState("");
  
  // Separate timestamp toggle for copy/download functions
  const [showTimestampsInCopy, setShowTimestampsInCopy] = useState(true);
  
  // Scroll refs for auto-scroll functionality
  const latestTranscriptRef = useRef<HTMLDivElement>(null);
  const enhancedTranscriptRef = useRef<HTMLDivElement>(null);
  
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
            
            // Update cleaned transcript with new chunk
            setCleanedTranscript(prev => {
              const newText = prev + (prev ? ' ' : '') + processedText;
              console.log('✨ Updated AI enhanced transcript with new chunk');
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

  // Update live transcript text when transcript prop changes
  useEffect(() => {
    if (transcript && transcript.trim()) {
      let processedTranscript = transcript;
      
      // Apply medical term corrections if loaded
      if (isMedicalCorrectionsLoaded && medicalTermCorrector.hasCorrections()) {
        processedTranscript = medicalTermCorrector.applyCorrections(transcript);
      }
      
      console.log('🚨 DEBUG: Processing new transcript');
      console.log('🚨 DEBUG: Raw transcript length:', transcript.length);
      console.log('🚨 DEBUG: Processed transcript length:', processedTranscript.length);
      
      // APPEND new transcript content to growing raw transcript
      setGrowingRawTranscript(prev => {
        // If no previous content, use the new transcript
        if (!prev) return transcript;
        
        // If the new transcript is exactly the same as previous, don't duplicate
        if (prev === transcript) return prev;
        
        // If the new transcript contains the previous content plus more, replace completely
        if (transcript.includes(prev) && transcript.length > prev.length) {
          return transcript;
        }
        
        // Otherwise, append new content with a space (it's a new chunk)
        return prev + ' ' + transcript;
      });
      
      // FIXED: Don't use streaming cleaner that accumulates - replace the entire cleaned transcript
      if (isAutoCleaningEnabled) {
        // Clean the entire processed transcript fresh each time
        const cleanedNew = transcriptCleaner.cleanTranscript(processedTranscript, {
          removeHallucinations: true,
          fixGrammar: true,
          addPunctuation: true,
          removeFiller: false,
          mergeFragments: true
        });
        
        console.log('🚨 DEBUG: Cleaned transcript length:', cleanedNew.length);
        setCleanedTranscript(cleanedNew);
        setLiveTranscriptText(cleanedNew); // Show cleaned version
      } else {
        setLiveTranscriptText(processedTranscript); // Show processed version
      }
    }
    // NEVER clear liveTranscriptText - always preserve transcript history
  }, [transcript, isAutoCleaningEnabled, isMedicalCorrectionsLoaded]);

  // Notify parent when cleaned transcript changes with formatted version
  useEffect(() => {
    if (onCleanedTranscriptChange && cleanedTranscript) {
      // Send formatted transcript that matches what users see in the display
      const formattedTranscript = getFormattedTranscriptForHistory();
      console.log('🚨 DEBUG: Sending formatted transcript to parent');
      console.log('🚨 DEBUG: Cleaned transcript length:', cleanedTranscript.length);
      console.log('🚨 DEBUG: Formatted transcript length:', formattedTranscript.length);
      console.log('🚨 DEBUG: Formatted preview:', formattedTranscript.substring(0, 200) + '...');
      onCleanedTranscriptChange(formattedTranscript);
    }
  }, [cleanedTranscript, onCleanedTranscriptChange, showTimestampsInCopy]);

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
    return text.split(/[.!?]+/).filter(s => s.trim()).map(s => s.trim() + '.').join('\n\n');
  };

  // Format transcript for copy/download - get the COMPLETE displayed content
  const getFormattedCleanedText = () => {
    // Get the exact same content that's displayed in the AI-Enhanced section
    const sourceText = cleanedTranscript || transcript || "";
    if (!sourceText) {
      console.log('🚨 DEBUG: No source text available for copy/download');
      return "";
    }

    console.log('🔍 DEBUG: Formatting transcript for copy/download');
    console.log('🔍 DEBUG: Source text length:', sourceText.length);
    console.log('🔍 DEBUG: Source text preview:', sourceText.substring(0, 200) + '...');
    console.log('🔍 DEBUG: showTimestampsInCopy:', showTimestampsInCopy);

    // Return the complete source text with proper formatting
    if (showTimestampsInCopy) {
      // Simple format with single timestamp at start
      const timeStr = new Date().toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      const formatted = `[${timeStr}] Recording started\n\n${sourceText}`;
      
      console.log('🔍 DEBUG: Formatted with timestamp length:', formatted.length);
      return formatted;
    } else {
      // Return complete source text as-is
      console.log('🔍 DEBUG: Formatted without timestamps length:', sourceText.length);
      return sourceText;
    }
  };

  // Format transcript for meeting history (always with timestamps for professional records)
  const getFormattedTranscriptForHistory = () => {
    const sourceText = cleanedTranscript || transcript || "";
    if (!sourceText) return "";

    console.log('🔍 Formatting transcript for meeting history:', sourceText.length, 'chars');

    // Simple format with single timestamp at start for professional documentation
    const timeStr = new Date().toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    return `[${timeStr}] Recording started\n\n${sourceText}`;
  };

  // Build simple HTML preserving paragraph spacing
  // Auto-scroll to bottom when transcript updates
  useEffect(() => {
    if (latestTranscriptRef.current && growingRawTranscript) {
      latestTranscriptRef.current.scrollTop = latestTranscriptRef.current.scrollHeight;
    }
  }, [growingRawTranscript]);

  useEffect(() => {
    if (enhancedTranscriptRef.current && cleanedTranscript) {
      enhancedTranscriptRef.current.scrollTop = enhancedTranscriptRef.current.scrollHeight;
    }
  }, [cleanedTranscript]);

  // Copy raw transcript function
  const handleCopyRawTranscript = async () => {
    try {
      const textToCopy = transcript || 'No transcript available';
      await navigator.clipboard.writeText(textToCopy);
      toast({ title: "Copied", description: "Raw transcript copied to clipboard." });
    } catch (error) {
      toast({ title: "Copy failed", description: "Could not copy to clipboard.", variant: "destructive" });
    }
  };

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
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Latest Transcription
                      </span>
                      <Badge variant="outline" className="text-xs">Raw</Badge>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setIsLatestTranscriptModalOpen(true)}
                      className="text-xs"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      View Full
                    </Button>
                  </div>
                  
                  <div className="text-sm leading-relaxed whitespace-pre-wrap min-h-[60px] h-[2500px] overflow-y-auto p-3 bg-background/50 rounded-md border relative">
                    {growingRawTranscript ? (
                      <span className="text-foreground font-mono">
                        {growingRawTranscript}
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
                     {/* Timestamp toggle for copy/download */}
                     <Button 
                       size="sm" 
                       variant={showTimestampsInCopy ? "default" : "outline"}
                       onClick={() => setShowTimestampsInCopy(!showTimestampsInCopy)}
                     >
                       <Clock className="h-4 w-4 mr-2" />
                       {showTimestampsInCopy ? 'Hide' : 'Show'} Timestamps
                     </Button>
                     
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
                     ref={enhancedTranscriptRef}
                     className="text-sm leading-relaxed whitespace-pre-wrap min-h-[200px] max-h-96 lg:max-h-[32rem] overflow-y-auto p-4 bg-background/80 rounded-md border border-primary/10 shadow-sm select-text cursor-text scroll-smooth scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40"
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
                             // Display with single timestamp at start
                             <div className="space-y-3">
                               <div className="flex items-center gap-3 p-2 bg-accent/20 rounded-md">
                                 <div className="flex items-center gap-2">
                                   <Clock className="h-3 w-3 text-primary/70" />
                                   <Badge variant="outline" className="text-xs px-2 py-0.5 font-mono">
                                     {new Date().toLocaleTimeString('en-GB', { 
                                       hour: '2-digit', 
                                       minute: '2-digit' 
                                     })}
                                   </Badge>
                                 </div>
                                 <span className="text-xs text-muted-foreground">Recording started</span>
                               </div>
                               <div className="text-foreground leading-relaxed pl-4">
                                 {/* Use the same text that's used for copy/download to ensure consistency */}
                                 {cleanedTranscript || transcript}
                               </div>
                             </div>
                           ) : (
                             // Display without timestamps - show full transcript
                             <div className="text-foreground leading-relaxed">
                               {/* Ensure we show the exact same content that gets copied/downloaded */}
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

      {/* Raw Transcript Backup - Separate Card */}
      {growingRawTranscript && (
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span>Raw Transcript Backup</span>
              <Badge variant="outline" className="text-xs">Complete Record</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Complete unprocessed transcription accumulating all segments for reference and backup purposes
              </div>
              <div className="p-4 bg-muted/30 rounded-lg border border-muted">
                <div className="text-sm font-mono text-foreground whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                  {growingRawTranscript}
                </div>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span>Total characters: {growingRawTranscript.length}</span>
                <span>•</span>
                <span>Words: ~{growingRawTranscript.split(/\s+/).length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Latest Transcription Modal */}
      <Dialog open={isLatestTranscriptModalOpen} onOpenChange={setIsLatestTranscriptModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              Latest Transcription (Raw)
              <Badge variant="outline" className="text-xs">Live</Badge>
            </DialogTitle>
            <DialogDescription>
              Full meeting transcript with all historic content - scroll to see everything from the beginning
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex gap-2 mb-4">
            <Button size="sm" variant="outline" onClick={handleCopyRawTranscript}>
              <Copy className="h-4 w-4 mr-2" />
              Copy All Text
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                if (latestTranscriptRef.current) {
                  latestTranscriptRef.current.scrollTop = latestTranscriptRef.current.scrollHeight;
                }
              }}
            >
              <ChevronDown className="h-4 w-4 mr-2" />
              Jump to Latest
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                if (latestTranscriptRef.current) {
                  latestTranscriptRef.current.scrollTop = 0;
                }
              }}
            >
              <ChevronUp className="h-4 w-4 mr-2" />
              Jump to Start
            </Button>
          </div>

          <div 
            ref={latestTranscriptRef}
            className="h-96 overflow-y-auto p-4 bg-background/50 rounded-md border scroll-smooth font-mono text-sm leading-relaxed whitespace-pre-wrap select-text"
            style={{ 
              scrollbarWidth: 'thin',
              wordWrap: 'break-word',
              overflowWrap: 'break-word'
            }}
          >
            {growingRawTranscript ? (
              <div className="text-foreground">
                {growingRawTranscript}
              </div>
            ) : (
              <div className="text-muted-foreground italic text-center py-8">
                No transcript available yet. Start recording to see content here.
              </div>
            )}
          </div>
          
          {confidence && (
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span>Confidence: {Math.round(confidence * 100)}%</span>
              <span>Length: {growingRawTranscript?.length || 0} characters</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};