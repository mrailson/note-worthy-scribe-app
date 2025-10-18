import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Settings, 
  ChevronDown, 
  Users, 
  Monitor, 
  ClipboardPaste,
  Upload,
  FileText,
  Check,
  ChevronsUpDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { FileImporter, ImportedTranscript } from "@/utils/FileImporter";
import { MP3TranscriptionTest } from "@/components/MP3TranscriptionTest";

interface MeetingSettingsProps {
  onSettingsChange: (settings: any) => void;
  onAudioImported?: (audioFile: File) => void;
  onTranscriptImported?: (importedTranscript: ImportedTranscript) => void;
  initialSettings?: {
    title: string;
    description: string;
    meetingType: string;
    practiceId?: string;
  };
}

export const MeetingSettings = ({ onSettingsChange, onAudioImported, onTranscriptImported, initialSettings }: MeetingSettingsProps) => {
  const { user, canViewConsultationExamples } = useAuth();
  const [isOpen, setIsOpen] = useState(true);
  const [isImportingTranscript, setIsImportingTranscript] = useState(false);
  const [practiceSearchOpen, setPracticeSearchOpen] = useState(false);
  const [practices, setPractices] = useState<Array<{id: string, name: string, practice_code: string}>>([]);
  const [userPractices, setUserPractices] = useState<Array<{id: string, name: string}>>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  const [pastedText, setPastedText] = useState("");

  // Function to round time to nearest 15 minutes (London time)
  const roundToNearest15Minutes = (date: Date): Date => {
    const minutes = date.getMinutes();
    const roundedMinutes = Math.round(minutes / 15) * 15;
    const roundedDate = new Date(date);
    roundedDate.setMinutes(roundedMinutes, 0, 0); // Set seconds and milliseconds to 0
    
    // If rounding went to next hour, adjust
    if (roundedMinutes === 60) {
      roundedDate.setHours(roundedDate.getHours() + 1);
      roundedDate.setMinutes(0);
    }
    
    return roundedDate;
  };

  // Generate rounded start time for London timezone
  const generateRoundedStartTime = (): string => {
    const now = new Date();
    const roundedTime = roundToNearest15Minutes(now);
    return format(roundedTime, 'HH:mm');
  };

  const [settings, setSettings] = useState({
    title: initialSettings?.title || "General Meeting",
    description: initialSettings?.description || "",
    meetingType: initialSettings?.meetingType || "general",
    meetingStyle: "standard",
    location: "",
    format: "",
    practiceId: "",
    attendees: "",
    agenda: "",
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: generateRoundedStartTime(),
    transcriberService: "whisper" as "whisper" | "deepgram",
    transcriberThresholds: {
      whisper: 0.30,
      deepgram: 0.80
    }
  });

  // Fetch user's associated practices
  useEffect(() => {
    const fetchUserPractices = async () => {
      if (!user) return;

      try {
        // Get user's practice assignments
        const { data: userRoles, error: rolesError } = await supabase
          .from('user_roles')
          .select(`
            practice_id,
            gp_practices!inner(id, name)
          `)
          .eq('user_id', user.id);

        if (rolesError) {
          console.error('Error fetching user practices:', rolesError);
          return;
        }

        if (userRoles && userRoles.length > 0) {
          const practices = userRoles.map((role: any) => ({
            id: role.practice_id,
            name: role.gp_practices.name
          }));
          
          setUserPractices(practices);
          
          // If only one practice, auto-select it
          if (practices.length === 1) {
            const newSettings = { 
              ...settings, 
              practiceId: practices[0].id,
              location: practices[0].name 
            };
            setSettings(newSettings);
            onSettingsChange(newSettings);
          }
        }
      } catch (error) {
        console.error('Error fetching user practices:', error);
      }
    };

    fetchUserPractices();
  }, [user]);

  // Fetch default practice on mount
  useEffect(() => {
    const fetchDefaultPractice = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('practice_details')
          .select('practice_name')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (error) {
          // No default practice found, which is fine
          return;
        }

        if (data?.practice_name) {
          const newSettings = { ...settings, location: data.practice_name };
          setSettings(newSettings);
          onSettingsChange(newSettings);
        }
      } catch (error) {
        // Silent fail - default practice is optional
        console.log('No default practice found');
      }
    };

    fetchDefaultPractice();
  }, [user]);

  // Fetch practices for search
  useEffect(() => {
    const fetchPractices = async () => {
      const { data, error } = await supabase
        .from('gp_practices')
        .select('id, name, practice_code')
        .order('name');
      
      if (!error && data) {
        setPractices(data);
      }
    };

    fetchPractices();
  }, []);

  const handlePracticeSelect = (practiceName: string) => {
    updateSetting('location', practiceName);
    setPracticeSearchOpen(false);
  };

  const filteredPractices = practices.filter(practice => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    const practiceCode = practice.practice_code.toLowerCase();
    
    // Search by practice name
    if (practice.name.toLowerCase().includes(lowerSearchTerm)) {
      return true;
    }
    
    // Search by full practice code
    if (practiceCode.includes(lowerSearchTerm)) {
      return true;
    }
    
    // If search term starts with 'k', also try without it
    if (lowerSearchTerm.startsWith('k')) {
      const searchWithoutK = lowerSearchTerm.substring(1);
      if (practiceCode.includes(searchWithoutK)) {
        return true;
      }
    }
    
    // If search term doesn't start with 'k', also try with 'k' prefix
    if (!lowerSearchTerm.startsWith('k')) {
      const searchWithK = 'k' + lowerSearchTerm;
      if (practiceCode.includes(searchWithK)) {
        return true;
      }
    }
    
    return false;
  });


  const handleTranscriptImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('📄 Starting file import:', file.name, file.type, `${(file.size / 1024).toFixed(1)}KB`);

    // Check if file is a supported document type
    const supportedTypes = ['.txt', '.doc', '.docx', '.pdf'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!supportedTypes.includes(fileExtension)) {
      toast.error('Please select a valid document file (.txt, .doc, .docx, .pdf)');
      event.target.value = '';
      return;
    }

    setIsImportingTranscript(true);
    try {
      console.log('🔄 Processing file with FileImporter...');
      const importedTranscript = await FileImporter.importTranscriptFile(file);
      console.log('✅ FileImporter completed:', importedTranscript.wordCount, 'words');
      
      // Update settings with extracted data
      if (importedTranscript.extractedSettings) {
        const newSettings = {
          ...settings,
          title: importedTranscript.extractedSettings.title || settings.title,
          description: importedTranscript.extractedSettings.description || settings.description,
          attendees: importedTranscript.extractedSettings.attendees || settings.attendees,
          agenda: importedTranscript.extractedSettings.agenda || settings.agenda,
          date: importedTranscript.extractedSettings.date || settings.date
        };
        setSettings(newSettings);
        onSettingsChange(newSettings);
        console.log('📝 Settings updated with extracted data');
      }

      // Notify parent component about the imported transcript
      if (onTranscriptImported) {
        console.log('📤 Calling onTranscriptImported callback');
        onTranscriptImported(importedTranscript);
      } else {
        console.warn('⚠️ No onTranscriptImported callback provided');
      }

      toast.success(`Transcript imported: ${file.name}${importedTranscript.wordCount ? ` (${importedTranscript.wordCount} words)` : ''}`);
    } catch (error) {
      console.error('❌ Error importing transcript file:', error);
      toast.error(`Failed to import transcript: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsImportingTranscript(false);
      // Reset the input so the same file can be selected again
      event.target.value = '';
    }
  };

  const handlePasteTranscript = () => {
    if (!pastedText.trim()) {
      toast.error('Please paste some transcript content first');
      return;
    }

    try {
      console.log('📋 Processing pasted text:', pastedText.length, 'characters');
      
      // Create an ImportedTranscript object from pasted text
      const wordCount = pastedText.split(/\s+/).filter(word => word.length > 0).length;
      const importedTranscript: ImportedTranscript = {
        content: pastedText.trim(),
        wordCount,
        meetingTitle: 'Pasted Transcript',
        extractedSettings: {
          title: 'Pasted Transcript',
          description: '',
          attendees: '',
          agenda: '',
          date: new Date().toISOString().split('T')[0]
        }
      };

      // Notify parent component about the imported transcript
      if (onTranscriptImported) {
        onTranscriptImported(importedTranscript);
      }

      toast.success(`Transcript pasted successfully (${wordCount} words)`);
      setPastedText('');
      setShowPasteDialog(false);
    } catch (error) {
      console.error('❌ Error processing pasted transcript:', error);
      toast.error('Failed to process pasted transcript');
    }
  };

  const handleTranscriptReceived = (transcriptText: string) => {
    if (!transcriptText) return;

    // Create an ImportedTranscript object with the transcription
    const importedTranscript: ImportedTranscript = {
      content: transcriptText,
      wordCount: transcriptText.split(/\s+/).length,
      extractedSettings: {
        title: 'Audio Recording Transcript',
        description: '',
        attendees: '',
        agenda: '',
        date: format(new Date(), 'yyyy-MM-dd')
      }
    };

    // Notify parent component about the transcribed content
    if (onTranscriptImported) {
      onTranscriptImported(importedTranscript);
    }

    toast.success(`Audio transcribed successfully (${importedTranscript.wordCount} words)`);
  };

  const updateSetting = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  // Auto-switch meeting type if user loses access to patient-consultation
  useEffect(() => {
    if (!canViewConsultationExamples && settings.meetingType === 'patient-consultation') {
      const newSettings = { ...settings, meetingType: 'general' };
      setSettings(newSettings);
      onSettingsChange(newSettings);
      toast.info('Patient meeting type is no longer available. Switched to General Meeting.');
    }
  }, [canViewConsultationExamples]);

  return (
    <Card className="shadow-medium">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Meeting Settings
              </div>
              <ChevronDown 
                className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Meeting Type */}
            <div className="space-y-2">
              <Label htmlFor="meeting-type">Meeting Type</Label>
              <Select value={settings.meetingType} onValueChange={(value) => updateSetting('meetingType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select meeting type" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  <SelectItem value="general">General Meeting</SelectItem>
                  <SelectItem value="clinical-review">Clinical Review</SelectItem>
                  <SelectItem value="federation">Federation</SelectItem>
                  <SelectItem value="gp-partners">GP Partners Meeting</SelectItem>
                  <SelectItem value="icb-meeting">ICB Meeting</SelectItem>
                  <SelectItem value="lmc">LMC</SelectItem>
                  <SelectItem value="locality">Locality</SelectItem>
                  <SelectItem value="neighbourhood-meeting">Neighbourhood Meeting</SelectItem>
                  {canViewConsultationExamples && (
                    <SelectItem value="patient-consultation">Patient Meeting (Complaint Handling or other Administration Reason)</SelectItem>
                  )}
                  <SelectItem value="pcn-meeting">PCN Meeting</SelectItem>
                  <SelectItem value="team-meeting">Team Meeting</SelectItem>
                  <SelectItem value="training">Training Session</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Meeting Style */}
            <div className="space-y-2">
              <Label htmlFor="meeting-style">Meeting Style</Label>
              <Select value={settings.meetingStyle || 'standard'} onValueChange={(value) => updateSetting('meetingStyle', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select meeting style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard NHS Format</SelectItem>
                  <SelectItem value="clinical">Clinical Professional</SelectItem>
                  <SelectItem value="executive">Executive Summary</SelectItem>
                  <SelectItem value="governance">Governance & Compliance</SelectItem>
                  <SelectItem value="collaborative">Collaborative Partnership</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose the formatting style for your meeting minutes
              </p>
            </div>

            {/* Transcription Service */}
            <div className="space-y-2">
              <Label htmlFor="transcriber-service">Transcription Service</Label>
              <Select value={settings.transcriberService} onValueChange={(value) => updateSetting('transcriberService', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select transcription service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whisper">Whisper (OpenAI)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Using Whisper (OpenAI) for high-quality speech-to-text transcription.
              </p>
            </div>

            {/* Confidence Thresholds */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Confidence Threshold</Label>
              <p className="text-xs text-muted-foreground">
                Set minimum confidence level to filter out low-quality transcriptions (0.0 - 1.0)
              </p>
              <div className="space-y-2">
                <Label htmlFor="whisper-threshold" className="text-xs">Whisper Min Confidence</Label>
                <Input
                  id="whisper-threshold"
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.transcriberThresholds?.whisper || 0.30}
                  onChange={(e) => {
                    const newValue = Number(e.target.value);
                    setSettings(prev => ({
                      ...prev,
                      transcriberThresholds: {
                        ...prev.transcriberThresholds,
                        whisper: newValue,
                        deepgram: prev.transcriberThresholds?.deepgram || 0.80
                      }
                    }));
                    onSettingsChange({
                      ...settings,
                      transcriberThresholds: {
                        ...settings.transcriberThresholds,
                        whisper: newValue,
                      }
                    });
                  }}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Meeting Description */}
            <div className="space-y-2">
              <Label htmlFor="meeting-description">Meeting Description</Label>
              <Input
                id="meeting-description"
                placeholder="Enter meeting description"
                value={settings.title}
                onChange={(e) => updateSetting('title', e.target.value)}
              />
            </div>

            {/* Meeting Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="meeting-date">Date</Label>
                <Input
                  id="meeting-date"
                  type="date"
                  value={settings.date}
                  onChange={(e) => updateSetting('date', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={settings.startTime}
                  onChange={(e) => updateSetting('startTime', e.target.value)}
                />
              </div>
            </div>

            {/* Practice Selection - Only show if user has practice assignments */}
            {userPractices.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="practice-selection">Practice</Label>
                <Select 
                  value={settings.practiceId} 
                  onValueChange={(value) => {
                    const selectedPractice = userPractices.find(p => p.id === value);
                    updateSetting('practiceId', value);
                    if (selectedPractice) {
                      updateSetting('location', selectedPractice.name);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select practice for this meeting" />
                  </SelectTrigger>
                  <SelectContent>
                    {userPractices.map((practice) => (
                      <SelectItem key={practice.id} value={practice.id}>
                        {practice.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose which practice this meeting is associated with
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Meeting Format</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant={settings.format === 'face-to-face' ? 'default' : 'outline'}
                  onClick={() => updateSetting('format', 'face-to-face')}
                  className="flex-1 text-xs sm:text-sm"
                >
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Face to Face
                </Button>
                <Button
                  variant={settings.format === 'online' ? 'default' : 'outline'}
                  onClick={() => updateSetting('format', 'online')}
                  className="flex-1 text-xs sm:text-sm"
                >
                  <Monitor className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Teams/Web Meeting
                </Button>
              </div>
            </div>

            {/* Site/Location - Only show for Face to Face meetings */}
            {settings.format === 'face-to-face' && (
              <div className="space-y-2">
                <Label htmlFor="location">Site/Location</Label>
                <Popover open={practiceSearchOpen} onOpenChange={setPracticeSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={practiceSearchOpen}
                      className="w-full justify-between"
                    >
                      {settings.location || "Search by Practice Name or K Code"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput 
                        placeholder="Search by practice name or K code..." 
                        value={searchTerm}
                        onValueChange={setSearchTerm}
                      />
                      <CommandList>
                        <CommandEmpty>No practice found.</CommandEmpty>
                        <CommandGroup>
                          {filteredPractices.map((practice) => (
                            <CommandItem
                              key={practice.id}
                              value={practice.name}
                              onSelect={() => handlePracticeSelect(practice.name)}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  settings.location === practice.name ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              <div>
                                <div className="font-medium">{practice.name}</div>
                                <div className="text-xs text-muted-foreground">{practice.practice_code}</div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {!settings.location && (
                  <p className="text-xs text-muted-foreground">
                    Select your GP practice from the dropdown above
                  </p>
                )}
              </div>
            )}

            {/* Meeting Attendees */}
            <div className="space-y-2">
              <Label htmlFor="attendees">Meeting Attendees</Label>
              <div className="flex flex-col sm:flex-row gap-2 mb-2">
                <Button variant="outline" size="sm" className="flex-1 text-xs sm:text-sm">
                  <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Import from File
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs sm:text-sm">
                  <ClipboardPaste className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Paste from Clipboard
                </Button>
              </div>
              <Textarea
                id="attendees"
                placeholder="Example: Dr. Smith, Nurse Johnson, Admin Manager Brown"
                value={settings.attendees}
                onChange={(e) => updateSetting('attendees', e.target.value)}
                rows={3}
              />
            </div>

            {/* Meeting Agenda */}
            <div className="space-y-2">
              <Label htmlFor="agenda">Meeting Agenda</Label>
              <div className="flex flex-col sm:flex-row gap-2 mb-2">
                <Button variant="outline" size="sm" className="flex-1 text-xs sm:text-sm">
                  <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Import from File
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs sm:text-sm">
                  <ClipboardPaste className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Paste from Clipboard
                </Button>
              </div>
              <Textarea
                id="agenda"
                placeholder="Example:&#10;1. Review of previous actions&#10;2. Financial update&#10;3. Staffing matters&#10;4. Any other business"
                value={settings.agenda}
                onChange={(e) => updateSetting('agenda', e.target.value)}
                rows={5}
              />
            </div>

            {/* Audio Import Section - Enhanced */}
            <div className="space-y-2">
              <Label>Import Audio Recording</Label>
              <MP3TranscriptionTest onTranscriptReceived={handleTranscriptReceived} />
            </div>

            {/* Transcript Import Section */}
            <div className="space-y-4">
              <Label htmlFor="transcript-import">Import Existing Transcript</Label>
              
              {/* File Import */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <label htmlFor="transcript-import-file" className="flex-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full cursor-pointer"
                      disabled={isImportingTranscript}
                      asChild
                    >
                      <span>
                        <FileText className="h-4 w-4 mr-2" />
                        {isImportingTranscript ? 'Importing...' : 'Import File (.txt, .doc, .docx)'}
                      </span>
                    </Button>
                  </label>
                  <input
                    id="transcript-import-file"
                    type="file"
                    accept=".txt,.doc,.docx,.pdf"
                    onChange={handleTranscriptImport}
                    className="hidden"
                  />
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPasteDialog(true)}
                    className="flex-shrink-0"
                  >
                    <ClipboardPaste className="h-4 w-4 mr-2" />
                    Paste Text
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Import from file or paste transcript text directly. Files will auto-extract meeting details.
                </p>
              </div>

              {/* Paste Dialog */}
              {showPasteDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-background p-6 rounded-lg shadow-lg w-full max-w-2xl mx-4">
                    <h3 className="text-lg font-semibold mb-4">Paste Transcript Text</h3>
                    <textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Paste your transcript text here..."
                      className="w-full h-64 p-3 border rounded-md resize-none"
                      autoFocus
                    />
                    <div className="flex gap-2 mt-4">
                      <Button
                        onClick={handlePasteTranscript}
                        disabled={!pastedText.trim()}
                        className="flex-1"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Import Transcript ({pastedText.split(/\s+/).filter(w => w.length > 0).length} words)
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowPasteDialog(false);
                          setPastedText('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};