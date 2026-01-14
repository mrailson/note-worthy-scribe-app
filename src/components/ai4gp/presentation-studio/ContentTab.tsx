import React, { useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, X, FileText, Upload, FileSpreadsheet, File, Trash2, Check } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { 
  PRESENTATION_TYPES, 
  TARGET_AUDIENCES,
  type PresentationStudioSettings,
  type SupportingDocument,
} from '@/types/presentationStudio';

interface ContentTabProps {
  settings: PresentationStudioSettings;
  onUpdate: (updates: Partial<PresentationStudioSettings>) => void;
  onAddDocument: (doc: SupportingDocument) => void;
  onRemoveDocument: (docId: string) => void;
  onToggleDocument: (docId: string) => void;
  onAddKeyPoint: (point: string) => void;
  onRemoveKeyPoint: (index: number) => void;
}

export const ContentTab: React.FC<ContentTabProps> = ({
  settings,
  onUpdate,
  onAddDocument,
  onRemoveDocument,
  onToggleDocument,
  onAddKeyPoint,
  onRemoveKeyPoint,
}) => {
  const [newKeyPoint, setNewKeyPoint] = React.useState('');

  const handleAddKeyPoint = () => {
    if (newKeyPoint.trim() && settings.keyPoints.length < 10) {
      onAddKeyPoint(newKeyPoint.trim());
      setNewKeyPoint('');
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      try {
        const content = await readFileContent(file);
        const doc: SupportingDocument = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          content,
          type: file.type,
          size: file.size,
          selected: true,
        };
        onAddDocument(doc);
      } catch (error) {
        console.error('Error reading file:', error);
      }
    }
  }, [onAddDocument]);

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

      {/* Presentation Type */}
      <div className="space-y-3">
        <Label>Presentation Type</Label>
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
      </div>

      {/* Target Audience */}
      <div className="space-y-3">
        <Label>Target Audience</Label>
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
      </div>

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
          <ScrollArea className="h-[120px]">
            <div className="space-y-2">
              {settings.supportingDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-md border transition-colors",
                    doc.selected ? "bg-primary/5 border-primary/30" : "bg-muted/30"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onToggleDocument(doc.id)}
                    className={cn(
                      "flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center",
                      doc.selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
                    )}
                  >
                    {doc.selected && <Check className="h-3 w-3" />}
                  </button>
                  {getFileIcon(doc.type)}
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
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
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

// Helper function to read file content
async function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // For text files, return content directly
        if (file.type.includes('text') || file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
          resolve(reader.result);
        } else {
          // For binary files, return base64
          resolve(reader.result);
        }
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(reader.error);
    
    if (file.type.includes('text') || file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
}
