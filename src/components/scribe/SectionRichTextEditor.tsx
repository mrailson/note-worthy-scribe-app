import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Palette,
  Loader2
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface SectionRichTextEditorProps {
  content: string;
  onBlur: (content: string) => void;
  isSaving?: boolean;
}

const colorOptions = [
  { label: 'Black', value: '#000000' },
  { label: 'Red', value: '#DC2626' },
  { label: 'Blue', value: '#2563EB' },
  { label: 'Green', value: '#059669' },
  { label: 'Orange', value: '#EA580C' },
  { label: 'Purple', value: '#9333EA' },
];

const SectionRichTextEditor: React.FC<SectionRichTextEditorProps> = ({
  content,
  onBlur,
  isSaving = false,
}) => {
  const currentContentRef = React.useRef(content);

  // Convert markdown to HTML for TipTap
  const convertMarkdownToHtml = (text: string): string => {
    if (!text) return '';
    
    return text
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/\n/g, '|||LINEBREAK|||')
      .replace(/^\* (.*)$/gm, '<li>$1</li>')
      .replace(/^- (.*)$/gm, '<li>$1</li>')
      .replace(/^\d+\. (.*)$/gm, '<li>$1</li>')
      .replace(/(<li>.*?<\/li>)(\|\|\|LINEBREAK\|\|\|<li>.*?<\/li>)+/g, (match) => {
        const isNumbered = /^\d+\./.test(match);
        const tag = isNumbered ? 'ol' : 'ul';
        return `<${tag}>${match.replace(/\|\|\|LINEBREAK\|\|\|/g, '')}</${tag}>`;
      })
      .replace(/^<li>(.*?)<\/li>$/gm, '<ul><li>$1</li></ul>')
      .replace(/\|\|\|LINEBREAK\|\|\|/g, '</p><p>')
      .replace(/^(?!<[houl])/gm, '<p>')
      .replace(/(?<![>])$/gm, '</p>')
      .replace(/<p><\/p>/g, '')
      .replace(/<p>(<[houl])/g, '$1')
      .replace(/(<\/[houl][^>]*>)<\/p>/g, '$1');
  };

  // Convert HTML back to markdown
  const convertHtmlToMarkdown = (html: string): string => {
    if (!html) return '';
    
    return html
      .replace(/<h1[^>]*>(.*?)<\/h1>/g, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/g, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/g, '### $1\n\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/g, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/g, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/g, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/g, '*$1*')
      .replace(/<ul[^>]*>(.*?)<\/ul>/gs, (match, content) => {
        return content.replace(/<li[^>]*>(.*?)<\/li>/g, '- $1\n') + '\n';
      })
      .replace(/<ol[^>]*>(.*?)<\/ol>/gs, (match, content) => {
        let counter = 1;
        return content.replace(/<li[^>]*>(.*?)<\/li>/g, () => `${counter++}. $1\n`) + '\n';
      })
      .replace(/<p[^>]*>(.*?)<\/p>/g, '$1\n\n')
      .replace(/<br[^>]*>/g, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n');
  };

  const cleanedContent = convertMarkdownToHtml(content);
  const processedContent = DOMPurify.sanitize(cleanedContent, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'b', 'i', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'div', 'span'],
    ALLOWED_ATTR: ['class', 'style'],
    KEEP_CONTENT: true
  });

  const extensions = React.useMemo(() => [
    StarterKit,
    Underline,
    TextStyle,
    Color,
  ], []);

  const editor = useEditor({
    extensions,
    content: processedContent,
    onUpdate: ({ editor }) => {
      const htmlContent = editor.getHTML();
      currentContentRef.current = convertHtmlToMarkdown(htmlContent);
    },
    onBlur: () => {
      onBlur(currentContentRef.current);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[100px] [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_p]:mb-2 [&_p]:leading-relaxed [&_ul]:mb-2 [&_ul]:ml-4 [&_ol]:mb-2 [&_ol]:ml-4 [&_li]:mb-1',
      },
    },
    autofocus: 'end',
  });

  if (!editor) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
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
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className="h-7 w-7 p-0"
    >
      {children}
    </Button>
  );

  return (
    <div className="flex flex-col overflow-hidden bg-transparent">
      {/* Compact Toolbar */}
      <div className="border-b bg-muted/50 px-2 py-1 flex items-center gap-0.5 flex-shrink-0">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Underline"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        
        <Separator orientation="vertical" className="h-4 mx-1" />
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        
        <Separator orientation="vertical" className="h-4 mx-1" />
        
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0" 
              title="Text Colour"
              onClick={(e) => e.stopPropagation()}
            >
              <Palette className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-3 gap-1">
              {colorOptions.map((color) => (
                <Button
                  key={color.value}
                  className="w-6 h-6 p-0 rounded-sm"
                  style={{ backgroundColor: color.value }}
                  onClick={(e) => {
                    e.stopPropagation();
                    editor.chain().focus().setColor(color.value).run();
                  }}
                  title={color.label}
                />
              ))}
              <Button
                className="w-6 h-6 p-0 rounded-sm border-2 border-border bg-transparent"
                onClick={(e) => {
                  e.stopPropagation();
                  editor.chain().focus().unsetColor().run();
                }}
                title="Remove Colour"
              >
                <span className="text-xs">×</span>
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Saving indicator */}
        {isSaving && (
          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </div>
        )}
      </div>
      
      {/* Editor Content */}
      <div className="px-3 py-2">
        <EditorContent 
          editor={editor} 
          className="focus:outline-none"
        />
      </div>
    </div>
  );
};

export default SectionRichTextEditor;
