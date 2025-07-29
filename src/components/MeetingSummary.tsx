import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SafeMessageRenderer } from "@/components/SafeMessageRenderer";
import { 
  FileText, 
  Mail, 
  ArrowLeft, 
  Edit3, 
  Copy, 
  Eye, 
  FileDown,
  Download,
  Clock,
  Hash
} from "lucide-react";


interface MeetingSummaryProps {
  duration: string;
  wordCount: number;
  transcript: string;
  onBackToRecording: () => void;
  meetingSettings?: {
    title: string;
    description: string;
    meetingType: string;
  };
  currentMeetingId?: string | null;
  onSave?: () => Promise<any>;
}

export const MeetingSummary = ({ 
  duration, 
  wordCount, 
  transcript, 
  onBackToRecording,
  meetingSettings,
  currentMeetingId,
  onSave
}: MeetingSummaryProps) => {
  const [detailLevel, setDetailLevel] = useState("balanced");
  const [notes, setNotes] = useState(generateMeetingNotes(transcript, "balanced"));
  const [isEditing, setIsEditing] = useState(false);

  function generateMeetingNotes(transcript: string, level: string) {
    if (!transcript) return "No meeting content to summarize.";

    const baseNotes = `
**Meeting Summary**

**Key Discussion Points:**
• Review of previous meeting actions and outcomes
• Financial update and budget allocation review
• Staffing matters and resource planning
• IT systems upgrade timeline and implementation
• Patient care initiatives progress update

**Action Items:**
• Dr. Smith to provide follow-up report on patient care initiatives
• Finance team to present detailed budget breakdown next meeting
• IT department to finalize systems upgrade schedule
• HR to address staffing allocation concerns

**Next Steps:**
• Schedule follow-up meeting for next month
• Circulate action item assignments to all attendees
• Prepare progress reports for outstanding items
    `.trim();

    switch (level) {
      case "headlines":
        return `
**Headlines Only**

• Financial update reviewed - positive trends
• Staffing matters discussed
• IT systems upgrade timeline addressed
• Patient care initiatives progressing
• Next meeting scheduled for next month
        `.trim();

      case "detailed":
        return `
${baseNotes}

**Detailed Discussion Notes:**

**Financial Update Section:**
The quarterly budget review showed positive trends across all departments. Revenue streams are performing above expectations, with particular strength in planned care services. Cost management initiatives have resulted in 3% savings compared to last quarter.

**Staffing Matters:**
Current staffing levels are adequate but recruitment challenges persist in specialist roles. The nursing shortage continues to impact service delivery timelines. HR department is implementing new retention strategies.

**IT Systems:**
The planned upgrade to electronic health records system is proceeding on schedule. Training sessions for staff will begin next month. Backup systems and data migration protocols have been tested successfully.

**Patient Care Initiatives:**
New patient pathway improvements have reduced waiting times by 15%. Patient satisfaction scores show improvement in communication and care coordination. Quality metrics remain within acceptable ranges.
        `.trim();

      default: // balanced
        return baseNotes;
    }
  }

  const handleDetailLevelChange = (newLevel: string) => {
    setDetailLevel(newLevel);
    setNotes(generateMeetingNotes(transcript, newLevel));
  };

  const handleCopyNotes = () => {
    navigator.clipboard.writeText(notes);
    console.log("Notes Copied - Meeting notes copied to clipboard");
  };

  const handleEmailNotes = () => {
    const subject = "Meeting Notes Summary";
    const body = encodeURIComponent(notes);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const handleExport = (format: string) => {
    console.log(`${format} Export - Meeting notes exported as ${format}`);
  };

  return (
    <Card className="shadow-medium">
      <CardHeader className="pb-3 sm:pb-6">
        {/* Mobile-First Header Layout */}
        <div className="space-y-3 sm:space-y-0">
          {/* Back Button - Full Width on Mobile */}
          <div className="flex items-center justify-between sm:hidden">
            <Button 
              variant="outline" 
              onClick={onBackToRecording}
              className="touch-manipulation min-h-[44px] flex-1 max-w-[200px]"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
          
          {/* Desktop Header */}
          <div className="hidden sm:flex sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Meeting Summary
            </CardTitle>
            <Button variant="outline" onClick={onBackToRecording}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
          
          {/* Mobile Title */}
          <div className="text-center sm:hidden">
            <CardTitle className="flex items-center justify-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Meeting Summary
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 sm:space-y-6 px-3 sm:px-6">
        {/* Meeting Stats - Mobile Optimized */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="flex items-center justify-center sm:justify-start gap-2 p-3 bg-accent/50 rounded-lg">
            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-sm sm:text-base">Duration:</span>
            <Badge variant="secondary" className="text-xs sm:text-sm">{duration}</Badge>
          </div>
          <div className="flex items-center justify-center sm:justify-start gap-2 p-3 bg-accent/50 rounded-lg">
            <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-sm sm:text-base">Words:</span>
            <Badge variant="secondary" className="text-xs sm:text-sm">{wordCount}</Badge>
          </div>
        </div>

        {/* Action Buttons - Mobile Optimized */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button 
            onClick={onBackToRecording} 
            variant="outline" 
            size="sm"
            className="w-full sm:w-auto touch-manipulation min-h-[44px]"
          >
            Continue Recording
          </Button>
          <Button 
            onClick={handleEmailNotes} 
            variant="outline" 
            size="sm"
            className="w-full sm:w-auto touch-manipulation min-h-[44px]"
          >
            <Mail className="h-4 w-4 mr-2" />
            Email Notes
          </Button>
        </div>

        {/* Detail Level Selector - Mobile Friendly */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Meeting Notes Detail Level</label>
          <Select value={detailLevel} onValueChange={handleDetailLevelChange}>
            <SelectTrigger className="w-full touch-manipulation min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="headlines">Headlines Only</SelectItem>
              <SelectItem value="balanced">Balanced</SelectItem>
              <SelectItem value="detailed">Super Detailed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Meeting Notes - Mobile Optimized */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <label className="text-sm font-medium">Review and customise your meeting notes</label>
            <Button 
              variant="ghost" 
              size="sm" 
              className="touch-manipulation min-h-[44px] w-full sm:w-auto"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit3 className="h-4 w-4 mr-2" />
              {isEditing ? "Save & Preview" : "Edit Notes"}
            </Button>
          </div>
          {isEditing ? (
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={12}
              className="font-mono text-xs sm:text-sm touch-manipulation min-h-[300px] resize-y"
            />
          ) : (
            <div className="border rounded-lg p-4 min-h-[300px] bg-background">
              <SafeMessageRenderer 
                content={notes} 
                className="prose prose-sm max-w-none dark:prose-invert"
              />
            </div>
          )}
        </div>

        {/* Export Options - Mobile Grid Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <Button 
            onClick={handleCopyNotes} 
            variant="outline" 
            size="sm"
            className="touch-manipulation min-h-[44px] justify-start"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Notes
          </Button>
          <Button 
            onClick={() => handleExport("Preview")} 
            variant="outline" 
            size="sm"
            className="touch-manipulation min-h-[44px] justify-start"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button 
            onClick={() => handleExport("Word")} 
            variant="outline" 
            size="sm"
            className="touch-manipulation min-h-[44px] justify-start"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Word Doc
          </Button>
          <Button 
            onClick={() => handleExport("PDF")} 
            variant="outline" 
            size="sm"
            className="touch-manipulation min-h-[44px] justify-start"
          >
            <Download className="h-4 w-4 mr-2" />
            PDF Doc
          </Button>
          <Button 
            onClick={() => handleExport("Transcript")} 
            variant="outline" 
            size="sm"
            className="touch-manipulation min-h-[44px] justify-start sm:col-span-2 lg:col-span-1"
          >
            <FileText className="h-4 w-4 mr-2" />
            Transcript
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};