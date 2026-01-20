import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Upload, Loader2, Plus, X, FileText, Sparkles, Image as ImageIcon } from 'lucide-react';
import { parseAttendeesFromText } from '@/utils/meeting/parseAttendeesFromText';
import { ImageProcessor } from '@/utils/fileProcessors/ImageProcessor';
import { showToast } from '@/utils/toastWrapper';
import { cn } from '@/lib/utils';
import type { ImportedContent } from './LiveImportModal';

interface AttendeesImportTabProps {
  onImport: (content: ImportedContent) => Promise<void>;
  isImporting: boolean;
}

interface ParsedAttendee {
  name: string;
  organization?: string;
  role?: string;
}

export const AttendeesImportTab: React.FC<AttendeesImportTabProps> = ({
  onImport,
  isImporting
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pastedText, setPastedText] = useState('');
  const [parsedAttendees, setParsedAttendees] = useState<ParsedAttendee[]>([]);
  const [selectedAttendees, setSelectedAttendees] = useState<Set<string>>(new Set());
  const [newAttendeeName, setNewAttendeeName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const parseAttendees = useCallback((text: string) => {
    if (!text.trim()) {
      setParsedAttendees([]);
      setSelectedAttendees(new Set());
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const parsed = parseAttendeesFromText(text);
      setParsedAttendees(parsed);
      // Auto-select all parsed attendees
      setSelectedAttendees(new Set(parsed.map(a => a.name)));
    } catch (error) {
      console.error('Parse error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPastedText(text);
    
    // Debounce parsing
    const timeoutId = setTimeout(() => parseAttendees(text), 300);
    return () => clearTimeout(timeoutId);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    
    try {
      const text = await file.text();
      setPastedText(text);
      parseAttendees(text);
      showToast.success('File content loaded', { section: 'meeting_manager' });
    } catch (error: any) {
      showToast.error(`Could not read file: ${error.message}`, { section: 'meeting_manager' });
    } finally {
      setIsProcessing(false);
    }
  };

  const processImageForAttendees = useCallback(async (file: File) => {
    setIsProcessing(true);
    try {
      showToast.info('Extracting attendees from image...', { section: 'meeting_manager' });
      const rawText = await ImageProcessor.processImage(file);
      
      if (rawText.includes('OCR failed') || rawText.includes('No text found')) {
        showToast.warning('Could not extract text from image', { section: 'meeting_manager' });
        return;
      }
      
      setPastedText(rawText);
      parseAttendees(rawText);
      showToast.success('Attendees extracted from image', { section: 'meeting_manager' });
    } catch (error: any) {
      showToast.error(`Image processing failed: ${error.message}`, { section: 'meeting_manager' });
    } finally {
      setIsProcessing(false);
    }
  }, [parseAttendees]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    // Handle images
    if (file.type.startsWith('image/')) {
      await processImageForAttendees(file);
      return;
    }
    
    // Handle text files
    if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
      setIsProcessing(true);
      try {
        const text = await file.text();
        setPastedText(text);
        parseAttendees(text);
      } catch (error: any) {
        showToast.error(`Could not read file: ${error.message}`, { section: 'meeting_manager' });
      } finally {
        setIsProcessing(false);
      }
      return;
    }
    
    showToast.error('Please drop an image or text file', { section: 'meeting_manager' });
  }, [parseAttendees, processImageForAttendees]);

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await processImageForAttendees(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [processImageForAttendees]);

  const addManualAttendee = () => {
    if (!newAttendeeName.trim()) return;
    
    const name = newAttendeeName.trim();
    if (parsedAttendees.some(a => a.name.toLowerCase() === name.toLowerCase())) {
      showToast.warning('Attendee already in list', { section: 'meeting_manager' });
      return;
    }
    
    const newAttendee: ParsedAttendee = { name };
    setParsedAttendees(prev => [...prev, newAttendee]);
    setSelectedAttendees(prev => new Set([...prev, name]));
    setNewAttendeeName('');
  };

  const removeAttendee = (name: string) => {
    setParsedAttendees(prev => prev.filter(a => a.name !== name));
    setSelectedAttendees(prev => {
      const newSet = new Set(prev);
      newSet.delete(name);
      return newSet;
    });
  };

  const toggleAttendee = (name: string) => {
    setSelectedAttendees(prev => {
      const newSet = new Set(prev);
      if (newSet.has(name)) {
        newSet.delete(name);
      } else {
        newSet.add(name);
      }
      return newSet;
    });
  };

  const handleImport = async () => {
    if (selectedAttendees.size === 0) {
      showToast.warning('Select at least one attendee', { section: 'meeting_manager' });
      return;
    }
    
    await onImport({ attendees: Array.from(selectedAttendees) });
    
    // Clear state after successful import
    setPastedText('');
    setParsedAttendees([]);
    setSelectedAttendees(new Set());
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.csv"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {/* Paste/Drop area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-lg transition-all",
          isDragOver && "ring-2 ring-primary ring-offset-2"
        )}
      >
        <Textarea
          placeholder="Paste attendee list or screenshot here...&#10;&#10;Supports formats like:&#10;• John Smith, Jane Doe&#10;• Name (Organisation)&#10;• name@email.com&#10;• Screenshots (Ctrl+V)"
          value={pastedText}
          onChange={handleTextChange}
          className="min-h-[120px] resize-none"
        />
        {isDragOver && (
          <div className="absolute inset-0 bg-primary/5 backdrop-blur-sm flex items-center justify-center rounded-lg border-2 border-dashed border-primary">
            <div className="text-center">
              <ImageIcon className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="font-medium text-sm">Drop image or file to import</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="flex-1"
        >
          <FileText className="h-4 w-4 mr-2" />
          Import from File
        </Button>
      </div>

      {/* Manual add */}
      <div className="flex gap-2">
        <Input
          placeholder="Add attendee manually..."
          value={newAttendeeName}
          onChange={(e) => setNewAttendeeName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addManualAttendee()}
          className="flex-1"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={addManualAttendee}
          disabled={!newAttendeeName.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Parsed attendees */}
      {parsedAttendees.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Detected Attendees</span>
              </div>
              <Badge variant="secondary">
                {selectedAttendees.size} / {parsedAttendees.length} selected
              </Badge>
            </div>
            
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1">
                {parsedAttendees.map((attendee, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors group"
                  >
                    <Checkbox
                      checked={selectedAttendees.has(attendee.name)}
                      onCheckedChange={() => toggleAttendee(attendee.name)}
                    />
                    <Label className="flex-1 cursor-pointer text-sm" onClick={() => toggleAttendee(attendee.name)}>
                      {attendee.name}
                      {attendee.organization && (
                        <span className="text-muted-foreground ml-1">
                          ({attendee.organization})
                        </span>
                      )}
                      {attendee.role && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {attendee.role}
                        </Badge>
                      )}
                    </Label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeAttendee(attendee.name)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {isProcessing && (
        <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse" />
          <span className="text-sm">Parsing attendees...</span>
        </div>
      )}

      {/* Import button */}
      {parsedAttendees.length > 0 && (
        <Button 
          onClick={handleImport} 
          disabled={isImporting || selectedAttendees.size === 0}
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
              Import {selectedAttendees.size} Attendee{selectedAttendees.size !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      )}
    </div>
  );
};
