import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';
import { useQuickPickScrollUX } from '@/hooks/useQuickPickScrollUX';
import { 
  ChevronDown, 
  ChevronsUp, 
  ChevronsDown,
  Copy, 
  Bot, 
  User,
  Users,
  FileText,
  List,
  CheckSquare,
  Expand,
  Minimize2,
  FileDown,
  Presentation,
  Clock,
  Mail,
  Download,
  Zap,
  GraduationCap,
  Settings,
  AlertTriangle,
  Shield,
  CheckCircle,
  Stethoscope,
  ShieldCheck,
  Languages,
  Printer,
  WandSparkles,
  Palette,
  Volume2,
  VolumeX,
  Search,
  FileType,
  Type,
  Hash,
  ImageIcon
} from 'lucide-react';
import { ContentInfographicModal } from '@/components/ContentInfographicModal';
import PolicyBadge from '@/components/PolicyBadge';
import PolicyBanner from '@/components/PolicyBanner';
import { toast } from 'sonner';
import QuickActionButtons from '@/components/QuickActionButtons';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoEmail } from '@/hooks/useAutoEmail';
import { EmailCompositionModal } from '@/components/EmailCompositionModal';
import { EmailToTeamModal } from '@/components/ai4gp/EmailToTeamModal';
import { ClinicalVerificationModal } from '@/components/ClinicalVerificationModal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { quickPickConfig } from '@/constants/quickPickConfig';
import { handlers } from '@/utils/quickPickHandlers';
import { QuickPickContext, QuickPickItem } from '@/types/quickPick';
import { CustomAIPromptModal } from '@/components/CustomAIPromptModal';
import { CustomFindReplaceModal } from '@/components/CustomFindReplaceModal';
import { stripMarkdown, copyPlainTextToClipboard, copyRichTextToClipboard } from '@/utils/stripMarkdown';
import { Message, UploadedFile } from '@/types/ai4gp';
import { LeaveCalendarDownloadButton } from '@/components/ai4gp/LeaveCalendarDownloadButton';
import { VoiceAudioPlayer } from '@/components/ai4gp/VoiceAudioPlayer';
import { PowerPointDownloadCard } from '@/components/ai4gp/PowerPointDownloadCard';

interface MessageRendererProps {
  message: Message;
  onExpandMessage?: (message: Message) => void;
  onExportWord?: (content: string, title?: string) => void;
  onExportPowerPoint?: (content: string, title?: string) => void;
  onExportPowerPointWithVoiceover?: (content: string, title?: string) => void;
  isModal?: boolean; // New prop to indicate if rendering in modal
  onCloseModal?: () => void; // New prop to close modal
  showResponseMetrics?: boolean; // New prop to show response metrics
  showRenderTimes?: boolean; // New prop to show render times separately
  showAIService?: boolean; // New prop to show AI service separately
  onQuickResponse?: (response: string) => void; // New prop for quick responses
  onSetDrugName?: (drugName: string) => void; // New prop for setting drug name
  autoCollapseUserPrompts?: boolean; // New prop to auto-collapse user prompts
  imageGenerationModel?: 'google/gemini-3-pro-image-preview' | 'google/gemini-2.5-flash-image-preview' | 'openai/gpt-image-1'; // Image model for infographics
}

const MessageRenderer: React.FC<MessageRendererProps> = ({ 
  message, 
  onExpandMessage, 
  onExportWord, 
  onExportPowerPoint,
  onExportPowerPointWithVoiceover,
  isModal = false,
  onCloseModal,
  showResponseMetrics = false,
  showRenderTimes = false,
  showAIService = false,
  onQuickResponse,
  onSetDrugName,
  autoCollapseUserPrompts = false,
  imageGenerationModel = 'google/gemini-2.5-flash-image-preview'
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullContent, setShowFullContent] = useState(true);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isTeamEmailModalOpen, setIsTeamEmailModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showAutoEmailModal, setShowAutoEmailModal] = useState(false);
  const [showClinicalVerificationModal, setShowClinicalVerificationModal] = useState(false);
  const [showCustomAIModal, setShowCustomAIModal] = useState(false);
  const [showFindReplaceModal, setShowFindReplaceModal] = useState(false);
  const [showInfographicModal, setShowInfographicModal] = useState(false);
  const [verificationData, setVerificationData] = useState(null);
  const [policyEnforcement, setPolicyEnforcement] = useState(true);
  const [isUserMessageCollapsed, setIsUserMessageCollapsed] = useState(
    // Auto-collapse based on global setting OR if it's a quick pick message  
    message.role === 'user' && (autoCollapseUserPrompts || message.isQuickPick === true)
  );
  
  // Calculation verification code removed per user request
  const { user } = useAuth();
  
  // Calculation verification handlers removed per user request
  
  // Toggle user message collapse
  const toggleUserMessageCollapse = () => {
    if (message.role === 'user') {
      setIsUserMessageCollapsed(!isUserMessageCollapsed);
    }
  };
  const { sendEmailAutomatically, isSending } = useAutoEmail();
  
  // Auto-scroll to bottom when content updates during streaming
  const contentRef = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    if (message.isStreaming && contentRef.current) {
      const container = contentRef.current.closest('.overflow-y-auto');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [message.content, message.isStreaming]);

  
  // Calculate if this is a large response (more than 1000 characters or multiple sections)
  const isLargeResponse = message.role === 'assistant' && (
    message.content.length > 1000 || 
    message.content.includes('###') || 
    message.content.includes('##') ||
    message.content.split('\n').length > 20
  );

  // Detect if text is poorly formatted (unformatted block text)
  const isPoorlyFormatted = message.role === 'assistant' && (() => {
    const content = message.content.trim();
    
    // Skip if it's too short or already has good formatting
    if (content.length < 200) return false;
    
    // Has markdown headers
    if (content.includes('###') || content.includes('##') || content.includes('**')) return false;
    
    // Has proper line breaks/paragraphs
    const lines = content.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    
    // If most content is in very few lines (clumped together)
    if (nonEmptyLines.length < 3 && content.length > 500) return true;
    
    // Check for very long lines without breaks (typical of unformatted text)
    const hasLongLines = nonEmptyLines.some(line => line.length > 200);
    const hasVeryFewBreaks = (lines.length / content.length) * 1000 < 2; // Less than 2 line breaks per 1000 chars
    
    return hasLongLines && hasVeryFewBreaks;
  })();

  const handleFixFormatting = () => {
    if (onQuickResponse) {
      const formatPrompt = `improve this format:\n\n${message.content}`;
      onQuickResponse(formatPrompt);
    }
  };


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

  const handleScrollToTop = () => {
    // Try to find the scroll area viewport (the actual scrollable container)
    const scrollViewport = document.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollViewport) {
      scrollViewport.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } else {
      // Try alternative selectors for the chat container
      const chatContainer = document.querySelector('.space-y-4') || 
                          document.querySelector('[class*="scroll"]') ||
                          document.querySelector('.flex-1');
      if (chatContainer && chatContainer.scrollTo) {
        chatContainer.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      } else {
        // Last fallback to window scroll
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    }
  };
  
  const maxPreviewLength = 500;
  const isLongMessage = message.content.length > 1000;
  const shouldTruncate = false;
  
  const displayContent = message.content;

  const copyMessageFormatted = async () => {
    const success = await copyRichTextToClipboard(message.content);
    if (success) {
      toast.success('Copied with formatting');
    } else {
      toast.error('Failed to copy to clipboard');
    }
  };

  const copyMessagePlain = async () => {
    const success = await copyPlainTextToClipboard(message.content);
    if (success) {
      toast.success('Copied as plain text');
    } else {
      toast.error('Failed to copy to clipboard');
    }
  };

  const copyMessageMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success('Copied as markdown');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
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

  const handleExportPowerPointWithVoiceover = () => {
    if (onExportPowerPointWithVoiceover) {
      onExportPowerPointWithVoiceover(message.content, 'AI Generated Presentation');
    }
  };

  const handleExportPDF = () => {
    import('@/utils/documentGenerators').then(({ generatePDF }) => {
      generatePDF(message.content, 'AI Generated Document');
      toast.success('PDF download started');
    }).catch((error) => {
      console.error('Failed to generate PDF:', error);
      toast.error('Failed to generate PDF');
    });
  };

  const handleEmailToMe = async () => {
    await sendEmailAutomatically(message.content, "AI Generated Content");
  };

  const handleEmailToOthers = () => {
    setIsEmailModalOpen(true);
  };

  const handleEmailToTeam = () => {
    setIsTeamEmailModalOpen(true);
  };

  const handleClinicalVerify = async () => {
    console.log('Starting clinical verification...');
    try {
      setIsVerifying(true);
      
      // Import supabase client
      const { supabase } = await import('@/integrations/supabase/client');
      
      console.log('Calling ai-response-clinical-verification function...');
      const { data, error } = await supabase.functions.invoke('ai-response-clinical-verification', {
        body: {
          originalPrompt: 'Manual verification request',
          aiResponse: message.content,
          messageId: message.id
        }
      });

      console.log('Clinical verification response:', { data, error });

      if (error) {
        console.error('Clinical verification error:', error);
        if (error.message?.includes('non-2xx status code')) {
          toast.error('Clinical verification service temporarily unavailable');
        } else {
          toast.error('Failed to run clinical verification');
        }
        return;
      }

      if (!data) {
        console.error('No verification data received');
        toast.error('No verification data received');
        return;
      }

      console.log('Setting verification data and opening modal...', data);
      console.log('Verification data structure:', JSON.stringify(data, null, 2));
      setVerificationData(data);
      setIsVerificationModalOpen(true);
      toast.success('Clinical verification completed');
    } catch (error) {
      console.error('Clinical verification failed:', error);
      toast.error('Clinical verification failed');
    } finally {
      console.log('Finishing clinical verification, setting isVerifying to false');
      setIsVerifying(false);
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 85) return 'bg-green-100 text-green-800 border-green-300';
    if (score >= 60) return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  const getConfidenceIcon = (score: number) => {
    if (score >= 85) return <CheckCircle className="w-3 h-3" />;
    if (score >= 60) return <Shield className="w-3 h-3" />;
    return <AlertTriangle className="w-3 h-3" />;
  };

  // Handle print functionality
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const cleanedContent = message.content
        .replace(/^```html\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .replace(/^html\s*/i, '')
        .replace(/\s*```[a-z]*\s*$/gi, '')
        .trim();

      printWindow.document.write(`
        <html>
          <head>
            <title>AI Assistant Response</title>
            <meta charset="UTF-8">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                line-height: 1.6; 
                margin: 20px 40px;
                color: #1f2937;
                background: white;
                font-size: 14px;
              }
              
              .header {
                border-bottom: 2px solid #e5e7eb;
                padding-bottom: 16px;
                margin-bottom: 24px;
              }
              
              .title { 
                font-size: 24px;
                font-weight: 600;
                color: #111827;
                margin-bottom: 4px;
              }
              
              .timestamp {
                font-size: 12px;
                color: #6b7280;
              }
              
              .content {
                max-width: none;
              }
              
              /* Typography */
              h1, h2, h3, h4, h5, h6 { 
                font-weight: 600;
                margin: 24px 0 12px 0;
                color: #111827;
              }
              
              h1 { font-size: 20px; }
              h2 { font-size: 18px; }
              h3 { font-size: 16px; }
              h4 { font-size: 15px; }
              
              p { 
                margin-bottom: 12px;
                text-align: justify;
              }
              
              strong, b { 
                font-weight: 600;
                color: #111827;
              }
              
              em, i { 
                font-style: italic; 
              }
              
              /* Lists */
              ul, ol { 
                margin: 12px 0 12px 24px;
                padding-left: 0;
              }
              
              li {
                margin-bottom: 6px;
                line-height: 1.5;
              }
              
              /* Code and preformatted text */
              code {
                background: #f3f4f6;
                padding: 2px 6px;
                border-radius: 4px;
                font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
                font-size: 13px;
              }
              
              pre {
                background: #f9fafb;
                padding: 16px;
                border-radius: 6px;
                border-left: 4px solid #e5e7eb;
                margin: 16px 0;
                overflow-x: auto;
                font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
                font-size: 13px;
              }
              
              /* Tables */
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 16px 0;
              }
              
              th, td {
                border: 1px solid #e5e7eb;
                padding: 8px 12px;
                text-align: left;
              }
              
              th {
                background: #f9fafb;
                font-weight: 600;
              }
              
              /* Blockquotes */
              blockquote {
                border-left: 4px solid #e5e7eb;
                margin: 16px 0;
                padding: 0 16px;
                color: #6b7280;
                font-style: italic;
              }
              
              /* Links */
              a {
                color: #2563eb;
                text-decoration: underline;
              }
              
              /* Print specific styles */
              @media print { 
                body { 
                  margin: 15mm;
                  font-size: 12px;
                }
                
                .header {
                  margin-bottom: 20px;
                }
                
                h1, h2, h3 {
                  page-break-after: avoid;
                }
                
                p, li {
                  orphans: 2;
                  widows: 2;
                }
                
                table {
                  page-break-inside: avoid;
                }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">AI Assistant Response</div>
              <div class="timestamp">${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour12: false })}</div>
            </div>
            <div class="content">${cleanedContent}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
      toast("The AI response is ready to print");
    } else {
      toast.error("Unable to open print dialog. Please check your browser settings.");
    }
  };

  const handleQuickPickAction = async (actionId: string) => {
    if (onQuickResponse) {
      // Handle special modal cases
      if (actionId === 'ai-custom-prompt') {
        setShowCustomAIModal(true);
        return;
      }
      
      if (actionId === 'custom-find-replace') {
        setShowFindReplaceModal(true);
        return;
      }

      // Create context for handler
      const context: QuickPickContext = {
        replyId: message.id,
        text: message.content,
        userId: user?.id || '',
        patientSafeMode: false // TODO: implement patient safe mode logic
      };

      // Get handler function
      const handler = handlers[actionId];
      if (handler) {
        try {
          const result = await handler(context);
          
          // If handler returns a string, it's a prompt to send to AI
          if (typeof result === 'string') {
            onQuickResponse(result);
            
            // Auto-scroll to bottom after sending prompt
            setTimeout(() => {
              window.scrollTo({
                top: document.documentElement.scrollHeight,
                behavior: 'smooth'
              });
              
              // Try to focus the input area for next interaction
              const inputArea = document.querySelector('textarea[placeholder*="Ask about NHS guidelines"]') as HTMLTextAreaElement;
              if (inputArea) {
                inputArea.focus();
              }
            }, 100);
          }
          // For special cases like print, handle directly
          else if (actionId === "print") {
            handlePrint();
          }
        } catch (error) {
          console.error('Handler error:', error);
          toast.error('Action failed. Please try again.');
        }
      } else {
        console.warn(`No handler found for action: ${actionId}`);
        toast.error('Action not implemented yet');
      }
    }
  };

  // Handle custom AI prompt submission
  const handleCustomAISubmit = (customPrompt: string) => {
    const enhancedPrompt = `${customPrompt}\n\nApply this enhancement to the following content:\n\n${message.content}`;
    onQuickResponse?.(enhancedPrompt);
  };

  // Handle custom find & replace submission  
  const handleFindReplaceSubmit = (findText: string, replaceText: string, options: { caseSensitive: boolean; wholeWords: boolean }) => {
    let prompt = `Replace "${findText}" with "${replaceText}" in the above content.`;
    
    if (options.caseSensitive) {
      prompt += ' Use case-sensitive matching.';
    }
    
    if (options.wholeWords) {
      prompt += ' Only replace whole word matches, not partial matches.';
    }
    
    onQuickResponse?.(prompt);
  };

  const quickPickScrollRef = useQuickPickScrollUX<HTMLDivElement>("peek");

  // Recursive function to render menu items from config
  const renderQuickPickItems = (items: QuickPickItem[], level = 0): React.ReactNode => {
    return items.map((item) => {
      if (item.children && item.children.length > 0) {
        return (
          <DropdownMenuSub key={item.id}>
            <DropdownMenuSubTrigger className="flex items-center">
              {item.label}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className={`w-56 bg-popover border border-border shadow-lg z-[9999] ${level === 0 ? 'qp-scroll' : ''}`}>
              {renderQuickPickItems(item.children, level + 1)}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        );
      } else {
        return (
          <DropdownMenuItem key={item.id} onClick={() => handleQuickPickAction(item.id)}>
            {item.label}
          </DropdownMenuItem>
        );
      }
    });
  };

  // Simple function to convert URLs to clickable links (kept for user messages)
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

  return (
    <div className={`flex gap-3 w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex gap-2 sm:gap-3 w-full ${
        message.role === 'user' 
          ? 'max-w-[90%] sm:max-w-[85%] flex-row-reverse' 
          : 'max-w-[95%] sm:max-w-[90%] flex-row'
      }`}>
        {/* Avatar with scroll arrows for assistant messages - hidden in modal */}
        {!isModal && (
          <div className="flex flex-col items-center gap-1">
            {/* Scroll to top arrow - above robot icon */}
            {message.role === 'assistant' && (
              <button
                onClick={handleScrollToTop}
                className="p-1 rounded-full hover:bg-muted transition-colors opacity-60 hover:opacity-100"
                title="Scroll to top"
              >
                <ChevronsUp className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
            
            <div 
              className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'user' 
                  ? 'bg-primary cursor-pointer hover:bg-primary/80 transition-colors' 
                  : 'bg-muted'
              }`}
              onClick={message.role === 'user' ? toggleUserMessageCollapse : undefined}
              title={message.role === 'user' ? (isUserMessageCollapsed ? 'Expand message' : 'Collapse message') : undefined}
            >
              {message.role === 'user' ? (
                <User className="h-3 w-3 sm:h-4 sm:w-4 text-primary-foreground" />
              ) : (
                <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              )}
            </div>
            
            {/* Scroll to input arrow - below robot icon */}
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
        )}
        
        <div 
          ref={messageRef}
          className={`rounded-lg flex flex-col ${
            message.role === 'user' 
              ? 'bg-primary text-primary-foreground ai4gp-user-bubble ml-auto max-w-[85%]' 
              : isModal ? 'bg-transparent border-0' : 'bg-muted border border-border mr-auto max-w-[98%]'
          } ${isModal ? 'p-0' : 'px-4 py-3'}`}
          style={{
            width: '100%',
            minWidth: 0
          }}
        >
          {/* Message Content */}
          {!(message.role === 'user' && isUserMessageCollapsed) && (
            <div className="space-y-2 flex-1 min-h-0">
              {message.role === 'assistant' ? (
                <div 
                  ref={contentRef}
                  className={`message-content overflow-x-auto w-full ai4gp-text-scaled ${isModal ? 'prose-lg' : 'prose prose-sm max-w-none'} 
                             dark:prose-invert
                             prose-p:mb-3 prose-p:leading-relaxed
                             prose-ul:my-2 prose-ul:space-y-1 prose-li:my-1
                             prose-headings:mb-3 prose-headings:mt-4
                             [&_.flex]:mb-3`}
                  style={{
                    maxWidth: 'none',
                    width: '100%',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word'
                  }}
                >
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: renderNHSMarkdown(displayContent, { enableNHSStyling: true })
                    }}
                  />
                  {message.isStreaming && !displayContent && (
                    <div className="inline-flex items-center gap-2 text-muted-foreground mt-2">
                      <span className="text-sm">Notewell AI is thinking</span>
                      <span className="inline-flex items-center gap-0.5">
                        <span className="w-1 h-3 bg-current rounded-full animate-[wave_1.2s_ease-in-out_infinite]"></span>
                        <span className="w-1 h-3 bg-current rounded-full animate-[wave_1.2s_ease-in-out_infinite_0.1s]"></span>
                        <span className="w-1 h-3 bg-current rounded-full animate-[wave_1.2s_ease-in-out_infinite_0.2s]"></span>
                        <span className="w-1 h-3 bg-current rounded-full animate-[wave_1.2s_ease-in-out_infinite_0.3s]"></span>
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="ai4gp-text-scaled">
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: renderNHSMarkdown(displayContent, { enableNHSStyling: true, isUserMessage: message.role === 'user' })
                    }}
                  />
                </div>
              )}
            </div>
          )}
          
          {/* Collapsed indicator for user messages */}
          {message.role === 'user' && isUserMessageCollapsed && (
            <div className="flex items-center gap-2 text-sm py-2">
              <span className="text-white font-bold opacity-100">Message collapsed - click the blue circle icon to expand</span>
              <ChevronDown className="h-3 w-3 text-white opacity-70" />
            </div>
          )}
          
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
          
          {/* Generated images */}
          {message.generatedImages && message.generatedImages.length > 0 && (
            <div className="mt-4 space-y-4">
              {message.generatedImages.map((image, index) => (
                <div key={index} className="rounded-lg overflow-hidden border border-border bg-card">
                  <img 
                    src={image.url} 
                    alt={image.alt || 'Generated image'}
                    className="w-full max-w-2xl mx-auto"
                    loading="lazy"
                  />
                  <div className="p-3 border-t border-border bg-muted/30">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {image.alt || 'Generated visual'}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={async () => {
                            try {
                              const filenameBase = `ai4gp-image-${Date.now()}`;

                              const getExtensionFromMime = (mime: string) => {
                                switch (mime) {
                                  case 'image/png':
                                    return 'png';
                                  case 'image/jpeg':
                                    return 'jpg';
                                  case 'image/webp':
                                    return 'webp';
                                  case 'image/svg+xml':
                                    return 'svg';
                                  default:
                                    return 'png';
                                }
                              };

                              const downloadDataUrl = (dataUrl: string, filename: string) => {
                                const link = document.createElement('a');
                                link.href = dataUrl;
                                link.download = filename;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              };

                              const downloadBlob = (blob: Blob, filename: string) => {
                                const blobUrl = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = blobUrl;
                                link.download = filename;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(blobUrl);
                              };

                              const dataUrlToBlob = (dataUrl: string) => {
                                const [header, data] = dataUrl.split(',');
                                const mimeMatch = header.match(/data:([^;,]+)[;,]/);
                                const mime = mimeMatch?.[1] ?? 'application/octet-stream';
                                const isBase64 = header.includes(';base64');

                                const binary = isBase64 ? atob(data) : decodeURIComponent(data);
                                const bytes = new Uint8Array(binary.length);
                                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                                return new Blob([bytes], { type: mime });
                              };

                              const svgBlobToPngBlob = async (svgBlob: Blob) => {
                                const svgUrl = URL.createObjectURL(svgBlob);
                                try {
                                  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                                    const imageEl = new Image();
                                    imageEl.onload = () => resolve(imageEl);
                                    imageEl.onerror = reject;
                                    imageEl.src = svgUrl;
                                  });

                                  const width = img.naturalWidth || img.width || 512;
                                  const height = img.naturalHeight || img.height || 512;

                                  const canvas = document.createElement('canvas');
                                  canvas.width = width;
                                  canvas.height = height;

                                  const ctx = canvas.getContext('2d');
                                  if (!ctx) throw new Error('Canvas not available');
                                  ctx.drawImage(img, 0, 0);

                                  return await new Promise<Blob>((resolve, reject) => {
                                    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG conversion failed'))), 'image/png');
                                  });
                                } finally {
                                  URL.revokeObjectURL(svgUrl);
                                }
                              };

                              // Handle data URLs (e.g., QR codes)
                              if (image.url.startsWith('data:')) {
                                const mimeMatch = image.url.match(/^data:([^;,]+)[;,]/);
                                const mime = mimeMatch?.[1] ?? 'application/octet-stream';

                                if (mime === 'image/svg+xml') {
                                  const svgBlob = dataUrlToBlob(image.url);
                                  try {
                                    const pngBlob = await svgBlobToPngBlob(svgBlob);
                                    downloadBlob(pngBlob, `${filenameBase}.png`);
                                  } catch {
                                    // Fallback: download as SVG
                                    downloadDataUrl(image.url, `${filenameBase}.svg`);
                                  }
                                } else {
                                  const ext = getExtensionFromMime(mime);
                                  downloadDataUrl(image.url, `${filenameBase}.${ext}`);
                                }

                                toast.success('Image downloaded');
                                return;
                              }

                              // Handle remote URLs
                              const response = await fetch(image.url);
                              const blob = await response.blob();

                              if (blob.type === 'image/svg+xml') {
                                try {
                                  const pngBlob = await svgBlobToPngBlob(blob);
                                  downloadBlob(pngBlob, `${filenameBase}.png`);
                                } catch {
                                  downloadBlob(blob, `${filenameBase}.svg`);
                                }
                              } else {
                                const ext = getExtensionFromMime(blob.type);
                                downloadBlob(blob, `${filenameBase}.${ext}`);
                              }

                              toast.success('Image downloaded');
                            } catch (error) {
                              console.error('Download failed:', error);
                              toast.error('Failed to download image');
                            }
                          }}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            // Copy image to clipboard
                            fetch(image.url)
                              .then(res => res.blob())
                              .then(blob => {
                                navigator.clipboard.write([
                                  new ClipboardItem({ 'image/png': blob })
                                ]).then(() => {
                                  toast.success('Image copied to clipboard');
                                }).catch(() => {
                                  toast.error('Failed to copy image');
                                });
                              });
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
  {/* Clinical verification badge */}
          {/* Clinical verification display - removed from here since it's now inline with footer */}
          
          {/* Response metrics for assistant messages */}
          {(showResponseMetrics || showRenderTimes || showAIService) && message.role === 'assistant' && (
            <div className="mt-2 pt-2 border-t border-border/20">
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {showRenderTimes && message.responseTime && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{(message.responseTime / 1000).toFixed(1)}s total</span>
                  </div>
                )}
                {showRenderTimes && message.apiResponseTime && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{(message.apiResponseTime / 1000).toFixed(1)}s API</span>
                  </div>
                )}
                {showRenderTimes && message.timeToFirstWords && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{(message.timeToFirstWords / 1000).toFixed(1)}s first words</span>
                  </div>
                )}
                {showAIService && message.model && (
                  <div className="flex items-center gap-1">
                    <Bot className="h-3 w-3" />
                    <span>{message.model}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Calculation Verification Panel removed per user request */}

          {/* Quick Action Buttons - only for assistant messages, not in modal, and only if not streaming */}
          {message.role === 'assistant' && !isModal && onQuickResponse && (
            <QuickActionButtons
              content={message.content}
              onQuickResponse={onQuickResponse}
            />
          )}

          {/* Leave Calendar Download Button - shows when leave data detected */}
          {message.role === 'assistant' && !isModal && !message.isStreaming && (
            <div className="mt-2">
              <LeaveCalendarDownloadButton content={message.content} />
            </div>
          )}

          {/* Voice Audio Player - shows when audio was generated */}
          {message.role === 'assistant' && !isModal && !message.isStreaming && message.generatedAudio && (
            <VoiceAudioPlayer audio={message.generatedAudio} />
          )}

          {/* PowerPoint Download Card - shows when presentation was generated */}
          {message.role === 'assistant' && !isModal && !message.isStreaming && message.generatedPresentation && (
            <PowerPointDownloadCard presentation={message.generatedPresentation} />
          )}

          {/* Message footer - always show action buttons in modal */}
          {(!isModal || (isModal && message.role === 'assistant')) && (
            <div className={`${isModal ? 'fixed bottom-4 left-4 right-4 bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg z-50' : 'flex items-center justify-between mt-3 pt-3 border-t border-border/20'}`}>
              {!isModal && (
                <div className="flex items-center gap-2">
                  {/* Clinical Verify button - moved before timestamp */}
                  {message.role === 'assistant' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClinicalVerify}
                      disabled={isVerifying}
                      className="h-6 w-6 p-0 opacity-70 hover:opacity-100 text-muted-foreground hover:text-foreground"
                      title="Run clinical verification"
                    >
                       {isVerifying ? (
                         <div className="flex items-center gap-0.5">
                           <div className="w-0.5 h-3 bg-current animate-wave"></div>
                           <div className="w-0.5 h-3 bg-current animate-wave" style={{ animationDelay: '0.1s' }}></div>
                           <div className="w-0.5 h-3 bg-current animate-wave" style={{ animationDelay: '0.2s' }}></div>
                         </div>
                       ) : (
                        <ShieldCheck className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                  <span className="text-xs opacity-70">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              )}

              {/* Clinical verification results - show in middle when available */}
              {!isModal && message.role === 'assistant' && (message.clinicalVerification || verificationData) && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsVerificationModalOpen(true)}
                    className={`px-2 py-1 rounded-md text-xs font-medium border cursor-pointer transition-colors ${
                      getConfidenceColor((verificationData?.confidenceScore ?? verificationData?.confidence ?? message.clinicalVerification?.confidenceScore) || 0)
                    }`}
                    title="Click to view detailed verification report"
                  >
                    <div className="flex items-center gap-1">
                      {getConfidenceIcon((verificationData?.confidenceScore ?? verificationData?.confidence ?? message.clinicalVerification?.confidenceScore) || 0)}
                      <span>{Math.floor((verificationData?.confidenceScore ?? verificationData?.confidence ?? message.clinicalVerification?.confidenceScore) || 0)}%</span>
                    </div>
                  </button>
                  <Badge variant={
                    (verificationData?.riskLevel || message.clinicalVerification?.riskLevel) === 'high' ? 'destructive' :
                    (verificationData?.riskLevel || message.clinicalVerification?.riskLevel) === 'medium' ? 'secondary' : 'default'
                  } className="text-xs">
                    {((verificationData?.riskLevel || message.clinicalVerification?.riskLevel) || 'low').toUpperCase()} RISK
                  </Badge>
                </div>
              )}

              <div className={`flex items-center gap-2 ${isModal ? 'justify-center w-full' : ''}`}>
                {/* Action buttons for assistant messages */}
                {message.role === 'assistant' && (
                  <>
                    {/* Scroll to top button - moved to first position in modal */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={scrollToTop}
                      className="h-6 w-6 p-0 opacity-70 hover:opacity-100 text-muted-foreground hover:text-foreground"
                      title="Scroll to top of this message"
                    >
                      <ChevronsUp className="h-3 w-3" />
                    </Button>

                    {/* Export dropdown button */}
                    {onExportWord && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-70 hover:opacity-100 text-muted-foreground hover:text-foreground"
                            title="Download options"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem onClick={handleExportWord}>
                            <FileText className="h-4 w-4 mr-2" />
                            Download as Word Document
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleExportPDF}>
                            <FileDown className="h-4 w-4 mr-2" />
                            Download as PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleExportPowerPoint}>
                            <Presentation className="h-4 w-4 mr-2" />
                            Download as PowerPoint Presentation
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setShowInfographicModal(true)}>
                            <ImageIcon className="h-4 w-4 mr-2" />
                            Create as Infographic
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    {/* Email dropdown button */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-70 hover:opacity-100 text-muted-foreground hover:text-foreground"
                          title="Email options"
                        >
                          <Mail className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem 
                          onClick={handleEmailToMe}
                          disabled={isSending}
                        >
                          {isSending ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Mail className="h-4 w-4 mr-2" />
                              Email to me
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleEmailToOthers}>
                          <Mail className="h-4 w-4 mr-2" />
                          Email to patient/others
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleEmailToTeam}>
                          <Users className="h-4 w-4 mr-2" />
                          Email to team members
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Clinical Verify button - for modal only */}
                    {isModal && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClinicalVerify}
                        disabled={isVerifying}
                        className="h-6 w-6 p-0 opacity-70 hover:opacity-100 text-muted-foreground hover:text-foreground"
                        title="Run clinical verification"
                      >
                         {isVerifying ? (
                           <div className="flex items-center gap-0.5">
                             <div className="w-0.5 h-3 bg-current animate-wave"></div>
                             <div className="w-0.5 h-3 bg-current animate-wave" style={{ animationDelay: '0.1s' }}></div>
                             <div className="w-0.5 h-3 bg-current animate-wave" style={{ animationDelay: '0.2s' }}></div>
                           </div>
                         ) : (
                          <ShieldCheck className="h-3 w-3" />
                        )}
                      </Button>
                    )}

                    {/* Copy dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-70 hover:opacity-100 text-muted-foreground hover:text-foreground"
                          title="Copy options"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={copyMessageFormatted}>
                          <FileType className="h-4 w-4 mr-2" />
                          Copy with Formatting
                          <span className="ml-auto text-xs text-muted-foreground">for emails</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={copyMessagePlain}>
                          <Type className="h-4 w-4 mr-2" />
                          Copy Plain Text
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={copyMessageMarkdown}>
                          <Hash className="h-4 w-4 mr-2" />
                          Copy as Markdown
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Quick Pick (QP) dropdown - only show in regular chat */}
                    {!isModal && onQuickResponse && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-70 hover:opacity-100 text-muted-foreground hover:text-foreground"
                            title="Quick prompts"
                          >
                            <Zap className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent 
                          align="end" 
                          className="w-72 bg-background border z-50 shadow-lg qp-scroll" 
                          ref={quickPickScrollRef}
                        >
                          {renderQuickPickItems(quickPickConfig.quickPick)}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    {/* Modal-specific close button - moved to last position */}
                    {isModal && onCloseModal && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onCloseModal}
                        className="h-6 w-6 p-0 opacity-70 hover:opacity-100 text-muted-foreground hover:text-foreground"
                        title="Close modal"
                      >
                        <Minimize2 className="h-3 w-3" />
                      </Button>
                    )}
                    
                    {/* Expand to full screen button - only show in regular chat */}
                    {!isModal && onExpandMessage && (
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
                
                {/* Copy dropdown for user messages - only in regular chat */}
                {!isModal && message.role === 'user' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-70 hover:opacity-100 text-primary-foreground/70 hover:text-primary-foreground"
                        title="Copy options"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={copyMessageFormatted}>
                        <FileType className="h-4 w-4 mr-2" />
                        Copy with Formatting
                        <span className="ml-auto text-xs text-muted-foreground">for emails</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={copyMessagePlain}>
                        <Type className="h-4 w-4 mr-2" />
                        Copy Plain Text
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={copyMessageMarkdown}>
                        <Hash className="h-4 w-4 mr-2" />
                        Copy as Markdown
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Email Composition Modal for sending to others */}
      <EmailCompositionModal
        isOpen={isEmailModalOpen}
        onOpenChange={setIsEmailModalOpen}
        content={message.content}
        defaultSubject="AI Generated Content"
      />

      {/* Email to Team Modal */}
      <EmailToTeamModal
        isOpen={isTeamEmailModalOpen}
        onClose={() => setIsTeamEmailModalOpen(false)}
        messageContent={message.content}
        senderName={user?.email || 'Team Member'}
      />
      {/* Clinical Verification Modal */}
      {(message.clinicalVerification || verificationData) && (
        <ClinicalVerificationModal
          isOpen={isVerificationModalOpen}
          onClose={() => setIsVerificationModalOpen(false)}
          verificationData={verificationData || message.clinicalVerification}
        />
      )}

      {/* Custom AI Prompt Modal */}
      <CustomAIPromptModal
        open={showCustomAIModal}
        onOpenChange={setShowCustomAIModal}
        onSubmit={handleCustomAISubmit}
        currentText={message.content}
      />

      {/* Custom Find & Replace Modal */}
      <CustomFindReplaceModal
        open={showFindReplaceModal}
        onOpenChange={setShowFindReplaceModal}
        onSubmit={handleFindReplaceSubmit}
        currentText={message.content}
      />

      {/* Infographic Modal */}
      <ContentInfographicModal
        isOpen={showInfographicModal}
        onClose={() => setShowInfographicModal(false)}
        content={message.content}
        title="AI Generated Content"
        imageModel={imageGenerationModel}
      />
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default React.memo(MessageRenderer, (prevProps, nextProps) => {
  // Only re-render if key props change
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.isStreaming === nextProps.message.isStreaming &&
    prevProps.message.generatedPresentation === nextProps.message.generatedPresentation &&
    prevProps.showResponseMetrics === nextProps.showResponseMetrics &&
    prevProps.showRenderTimes === nextProps.showRenderTimes &&
    prevProps.showAIService === nextProps.showAIService &&
    prevProps.autoCollapseUserPrompts === nextProps.autoCollapseUserPrompts
  );
});