import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Document, Packer, Paragraph, TextRun } from 'docx';

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

  // Fetch fresh notes in background (non-blocking)
  useEffect(() => {
    if (!isOpen || !meeting?.id) return;

    setIsLoadingNotes(true);
    
    // Simple sequential fetch - try notes_style_3 first, then meeting_summaries
    const fetchNotes = async () => {
      try {
        // First try meetings table for notes_style_3
        const { data: meetingData } = await supabase
          .from('meetings')
          .select('notes_style_3')
          .eq('id', meeting.id)
          .maybeSingle();

        if (meetingData?.notes_style_3) {
          setNotesContent(meetingData.notes_style_3);
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
          setNotesContent(summaryData.summary);
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

  // Download as Word
  const handleDownloadWord = async () => {
    const content = activeTab === 'notes' ? notesContent : transcript;
    const title = meeting?.title || 'Meeting Notes';

    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: content.split('\n').map(line => 
            new Paragraph({
              children: [new TextRun({ text: line, size: 24 })]
            })
          )
        }]
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${activeTab}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download');
    }
  };

  // Simple markdown to HTML converter (basic, fast)
  const basicFormat = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
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
                <div className="p-6">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Loading notes...</span>
                    </div>
                  ) : notesContent ? (
                    viewMode === 'plain' ? (
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
                        dangerouslySetInnerHTML={{ __html: basicFormat(notesContent) }}
                      />
                    )
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
