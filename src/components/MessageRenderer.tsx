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
  Languages
} from 'lucide-react';
import { toast } from 'sonner';
import QuickActionButtons from '@/components/QuickActionButtons';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoEmail } from '@/hooks/useAutoEmail';
import { EmailCompositionModal } from '@/components/EmailCompositionModal';
import { ClinicalVerificationModal } from '@/components/ClinicalVerificationModal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';

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
  onQuickResponse
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullContent, setShowFullContent] = useState(true);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationData, setVerificationData] = useState(null);
  const { user } = useAuth();
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

      console.log('Setting verification data and opening modal...');
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

  const handleQuickPickAction = (action: string) => {
    if (onQuickResponse) {
      if (action === "Check this as I think it's wrong") {
        const correctionPrompt = `You are an NHS UK primary-care assistant acting in "Challenge & Verify" mode.

GOAL
Audit the previous answer against CURRENT, TRUSTED UK sources. Prove the conclusion with quotes and verifiable links. If wrong or incomplete, replace it with a corrected answer.

INPUTS (provided by the app)
- original_prompt: {{original_prompt}}
- previous_answer: {{previous_answer}}
- now_utc: {{now_utc}}
- (optional) pre_fetched_docs: array of {url, title, last_updated_text, body_text}
- (optional) topic_hint: {{topic_hint}}

SOURCE POLICY (ALLOW-LIST ONLY)
Primary clinical sources (in order of preference):
1) england.nhs.uk (NHS England: service policy, vaccination programmes, DES/specifications, letters/'long-read')
2) nice.org.uk (NICE guidelines, NG/CG/IPG; pathways)
3) bnf.nice.org.uk (BNF monographs)
4) gov.uk:
   - MHRA (safety alerts; SmPC/PIL links)
   - DHSC/UKHSA (press releases, epidemiology, immunisation policy)
5) nhs.uk (patient-facing info; secondary corroboration)
6) Green Book (Immunisation against infectious disease) via gov.uk

NEVER use blogs, media articles, social sites, or commercial pages. If necessary sources are missing, STOP with an error (see "INSUFFICIENT EVIDENCE").

ROUTING HINTS (pick the primary)
- Vaccination eligibility/programme timing → NHS England "long-read" or programme letter (england.nhs.uk). Use Green Book only for referenced clinical criteria (e.g., immunosuppression tables).
- Medicines (indications, dosing, cautions) → BNF first; MHRA SmPC for product specifics/contraindications.
- Clinical management guidance → NICE guideline (NG/CG); add UKHSA where relevant (ID).
- Contracting/ARRS/DES → NHS England specifications/letters on england.nhs.uk.

RECENCY RULES
- Vaccination programmes, DES/policy, safety alerts: must reflect the latest page revision or letter. Extract and display the "last updated/published" text from the page. If older than 12 months AND you find a newer official source, prefer the newer one.
- Medicines: BNF current edition (live site). If BNF conflicts with older PDFs, prefer BNF.
- If "last updated" not shown, state "not stated" and proceed, but cross-check with at least one corroborator on the allow-list.

METHOD
1) Identify topic and choose a PRIMARY source from the allow-list (see "Routing hints").
2) Fetch/read that page (or use pre_fetched_docs). If fetch fails → output "INSUFFICIENT EVIDENCE" (see template).
3) Extract EXACT passages that answer the question (e.g., eligibility bullets, programme dates, dosing lines).
4) Fetch 1–2 SECONDARY corroborators from the allow-list. If they disagree, prefer PRIMARY and note the discrepancy.
5) Compare previous_answer to the extracted evidence. List precise differences (wrong cohort, wrong age, missing group, wrong dose/date, etc.).
6) If any part is wrong/outdated/unsupported, produce a corrected answer that adheres strictly to the evidence. Do not invent content.
7) Provide a proof pack: verbatim quotes in blockquotes + working links. Links must go to the exact document (and page/section if possible).
8) If evidence is incomplete/unavailable, do NOT answer; return "INSUFFICIENT EVIDENCE" with the missing sources you need.

STYLE
- UK GP tone: clear, factual, concise.
- Quote minimally but exactly for the key lines.
- No generic disclaimers; show concrete evidence and dates.
- Use British English.

OUTPUT FORMAT (STRICT)
Verification Panel:
- Topic checked: <one line>
- Primary source: <title> — <url>
- Secondary source(s): <title> — <url> (0–2 items)
- Last updated (primary): <date or "not stated">
- Checked now (Europe/London): <auto-convert from now_utc>

Evidence (verbatim quotes):
> <Exact line(s) from the primary source that determine the answer. Keep to the relevant bullets/sentences.>
> <If helpful, add 1–2 short quotes from secondary sources.>

Comparison with previous answer:
- Verdict: Correct / Partially correct / Incorrect
- Differences found:
  • <difference 1>
  • <difference 2>
  • ...

Corrected answer (only if Verdict ≠ Correct):
<Provide the final corrected answer. Where applicable (e.g., eligibility), paste the bullets verbatim.>

Change log:
- <What changed and why, each mapped to a quoted evidence line.>

References:
- <Primary source title> — <url>
- <Secondary source title> — <url> (only if used)

INSUFFICIENT EVIDENCE (use this template when required sources cannot be fetched/are missing):
Verification Panel (partial) + 
"Unable to verify because the required official sources were not available:
- <list exact missing URLs/doc types needed>
Please fetch these and retry. No corrections made."`;
        onQuickResponse(correctionPrompt);
      } else {
        onQuickResponse(action);
      }
      
      // Auto-scroll to bottom after sending prompt, especially for long prompts
      setTimeout(() => {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: 'smooth'
        });
        
        // Also try to focus the input area for next interaction
        const inputArea = document.querySelector('textarea[placeholder*="Ask about NHS guidelines"]') as HTMLTextAreaElement;
        if (inputArea) {
          inputArea.focus();
        }
      }, 100);
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

    // Function to detect and format tables
    const formatTable = (tableText: string) => {
      const lines = tableText.split('\n').map(line => line.trim()).filter(Boolean);
      
      // Check if this looks like a table (multiple lines with | separators)
      const tableLines = lines.filter(line => line.includes('|') && line.split('|').length > 2);
      
      if (tableLines.length < 2) {
        return null; // Not a valid table
      }

      // Parse table rows
      const rows = tableLines.map(line => {
        return line.split('|')
          .map(cell => cell.trim())
          .filter(cell => cell !== '') // Remove empty cells from start/end
      });

      // Skip header separator lines (lines with just dashes and pipes)
      const dataRows = rows.filter(row => 
        !row.every(cell => /^[-\s]*$/.test(cell))
      );

      if (dataRows.length === 0) return null;

      const headerRow = dataRows[0];
      const bodyRows = dataRows.slice(1);

      return (
        <div className="my-4 overflow-x-auto">
          <table className="min-w-full border-collapse border border-border">
            <thead>
              <tr className="bg-muted/50">
                {headerRow.map((header, index) => (
                  <th 
                    key={index} 
                    className="border border-border px-3 py-2 text-left font-semibold text-xs"
                  >
                    {processMarkdown(header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                  {row.map((cell, cellIndex) => (
                    <td 
                      key={cellIndex} 
                      className="border border-border px-3 py-2 text-xs"
                    >
                      {processMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    };

    // Split cleanedContent into paragraphs
    const paragraphs = cleanedContent.split('\n\n');
    
    return paragraphs.map((paragraph, index) => {
      if (!paragraph.trim()) return null;
      
      // Check if paragraph contains a table (multiple lines with | separators)
      const lines = paragraph.split('\n');
      const pipeLines = lines.filter(line => line.includes('|') && line.split('|').length > 2);
      
      if (pipeLines.length >= 2) {
        const table = formatTable(paragraph);
        if (table) {
          return <div key={`table-${index}`}>{table}</div>;
        }
      }
      
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
            
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              message.role === 'user' ? 'bg-primary' : 'bg-muted'
            }`}>
              {message.role === 'user' ? (
                <User className="h-4 w-4 text-primary-foreground" />
              ) : (
                <Bot className="h-4 w-4 text-muted-foreground" />
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
          } ${isModal ? 'p-0' : 'p-4'}`}
          style={{
            width: '100%'
          }}
        >
          {/* Message Content */}
          <div className="space-y-2 flex-1 min-h-0">
            {message.role === 'assistant' ? (
              <div 
                ref={contentRef}
                className={`ai-response-content overflow-y-auto w-full ${isModal ? 'prose-lg' : 'prose prose-sm'}`}
                style={{
                  maxWidth: 'none',
                  width: '100%'
                }}
              >
                {formatContent(displayContent)}
                {message.isStreaming && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <span className="animate-pulse">●</span>
                    <span className="animate-pulse delay-100">●</span>
                    <span className="animate-pulse delay-200">●</span>
                  </span>
                )}
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
          
  {/* Clinical verification badge */}
          {message.role === 'assistant' && message.clinicalVerification && (
            <div className="mt-3 pt-2 border-t border-border/20">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-3 h-3 text-blue-600" />
                <button
                  onClick={() => setIsVerificationModalOpen(true)}
                  className={`px-2 py-1 rounded-md text-xs font-medium border cursor-pointer transition-colors ${
                    getConfidenceColor(message.clinicalVerification.confidenceScore)
                  }`}
                  title="Click to view detailed verification report"
                >
                  <div className="flex items-center gap-1">
                    {getConfidenceIcon(message.clinicalVerification.confidenceScore)}
                    <span>{Math.floor(message.clinicalVerification.confidenceScore)}% Clinical Confidence</span>
                  </div>
                </button>
                <Badge variant={
                  message.clinicalVerification.riskLevel === 'high' ? 'destructive' :
                  message.clinicalVerification.riskLevel === 'medium' ? 'secondary' : 'default'
                } className="text-xs">
                  {message.clinicalVerification.riskLevel.toUpperCase()} RISK
                </Badge>
              </div>
            </div>
          )}
          
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
                        <DropdownMenuContent align="end" className="w-72 bg-background border z-50 shadow-lg">
                          <DropdownMenuItem onClick={() => handleQuickPickAction("Prompt Reply: Yes")}>
                            <CheckSquare className="h-4 w-4 mr-2" />
                            Prompt Reply: Yes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickPickAction("Prompt Reply: No")}>
                            <CheckSquare className="h-4 w-4 mr-2" />
                            Prompt Reply: No
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickPickAction("Check this as I think it's wrong")}>
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Check this as I think it's wrong
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                            Expand
                          </DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleQuickPickAction("Prompt: Expand with more details and examples")}>
                            <Expand className="h-4 w-4 mr-2" />
                            Expand with more details and examples
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickPickAction("Prompt: Expand and create as a patient leaflet")}>
                            <FileText className="h-4 w-4 mr-2" />
                            Expand and create as a patient leaflet
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickPickAction("Prompt: Translate this content into [specify language] while maintaining medical accuracy and cultural appropriateness")}>
                            <Languages className="h-4 w-4 mr-2" />
                            Translate for patients
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickPickAction("Prompt: Create as a detailed training document for our staff, covering off any areas that are expected to be known")}>
                            <GraduationCap className="h-4 w-4 mr-2" />
                            Create as detailed training document for staff
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleQuickPickAction("Prompt: Combine with my practice information")}>
                            <FileText className="h-4 w-4 mr-2" />
                            Combine with my practice information
                          </DropdownMenuItem>
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