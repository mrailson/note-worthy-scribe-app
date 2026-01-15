/**
 * Letter Preview Modal Component
 * Displays AI-generated letters in a professional NHS-style format
 * Supports inline editing of letter sections
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { Download, Mail, FileText, Pencil, Check, X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { parseLetter, cleanMarkdownText, isLetterFormat, reconstructLetter, ParsedLetter } from '@/utils/letterParser';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LetterPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  onDownload: (content: string) => void;
  onEmail: (content: string) => void;
  onContentChange?: (content: string) => void;
  editable?: boolean;
  practiceContext?: {
    practiceName?: string;
    practiceAddress?: string;
    practicePhone?: string;
    practiceEmail?: string;
    logoUrl?: string;
    userFullName?: string;
  };
}

// Editable text input component
const EditableField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  editable?: boolean;
}> = ({ value, onChange, placeholder, className, multiline = false, editable = true }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  const handleSave = () => {
    onChange(tempValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!editable) {
    return <span className={className}>{value}</span>;
  }

  if (isEditing) {
    return (
      <div className="flex items-start gap-1 w-full">
        {multiline ? (
          <Textarea
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn("min-h-[60px] text-sm resize-none", className)}
            autoFocus
          />
        ) : (
          <Input
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn("h-7 text-sm", className)}
            autoFocus
          />
        )}
        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={handleSave}>
          <Check className="h-3 w-3 text-green-600" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={handleCancel}>
          <X className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <span
      className={cn(
        "group cursor-pointer hover:bg-primary/5 rounded px-1 -mx-1 inline-flex items-center gap-1 transition-colors",
        className
      )}
      onClick={() => setIsEditing(true)}
      title="Click to edit"
    >
      {value || <span className="text-muted-foreground italic">{placeholder || 'Click to add'}</span>}
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </span>
  );
};

// Closing phrase options
const CLOSING_OPTIONS = [
  'Yours sincerely',
  'Yours faithfully',
  'Kind regards',
  'Best wishes',
  'With best wishes',
  'Many thanks',
];

export const LetterPreviewModal: React.FC<LetterPreviewModalProps> = ({
  open,
  onOpenChange,
  content,
  onDownload,
  onEmail,
  onContentChange,
  editable = true,
  practiceContext
}) => {
  const originalParsed = useMemo(() => parseLetter(content), [content]);
  const isLetter = useMemo(() => isLetterFormat(content), [content]);
  
  // Local state for edited values
  const [editedParsed, setEditedParsed] = useState<ParsedLetter | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Reset edited state when content changes
  useEffect(() => {
    setEditedParsed(null);
    setHasUnsavedChanges(false);
  }, [content]);
  
  const currentParsed = editedParsed || originalParsed;
  
  // Format current date if not detected from content
  const displayDate = currentParsed.date || format(new Date(), "d MMMM yyyy");
  
  // Get practice details from context
  const practiceName = practiceContext?.practiceName;
  const practiceAddress = practiceContext?.practiceAddress;
  const practicePhone = practiceContext?.practicePhone;
  const practiceEmail = practiceContext?.practiceEmail;
  const logoUrl = practiceContext?.logoUrl;

  // Update handlers
  const updateField = useCallback(<K extends keyof ParsedLetter>(
    field: K,
    value: ParsedLetter[K]
  ) => {
    setEditedParsed(prev => ({
      ...(prev || originalParsed),
      [field]: value
    }));
    setHasUnsavedChanges(true);
  }, [originalParsed]);

  const updateSignature = useCallback((field: keyof ParsedLetter['signature'], value: string) => {
    setEditedParsed(prev => {
      const current = prev || originalParsed;
      return {
        ...current,
        signature: {
          ...current.signature,
          [field]: value
        }
      };
    });
    setHasUnsavedChanges(true);
  }, [originalParsed]);

  const updateBodyParagraph = useCallback((index: number, value: string) => {
    setEditedParsed(prev => {
      const current = prev || originalParsed;
      const newParagraphs = [...current.bodyParagraphs];
      newParagraphs[index] = value;
      return { ...current, bodyParagraphs: newParagraphs };
    });
    setHasUnsavedChanges(true);
  }, [originalParsed]);

  const addParagraph = useCallback(() => {
    setEditedParsed(prev => {
      const current = prev || originalParsed;
      return {
        ...current,
        bodyParagraphs: [...current.bodyParagraphs, '']
      };
    });
    setHasUnsavedChanges(true);
  }, [originalParsed]);

  const removeParagraph = useCallback((index: number) => {
    setEditedParsed(prev => {
      const current = prev || originalParsed;
      const newParagraphs = current.bodyParagraphs.filter((_, i) => i !== index);
      return { ...current, bodyParagraphs: newParagraphs };
    });
    setHasUnsavedChanges(true);
  }, [originalParsed]);

  // Save changes
  const handleSave = useCallback(() => {
    if (!editedParsed || !onContentChange) return;
    
    const reconstructed = reconstructLetter(editedParsed);
    onContentChange(reconstructed);
    setHasUnsavedChanges(false);
    toast.success('Letter saved');
  }, [editedParsed, onContentChange]);

  // Get current content for download/email
  const getCurrentContent = useCallback(() => {
    if (editedParsed) {
      return reconstructLetter(editedParsed);
    }
    return content;
  }, [editedParsed, content]);
  
  // Render letter format preview
  const renderLetterPreview = () => (
    <div className="bg-white rounded-lg shadow-lg max-w-3xl mx-auto">
      {/* Letterhead */}
      <div className="border-b-2 border-primary pt-6 pb-4 px-8">
        {/* Logo */}
        {logoUrl && (
          <div className="flex justify-center mb-3">
            <img 
              src={logoUrl} 
              alt="Practice logo" 
              className="h-14 w-auto object-contain"
            />
          </div>
        )}
        
        {/* Practice name */}
        {practiceName && (
          <h1 className="text-center text-lg font-bold text-primary mb-1">
            {practiceName}
          </h1>
        )}
        
        {/* Practice address */}
        {practiceAddress && (
          <p className="text-center text-sm text-muted-foreground">
            {practiceAddress}
          </p>
        )}
        
        {/* Contact details */}
        {(practicePhone || practiceEmail) && (
          <p className="text-center text-sm text-muted-foreground mt-1">
            {[
              practicePhone && `Tel: ${practicePhone}`,
              practiceEmail && practiceEmail
            ].filter(Boolean).join(' | ')}
          </p>
        )}
      </div>
      
      {/* Letter content */}
      <div className="px-8 py-6 min-h-[400px]">
        {/* Date - right aligned */}
        <p className="text-right text-sm text-foreground mb-6">
          {displayDate}
        </p>
        
        {/* Recipient address */}
        {currentParsed.headerSection.toLines && currentParsed.headerSection.toLines.length > 0 && (
          <div className="mb-6">
            {currentParsed.headerSection.toLines.map((line, idx) => (
              <p 
                key={idx} 
                className={cn(
                  "text-sm",
                  idx === 0 && "font-semibold"
                )}
              >
                {line}
              </p>
            ))}
          </div>
        )}
        
        {/* Subject line */}
        <div className="font-semibold text-sm mb-4 flex items-center gap-1">
          <span>Re:</span>
          <EditableField
            value={currentParsed.subject || ''}
            onChange={(value) => updateField('subject', value)}
            placeholder="Subject line"
            editable={editable && !!onContentChange}
          />
        </div>
        
        {/* Salutation */}
        <div className="text-sm mb-4">
          <EditableField
            value={currentParsed.salutation || ''}
            onChange={(value) => updateField('salutation', value)}
            placeholder="Dear..."
            editable={editable && !!onContentChange}
          />
          <span>,</span>
        </div>
        
        {/* Body paragraphs */}
        <div className="space-y-4 mb-6">
          {currentParsed.bodyParagraphs.map((paragraph, idx) => (
            <div key={idx} className="group relative">
              <EditableField
                value={paragraph}
                onChange={(value) => updateBodyParagraph(idx, value)}
                placeholder="Paragraph text..."
                className="text-sm leading-relaxed text-justify block w-full"
                multiline
                editable={editable && !!onContentChange}
              />
              {editable && onContentChange && currentParsed.bodyParagraphs.length > 1 && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute -right-8 top-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeParagraph(idx)}
                  title="Remove paragraph"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          ))}
          {editable && onContentChange && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={addParagraph}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add paragraph
            </Button>
          )}
        </div>
        
        {/* Closing */}
        <div className="text-sm mt-8">
          {editable && onContentChange ? (
            <Select
              value={currentParsed.closing || 'Yours sincerely'}
              onValueChange={(value) => updateField('closing', value)}
            >
              <SelectTrigger className="w-auto h-7 text-sm border-none shadow-none px-1 -mx-1 hover:bg-primary/5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLOSING_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span>{currentParsed.closing || 'Yours sincerely'}</span>
          )}
          <span>,</span>
        </div>
        
        {/* Signature block */}
        <div className="mt-10 space-y-1">
          <div className="text-sm font-semibold">
            <EditableField
              value={currentParsed.signature.name || practiceContext?.userFullName || ''}
              onChange={(value) => updateSignature('name', value)}
              placeholder="Signatory name"
              editable={editable && !!onContentChange}
            />
          </div>
          {(currentParsed.signature.qualifications || (editable && onContentChange)) && (
            <div className="text-sm text-muted-foreground">
              <EditableField
                value={currentParsed.signature.qualifications || ''}
                onChange={(value) => updateSignature('qualifications', value)}
                placeholder="Qualifications (e.g., MBBS, MRCGP)"
                editable={editable && !!onContentChange}
              />
            </div>
          )}
          {(currentParsed.signature.title || (editable && onContentChange)) && (
            <div className="text-sm">
              <EditableField
                value={currentParsed.signature.title || ''}
                onChange={(value) => updateSignature('title', value)}
                placeholder="Job title"
                editable={editable && !!onContentChange}
              />
            </div>
          )}
          {(currentParsed.signature.organisation || practiceName) && (
            <p className="text-sm text-muted-foreground">
              {currentParsed.signature.organisation || practiceName}
            </p>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <div className="border-t border-border px-8 py-3 bg-muted/30">
        <p className="text-xs text-center text-muted-foreground">
          {[practiceName, practicePhone, practiceEmail].filter(Boolean).join(' | ')}
        </p>
      </div>
    </div>
  );
  
  // Render plain text preview (for non-letter content)
  const renderPlainPreview = () => (
    <div className="bg-white rounded-lg shadow-lg max-w-3xl mx-auto px-8 py-6">
      <div className="prose prose-sm max-w-none dark:prose-invert">
        {content.split('\n\n').map((paragraph, idx) => (
          <p key={idx} className="mb-4 leading-relaxed">
            {cleanMarkdownText(paragraph)}
          </p>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {isLetter ? 'Letter Preview' : 'Document Preview'}
              {editable && onContentChange && (
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  (click any field to edit)
                </span>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {hasUnsavedChanges && onContentChange && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(getCurrentContent())}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEmail(getCurrentContent())}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(95vh-120px)]">
          <div className="p-6 bg-muted/20">
            {isLetter ? renderLetterPreview() : renderPlainPreview()}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
