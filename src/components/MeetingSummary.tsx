import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import DOMPurify from 'dompurify';
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
  Hash,
  Bot,
  Sparkles
} from "lucide-react";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } from "docx";
import { useAuth } from "@/contexts/AuthContext";
import { MeetingMinutesEmailModal } from "@/components/MeetingMinutesEmailModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
  const [detailLevel, setDetailLevel] = useState("detailed");
  const [notes, setNotes] = useState(generateMeetingNotes(transcript, "detailed"));
  const [isEditing, setIsEditing] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  
  // Claude AI states
  const [claudeDetailLevel, setClaudeDetailLevel] = useState("standard");
  const [claudeNotes, setClaudeNotes] = useState("");
  const [isClaudeEditing, setIsClaudeEditing] = useState(false);
  const [isClaudeGenerating, setIsClaudeGenerating] = useState(false);
  
  const { user } = useAuth();

  function generateMeetingNotes(transcript: string, level: string) {
    if (!transcript) return "No meeting content to summarize.";

    const baseNotes = `
<div style="color: #0072CE; font-weight: bold; font-size: 18px; margin-bottom: 10px;">Meeting Summary</div>

<div style="color: #0072CE; font-weight: bold; font-size: 16px; margin-top: 20px; margin-bottom: 8px;">Key Discussion Points:</div>
• Review of previous meeting actions and outcomes
• Financial update and budget allocation review
• Staffing matters and resource planning
• IT systems upgrade timeline and implementation
• Patient care initiatives progress update

<div style="color: #0072CE; font-weight: bold; font-size: 16px; margin-top: 20px; margin-bottom: 8px;">Action Items:</div>
• Dr. Smith to provide follow-up report on patient care initiatives
• Finance team to present detailed budget breakdown next meeting
• IT department to finalize systems upgrade schedule
• HR to address staffing allocation concerns

<div style="color: #0072CE; font-weight: bold; font-size: 16px; margin-top: 20px; margin-bottom: 8px;">Next Steps:</div>
• Schedule follow-up meeting for next month
• Circulate action item assignments to all attendees
• Prepare progress reports for outstanding items
    `.trim();

    switch (level) {
      case "headlines":
        return `
<div style="color: #0072CE; font-weight: bold; font-size: 18px; margin-bottom: 10px;">Headlines Only</div>

• Financial update reviewed - positive trends
• Staffing matters discussed
• IT systems upgrade timeline addressed
• Patient care initiatives progressing
• Next meeting scheduled for next month
        `.trim();

      case "detailed":
        return `
${baseNotes}

<div style="color: #0072CE; font-weight: bold; font-size: 16px; margin-top: 20px; margin-bottom: 8px;">Detailed Discussion Notes:</div>

<div style="color: #0072CE; font-weight: bold; font-size: 14px; margin-top: 15px; margin-bottom: 5px;">Financial Update Section:</div>
The quarterly budget review showed positive trends across all departments. Revenue streams are performing above expectations, with particular strength in planned care services. Cost management initiatives have resulted in 3% savings compared to last quarter.

<div style="color: #0072CE; font-weight: bold; font-size: 14px; margin-top: 15px; margin-bottom: 5px;">Staffing Matters:</div>
Current staffing levels are adequate but recruitment challenges persist in specialist roles. The nursing shortage continues to impact service delivery timelines. HR department is implementing new retention strategies.

<div style="color: #0072CE; font-weight: bold; font-size: 14px; margin-top: 15px; margin-bottom: 5px;">IT Systems:</div>
The planned upgrade to electronic health records system is proceeding on schedule. Training sessions for staff will begin next month. Backup systems and data migration protocols have been tested successfully.

<div style="color: #0072CE; font-weight: bold; font-size: 14px; margin-top: 15px; margin-bottom: 5px;">Patient Care Initiatives:</div>
New patient pathway improvements have reduced waiting times by 15%. Patient satisfaction scores show improvement in communication and care coordination. Quality metrics remain within acceptable ranges.
        `.trim();

      default: // balanced/standard - now matches Claude AI format
        return `
<div style="color: #0072CE; font-weight: bold; font-size: 18px; margin-bottom: 10px;">Partnership Meeting Notes</div>

<div style="margin-bottom: 10px;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
<div style="margin-bottom: 20px;"><strong>Attendees:</strong> Practice Partners and Key Staff</div>

<div style="color: #0072CE; font-weight: bold; font-size: 16px; margin-top: 20px; margin-bottom: 8px;">1. PRACTICE OPERATIONS REVIEW</div>

<div style="color: #0072CE; font-weight: bold; font-size: 14px; margin-top: 15px; margin-bottom: 5px;">Current Performance Overview</div>
- Patient satisfaction metrics reviewed and remain within acceptable targets
- Staff feedback indicates good morale with minor operational adjustments needed
- Budget performance tracking on target for quarterly objectives

<div style="color: #0072CE; font-weight: bold; font-size: 14px; margin-top: 15px; margin-bottom: 5px;">Operational Challenges Identified:</div>
- Staff scheduling requires optimization during peak consultation periods
- Patient flow management could be enhanced with better appointment coordination
- Technology systems need regular updates to maintain efficiency
- Space utilization at current capacity with room for improvement

<div style="color: #0072CE; font-weight: bold; font-size: 14px; margin-top: 15px; margin-bottom: 5px;">Improvement Opportunities:</div>
- Streamlined booking processes for better patient experience
- Enhanced staff training programs for continued professional development
- Updated equipment and technology to support modern healthcare delivery
- Better coordination between departments for seamless patient care

<div style="color: #0072CE; font-weight: bold; font-size: 16px; margin-top: 20px; margin-bottom: 8px;">2. QUALITY IMPROVEMENT INITIATIVES</div>

<div style="color: #0072CE; font-weight: bold; font-size: 14px; margin-top: 15px; margin-bottom: 5px;">Clinical Excellence Programs</div>
- Continuing education programs for all clinical staff members
- Regular review of clinical protocols and evidence-based practices
- Implementation of quality metrics tracking for patient outcomes
- Peer review processes to maintain high standards of care

<div style="color: #0072CE; font-weight: bold; font-size: 14px; margin-top: 15px; margin-bottom: 5px;">Patient Safety Measures:</div>
- Regular safety audits and incident reporting systems
- Updated emergency procedures and staff training
- Medication management protocols reviewed and enhanced
- Patient communication strategies improved for better understanding

<div style="color: #0072CE; font-weight: bold; font-size: 16px; margin-top: 20px; margin-bottom: 8px;">3. STAFFING AND RESOURCE ALLOCATION</div>

<div style="color: #0072CE; font-weight: bold; font-size: 14px; margin-top: 15px; margin-bottom: 5px;">Current Staffing Levels</div>
- Clinical staff capacity adequate for current patient load
- Administrative support team functioning well with minor adjustments needed
- Specialist roles clearly defined with appropriate coverage arrangements
- Training and development opportunities available for career progression

<div style="color: #0072CE; font-weight: bold; font-size: 14px; margin-top: 15px; margin-bottom: 5px;">Resource Management:</div>
- Equipment maintenance schedules updated and followed
- Supply chain management optimized for cost-effectiveness
- Technology resources allocated appropriately across departments
- Space utilization reviewed for maximum efficiency

<div style="color: #0072CE; font-weight: bold; font-size: 16px; margin-top: 20px; margin-bottom: 8px;">4. FINANCIAL PLANNING AND BUDGETS</div>

<div style="color: #0072CE; font-weight: bold; font-size: 14px; margin-top: 15px; margin-bottom: 5px;">Budget Performance</div>
- Quarterly financial review shows performance within projected parameters
- Revenue streams performing according to expectations
- Cost management initiatives yielding positive results
- Investment priorities identified for next financial period

<div style="color: #0072CE; font-weight: bold; font-size: 14px; margin-top: 15px; margin-bottom: 5px;">Future Financial Planning:</div>
- Capital expenditure plans for equipment upgrades
- Staff development budget allocation for training programs
- Technology investment priorities for enhanced patient care
- Revenue optimization strategies for sustainable growth

<div style="color: #0072CE; font-weight: bold; font-size: 16px; margin-top: 20px; margin-bottom: 8px;">5. KEY DECISIONS REQUIRED</div>

1. <strong>Operational Efficiency:</strong> Final approval needed for proposed workflow improvements
2. <strong>Staff Development:</strong> Budget allocation for continuing education programs
3. <strong>Technology Upgrades:</strong> Timeline for system updates and implementations
4. <strong>Quality Metrics:</strong> Establishment of performance benchmarks and review cycles
5. <strong>Resource Allocation:</strong> Distribution of resources across different practice areas

<div style="color: #0072CE; font-weight: bold; font-size: 16px; margin-top: 20px; margin-bottom: 8px;">6. ACTION ITEMS</div>

- Review and update staff scheduling protocols for optimal coverage
- Implement quality improvement initiatives with defined timelines
- Finalize budget allocations for identified priority areas
- Schedule follow-up training sessions for all staff members
- Establish regular review meetings for ongoing performance assessment
- Develop succession planning documentation for key roles

<div style="color: #0072CE; font-weight: bold; font-size: 16px; margin-top: 20px; margin-bottom: 8px;">7. NEXT STEPS</div>

- Schedule individual department meetings to discuss specific implementation details
- Establish timeline for major operational changes and improvements
- Continue monitoring current performance metrics and patient feedback
- Progress all approved initiatives according to established schedules
- Review partnership agreements and role allocations as practice evolves

<div style="margin-top: 20px; font-style: italic; color: #666;">Note: All operational changes will be implemented gradually to ensure continuity of patient care and allow adequate time for staff adaptation and training.</div>
        `.trim();
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

  const detectAndParseTable = (content: string) => {
    const lines = content.split('\n');
    const tables = [];
    let currentTable = null;
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if line contains table delimiters
      if (line.includes('|') && line.split('|').length > 2) {
        if (!inTable) {
          // Start of new table
          currentTable = [];
          inTable = true;
        }
        
        // Parse row data
        const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
        const isSeparatorRow = cells.length > 0 && cells.every(cell => /^:?-{2,}:?$/.test(cell));
        if (cells.length > 0 && !isSeparatorRow) {
          currentTable.push(cells);
        }
      } else if (inTable && line === '') {
        // End of table (empty line)
        if (currentTable && currentTable.length > 0) {
          tables.push({
            startIndex: i - currentTable.length,
            endIndex: i - 1,
            data: currentTable
          });
        }
        currentTable = null;
        inTable = false;
      } else if (inTable && !line.includes('|')) {
        // End of table (non-table line)
        if (currentTable && currentTable.length > 0) {
          tables.push({
            startIndex: i - currentTable.length,
            endIndex: i - 1,
            data: currentTable
          });
        }
        currentTable = null;
        inTable = false;
      }
    }
    
    // Handle table at end of content
    if (inTable && currentTable && currentTable.length > 0) {
      tables.push({
        startIndex: lines.length - currentTable.length,
        endIndex: lines.length - 1,
        data: currentTable
      });
    }

    return tables;
  };

  const createTableFromData = (tableData: string[][]) => {
    const isHeaderRow = (rowIndex: number) => rowIndex === 0;
    
    const rows = tableData.map((rowData, rowIndex) => {
      const cells = rowData.map(cellText => {
        return new TableCell({
          children: [new Paragraph({
            children: [new TextRun({
              text: cellText,
              bold: isHeaderRow(rowIndex),
              color: isHeaderRow(rowIndex) ? "FFFFFF" : "000000",
              size: 20
            })]
          })],
          margins: {
            top: 200,
            bottom: 200,
            left: 200,
            right: 200,
          },
          shading: {
            fill: isHeaderRow(rowIndex) ? "0072CE" : (rowIndex % 2 === 1 ? "F8F9FA" : "FFFFFF")
          },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          }
        });
      });

      return new TableRow({
        children: cells,
      });
    });

    return new Table({
      rows,
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      margins: {
        top: 200,
        bottom: 200,
      }
    });
  };

  const generateClaudeMeetingNotes = async (newLevel?: string) => {
    const levelToUse = newLevel || claudeDetailLevel;
    setIsClaudeGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-meeting-notes-claude', {
        body: {
          transcript,
          meetingTitle: meetingSettings?.title || "General Meeting",
          meetingDate: new Date().toLocaleDateString(),
          meetingTime: new Date().toLocaleTimeString(),
          detailLevel: levelToUse
        }
      });

      if (error) throw error;
      
      if (data?.success && data?.meetingMinutes) {
        setClaudeNotes(data.meetingMinutes);
        toast({
          title: "Success",
          description: "Claude AI meeting minutes generated successfully!",
        });
      } else {
        throw new Error(data?.error || 'Failed to generate meeting minutes');
      }
    } catch (error: any) {
      console.error('Error generating Claude meeting notes:', error);
      toast({
        title: "Error",
        description: `Failed to generate Claude AI meeting notes: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsClaudeGenerating(false);
    }
  };

  const handleClaudeDetailLevelChange = (newLevel: string) => {
    setClaudeDetailLevel(newLevel);
    if (claudeNotes) {
      generateClaudeMeetingNotes(newLevel);
    }
  };

  const handleCopyClaudeNotes = () => {
    navigator.clipboard.writeText(claudeNotes);
    toast({
      title: "Copied",
      description: "Claude AI notes copied to clipboard",
    });
  };

  const handleExport = async (format: string) => {
    if (format === "Word") {
      try {
        // Clean content by removing numbered emoji bullets, unwanted phrases, and process HTML
        let content = notes
          .replace(/[1-4]️⃣\s*/g, '') // Remove numbered emojis
          .replace(/## \d+️⃣\s*/g, '') // Remove numbered emojis with headers
          .replace(/Certainly! Below is a more detailed and comprehensive version of your meeting minutes, with expanded context, thorough explanations, and clarification of key points\.\s*---?\s*/gi, '') // Remove unwanted phrase
          .replace(/<div[^>]*style="[^"]*color:\s*#0072CE[^"]*"[^>]*>(.*?)<\/div>/g, '**$1**') // Convert blue styled divs to bold
          .replace(/<div[^>]*>(.*?)<\/div>/g, '$1') // Remove other div tags
          .replace(/##\s*([^#\n]+)/g, '**$1**'); // Make section headers bold
        
        const lines = content.split('\n');
        const children = [];
        const tables = detectAndParseTable(content);
        
        let currentLineIndex = 0;
        
        // Process content with tables
        for (const table of tables) {
          // Add content before table
          while (currentLineIndex < table.startIndex) {
            const line = lines[currentLineIndex].trim();
            if (line) {
              const runs = [];
              let currentText = line;
              
              // Handle bold text
              while (currentText.includes('**')) {
                const beforeBold = currentText.substring(0, currentText.indexOf('**'));
                if (beforeBold) {
                  runs.push(new TextRun({ text: beforeBold }));
                }
                
                currentText = currentText.substring(currentText.indexOf('**') + 2);
                if (currentText.includes('**')) {
                  const boldText = currentText.substring(0, currentText.indexOf('**'));
                  runs.push(new TextRun({ text: boldText, bold: true }));
                  currentText = currentText.substring(currentText.indexOf('**') + 2);
                } else {
                  runs.push(new TextRun({ text: '**' + currentText }));
                  currentText = '';
                }
              }
              
              if (currentText) {
                runs.push(new TextRun({ text: currentText }));
              }
              
              children.push(new Paragraph({
                children: runs.length > 0 ? runs : [new TextRun({ text: line })],
                spacing: { after: 120 }
              }));
            } else {
              children.push(new Paragraph({
                children: [new TextRun({ text: "" })],
                spacing: { after: 120 }
              }));
            }
            currentLineIndex++;
          }
          
          // Add table
          children.push(createTableFromData(table.data));
          children.push(new Paragraph({
            children: [new TextRun({ text: "" })],
            spacing: { after: 240 }
          }));
          
          // Skip table lines
          currentLineIndex = table.endIndex + 1;
        }
        
        // Add remaining content after last table
        while (currentLineIndex < lines.length) {
          const line = lines[currentLineIndex].trim();
          if (line) {
            const runs = [];
            let currentText = line;
            
            // Handle bold text
            while (currentText.includes('**')) {
              const beforeBold = currentText.substring(0, currentText.indexOf('**'));
              if (beforeBold) {
                runs.push(new TextRun({ text: beforeBold }));
              }
              
              currentText = currentText.substring(currentText.indexOf('**') + 2);
              if (currentText.includes('**')) {
                const boldText = currentText.substring(0, currentText.indexOf('**'));
                runs.push(new TextRun({ text: boldText, bold: true }));
                currentText = currentText.substring(currentText.indexOf('**') + 2);
              } else {
                runs.push(new TextRun({ text: '**' + currentText }));
                currentText = '';
              }
            }
            
            if (currentText) {
              runs.push(new TextRun({ text: currentText }));
            }
            
            children.push(new Paragraph({
              children: runs.length > 0 ? runs : [new TextRun({ text: line })],
              spacing: { after: 120 }
            }));
          } else {
            children.push(new Paragraph({
              children: [new TextRun({ text: "" })],
              spacing: { after: 120 }
            }));
          }
          currentLineIndex++;
        }

        const doc = new Document({
          sections: [{
            properties: {
              page: {
                margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
              }
            },
            children
          }],
          creator: "Meeting Notes",
          title: "Meeting Summary",
          description: "Professional meeting notes export"
        });

        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `meeting-notes-${new Date().toISOString().split('T')[0]}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error exporting to Word:', error);
      }
    } else {
      console.log(`${format} Export - Meeting notes exported as ${format}`);
    }
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
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                variant="ghost" 
                size="sm" 
                className="touch-manipulation min-h-[44px] w-full sm:w-auto"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                {isEditing ? "Save & Preview" : "Edit Notes"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="touch-manipulation min-h-[44px] w-full sm:w-auto"
                onClick={() => setIsEmailModalOpen(true)}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            </div>
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
              <div 
                className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(notes) }}
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

        {/* Claude AI Meeting Notes Section */}
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Claude AI Meeting Notes</h3>
            <Badge variant="secondary" className="text-xs">
              <Bot className="h-3 w-3 mr-1" />
              AI Enhanced
            </Badge>
          </div>

          {/* Claude Detail Level Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Claude AI Detail Level</label>
            <Select value={claudeDetailLevel} onValueChange={handleClaudeDetailLevelChange}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard Detail</SelectItem>
                <SelectItem value="more">More Detailed</SelectItem>
                <SelectItem value="super">Maximum Detail</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Claude AI Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button 
              onClick={() => generateClaudeMeetingNotes()} 
              disabled={isClaudeGenerating || !transcript}
              variant="default"
              size="sm"
              className="w-full sm:w-auto touch-manipulation min-h-[44px]"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {isClaudeGenerating ? "Generating..." : "Generate with Claude AI"}
            </Button>
            
            {claudeNotes && (
              <>
                <Button 
                  onClick={() => setIsClaudeEditing(!isClaudeEditing)} 
                  variant="outline" 
                  size="sm"
                  className="w-full sm:w-auto touch-manipulation min-h-[44px]"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  {isClaudeEditing ? "Save" : "Edit"}
                </Button>
                <Button 
                  onClick={handleCopyClaudeNotes} 
                  variant="outline" 
                  size="sm"
                  className="w-full sm:w-auto touch-manipulation min-h-[44px]"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </>
            )}
          </div>

          {/* Claude AI Meeting Notes Display */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Claude AI Generated Notes</label>
            <div className="min-h-[200px] max-h-[600px] border rounded-lg p-3 bg-background overflow-auto">
              {claudeNotes ? (
                isClaudeEditing ? (
                  <Textarea 
                    value={claudeNotes}
                    onChange={(e) => setClaudeNotes(e.target.value)}
                    className="min-h-[300px] border-0 p-0 resize-none focus-visible:ring-0 text-sm"
                    placeholder="Claude AI generated notes will appear here..."
                  />
                ) : (
                  <div className="prose prose-sm max-w-none text-sm">
                    <div 
                      className="prose prose-sm max-w-none text-sm whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(claudeNotes) }}
                    />
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <div className="text-center">
                    <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Click "Generate with Claude AI" to create enhanced meeting notes</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <MeetingMinutesEmailModal
          isOpen={isEmailModalOpen}
          onOpenChange={setIsEmailModalOpen}
          defaultToEmail={user?.email || ""}
          defaultSubject={`Meeting Summary: ${meetingSettings?.title || "Meeting"} - ${new Date().toLocaleDateString()}`}
          defaultBody={notes.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()}
          meetingTitle={meetingSettings?.title || "Meeting"}
          meetingDate={new Date().toLocaleString()}
          duration={duration}
        />
      </CardContent>
    </Card>
  );
};