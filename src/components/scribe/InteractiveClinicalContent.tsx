import React, { useMemo, useCallback } from 'react';
import ClinicalInlineEditableLine, { ClinicalAIAction } from './ClinicalInlineEditableLine';
import { parseClinicalContent, reconstructClinicalContent, ParsedClinicalLine } from '@/utils/clinicalNoteParser';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InteractiveClinicalContentProps {
  content: string;
  sectionKey: string;
  onContentChange: (newContent: string) => void;
  disabled?: boolean;
  consultationId?: string;
}

export const InteractiveClinicalContent: React.FC<InteractiveClinicalContentProps> = ({
  content,
  sectionKey,
  onContentChange,
  disabled = false,
  consultationId,
}) => {
  // Parse content into structured lines
  const parsedLines = useMemo(() => {
    return parseClinicalContent(content);
  }, [content]);

  // Reconstruct content from updated lines
  const reconstructContent = useCallback((updatedLines: ParsedClinicalLine[]): string => {
    return reconstructClinicalContent(updatedLines);
  }, []);

  // Handle line update
  const handleUpdate = useCallback((index: number, newContent: string) => {
    const updatedLines = [...parsedLines];
    updatedLines[index] = {
      ...updatedLines[index],
      content: newContent,
      // Re-generate HTML content
      htmlContent: updatedLines[index].type === 'label' && updatedLines[index].labelPrefix
        ? `<strong>${updatedLines[index].labelPrefix}:</strong> ${newContent}`
        : updatedLines[index].type === 'bullet'
        ? `<span class="inline-flex items-start gap-2"><span class="text-muted-foreground select-none">•</span><span>${newContent}</span></span>`
        : newContent,
    };
    const newRawContent = reconstructContent(updatedLines);
    onContentChange(newRawContent);
  }, [parsedLines, reconstructContent, onContentChange]);

  // Handle line deletion
  const handleDelete = useCallback((index: number) => {
    const updatedLines = parsedLines.filter((_, i) => i !== index);
    const newRawContent = reconstructContent(updatedLines);
    onContentChange(newRawContent);
  }, [parsedLines, reconstructContent, onContentChange]);

  // Handle AI action
  const handleAIAction = useCallback(async (index: number, action: ClinicalAIAction): Promise<string> => {
    const line = parsedLines[index];
    if (!line) return '';

    try {
      // Build context from surrounding lines
      const contextLines = parsedLines
        .filter((_, i) => i !== index && i >= Math.max(0, index - 3) && i <= Math.min(parsedLines.length - 1, index + 3))
        .map(l => l.content)
        .filter(c => c.trim())
        .join('\n');

      const { data, error } = await supabase.functions.invoke('ai-line-transform', {
        body: {
          consultationId,
          lineContent: line.content,
          action,
          context: contextLines,
          contextType: 'clinical',
        },
      });

      if (error) {
        console.error('AI transform error:', error);
        toast.error('Failed to transform text');
        return '';
      }

      if (data?.success && data.transformedContent) {
        return data.transformedContent;
      }

      toast.error(data?.error || 'AI transformation failed');
      return '';
    } catch (err) {
      console.error('AI action error:', err);
      toast.error('Failed to connect to AI service');
      return '';
    }
  }, [parsedLines, consultationId]);

  // If no content, show placeholder
  if (parsedLines.length === 0 || parsedLines.every(l => l.type === 'empty')) {
    return (
      <p className="text-sm text-muted-foreground italic">Not discussed</p>
    );
  }

  return (
    <div className="space-y-0">
      {parsedLines.map((line, index) => (
        <ClinicalInlineEditableLine
          key={`${sectionKey}-${index}-${line.content.substring(0, 20)}`}
          type={line.type}
          content={line.content}
          htmlContent={line.htmlContent}
          index={index}
          sectionKey={sectionKey}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onAIAction={handleAIAction}
          disabled={disabled}
          labelPrefix={line.labelPrefix}
        />
      ))}
    </div>
  );
};

export default InteractiveClinicalContent;
