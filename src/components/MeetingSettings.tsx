import { useState, useEffect } from "react";
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
  Mic,
  FileText,
  Check,
  ChevronsUpDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { FileImporter, ImportedTranscript } from "@/utils/FileImporter";

interface MeetingSettingsProps {
  onSettingsChange: (settings: any) => void;
  onAudioImported?: (audioFile: File) => void;
  onTranscriptImported?: (importedTranscript: ImportedTranscript) => void;
  initialSettings?: {
    title: string;
    description: string;
    meetingType: string;
  };
}

export const MeetingSettings = ({ onSettingsChange, onAudioImported, onTranscriptImported, initialSettings }: MeetingSettingsProps) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingTranscript, setIsImportingTranscript] = useState(false);
  const [practiceSearchOpen, setPracticeSearchOpen] = useState(false);
  const [practices, setPractices] = useState<Array<{id: string, name: string, practice_code: string}>>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [settings, setSettings] = useState({
    title: initialSettings?.title || "General Meeting",
    description: initialSettings?.description || "",
    meetingType: initialSettings?.meetingType || "general",
    meetingStyle: "standard",
    location: "",
    format: "",
    attendees: "",
    agenda: "",
    date: new Date().toISOString().split('T')[0],
    startTime: new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' })
  });

  // Fetch default practice on mount
  useEffect(() => {
    const fetchDefaultPractice = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('practice_details')
          .select('practice_name')
          .eq('user_id', user.id)
          .eq('is_default', true)
          .single();

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

  const handleAudioImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if file is audio
    if (!file.type.startsWith('audio/')) {
      toast.error('Please select a valid audio file');
      event.target.value = '';
      return;
    }

    setIsImporting(true);
    try {
      // Notify parent component about the imported audio
      if (onAudioImported) {
        onAudioImported(file);
      }

      toast.success(`Audio file imported: ${file.name}`);
    } catch (error) {
      console.error('Error importing audio file:', error);
      toast.error(`Failed to import audio file: ${error}`);
    } finally {
      setIsImporting(false);
      // Reset the input so the same file can be selected again
      event.target.value = '';
    }
  };

  const handleTranscriptImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
      const importedTranscript = await FileImporter.importTranscriptFile(file);
      
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
      }

      // Notify parent component about the imported transcript
      if (onTranscriptImported) {
        onTranscriptImported(importedTranscript);
      }

      toast.success(`Transcript imported: ${file.name}${importedTranscript.wordCount ? ` (${importedTranscript.wordCount} words)` : ''}`);
    } catch (error) {
      console.error('Error importing transcript file:', error);
      toast.error(`Failed to import transcript: ${error}`);
    } finally {
      setIsImportingTranscript(false);
      // Reset the input so the same file can be selected again
      event.target.value = '';
    }
  };

  const updateSetting = (key: string, value: string) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

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
                  <SelectItem value="patient-consultation">Patient Meeting (Complaint Handling or other Administration Reason)</SelectItem>
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

            {/* Meeting Format */}
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

            {/* Audio Import Section */}
            <div className="space-y-2">
              <Label htmlFor="audio-import">Import Audio Recording</Label>
              <div className="flex gap-2 mb-2">
                <label htmlFor="audio-import-file" className="flex-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full cursor-pointer"
                    disabled={isImporting}
                    asChild
                  >
                    <span>
                      <Mic className="h-4 w-4 mr-2" />
                      {isImporting ? 'Importing...' : 'Import Audio File'}
                    </span>
                  </Button>
                </label>
                <input
                  id="audio-import-file"
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.mp4,.webm"
                  onChange={handleAudioImport}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Supports MP3, WAV, M4A, MP4, and WebM audio formats
              </p>
            </div>

            {/* Transcript Import Section */}
            <div className="space-y-2">
              <Label htmlFor="transcript-import">Import Existing Transcript</Label>
              <div className="flex gap-2 mb-2">
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
                      {isImportingTranscript ? 'Importing...' : 'Import Transcript File'}
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
              </div>
              <p className="text-xs text-muted-foreground">
                Supports TXT, DOC, DOCX, and PDF files. Will automatically extract meeting details like title, attendees, and agenda.
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};