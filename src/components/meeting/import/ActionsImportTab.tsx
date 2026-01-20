import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ListTodo, Upload, Loader2, Plus, X, FileText, Sparkles } from 'lucide-react';
import { showToast } from '@/utils/toastWrapper';
import { cn } from '@/lib/utils';
import type { ImportedContent } from './LiveImportModal';

interface ActionsImportTabProps {
  onImport: (content: ImportedContent) => Promise<void>;
  isImporting: boolean;
}

export const ActionsImportTab: React.FC<ActionsImportTabProps> = ({
  onImport,
  isImporting
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pastedText, setPastedText] = useState('');
  const [parsedActions, setParsedActions] = useState<string[]>([]);
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());
  const [newActionText, setNewActionText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const parseActions = useCallback((text: string) => {
    if (!text.trim()) {
      setParsedActions([]);
      setSelectedActions(new Set());
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const actions: string[] = [];
      
      for (const line of lines) {
        // Clean up common prefixes
        let cleaned = line
          .replace(/^[-•*]\s*/, '')           // Bullets
          .replace(/^\d+[.)]\s*/, '')         // Numbered lists
          .replace(/^\[[ x?]\]\s*/i, '')      // Checkboxes
          .replace(/^(?:action|todo|task|ai)[\s:-]+/i, '') // Action prefixes
          .trim();
        
        if (cleaned && cleaned.length >= 5) {
          actions.push(cleaned);
        }
      }
      
      // Dedupe
      const unique = [...new Set(actions)];
      setParsedActions(unique);
      setSelectedActions(new Set(unique));
    } catch (error) {
      console.error('Parse error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPastedText(text);
    
    const timeoutId = setTimeout(() => parseActions(text), 300);
    return () => clearTimeout(timeoutId);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    
    try {
      const text = await file.text();
      setPastedText(text);
      parseActions(text);
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
        parseActions(text);
      } catch (error: any) {
        showToast.error(`Could not read file: ${error.message}`, { section: 'meeting_manager' });
      } finally {
        setIsProcessing(false);
      }
    } else {
      showToast.error('Please drop a text file', { section: 'meeting_manager' });
    }
  }, [parseActions]);

  const addManualAction = () => {
    if (!newActionText.trim()) return;
    
    const action = newActionText.trim();
    if (parsedActions.some(a => a.toLowerCase() === action.toLowerCase())) {
      showToast.warning('Action already in list', { section: 'meeting_manager' });
      return;
    }
    
    setParsedActions(prev => [...prev, action]);
    setSelectedActions(prev => new Set([...prev, action]));
    setNewActionText('');
  };

  const removeAction = (action: string) => {
    setParsedActions(prev => prev.filter(a => a !== action));
    setSelectedActions(prev => {
      const newSet = new Set(prev);
      newSet.delete(action);
      return newSet;
    });
  };

  const toggleAction = (action: string) => {
    setSelectedActions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(action)) {
        newSet.delete(action);
      } else {
        newSet.add(action);
      }
      return newSet;
    });
  };

  const handleImport = async () => {
    if (selectedActions.size === 0) {
      showToast.warning('Select at least one action item', { section: 'meeting_manager' });
      return;
    }
    
    await onImport({ actionItems: Array.from(selectedActions) });
    
    // Clear state
    setPastedText('');
    setParsedActions([]);
    setSelectedActions(new Set());
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
          placeholder="Paste action items here...&#10;&#10;Examples:&#10;• Review budget proposal by Friday&#10;• Follow up with client on contract&#10;• Schedule team sync for next week"
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
          placeholder="Add action item manually..."
          value={newActionText}
          onChange={(e) => setNewActionText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addManualAction()}
          className="flex-1"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={addManualAction}
          disabled={!newActionText.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Parsed actions */}
      {parsedActions.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-orange-500" />
                <span className="font-medium text-sm">Action Items</span>
              </div>
              <Badge variant="secondary">
                {selectedActions.size} / {parsedActions.length} selected
              </Badge>
            </div>
            
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1">
                {parsedActions.map((action, idx) => (
                  <div 
                    key={idx}
                    className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors group"
                  >
                    <Checkbox
                      checked={selectedActions.has(action)}
                      onCheckedChange={() => toggleAction(action)}
                      className="mt-0.5"
                    />
                    <Label 
                      className="flex-1 cursor-pointer text-sm leading-relaxed" 
                      onClick={() => toggleAction(action)}
                    >
                      {action}
                    </Label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={() => removeAction(action)}
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
          <span className="text-sm">Parsing actions...</span>
        </div>
      )}

      {/* Import button */}
      {parsedActions.length > 0 && (
        <Button 
          onClick={handleImport} 
          disabled={isImporting || selectedActions.size === 0}
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
              Import {selectedActions.size} Action{selectedActions.size !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      )}
    </div>
  );
};
