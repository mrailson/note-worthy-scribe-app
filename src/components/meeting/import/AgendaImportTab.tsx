import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ClipboardList, Upload, Loader2, Plus, X, FileText, Sparkles } from 'lucide-react';
import { showToast } from '@/utils/toastWrapper';
import { cn } from '@/lib/utils';
import type { ImportedContent } from './LiveImportModal';

interface AgendaImportTabProps {
  onImport: (content: ImportedContent) => Promise<void>;
  isImporting: boolean;
}

export const AgendaImportTab: React.FC<AgendaImportTabProps> = ({
  onImport,
  isImporting
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pastedText, setPastedText] = useState('');
  const [parsedItems, setParsedItems] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [newItemText, setNewItemText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const parseAgenda = useCallback((text: string) => {
    if (!text.trim()) {
      setParsedItems([]);
      setSelectedItems(new Set());
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const items: string[] = [];
      
      for (const line of lines) {
        // Skip headers
        if (/^(?:agenda|topics?|items?|meeting|minutes):?$/i.test(line)) {
          continue;
        }
        
        // Clean up common prefixes
        let cleaned = line
          .replace(/^[-•*]\s*/, '')           // Bullets
          .replace(/^\d+[.)]\s*/, '')         // Numbered lists
          .replace(/^(?:item|topic)[\s:-]+/i, '') // Item prefixes
          .trim();
        
        if (cleaned && cleaned.length >= 3) {
          items.push(cleaned);
        }
      }
      
      // Dedupe
      const unique = [...new Set(items)];
      setParsedItems(unique);
      setSelectedItems(new Set(unique));
    } catch (error) {
      console.error('Parse error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPastedText(text);
    
    const timeoutId = setTimeout(() => parseAgenda(text), 300);
    return () => clearTimeout(timeoutId);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    
    try {
      const text = await file.text();
      setPastedText(text);
      parseAgenda(text);
      showToast.success('File content loaded', { section: 'meeting_manager' });
    } catch (error: any) {
      showToast.error(`Could not read file: ${error.message}`, { section: 'meeting_manager' });
    } finally {
      setIsProcessing(false);
    }
  };

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
    if (file && (file.type === 'text/plain' || file.name.endsWith('.txt'))) {
      setIsProcessing(true);
      try {
        const text = await file.text();
        setPastedText(text);
        parseAgenda(text);
      } catch (error: any) {
        showToast.error(`Could not read file: ${error.message}`, { section: 'meeting_manager' });
      } finally {
        setIsProcessing(false);
      }
    } else {
      showToast.error('Please drop a text file', { section: 'meeting_manager' });
    }
  }, [parseAgenda]);

  const addManualItem = () => {
    if (!newItemText.trim()) return;
    
    const item = newItemText.trim();
    if (parsedItems.some(i => i.toLowerCase() === item.toLowerCase())) {
      showToast.warning('Item already in list', { section: 'meeting_manager' });
      return;
    }
    
    setParsedItems(prev => [...prev, item]);
    setSelectedItems(prev => new Set([...prev, item]));
    setNewItemText('');
  };

  const removeItem = (item: string) => {
    setParsedItems(prev => prev.filter(i => i !== item));
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(item);
      return newSet;
    });
  };

  const toggleItem = (item: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(item)) {
        newSet.delete(item);
      } else {
        newSet.add(item);
      }
      return newSet;
    });
  };

  const handleImport = async () => {
    if (selectedItems.size === 0) {
      showToast.warning('Select at least one agenda item', { section: 'meeting_manager' });
      return;
    }
    
    const agendaText = Array.from(selectedItems)
      .map((item, idx) => `${idx + 1}. ${item}`)
      .join('\n');
    
    await onImport({ agenda: agendaText });
    
    // Clear state
    setPastedText('');
    setParsedItems([]);
    setSelectedItems(new Set());
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt"
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
          placeholder="Paste agenda items here...&#10;&#10;Examples:&#10;1. Welcome and introductions&#10;2. Review of last meeting's actions&#10;3. Budget discussion&#10;4. Any other business"
          value={pastedText}
          onChange={handleTextChange}
          className="min-h-[120px] resize-none"
        />
        {isDragOver && (
          <div className="absolute inset-0 bg-primary/5 backdrop-blur-sm flex items-center justify-center rounded-lg border-2 border-dashed border-primary">
            <div className="text-center">
              <FileText className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="font-medium text-sm">Drop file to import</p>
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
          placeholder="Add agenda item manually..."
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addManualItem()}
          className="flex-1"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={addManualItem}
          disabled={!newItemText.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Parsed items */}
      {parsedItems.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-sm">Agenda Items</span>
              </div>
              <Badge variant="secondary">
                {selectedItems.size} / {parsedItems.length} selected
              </Badge>
            </div>
            
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1">
                {parsedItems.map((item, idx) => (
                  <div 
                    key={idx}
                    className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors group"
                  >
                    <Checkbox
                      checked={selectedItems.has(item)}
                      onCheckedChange={() => toggleItem(item)}
                      className="mt-0.5"
                    />
                    <span className="text-xs text-muted-foreground w-5 shrink-0 mt-0.5">
                      {idx + 1}.
                    </span>
                    <Label 
                      className="flex-1 cursor-pointer text-sm leading-relaxed" 
                      onClick={() => toggleItem(item)}
                    >
                      {item}
                    </Label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={() => removeItem(item)}
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
          <span className="text-sm">Parsing agenda...</span>
        </div>
      )}

      {/* Import button */}
      {parsedItems.length > 0 && (
        <Button 
          onClick={handleImport} 
          disabled={isImporting || selectedItems.size === 0}
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
              Import {selectedItems.size} Agenda Item{selectedItems.size !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      )}
    </div>
  );
};
