import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Bot, 
  User,
  FileText,
  List,
  CheckSquare
} from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: UploadedFile[];
}

interface UploadedFile {
  name: string;
  type: string;
  content: string;
  size: number;
}

interface MessageRendererProps {
  message: Message;
}

const MessageRenderer: React.FC<MessageRendererProps> = ({ message }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);
  
  const maxPreviewLength = 500;
  const isLongMessage = message.content.length > maxPreviewLength;
  const shouldTruncate = isLongMessage && !showFullContent;
  
  const displayContent = shouldTruncate 
    ? message.content.substring(0, maxPreviewLength) + '...'
    : message.content;

  const copyMessage = () => {
    navigator.clipboard.writeText(message.content);
    toast.success('Message copied to clipboard');
  };

  const formatContent = (content: string) => {
    // Convert markdown-style formatting to JSX
    const parseMarkdown = (text: string) => {
      // Split by various markdown patterns while preserving the delimiters
      const parts = text.split(/(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|`.*?`|##.*?\n)/g);
      
      return parts.map((part, index) => {
        // Bold and italic (***text***)
        if (part.startsWith('***') && part.endsWith('***')) {
          const content = part.slice(3, -3);
          return <strong key={index} className="font-bold italic">{content}</strong>;
        }
        // Bold (**text**)
        if (part.startsWith('**') && part.endsWith('**')) {
          const content = part.slice(2, -2);
          return <strong key={index} className="font-bold">{content}</strong>;
        }
        // Italic (*text*)
        if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
          const content = part.slice(1, -1);
          return <em key={index} className="italic">{content}</em>;
        }
        // Code (`text`)
        if (part.startsWith('`') && part.endsWith('`')) {
          const content = part.slice(1, -1);
          return <code key={index} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{content}</code>;
        }
        // Heading (## text)
        if (part.startsWith('##')) {
          const content = part.replace(/^#+\s*/, '').replace(/\n$/, '');
          return <strong key={index} className="font-semibold text-base block mt-2 mb-1">{content}</strong>;
        }
        
        return part;
      });
    };

    // Split content into sections based on common patterns
    const sections = content.split(/\n\n+/);
    
    return sections.map((section, index) => {
      // Check if section is a list
      if (section.includes('\n-') || section.includes('\n•') || section.includes('\n*')) {
        const lines = section.split('\n');
        const title = lines[0];
        const listItems = lines.slice(1).filter(line => line.trim().startsWith('-') || line.trim().startsWith('•') || line.trim().startsWith('*'));
        
        if (listItems.length > 0) {
          return (
            <div key={index} className="mb-4">
              {title && <div className="font-medium mb-2">{parseMarkdown(title)}</div>}
              <ul className="space-y-1 ml-4">
                {listItems.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex items-start gap-2">
                    <CheckSquare className="h-3 w-3 mt-1 flex-shrink-0 text-muted-foreground" />
                    <span className="text-sm">{parseMarkdown(item.replace(/^[-•*]\s*/, ''))}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
      }
      
      // Check if section is numbered list
      if (/^\d+\./.test(section.trim())) {
        const lines = section.split('\n').filter(line => line.trim());
        return (
          <div key={index} className="mb-4">
            <ol className="space-y-2 ml-4">
              {lines.map((line, itemIndex) => {
                const match = line.match(/^(\d+)\.\s*(.*)/);
                if (match) {
                  return (
                    <li key={itemIndex} className="flex items-start gap-2">
                      <Badge variant="outline" className="text-xs px-1 py-0 min-w-[20px] h-5 flex items-center justify-center">
                        {match[1]}
                      </Badge>
                      <span className="text-sm">{parseMarkdown(match[2])}</span>
                    </li>
                  );
                }
                return <div key={itemIndex} className="text-sm ml-6">{parseMarkdown(line)}</div>;
              })}
            </ol>
          </div>
        );
      }
      
      // Check if section looks like a heading (all caps or starts with ##)
      if (section.length < 100 && (section === section.toUpperCase() || section.startsWith('##'))) {
        return (
          <h3 key={index} className="font-semibold text-base mb-2 text-foreground">
            {parseMarkdown(section.replace(/^#+\s*/, ''))}
          </h3>
        );
      }
      
      // Regular paragraph
      return (
        <p key={index} className="text-sm mb-3 leading-relaxed">
          {parseMarkdown(section)}
        </p>
      );
    });
  };

  return (
    <div className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex gap-3 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          message.role === 'user' ? 'bg-primary' : 'bg-muted'
        }`}>
          {message.role === 'user' ? (
            <User className="h-4 w-4 text-primary-foreground" />
          ) : (
            <Bot className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        
        <div className={`rounded-lg p-4 ${
          message.role === 'user' 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-muted border border-border'
        }`}>
          {/* Message Content */}
          <div className="space-y-2">
            {message.role === 'assistant' ? (
              <div className="prose prose-sm max-w-none">
                {formatContent(displayContent)}
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm">
                {displayContent}
              </div>
            )}
            
            {/* Show More/Less button for long messages */}
            {isLongMessage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullContent(!showFullContent)}
                className={`h-8 px-2 ${
                  message.role === 'user' 
                    ? 'text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {showFullContent ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Show More ({Math.ceil((message.content.length - maxPreviewLength) / 100)} more lines)
                  </>
                )}
              </Button>
            )}
          </div>
          
          {/* File attachments */}
          {message.files && message.files.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/20">
              <div className="text-xs opacity-70 mb-2 flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Attached files:
              </div>
              <div className="flex flex-wrap gap-1">
                {message.files.map((file, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {file.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Message footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/20">
            <span className="text-xs opacity-70">
              {message.timestamp.toLocaleTimeString()}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyMessage}
              className={`h-6 w-6 p-0 opacity-70 hover:opacity-100 ${
                message.role === 'user'
                  ? 'text-primary-foreground/70 hover:text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageRenderer;