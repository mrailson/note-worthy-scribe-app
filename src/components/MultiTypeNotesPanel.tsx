import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, RefreshCw, Sparkles, FileText, Crown, Book, Scroll, Wand2, MoreVertical, Copy, Mail, Target, Zap, Users, AlertTriangle, PoundSterling, BarChart, TrendingUp, CheckCircle2, Mic } from 'lucide-react';
import { useMultiTypeNotes, type MultiTypeNote } from '@/hooks/useMultiTypeNotes';
import { NoteEnhancementDialog } from './meeting/NoteEnhancementDialog';
import { EmailMeetingMinutesModal } from './EmailMeetingMinutesModal';
import { showToast } from '@/utils/toastWrapper';
import { supabase } from '@/integrations/supabase/client';
import { copyPlainTextToClipboard } from '@/utils/stripMarkdown';

// Helper to sanitize markdown-style bold text to HTML
const sanitizeBoldText = (text: string): string => {
  const html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['strong'] });
};
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
    label: 'Executive One-Pager',
    description: 'Strategic brief for senior leaders (1-2 min read)',
    icon: Crown,
    color: 'bg-purple-100 text-purple-800',
    isOnePager: true
  },
  limerick: {
    label: 'Creative Summary',
    description: 'Fun limerick-style notes (1-6 verses)',
    icon: Sparkles,
    color: 'bg-gradient-to-r from-pink-100 to-purple-100 text-pink-800',
    isPoetry: true
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
        } as any)
        .eq('id', currentEnhancingNote.id);

      if (error) throw error;

      showToast.success('Note updated successfully!', { section: 'meeting_manager' });
      
      // Refresh the notes by triggering a re-fetch
      window.location.reload();
    } catch (error) {
      console.error('Error updating note:', error);
      showToast.error('Failed to update note', { section: 'meeting_manager' });
    }
  };

  const handleCopy = async (note: MultiTypeNote) => {
    const success = await copyPlainTextToClipboard(note.content);
    if (success) {
      showToast.success('Notes copied to clipboard!', { section: 'meeting_manager' });
    } else {
      showToast.error('Failed to copy to clipboard', { section: 'meeting_manager' });
    }
  };

  const handleEmailClick = (note: MultiTypeNote) => {
    setCurrentNoteForEmail(note);
    setEmailModalOpen(true);
  };

  // Custom renderer for limerick poetry
  const renderLimerickContent = (content: string) => {
    // Parse content into sections
    const sections = content.split(/(?=^##?\s)/m);
    const verses: Array<{number: number; title: string; content: string}> = [];
    const practicalSections: Array<{title: string; content: string}> = [];
    let meetingSize = '';

    sections.forEach(section => {
      const trimmed = section.trim();
      if (!trimmed) return;

      // Extract verses
      const verseMatch = trimmed.match(/^##\s*Verse\s*(\d+)(.*)$/m);
      if (verseMatch) {
        const verseNumber = parseInt(verseMatch[1]);
        const verseTitle = verseMatch[2].trim();
        const verseContent = trimmed.split('\n').slice(1).join('\n').trim();
        verses.push({ number: verseNumber, title: verseTitle, content: verseContent });
      }
      // Extract practical sections
      else if (trimmed.match(/^##\s*(What It Actually Means|Action Items|Next Meeting)/)) {
        const lines = trimmed.split('\n');
        const title = lines[0].replace(/^##\s*/, '').trim();
        const content = lines.slice(1).join('\n').trim();
        practicalSections.push({ title, content });
      }
      // Extract meeting size
      else if (trimmed.includes('Meeting Size:')) {
        const match = trimmed.match(/Meeting Size:\s*(.+)/);
        if (match) meetingSize = match[1].trim();
      }
    });

    return (
      <div className="space-y-6">
        {/* Poetry Header */}
        <div className="text-center space-y-2 pb-4 border-b-2 border-pink-200">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-6 w-6 text-pink-500" />
            <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              Meeting in Verse
            </h2>
            <Sparkles className="h-6 w-6 text-purple-500" />
          </div>
          <p className="text-sm text-muted-foreground italic">
            A poetic summary of what transpired
          </p>
        </div>

        {/* Verses */}
        <div className="space-y-4">
          {verses.map((verse) => (
            <Card 
              key={verse.number}
              className="border-l-4 border-l-pink-400 bg-gradient-to-r from-pink-50/50 to-purple-50/30 shadow-sm hover:shadow-md transition-shadow"
            >
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                      {verse.number}
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    {verse.title && (
                      <div className="text-xs font-semibold text-pink-700 uppercase tracking-wide">
                        {verse.title.replace(/^-\s*/, '')}
                      </div>
                    )}
                    <div className="italic text-base leading-relaxed text-foreground/90 whitespace-pre-wrap font-serif">
                      {verse.content}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Separator */}
        {practicalSections.length > 0 && (
          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-pink-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-4 text-sm text-muted-foreground font-medium">
                Now for the serious stuff... 📋
              </span>
            </div>
          </div>
        )}

        {/* Practical Sections */}
        {practicalSections.map((section, idx) => {
          const isActionItems = section.title.includes('Action Items');
          const isNextMeeting = section.title.includes('Next Meeting');
          
          return (
            <Card key={idx} className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  {isActionItems && <CheckCircle2 className="h-5 w-5 text-blue-600" />}
                  {isNextMeeting && <Mic className="h-5 w-5 text-green-600" />}
                  {!isActionItems && !isNextMeeting && <FileText className="h-5 w-5 text-purple-600" />}
                  <h3 className="font-semibold text-lg">{section.title}</h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                  {section.content}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Meeting Size Badge */}
        {meetingSize && (
          <div className="flex justify-center pt-2">
            <Badge variant="outline" className="bg-gradient-to-r from-pink-50 to-purple-50 text-pink-700 border-pink-200">
              {meetingSize}
            </Badge>
          </div>
        )}
      </div>
    );
  };

  const renderExecutiveContent = (content: string) => {
    const sections = content.split(/(?=^# )/gm);
    
    const iconMap: Record<string, any> = {
      '🎯': Target,
      '⚡': Zap,
      '👥': Users,
      '⚠️': AlertTriangle,
      '💰': PoundSterling,
      '📊': BarChart
    };

    return (
      <div className="space-y-6">
        {sections.map((section, idx) => {
          if (!section.trim()) return null;
          
          const lines = section.split('\n').filter(l => l.trim());
          const headerLine = lines[0] || '';
          const emoji = headerLine.match(/[🎯⚡👥⚠️💰📊]/)?.[0] || '';
          const IconComponent = iconMap[emoji] || Target;
          const sectionTitle = headerLine.replace(/^#\s*/, '').replace(/[🎯⚡👥⚠️💰📊]/g, '').trim();
          const sectionContent = lines.slice(1).join('\n');

          // Special rendering for different sections
          if (sectionTitle.includes('MEETING CONTEXT')) {
            return (
              <Card key={idx} className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <IconComponent className="h-6 w-6 text-primary" />
                    {sectionTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base leading-relaxed">{sectionContent}</p>
                </CardContent>
              </Card>
            );
          }

          if (sectionTitle.includes('CRITICAL DECISIONS')) {
            return (
              <Card key={idx} className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <IconComponent className="h-6 w-6 text-blue-600" />
                    {sectionTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sectionContent.split('•').filter(s => s.trim()).map((decision, i) => (
                    <Alert key={i} className="border-blue-200 bg-blue-50/50">
                      <AlertDescription className="text-sm">
                        <div dangerouslySetInnerHTML={{ __html: sanitizeBoldText(decision.trim()) }} />
                      </AlertDescription>
                    </Alert>
                  ))}
                </CardContent>
              </Card>
            );
          }

          if (sectionTitle.includes('LEADERSHIP ACTION')) {
            return (
              <Card key={idx} className="border-l-4 border-l-amber-500">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <IconComponent className="h-6 w-6 text-amber-600" />
                    {sectionTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sectionContent.split('•').filter(s => s.trim()).map((action, i) => (
                    <Alert key={i} className="border-amber-200 bg-amber-50/50">
                      <AlertDescription className="text-sm">
                        <div dangerouslySetInnerHTML={{ __html: sanitizeBoldText(action.trim()) }} />
                      </AlertDescription>
                    </Alert>
                  ))}
                </CardContent>
              </Card>
            );
          }

          if (sectionTitle.includes('RISKS & OPPORTUNITIES')) {
            return (
              <Card key={idx} className="border-l-4 border-l-orange-500">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <IconComponent className="h-6 w-6 text-orange-600" />
                    {sectionTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sectionContent.split('•').filter(s => s.trim()).map((item, i) => {
                    const isRisk = item.includes('Risk:');
                    return (
                      <Alert key={i} className={isRisk ? 'border-red-200 bg-red-50/50' : 'border-green-200 bg-green-50/50'}>
                        <div className="flex items-start gap-2">
                          {isRisk ? (
                            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                          ) : (
                            <TrendingUp className="h-4 w-4 text-green-600 mt-0.5" />
                          )}
                          <AlertDescription className="text-sm flex-1">
                            <div dangerouslySetInnerHTML={{ __html: sanitizeBoldText(item.trim()) }} />
                          </AlertDescription>
                        </div>
                      </Alert>
                    );
                  })}
                </CardContent>
              </Card>
            );
          }

          if (sectionTitle.includes('FINANCIAL')) {
            return (
              <Card key={idx} className="border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50/50 to-transparent">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <IconComponent className="h-6 w-6 text-purple-600" />
                    {sectionTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {sectionContent.split('•').filter(s => s.trim()).map((metric, i) => (
                      <div key={i} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                        <p className="text-sm" dangerouslySetInnerHTML={{ __html: sanitizeBoldText(metric.trim()) }} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          }

          if (sectionTitle.includes('WHY THIS MATTERS')) {
            return (
              <Card key={idx} className="border-2 border-primary bg-gradient-to-r from-primary/10 to-transparent">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <IconComponent className="h-6 w-6 text-primary" />
                    {sectionTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base font-medium leading-relaxed">{sectionContent}</p>
                </CardContent>
              </Card>
            );
          }

          // Default rendering
          return (
            <Card key={idx}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <IconComponent className="h-5 w-5" />
                  {sectionTitle}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: sanitizeBoldText(sectionContent) }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
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

    // Check if this is a limerick/poetry note
    if (noteType === 'limerick' && 'isPoetry' in config && config.isPoetry && note?.content) {
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
          {renderLimerickContent(note.content)}
        </div>
      );
    }

    // Check if this is an executive one-pager for special rendering
    const isExecutiveOnePager = noteType === 'executive' && 'isOnePager' in config && config.isOnePager;

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
        
        {isExecutiveOnePager ? (
          renderExecutiveContent(note.content)
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <div 
              className="whitespace-pre-wrap leading-relaxed"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.content || '') }}
            />
          </div>
        )}
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