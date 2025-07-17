import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, 
  Clock, 
  Users, 
  FileText, 
  CheckCircle, 
  Download, 
  Mail, 
  Edit3, 
  Play, 
  Save,
  FileDown,
  FilePlus2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from "docx";
import jsPDF from "jspdf";

interface MeetingData {
  id?: string;
  title: string;
  duration: string;
  wordCount: number;
  transcript: string;
  speakerCount: number;
  startTime: string;
  practiceName?: string;
}

export default function MeetingSummary() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Editable summary content
  const [summaryContent, setSummaryContent] = useState({
    attendees: "",
    agenda: "",
    keyPoints: "",
    decisions: "",
    actionItems: "",
    nextSteps: "",
    additionalNotes: ""
  });
  
  // Email settings
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [attendeeEmails, setAttendeeEmails] = useState("");
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  useEffect(() => {
    const data = location.state as MeetingData;
    if (data && !isSaved) {
      setMeetingData(data);
      saveMeetingToDatabase(data);
    } else if (!data) {
      navigate('/');
    }
  }, [location.state, navigate]);

  const saveMeetingToDatabase = async (data: MeetingData) => {
    if (isSaving || isSaved) return;
    
    setIsSaving(true);
    try {
      if (!user) throw new Error('User not authenticated');

      // Get default practice name
      let practiceName = "";
      try {
        const { data: practice } = await supabase
          .from('practice_details')
          .select('practice_name')
          .eq('user_id', user.id)
          .eq('is_default', true)
          .single();
        practiceName = practice?.practice_name || "";
      } catch (error) {
        // No default practice found
      }

      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          title: data.title,
          user_id: user.id,
          start_time: data.startTime,
          end_time: new Date().toISOString(),
          duration_minutes: Math.floor(parseInt(data.duration.split(':')[0]) + parseInt(data.duration.split(':')[1]) / 60),
          status: 'completed',
          meeting_type: 'consultation'
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      if (data.transcript && meeting) {
        const { error: transcriptError } = await supabase
          .from('meeting_transcripts')
          .insert({
            meeting_id: meeting.id,
            content: data.transcript,
            speaker_name: 'Multiple Speakers',
            timestamp_seconds: 0,
            confidence_score: 0.8
          });

        if (transcriptError) throw transcriptError;
      }

      setMeetingData(prev => prev ? { ...prev, id: meeting.id, practiceName } : null);
      setIsSaved(true);
      
      toast.success("Meeting saved successfully");
    } catch (error) {
      console.error('Error saving meeting:', error);
      toast.error("Failed to save meeting data");
    } finally {
      setIsSaving(false);
    }
  };

  const continueMeeting = () => {
    navigate('/', { state: { continueMeeting: true, meetingData } });
  };

  const generateNHSSummaryContent = () => {
    const date = new Date(meetingData?.startTime || new Date()).toLocaleDateString('en-GB');
    const time = new Date(meetingData?.startTime || new Date()).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    return `NHS MEETING MINUTES

Meeting Title: ${meetingData?.title || 'General Meeting'}
Date: ${date}
Time: ${time}
Duration: ${meetingData?.duration || '00:00'}
${meetingData?.practiceName ? `Practice: ${meetingData.practiceName}` : ''}

ATTENDEES:
${summaryContent.attendees || 'Not specified'}

AGENDA:
${summaryContent.agenda || 'Not specified'}

KEY DISCUSSION POINTS:
${summaryContent.keyPoints || 'Not specified'}

DECISIONS MADE:
${summaryContent.decisions || 'Not specified'}

ACTION ITEMS:
${summaryContent.actionItems || 'Not specified'}

NEXT STEPS:
${summaryContent.nextSteps || 'Not specified'}

ADDITIONAL NOTES:
${summaryContent.additionalNotes || 'Not specified'}

---
Meeting recorded with Notewell AI Meeting Notes Service
Total words transcribed: ${meetingData?.wordCount || 0}
Speakers detected: ${meetingData?.speakerCount || 0}`;
  };

  const downloadDocx = async () => {
    try {
      const content = generateNHSSummaryContent();
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: "NHS MEETING MINUTES",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: "" }),
            ...content.split('\n').map(line => 
              new Paragraph({
                children: [new TextRun(line)],
              })
            ),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${meetingData?.title || 'meeting'}_summary.docx`);
      toast.success("DOCX file downloaded successfully");
    } catch (error) {
      console.error('Error generating DOCX:', error);
      toast.error("Failed to generate DOCX file");
    }
  };

  const downloadPDF = () => {
    try {
      const content = generateNHSSummaryContent();
      const pdf = new jsPDF();
      const lines = content.split('\n');
      let y = 20;
      
      pdf.setFontSize(16);
      pdf.text("NHS MEETING MINUTES", 105, y, { align: 'center' });
      y += 20;
      
      pdf.setFontSize(10);
      lines.forEach(line => {
        if (y > 270) {
          pdf.addPage();
          y = 20;
        }
        pdf.text(line, 20, y);
        y += 6;
      });
      
      pdf.save(`${meetingData?.title || 'meeting'}_summary.pdf`);
      toast.success("PDF file downloaded successfully");
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error("Failed to generate PDF file");
    }
  };

  const downloadTranscript = () => {
    if (!meetingData?.transcript) {
      toast.error("No transcript available");
      return;
    }

    const date = new Date(meetingData.startTime).toLocaleDateString('en-GB');
    const time = new Date(meetingData.startTime).toLocaleTimeString('en-GB');
    
    const transcriptContent = `MEETING TRANSCRIPT

Meeting: ${meetingData.title}
Date: ${date}
Start Time: ${time}
Duration: ${meetingData.duration}
Total Words: ${meetingData.wordCount}
Speakers: ${meetingData.speakerCount}
${meetingData.practiceName ? `Practice: ${meetingData.practiceName}` : ''}

---

${meetingData.transcript}

---
Generated by Notewell AI Meeting Notes Service`;

    const blob = new Blob([transcriptContent], { type: 'text/plain' });
    saveAs(blob, `${meetingData.title}_transcript.txt`);
    toast.success("Transcript downloaded successfully");
  };

  const sendEmail = async () => {
    if (!user?.email) {
      toast.error("User email not available");
      return;
    }

    setIsEmailLoading(true);
    try {
      const attendeeEmailList = attendeeEmails
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      const response = await supabase.functions.invoke('send-meeting-summary', {
        body: {
          userEmail: user.email,
          attendeeEmails: attendeeEmailList,
          meetingTitle: meetingData?.title || 'Meeting',
          meetingDate: new Date(meetingData?.startTime || new Date()).toLocaleDateString('en-GB'),
          duration: meetingData?.duration || '00:00',
          summary: generateNHSSummaryContent(),
          includeTranscript,
          transcript: includeTranscript ? meetingData?.transcript : undefined,
          practiceName: meetingData?.practiceName
        }
      });

      if (response.error) throw response.error;
      
      toast.success("Email sent successfully");
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error("Failed to send email");
    } finally {
      setIsEmailLoading(false);
    }
  };

  if (!meetingData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{meetingData.title}</h1>
              <p className="text-muted-foreground">NHS Meeting Summary & Minutes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSaved && (
              <Badge variant="default">
                <CheckCircle className="h-3 w-3 mr-1" />
                Saved
              </Badge>
            )}
            <Button variant="outline" onClick={continueMeeting}>
              <Play className="h-4 w-4 mr-2" />
              Continue Meeting
            </Button>
          </div>
        </div>

        {/* Meeting Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-primary">{meetingData.duration}</div>
              <div className="text-sm text-muted-foreground">Duration</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-primary">{meetingData.wordCount}</div>
              <div className="text-sm text-muted-foreground">Words</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-primary">{meetingData.speakerCount}</div>
              <div className="text-sm text-muted-foreground">Speakers</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-primary">100%</div>
              <div className="text-sm text-muted-foreground">Complete</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* NHS Meeting Summary Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FilePlus2 className="h-5 w-5" />
                  NHS Meeting Minutes
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  {isEditing ? 'View' : 'Edit'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="attendees">Attendees</Label>
                <Textarea
                  id="attendees"
                  placeholder="List of meeting attendees..."
                  value={summaryContent.attendees}
                  onChange={(e) => setSummaryContent(prev => ({ ...prev, attendees: e.target.value }))}
                  disabled={!isEditing}
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="agenda">Agenda</Label>
                <Textarea
                  id="agenda"
                  placeholder="Meeting agenda items..."
                  value={summaryContent.agenda}
                  onChange={(e) => setSummaryContent(prev => ({ ...prev, agenda: e.target.value }))}
                  disabled={!isEditing}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="keyPoints">Key Discussion Points</Label>
                <Textarea
                  id="keyPoints"
                  placeholder="Main points discussed..."
                  value={summaryContent.keyPoints}
                  onChange={(e) => setSummaryContent(prev => ({ ...prev, keyPoints: e.target.value }))}
                  disabled={!isEditing}
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="decisions">Decisions Made</Label>
                <Textarea
                  id="decisions"
                  placeholder="Key decisions and resolutions..."
                  value={summaryContent.decisions}
                  onChange={(e) => setSummaryContent(prev => ({ ...prev, decisions: e.target.value }))}
                  disabled={!isEditing}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="actionItems">Action Items</Label>
                <Textarea
                  id="actionItems"
                  placeholder="Tasks and responsibilities assigned..."
                  value={summaryContent.actionItems}
                  onChange={(e) => setSummaryContent(prev => ({ ...prev, actionItems: e.target.value }))}
                  disabled={!isEditing}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="nextSteps">Next Steps</Label>
                <Textarea
                  id="nextSteps"
                  placeholder="Follow-up actions and next meeting..."
                  value={summaryContent.nextSteps}
                  onChange={(e) => setSummaryContent(prev => ({ ...prev, nextSteps: e.target.value }))}
                  disabled={!isEditing}
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="additionalNotes">Additional Notes</Label>
                <Textarea
                  id="additionalNotes"
                  placeholder="Any other relevant information..."
                  value={summaryContent.additionalNotes}
                  onChange={(e) => setSummaryContent(prev => ({ ...prev, additionalNotes: e.target.value }))}
                  disabled={!isEditing}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions Panel */}
          <div className="space-y-6">
            {/* Download Options */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Download Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={downloadDocx} className="w-full justify-start">
                  <FileDown className="h-4 w-4 mr-2" />
                  Download as DOCX
                </Button>
                <Button onClick={downloadPDF} className="w-full justify-start" variant="outline">
                  <FileDown className="h-4 w-4 mr-2" />
                  Download as PDF
                </Button>
                <Button onClick={downloadTranscript} className="w-full justify-start" variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Download Transcript (.txt)
                </Button>
              </CardContent>
            </Card>

            {/* Email Options */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="attendeeEmails">Attendee Emails (comma separated)</Label>
                  <Textarea
                    id="attendeeEmails"
                    placeholder="email1@example.com, email2@example.com"
                    value={attendeeEmails}
                    onChange={(e) => setAttendeeEmails(e.target.value)}
                    rows={3}
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeTranscript"
                    checked={includeTranscript}
                    onCheckedChange={(checked) => setIncludeTranscript(checked as boolean)}
                  />
                  <Label htmlFor="includeTranscript" className="text-sm">
                    Include full transcript in email
                  </Label>
                </div>

                <Button 
                  onClick={sendEmail} 
                  className="w-full"
                  disabled={isEmailLoading}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {isEmailLoading ? 'Sending...' : 'Send Email'}
                </Button>
              </CardContent>
            </Card>

            {/* Meeting Transcript */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Meeting Transcript
                </CardTitle>
              </CardHeader>
              <CardContent>
                {meetingData.transcript ? (
                  <div className="bg-accent/30 p-4 rounded-lg max-h-60 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm">
                      {meetingData.transcript}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No transcript available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}