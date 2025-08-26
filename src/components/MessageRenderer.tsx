import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SafeMessageRenderer } from '@/components/SafeMessageRenderer';
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
  Printer
} from 'lucide-react';
import { useTrafficLightResolver } from '@/hooks/useTrafficLightResolver';
import PolicyBadge from '@/components/PolicyBadge';
import EvidenceDrawer from '@/components/EvidenceDrawer';
import PolicyBanner from '@/components/PolicyBanner';
import { toast } from 'sonner';
import QuickActionButtons from '@/components/QuickActionButtons';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoEmail } from '@/hooks/useAutoEmail';
import { EmailCompositionModal } from '@/components/EmailCompositionModal';
import { ClinicalVerificationModal } from '@/components/ClinicalVerificationModal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { quickPickConfig } from '@/constants/quickPickConfig';
import { handlers } from '@/utils/quickPickHandlers';
import { QuickPickContext, QuickPickItem } from '@/types/quickPick';
import { useQuickPickScrollUX } from '@/hooks/useQuickPickScrollUX';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: UploadedFile[];
  responseTime?: number;
  timeToFirstWords?: number;
  apiResponseTime?: number;
  model?: string;
  isStreaming?: boolean;
  isClinical?: boolean;
  clinicalVerification?: any;
}

interface UploadedFile {
  name: string;
  type: string;
  content: string;
  size: number;
}

interface MessageRendererProps {
  message: Message;
  onExpandMessage?: (message: Message) => void;
  onExportWord?: (content: string, title?: string) => void;
  onExportPowerPoint?: (content: string, title?: string) => void;
  isModal?: boolean; // New prop to indicate if rendering in modal
  onCloseModal?: () => void; // New prop to close modal
  showResponseMetrics?: boolean; // New prop to show response metrics
  showRenderTimes?: boolean; // New prop to show render times separately
  showAIService?: boolean; // New prop to show AI service separately
  onQuickResponse?: (response: string) => void; // New prop for quick responses
  onSetDrugName?: (drugName: string) => void; // New prop for setting drug name
}

const MessageRenderer: React.FC<MessageRendererProps> = ({ 
  message, 
  onExpandMessage, 
  onExportWord, 
  onExportPowerPoint,
  isModal = false,
  onCloseModal,
  showResponseMetrics = false,
  showRenderTimes = false,
  showAIService = false,
  onQuickResponse,
  onSetDrugName
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullContent, setShowFullContent] = useState(true);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationData, setVerificationData] = useState(null);
  const [policyHits, setPolicyHits] = useState<any[]>([]);
  const [policyEnforcement, setPolicyEnforcement] = useState(true);
  const [isUserMessageCollapsed, setIsUserMessageCollapsed] = useState(false);
  const { user } = useAuth();
  // Toggle user message collapse
  const toggleUserMessageCollapse = () => {
    if (message.role === 'user') {
      setIsUserMessageCollapsed(!isUserMessageCollapsed);
    }
  };
  const { sendEmailAutomatically, isSending } = useAutoEmail();
  const { resolveMedicines } = useTrafficLightResolver();
  
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

  // Check for policy violations when message content updates
  useEffect(() => {
    const checkPolicyViolations = async () => {
      if (message.content && (message.role === 'user' || message.role === 'assistant')) {
        try {
          const result = await resolveMedicines(message.content);
          if (result.hits.length > 0) {
            setPolicyHits(result.hits);
          }
        } catch (error) {
          console.error('Policy check failed:', error);
        }
      }
    };

    checkPolicyViolations();
  }, [message.content, message.role, resolveMedicines]);
  
  // Calculate if this is a large response (more than 1000 characters or multiple sections)
  const isLargeResponse = message.role === 'assistant' && (
    message.content.length > 1000 || 
    message.content.includes('###') || 
    message.content.includes('##') ||
    message.content.split('\n').length > 20
  );


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

  const handleClinicalVerify = async () => {
    console.log('Starting clinical verification...');
    try {
      setIsVerifying(true);
      
      // Import supabase client
      const { supabase } = await import('@/integrations/supabase/client');
      
      console.log('Calling clinical-verification function...');
      const { data, error } = await supabase.functions.invoke('clinical-verification', {
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
              ? 'bg-primary text-primary-foreground' 
              : isModal ? 'bg-transparent border-0' : 'bg-muted border border-border'
          } ${isModal ? 'p-0' : 'p-2 sm:p-4'}`}
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
                  className={`message-content overflow-x-auto w-full ${isModal ? 'prose-lg' : 'prose prose-sm max-w-none'}`}
                  style={{
                    maxWidth: 'none',
                    width: '100%',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word'
                  }}
                >
                  <SafeMessageRenderer 
                    content={displayContent}
                    className="w-full"
                  />
                  {message.isStreaming && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <span className="animate-pulse">●</span>
                      <span className="animate-pulse delay-100">●</span>
                      <span className="animate-pulse delay-200">●</span>
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-sm">
                  <SafeMessageRenderer 
                    content={displayContent}
                    className="w-full user-message-content"
                    enableNHSStyling={true}
                  />
                </div>
              )}
            </div>
          )}
          
          {/* Collapsed indicator for user messages */}
          {message.role === 'user' && isUserMessageCollapsed && (
            <div className="flex items-center gap-2 text-sm opacity-70 py-2">
              <span className="text-primary-foreground/70">Message collapsed</span>
              <ChevronDown className="h-3 w-3 text-primary-foreground/70" />
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

          {/* Quick Action Buttons - only for assistant messages, not in modal, and only if not streaming */}
          {message.role === 'assistant' && !isModal && onQuickResponse && (
            <QuickActionButtons
              content={message.content}
              onQuickResponse={onQuickResponse}
            />
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
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-current" />
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
                          <div className="animate-spin rounded-full h-3 w-3 border-b border-current" />
                        ) : (
                          <ShieldCheck className="h-3 w-3" />
                        )}
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
                
                {/* Copy button for user messages - only in regular chat */}
                {!isModal && message.role === 'user' && (
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

      {/* Clinical Verification Modal */}
      {(message.clinicalVerification || verificationData) && (
        <ClinicalVerificationModal
          isOpen={isVerificationModalOpen}
          onClose={() => setIsVerificationModalOpen(false)}
          verificationData={verificationData || message.clinicalVerification}
        />
      )}
    </div>
  );
};

export default MessageRenderer;