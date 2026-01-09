import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  FileText, 
  Users, 
  Calendar,
  MapPin,
  Plus,
  Save,
  RefreshCw,
  Loader2,
  Upload,
  Mic,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { SpeechToText } from "@/components/SpeechToText";
import { supabase } from "@/integrations/supabase/client";
import { showToast } from '@/utils/toastWrapper';
import { SimpleFileUpload } from "@/components/SimpleFileUpload";
import { useFileUpload } from "@/hooks/useFileUpload";
import { FileUploadArea } from "@/components/ai4gp/FileUploadArea";
import type { UploadedFile } from "@/types/ai4gp";

interface MeetingContextEnhancerProps {
  meetingId: string;
  currentMeeting?: {
    title: string;
    agenda?: string;
    participants?: string[];
    meeting_location?: string;
    meeting_format?: string;
  };
  onMeetingUpdate?: (updatedData: any) => void;
}

export function MeetingContextEnhancer({ 
  meetingId, 
  currentMeeting,
  onMeetingUpdate
}: MeetingContextEnhancerProps) {
  const [agenda, setAgenda] = useState(currentMeeting?.agenda || "");
  const [additionalContext, setAdditionalContext] = useState("");
  const [additionalTranscript, setAdditionalTranscript] = useState("");
  const [attendees, setAttendees] = useState((currentMeeting?.participants || []).join(", "));
  const [meetingLocation, setMeetingLocation] = useState(currentMeeting?.meeting_location || "");
  const [meetingFormat, setMeetingFormat] = useState(currentMeeting?.meeting_format || "");
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [agendaFiles, setAgendaFiles] = useState<UploadedFile[]>([]);
  const [contextFiles, setContextFiles] = useState<UploadedFile[]>([]);
  const [meetingDetailsOpen, setMeetingDetailsOpen] = useState(false);
  const [additionalContentOpen, setAdditionalContentOpen] = useState(false);
  
  const { processFiles, isProcessing } = useFileUpload();

  const contextOptions = [
    { 
      id: 'add-agenda', 
      label: 'Update Agenda', 
      description: 'Add or update meeting agenda items',
      icon: FileText,
      field: 'agenda'
    },
    { 
      id: 'add-context', 
      label: 'Add Context Notes', 
      description: 'Additional meeting context or background',
      icon: Plus,
      field: 'context'
    },
    { 
      id: 'append-transcript', 
      label: 'Append Transcript', 
      description: 'Add additional transcript content',
      icon: Upload,
      field: 'transcript'
    },
    { 
      id: 'update-attendees', 
      label: 'Update Attendees', 
      description: 'Add or modify attendee list',
      icon: Users,
      field: 'attendees'
    },
    { 
      id: 'set-location', 
      label: 'Meeting Location', 
      description: 'Set meeting location or format',
      icon: MapPin,
      field: 'location'
    }
  ];

  const handleSpeechInput = (text: string, field: string) => {
    switch (field) {
      case 'agenda':
        setAgenda(prev => prev ? `${prev}\n${text}` : text);
        break;
      case 'context':
        setAdditionalContext(prev => prev ? `${prev} ${text}` : text);
        break;
      case 'transcript':
        setAdditionalTranscript(prev => prev ? `${prev} ${text}` : text);
        break;
      case 'attendees':
        setAttendees(prev => prev ? `${prev}, ${text}` : text);
        break;
      case 'location':
        setMeetingLocation(text);
        break;
    }
    showToast.success("Speech added successfully", { section: 'meeting_manager' });
  };

  const handleAgendaUpload = async (files: File[]) => {
    try {
      const processedFiles = await processFiles(files as unknown as FileList);
      setAgendaFiles(prev => [...prev, ...processedFiles]);
    } catch (error) {
      console.error('Error processing agenda files:', error);
    }
  };

  const handleContextUpload = async (files: File[]) => {
    try {
      const processedFiles = await processFiles(files as unknown as FileList);
      setContextFiles(prev => [...prev, ...processedFiles]);
    } catch (error) {
      console.error('Error processing context files:', error);
    }
  };

  const removeAgendaFile = (index: number) => {
    setAgendaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeContextFile = (index: number) => {
    setContextFiles(prev => prev.filter((_, i) => i !== index));
  };

  const saveContextChanges = async () => {
    if (!meetingId) {
      return;
    }

    setIsSaving(true);
    
    try {
      // Prepare update data
      const updateData: any = {};
      
      if (agenda !== (currentMeeting?.agenda || "")) {
        updateData.agenda = agenda;
      }
      
      if (attendees !== (currentMeeting?.participants || []).join(", ")) {
        updateData.participants = attendees.split(",").map(a => a.trim()).filter(a => a);
      }
      
      if (meetingLocation !== (currentMeeting?.meeting_location || "")) {
        updateData.meeting_location = meetingLocation;
      }
      
      if (meetingFormat !== (currentMeeting?.meeting_format || "")) {
        updateData.meeting_format = meetingFormat;
      }

      // Update meeting in database
      const { error: updateError } = await supabase
        .from('meetings')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', meetingId);

      if (updateError) throw updateError;

      // If there's additional context, store it as a note
      if (additionalContext.trim()) {
        // Store additional context directly in the meetings table
        const contextUpdate = { 
          additional_context: additionalContext.trim(),
          updated_at: new Date().toISOString()
        };
        
        const { error: contextError } = await supabase
          .from('meetings')
          .update(contextUpdate)
          .eq('id', meetingId);
        
        if (contextError) console.warn('Failed to save additional context:', contextError);
      }

      if (additionalTranscript.trim()) {
        // Save additional transcript as a new transcript chunk
        const { error: transcriptError } = await supabase
          .from('meeting_transcripts')
          .insert({
            meeting_id: meetingId,
            content: additionalTranscript,
            created_at: new Date().toISOString()
          });
        
        if (transcriptError) console.warn('Failed to save additional transcript:', transcriptError);
      }
      
      if (onMeetingUpdate) {
        onMeetingUpdate({
          ...currentMeeting,
          ...updateData
        });
      }

      // Clear additional fields after saving
      setAdditionalContext("");
      setAdditionalTranscript("");
      
    } catch (error) {
      console.error('Error updating meeting context:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const regenerateNotesWithContext = async () => {
    if (!meetingId) {
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('generate-multi-type-notes', {
        body: {
          meetingId,
          forceRegenerate: true,
          includeContext: true
        }
      });

      if (error) throw error;
      
      showToast.success("Notes regeneration started with updated context", { section: 'meeting_manager' });
    } catch (error) {
      console.error('Error regenerating notes:', error);
      showToast.error('Failed to regenerate notes with context', { section: 'meeting_manager' });
    }
  };

  const hasChanges = () => {
    return agenda !== (currentMeeting?.agenda || "") ||
           attendees !== (currentMeeting?.participants || []).join(", ") ||
           meetingLocation !== (currentMeeting?.meeting_location || "") ||
           meetingFormat !== (currentMeeting?.meeting_format || "") ||
           additionalContext.trim() !== "" ||
           additionalTranscript.trim() !== "" ||
           agendaFiles.length > 0 ||
           contextFiles.length > 0;
  };

  return (
    <div className="space-y-4">
      {/* Meeting Details - Collapsible */}
      <Collapsible open={meetingDetailsOpen} onOpenChange={setMeetingDetailsOpen}>
        <Card>
          <CardHeader className="pb-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                <div className="flex items-center justify-between w-full">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5" />
                    Meeting Details
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {hasChanges() && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Unsaved Changes
                      </Badge>
                    )}
                    {meetingDetailsOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Agenda */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="agenda">Meeting Agenda</Label>
                  <SpeechToText 
                    onTranscription={(text) => handleSpeechInput(text, 'agenda')}
                    size="sm"
                    className="h-8"
                  />
                </div>
                <Textarea
                  id="agenda"
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  placeholder="Enter meeting agenda items..."
                  className="min-h-[80px]"
                />
                
                {/* Agenda Document Upload */}
                <div className="mt-2">
                  <SimpleFileUpload 
                    onFileUpload={handleAgendaUpload}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.tiff,.tif"
                    maxSize={10}
                    multiple={true}
                    className="text-sm"
                  />
                  {agendaFiles.length > 0 && (
                    <div className="mt-2">
                      <FileUploadArea 
                        uploadedFiles={agendaFiles}
                        onRemoveFile={removeAgendaFile}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Attendees */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="attendees">Attendees</Label>
                  <SpeechToText 
                    onTranscription={(text) => handleSpeechInput(text, 'attendees')}
                    size="sm"
                    className="h-8"
                  />
                </div>
                <Input
                  id="attendees"
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                  placeholder="Dr. Smith, Practice Manager, ..."
                />
              </div>

              {/* Location & Format */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="location">Location</Label>
                    <SpeechToText 
                      onTranscription={(text) => handleSpeechInput(text, 'location')}
                      size="sm"
                      className="h-8"
                    />
                  </div>
                  <Input
                    id="location"
                    value={meetingLocation}
                    onChange={(e) => setMeetingLocation(e.target.value)}
                    placeholder="Meeting room, online, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="format">Format</Label>
                  <Input
                    id="format"
                    value={meetingFormat}
                    onChange={(e) => setMeetingFormat(e.target.value)}
                    placeholder="Face-to-face, online, hybrid"
                  />
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Additional Content - Collapsible */}
      <Collapsible open={additionalContentOpen} onOpenChange={setAdditionalContentOpen}>
        <Card>
          <CardHeader className="pb-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                <div className="flex items-center justify-between w-full">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Plus className="h-5 w-5" />
                    Additional Content
                  </CardTitle>
                  {additionalContentOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </div>
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Additional Context */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="context">Additional Context Notes</Label>
                  <SpeechToText 
                    onTranscription={(text) => handleSpeechInput(text, 'context')}
                    size="sm"
                    className="h-8"
                  />
                </div>
                <Textarea
                  id="context"
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="Add background information, context, or notes..."
                  className="min-h-[80px]"
                />
                
                {/* Context Document Upload */}
                <div className="mt-2">
                  <SimpleFileUpload 
                    onFileUpload={handleContextUpload}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.tiff,.tif"
                    maxSize={10}
                    multiple={true}
                    className="text-sm"
                  />
                  {contextFiles.length > 0 && (
                    <div className="mt-2">
                      <FileUploadArea 
                        uploadedFiles={contextFiles}
                        onRemoveFile={removeContextFile}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Transcript */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="transcript">Additional Transcript</Label>
                  <SpeechToText 
                    onTranscription={(text) => handleSpeechInput(text, 'transcript')}
                    size="sm"
                    className="h-8"
                  />
                </div>
                <Textarea
                  id="transcript"
                  value={additionalTranscript}
                  onChange={(e) => setAdditionalTranscript(e.target.value)}
                  placeholder="Add additional transcript content to combine with existing..."
                  className="min-h-[80px]"
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          onClick={saveContextChanges}
          disabled={!hasChanges() || isSaving}
          className="flex-1"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
        <Button
          onClick={regenerateNotesWithContext}
          variant="outline"
          disabled={!hasChanges() || isSaving}
          className="flex-1"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Save & Regenerate Notes
        </Button>
      </div>
    </div>
  );
}