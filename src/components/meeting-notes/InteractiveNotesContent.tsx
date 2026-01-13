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

  const renderLines = parsedLines.map((line, index) => ({ line, index }));

  // Spacing is intentionally handled here (including blank lines) to match the previous
  // "prose" layout the notes had before we switched to interactive rendering.
  const getBlockSpacingClass = (line: ParsedLine, prevLine?: ParsedLine): string => {
    // Blank lines must remain visible as spacing (previous renderer relied on <p>/<ul> margins)
    if (line.type === 'empty') return 'h-6';

    if (line.type === 'heading') {
      // Headings need clear separation from surrounding content
      if (prevLine?.type === 'empty' || !prevLine) return 'pt-6 pb-3';
      if (prevLine?.type === 'heading') return 'pt-5 pb-3';
      return 'pt-7 pb-3';
    }

    if (line.type === 'numbered') return 'py-3';
    if (line.type === 'bullet') return 'py-2';

    // Paragraph
    return 'py-3';
  };

  return (
    <div className="space-y-0">
      {renderLines.map(({ line, index }, arrayIndex) => {
        const prevLine = arrayIndex > 0 ? renderLines[arrayIndex - 1].line : undefined;
        const spacingClass = getBlockSpacingClass(line, prevLine);

        if (line.type === 'empty') {
          return <div key={`${sectionId}-${index}-spacer`} className={spacingClass} aria-hidden="true" />;
        }

        return (
          <div key={`${sectionId}-${index}`} className={spacingClass}>
            <InlineEditableLine
              type={line.type}
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
