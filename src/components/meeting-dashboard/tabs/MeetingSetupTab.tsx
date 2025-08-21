import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Users, FileText, Upload, Wand2, MapPin, Video, UserCheck, FolderOpen, Plus } from "lucide-react";
import { AttendeeManager } from "@/components/AttendeeManager";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useDashboard } from "../utils/DashboardContext";
import { cn } from "@/lib/utils";

export const MeetingSetupTab = () => {
  const { meetingConfig, updateMeetingConfig } = useDashboard();
  const { processFiles, isProcessing } = useFileUpload();
  const [showAttendeeManager, setShowAttendeeManager] = useState(false);
  const [agendaPreview, setAgendaPreview] = useState("");
  const [contextPreview, setContextPreview] = useState("");

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
        
        if (content.startsWith('POWERPOINT_DATA_URL:') || 
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

  const handleContextUpload = useCallback(async (files: FileList) => {
    try {
      const processedFiles = await processFiles(files);
      
      // Extract text content from processed files
      let combinedContext = "";
      processedFiles.forEach(file => {
        let content = file.content;
        
        if (content.startsWith('POWERPOINT_DATA_URL:') || 
            content.startsWith('PDF_DATA_URL:') ||
            content.startsWith('IMAGE_DATA_URL:')) {
          combinedContext += `\n\n[${file.name} - Content will be processed]\n`;
        } else {
          const textStart = content.indexOf('\n\n');
          const textEnd = content.lastIndexOf('\n\n[');
          if (textStart !== -1 && textEnd !== -1) {
            combinedContext += content.substring(textStart + 2, textEnd).trim() + "\n\n";
          } else {
            combinedContext += content + "\n\n";
          }
        }
      });

      const currentContext = meetingConfig.contextText || "";
      const newContext = currentContext + combinedContext;
      
      updateMeetingConfig({ 
        contextText: newContext,
        contextFiles: [...(meetingConfig.contextFiles || []), ...processedFiles]
      });
      
      setContextPreview(combinedContext);
    } catch (error) {
      console.error("Failed to process context files:", error);
    }
  }, [processFiles, meetingConfig.contextText, meetingConfig.contextFiles, updateMeetingConfig]);

  const generateSmartTitle = () => {
    const { attendees, agenda, format, contextText, contextFiles } = meetingConfig;
    
    let title = "";
    
    // Combine all available text for analysis
    const allText = [
      agenda || "",
      contextText || "",
      ...(contextFiles || []).map(file => file.content || "")
    ].join(" ").trim();
    
    if (allText && allText.length > 10) {
      // Look for key meeting-related keywords and phrases
      const keywordPatterns = [
        /(?:meeting|discussion|review|planning)\s+(?:about|for|on)\s+([^.!?]+)/gi,
        /(?:quarterly|monthly|weekly|annual)\s+([^.!?]+)(?:\s+(?:meeting|review|discussion))?/gi,
        /(?:budget|finance|hr|clinical|governance|strategy)\s+([^.!?]+)/gi,
        /([^.!?]*(?:partnership|collaboration|merger|acquisition)[^.!?]*)/gi,
        /([^.!?]*(?:training|workshop|seminar)[^.!?]*)/gi,
        /([^.!?]*(?:audit|inspection|assessment)[^.!?]*)/gi,
        /([^.!?]*(?:policy|guideline|protocol)\s+(?:review|update|discussion)[^.!?]*)/gi
      ];
      
      for (const pattern of keywordPatterns) {
        const matches = allText.match(pattern);
        if (matches && matches[0]) {
          let match = matches[0].trim();
          // Clean up the match
          match = match.replace(/^\W+|\W+$/g, ''); // Remove leading/trailing punctuation
          match = match.charAt(0).toUpperCase() + match.slice(1); // Capitalize first letter
          
          if (match.length > 5 && match.length <= 80) {
            title = match.length > 77 ? match.substring(0, 77) + "..." : match;
            break;
          }
        }
      }
      
      // If no specific patterns found, try to extract first meaningful topic
      if (!title) {
        const lines = allText.split(/[.\n!?]/).filter(line => line.trim().length > 10);
        const firstMeaningfulLine = lines.find(line => 
          !line.toLowerCase().includes('agenda') && 
          !line.toLowerCase().includes('meeting') &&
          line.trim().length > 15
        );
        
        if (firstMeaningfulLine) {
          const cleaned = firstMeaningfulLine.trim();
          title = cleaned.length > 50 ? cleaned.substring(0, 47) + "..." : cleaned;
        }
      }
    }
    
    // Fallback to attendee-based titles
    if (!title && attendees.length > 0) {
      const organizations = [...new Set(attendees.map(a => a.organization).filter(Boolean))];
      if (organizations.length > 0) {
        title = `${organizations[0]} ${format === "teams" ? "Virtual" : format === "f2f" ? "Face-to-Face" : "Hybrid"} Meeting`;
      } else {
        const roles = [...new Set(attendees.map(a => a.title || a.role).filter(Boolean))];
        if (roles.length > 0 && roles[0]) {
          title = `${roles[0]} Meeting`;
        } else {
          title = `${attendees.length} Person ${format === "teams" ? "Virtual" : format === "f2f" ? "Face-to-Face" : "Hybrid"} Meeting`;
        }
      }
    }
    
    // Final fallback with current date/time
    if (!title) {
      const formatLabels = { 
        teams: "Virtual Meeting", 
        f2f: "Face-to-Face Meeting", 
        hybrid: "Hybrid Meeting" 
      };
      title = `${formatLabels[format]} - ${new Date().toLocaleDateString('en-GB', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
      })}`;
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

      {/* Context Management */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Meeting Context & Supporting Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 h-full">
          <div className="text-sm text-muted-foreground mb-4">
            Upload presentations, previous meeting minutes, reports, and other context that will help create better meeting notes
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => document.getElementById('context-upload')?.click()}
              disabled={isProcessing}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isProcessing ? "Processing..." : "Upload Documents"}
            </Button>
            <input
              id="context-upload"
              type="file"
              multiple
              accept=".txt,.pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  handleContextUpload(e.target.files);
                }
              }}
            />
            <span className="text-xs text-muted-foreground">
              Presentations, Documents, Images, Spreadsheets
            </span>
          </div>

          {meetingConfig.contextFiles && meetingConfig.contextFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {meetingConfig.contextFiles.map((file, index) => (
                <Badge key={index} variant="outline" className="flex items-center gap-1">
                  <FolderOpen className="h-3 w-3" />
                  {file.name}
                </Badge>
              ))}
            </div>
          )}

          <Separator />

          <div className="space-y-2 flex-1">
            <Label htmlFor="context">Additional Context</Label>
            <Textarea
              id="context"
              value={meetingConfig.contextText}
              onChange={(e) => updateMeetingConfig({ contextText: e.target.value })}
              placeholder="Paste or type additional context: previous minutes, key decisions, background information, relevant policies..."
              className="min-h-[150px] resize-none"
            />
            <div className="text-xs text-muted-foreground">
              Examples: "Follow-up from last month's budget discussion", "New NHS guidelines to review", "Action items from Q3 planning"
            </div>
          </div>

          {contextPreview && (
            <Card className="border-dashed">
              <CardContent className="p-3">
                <div className="text-sm font-medium mb-2">Preview from uploaded documents:</div>
                <div className="text-xs text-muted-foreground max-h-20 overflow-y-auto">
                  {contextPreview.substring(0, 200)}...
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Context Preview */}
      {(meetingConfig.title || meetingConfig.attendees.length > 0 || meetingConfig.agenda || meetingConfig.contextText || (meetingConfig.contextFiles && meetingConfig.contextFiles.length > 0)) && (
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
            {meetingConfig.contextFiles && meetingConfig.contextFiles.length > 0 && (
              <div><strong>Context Files:</strong> {meetingConfig.contextFiles.length} supporting documents</div>
            )}
            {meetingConfig.contextText && (
              <div><strong>Additional Context:</strong> {meetingConfig.contextText.length} characters of background info</div>
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