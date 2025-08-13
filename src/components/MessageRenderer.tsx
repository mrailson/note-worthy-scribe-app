import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ChevronDown, 
  ChevronsUp, 
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
}

const MessageRenderer: React.FC<MessageRendererProps> = ({ 
  message, 
  disableTruncation = false, 
  onExpandMessage, 
  onExportWord, 
  onExportPowerPoint 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullContent, setShowFullContent] = useState(true); // Always show full content
  const messageRef = React.useRef<HTMLDivElement>(null);
  
  const maxPreviewLength = 500;
  const isLongMessage = message.content.length > 1000; // Increased threshold for star button
  const shouldTruncate = false; // Never truncate
  
  const displayContent = message.content; // Always show full content

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

  // Function to convert URLs to clickable links
  const linkifyText = (text: string): (string | React.ReactElement)[] => {
    // URL regex pattern that excludes trailing punctuation and markdown syntax
    const urlRegex = /(https?:\/\/[^\s<>")\]]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a 
            key={index} 
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
    // Convert markdown-style formatting to JSX
    const parseMarkdown = (text: string): (string | React.ReactElement)[] => {
      // Split by various markdown patterns while preserving the delimiters
      const parts = text.split(/(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|`.*?`|##.*?\n)/g);
      
      return parts.map((part, index) => {
        // Bold and italic (***text***)
        if (part.startsWith('***') && part.endsWith('***')) {
          const content = part.slice(3, -3);
          return <strong key={index} className="font-bold italic">{linkifyText(content)}</strong>;
        }
        // Bold (**text**)
        if (part.startsWith('**') && part.endsWith('**')) {
          const content = part.slice(2, -2);
          return <strong key={index} className="font-bold">{linkifyText(content)}</strong>;
        }
        // Italic (*text*)
        if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
          const content = part.slice(1, -1);
          return <em key={index} className="italic">{linkifyText(content)}</em>;
        }
        // Code (`text*)
        if (part.startsWith('`') && part.endsWith('`')) {
          const content = part.slice(1, -1);
          return <code key={index} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{content}</code>;
        }
        // Heading (## text)
        if (part.startsWith('##')) {
          const content = part.replace(/^#+\s*/, '').replace(/\n$/, '');
          return <strong key={index} className="font-semibold text-base block mt-2 mb-1">{linkifyText(content)}</strong>;
        }
        
        return linkifyText(part);
      }).flat();
    };

    // Split content into sections based on common patterns
    const sections = content.split(/\n\n+/);
    
    return sections.map((section, index) => {
      // Check if section contains a table (has pipe characters and header separator)
      if (section.includes('|') && section.includes('---')) {
        const lines = section.split('\n').filter(line => line.trim());
        
        // Find table boundaries
        let tableStart = -1;
        let tableEnd = -1;
        let tableTitle = '';
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('|') && !lines[i].includes('---')) {
            if (tableStart === -1) {
              // Check if previous line is a title
              if (i > 0 && !lines[i-1].includes('|')) {
                tableTitle = lines[i-1];
                tableStart = i;
              } else {
                tableStart = i;
              }
            }
            tableEnd = i;
          } else if (lines[i].includes('---') && lines[i].includes('|')) {
            // This is a header separator, skip it
            continue;
          }
        }
        
        if (tableStart !== -1 && tableEnd !== -1) {
          const tableLines = lines.slice(tableStart, tableEnd + 1);
          const headerLine = tableLines[0];
          const dataLines = tableLines.slice(1).filter(line => !line.includes('---'));
          
          if (headerLine && headerLine.includes('|')) {
            const headers = headerLine.split('|')
              .map(h => h.trim())
              .filter(h => h.length > 0);
            
            return (
              <div key={index} className="mb-6">
                {tableTitle && (
                  <h4 className="font-semibold text-base mb-3 text-foreground">
                    {parseMarkdown(tableTitle)}
                  </h4>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-border rounded-lg">
                    <thead>
                      <tr className="bg-muted/50">
                        {headers.map((header, headerIndex) => (
                          <th 
                            key={headerIndex} 
                            className="border border-border px-3 py-2 text-left text-sm font-semibold text-foreground"
                          >
                            {parseMarkdown(header)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataLines.map((line, rowIndex) => {
                        const cells = line.split('|')
                          .map(cell => cell.trim())
                          .filter(cell => cell.length > 0 || true); // Keep empty cells
                        
                        // Ensure we have the same number of cells as headers
                        while (cells.length < headers.length) {
                          cells.push('');
                        }
                        
                        return (
                          <tr key={rowIndex} className="hover:bg-muted/30">
                            {cells.slice(0, headers.length).map((cell, cellIndex) => (
                              <td 
                                key={cellIndex} 
                                className="border border-border px-3 py-2 text-sm text-foreground"
                              >
                                {cell.trim() || '\u00A0'} {/* Non-breaking space for empty cells */}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }
        }
      }
      
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
        
        <div 
          ref={messageRef}
          className={`rounded-lg p-4 ${
            message.role === 'user' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted border border-border'
          }`}
        >
          {/* Message Content */}
          <div className="space-y-2">
            {message.role === 'assistant' ? (
              <div className="prose prose-sm max-w-none">
                {formatContent(displayContent)}
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm">
                {linkifyText(displayContent)}
              </div>
            )}
            
            {/* Show More/Less button removed as requested */}
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