import React, { useRef, useEffect } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline as UnderlineExtension } from '@tiptap/extension-underline';
import { Image } from '@tiptap/extension-image';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  List,
  ListOrdered,
  Palette,
  Type,
  ImageIcon
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface SignatureEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const SignatureEditor: React.FC<SignatureEditorProps> = ({ 
  content, 
  onChange, 
  placeholder = "Enter your signature..." 
}) => {
  const editorRef = useRef<Editor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      TextStyle,
      Color,
      FontFamily.configure({
        types: ['textStyle'],
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      UnderlineExtension,
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto',
        },
        allowBase64: true,
        inline: true,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[100px] p-3 border rounded-md',
      },
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items || []);
        
        for (const item of items) {
          if (item.type.indexOf('image') === 0) {
            const file = item.getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onload = (e) => {
                const result = e.target?.result as string;
                if (result && editorRef.current) {
                  editorRef.current.chain().focus().setImage({ src: result }).run();
                }
              };
              reader.readAsDataURL(file);
              event.preventDefault();
              return true;
            }
          }
        }
        return false;
      },
      handleDrop(view, event, slice, moved) {
        if (!moved && event.dataTransfer?.files?.length) {
          const file = event.dataTransfer.files[0];
          if (file.type.indexOf('image') === 0) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const result = e.target?.result as string;
              if (result && editorRef.current) {
                editorRef.current.chain().focus().setImage({ src: result }).run();
              }
            };
            reader.readAsDataURL(file);
            event.preventDefault();
            return true;
          }
        }
        return false;
      },
    },
  });

  // Keep ref updated
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Sync editor content when `content` prop changes (e.g. after async fetch)
  useEffect(() => {
    if (!editor) return;

    const currentHtml = editor.getHTML();
    const nextHtml = content || '';

    if (currentHtml !== nextHtml) {
      // Do not emit an update event (prevents loops)
      editor.commands.setContent(nextHtml, { emitUpdate: false });
    }
  }, [content, editor]);

  const handleImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result && editor) {
          editor.chain().focus().setImage({ src: result }).run();
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!editor) {
    return null;
  }

  const colors = [
    '#000000', '#374151', '#6B7280', '#EF4444', '#F59E0B', 
    '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316'
  ];

  const fonts = [
    'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 
    'Trebuchet MS', 'Comic Sans MS', 'Impact', 'Lucida Console'
  ];

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="border-b bg-muted/30 p-2 flex flex-wrap items-center gap-1">
        {/* Text Formatting */}
        <Button
          variant={editor.isActive('bold') ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Button>
        
        <Button
          variant={editor.isActive('italic') ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Button>
        
        <Button
          variant={editor.isActive('underline') ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Font Family */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm">
              <Type className="h-4 w-4 mr-1" />
              Font
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2">
            <div className="space-y-1">
              {fonts.map((font) => (
                <Button
                  key={font}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm"
                  style={{ fontFamily: font }}
                  onClick={() => editor.chain().focus().setFontFamily(font).run()}
                >
                  {font}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Text Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm">
              <Palette className="h-4 w-4 mr-1" />
              Color
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2">
            <div className="grid grid-cols-5 gap-1">
              {colors.map((color) => (
                <button
                  key={color}
                  className="w-8 h-8 rounded border border-gray-300 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={() => editor.chain().focus().setColor(color).run()}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Alignment */}
        <Button
          variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        
        <Button
          variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        
        <Button
          variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Lists */}
        <Button
          variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Button>
        
        <Button
          variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Image Upload */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleImageUpload}
          title="Insert image"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Editor Content */}
      <div className="min-h-[120px]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default SignatureEditor;