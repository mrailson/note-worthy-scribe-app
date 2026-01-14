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
  ImagePlus
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
  isSaving?: boolean;
  className?: string;
  messageId: string;
}

const COLORS = [
  '#000000', '#374151', '#DC2626', '#EA580C', '#D97706',
  '#16A34A', '#0891B2', '#2563EB', '#7C3AED', '#DB2777'
];

// Convert markdown to HTML for display
const convertMarkdownToHtml = (text: string): string => {
  if (!text) return '';
  
  let html = text
    // Escape HTML first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bullet lists
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/(<li>.*?<\/li>)+/gs, (match) => `<ul>${match}</ul>`);
  
  // Wrap in paragraph if not already wrapped
  if (!html.startsWith('<')) {
    html = `<p>${html}</p>`;
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
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'span', 'img'],
    ALLOWED_ATTR: ['style', 'src', 'alt', 'width', 'height']
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
      Placeholder.configure({
        placeholder: 'Click to edit...'
      })
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
        ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'span', 'img'],
        ALLOWED_ATTR: ['style', 'src', 'alt', 'width', 'height']
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

      {/* Editor content */}
      <div 
        className={cn(
          'prose prose-sm max-w-none dark:prose-invert p-3',
          !isEditing && 'cursor-pointer hover:bg-muted/30 rounded-lg transition-colors',
          isEditing && 'min-h-[100px]'
        )}
        onClick={() => !isEditing && setIsEditing(true)}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Action buttons - visible on hover when not editing */}
      {!isEditing && (
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            title="Edit"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            title="Copy"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}

      {/* Saving indicator */}
      {(isSaving || showSaved) && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
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
