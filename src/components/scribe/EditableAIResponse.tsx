import React, { useEffect, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  List, 
  ListOrdered, 
  Palette,
  Trash2,
  Copy,
  Check,
  Save,
  Edit3,
  X,
  ImagePlus,
  Download,
  Mail,
  Maximize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';

interface EditableAIResponseProps {
  content: string;
  editedContent?: string;
  onContentChange: (content: string) => void;
  onDownload?: (content: string) => void;
  onEmail?: (content: string) => void;
  onExpand?: (content: string, messageId?: string) => void;
  isSaving?: boolean;
  className?: string;
  messageId: string;
}

const COLORS = [
  '#000000', '#374151', '#DC2626', '#EA580C', '#D97706',
  '#16A34A', '#0891B2', '#2563EB', '#7C3AED', '#DB2777'
];

// Check if content appears to be HTML
const isHtmlContent = (text: string): boolean => {
  if (!text) return false;
  // Check for common HTML patterns - opening tags with attributes or standard tags
  return /<[a-z][a-z0-9]*(\s+[^>]*)?>/i.test(text) && /<\/[a-z][a-z0-9]*>/i.test(text);
};

// Strip HTML tags and convert to plain text, then convert to proper markdown
const stripHtmlToText = (html: string): string => {
  if (!html) return '';
  
  return html
    // Remove style attributes and spans with just styling
    .replace(/<span[^>]*style[^>]*>([^<]*)<\/span>/gi, '$1')
    // Convert bold tags
    .replace(/<(strong|b)[^>]*>([^<]*)<\/(strong|b)>/gi, '**$2**')
    // Convert italic tags
    .replace(/<(em|i)[^>]*>([^<]*)<\/(em|i)>/gi, '*$2*')
    // Convert line breaks and paragraph breaks
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// Convert markdown to HTML for display with professional formatting
const convertMarkdownToHtml = (text: string): string => {
  if (!text) return '';
  
  // If content appears to be HTML, strip it first to get clean text
  let processedText = text;
  if (isHtmlContent(text)) {
    processedText = stripHtmlToText(text);
  }
  
  // Process bold FIRST with a global multiline approach
  // This handles cases where ** spans multiple words or has special characters
  let html = processedText;
  
  // Handle bold+italic first (***text***)
  html = html.replace(/\*\*\*(.+?)\*\*\*/gs, '<strong><em>$1</em></strong>');
  
  // Handle bold (**text**) - more robust pattern
  html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
  
  // Handle italic (*text*) - but not list markers
  html = html.replace(/(?<![*\w])\*([^*\n]+?)\*(?![*\w])/g, '<em>$1</em>');
  
  // Escape HTML entities (but preserve our tags)
  html = html
    .replace(/&(?!amp;|lt;|gt;)/g, '&amp;')
    .replace(/<(?!\/?(?:strong|em|h[1-3]|p|br|ul|ol|li|span|div)\b)/g, '&lt;')
    .replace(/(?<!<\/?(?:strong|em|h[1-3]|p|br|ul|ol|li|span|div)[^>]*)>/g, (match, offset) => {
      // Only escape > if it's not part of an HTML tag we created
      const before = html.substring(Math.max(0, offset - 50), offset);
      if (/<(?:strong|em|h[1-3]|p|br|ul|ol|li|span|div)[^>]*$/.test(before)) {
        return match;
      }
      return '&gt;';
    });
  
  // Headers with professional spacing - generous margins for visual hierarchy
  html = html
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-6 mb-4 text-foreground border-b border-border/30 pb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-8 mb-4 text-foreground border-b border-border/50 pb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-8 mb-5 text-foreground border-b border-border pb-3">$1</h1>');
  
  // Detect document title (first bold line without a colon - e.g., "Fit Note Supporting Text")
  // This creates a prominent header at the top
  html = html.replace(/^<strong[^>]*>([^<:]+)<\/strong>(?=\s*<br|\s*$)/m, 
    '<div class="text-lg font-bold text-foreground mb-6 pb-3 border-b-2 border-primary/30">$1</div>');
  
  // Detect inline clinical field labels with values on same line
  // e.g., "**Patient:** David Thompson" → proper two-column layout
  html = html.replace(/<strong[^>]*>([^<]+):<\/strong>\s*([^<\n]+?)(?=<br|<\/p|$)/g, 
    '<div class="flex flex-wrap gap-x-3 gap-y-1 my-3 py-1"><span class="font-semibold text-foreground whitespace-nowrap min-w-[120px]">$1:</span><span class="text-foreground/90">$2</span></div>');
  
  // Detect clinical section headings (bold text with colon at end, followed by content on next line)
  // e.g., "**Functional effects of condition:**" followed by paragraph
  html = html.replace(/<strong[^>]*>([^<]+):<\/strong>\s*(?=<br)/g, 
    '<div class="font-semibold text-foreground mt-6 mb-3 pt-4 border-t border-border/40">$1:</div>');
  
  // Bullet lists with proper indentation and spacing
  html = html.replace(/^[-•]\s+(.+)$/gm, '<li class="ml-6 pl-2 leading-loose">$1</li>');
  
  // Numbered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-6 pl-2 list-decimal leading-loose">$1</li>');
  
  // Double line breaks to paragraphs with generous spacing
  html = html.replace(/\n\n+/g, '</p><p class="mb-6 leading-loose text-foreground/90">');
  
  // Single line breaks - handle carefully
  html = html.replace(/\n/g, '<br/>');

  // Wrap consecutive <li> elements in <ul> with proper spacing
  html = html.replace(/(<li[^>]*>.*?<\/li>(?:\s*<br\/>?\s*)?)+/gs, (match) => {
    const cleanedMatch = match.replace(/<br\s*\/?>/g, '');
    return `<ul class="my-6 space-y-3 list-disc pl-2">${cleanedMatch}</ul>`;
  });
  
  // Wrap in paragraph if not already wrapped and doesn't start with a block element
  if (!html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<ol') && !html.startsWith('<p') && !html.startsWith('<div')) {
    html = `<p class="mb-6 leading-loose text-foreground/90">${html}</p>`;
  }

  return html;
};

// Convert HTML back to markdown for storage
const convertHtmlToMarkdown = (html: string): string => {
  if (!html) return '';
  
  let markdown = html
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    .replace(/<u>(.*?)<\/u>/gi, '$1')
    .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n')
    .replace(/<li>(.*?)<\/li>/gi, '• $1\n')
    .replace(/<ul>|<\/ul>|<ol>|<\/ol>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p><p>/gi, '\n\n')
    .replace(/<p>|<\/p>/gi, '')
    .replace(/<img[^>]+src="([^"]+)"[^>]*>/gi, '![image]($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();

  return markdown;
};

export function EditableAIResponse({
  content,
  editedContent,
  onContentChange,
  onDownload,
  onEmail,
  onExpand,
  isSaving = false,
  className,
  messageId
}: EditableAIResponseProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Use edited content if available, otherwise original
  const displayContent = editedContent || content;
  const initialHtml = convertMarkdownToHtml(displayContent);

  const sanitizedHtml = DOMPurify.sanitize(initialHtml, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'span', 'img', 'div'],
    ALLOWED_ATTR: ['style', 'src', 'alt', 'width', 'height', 'class']
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Underline,
      TextStyle,
      Color,
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg my-2'
        }
      }),
      // Cast to any to fix tiptap version mismatch between placeholder extension and core
      Placeholder.configure({
        placeholder: 'Click to edit...'
      }) as any
    ],
    content: sanitizedHtml,
    editable: isEditing,
    onUpdate: ({ editor }) => {
      if (isEditing) {
        const html = editor.getHTML();
        const markdown = convertHtmlToMarkdown(html);
        onContentChange(markdown);
      }
    },
    onBlur: () => {
      if (isEditing) {
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 2000);
      }
    }
  });

  // Update editor content when content prop changes
  useEffect(() => {
    if (editor && !isEditing) {
      const newHtml = convertMarkdownToHtml(editedContent || content);
      const sanitized = DOMPurify.sanitize(newHtml, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'span', 'img', 'div'],
        ALLOWED_ATTR: ['style', 'src', 'alt', 'width', 'height', 'class']
      });
      editor.commands.setContent(sanitized);
    }
  }, [content, editedContent, editor, isEditing]);

  // Toggle editing mode
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
    }
  }, [isEditing, editor]);

  const handleCopy = useCallback(async () => {
    try {
      // Get the plain text content
      const text = editor?.getText() || displayContent;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy');
    }
  }, [editor, displayContent]);

  const handleImageUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && editor) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          editor.chain().focus().setImage({ src: dataUrl }).run();
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }, [editor]);

  // Handle paste for images
  useEffect(() => {
    if (!editor || !isEditing) return;

    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const dataUrl = e.target?.result as string;
              editor.chain().focus().setImage({ src: dataUrl }).run();
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [editor, isEditing]);

  if (!editor) return null;

  return (
    <div className={cn(
      'relative group rounded-lg transition-all',
      isEditing && 'ring-2 ring-primary/30 bg-background',
      className
    )}>
      {/* Toolbar - visible when editing */}
      {isEditing && (
        <div className="flex items-center gap-1 p-2 border-b border-border/50 bg-muted/30 rounded-t-lg flex-wrap">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            title="Underline"
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-border mx-1" />
          
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="Bullet list"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="Numbered list"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-border mx-1" />

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title="Text colour"
              >
                <Palette className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="grid grid-cols-5 gap-1">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => editor.chain().focus().setColor(color).run()}
                    title={color}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <ToolbarButton
            onClick={handleImageUpload}
            title="Add image"
          >
            <ImagePlus className="h-4 w-4" />
          </ToolbarButton>

          <div className="flex-1" />

          <ToolbarButton
            onClick={() => {
              editor.commands.clearContent();
              onContentChange('');
            }}
            title="Clear content"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => setIsEditing(false)}
            title="Done editing"
            className="text-primary"
          >
            <Check className="h-4 w-4" />
          </ToolbarButton>
        </div>
      )}

      {/* Editor content - Professional NHS-style formatting */}
      <div 
        className={cn(
          'prose prose-sm max-w-none dark:prose-invert px-6 py-5',
          // Paragraphs - generous spacing for readability
          'prose-p:mb-5 prose-p:leading-8 prose-p:text-foreground/90',
          // Headings - clear visual hierarchy with borders
          'prose-headings:mt-8 prose-headings:mb-4 prose-headings:font-semibold prose-headings:text-foreground',
          'prose-h1:text-xl prose-h1:pb-3 prose-h1:border-b prose-h1:border-border',
          'prose-h2:text-lg prose-h2:pb-2 prose-h2:border-b prose-h2:border-border/50',
          'prose-h3:text-base prose-h3:pb-2 prose-h3:border-b prose-h3:border-border/30',
          // Lists - proper indentation and spacing
          'prose-ul:my-5 prose-ul:pl-2 prose-ul:space-y-3',
          'prose-ol:my-5 prose-ol:pl-2 prose-ol:space-y-3',
          'prose-li:my-2 prose-li:leading-7 prose-li:text-foreground/90 prose-li:pl-2',
          // Strong/Bold - clear emphasis
          'prose-strong:font-semibold prose-strong:text-foreground',
          // Emphasis
          'prose-em:italic prose-em:text-foreground/80',
          // Links
          'prose-a:text-primary prose-a:underline prose-a:underline-offset-2',
          // Interactive states
          !isEditing && 'cursor-pointer hover:bg-muted/30 rounded-lg transition-colors',
          isEditing && 'min-h-[100px]'
        )}
        onClick={() => !isEditing && setIsEditing(true)}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Bottom action bar - always visible */}
      {!isEditing && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/30 bg-muted/20 rounded-b-lg">
          <div className="flex items-center gap-1">
            {onDownload && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload(displayContent);
                }}
                title="Download as Word"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Download
              </Button>
            )}
            {onEmail && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onEmail(displayContent);
                }}
                title="Email to me"
              >
                <Mail className="h-3.5 w-3.5 mr-1" />
                Email
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onExpand && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onExpand(displayContent, messageId);
                }}
                title="Expand and edit in full screen"
              >
                <Maximize2 className="h-3.5 w-3.5 mr-1" />
                Expand and Edit
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              title="Copy"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              title="Edit"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Saving indicator */}
      {(isSaving || showSaved) && (
        <div className="absolute bottom-10 right-2 flex items-center gap-1.5 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
          {isSaving ? (
            <>
              <Save className="h-3 w-3 animate-pulse" />
              <span>Saving...</span>
            </>
          ) : showSaved ? (
            <>
              <Check className="h-3 w-3 text-green-500" />
              <span>Saved</span>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  onClick,
  isActive,
  title,
  className,
  children
}: {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'h-8 w-8 p-0',
        isActive && 'bg-muted text-primary',
        className
      )}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );
}
