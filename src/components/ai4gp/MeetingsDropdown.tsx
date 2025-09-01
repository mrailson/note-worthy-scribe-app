import React, { useState } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Calendar, FileText, Copy, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useMeetingExport } from '@/hooks/useMeetingExport';
import { useToast } from '@/hooks/use-toast';
import { MeetingData } from '@/types/meetingTypes';
import { supabase } from '@/integrations/supabase/client';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

interface MeetingsDropdownProps {
  meetings: any[];
  isLoading: boolean;
}

export const MeetingsDropdown: React.FC<MeetingsDropdownProps> = ({
  meetings,
  isLoading,
}) => {
  const navigate = useNavigate();
  const [processingActions, setProcessingActions] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // Mock meeting data for export functions
  const mockMeetingSettings = {
    title: '',
    description: '',
    meetingType: '',
    meetingStyle: '',
    attendees: '',
    agenda: '',
    transcriberService: 'whisper' as const,
    transcriberThresholds: { whisper: 0.5, deepgram: 0.7 }
  };

  const { copyToClipboard } = useMeetingExport(null, mockMeetingSettings);

  // Advanced Word export with full formatting (from FullPageNotesModal.tsx)
  const generateAdvancedWordDocument = async (content: string, title: string) => {
    try {
      console.log('🔍 Generating full-featured Word document with formatting!');
      toast({ title: 'Generating Word document...', description: 'Please wait while we format your document.' });
      
      // Clean and format content for professional Word document
      const stripHtmlAndFormat = (htmlContent: string) => {
        if (!htmlContent) return [];
        
        // Clean HTML but preserve basic structure
        let cleanText = htmlContent
          // Convert HTML breaks to newlines first
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<p[^>]*>/gi, '')
          // Remove all other HTML tags
          .replace(/<[^>]*>/g, '')
          // Decode HTML entities
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&apos;/g, "'")
          // Clean up excessive whitespace but preserve structure
          .replace(/[ \t]+/g, ' ')
          .replace(/\n[ \t]+/g, '\n')
          .replace(/[ \t]+\n/g, '\n')
          .trim();

        const paragraphs = [];
        const lines = cleanText.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // Skip empty lines but add spacing
          if (!line) {
            paragraphs.push(new Paragraph({
              children: [new TextRun({ text: "", size: 12 })],
              spacing: { after: 120 }
            }));
            continue;
          }
          
          // Detect different types of content
          const isEmojiHeader = /^[1-9]️⃣/.test(line);
          const isNumberedSection = /^##?\s*\d+\.?\s/.test(line);
          const isMainHeader = /^#\s/.test(line) || (line.includes('MEETING') && line.length < 100);
          const isBulletPoint = /^[-•*]\s/.test(line);
          const isHeader = isEmojiHeader || isNumberedSection || isMainHeader;
          
          // Clean and format the text
          let displayText = line;
          
          // Remove ALL hash symbols and markdown formatting
          displayText = displayText.replace(/^#+\s*/, ''); // Remove any number of # at start
          displayText = displayText.replace(/\*\*([^*]+)\*\*/g, '$1'); // Remove **bold**
          displayText = displayText.replace(/\*([^*]+)\*/g, '$1'); // Remove *italic*
          
          if (isBulletPoint) {
            // Format bullet points
            const bulletText = displayText.replace(/^[-•*]\s*/, '');
            paragraphs.push(new Paragraph({
              children: [
                new TextRun({ text: "• ", size: 22 }),
                new TextRun({ text: bulletText, size: 22 })
              ],
              spacing: { after: 100 },
              indent: { left: 360 }
            }));
          } else if (isHeader) {
            // Format headers
            paragraphs.push(new Paragraph({
              children: [new TextRun({
                text: displayText,
                bold: true,
                size: isMainHeader ? 24 : 22,
                color: "1f2937"
              })],
              spacing: { 
                before: 200,
                after: 120
              }
            }));
          } else {
            // Regular paragraph
            paragraphs.push(new Paragraph({
              children: [new TextRun({
                text: displayText,
                size: 22
              })],
              spacing: { after: 120 }
            }));
          }
        }
        
        return paragraphs;
      };
      
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1440,    // 1 inch
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          children: [
            // Title
            new Paragraph({
              children: [
                new TextRun({
                  text: title,
                  bold: true,
                  size: 36,
                  color: "1f2937"
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 480 }
            }),
            
            // Meeting Details
            new Paragraph({
              children: [
                new TextRun({
                  text: "Date: ",
                  bold: true,
                  size: 24,
                  color: "1f2937"
                }),
                new TextRun({
                  text: new Date().toLocaleDateString(),
                  size: 24,
                  color: "374151"
                }),
              ],
              spacing: { after: 360 }
            }),
            
            // Content Section
            ...stripHtmlAndFormat(content),
            
            // Footer
            new Paragraph({
              children: [
                new TextRun({
                  text: `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
                  italics: true,
                  size: 18,
                  color: "6b7280"
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 480 }
            }),
          ],
        }],
      });
      
      console.log('🔍 Document created, converting to blob...');
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toLocaleDateString()}.docx`);
      toast({ title: 'Success!', description: 'Word document downloaded successfully!' });
      
    } catch (error) {
      console.error('Word generation error:', error);
      toast({ title: 'Error', description: 'Failed to generate Word document', variant: 'destructive' });
    }
  };

  const handleAction = async (actionType: string, meeting: any, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const actionKey = `${meeting.id}-${actionType}`;
    setProcessingActions(prev => ({ ...prev, [actionKey]: true }));

    try {
      if (actionType === 'word') {
        // Try to fetch meeting notes from multiple sources
        let notesContent = '';
        let notesTitle = '';

        // First try meeting_summaries table
        const { data: summaryData, error: summaryError } = await supabase
          .from('meeting_summaries')
          .select('summary')
          .eq('meeting_id', meeting.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (summaryData?.summary) {
          notesContent = summaryData.summary;
          notesTitle = 'Meeting Summary';
        } else {
          // Fallback to meeting_auto_notes if available
          const { data: autoNotesData, error: autoNotesError } = await supabase
            .from('meeting_auto_notes')
            .select('generated_notes')
            .eq('meeting_id', meeting.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (autoNotesData?.generated_notes) {
            notesContent = autoNotesData.generated_notes;
            notesTitle = 'Generated Meeting Notes';
          }
        }

        if (!notesContent) {
          toast({
            title: "No Meeting Notes Found",
            description: "No generated meeting notes or summaries available for this meeting.",
            variant: "destructive",
          });
          return;
        }

        // Generate Word document with meeting notes
        await generateAdvancedWordDocument(notesContent, `${meeting.title || 'Meeting'} - ${notesTitle}`);
        toast({
          title: "Word Document Generated",
          description: "Meeting notes have been downloaded as a Word document.",
        });
      } else if (actionType === 'copy') {
        // Fetch and copy transcript to clipboard
        const { data: transcriptData, error } = await supabase
          .from('meeting_transcripts')
          .select('content')
          .eq('meeting_id', meeting.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error || !transcriptData?.content) {
          toast({
            title: "No Transcript Found",
            description: "No transcript content available for this meeting.",
            variant: "destructive",
          });
          return;
        }

        await copyToClipboard(transcriptData.content);
        toast({
          title: "Transcript Copied",
          description: "Meeting transcript has been copied to your clipboard.",
        });
      } else if (actionType === 'trigger') {
        // Manually trigger note generation
        console.log('🔧 Manual trigger for meeting:', meeting.id);
        
        // First check if meeting has completed status and transcript
        if (meeting.status !== 'completed') {
          toast({
            title: "Cannot Generate Notes",
            description: "Meeting must be completed to generate notes.",
            variant: "destructive",
          });
          return;
        }

        const { data, error } = await supabase.functions.invoke('auto-generate-meeting-notes', {
          body: { meetingId: meeting.id, forceRegenerate: true }
        });

        if (error) {
          console.error('❌ Failed to trigger notes generation:', error);
          toast({
            title: "Generation Failed",
            description: "Failed to trigger note generation. Please try again.",
            variant: "destructive",
          });
        } else {
          console.log('✅ Notes generation triggered successfully:', data);
          toast({
            title: "Notes Generation Started",
            description: "Meeting notes are being generated. This may take a few minutes.",
          });
        }
      }
    } catch (error) {
      console.error(`Error performing ${actionType} action:`, error);
      toast({
        title: "Action Failed",
        description: `Failed to ${actionType} meeting data. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setProcessingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const formatMeetingDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'EEEE, d MMM yyyy HH:mm');
    } catch (error) {
      return dateString;
    }
  };

  const formatDuration = (duration: string | number | null) => {
    if (!duration) return '0 min';
    const durationNum = typeof duration === 'string' ? parseInt(duration) : duration;
    return `${durationNum} min`;
  };

  const handleMeetingClick = (meeting: any, event: React.MouseEvent) => {
    event.preventDefault();
    navigate('/meetings', { state: { scrollToMeetingId: meeting.id } });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="ml-1 px-2 sm:px-3"
        >
          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
          <span className="hidden sm:inline text-xs">My Meetings</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-80 sm:w-96 max-h-[60vh] overflow-y-auto"
        align="end"
        sideOffset={5}
      >
        <DropdownMenuLabel>Recent Meetings</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {isLoading ? (
          <DropdownMenuItem disabled className="justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Loading meetings...
          </DropdownMenuItem>
        ) : meetings.length === 0 ? (
          <DropdownMenuItem disabled className="py-4">
            <div className="text-center w-full text-muted-foreground">
              No recent meetings found
            </div>
          </DropdownMenuItem>
        ) : (
          meetings.map((meeting) => (
            <DropdownMenuItem 
              key={meeting.id} 
              className="p-0 focus:bg-accent"
              onSelect={(e) => e.preventDefault()}
            >
              <div className="w-full p-3 space-y-2">
                {/* Meeting Title - clickable */}
                <button
                  onClick={(e) => handleMeetingClick(meeting, e)}
                  className="w-full text-left hover:underline focus:underline outline-none"
                >
                  <div className="font-medium text-sm truncate">
                    {meeting.title || 'Untitled Meeting'}
                  </div>
                </button>
                
                {/* Meeting Details */}
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>{formatMeetingDate(meeting.start_time || meeting.created_at)}</div>
                  <div className="flex items-center justify-between">
                    {meeting.status === 'completed' ? (
                      meeting.word_count && meeting.word_count > 0 ? (
                        <span>{formatDuration(meeting.duration_minutes)} • {meeting.word_count >= 1000 
                          ? `${(meeting.word_count / 1000).toFixed(1)}K words`
                          : `${meeting.word_count} words`}</span>
                      ) : (
                        <span className="text-muted-foreground">{formatDuration(meeting.duration_minutes)} • Completed</span>
                      )
                    ) : (
                      <span className="text-amber-600">Awaiting Processing</span>
                    )}
                    
                     {/* Action Buttons - Show for completed meetings */}
                     {meeting.status === 'completed' && (
                       <div className="flex gap-1">
                         <button
                           onClick={(e) => handleAction('word', meeting, e)}
                           disabled={processingActions[`${meeting.id}-word`]}
                           className="p-1 hover:bg-accent rounded transition-colors"
                           title="Download Word"
                         >
                           {processingActions[`${meeting.id}-word`] ? (
                             <Loader2 className="w-3 h-3 animate-spin" />
                           ) : (
                             <FileText className="w-3 h-3" />
                           )}
                         </button>
                         <button
                           onClick={(e) => handleAction('copy', meeting, e)}
                           disabled={processingActions[`${meeting.id}-copy`]}
                           className="p-1 hover:bg-accent rounded transition-colors"
                           title="Copy Transcript"
                         >
                           {processingActions[`${meeting.id}-copy`] ? (
                             <Loader2 className="w-3 h-3 animate-spin" />
                           ) : (
                             <Copy className="w-3 h-3" />
                           )}
                         </button>
                       </div>
                     )}
                  </div>
                </div>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};