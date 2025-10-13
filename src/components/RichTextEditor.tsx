import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { TextAlign } from '@tiptap/extension-text-align';
import { FontFamily } from '@tiptap/extension-font-family';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Code,
  Undo,
  Redo,
  Type,
  Palette
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface EditorCommands {
  insertText: (text: string) => void;
  setContent: (content: string) => void;
  getContent: () => string;
  focus: () => void;
}

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  onReady?: (commands: EditorCommands) => void;
  showStatus?: boolean;
}

const colorOptions = [
  { label: 'Black', value: '#000000' },
  { label: 'Red', value: '#DC2626' },
  { label: 'Blue', value: '#2563EB' },
  { label: 'Green', value: '#059669' },
  { label: 'Orange', value: '#EA580C' },
  { label: 'Purple', value: '#9333EA' },
  { label: 'Pink', value: '#DB2777' },
  { label: 'Gray', value: '#6B7280' },
];

const fontFamilies = [
  { label: 'Default', value: 'default' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Calibri', value: 'Calibri, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Courier New', value: 'Courier New, monospace' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
];

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  placeholder = "Start typing...",
  className = "",
  onReady,
  showStatus = false,
}) => {
  const [wordCount, setWordCount] = React.useState(0);
  const [charCount, setCharCount] = React.useState(0);
  // Convert markdown to HTML for TipTap
  const convertMarkdownToHtml = (text: string): string => {
    if (!text) return '';
    
    return text
      // Headers (must come first)
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      // Italic text  
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      // Convert line breaks to temporary markers first
      .replace(/\n/g, '|||LINEBREAK|||')
      // Bullet points (handle multiple lines)
      .replace(/^\* (.*)$/gm, '<li>$1</li>')
      .replace(/^- (.*)$/gm, '<li>$1</li>')
      // Numbered lists
      .replace(/^\d+\. (.*)$/gm, '<li>$1</li>')
      // Wrap consecutive list items in ul/ol tags
      .replace(/(<li>.*?<\/li>)(\|\|\|LINEBREAK\|\|\|<li>.*?<\/li>)+/g, (match) => {
        const isNumbered = /^\d+\./.test(match);
        const tag = isNumbered ? 'ol' : 'ul';
        return `<${tag}>${match.replace(/\|\|\|LINEBREAK\|\|\|/g, '')}</${tag}>`;
      })
      // Handle single list items
      .replace(/^<li>(.*?)<\/li>$/gm, '<ul><li>$1</li></ul>')
      // Restore line breaks as paragraphs
      .replace(/\|\|\|LINEBREAK\|\|\|/g, '</p><p>')
      // Wrap in paragraph tags if not already wrapped
      .replace(/^(?!<[houl])/gm, '<p>')
      .replace(/(?<![>])$/gm, '</p>')
      // Clean up empty paragraphs and fix structure
      .replace(/<p><\/p>/g, '')
      .replace(/<p>(<[houl])/g, '$1')
      .replace(/(<\/[houl][^>]*>)<\/p>/g, '$1');
  };

  // Convert HTML back to markdown-like format to preserve structure
  const convertHtmlToMarkdown = (html: string): string => {
    if (!html) return '';
    
    return html
      // Headers
      .replace(/<h1[^>]*>(.*?)<\/h1>/g, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/g, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/g, '### $1\n\n')
      // Bold
      .replace(/<strong[^>]*>(.*?)<\/strong>/g, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/g, '**$1**')
      // Italic
      .replace(/<em[^>]*>(.*?)<\/em>/g, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/g, '*$1*')
      // Lists
      .replace(/<ul[^>]*>(.*?)<\/ul>/gs, (match, content) => {
        return content.replace(/<li[^>]*>(.*?)<\/li>/g, '- $1\n') + '\n';
      })
      .replace(/<ol[^>]*>(.*?)<\/ol>/gs, (match, content) => {
        let counter = 1;
        return content.replace(/<li[^>]*>(.*?)<\/li>/g, () => `${counter++}. $1\n`) + '\n';
      })
      // Paragraphs - convert to double line breaks
      .replace(/<p[^>]*>(.*?)<\/p>/g, '$1\n\n')
      // Line breaks
      .replace(/<br[^>]*>/g, '\n')
      // Remove any remaining HTML tags
      .replace(/<[^>]*>/g, '')
      // Clean up extra whitespace but preserve intentional spacing
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  // Clean and convert content
  const cleanedContent = convertMarkdownToHtml(content);
  const processedContent = DOMPurify.sanitize(cleanedContent, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'b', 'i', 
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'div', 'span'
    ],
    ALLOWED_ATTR: ['class', 'style'],
    KEEP_CONTENT: true
  });
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      FontFamily,
    ],
    content: processedContent,
    onUpdate: ({ editor }) => {
      const htmlContent = editor.getHTML();
      const convertedContent = convertHtmlToMarkdown(htmlContent);
      onChange(convertedContent);
      
      // Update status counts
      if (showStatus) {
        const text = editor.getText();
        setCharCount(text.length);
        setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
      }
    },
    onCreate: ({ editor }) => {
      // Initialize counts
      if (showStatus) {
        const text = editor.getText();
        setCharCount(text.length);
        setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
      }
      
      // Expose command API
      if (onReady) {
        onReady({
          insertText: (text: string) => {
            editor.chain().focus().insertContent(text).run();
          },
          setContent: (content: string) => {
            const htmlContent = convertMarkdownToHtml(content);
            const sanitizedContent = DOMPurify.sanitize(htmlContent, {
              ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'a', 'span'],
              ALLOWED_ATTR: ['style', 'class', 'href', 'target']
            });
            editor.commands.setContent(sanitizedContent);
          },
          getContent: () => {
            const html = editor.getHTML();
            return convertHtmlToMarkdown(html);
          },
          focus: () => {
            editor.chain().focus().run();
          },
        });
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none h-full',
      },
    },
  });

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({ 
    onClick, 
    isActive = false, 
    children, 
    title 
  }: { 
    onClick: () => void; 
    isActive?: boolean; 
    children: React.ReactNode; 
    title: string;
  }) => (
    <Button
      type="button"
      variant={isActive ? "default" : "ghost"}
      size="sm"
      onClick={onClick}
      title={title}
      className="h-8 w-8 p-0"
    >
      {children}
    </Button>
  );

  return (
    <div className={`flex flex-col overflow-hidden bg-transparent ${className}`}>
      {/* Toolbar */}
      <div className="border-b bg-gray-50/50 p-1.5 flex flex-wrap gap-1 items-center flex-shrink-0 sticky top-0 z-10">
        {/* History */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
        
        <Separator orientation="vertical" className="h-6 mx-1" />
        
        {/* Font Family */}
        <Select
          value={editor.getAttributes('textStyle').fontFamily || 'default'}
          onValueChange={(value) => 
            value === 'default' ? editor.chain().focus().unsetFontFamily().run() : editor.chain().focus().setFontFamily(value).run()
          }
        >
          <SelectTrigger className="w-32 h-8">
            <SelectValue placeholder="Font" />
          </SelectTrigger>
          <SelectContent>
            {fontFamilies.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                <span style={{ fontFamily: font.value }}>{font.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Separator orientation="vertical" className="h-6 mx-1" />
        
        {/* Text Formatting */}
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
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
          title="Code"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
        
        <Separator orientation="vertical" className="h-6 mx-1" />
        
        {/* Text Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Text Color">
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-4 gap-1">
              {colorOptions.map((color) => (
                <Button
                  key={color.value}
                  className="w-6 h-6 p-0 rounded-sm"
                  style={{ backgroundColor: color.value }}
                  onClick={() => editor.chain().focus().setColor(color.value).run()}
                  title={color.label}
                />
              ))}
              <Button
                className="w-6 h-6 p-0 rounded-sm border-2 border-gray-300 bg-transparent"
                onClick={() => editor.chain().focus().unsetColor().run()}
                title="Remove Color"
              >
                <span className="text-xs">×</span>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        
        <Separator orientation="vertical" className="h-6 mx-1" />
        
        {/* Text Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          isActive={editor.isActive({ textAlign: 'justify' })}
          title="Justify"
        >
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>
        
        <Separator orientation="vertical" className="h-6 mx-1" />
        
        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        
        <Separator orientation="vertical" className="h-6 mx-1" />
        
        {/* Block Quote */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
      </div>
      
      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <EditorContent 
          editor={editor} 
          className="focus:outline-none h-full"
        />
      </div>
      
      {showStatus && (
        <div className="border-t px-3 py-1.5 text-xs text-muted-foreground flex gap-4 flex-shrink-0">
          <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          <span>{charCount} {charCount === 1 ? 'character' : 'characters'}</span>
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;