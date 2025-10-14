import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, RefreshCw, Sparkles, FileText, Crown, Book, Scroll, Wand2, MoreVertical, Copy, Mail } from 'lucide-react';
import { useMultiTypeNotes, type MultiTypeNote } from '@/hooks/useMultiTypeNotes';
import { NoteEnhancementDialog } from './meeting/NoteEnhancementDialog';
import { EmailMeetingMinutesModal } from './EmailMeetingMinutesModal';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { copyPlainTextToClipboard } from '@/utils/stripMarkdown';

// Import the generateAdvancedWordDocument function from FullPageNotesModal
// We'll create a simpler version for now
const generateAdvancedWordDocument = async (content: string, title: string) => {
  const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import('docx');
  
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({ text: title, bold: true, size: 32 })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: "" }),
        ...content.split('\n').map(line => 
          new Paragraph({
            children: [new TextRun({ text: line })],
          })
        ),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

interface MultiTypeNotesPanelProps {
  meetingId: string;
  meetingTitle: string;
}

const noteTypeConfig = {
  brief: {
    label: 'Brief Summary',
    description: 'Key decisions and action items only',
    icon: FileText,
    color: 'bg-blue-100 text-blue-800'
  },
  executive: {
    label: 'Executive Summary',
    description: 'Strategic overview for leadership',
    icon: Crown,
    color: 'bg-purple-100 text-purple-800'
  },
  detailed: {
    label: 'Detailed Minutes',
    description: 'Comprehensive meeting documentation',
    icon: Book,
    color: 'bg-green-100 text-green-800'
  },
  very_detailed: {
    label: 'Very Detailed',
    description: 'Complete verbatim record',
    icon: Scroll,
    color: 'bg-orange-100 text-orange-800'
  },
  limerick: {
    label: 'Creative Summary',
    description: 'Fun limerick-style notes',
    icon: Sparkles,
    color: 'bg-pink-100 text-pink-800'
  }
};

export function MultiTypeNotesPanel({ meetingId, meetingTitle }: MultiTypeNotesPanelProps) {
  const {
    notes,
    status,
    isLoading,
    error,
    isGenerating,
    generateAllTypes,
    regenerateAllSequential,
    getSequentialProgress,
    getNoteByType,
    getCompletionPercentage
  } = useMultiTypeNotes(meetingId);

  const [activeTab, setActiveTab] = useState<string>('brief');
  const [enhancementDialogOpen, setEnhancementDialogOpen] = useState(false);
  const [currentEnhancingNote, setCurrentEnhancingNote] = useState<MultiTypeNote | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [currentNoteForEmail, setCurrentNoteForEmail] = useState<MultiTypeNote | null>(null);

  const handleDownload = async (note: MultiTypeNote) => {
    try {
      await generateAdvancedWordDocument(
        note.content,
        `${meetingTitle} - ${noteTypeConfig[note.note_type].label}`
      );
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  };

  const handleEnhanceClick = (note: MultiTypeNote) => {
    setCurrentEnhancingNote(note);
    setEnhancementDialogOpen(true);
  };

  const handleEnhanced = async (enhancedContent: string) => {
    if (!currentEnhancingNote) return;

    try {
      // Update the note in the database
      const { error } = await supabase
        .from('meeting_notes_queue')
        .update({
          content: enhancedContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentEnhancingNote.id);

      if (error) throw error;

      toast.success('Note updated successfully!');
      
      // Refresh the notes by triggering a re-fetch
      window.location.reload();
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Failed to update note');
    }
  };

  const handleCopy = async (note: MultiTypeNote) => {
    const success = await copyPlainTextToClipboard(note.content);
    if (success) {
      toast.success('Notes copied to clipboard!');
    } else {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleEmailClick = (note: MultiTypeNote) => {
    setCurrentNoteForEmail(note);
    setEmailModalOpen(true);
  };

  const renderNoteContent = (noteType: keyof typeof noteTypeConfig) => {
    const note = getNoteByType(noteType);
    const noteStatus = status[noteType];
    const config = noteTypeConfig[noteType];
    const IconComponent = config.icon;

    if (noteStatus === 'pending') {
      return (
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-muted-foreground">Generating {config.label.toLowerCase()}...</p>
          </div>
        </div>
      );
    }

    if (noteStatus === 'failed') {
      return (
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <p className="text-destructive mb-2">Failed to generate {config.label.toLowerCase()}</p>
            <Button variant="outline" size="sm" onClick={generateAllTypes}>
              Retry Generation
            </Button>
          </div>
        </div>
      );
    }

    if (!note) {
      return (
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <IconComponent className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">No {config.label.toLowerCase()} available</p>
            <Button onClick={generateAllTypes} disabled={isGenerating}>
              Generate All Types
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={config.color}>
              <IconComponent className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {note.token_count} tokens • {Math.round(note.processing_time_ms / 1000)}s • {note.model_used}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {noteType === 'detailed' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEnhanceClick(note)}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Enhance
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDownload(note)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Word
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCopy(note)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleEmailClick(note)}>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <div 
            className="whitespace-pre-wrap leading-relaxed"
            dangerouslySetInnerHTML={{ __html: note.content }}
          />
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Multi-Type Meeting Notes</CardTitle>
          <CardDescription>Loading meeting notes...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasAnyNotes = notes.length > 0;
  const completionPercentage = getCompletionPercentage();

  return (
    <>
      <NoteEnhancementDialog
        open={enhancementDialogOpen}
        onOpenChange={setEnhancementDialogOpen}
        originalContent={currentEnhancingNote?.content || ''}
        onEnhanced={handleEnhanced}
      />
      
      <EmailMeetingMinutesModal
        isOpen={emailModalOpen}
        onOpenChange={setEmailModalOpen}
        meetingId={meetingId}
        meetingTitle={currentNoteForEmail ? `${meetingTitle} - ${noteTypeConfig[currentNoteForEmail.note_type].label}` : meetingTitle}
        meetingNotes={currentNoteForEmail?.content || ''}
      />
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Multi-Type Meeting Notes
            </CardTitle>
            <CardDescription>
              {hasAnyNotes 
                ? `${notes.length} of 5 note types generated`
                : 'Generate meeting notes in 5 different styles'
              }
            </CardDescription>
          </div>
          
            <div className="flex items-center gap-2">
              {isGenerating && (
                <div className="flex items-center gap-2">
                  <Progress value={completionPercentage} className="w-20" />
                  <span className="text-xs text-muted-foreground">
                    {(() => {
                      const progress = getSequentialProgress();
                      return progress.currentType 
                        ? `${progress.currentType} (${progress.current}/${progress.total})`
                        : `${Math.round(completionPercentage)}%`;
                    })()}
                  </span>
                </div>
              )}
              
              <Button 
                onClick={generateAllTypes}
                disabled={isGenerating}
                size="sm"
                variant="outline"
              >
                {isGenerating ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {hasAnyNotes ? 'Regenerate All' : 'Generate All'}
              </Button>

              <Button 
                onClick={regenerateAllSequential}
                disabled={isGenerating}
                size="sm"
              >
                {isGenerating ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sequential
              </Button>
            </div>
        </div>
        
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
            {error}
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            {Object.entries(noteTypeConfig).map(([key, config]) => {
              const IconComponent = config.icon;
              return (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="text-xs"
                  disabled={status[key as keyof typeof status] === 'pending'}
                >
                  <div className="flex items-center gap-1">
                    <IconComponent className="h-3 w-3" />
                    <span className="hidden sm:inline">{config.label}</span>
                  </div>
                  {status[key as keyof typeof status] === 'completed' && (
                    <div className="w-2 h-2 bg-green-500 rounded-full ml-1" />
                  )}
                  {status[key as keyof typeof status] === 'pending' && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full ml-1 animate-pulse" />
                  )}
                  {status[key as keyof typeof status] === 'failed' && (
                    <div className="w-2 h-2 bg-red-500 rounded-full ml-1" />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
          
          {Object.keys(noteTypeConfig).map((noteType) => (
            <TabsContent key={noteType} value={noteType} className="mt-4">
              {renderNoteContent(noteType as keyof typeof noteTypeConfig)}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
    </>
  );
}