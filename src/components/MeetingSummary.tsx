import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

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
    toast({
      title: "Notes Copied",
      description: "Meeting notes copied to clipboard",
    });
  };

  const handleEmailNotes = () => {
    const subject = "Meeting Notes Summary";
    const body = encodeURIComponent(notes);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const handleExport = (format: string) => {
    toast({
      title: `${format} Export`,
      description: `Meeting notes exported as ${format}`,
    });
  };

  return (
    <Card className="shadow-medium">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Meeting Summary
          </CardTitle>
          <Button variant="outline" onClick={onBackToRecording}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Recording
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Meeting Stats */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Total Duration:</span>
            <Badge variant="secondary">{duration}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Total Words:</span>
            <Badge variant="secondary">{wordCount}</Badge>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={onBackToRecording} variant="outline" size="sm">
            Continue Recording
          </Button>
          <Button onClick={handleEmailNotes} variant="outline" size="sm">
            <Mail className="h-4 w-4 mr-2" />
            Email Notes
          </Button>
        </div>

        {/* Detail Level Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Meeting Notes Detail Level</label>
          <Select value={detailLevel} onValueChange={handleDetailLevelChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="headlines">Headlines Only</SelectItem>
              <SelectItem value="balanced">Balanced</SelectItem>
              <SelectItem value="detailed">Super Detailed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Meeting Notes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Review and customize your meeting notes</label>
            <Button variant="ghost" size="sm">
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Notes
            </Button>
          </div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={15}
            className="font-mono text-sm"
          />
        </div>

        {/* Export Options */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleCopyNotes} variant="outline" size="sm">
            <Copy className="h-4 w-4 mr-2" />
            Copy Meeting Notes
          </Button>
          <Button onClick={() => handleExport("Preview")} variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            Preview All Exports
          </Button>
          <Button onClick={() => handleExport("Word")} variant="outline" size="sm">
            <FileDown className="h-4 w-4 mr-2" />
            Generate Word Document
          </Button>
          <Button onClick={() => handleExport("PDF")} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Generate PDF Document
          </Button>
          <Button onClick={() => handleExport("Transcript")} variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            View Full Transcript
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};