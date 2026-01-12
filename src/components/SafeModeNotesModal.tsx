import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  X, 
  Copy, 
  Check, 
  FileText, 
  MessageSquare, 
  ZoomIn, 
  ZoomOut,
  Download,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertCircle,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  Circle,
  Timer
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateProfessionalWordFromContent } from "@/utils/generateProfessionalMeetingDocx";
import { sanitiseMeetingNotes } from "@/utils/sanitiseMeetingNotes";

interface Meeting {
  id: string;
  title: string;
  meeting_summary?: string;
  transcript?: string;
}

interface SafeModeNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: Meeting | null;
  notes: string;
}

export const SafeModeNotesModal: React.FC<SafeModeNotesModalProps> = ({
  isOpen,
  onClose,
  meeting,
  notes
}) => {
  // State
  const [activeTab, setActiveTab] = useState<'notes' | 'transcript'>('notes');
  const [notesContent, setNotesContent] = useState(notes);
  const [transcript, setTranscript] = useState('');
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'plain' | 'formatted'>('plain');
  const [fontSize, setFontSize] = useState(14);
  const [copied, setCopied] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);

  // Reset state when modal opens with new meeting
  useEffect(() => {
    if (isOpen && meeting) {
      // Seed notes immediately from props
      setNotesContent(notes || meeting.meeting_summary || '');
      setActiveTab('notes');
      setTranscript('');
      setTranscriptError(null);
      setViewMode('plain');
      setCopied(false);
    }
  }, [isOpen, meeting?.id, notes]);

  // Store meeting format from database
  const [meetingFormat, setMeetingFormat] = useState<string | null>(null);

  // Fetch fresh notes in background (non-blocking)
  useEffect(() => {
    if (!isOpen || !meeting?.id) return;

    setIsLoadingNotes(true);
    
    // Simple sequential fetch - try notes_style_3 first, then meeting_summaries
    const fetchNotes = async () => {
      try {
        // First try meetings table for notes_style_3 and meeting_format
        const { data: meetingData } = await supabase
          .from('meetings')
          .select('notes_style_3, meeting_format')
          .eq('id', meeting.id)
          .maybeSingle();

        if (meetingData?.meeting_format) {
          setMeetingFormat(meetingData.meeting_format);
        }

        if (meetingData?.notes_style_3) {
          setNotesContent(sanitiseMeetingNotes(meetingData.notes_style_3));
          setIsLoadingNotes(false);
          return;
        }

        // Fallback to meeting_summaries
        const { data: summaryData } = await supabase
          .from('meeting_summaries')
          .select('summary')
          .eq('meeting_id', meeting.id)
          .maybeSingle();

        if (summaryData?.summary) {
          setNotesContent(sanitiseMeetingNotes(summaryData.summary));
        }
      } catch (error) {
        console.error('SafeMode: Error fetching notes:', error);
      } finally {
        setIsLoadingNotes(false);
      }
    };

    fetchNotes();
  }, [isOpen, meeting?.id]);

  // Load transcript only when tab is clicked
  const loadTranscript = useCallback(async () => {
    if (!meeting?.id || transcript || isLoadingTranscript) return;
    
    setIsLoadingTranscript(true);
    setTranscriptError(null);

    try {
      // First try live_transcript_text from meetings table
      const { data: meetingData } = await supabase
        .from('meetings')
        .select('live_transcript_text')
        .eq('id', meeting.id)
        .maybeSingle();

      if (meetingData?.live_transcript_text) {
        setTranscript(meetingData.live_transcript_text);
        setIsLoadingTranscript(false);
        return;
      }

      // Fallback to meeting_transcripts table
      const { data: transcriptData } = await supabase
        .from('meeting_transcripts')
        .select('content')
        .eq('meeting_id', meeting.id)
        .order('created_at', { ascending: true });

      if (transcriptData && transcriptData.length > 0) {
        const combinedTranscript = transcriptData
          .map(t => t.content)
          .filter(Boolean)
          .join('\n\n');
        setTranscript(combinedTranscript);
      } else {
        setTranscript('No transcript available for this meeting.');
      }
    } catch (error) {
      console.error('SafeMode: Error loading transcript:', error);
      setTranscriptError('Failed to load transcript. Please try again.');
    } finally {
      setIsLoadingTranscript(false);
    }
  }, [meeting?.id, transcript, isLoadingTranscript]);

  // Handle tab change - load transcript on demand
  const handleTabChange = (value: string) => {
    setActiveTab(value as 'notes' | 'transcript');
    if (value === 'transcript' && !transcript && !isLoadingTranscript) {
      loadTranscript();
    }
  };

  // Copy to clipboard
  const handleCopy = async () => {
    const content = activeTab === 'notes' ? notesContent : transcript;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  // Download as Word - use professional NHS-style formatting
  const handleDownloadWord = async () => {
    const content = activeTab === 'notes' ? notesContent : transcript;
    const title = meeting?.title || 'Meeting Notes';

    try {
      // Use the professional document generator with NHS-style formatting
      await generateProfessionalWordFromContent(content, title);
      toast.success('Downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download');
    }
  };

  // Parse meeting details from content
  const meetingDetails = useMemo(() => {
    if (!notesContent) return null;
    
    const titleMatch = notesContent.match(/Meeting Title[:\s]+(.+?)(?:\n|$)/i);
    const dateMatch = notesContent.match(/Date[:\s]+(.+?)(?:\n|$)/i);
    const timeMatch = notesContent.match(/Time[:\s]+(.+?)(?:\n|$)/i);
    const locationMatch = notesContent.match(/Location[:\s]+(.+?)(?:\n|$)/i);
    
    if (!titleMatch && !dateMatch && !timeMatch && !locationMatch) return null;
    
    // Strip markdown formatting (** bold markers) from title
    const cleanTitle = titleMatch?.[1]?.trim().replace(/\*\*/g, '');
    
    // Use meetingFormat from DB if available, otherwise fall back to content parsing
    const formatFromDb = meetingFormat ? 
      meetingFormat.charAt(0).toUpperCase() + meetingFormat.slice(1).replace(/-/g, ' ') : 
      null;
    
    return {
      title: cleanTitle,
      date: dateMatch?.[1]?.trim(),
      time: timeMatch?.[1]?.trim(),
      location: formatFromDb || locationMatch?.[1]?.trim(),
    };
  }, [notesContent, meetingFormat]);

  // Parse action items from content
  const actionItems = useMemo(() => {
    if (!notesContent) return [];
    
    const items: Array<{
      action: string;
      owner: string;
      deadline: string;
      priority: 'High' | 'Medium' | 'Low';
      status: 'Open' | 'In Progress' | 'Completed';
      isCompleted: boolean;
    }> = [];
    
    // Match action item patterns
    const actionPattern = /^[-•*]\s*(?:(~~))?(.+?)(?:\1)?\s*(?:—|–|-)\s*@?(\w+(?:\s+\w+)?)\s*(?:\(([^)]+)\))?\s*(?:\[(\w+)\])?\s*(?:\{(\w+)\})?$/gm;
    
    let match;
    const seenActions = new Set<string>();
    
    while ((match = actionPattern.exec(notesContent)) !== null) {
      const isStrikethrough = !!match[1];
      const actionText = match[2]?.trim().replace(/~~/g, '');
      const owner = match[3]?.trim() || 'TBC';
      const deadline = match[4]?.trim() || 'TBC';
      const priority = (match[5]?.trim() as 'High' | 'Medium' | 'Low') || 'Medium';
      const statusText = match[6]?.trim() || (isStrikethrough ? 'Done' : 'Open');
      
      // Normalise status
      let status: 'Open' | 'In Progress' | 'Completed' = 'Open';
      if (statusText.toLowerCase() === 'done' || statusText.toLowerCase() === 'completed' || isStrikethrough) {
        status = 'Completed';
      } else if (statusText.toLowerCase() === 'in progress' || statusText.toLowerCase() === 'active') {
        status = 'In Progress';
      }
      
      const key = actionText.toLowerCase();
      if (!seenActions.has(key) && actionText) {
        seenActions.add(key);
        items.push({
          action: actionText,
          owner,
          deadline,
          priority: ['High', 'Medium', 'Low'].includes(priority) ? priority : 'Medium',
          status,
          isCompleted: status === 'Completed',
        });
      }
    }
    
    // Also check for simpler bullet patterns in action items section
    const actionSectionMatch = notesContent.match(/##?\s*Action\s+Items?\s*\n([\s\S]*?)(?=\n##|\n#|$)/i);
    if (actionSectionMatch) {
      const simplePattern = /^[-•*]\s*(?:(~~))?([^—–\-@\n]+?)(?:\1)?(?:\s*—\s*@?(\w+))?(?:\s*\(([^)]+)\))?(?:\s*\[(\w+)\])?$/gm;
      
      let simpleMatch;
      while ((simpleMatch = simplePattern.exec(actionSectionMatch[1])) !== null) {
        const isStrikethrough = !!simpleMatch[1];
        const actionText = simpleMatch[2]?.trim().replace(/~~/g, '');
        const owner = simpleMatch[3]?.trim() || 'TBC';
        const deadline = simpleMatch[4]?.trim() || 'TBC';
        const priority = (simpleMatch[5]?.trim() as 'High' | 'Medium' | 'Low') || 'Medium';
        
        const key = actionText.toLowerCase();
        if (!seenActions.has(key) && actionText && actionText.length > 5) {
          seenActions.add(key);
          items.push({
            action: actionText,
            owner,
            deadline,
            priority: ['High', 'Medium', 'Low'].includes(priority) ? priority : 'Medium',
            status: isStrikethrough ? 'Completed' : 'Open',
            isCompleted: isStrikethrough,
          });
        }
      }
    }
    
    return items;
  }, [notesContent]);

  // Get priority badge styling
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'High':
        return <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs">High</Badge>;
      case 'Medium':
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs">Medium</Badge>;
      case 'Low':
        return <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs">Low</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{priority}</Badge>;
    }
  };

  // Get status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Done
          </Badge>
        );
      case 'In Progress':
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs gap-1">
            <Timer className="h-3 w-3" />
            In Progress
          </Badge>
        );
      case 'Open':
      default:
        return (
          <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs gap-1">
            <Circle className="h-3 w-3" />
            Open
          </Badge>
        );
    }
  };

  // Remove action items section from formatted content (we'll show it as a table)
  const contentWithoutActionItems = useMemo(() => {
    if (!notesContent) return '';
    
    // Remove Action Items section and everything after it until next ## heading
    let cleaned = notesContent;
    
    // Remove the action items section (since we display as table)
    cleaned = cleaned.replace(/##?\s*Action\s+Items?\s*\n[\s\S]*?(?=\n##[^#]|\n#[^#]|$)/gi, '');
    
    // Remove Completed section too
    cleaned = cleaned.replace(/##?\s*Completed\s*(Items?)?\s*\n[\s\S]*?(?=\n##[^#]|\n#[^#]|$)/gi, '');
    
    // Remove meeting details section heading/label
    cleaned = cleaned.replace(/^#{1,6}\s*Meeting\s+Details\s*$/gim, '');
    cleaned = cleaned.replace(/^Meeting\s+Details\s*$/gim, '');
    cleaned = cleaned.replace(/^MEETING\s+DETAILS\s*$/gim, '');

    // Remove meeting details lines (we display as a table)
    cleaned = cleaned.replace(/^[-•*]?\s*\*{0,2}Meeting Title\*{0,2}[:\s]+.+$/gim, '');
    cleaned = cleaned.replace(/^[-•*]?\s*\*{0,2}Date\*{0,2}[:\s]+.+$/gim, '');
    cleaned = cleaned.replace(/^[-•*]?\s*\*{0,2}Time\*{0,2}[:\s]+.+$/gim, '');
    cleaned = cleaned.replace(/^[-•*]?\s*\*{0,2}Location\*{0,2}[:\s]+.+$/gim, '');

    // Remove "Next Section" heading if present (no longer needed)
    cleaned = cleaned.replace(/##?\s*Next\s+Section\s*\n?/gi, '');
    
    // Clean up excessive newlines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
    
    return cleaned;
  }, [notesContent]);

  // Simple markdown to HTML converter (basic, fast)
  const basicFormat = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-6 mb-3 text-primary">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-8 mb-4 text-primary">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.*$)/gm, '<li class="ml-4">$1</li>')
      .replace(/\n/g, '<br />');
  };

  const currentContent = activeTab === 'notes' ? notesContent : transcript;
  const isLoading = activeTab === 'notes' ? isLoadingNotes : isLoadingTranscript;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0 bg-background">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  {meeting?.title || 'Meeting Notes'} 
                  <span className="ml-2 text-sm font-normal text-amber-600 dark:text-amber-400">
                    (Safe Mode)
                  </span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Lightweight view for faster loading
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b flex items-center justify-between gap-4 flex-shrink-0 bg-muted/30">
          <div className="flex items-center gap-2">
            {/* Font size controls */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFontSize(prev => Math.max(10, prev - 2))}
              disabled={fontSize <= 10}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground w-12 text-center">{fontSize}px</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFontSize(prev => Math.min(24, prev + 2))}
              disabled={fontSize >= 24}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>

            {/* Divider */}
            <div className="w-px h-6 bg-border mx-2" />

            {/* View mode toggle */}
            <Button
              variant={viewMode === 'plain' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode(viewMode === 'plain' ? 'formatted' : 'plain')}
              className="gap-2"
            >
              {viewMode === 'plain' ? (
                <>
                  <ToggleLeft className="h-4 w-4" />
                  Plain Text
                </>
              ) : (
                <>
                  <ToggleRight className="h-4 w-4" />
                  Formatted
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {/* Copy button */}
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>

            {/* Download button */}
            <Button variant="outline" size="sm" onClick={handleDownloadWord} className="gap-2">
              <Download className="h-4 w-4" />
              Word
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 w-fit flex-shrink-0">
            <TabsTrigger value="notes" className="gap-2">
              <FileText className="h-4 w-4" />
              Notes
            </TabsTrigger>
            <TabsTrigger value="transcript" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Transcript
            </TabsTrigger>
          </TabsList>

          {/* Content Area */}
          <div className="flex-1 min-h-0 px-6 pb-6 pt-4">
            <TabsContent value="notes" className="h-full m-0">
              <ScrollArea className="h-full rounded-lg border bg-card">
                <div className="p-6 space-y-6">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Loading notes...</span>
                    </div>
                  ) : notesContent ? (
                    <>
                      {/* Meeting Details Table */}
                      {viewMode === 'formatted' && meetingDetails && (
                        <div className="rounded-lg border overflow-hidden">
                          <div className="bg-primary px-4 py-2">
                            <h3 className="font-semibold text-primary-foreground flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Meeting Details
                            </h3>
                          </div>
                          <Table>
                            <TableBody>
                              {meetingDetails.title && (
                                <TableRow>
                                  <TableCell className="font-medium w-32 bg-muted/50">
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-muted-foreground" />
                                      Title
                                    </div>
                                  </TableCell>
                                  <TableCell>{meetingDetails.title}</TableCell>
                                </TableRow>
                              )}
                              {meetingDetails.date && (
                                <TableRow>
                                  <TableCell className="font-medium bg-muted/50">
                                    <div className="flex items-center gap-2">
                                      <Calendar className="h-4 w-4 text-muted-foreground" />
                                      Date
                                    </div>
                                  </TableCell>
                                  <TableCell>{meetingDetails.date}</TableCell>
                                </TableRow>
                              )}
                              {meetingDetails.time && (
                                <TableRow>
                                  <TableCell className="font-medium bg-muted/50">
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-4 w-4 text-muted-foreground" />
                                      Time
                                    </div>
                                  </TableCell>
                                  <TableCell>{meetingDetails.time}</TableCell>
                                </TableRow>
                              )}
                              {meetingDetails.location && (
                                <TableRow>
                                  <TableCell className="font-medium bg-muted/50">
                                    <div className="flex items-center gap-2">
                                      <MapPin className="h-4 w-4 text-muted-foreground" />
                                      Location
                                    </div>
                                  </TableCell>
                                  <TableCell>{meetingDetails.location}</TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {/* Main Content */}
                      {viewMode === 'plain' ? (
                        <pre 
                          className="whitespace-pre-wrap font-sans text-foreground leading-relaxed"
                          style={{ fontSize: `${fontSize}px` }}
                        >
                          {notesContent}
                        </pre>
                      ) : (
                        <div 
                          className="prose prose-sm dark:prose-invert max-w-none"
                          style={{ fontSize: `${fontSize}px` }}
                          dangerouslySetInnerHTML={{ __html: basicFormat(contentWithoutActionItems) }}
                        />
                      )}

                      {/* Action Items Table */}
                      {viewMode === 'formatted' && actionItems.length > 0 && (
                        <div className="rounded-lg border overflow-hidden">
                          <div className="bg-primary px-4 py-2">
                            <h3 className="font-semibold text-primary-foreground flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4" />
                              Action Items ({actionItems.filter(i => !i.isCompleted).length} open, {actionItems.filter(i => i.isCompleted).length} completed)
                            </h3>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="w-[40%]">Action</TableHead>
                                <TableHead className="w-[15%]">Owner</TableHead>
                                <TableHead className="w-[15%]">Deadline</TableHead>
                                <TableHead className="w-[15%]">Priority</TableHead>
                                <TableHead className="w-[15%]">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {actionItems.map((item, index) => (
                                <TableRow 
                                  key={index} 
                                  className={item.isCompleted ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}
                                >
                                  <TableCell className={item.isCompleted ? 'line-through text-muted-foreground' : ''}>
                                    {item.action}
                                  </TableCell>
                                  <TableCell className="font-medium">@{item.owner}</TableCell>
                                  <TableCell>{item.deadline}</TableCell>
                                  <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No notes available for this meeting.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="transcript" className="h-full m-0">
              <ScrollArea className="h-full rounded-lg border bg-card">
                <div className="p-6">
                  {isLoadingTranscript ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Loading transcript...</span>
                    </div>
                  ) : transcriptError ? (
                    <div className="text-center py-12">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive opacity-70" />
                      <p className="text-destructive">{transcriptError}</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={loadTranscript}
                        className="mt-4"
                      >
                        Retry
                      </Button>
                    </div>
                  ) : transcript ? (
                    viewMode === 'plain' ? (
                      <pre 
                        className="whitespace-pre-wrap font-sans text-foreground leading-relaxed"
                        style={{ fontSize: `${fontSize}px` }}
                      >
                        {transcript}
                      </pre>
                    ) : (
                      <div 
                        className="prose prose-sm dark:prose-invert max-w-none"
                        style={{ fontSize: `${fontSize}px` }}
                        dangerouslySetInnerHTML={{ __html: basicFormat(transcript) }}
                      />
                    )
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No transcript available for this meeting.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
