import React, { useState, useCallback, useMemo } from 'react';
import InlineEditableLine, { AILineAction } from './InlineEditableLine';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ParsedLine {
  type: 'heading' | 'bullet' | 'numbered' | 'paragraph' | 'empty';
  content: string;
  htmlContent: string;
  level?: 1 | 2 | 3;
  originalLine: string;
  indent?: number;
}

interface InteractiveNotesContentProps {
  content: string;
  sectionId: string;
  fontSize: number;
  meetingId?: string;
  onContentChange: (newContent: string) => void;
}

const InteractiveNotesContent: React.FC<InteractiveNotesContentProps> = ({
  content,
  sectionId,
  fontSize,
  meetingId,
  onContentChange,
}) => {
  const [lines, setLines] = useState<ParsedLine[]>([]);

  // Apply inline formatting (bold, italic)
  const applyInlineFormatting = useCallback((text: string): string => {
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
    escaped = escaped.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    return escaped;
  }, []);

  // Parse content into lines
  const parsedLines = useMemo(() => {
    if (!content) return [];

    const rawLines = content.split('\n');
    const result: ParsedLine[] = [];

    for (const line of rawLines) {
      const trimmed = line.trim();

      // Empty line
      if (!trimmed) {
        result.push({ type: 'empty', content: '', htmlContent: '', originalLine: line });
        continue;
      }

      // Heading level 1
      if (/^# (.*)$/.test(trimmed)) {
        const match = trimmed.match(/^# (.*)$/);
        const text = match?.[1] || '';
        result.push({
          type: 'heading',
          level: 1,
          content: text,
          htmlContent: applyInlineFormatting(text),
          originalLine: line,
        });
        continue;
      }

      // Heading level 2
      if (/^## (.*)$/.test(trimmed)) {
        const match = trimmed.match(/^## (.*)$/);
        const text = match?.[1] || '';
        result.push({
          type: 'heading',
          level: 2,
          content: text,
          htmlContent: applyInlineFormatting(text),
          originalLine: line,
        });
        continue;
      }

      // Heading level 3
      if (/^### (.*)$/.test(trimmed)) {
        const match = trimmed.match(/^### (.*)$/);
        const text = match?.[1] || '';
        result.push({
          type: 'heading',
          level: 3,
          content: text,
          htmlContent: applyInlineFormatting(text),
          originalLine: line,
        });
        continue;
      }

      // Numbered list
      const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (numberedMatch) {
        const text = numberedMatch[2];
        result.push({
          type: 'numbered',
          content: text,
          htmlContent: `<span class="mr-2 font-medium text-foreground">${numberedMatch[1]}.</span>${applyInlineFormatting(text)}`,
          originalLine: line,
        });
        continue;
      }

      // Bullet list (including indented)
      const bulletMatch = line.match(/^(\s*)[-*•]\s+(.*)$/);
      if (bulletMatch) {
        const indent = bulletMatch[1].length;
        const text = bulletMatch[2];
        const bulletClass = indent > 0 ? 'ml-4' : '';
        result.push({
          type: 'bullet',
          content: text,
          htmlContent: `<span class="mr-2 text-muted-foreground ${bulletClass}">•</span>${applyInlineFormatting(text)}`,
          originalLine: line,
          indent,
        });
        continue;
      }

      // Regular paragraph
      result.push({
        type: 'paragraph',
        content: trimmed,
        htmlContent: applyInlineFormatting(trimmed),
        originalLine: line,
      });
    }

    return result;
  }, [content, applyInlineFormatting]);

  // Reconstruct content from parsed lines
  const reconstructContent = useCallback((updatedLines: ParsedLine[]): string => {
    return updatedLines.map((line) => {
      if (line.type === 'empty') return '';
      if (line.type === 'heading') {
        const prefix = line.level === 1 ? '# ' : line.level === 2 ? '## ' : '### ';
        return prefix + line.content;
      }
      if (line.type === 'numbered') {
        const match = line.originalLine.match(/^(\d+)\./);
        const num = match?.[1] || '1';
        return `${num}. ${line.content}`;
      }
      if (line.type === 'bullet') {
        const indent = ' '.repeat(line.indent || 0);
        return `${indent}- ${line.content}`;
      }
      return line.content;
    }).join('\n');
  }, []);

  // Handle line update
  const handleUpdate = useCallback((index: number, newContent: string) => {
    const updatedLines = [...parsedLines];
    const oldLine = updatedLines[index];
    
    // Update the content but preserve the type
    updatedLines[index] = {
      ...oldLine,
      content: newContent,
      htmlContent: oldLine.type === 'bullet' 
        ? `<span class="mr-2 text-muted-foreground ${(oldLine.indent || 0) > 0 ? 'ml-4' : ''}">•</span>${applyInlineFormatting(newContent)}`
        : oldLine.type === 'numbered'
        ? `<span class="mr-2 font-medium text-foreground">${oldLine.originalLine.match(/^(\d+)\./)?.[1] || '1'}.</span>${applyInlineFormatting(newContent)}`
        : applyInlineFormatting(newContent),
    };

    const newRawContent = reconstructContent(updatedLines);
    onContentChange(newRawContent);
  }, [parsedLines, applyInlineFormatting, reconstructContent, onContentChange]);

  // Handle line delete
  const handleDelete = useCallback((index: number) => {
    const updatedLines = parsedLines.filter((_, i) => i !== index);
    const newRawContent = reconstructContent(updatedLines);
    onContentChange(newRawContent);
  }, [parsedLines, reconstructContent, onContentChange]);

  // Handle AI action
  const handleAIAction = useCallback(async (index: number, action: AILineAction): Promise<string> => {
    const line = parsedLines[index];
    if (!line || !meetingId) {
      toast.error('Unable to process AI action');
      return line?.content || '';
    }

    try {
      const { data, error } = await supabase.functions.invoke('ai-line-transform', {
        body: {
          meetingId,
          lineContent: line.content,
          action,
          context: content.substring(0, 500), // Provide some context
        },
      });

      if (error) throw error;

      if (data?.transformedContent) {
        return data.transformedContent;
      }
      
      toast.error('No transformation returned');
      return line.content;
    } catch (error) {
      console.error('AI action failed:', error);
      toast.error('AI transformation failed');
      return line.content;
    }
  }, [parsedLines, meetingId, content]);

  // Filter out empty lines for rendering but keep track of indices
  const editableLines = parsedLines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.type !== 'empty');

  // Add proper spacing based on line type
  const getLineSpacing = (line: ParsedLine, prevLine?: ParsedLine): string => {
    if (!prevLine) return '';
    
    // More space before headings
    if (line.type === 'heading') return 'mt-4';
    
    // Space after headings
    if (prevLine.type === 'heading') return 'mt-2';
    
    // Space between numbered items
    if (line.type === 'numbered' && prevLine.type === 'numbered') return 'mt-3';
    
    // Space between bullets
    if (line.type === 'bullet' && prevLine.type === 'bullet') return 'mt-1.5';
    
    // Space after numbered list before new content
    if (prevLine.type === 'numbered' && line.type !== 'numbered') return 'mt-3';
    
    // Default spacing
    return 'mt-1.5';
  };

  return (
    <div className="space-y-0">
      {editableLines.map(({ line, index }, arrayIndex) => {
        const prevLine = arrayIndex > 0 ? editableLines[arrayIndex - 1].line : undefined;
        const spacingClass = getLineSpacing(line, prevLine);
        
        return (
          <div key={`${sectionId}-${index}`} className={spacingClass}>
            <InlineEditableLine
              type={line.type === 'empty' ? 'paragraph' : line.type}
              content={line.content}
              htmlContent={line.htmlContent}
              level={line.level}
              index={index}
              sectionId={sectionId}
              fontSize={fontSize}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onAIAction={handleAIAction}
            />
          </div>
        );
      })}
    </div>
  );
};

export default InteractiveNotesContent;
