import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Download, RefreshCw, Sparkles, FileText, Crown, Book, Scroll } from 'lucide-react';
import { useMultiTypeNotes, type MultiTypeNote } from '@/hooks/useMultiTypeNotes';

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload(note)}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
        
        <div className="prose max-w-none">
          <div 
            className="whitespace-pre-wrap text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: note.content.replace(/\n/g, '<br>') }}
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
  );
}