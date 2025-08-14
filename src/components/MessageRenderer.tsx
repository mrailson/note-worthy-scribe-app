import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ChevronDown, 
  ChevronsUp, 
  ChevronsDown,
  Copy, 
  Bot, 
  User,
  FileText,
  List,
  CheckSquare,
  Expand,
  FileDown,
  Presentation
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
  disableTruncation?: boolean;
  onExpandMessage?: (message: Message) => void;
  onExportWord?: (content: string, title: string) => void;
  onExportPowerPoint?: (content: string, title: string) => void;
  cardHeight?: number;
}

const MessageRenderer: React.FC<MessageRendererProps> = ({ 
  message, 
  disableTruncation = false, 
  onExpandMessage, 
  onExportWord, 
  onExportPowerPoint,
  cardHeight = 400
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullContent, setShowFullContent] = useState(true);
  // Calculate if this is a large response (more than 1000 characters or multiple sections)
  const isLargeResponse = message.role === 'assistant' && (
    message.content.length > 1000 || 
    message.content.includes('###') || 
    message.content.includes('##') ||
    message.content.split('\n').length > 20
  );

  // Use 75% more height for large responses
  const effectiveCardHeight = isLargeResponse ? Math.floor((cardHeight || 400) * 1.75) : (cardHeight || 400);

  const messageRef = React.useRef<HTMLDivElement>(null);

  const handleScrollToInput = () => {
    // Scroll to bottom of viewport
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    });
    // Focus the input after a small delay to ensure scroll completes
    setTimeout(() => {
      const inputArea = document.querySelector('textarea[placeholder*="Ask about NHS guidelines"]') as HTMLTextAreaElement;
      if (inputArea) {
        inputArea.focus();
      }
    }, 300);
  };
  
  const maxPreviewLength = 500;
  const isLongMessage = message.content.length > 1000;
  const shouldTruncate = false;
  
  const displayContent = message.content;

  const copyMessage = () => {
    navigator.clipboard.writeText(message.content);
    toast.success('Message copied to clipboard');
  };

  const scrollToTop = () => {
    if (messageRef.current) {
      messageRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      });
      toast.success('Scrolled to top of message');
    }
  };

  const handleExpandMessage = () => {
    if (onExpandMessage) {
      onExpandMessage(message);
    }
  };

  const handleExportWord = () => {
    if (onExportWord) {
      onExportWord(message.content, 'AI Generated Document');
    }
  };

  const handleExportPowerPoint = () => {
    if (onExportPowerPoint) {
      onExportPowerPoint(message.content, 'AI Generated Presentation');
    }
  };

  // Simple function to convert URLs to clickable links
  const linkifyContent = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s<>")\]]+)/g;
    const parts = content.split(urlRegex);
    
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a 
            key={`url-${index}`}
            href={part} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 underline break-all"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const formatContent = (content: string) => {
    // Clean AI response content by removing separators and extra blank lines
    const cleanedContent = content
      .replace(/^---+\s*$/gm, '') // Remove lines with only dashes
      .replace(/^\s*---+\s*$/gm, '') // Remove lines with dashes and whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace multiple blank lines with single blank line
      .replace(/^\s+$/gm, '') // Remove lines with only whitespace
      .trim();
    
    // Process markdown formatting
    const processMarkdown = (text: string) => {
      // Split text by URLs first to avoid processing URLs
      const urlRegex = /(https?:\/\/[^\s<>")\]]+)/g;
      const parts = text.split(urlRegex);
      
      return parts.map((part, index) => {
        if (urlRegex.test(part)) {
          return (
            <a 
              key={`url-${index}`}
              href={part} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 underline break-all"
            >
              {part}
            </a>
          );
        }
        
        // Process markdown in non-URL parts
        const processedText = part
          // Bold text **text**
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          // Italic text *text*
          .replace(/\*([^*]+)\*/g, '<em>$1</em>')
          // Headers ######, #####, ####, ###, ##, #
          .replace(/^###### (.+)$/gm, '<h6 class="text-xs font-semibold mt-3 mb-1">$1</h6>')
          .replace(/^##### (.+)$/gm, '<h5 class="text-sm font-semibold mt-3 mb-1">$1</h5>')
          .replace(/^#### (.+)$/gm, '<h4 class="text-sm font-semibold mt-3 mb-2">$1</h4>')
          .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
          .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-4 mb-2">$1</h2>')
          .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')
          // Code blocks `code`
          .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">$1</code>');
        
        return (
          <span 
            key={`text-${index}`} 
            dangerouslySetInnerHTML={{ __html: processedText }}
          />
        );
      });
    };

    // Split cleanedContent into paragraphs
    const paragraphs = cleanedContent.split('\n\n');
    
    return paragraphs.map((paragraph, index) => {
      if (!paragraph.trim()) return null;
      
      // Check if it's a list
      if (paragraph.includes('\n-') || paragraph.includes('\n•') || paragraph.includes('\n*')) {
        const lines = paragraph.split('\n');
        const title = lines[0];
        const listItems = lines.slice(1).filter(line => 
          line.trim().startsWith('-') || 
          line.trim().startsWith('•') || 
          line.trim().startsWith('*')
        );
        
        if (listItems.length > 0) {
          return (
            <div key={`list-${index}`} className="mb-4">
              {title && (
                <div className="font-medium mb-2">
                  {processMarkdown(title)}
                </div>
              )}
              <ul className="space-y-1 ml-4">
                {listItems.map((item, itemIndex) => (
                  <li key={`item-${itemIndex}`} className="flex items-start gap-2">
                    <CheckSquare className="h-3 w-3 mt-1 flex-shrink-0 text-muted-foreground" />
                    <span className="text-sm">
                      {processMarkdown(item.replace(/^[-•*]\s*/, ''))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
      }
      
      // Regular paragraph with markdown processing
      return (
        <p key={`para-${index}`} className="text-sm mb-3 leading-relaxed whitespace-pre-wrap">
          {processMarkdown(paragraph)}
        </p>
      );
    }).filter(Boolean);
  };

  return (
    <div className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex gap-3 w-full max-w-[95%] sm:max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar with scroll arrow for assistant messages */}
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            message.role === 'user' ? 'bg-primary' : 'bg-muted'
          }`}>
            {message.role === 'user' ? (
              <User className="h-4 w-4 text-primary-foreground" />
            ) : (
              <Bot className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          
          {/* Scroll to input arrow - only show for assistant messages, on the right side */}
          {message.role === 'assistant' && (
            <button
              onClick={handleScrollToInput}
              className="p-1 rounded-full hover:bg-muted transition-colors opacity-60 hover:opacity-100"
              title="Scroll to input"
            >
              <ChevronsDown className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
        
        <div 
          ref={messageRef}
          className={`rounded-lg p-4 flex flex-col ${
            message.role === 'user' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted border border-border'
          }`}
          style={{
            maxHeight: message.role === 'assistant' ? `${effectiveCardHeight}px` : 'auto'
          }}
        >
          {/* Message Content */}
          <div className="space-y-2 flex-1 min-h-0">
            {message.role === 'assistant' ? (
              <div 
                className="prose prose-sm max-w-none ai-response-content overflow-y-auto"
                style={{
                  maxHeight: `${effectiveCardHeight - 120}px`
                }}
              >
                {formatContent(displayContent)}
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm">
                {linkifyContent(displayContent)}
              </div>
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
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
            <div className="flex items-center gap-1">
              {/* Action buttons for long assistant messages */}
              {message.role === 'assistant' && isLongMessage && (
                <>
                  {/* Export to Word button */}
                  {onExportWord && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleExportWord}
                      className="h-6 w-6 p-0 opacity-70 hover:opacity-100 text-muted-foreground hover:text-foreground"
                      title="Export as Word document"
                    >
                      <FileDown className="h-3 w-3" />
                    </Button>
                  )}

                  {/* Export to PowerPoint button */}
                  {onExportPowerPoint && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleExportPowerPoint}
                      className="h-6 w-6 p-0 opacity-70 hover:opacity-100 text-muted-foreground hover:text-foreground"
                      title="Export as PowerPoint presentation"
                    >
                      <Presentation className="h-3 w-3" />
                    </Button>
                  )}

                  {/* Copy button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyMessage}
                    className="h-6 w-6 p-0 opacity-70 hover:opacity-100 text-muted-foreground hover:text-foreground"
                    title="Copy message to clipboard"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>

                  {/* Scroll to top button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={scrollToTop}
                    className="h-6 w-6 p-0 opacity-70 hover:opacity-100 text-muted-foreground hover:text-foreground"
                    title="Scroll to top of this message"
                  >
                    <ChevronsUp className="h-3 w-3" />
                  </Button>
                  
                  {/* Expand to full screen button */}
                  {onExpandMessage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleExpandMessage}
                      className="h-6 w-6 p-0 opacity-70 hover:opacity-100 text-muted-foreground hover:text-foreground"
                      title="Expand to full screen"
                    >
                      <Expand className="h-3 w-3" />
                    </Button>
                  )}
                </>
              )}
              
              {/* Copy button for user messages */}
              {message.role === 'user' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyMessage}
                  className="h-6 w-6 p-0 opacity-70 hover:opacity-100 text-primary-foreground/70 hover:text-primary-foreground"
                  title="Copy message to clipboard"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageRenderer;