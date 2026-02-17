import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { sanitiseMeetingNotes } from "@/utils/sanitiseMeetingNotes";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { mergeLive } from "@/utils/TranscriptMerge";
import { detectDevice } from "@/utils/DeviceDetection";
import { BackupBadge } from "@/components/offline/BackupBadge";
import { MeetingMinutesEmailModal } from "@/components/MeetingMinutesEmailModal";
import { 
  Copy, 
  FileText, 
  Download,
  ExternalLink,
  Calendar,
  Clock,
  Users,
  RefreshCw,
  Share,
  RotateCcw,
  Loader2,
  Mail,
  X
} from "lucide-react";

interface Meeting {
  id: string;
  title: string;
  start_time: string;
  created_at: string;
  duration_minutes?: number;
  word_count?: number;
  notes_style_2?: string;
  notes_style_3?: string;
  notes_style_4?: string;
  notes_style_5?: string;
}

interface MobileNotesSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: Meeting | null;
  notes: string;
  initialTab?: 'notes' | 'transcript';
}

export const MobileNotesSheet: React.FC<MobileNotesSheetProps> = ({
  isOpen,
  onOpenChange,
  meeting,
  notes,
  initialTab
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab === 'transcript' ? 'transcript' : 'standard');
  
  // Update active tab when initialTab prop changes
  useEffect(() => {
    if (initialTab && isOpen) {
      setActiveTab(initialTab === 'transcript' ? 'transcript' : 'standard');
    }
  }, [initialTab, isOpen]);
  const isIOS = detectDevice().isIOS;
  const [notesStyle2, setNotesStyle2] = useState("");
  const [notesStyle3, setNotesStyle3] = useState("");
  const [notesStyle4, setNotesStyle4] = useState("");
  const [notesStyle5, setNotesStyle5] = useState("");
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [regenerating, setRegenerating] = useState<{
    brief: boolean;
    detailed: boolean;
    comprehensive: boolean;
    executive: boolean;
    creative: boolean;
    standard: boolean;
  }>({
    brief: false,
    detailed: false,
    comprehensive: false,
    executive: false,
    creative: false,
    standard: false,
  });
  const [sendingEmail, setSendingEmail] = useState<{
    executive: boolean;
    comprehensive: boolean;
    creative: boolean;
    transcript: boolean;
    standard: boolean;
  }>({
    executive: false,
    comprehensive: false,
    creative: false,
    transcript: false,
    standard: false,
  });
  
  // Email modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailModalContent, setEmailModalContent] = useState({ 
    subject: '', 
    body: '', 
    toEmail: '' 
  });

  // Load existing note styles from database
  const loadExistingNoteStyles = async () => {
    if (!meeting?.id || !user?.id) return;

    setLoading(true);
    try {
      const { data: meetingData, error } = await supabase
        .from('meetings')
        .select('notes_style_2, notes_style_3, notes_style_4, notes_style_5')
        .eq('id', meeting.id)
        .single();

      if (error) {
        console.error('Error loading note styles:', error);
        return;
      }

      if (meetingData) {
        setNotesStyle2(meetingData.notes_style_2 || "");
        setNotesStyle3(meetingData.notes_style_3 || "");
        setNotesStyle4(meetingData.notes_style_4 || "");
        setNotesStyle5(meetingData.notes_style_5 || "");
      }
    } catch (error) {
      console.error('Error loading note styles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load notes and transcript when sheet opens
  useEffect(() => {
    if (isOpen && meeting?.id && user?.id) {
      loadExistingNoteStyles();
      fetchTranscriptData();
    }
  }, [isOpen, meeting?.id, user?.id]);

  // Fetch transcript data
  const fetchTranscriptData = async () => {
    if (!meeting?.id) return;
    
    setIsLoadingTranscript(true);
    try {
      let finalTranscript = '';

      // 1) Try chunks first (if present, best fidelity with timestamps)
      try {
        const { data: chunks, error } = await supabase
          .from('meeting_transcription_chunks')
          .select('transcription_text, chunk_number')
          .eq('meeting_id', meeting.id)
          .order('chunk_number', { ascending: true });

        if (!error && chunks && chunks.length > 0) {
          const allSegments = chunks.flatMap(chunk => {
            try {
              const parsed = JSON.parse(chunk.transcription_text || '[]');
              if (Array.isArray(parsed) && parsed.length > 0) return parsed;
              return chunk.transcription_text ? [{ start: 0, end: 1, text: chunk.transcription_text }] : [];
            } catch {
              return chunk.transcription_text ? [{ start: 0, end: 1, text: chunk.transcription_text }] : [];
            }
          });

          const { mergeByTimestamps, segmentsToPlainText } = await import('@/lib/segmentMerge');
          const mergedSegments = mergeByTimestamps([], allSegments);
          finalTranscript = segmentsToPlainText(mergedSegments) || '';
        }
      } catch (e) {
        console.warn('Chunk fetch failed, will try RPC fallback');
      }

      // 2) Comprehensive RPC fallback (handles meeting_transcripts and legacy chunks)
      if (!finalTranscript) {
        try {
          const { data: rpcRows, error: rpcError } = await supabase.rpc('get_meeting_full_transcript', { p_meeting_id: meeting.id });
          if (!rpcError && Array.isArray(rpcRows) && rpcRows.length > 0) {
            finalTranscript = (rpcRows[0]?.transcript as string) || '';
          }
        } catch (e) {
          console.warn('RPC get_meeting_full_transcript failed, will try direct table fallbacks');
        }
      }

      // 3) Direct meeting_transcripts table
      if (!finalTranscript) {
        try {
          const { data: rows, error } = await supabase
            .from('meeting_transcripts')
            .select('content')
            .eq('meeting_id', meeting.id)
            .order('created_at', { ascending: true });
          if (!error && rows && rows.length > 0) {
            finalTranscript = rows.map(r => r.content).join('\n\n');
          }
        } catch (e) {
          console.warn('Fallback meeting_transcripts failed');
        }
      }

      // 4) meetings.live_transcript_text immediate display field
      if (!finalTranscript) {
        try {
          const { data: meet } = await supabase
            .from('meetings')
            .select('live_transcript_text')
            .eq('id', meeting.id)
            .single();
          finalTranscript = meet?.live_transcript_text || '';
        } catch (e) {
          // ignore
        }
      }

      setTranscript(finalTranscript);
    } catch (error) {
      console.error('Error fetching transcript:', error);
      setTranscript('');
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  // Copy text to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (!isIOS) {
        toast.success('Notes copied to clipboard');
      }
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy notes');
    }
  };

  // Open in new tab for full view
  const openInNewTab = () => {
    const content = getCurrentTabContent();
    const formattedContent = formatContent(content);
    const title = meeting?.title || 'Meeting Notes';
    const tabName = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - ${tabName}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            color: #1a1a1a;
          }
          h1, h2, h3 { margin-top: 24px; margin-bottom: 12px; }
          h1 { font-size: 24px; color: #1a1a1a; }
          h2 { font-size: 20px; color: #1a1a1a; }
          h3 { font-size: 16px; color: #1a1a1a; }
          p { margin-bottom: 12px; color: #1a1a1a; }
          strong { font-weight: 600; color: #1a1a1a; }
          em { color: #6b7280; }
          .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 24px; }
          .content { line-height: 1.7; }
          .list-item { display: flex; align-items: flex-start; gap: 8px; margin: 4px 0; }
          .bullet { color: #3b82f6; font-weight: bold; }
          @media (prefers-color-scheme: dark) {
            body { background-color: #1a1a1a; color: #e5e7eb; }
            h1, h2, h3, p, strong { color: #e5e7eb; }
            em { color: #9ca3af; }
            .header { border-bottom-color: #374151; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <p><strong>Type:</strong> ${tabName} Notes</p>
          ${meeting?.start_time ? `<p><strong>Date:</strong> ${formatDate(meeting.start_time)}</p>` : ''}
        </div>
        <div class="content">
          ${formattedContent}
        </div>
      </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  // Get current tab content
  const getCurrentTabContent = () => {
    switch (activeTab) {
      case "standard":
        return notes;
      case "brief":
        return notes;
      case "detailed":
        return notesStyle2;
      case "comprehensive":
        return notesStyle3;
      case "executive":
        return notesStyle4;
      case "creative":
        return notesStyle5;
      case "transcript":
        return transcript;
      default:
        return notes;
    }
  };

  // Format content for better display
  const formatContent = (content: string) => {
    if (!content) return '';
    
    // Normalize line breaks first
    let processedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Parse markdown tables with flexible regex that handles various formats
    const tableRegex = /(\|[^\n]+\|)\n(\|[\s\-:]+\|)\n((?:\|[^\n]+\|\n?)+)/g;
    
    processedContent = processedContent.replace(tableRegex, (match, headerRow, separatorRow, bodyRows) => {
      // Parse headers
      const headers = headerRow
        .split('|')
        .map((h: string) => h.trim())
        .filter((h: string) => h.length > 0);
      
      // If no valid headers, return original
      if (headers.length === 0) return match;
      
      // Parse body rows
      const rows = bodyRows
        .trim()
        .split('\n')
        .map((row: string) => 
          row.split('|')
            .map((cell: string) => cell.trim())
            .filter((cell: string) => cell.length > 0)
        )
        .filter((row: string[]) => row.length > 0);
      
      // Build mobile-optimized table
      let tableHtml = '<div style="overflow-x: auto; margin: 16px 0; -webkit-overflow-scrolling: touch; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">';
      tableHtml += '<table style="width: 100%; min-width: 400px; border-collapse: collapse; font-size: 13px; background: white;">';
      
      // Header
      tableHtml += '<thead><tr style="background: #005EB8; color: white;">';
      headers.forEach((header: string) => {
        tableHtml += `<th style="border: 1px solid #ddd; padding: 12px 10px; text-align: left; font-weight: 600; white-space: nowrap;">${header}</th>`;
      });
      tableHtml += '</tr></thead>';
      
      // Body
      tableHtml += '<tbody>';
      rows.forEach((row: string[], index: number) => {
        const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        tableHtml += `<tr style="background: ${bgColor}; border-bottom: 1px solid #e2e8f0;">`;
        row.forEach((cell: string, cellIndex: number) => {
          // Ensure we don't have more cells than headers
          if (cellIndex < headers.length) {
            tableHtml += `<td style="border: 1px solid #e2e8f0; padding: 10px; color: #334155;">${cell}</td>`;
          }
        });
        // Fill missing cells if row is shorter than headers
        for (let i = row.length; i < headers.length; i++) {
          tableHtml += `<td style="border: 1px solid #e2e8f0; padding: 10px; color: #94a3b8;">-</td>`;
        }
        tableHtml += '</tr>';
      });
      tableHtml += '</tbody></table></div>';
      
      return tableHtml;
    });
    
    // Enhanced markdown parsing for better mobile display
    return processedContent
      // Handle headings first (must be at start of line or after line break)
      .replace(/(^|\n)### ([^\n]+)/g, '$1<h3 class="text-base font-semibold mt-4 mb-2 text-foreground">$2</h3>')
      .replace(/(^|\n)## ([^\n]+)/g, '$1<h2 class="text-lg font-bold mt-6 mb-3 text-foreground">$2</h2>')
      .replace(/(^|\n)# ([^\n]+)/g, '$1<h1 class="text-xl font-bold mt-6 mb-4 text-foreground">$2</h1>')
      // Handle bold and italic
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em class="italic text-muted-foreground">$1</em>')
      // Handle lists
      .replace(/(^|\n)- ([^\n]+)/g, '$1<div class="flex items-start gap-2 my-1"><span class="text-primary">•</span><span class="flex-1">$2</span></div>')
      // Handle line breaks and paragraphs
      .replace(/\n\n/g, '</p><p class="mb-3 text-foreground leading-relaxed">')
      .replace(/\n/g, '<br/>')
      // Wrap in paragraph
      .replace(/^/, '<div class="prose prose-sm max-w-none"><p class="mb-3 text-foreground leading-relaxed">')
      .replace(/$/, '</p></div>');
  };

  // Download notes as text file
  const downloadNotes = () => {
    const content = getCurrentTabContent();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting?.title || 'Meeting'}_Notes_${activeTab}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (!isIOS) {
      toast.success('Notes downloaded');
    }
  };

  // Format content for sharing (converts markdown to readable plain text)
  const formatContentForSharing = (content: string) => {
    if (!content) return '';
    
    return content
      // Remove all heading markers (# ## ###) and clean up
      .replace(/^#{1,6}\s+(.+)$/gm, '$1')
      .replace(/(\n)#{1,6}\s+(.+)$/gm, '$1$2')
      // Remove bold markers completely
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      // Remove italic markers
      .replace(/\*([^*]+)\*/g, '$1')
      // Convert bullet points to clean format
      .replace(/^-\s+(.+)$/gm, '• $1')
      .replace(/(\n)-\s+(.+)$/gm, '$1• $2')
      // Clean up multiple consecutive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Remove leading/trailing whitespace from each line
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      // Final cleanup
      .trim();
  };

  // Share using Web Share API if available
  const shareNotes = async () => {
    const rawContent = getCurrentTabContent();
    const formattedContent = formatContentForSharing(rawContent);
    const title = meeting?.title || 'Meeting Notes';
    const tabName = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
    
    const shareContent = `${title} - ${tabName} Notes\n${meeting?.start_time ? `Date: ${formatDate(meeting.start_time)}\n` : ''}\n${formattedContent}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${title} - ${tabName} Notes`,
          text: shareContent,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          copyToClipboard(shareContent);
        }
      }
    } else {
      copyToClipboard(shareContent);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleDateString('en-GB', { month: 'short' });
    const year = date.getFullYear();
    const time = date.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    return `${day} ${month} ${year} at ${time}`;
  };

  // Send email for specific tab - now opens modal instead of sending directly
  const openEmailModal = (tabType: 'executive' | 'comprehensive' | 'creative' | 'transcript' | 'standard') => {
    const content = sanitiseMeetingNotes(getCurrentTabContent());
    if (!content || content.trim().length === 0) {
      toast.error('No content available to send');
      return;
    }

    const tabNames = {
      standard: 'Meeting Minutes - Standard View',
      executive: 'Executive Summary',
      comprehensive: 'Very Detailed Minutes',
      creative: 'Creative Summary',
      transcript: 'Meeting Transcript'
    };

    const tabName = tabNames[tabType];
    const emailSubject = `${tabName} - ${meeting?.title || 'Meeting Notes'}`;

    setEmailModalContent({
      subject: emailSubject,
      body: content,
      toEmail: user?.email || ''
    });
    setEmailModalOpen(true);
  };

  // Regenerate notes functions
  const regenerateNotes = async (noteType: keyof typeof regenerating) => {
    if (!meeting?.id || !user?.id) return;

    setRegenerating(prev => ({ ...prev, [noteType]: true }));

    try {
      let result;
      
      switch (noteType) {
        case 'standard':
          // Use the same function as desktop (generate-meeting-notes-claude)
          const meetingDate = meeting.start_time ? new Date(meeting.start_time).toLocaleDateString('en-GB') : '';
          const meetingTime = meeting.start_time ? new Date(meeting.start_time).toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }) : '';

          result = await supabase.functions.invoke('generate-meeting-notes-claude', {
            body: {
              transcript: transcript,
              meetingTitle: meeting.title,
              meetingDate: meetingDate,
              meetingTime: meetingTime,
              detailLevel: 'standard'
            }
          });
          break;
        case 'brief':
        case 'detailed':
        case 'comprehensive':
        case 'executive':
          // Use generate-multi-type-notes for all note types except creative
          const noteTypeMapping = {
            'brief': 'brief',
            'detailed': 'detailed', 
            'comprehensive': 'comprehensive',
            'executive': 'executive'
          };
          
          result = await supabase.functions.invoke('generate-notes-styles', {
            body: { 
              meetingIds: [meeting.id],
              styles: [noteTypeMapping[noteType]],
              forceRegenerate: true 
            }
          });
          break;
          
        case 'creative':
          // Use generate-limerick-notes for creative notes
          result = await supabase.functions.invoke('generate-limerick-notes', {
            body: { meetingIds: [meeting.id] }
          });
          break;
      }

      if (result.error) {
        console.error(`Error regenerating ${noteType} notes:`, result.error);
        toast.error(`Failed to regenerate ${noteType} notes: ${result.error.message}`);
        return;
      }

      // Reload the notes to get the updated content
      await loadExistingNoteStyles();
      if (!isIOS) {
        toast.success(`${noteType.charAt(0).toUpperCase() + noteType.slice(1)} notes generated successfully!`);
      }

    } catch (error) {
      console.error(`Error regenerating ${noteType} notes:`, error);
      toast.error(`Failed to regenerate ${noteType} notes`);
    } finally {
      setRegenerating(prev => ({ ...prev, [noteType]: false }));
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="p-4 pb-3 border-b flex-shrink-0">
            <SheetTitle className="text-lg font-semibold text-left">
              {meeting?.title || 'Meeting Notes'}
            </SheetTitle>
            <SheetDescription className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {meeting?.start_time ? formatDate(meeting.start_time) : 'N/A'}
              </span>
            </SheetDescription>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 pb-2 border-b flex-shrink-0">
              <TabsList className="grid w-full grid-cols-2 h-10">
                <TabsTrigger value="standard" className="text-xs px-2 font-medium">Standard</TabsTrigger>
                <TabsTrigger value="transcript" className="text-xs px-2 font-medium">Transcript</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4 pb-8">
                  <TabsContent value="standard" className="mt-0">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-semibold text-foreground">Meeting Minutes - Standard View</h3>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEmailModal('standard')}
                          disabled={!notes}
                          className="h-8 px-2 text-xs"
                          title="Email this summary"
                        >
                          <Mail className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => regenerateNotes('standard')}
                          disabled={regenerating.standard}
                          className="h-8 px-2 text-xs"
                        >
                          {regenerating.standard ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          <span className="ml-1">
                            {regenerating.standard ? 'Generating...' : 'Regenerate'}
                          </span>
                        </Button>
                      </div>
                    </div>
                    <div className="bg-card rounded-lg border p-4">
                      {notes ? (
                        <div
                          className="text-sm leading-relaxed space-y-2"
                          dangerouslySetInnerHTML={{ __html: formatContent(sanitiseMeetingNotes(notes)) }}
                        />
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground mb-4 text-sm">
                            No standard minutes available
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => regenerateNotes('standard')}
                            disabled={regenerating.standard}
                            className="text-xs"
                          >
                            Generate Standard Minutes
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="transcript" className="mt-0">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">Meeting Transcript</h3>
                        {meeting?.id && <BackupBadge meetingId={meeting.id} />}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEmailModal('transcript')}
                          disabled={!transcript}
                          className="h-8 px-2 text-xs"
                          title="Email this transcript"
                        >
                          <Mail className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {transcript && (
                      <div className="flex gap-4 mb-3 text-xs text-muted-foreground">
                        {meeting?.duration_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {meeting.duration_minutes} min
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {transcript.split(/\s+/).filter(word => word.length > 0).length} words
                        </span>
                      </div>
                    )}
                    <div className="bg-card rounded-lg border p-4">
                      {isLoadingTranscript ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                          <span className="text-sm text-muted-foreground">Loading transcript...</span>
                        </div>
                      ) : transcript ? (
                        <div 
                          className="text-sm leading-relaxed whitespace-pre-wrap text-foreground font-sans"
                          style={{ lineHeight: '1.8' }}
                        >
                          {transcript}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground text-sm">
                            No transcript available for this meeting
                          </p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </div>
              </ScrollArea>
            </div>

            {/* Action buttons */}
            <div className="border-t pt-3 pb-2 px-3">
              <div className="grid grid-cols-3 gap-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={shareNotes}
                  disabled={!getCurrentTabContent()}
                >
                  <Share className="h-4 w-4 mr-1" />
                  Share
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadNotes}
                  disabled={!getCurrentTabContent()}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={openInNewTab}
                  disabled={!getCurrentTabContent()}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Full
                </Button>
              </div>
              
              <Button
                variant="default"
                size="lg"
                onClick={() => onOpenChange(false)}
                className="w-full font-semibold"
              >
                Close
              </Button>
            </div>
          </Tabs>
        </div>
      </SheetContent>
      
      <MeetingMinutesEmailModal
        isOpen={emailModalOpen}
        onOpenChange={setEmailModalOpen}
        defaultToEmail={emailModalContent.toEmail}
        defaultSubject={emailModalContent.subject}
        defaultBody={emailModalContent.body}
        meetingTitle={meeting?.title || 'Meeting'}
        meetingDate={meeting?.start_time ? new Date(meeting.start_time).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}
        meetingId={meeting?.id}
      />
    </Sheet>
  );
};