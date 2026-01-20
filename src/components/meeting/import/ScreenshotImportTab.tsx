import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Camera, Upload, Loader2, Sparkles, Users, ListTodo, ClipboardList, X, Image as ImageIcon } from 'lucide-react';
import { ImageProcessor } from '@/utils/fileProcessors/ImageProcessor';
import { parseAttendeesFromText } from '@/utils/meeting/parseAttendeesFromText';
import { showToast } from '@/utils/toastWrapper';
import { cn } from '@/lib/utils';
import type { ImportedContent } from './LiveImportModal';

interface ScreenshotImportTabProps {
  onImport: (content: ImportedContent) => Promise<void>;
  isImporting: boolean;
}

interface ExtractedData {
  attendees: string[];
  actionItems: string[];
  agendaItems: string[];
  rawText: string;
}

export const ScreenshotImportTab: React.FC<ScreenshotImportTabProps> = ({
  onImport,
  isImporting
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  
  // Selection state
  const [selectedAttendees, setSelectedAttendees] = useState<Set<string>>(new Set());
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());
  const [selectedAgenda, setSelectedAgenda] = useState<Set<string>>(new Set());

  // Handle paste events for images
  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!dropZoneRef.current) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            processImage(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const processImage = async (file: File) => {
    setIsProcessing(true);
    setExtractedData(null);
    
    try {
      // Show preview
      const previewUrl = URL.createObjectURL(file);
      setSelectedImage(previewUrl);
      
      showToast.info('Extracting text from image...', { section: 'meeting_manager' });
      
      // OCR the image
      const rawText = await ImageProcessor.processImage(file);
      
      if (rawText.includes('OCR failed') || rawText.includes('No text found')) {
        showToast.warning('Could not extract text from image', { section: 'meeting_manager' });
        setIsProcessing(false);
        return;
      }
      
      // Parse content
      const extracted = parseExtractedContent(rawText);
      setExtractedData(extracted);
      
      // Auto-select all extracted items
      setSelectedAttendees(new Set(extracted.attendees));
      setSelectedActions(new Set(extracted.actionItems));
      setSelectedAgenda(new Set(extracted.agendaItems));
      
      showToast.success('Content extracted! Review and import.', { section: 'meeting_manager' });
      
    } catch (error: any) {
      console.error('Image processing error:', error);
      showToast.error(`Processing failed: ${error.message}`, { section: 'meeting_manager' });
    } finally {
      setIsProcessing(false);
    }
  };

  const parseExtractedContent = (rawText: string): ExtractedData => {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    
    // Parse attendees
    const attendeeResults = parseAttendeesFromText(rawText);
    const attendees = attendeeResults.map(a => a.name);
    
    // Parse action items (look for common patterns)
    const actionPatterns = [
      /^(?:action|todo|task|ai)[\s:-]+(.+)/i,
      /^[-•*]\s*(?:action|todo|task)[\s:-]+(.+)/i,
      /^\d+[.)]\s*(?:action|todo|task)[\s:-]+(.+)/i,
      /^[-•*]\s*\[[ x]\]\s*(.+)/i,
      /(?:action|todo|task|follow[- ]?up)[\s:-]+(.+)/i
    ];
    
    const actionItems: string[] = [];
    for (const line of lines) {
      for (const pattern of actionPatterns) {
        const match = line.match(pattern);
        if (match) {
          const action = match[1].trim();
          if (action && action.length > 5) {
            actionItems.push(action);
          }
          break;
        }
      }
    }
    
    // Parse agenda items (look for numbered items or bullet points with keywords)
    const agendaPatterns = [
      /^(?:agenda|item|topic)[\s:-]+(.+)/i,
      /^\d+[.)]\s+(?!action|todo|task)(.{10,})/i,
      /^[-•*]\s+(?!action|todo|task|ai[\s:-])(.{10,})/i
    ];
    
    const agendaItems: string[] = [];
    let inAgendaSection = false;
    
    for (const line of lines) {
      // Check if we're in an agenda section
      if (/^agenda/i.test(line) || /^topics/i.test(line)) {
        inAgendaSection = true;
        continue;
      }
      
      if (inAgendaSection && /^[a-z]/i.test(line)) {
        // Likely an agenda item
        if (line.length > 5 && !attendees.some(a => line.toLowerCase().includes(a.toLowerCase()))) {
          agendaItems.push(line.replace(/^[-•*\d.)]+\s*/, ''));
        }
      }
      
      // Also check for explicit patterns
      for (const pattern of agendaPatterns) {
        const match = line.match(pattern);
        if (match && !actionItems.includes(match[1])) {
          const item = match[1].trim();
          if (item && item.length > 5 && !agendaItems.includes(item)) {
            agendaItems.push(item);
          }
          break;
        }
      }
    }
    
    return {
      attendees,
      actionItems,
      agendaItems,
      rawText
    };
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        processImage(file);
      } else {
        showToast.error('Please drop an image file', { section: 'meeting_manager' });
      }
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
  };

  const handleImport = async () => {
    if (!extractedData) return;
    
    const content: ImportedContent = {};
    
    if (selectedAttendees.size > 0) {
      content.attendees = Array.from(selectedAttendees);
    }
    if (selectedActions.size > 0) {
      content.actionItems = Array.from(selectedActions);
    }
    if (selectedAgenda.size > 0) {
      content.agenda = Array.from(selectedAgenda).join('\n• ');
    }
    
    if (Object.keys(content).length === 0) {
      showToast.warning('Select at least one item to import', { section: 'meeting_manager' });
      return;
    }
    
    await onImport(content);
    handleClear();
  };

  const handleClear = () => {
    setSelectedImage(null);
    setExtractedData(null);
    setSelectedAttendees(new Set());
    setSelectedActions(new Set());
    setSelectedAgenda(new Set());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleItem = (set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>, item: string) => {
    const newSet = new Set(set);
    if (newSet.has(item)) {
      newSet.delete(item);
    } else {
      newSet.add(item);
    }
    setFn(newSet);
  };

  const hasExtractedContent = extractedData && (
    extractedData.attendees.length > 0 ||
    extractedData.actionItems.length > 0 ||
    extractedData.agendaItems.length > 0
  );

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {!selectedImage ? (
        <div
          ref={dropZoneRef}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          tabIndex={0}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
            isDragOver 
              ? "border-primary bg-primary/5 scale-[1.02]" 
              : "border-border/60 hover:border-primary/50 hover:bg-muted/30"
          )}
        >
          <div className="flex flex-col items-center gap-3">
            <div className={cn(
              "p-4 rounded-full transition-colors",
              isDragOver ? "bg-primary/10" : "bg-muted"
            )}>
              <Camera className={cn(
                "h-8 w-8 transition-colors",
                isDragOver ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <p className="font-medium">Drop or paste a screenshot here</p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse • Supports JPG, PNG, WEBP
              </p>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> Attendees
              </span>
              <span className="flex items-center gap-1">
                <ListTodo className="h-3.5 w-3.5" /> Actions
              </span>
              <span className="flex items-center gap-1">
                <ClipboardList className="h-3.5 w-3.5" /> Agenda
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Image preview */}
          <Card className="overflow-hidden">
            <CardContent className="p-0 relative">
              <img 
                src={selectedImage} 
                alt="Screenshot" 
                className="w-full max-h-40 object-cover"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClear}
                className="absolute top-2 right-2 h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background"
              >
                <X className="h-4 w-4" />
              </Button>
              
              {isProcessing && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                  <div className="flex items-center gap-2 text-primary">
                    <Sparkles className="h-5 w-5 animate-pulse" />
                    <span className="font-medium">Extracting content...</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Extracted content */}
          {extractedData && (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-4">
                {/* Attendees */}
                {extractedData.attendees.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Attendees</span>
                      <Badge variant="secondary" className="text-xs">
                        {selectedAttendees.size}/{extractedData.attendees.length}
                      </Badge>
                    </div>
                    <div className="grid gap-1.5 pl-6">
                      {extractedData.attendees.map((attendee, idx) => (
                        <Label 
                          key={idx}
                          className="flex items-center gap-2 cursor-pointer text-sm p-2 rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={selectedAttendees.has(attendee)}
                            onCheckedChange={() => toggleItem(selectedAttendees, setSelectedAttendees, attendee)}
                          />
                          <span>{attendee}</span>
                        </Label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Items */}
                {extractedData.actionItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ListTodo className="h-4 w-4 text-orange-500" />
                      <span className="font-medium text-sm">Action Items</span>
                      <Badge variant="secondary" className="text-xs">
                        {selectedActions.size}/{extractedData.actionItems.length}
                      </Badge>
                    </div>
                    <div className="grid gap-1.5 pl-6">
                      {extractedData.actionItems.map((action, idx) => (
                        <Label 
                          key={idx}
                          className="flex items-start gap-2 cursor-pointer text-sm p-2 rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={selectedActions.has(action)}
                            onCheckedChange={() => toggleItem(selectedActions, setSelectedActions, action)}
                            className="mt-0.5"
                          />
                          <span className="flex-1">{action}</span>
                        </Label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Agenda Items */}
                {extractedData.agendaItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-sm">Agenda Items</span>
                      <Badge variant="secondary" className="text-xs">
                        {selectedAgenda.size}/{extractedData.agendaItems.length}
                      </Badge>
                    </div>
                    <div className="grid gap-1.5 pl-6">
                      {extractedData.agendaItems.map((item, idx) => (
                        <Label 
                          key={idx}
                          className="flex items-start gap-2 cursor-pointer text-sm p-2 rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={selectedAgenda.has(item)}
                            onCheckedChange={() => toggleItem(selectedAgenda, setSelectedAgenda, item)}
                            className="mt-0.5"
                          />
                          <span className="flex-1">{item}</span>
                        </Label>
                      ))}
                    </div>
                  </div>
                )}

                {!hasExtractedContent && (
                  <div className="text-center py-6 text-muted-foreground">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No structured content detected.</p>
                    <p className="text-xs mt-1">Try a clearer screenshot with attendee lists or agendas.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Import button */}
          {hasExtractedContent && (
            <Button 
              onClick={handleImport} 
              disabled={isImporting || (selectedAttendees.size + selectedActions.size + selectedAgenda.size === 0)}
              className="w-full"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Selected ({selectedAttendees.size + selectedActions.size + selectedAgenda.size} items)
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
