import React, { useCallback, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, X, FileText, Upload, FileSpreadsheet, File, Trash2, Check, ChevronDown, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  PRESENTATION_TYPES, 
  TARGET_AUDIENCES,
  type PresentationStudioSettings,
  type SupportingDocument,
} from '@/types/presentationStudio';

interface DocumentWithStatus extends SupportingDocument {
  isExtracting?: boolean;
  extractionError?: string;
}

interface ContentTabProps {
  settings: PresentationStudioSettings;
  onUpdate: (updates: Partial<PresentationStudioSettings>) => void;
  onAddDocument: (doc: SupportingDocument) => void;
  onUpdateDocument: (docId: string, updates: Partial<SupportingDocument>) => void;
  onRemoveDocument: (docId: string) => void;
  onToggleDocument: (docId: string) => void;
  onAddKeyPoint: (point: string) => void;
  onRemoveKeyPoint: (index: number) => void;
}

export const ContentTab: React.FC<ContentTabProps> = ({
  settings,
  onUpdate,
  onAddDocument,
  onUpdateDocument,
  onRemoveDocument,
  onToggleDocument,
  onAddKeyPoint,
  onRemoveKeyPoint,
}) => {
  const [newKeyPoint, setNewKeyPoint] = useState('');
  const [typeOpen, setTypeOpen] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [extractingDocs, setExtractingDocs] = useState<Set<string>>(new Set());

  const handleAddKeyPoint = () => {
    if (newKeyPoint.trim() && settings.keyPoints.length < 10) {
      onAddKeyPoint(newKeyPoint.trim());
      setNewKeyPoint('');
    }
  };

  // Determine file type for extraction
  const getFileType = (file: File): string => {
    if (file.type.includes('pdf')) return 'pdf';
    if (file.type.includes('powerpoint') || file.name.endsWith('.pptx') || file.name.endsWith('.ppt')) return 'powerpoint';
    if (file.type.includes('word') || file.name.endsWith('.docx') || file.name.endsWith('.doc')) return 'word';
    if (file.type.includes('excel') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) return 'excel';
    return 'unknown';
  };

  // Check if file is text-based
  const isTextFile = (file: File): boolean => {
    return file.type.includes('text') || 
           file.name.endsWith('.csv') || 
           file.name.endsWith('.txt');
  };

  // Read file as text
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  // Read file as DataURL
  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        let content: string;

        if (isTextFile(file)) {
          // Text files: read directly
          content = await readFileAsText(file);
        } else {
          // Binary files (DOCX, PDF, PPTX, XLSX): extract text via edge function
          setExtractingDocs(prev => new Set(prev).add(docId));
          
          // First add the doc with loading state
          const loadingDoc: SupportingDocument = {
            id: docId,
            name: file.name,
            content: '', // Will be populated after extraction
            type: file.type,
            size: file.size,
            selected: true,
          };
          onAddDocument(loadingDoc);
          
          const dataUrl = await readFileAsDataURL(file);
          const fileType = getFileType(file);
          
          console.log(`[ContentTab] Extracting text from ${file.name} (${fileType})`);
          
          const { data, error } = await supabase.functions.invoke('extract-document-text', {
            body: { fileType, dataUrl, fileName: file.name }
          });
          
          setExtractingDocs(prev => {
            const next = new Set(prev);
            next.delete(docId);
            return next;
          });
          
          if (error || !data?.extractedText) {
            console.error('Extraction error:', error || 'No text returned');
            toast.error(`Failed to extract text from ${file.name}`);
            onRemoveDocument(docId);
            continue;
          }
          
          content = data.extractedText;
          console.log(`[ContentTab] Extracted ${content.length} chars from ${file.name}`);
          
          // Update the existing doc with extracted content using proper update function
          onUpdateDocument(docId, { content });
          toast.success(`Extracted text from ${file.name}`);
          continue; // Skip the add below - doc already exists and has been updated
        }

        // For text files, add as new document
        const doc: SupportingDocument = {
          id: docId,
          name: file.name,
          content,
          type: file.type,
          size: file.size,
          selected: true,
        };
        onAddDocument(doc);
      } catch (error) {
        console.error('Error processing file:', error);
        setExtractingDocs(prev => {
          const next = new Set(prev);
          next.delete(docId);
          return next;
        });
        toast.error(`Failed to process ${file.name}`);
      }
    }
  }, [onAddDocument, onUpdateDocument, onRemoveDocument]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <File className="h-4 w-4 text-red-500" />;
    if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) {
      return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
    }
    return <FileText className="h-4 w-4 text-blue-500" />;
  };

  const selectedType = PRESENTATION_TYPES.find(t => t.id === settings.presentationType);
  const selectedAudience = TARGET_AUDIENCES.find(a => a.id === settings.targetAudience);

  return (
    <div className="space-y-6">
      {/* Topic/Title */}
      <div className="space-y-2">
        <Label htmlFor="topic" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Presentation Topic
        </Label>
        <Input
          id="topic"
          placeholder="e.g., Q4 Practice Performance Review, Staff Training on GDPR..."
          value={settings.topic}
          onChange={(e) => onUpdate({ topic: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          The main topic or title for your presentation
        </p>
      </div>

      {/* Presentation Type - Collapsible */}
      <Collapsible open={typeOpen} onOpenChange={setTypeOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between w-full p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="font-medium">Presentation Type</span>
              {selectedType && (
                <Badge variant="secondary" className="ml-2">
                  {selectedType.label}
                </Badge>
              )}
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              typeOpen && "rotate-180"
            )} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div className="grid grid-cols-2 gap-2">
            {PRESENTATION_TYPES.map((type) => (
              <Card 
                key={type.id}
                className={cn(
                  "cursor-pointer transition-all hover:border-primary/50",
                  settings.presentationType === type.id && "border-primary bg-primary/5"
                )}
                onClick={() => onUpdate({ presentationType: type.id })}
              >
                <CardContent className="p-3">
                  <p className="font-medium text-sm">{type.label}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{type.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Target Audience - Collapsible */}
      <Collapsible open={audienceOpen} onOpenChange={setAudienceOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between w-full p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="font-medium">Target Audience</span>
              {selectedAudience && (
                <Badge variant="secondary" className="ml-2">
                  {selectedAudience.label}
                </Badge>
              )}
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              audienceOpen && "rotate-180"
            )} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div className="grid grid-cols-3 gap-2">
            {TARGET_AUDIENCES.map((audience) => (
              <Card 
                key={audience.id}
                className={cn(
                  "cursor-pointer transition-all hover:border-primary/50",
                  settings.targetAudience === audience.id && "border-primary bg-primary/5"
                )}
                onClick={() => onUpdate({ targetAudience: audience.id })}
              >
                <CardContent className="p-2 text-center">
                  <p className="font-medium text-sm">{audience.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Supporting Documents */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Supporting Documents
        </Label>
        
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
          )}
        >
          <input {...getInputProps()} />
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {isDragActive ? "Drop files here..." : "Drag & drop documents, or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, Word, Excel, CSV, TXT (max 10MB each)
          </p>
        </div>

        {settings.supportingDocuments.length > 0 && (
          <ScrollArea className="h-[160px]">
            <div className="space-y-2">
              {settings.supportingDocuments.map((doc) => {
                const isExtracting = extractingDocs.has(doc.id);
                const hasContent = doc.content && doc.content.length > 0;
                
                return (
                  <div
                    key={doc.id}
                    className={cn(
                      "flex flex-col gap-1 p-2 rounded-md border transition-colors",
                      doc.selected ? "bg-primary/5 border-primary/30" : "bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleDocument(doc.id)}
                        disabled={isExtracting}
                        className={cn(
                          "flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center",
                          doc.selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground",
                          isExtracting && "opacity-50"
                        )}
                      >
                        {doc.selected && <Check className="h-3 w-3" />}
                      </button>
                      {isExtracting ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        getFileIcon(doc.type)
                      )}
                      <span className="text-sm flex-1 truncate">{doc.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(doc.size / 1024).toFixed(0)}KB
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onRemoveDocument(doc.id)}
                        disabled={isExtracting}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {/* Extraction status and content preview */}
                    {isExtracting && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pl-7">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Extracting text...
                      </div>
                    )}
                    {!isExtracting && hasContent && (
                      <div className="text-xs text-muted-foreground pl-7 line-clamp-2">
                        <span className="text-primary font-medium">{doc.content.length.toLocaleString()} chars</span>
                        {' · '}
                        {doc.content.substring(0, 100).replace(/\n/g, ' ')}...
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Key Points */}
      <div className="space-y-2">
        <Label>Key Points to Include (optional)</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Add a must-include point..."
            value={newKeyPoint}
            onChange={(e) => setNewKeyPoint(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyPoint())}
            disabled={settings.keyPoints.length >= 10}
          />
          <Button 
            type="button" 
            variant="outline" 
            size="icon"
            onClick={handleAddKeyPoint}
            disabled={!newKeyPoint.trim() || settings.keyPoints.length >= 10}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {settings.keyPoints.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {settings.keyPoints.map((point, idx) => (
              <Badge key={idx} variant="secondary" className="gap-1 pr-1">
                {point.length > 40 ? point.substring(0, 40) + '...' : point}
                <button
                  type="button"
                  onClick={() => onRemoveKeyPoint(idx)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Up to 10 key points that must appear in the presentation
        </p>
      </div>
    </div>
  );
};

// Note: File reading helpers are now defined inside the component to access onRemoveDocument
