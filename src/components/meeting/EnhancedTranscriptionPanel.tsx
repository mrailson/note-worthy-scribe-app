import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Clock, ChevronDown, ChevronUp, FileText, Users, Sparkles, 
  AlertTriangle, Copy, Eye, EyeOff, BarChart3, Trash2, Check, X, Type, Minus, Plus, FilePlus2, Download, MoreVertical
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { removeFillerWords, countFillerWords, type FillerWordStats } from '@/utils/fillerWordCleaner';
import { detectPII, highlightPII, maskPII, removePII, type PIIMatch } from '@/utils/piiDetector';
import { cleanTranscript } from '@/lib/transcriptCleaner';
import { NHS_DEFAULT_RULES } from '@/lib/nhsDefaultRules';
import { toast } from 'sonner';
import { useIsIPhone, useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { TranscriptContextDialog } from '@/components/meeting/TranscriptContextDialog';
import { formatTranscriptContext, extractCleanContent } from '@/utils/meeting/formatTranscriptContext';
import { UploadedFile } from '@/types/ai4gp';
import { Document, Paragraph, TextRun, Packer } from 'docx';
import { saveAs } from 'file-saver';

interface TranscriptionChunk {
  id: string;
  chunk_number: number;
  transcription_text: string;
  cleaned_text: string | null;
  confidence: number;
  created_at: string;
  word_count: number;
}

interface EnhancedTranscriptionPanelProps {
  meetingId: string;
  transcript: string;
  onTranscriptChange: (newTranscript: string) => void;
  meetingContext?: any;
}

export const EnhancedTranscriptionPanel: React.FC<EnhancedTranscriptionPanelProps> = ({
  meetingId,
  transcript,
  onTranscriptChange,
  meetingContext
}) => {
  const isIPhone = useIsIPhone();
  const isMobile = useIsMobile();
  
  const [chunks, setChunks] = useState<TranscriptionChunk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI State
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [showConfidence, setShowConfidence] = useState(false);
  const [showPII, setShowPII] = useState(false); // Disabled by default - user must explicitly enable
  const [showToggles, setShowToggles] = useState(false); // Collapsed by default
  const [showContext, setShowContext] = useState(!isMobile); // Collapsed by default on mobile
  const [showStats, setShowStats] = useState(false); // Collapsed by default
  const [showPIIPanel, setShowPIIPanel] = useState(!isMobile); // Collapsible on mobile
  const [fontSize, setFontSize] = useState(15); // Default font size in pixels
  
  // PII State
  const [piiMatches, setPiiMatches] = useState<PIIMatch[]>([]);
  const [selectedPII, setSelectedPII] = useState<Set<number>>(new Set());
  
  // Context Dialog State
  const [showContextDialog, setShowContextDialog] = useState(false);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [transcriptHistory, setTranscriptHistory] = useState<string[]>([]);
  
  // Format state
  const [isFormatting, setIsFormatting] = useState(false);
  
  // Fetch chunks
  useEffect(() => {
    if (!meetingId) return;
    
    const fetchChunks = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('meeting_transcription_chunks')
          .select('*')
          .eq('meeting_id', meetingId)
          .order('chunk_number', { ascending: true });
        
        if (error) throw error;
        setChunks(data || []);
      } catch (error) {
        console.error('Error fetching chunks:', error);
        toast.error('Failed to load transcription chunks');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchChunks();
  }, [meetingId]);

  // Detect PII whenever transcript changes
  useEffect(() => {
    if (transcript && showPII) {
      const result = detectPII(transcript);
      setPiiMatches(result.matches);
    }
  }, [transcript, showPII]);

  // Calculate statistics
  const stats = useMemo(() => {
    const wordCount = transcript.trim().split(/\s+/).filter(w => w.length > 0).length;
    const fillerStats = countFillerWords(transcript);
    const avgConfidence = chunks.length > 0 
      ? chunks.reduce((sum, c) => sum + (c.confidence || 0), 0) / chunks.length 
      : 0;
    const lowConfidenceCount = chunks.filter(c => c.confidence < 0.7).length;
    
    return {
      wordCount,
      totalChunks: chunks.length,
      avgConfidence: Math.round(avgConfidence * 100),
      lowConfidenceCount,
      fillerWordCount: fillerStats.totalRemoved,
      piiCount: piiMatches.length
    };
  }, [transcript, chunks, piiMatches]);

  // Parse context from transcript
  const contextData = useMemo(() => {
    if (!meetingContext && !transcript) return null;
    
    const agendaMatch = transcript.match(/📋\s*MEETING\s*AGENDA:?\s*\n([\s\S]*?)(?=\n\n|$)/i);
    const attendeesMatch = transcript.match(/👥\s*ATTENDEES:?\s*\n([\s\S]*?)(?=\n\n|$)/i);
    
    return {
      agenda: agendaMatch ? agendaMatch[1].trim() : null,
      attendees: attendeesMatch ? attendeesMatch[1].trim().split('\n').filter(Boolean) : []
    };
  }, [transcript, meetingContext]);

  // Quick Actions
  const handleCleanTranscript = () => {
    // Save current transcript to history before cleaning
    setTranscriptHistory(prev => [...prev, transcript]);
    
    let cleanedText = transcript;
    
    // Remove filler words only (no redaction)
    const { cleaned: fillerCleaned, stats: fillerStats } = removeFillerWords(cleanedText);
    
    // Clean medical terms
    const nhsResult = cleanTranscript(fillerCleaned, NHS_DEFAULT_RULES);
    
    // Apply the final cleaned transcript
    onTranscriptChange(nhsResult.cleaned);
    
    const changes = [];
    if (fillerStats.totalRemoved > 0) changes.push(`${fillerStats.totalRemoved} filler words`);
    if (nhsResult.appliedRuleIds.length > 0) changes.push(`${nhsResult.appliedRuleIds.length} NHS terms`);
    
    toast.success(changes.length > 0 ? `Cleaned transcript: ${changes.join(' + ')}` : 'Transcript cleaned');
  };

  const handleMaskAllPII = () => {
    let maskedText = transcript;
    // Apply masks in reverse order to preserve indices
    for (let i = piiMatches.length - 1; i >= 0; i--) {
      maskedText = maskPII(maskedText, piiMatches[i]);
    }
    onTranscriptChange(maskedText);
    toast.success(`Masked ${piiMatches.length} PII instances`);
  };

  const handleMaskSelectedPII = () => {
    let maskedText = transcript;
    const selectedMatches = piiMatches.filter((_, i) => selectedPII.has(i));
    
    for (let i = selectedMatches.length - 1; i >= 0; i--) {
      maskedText = maskPII(maskedText, selectedMatches[i]);
    }
    onTranscriptChange(maskedText);
    setSelectedPII(new Set());
    toast.success(`Masked ${selectedMatches.length} selected PII instances`);
  };

  const handleAddContext = (
    contextTypes: Array<'agenda' | 'attendees' | 'presentation' | 'other' | 'additional-transcript'>,
    files: UploadedFile[],
    customLabel?: string
  ) => {
    // Clean the content from file processors
    const cleanedFiles = files.map(file => ({
      ...file,
      content: extractCleanContent(file.content || '')
    }));

    // Check if this is an "additional-transcript" type
    if (contextTypes.includes('additional-transcript')) {
      // Extract just the content and append it directly
      const additionalContent = cleanedFiles.map(file => file.content || '').join('\n\n');
      const updatedTranscript = transcript + '\n\n' + additionalContent;
      onTranscriptChange(updatedTranscript);
    } else {
      // Regular context formatting
      const formattedContext = formatTranscriptContext(
        contextTypes.filter(t => t !== 'additional-transcript') as Array<'agenda' | 'attendees' | 'presentation' | 'other'>, 
        cleanedFiles, 
        customLabel
      );
      const updatedTranscript = formattedContext + transcript;
      onTranscriptChange(updatedTranscript);
    }
    
    toast.success('Context added to transcript');
  };

  const handleStartEdit = () => {
    setEditValue(transcript);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    // Save current transcript to history before changing
    setTranscriptHistory(prev => [...prev, transcript]);
    onTranscriptChange(editValue);
    setIsEditing(false);
    toast.success('Transcript updated');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue('');
  };

  const handleUndo = () => {
    if (transcriptHistory.length === 0) {
      toast.error('No changes to undo');
      return;
    }
    
    const lastVersion = transcriptHistory[transcriptHistory.length - 1];
    setTranscriptHistory(prev => prev.slice(0, -1));
    onTranscriptChange(lastVersion);
    toast.success('Changes undone');
  };

  const handleFormatTranscript = async () => {
    if (!transcript) {
      toast.error('No transcript to format');
      return;
    }

    setIsFormatting(true);
    try {
      console.log('🎨 Formatting transcript into paragraphs...');
      
      const { data, error } = await supabase.functions.invoke('format-transcript-paragraphs', {
        body: { transcript }
      });

      if (error) {
        console.error('Format transcript error:', error);
        toast.error('Failed to format transcript');
        return;
      }

      if (data?.formattedTranscript) {
        // Save current transcript to history before changing
        setTranscriptHistory(prev => [...prev, transcript]);
        onTranscriptChange(data.formattedTranscript);
        toast.success('Transcript formatted with proper paragraphs');
      } else {
        toast.error('No formatted transcript returned');
      }
    } catch (error) {
      console.error('Error formatting transcript:', error);
      toast.error('Failed to format transcript');
    } finally {
      setIsFormatting(false);
    }
  };

  const handleDownloadWord = async () => {
    if (!transcript) {
      toast.error('No transcript to download');
      return;
    }

    try {
      // Clean and split transcript preserving paragraphs
      const cleanedText = cleanHTMLFromTranscript(transcript);
      const paragraphs = splitIntoParagraphs(cleanedText);

      // Create header sections with meeting metadata
      const headerSections = [];
      
      // Meeting Title
      if (meetingContext?.title) {
        headerSections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: meetingContext.title,
                bold: true,
                size: 24, // 12pt
                font: 'Calibri',
              })
            ],
            spacing: { after: 300 }
          })
        );
      }

      // Meeting Date and Start Time
      if (meetingContext?.date || meetingContext?.start_time) {
        // Build a single Date object if possible
        let dt: Date | null = null;
        const dateStr = meetingContext?.date as string | undefined;
        const startStr = meetingContext?.start_time as string | undefined;

        // If date contains time or is ISO, parse directly
        if (dateStr) {
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) dt = parsed;
        }

        // If start_time looks like ISO/date string, prefer that
        if (!dt && startStr && !/^(\d{1,2}:\d{2})$/.test(startStr)) {
          const parsed = new Date(startStr);
          if (!isNaN(parsed.getTime())) dt = parsed;
        }

        // Format British date with ordinal
        const ordinal = (n: number) => {
          if (n > 3 && n < 21) return 'th';
          switch (n % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
        };

        let formattedDate = '';
        let formattedTime = '';

        if (dt) {
          const dayName = dt.toLocaleDateString('en-GB', { weekday: 'long' });
          const monthName = dt.toLocaleDateString('en-GB', { month: 'long' });
          const day = dt.getDate();
          const year = dt.getFullYear();
          formattedDate = `${dayName} ${day}${ordinal(day)} ${monthName} ${year}`;
          formattedTime = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        } else if (dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            const dayName = d.toLocaleDateString('en-GB', { weekday: 'long' });
            const monthName = d.toLocaleDateString('en-GB', { month: 'long' });
            const day = d.getDate();
            const year = d.getFullYear();
            formattedDate = `${dayName} ${day}${ordinal(day)} ${monthName} ${year}`;
          }
        }

        // If start_time provided in HH:mm, use that
        if (startStr && /^(\d{1,2}:\d{2})$/.test(startStr)) {
          formattedTime = startStr;
        }

        const dateTimeText = formattedDate
          ? `${formattedDate}${formattedTime ? ` at ${formattedTime}` : ''}`
          : (formattedTime ? `at ${formattedTime}` : '');

        headerSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Meeting Date: ', bold: true, size: 24, font: 'Calibri' }),
              new TextRun({ text: dateTimeText, size: 24, font: 'Calibri' })
            ],
            spacing: { after: 200 }
          })
        );
      }

      // Meeting Type
      if (meetingContext?.meeting_type) {
        headerSections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Meeting Type: ',
                bold: true,
                size: 24,
                font: 'Calibri',
              }),
              new TextRun({
                text: meetingContext.meeting_type === 'face-to-face' ? 'Face to Face' : 'MS Teams',
                size: 24,
                font: 'Calibri',
              })
            ],
            spacing: { after: 200 }
          })
        );
      }

      // Attendees
      if (meetingContext?.attendees && meetingContext.attendees.length > 0) {
        headerSections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Attendees:',
                bold: true,
                size: 24,
                font: 'Calibri',
              })
            ],
            spacing: { after: 100 }
          })
        );

        meetingContext.attendees.forEach((attendee: string) => {
          headerSections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `• ${attendee}`,
                  size: 24,
                  font: 'Calibri',
                })
              ],
              spacing: { after: 100 },
              indent: { left: 720 } // Indent bullet points
            })
          );
        });
      }

      // Add separator line
      headerSections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '─'.repeat(40),
              size: 24,
              color: '999999',
            })
          ],
          spacing: { before: 200, after: 400 }
        })
      );

      // Transcript heading
      headerSections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Transcript',
              bold: true,
              size: 28,
              font: 'Calibri',
            })
          ],
          spacing: { after: 300 }
        })
      );

      // Create document with proper formatting
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            ...headerSections,
            ...paragraphs.map(text => 
              new Paragraph({
                children: [
                  new TextRun({
                    text: text.trim(),
                    size: 24, // 12pt font
                    font: 'Calibri',
                  })
                ],
                spacing: {
                  after: 280, // Good spacing between paragraphs
                  line: 360, // 1.5 line spacing within paragraphs
                },
                alignment: 'left',
              })
            )
          ]
        }]
      });

      // Generate and download
      const blob = await Packer.toBlob(doc);
      const fileName = meetingContext?.title 
        ? `${meetingContext.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-transcript.docx`
        : `transcript-${new Date().toISOString().split('T')[0]}.docx`;
      
      saveAs(blob, fileName);
      toast.success('Transcript downloaded');
    } catch (error) {
      console.error('Error downloading transcript:', error);
      toast.error('Failed to download transcript');
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 bg-green-50';
    if (confidence >= 0.7) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const getPIIColor = (type: PIIMatch['type']) => {
    switch (type) {
      case 'nhs_number': return 'bg-red-200 border-red-400';
      case 'name': return 'bg-amber-200 border-amber-400';
      case 'dob': return 'bg-orange-200 border-orange-400';
      case 'phone': return 'bg-yellow-200 border-yellow-400';
      case 'email': return 'bg-blue-200 border-blue-400';
      case 'postcode': return 'bg-purple-200 border-purple-400';
      default: return 'bg-gray-200 border-gray-400';
    }
  };

  // Helper function to clean HTML from transcript
  const cleanHTMLFromTranscript = (text: string): string => {
    const containsHTML = /<\/?[a-z][\s\S]*>/i.test(text);
    if (!containsHTML) return text;
    
    return text
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')  // Convert </p><p ...> to double newline
      .replace(/<p[^>]*>/gi, '')                 // Remove opening <p ...> tags
      .replace(/<\/p>/gi, '\n\n')             // Convert closing </p> to double newline
      .replace(/<br\s*\/?>(\s*<br\s*\/?>)*/gi, '\n') // Convert <br> (multiple) to newline
      .replace(/&nbsp;/gi, ' ')                  // Decode nbsp
      .replace(/<[^>]+>/g, '')                   // Remove any other HTML tags
      .replace(/\n{3,}/g, '\n\n')              // Replace multiple newlines with double newline
      .trim();
  };

  // Robust paragraph splitter with sensible fallbacks
  const splitIntoParagraphs = (text: string): string[] => {
    const byBlankLines = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    if (byBlankLines.length > 1) return byBlankLines;

    // Fallback: sentence grouping
    const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
    const paras: string[] = [];
    let buf = '';
    for (const s of sentences) {
      buf = buf ? `${buf} ${s}` : s;
      if (buf.length >= 280 || buf.split(' ').length >= 45) {
        paras.push(buf.trim());
        buf = '';
      }
    }
    if (buf.trim()) paras.push(buf.trim());
    return paras.length ? paras : [text];
  };

  // Render highlighted transcript
  const renderHighlightedTranscript = () => {
    // Clean HTML tags from transcript first
    const cleanedTranscript = cleanHTMLFromTranscript(transcript);
    
    // Split cleaned transcript into paragraphs
    // First try double newlines, then fall back to single newlines after sentence-ending punctuation
    let paragraphs = cleanedTranscript.split('\n\n').filter(p => p.trim());
    
    // If we only got one paragraph, try splitting on single newlines after punctuation
    if (paragraphs.length === 1 && cleanedTranscript.length > 500) {
      // Split on single newline that follows sentence-ending punctuation
      paragraphs = cleanedTranscript
        .split(/(?<=[.!?])\s*\n+(?=[A-Z])/g)
        .filter(p => p.trim());
    }
    
    // Calculate line height based on font size (1.6x ratio for readability)
    const lineHeight = `${fontSize * 1.6}px`;
    
    if (!showPII || piiMatches.length === 0) {
      return (
        <div className="space-y-4" style={{ fontSize: `${fontSize}px`, lineHeight }}>
          {paragraphs.map((para, idx) => (
            <p key={idx} className="">
              {para}
            </p>
          ))}
        </div>
      );
    }

    // With PII highlighting
    return (
      <div className="space-y-4" style={{ fontSize: `${fontSize}px`, lineHeight }}>
        {paragraphs.map((para, paraIdx) => {
          const segments = highlightPII(para, piiMatches);
          return (
            <p key={paraIdx} className="">
              {segments.map((segment, segIdx) => {
                if (segment.isPII && segment.match) {
                  return (
                    <mark
                      key={segIdx}
                      className={`${getPIIColor(segment.match.type)} border-b-2 px-1 rounded cursor-pointer transition-colors hover:opacity-75`}
                      title={`${segment.match.type.toUpperCase()} (${segment.match.confidence})`}
                    >
                      {segment.text}
                    </mark>
                  );
                }
                return <span key={segIdx}>{segment.text}</span>;
              })}
            </p>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3">Loading transcript data...</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "h-full flex flex-col space-y-4 p-6",
      isMobile && "p-4 space-y-3",
      isIPhone && "p-3 space-y-2 pb-safe"
    )}>
      {/* Header with Controls */}
      <div className={cn(
        "sticky top-0 z-10 bg-background pb-4 border-b space-y-4",
        isMobile && "space-y-3",
        isIPhone && "pt-safe-top space-y-2"
      )}>
        {/* Title and Word Count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className={cn(
              "font-semibold",
              isIPhone ? "text-base" : "text-lg"
            )}>
              {(() => {
                const dateStr = meetingContext?.date as string | undefined;
                const startStr = meetingContext?.start_time as string | undefined;
                
                // Helper for ordinal suffix
                const ordinal = (n: number) => {
                  if (n > 3 && n < 21) return 'th';
                  switch (n % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
                };
                
                let formattedDateTime = '';
                let dateToUse: Date | null = null;
                
                // First, try to get a date from start_time (this usually has the full datetime)
                if (startStr) {
                  const parsed = new Date(startStr);
                  if (!isNaN(parsed.getTime())) {
                    dateToUse = parsed;
                  }
                }
                
                // Fallback to date field if start_time didn't work
                if (!dateToUse && dateStr) {
                  const parsed = new Date(dateStr);
                  if (!isNaN(parsed.getTime())) {
                    dateToUse = parsed;
                  }
                }
                
                if (dateToUse) {
                  const dayName = dateToUse.toLocaleDateString('en-GB', { weekday: 'long' });
                  const monthName = dateToUse.toLocaleDateString('en-GB', { month: 'long' });
                  const day = dateToUse.getDate();
                  const year = dateToUse.getFullYear();
                  formattedDateTime = `${dayName} ${day}${ordinal(day)} ${monthName} ${year}`;
                  
                  // Extract time without timezone conversion
                  if (startStr?.includes('T')) {
                    const timePart = startStr.split('T')[1];
                    if (timePart) {
                      const timeMatch = timePart.match(/^(\d{2}):(\d{2})/);
                      if (timeMatch) {
                        formattedDateTime += ` at ${timeMatch[1]}:${timeMatch[2]}`;
                      }
                    }
                  } else if (startStr && /^\d{1,2}:\d{2}$/.test(startStr)) {
                    // If start_time is just a time string
                    formattedDateTime += ` at ${startStr}`;
                  }
                }
                
                return isIPhone 
                  ? "Transcript" 
                  : formattedDateTime 
                    ? `Transcript for Meeting on ${formattedDateTime}`
                    : "Transcript for Meeting";
              })()}
            </h3>
            {!isIPhone && (
              <Badge variant="outline" className="text-sm">
                {(() => {
                  // Calculate meeting duration
                  let durationText = '';
                  
                  if (meetingContext?.duration_minutes) {
                    const totalMinutes = meetingContext.duration_minutes;
                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = totalMinutes % 60;
                    
                    if (hours > 0) {
                      durationText = `${hours} ${hours === 1 ? 'hour' : 'hours'}${minutes > 0 ? ` ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}` : ''}`;
                    } else {
                      durationText = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
                    }
                  } else if (meetingContext?.start_time && meetingContext?.end_time) {
                    const start = new Date(meetingContext.start_time);
                    const end = new Date(meetingContext.end_time);
                    
                    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                      const diffMs = end.getTime() - start.getTime();
                      const totalMinutes = Math.floor(diffMs / 60000);
                      const hours = Math.floor(totalMinutes / 60);
                      const minutes = totalMinutes % 60;
                      
                      if (hours > 0) {
                        durationText = `${hours} ${hours === 1 ? 'hour' : 'hours'}${minutes > 0 ? ` ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}` : ''}`;
                      } else {
                        durationText = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
                      }
                    }
                  }
                  
                  const wordCount = `${stats.wordCount.toLocaleString('en-GB')} words`;
                  
                  if (durationText) {
                    return `(${durationText}, ${wordCount})`;
                  }
                  return `(${wordCount})`;
                })()}
              </Badge>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowStats(!showStats)}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {showStats ? 'Hide' : 'Show'} Stats
          </Button>
        </div>

        {/* Toggle Controls - Collapsible - Only shown when stats are visible */}
        {showStats && (
          <Collapsible open={showToggles} onOpenChange={setShowToggles}>
            <Card>
            <CollapsibleTrigger className={cn(
              "w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors",
              isMobile && "p-2"
            )}>
              <span className={cn(
                "text-sm font-medium flex items-center gap-2",
                isIPhone && "text-xs"
              )}>
                <Eye className={cn(isIPhone ? "h-3 w-3" : "h-4 w-4")} />
                Display Options
              </span>
              {showToggles ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className={cn(
                "p-3 pt-0",
                isMobile && "p-2"
              )}>
                <div className={cn(
                  "grid gap-3",
                  isIPhone ? "grid-cols-1 gap-2" : isMobile ? "grid-cols-2" : "flex items-center gap-6 flex-wrap"
                )}>
                  {/* Word count on mobile */}
                  {isIPhone && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs text-muted-foreground">Words:</span>
                      <Badge variant="outline" className="text-xs">
                        {stats.wordCount.toLocaleString('en-GB')}
                      </Badge>
                    </div>
                  )}

                  {/* Timestamp toggle hidden - chunks don't have timestamp data */}
                  {false && (
                    <div className="flex items-center gap-2">
                      <Switch id="timestamps" checked={showTimestamps} onCheckedChange={setShowTimestamps} />
                      <Label htmlFor="timestamps" className={cn(
                        "cursor-pointer flex items-center gap-2",
                        isIPhone && "text-xs"
                      )}>
                        <Clock className={cn(isIPhone ? "h-3 w-3" : "h-4 w-4", "text-muted-foreground")} />
                        {isIPhone ? "Times" : "Timestamps"}
                      </Label>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Switch id="confidence" checked={showConfidence} onCheckedChange={setShowConfidence} />
                    <Label htmlFor="confidence" className={cn(
                      "cursor-pointer flex items-center gap-2",
                      isIPhone && "text-xs"
                    )}>
                      <Eye className={cn(isIPhone ? "h-3 w-3" : "h-4 w-4", "text-muted-foreground")} />
                      {isIPhone ? "Conf" : "Confidence"}
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch id="pii" checked={showPII} onCheckedChange={setShowPII} />
                    <Label htmlFor="pii" className={cn(
                      "cursor-pointer flex items-center gap-2",
                      isIPhone && "text-xs"
                    )}>
                      <AlertTriangle className={cn(isIPhone ? "h-3 w-3" : "h-4 w-4", "text-amber-600")} />
                      PII
                      {showPII && piiMatches.length > 0 && (
                        <Badge variant="destructive" className="ml-1 text-xs">
                          {piiMatches.length}
                        </Badge>
                      )}
                    </Label>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
        )}

        {/* Quick Action Buttons - Responsive */}
        <div className={cn(
          "flex gap-2",
          isIPhone ? "flex-col" : "flex-wrap"
        )}>
          {/* Font Size Controls */}
          <div className="flex items-center gap-1 border rounded-md p-1">
            <Type className="h-4 w-4 text-muted-foreground mr-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setFontSize(prev => Math.max(12, prev - 1))}
              disabled={fontSize <= 12}
              title="Decrease font size"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="text-xs text-muted-foreground px-1 min-w-[2.5rem] text-center">
              {fontSize}px
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setFontSize(prev => Math.min(24, prev + 1))}
              disabled={fontSize >= 24}
              title="Increase font size"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* Add Context Button */}
          <Button 
            variant="outline" 
            size={isIPhone ? "sm" : "sm"}
            className={cn(
              "gap-2",
              isIPhone && "w-full justify-start"
            )}
            onClick={() => setShowContextDialog(true)}
          >
            <FilePlus2 className={cn(isIPhone ? "h-3 w-3" : "h-4 w-4", "text-primary mr-2")} />
            {isIPhone ? "Add Context" : "Add Meeting Context"}
          </Button>

          {/* Transcript Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size={isIPhone ? "sm" : "sm"}
                disabled={!transcript}
                className={cn(isIPhone && "w-full justify-start")}
              >
                <MoreVertical className={cn(isIPhone ? "h-3 w-3" : "h-4 w-4", "mr-2")} />
                Transcript Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 bg-background">
              <DropdownMenuItem 
                onClick={handleCleanTranscript}
                disabled={!transcript}
              >
                <Sparkles className="h-4 w-4 mr-2 text-nhs-blue" />
                Clean Transcript
                {stats.fillerWordCount > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {stats.fillerWordCount}
                  </Badge>
                )}
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={handleFormatTranscript}
                disabled={!transcript || isFormatting}
              >
                <FileText className="h-4 w-4 mr-2 text-primary" />
                {isFormatting ? 'Formatting...' : 'Format Paragraphs'}
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem 
                onClick={() => {
                  navigator.clipboard.writeText(transcript);
                  toast.success('Transcript copied');
                }}
                disabled={!transcript}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={handleStartEdit}
                disabled={!transcript || isEditing}
              >
                <FileText className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={handleDownloadWord}
                disabled={!transcript || isEditing}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Word
              </DropdownMenuItem>
              
              {transcriptHistory.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleUndo}
                    disabled={isEditing}
                  >
                    <Type className="h-4 w-4 mr-2" />
                    Undo Changes
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {showPII && piiMatches.length > 0 && (
            <>
              <Button
                variant="outline"
                size={isIPhone ? "sm" : "sm"}
                onClick={handleMaskAllPII}
                className={cn(
                  "text-amber-600 border-amber-300 hover:bg-amber-50",
                  isIPhone && "w-full justify-start"
                )}
              >
                <AlertTriangle className={cn(isIPhone ? "h-3 w-3" : "h-4 w-4", "mr-2")} />
                Mask All PII
                <Badge variant="secondary" className={cn(
                  "text-xs bg-amber-100 text-amber-900",
                  isIPhone ? "ml-auto" : "ml-2"
                )}>
                  {piiMatches.length}
                </Badge>
              </Button>
              
              {selectedPII.size > 0 && (
                <Button
                  variant="outline"
                  size={isIPhone ? "sm" : "sm"}
                  onClick={handleMaskSelectedPII}
                  className={cn(
                    "text-red-600 border-red-300 hover:bg-red-50",
                    isIPhone && "w-full justify-start"
                  )}
                >
                  Mask Selected ({selectedPII.size})
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Statistics Panel - Hidden when collapsed to save space */}
      {showStats && (
        <Card className={cn(
          "p-4 bg-muted/50",
          isMobile && "p-3"
        )}>
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className={cn(isIPhone ? "h-3 w-3" : "h-4 w-4")} />
            <span className={cn(
              "font-semibold",
              isIPhone && "text-sm"
            )}>
              Statistics
            </span>
          </div>
          <div className={cn(
            "grid gap-4",
            isIPhone ? "grid-cols-2 gap-3" : isMobile ? "grid-cols-3" : "grid-cols-6"
          )}>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{isIPhone ? "Chunks" : "Total Chunks"}</p>
              <p className={cn(
                "font-semibold",
                isIPhone ? "text-lg" : "text-2xl"
              )}>{stats.totalChunks}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Avg Conf</p>
              <p className={cn(
                "font-semibold",
                isIPhone ? "text-lg" : "text-2xl"
              )}>{stats.avgConfidence}%</p>
            </div>
            {!isIPhone && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Low Conf</p>
                <p className={cn(
                  "font-semibold text-amber-600",
                  isMobile ? "text-lg" : "text-2xl"
                )}>{stats.lowConfidenceCount}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Fillers</p>
              <p className={cn(
                "font-semibold",
                isIPhone ? "text-lg" : "text-2xl"
              )}>{stats.fillerWordCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">PII</p>
              <p className={cn(
                "font-semibold text-red-600",
                isIPhone ? "text-lg" : "text-2xl"
              )}>{stats.piiCount}</p>
            </div>
            {!isIPhone && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Words</p>
                <p className={cn(
                  "font-semibold",
                  isMobile ? "text-lg" : "text-2xl"
                )}>{stats.wordCount.toLocaleString('en-GB')}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Context Section - Mobile-Optimized */}
      {contextData && (contextData.agenda || contextData.attendees.length > 0) && (
        <Collapsible open={showContext} onOpenChange={setShowContext}>
          <Card>
            <CollapsibleTrigger className={cn(
              "w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors",
              isMobile && "p-3"
            )}>
              <div className="flex items-center gap-2">
                <FileText className={cn(isIPhone ? "h-3 w-3" : "h-4 w-4", "text-primary")} />
                <span className={cn(
                  "font-medium",
                  isIPhone && "text-sm"
                )}>Meeting Context</span>
              </div>
              {showContext ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className={cn(
                "p-4 pt-0 space-y-4",
                isMobile && "p-3 space-y-3"
              )}>
                {contextData.agenda && (
                  <div>
                    <h4 className={cn(
                      "font-semibold mb-2 flex items-center gap-2",
                      isIPhone ? "text-xs" : "text-sm"
                    )}>
                      📋 Agenda
                    </h4>
                    <Card className={cn(
                      "p-3 bg-muted/30",
                      isIPhone && "p-2"
                    )}>
                      <p className={cn(
                        "whitespace-pre-wrap",
                        isIPhone ? "text-xs" : "text-sm"
                      )}>{contextData.agenda}</p>
                    </Card>
                  </div>
                )}

                {contextData.attendees.length > 0 && (
                  <div>
                    <h4 className={cn(
                      "font-semibold mb-2 flex items-center gap-2",
                      isIPhone ? "text-xs" : "text-sm"
                    )}>
                      <Users className={cn(isIPhone ? "h-3 w-3" : "h-4 w-4")} />
                      Attendees ({contextData.attendees.length})
                    </h4>
                    <div className={cn(
                      "grid gap-2",
                      isIPhone ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
                    )}>
                      {contextData.attendees.map((attendee, idx) => (
                        <Card key={idx} className={cn(
                          "p-2 bg-muted/30",
                          isIPhone && "p-1.5"
                        )}>
                          <p className={cn(isIPhone ? "text-xs" : "text-sm")}>{attendee}</p>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* PII Management Panel - Collapsible on Mobile */}
      {showPII && piiMatches.length > 0 && (
        <Collapsible open={showPIIPanel} onOpenChange={setShowPIIPanel}>
          <Card className="border-amber-200 bg-amber-50/50">
            <CollapsibleTrigger className={cn(
              "w-full p-4 flex items-center justify-between hover:bg-amber-100/50 transition-colors",
              isMobile && "p-3"
            )}>
              <div>
                <h4 className={cn(
                  "font-semibold text-amber-900 flex items-center gap-2",
                  isIPhone && "text-xs"
                )}>
                  <AlertTriangle className={cn(isIPhone ? "h-3 w-3" : "h-4 w-4")} />
                  {isIPhone ? `PII (${piiMatches.length})` : "Detected Personally Identifiable Information"}
                </h4>
                {!isIPhone && (
                  <p className="text-xs text-amber-700 mt-1">
                    Review and manage sensitive data in the transcript
                  </p>
                )}
              </div>
              {isMobile && (
                showPIIPanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className={cn(
                "p-4 pt-0",
                isMobile && "p-3 pt-0"
              )}>
                <ScrollArea className={cn(
                  "border rounded-md bg-white p-2",
                  isIPhone ? "h-32" : "h-48"
                )}>
                  <div className="space-y-2">
                    {piiMatches.map((match, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer",
                          isIPhone && "p-1.5 gap-1.5"
                        )}
                        onClick={() => {
                          const newSelected = new Set(selectedPII);
                          if (newSelected.has(idx)) {
                            newSelected.delete(idx);
                          } else {
                            newSelected.add(idx);
                          }
                          setSelectedPII(newSelected);
                        }}
                      >
                        <div className={`${isIPhone ? 'w-3 h-3' : 'w-4 h-4'} rounded border-2 flex items-center justify-center ${
                          selectedPII.has(idx) ? 'bg-primary border-primary' : 'border-muted-foreground'
                        }`}>
                          {selectedPII.has(idx) && <Check className={cn(isIPhone ? "h-2 w-2" : "h-3 w-3", "text-white")} />}
                        </div>
                        
                        <Badge variant="outline" className="text-xs">
                          {match.type.replace('_', ' ').toUpperCase()}
                        </Badge>
                        
                        <span className={cn(
                          "font-mono flex-1 truncate",
                          isIPhone ? "text-xs" : "text-sm"
                        )}>{match.value}</span>
                        
                        {!isIPhone && (
                          <Badge variant="secondary" className="text-xs">
                            {match.confidence}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Main Transcript Display - Mobile-Optimized */}
      <Card className="flex-1 min-h-0 flex flex-col">
        {isEditing ? (
          <div className="flex-1 flex flex-col p-4 gap-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Editing Transcript</h4>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveEdit}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 w-full p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary whitespace-pre-wrap font-sans leading-relaxed"
              style={{ fontSize: `${fontSize}px`, lineHeight: '1.8' }}
              autoFocus
            />
          </div>
        ) : (
          <ScrollArea className={cn(
            "flex-1 p-4",
            isMobile && "p-3",
            isIPhone && "px-2 py-3"
          )}>
            <div className={cn(
              "space-y-4 text-foreground",
              isIPhone && "text-sm space-y-3 leading-relaxed"
            )}>
              {!transcript ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  No transcript available for this meeting.
                </div>
              ) : (
                renderHighlightedTranscript()
              )}
            </div>
          </ScrollArea>
        )}
      </Card>

      {/* Add Context Dialog */}
      <TranscriptContextDialog
        open={showContextDialog}
        onOpenChange={setShowContextDialog}
        onAddContext={handleAddContext}
      />
    </div>
  );
};
