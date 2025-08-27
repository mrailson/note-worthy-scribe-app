import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Users, FileText, Upload, Wand2, MapPin, Video, UserCheck } from "lucide-react";
import { AttendeeManager } from "@/components/AttendeeManager";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useDashboard } from "../utils/DashboardContext";
import { cn } from "@/lib/utils";

export const MeetingSetupTab = () => {
  const { meetingConfig, updateMeetingConfig } = useDashboard();
  const { processFiles, isProcessing } = useFileUpload();
  const [showAttendeeManager, setShowAttendeeManager] = useState(false);
  const [agendaPreview, setAgendaPreview] = useState("");

  const handleTitleChange = (title: string) => {
    // Enforce 100 character limit
    if (title.length <= 100) {
      updateMeetingConfig({ title });
    }
  };

  const handleAgendaUpload = useCallback(async (files: FileList) => {
    try {
      const processedFiles = await processFiles(files);
      
      // Extract text content from processed files
      let combinedAgenda = "";
      processedFiles.forEach(file => {
        // Extract plain text from various file formats
        let content = file.content;
        
        // Extract clean text from other formats including OCR results
        if (content.startsWith('EXTRACTED_TEXT_FROM_IMAGE[')) {
          // Handle OCR extracted text
          const textStart = content.indexOf(':\n\n') + 3;
          const textEnd = content.lastIndexOf('\n\n[End of extracted text from');
          if (textStart !== -1 && textEnd !== -1) {
            combinedAgenda += content.substring(textStart, textEnd) + "\n\n";
          } else {
            combinedAgenda += content + "\n\n";
          }
        } else if (content.startsWith('POWERPOINT_DATA_URL:') || 
            content.startsWith('PDF_DATA_URL:') ||
            content.startsWith('IMAGE_DATA_URL:')) {
          // For now, show a placeholder - these would be processed by edge functions
          combinedAgenda += `\n\n[${file.name} - Content will be processed]\n`;
        } else {
          // Extract clean text from other formats
          const textStart = content.indexOf('\n\n');
          const textEnd = content.lastIndexOf('\n\n[');
          if (textStart !== -1 && textEnd !== -1) {
            combinedAgenda += content.substring(textStart + 2, textEnd).trim() + "\n\n";
          } else {
            combinedAgenda += content + "\n\n";
          }
        }
      });

      const currentAgenda = meetingConfig.agenda || "";
      const newAgenda = currentAgenda + combinedAgenda;
      
      updateMeetingConfig({ 
        agenda: newAgenda,
        agendaFiles: [...(meetingConfig.agendaFiles || []), ...processedFiles]
      });
      
      setAgendaPreview(combinedAgenda);
    } catch (error) {
      console.error("Failed to process agenda files:", error);
    }
  }, [processFiles, meetingConfig.agenda, meetingConfig.agendaFiles, updateMeetingConfig]);

  const generateSmartTitle = () => {
    const { attendees, agenda, format } = meetingConfig;
    
    let title = "";
    
    if (agenda && agenda.length > 10) {
      // Extract key topics from agenda
      const lines = agenda.split('\n').filter(line => line.trim().length > 5);
      const firstTopic = lines[0]?.trim();
      if (firstTopic) {
        title = firstTopic.length > 50 ? firstTopic.substring(0, 47) + "..." : firstTopic;
      }
    } else if (attendees.length > 0) {
      const organizations = [...new Set(attendees.map(a => a.organization).filter(Boolean))];
      if (organizations.length > 0) {
        title = `${organizations[0]} ${format === "f2f" ? "Meeting" : "Virtual Meeting"}`;
      } else {
        title = `${attendees.length} Person ${format.toUpperCase()} Meeting`;
      }
    } else {
      const formatLabels = { teams: "Teams", f2f: "Face-to-Face", hybrid: "Hybrid" };
      title = `${formatLabels[format]} Meeting`;
    }

    if (title.length > 97) {
      title = title.substring(0, 97) + "...";
    }

    updateMeetingConfig({ title });
  };

  return (
    <div className="space-y-6">
      {/* Meeting Title & Format */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Meeting Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="title">Meeting Title</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={generateSmartTitle}
                className="h-8 text-xs"
              >
                <Wand2 className="h-3 w-3 mr-1" />
                Auto-suggest
              </Button>
            </div>
            <Input
              id="title"
              value={meetingConfig.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Enter meeting title"
              maxLength={100}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Tip: Use descriptive titles for better AI context</span>
              <span>{meetingConfig.title.length}/100</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Meeting Format</Label>
            <Select 
              value={meetingConfig.format} 
              onValueChange={(value: "teams" | "f2f" | "hybrid") => 
                updateMeetingConfig({ format: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="teams">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Teams/Virtual Meeting
                  </div>
                </SelectItem>
                <SelectItem value="f2f">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Face-to-Face Meeting
                  </div>
                </SelectItem>
                <SelectItem value="hybrid">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    <UserCheck className="h-4 w-4" />
                    Hybrid Meeting
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Attendees Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Attendees ({meetingConfig.attendees.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAttendeeManager(!showAttendeeManager)}
            >
              <Users className="h-4 w-4 mr-2" />
              {showAttendeeManager ? "Hide" : "Manage"} Attendees
            </Button>
            <Button variant="ghost" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import from File
            </Button>
          </div>

          {meetingConfig.attendees.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {meetingConfig.attendees.slice(0, 8).map((attendee, index) => (
                <Badge key={index} variant="secondary">
                  {attendee.name}
                  {attendee.title && ` (${attendee.title})`}
                </Badge>
              ))}
              {meetingConfig.attendees.length > 8 && (
                <Badge variant="outline">
                  +{meetingConfig.attendees.length - 8} more
                </Badge>
              )}
            </div>
          )}

          {showAttendeeManager && (
            <div className="border rounded-lg p-4">
              <AttendeeManager 
                onAttendeesChange={(attendees) => updateMeetingConfig({ attendees })}
                showTemplateManagement={true}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agenda Management */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Meeting Agenda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 h-full">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => document.getElementById('agenda-upload')?.click()}
              disabled={isProcessing}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isProcessing ? "Processing..." : "Upload Agenda"}
            </Button>
            <input
              id="agenda-upload"
              type="file"
              multiple
              accept=".txt,.pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  handleAgendaUpload(e.target.files);
                }
              }}
            />
            <span className="text-xs text-muted-foreground">
              Supports: PDF, Word, PowerPoint, Images, Text
            </span>
          </div>

          {meetingConfig.agendaFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {meetingConfig.agendaFiles.map((file, index) => (
                <Badge key={index} variant="outline">
                  {file.name}
                </Badge>
              ))}
            </div>
          )}

          <Separator />

          <div className="space-y-2 flex-1">
            <Label htmlFor="agenda">Agenda Text</Label>
            <Textarea
              id="agenda"
              value={meetingConfig.agenda}
              onChange={(e) => updateMeetingConfig({ agenda: e.target.value })}
              placeholder="Enter meeting agenda items, topics, or copy agenda from documents..."
              className="min-h-[200px] resize-none"
            />
            <div className="text-xs text-muted-foreground">
              Tip: Include key discussion points and expected outcomes for better AI context
            </div>
          </div>

          {agendaPreview && (
            <Card className="border-dashed">
              <CardContent className="p-3">
                <div className="text-sm font-medium mb-2">Preview from uploaded files:</div>
                <div className="text-xs text-muted-foreground max-h-20 overflow-y-auto">
                  {agendaPreview.substring(0, 200)}...
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Context Preview */}
      {(meetingConfig.title || meetingConfig.attendees.length > 0 || meetingConfig.agenda) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">AI Context Preview</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            {meetingConfig.title && (
              <div><strong>Title:</strong> {meetingConfig.title}</div>
            )}
            {meetingConfig.attendees.length > 0 && (
              <div><strong>Attendees:</strong> {meetingConfig.attendees.length} participants</div>
            )}
            {meetingConfig.agenda && (
              <div><strong>Agenda:</strong> {meetingConfig.agenda.length} characters of context</div>
            )}
            <div className="text-success text-xs mt-2">
              ✓ This context will enhance AI-generated meeting notes
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};