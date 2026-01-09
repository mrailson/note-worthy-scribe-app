import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CustomAIPromptModal } from "@/components/CustomAIPromptModal";
import { CustomFindReplaceModal } from "@/components/CustomFindReplaceModal";
import { supabase } from "@/integrations/supabase/client";
import { showToast } from '@/utils/toastWrapper';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import { stripMarkdown, copyPlainTextToClipboard } from '@/utils/stripMarkdown';
import { 
  Wand2, 
  Sparkles,
  Copy,
  Download,
  Edit3,
  Search,
  Type,
  FileText,
  FileType,
  RefreshCw,
  ChevronDown,
  Zap,
  Loader2
} from "lucide-react";

interface MeetingModalQuickPickProps {
  content: string;
  onContentChange: (content: string) => void;
  meetingId?: string;
}

export function MeetingModalQuickPick({ 
  content, 
  onContentChange,
  meetingId
}: MeetingModalQuickPickProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCustomAIModal, setShowCustomAIModal] = useState(false);
  const [showFindReplaceModal, setShowFindReplaceModal] = useState(false);

  // Copy functionality
  const handleCopy = async () => {
    try {
      await copyPlainTextToClipboard(content);
      showToast.success("Content copied to clipboard", { section: 'meeting_manager' });
    } catch (error) {
      console.error('Copy failed:', error);
      showToast.error("Failed to copy content", { section: 'meeting_manager' });
    }
  };

  // Regenerate functionality
  const handleRegenerate = async () => {
    if (!content.trim()) {
      showToast.error("No content to regenerate", { section: 'meeting_manager' });
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('enhance-meeting-minutes', {
        body: {
          originalContent: content,
          enhancementType: 'regenerate',
          specificRequest: 'Please regenerate this content with improved clarity and structure while maintaining all key information.',
          context: `Meeting ID: ${meetingId}`
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      onContentChange(data.enhancedContent);
      showToast.success("Content regenerated successfully", { section: 'meeting_manager' });
    } catch (error) {
      console.error('Regeneration error:', error);
      showToast.error(error instanceof Error ? error.message : 'Regeneration failed', { section: 'meeting_manager' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Download functionality
  const handleDownloadWord = async () => {
    try {
      const cleanContent = stripMarkdown(content);
      const doc = new Document({
        sections: [{
          properties: {},
          children: cleanContent.split('\n').map(line => 
            new Paragraph({
              children: [new TextRun({ text: line, size: 24 })],
              spacing: { after: 120 }
            })
          )
        }]
      });

      const buffer = await Packer.toBuffer(doc);
      const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      saveAs(blob, `meeting-notes-${Date.now()}.docx`);
      showToast.success("Word document downloaded", { section: 'meeting_manager' });
    } catch (error) {
      console.error('Word export failed:', error);
      showToast.error("Failed to export Word document", { section: 'meeting_manager' });
    }
  };

  const handleDownloadPDF = () => {
    try {
      const pdf = new jsPDF();
      const cleanContent = stripMarkdown(content);
      
      const lines = pdf.splitTextToSize(cleanContent, 180);
      let y = 20;
      
      lines.forEach((line: string) => {
        if (y > 280) {
          pdf.addPage();
          y = 20;
        }
        pdf.text(line, 10, y);
        y += 7;
      });
      
      pdf.save(`meeting-notes-${Date.now()}.pdf`);
      showToast.success("PDF downloaded", { section: 'meeting_manager' });
    } catch (error) {
      console.error('PDF export failed:', error);
      showToast.error("Failed to export PDF", { section: 'meeting_manager' });
    }
  };

  const handleDownloadText = () => {
    try {
      const cleanContent = stripMarkdown(content);
      const blob = new Blob([cleanContent], { type: 'text/plain;charset=utf-8' });
      saveAs(blob, `meeting-notes-${Date.now()}.txt`);
      showToast.success("Text file downloaded", { section: 'meeting_manager' });
    } catch (error) {
      console.error('Text export failed:', error);
      showToast.error("Failed to export text file", { section: 'meeting_manager' });
    }
  };

  // Quick Pick Actions
  const handleQuickPickAction = (action: string) => {
    const actions: { [key: string]: () => string } = {
      'uppercase': () => content.toUpperCase(),
      'lowercase': () => content.toLowerCase(),
      'title-case': () => content.replace(/\w\S*/g, (txt) => 
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      ),
      'sentence-case': () => content.charAt(0).toUpperCase() + content.slice(1).toLowerCase(),
      'remove-extra-spaces': () => content.replace(/\s+/g, ' ').trim(),
      'add-bullet-points': () => content.split('\n')
        .filter(line => line.trim())
        .map(line => `• ${line.trim()}`)
        .join('\n'),
      'add-numbers': () => content.split('\n')
        .filter(line => line.trim())
        .map((line, index) => `${index + 1}. ${line.trim()}`)
        .join('\n'),
      'remove-bullets': () => content.replace(/^[\s]*[•\-*]\s*/gm, ''),
      'remove-numbers': () => content.replace(/^[\s]*\d+\.\s*/gm, ''),
      'clinical-summary': () => content + '\n\n## Clinical Summary\n[AI-generated summary would appear here]',
      'action-items': () => content + '\n\n## Action Items\n[Extracted action items would appear here]',
      'patient-care-focus': () => content + '\n\n## Patient Care Focus\n[Patient care highlights would appear here]'
    };

    const result = actions[action]?.();
    if (result) {
      onContentChange(result);
      showToast.success(`Applied ${action.replace('-', ' ')}`, { section: 'meeting_manager' });
    }
  };

  // AI Enhancement functionality
  const handleAIEnhancement = async (enhanceType: string) => {
    if (!content.trim()) {
      showToast.error("No content to enhance", { section: 'meeting_manager' });
      return;
    }

    setIsProcessing(true);
    
    try {
      const prompts = {
        'clinical-focus': 'Focus on and enhance all clinical discussions, medical decisions, and patient care elements. Emphasize diagnostic considerations, treatment plans, and clinical reasoning.',
        'action-analysis': 'Extract and organize all action items, decisions, and follow-up tasks. Create a structured analysis of responsibilities, timelines, and outcomes.',
        'professional-tone': 'Enhance the language to meet professional healthcare standards. Use appropriate medical terminology and formal business language.',
        'risk-assessment': 'Identify and highlight all clinical and operational risks mentioned. Add risk assessment context and mitigation considerations.',
        'follow-up-plans': 'Generate comprehensive follow-up recommendations based on the discussions. Include timelines, responsible parties, and success metrics.',
        'patient-safety': 'Emphasize all patient safety elements, quality improvement discussions, and safeguarding considerations. Highlight safety protocols and outcomes.'
      };

      const { data, error } = await supabase.functions.invoke('enhance-meeting-minutes', {
        body: {
          originalContent: content,
          enhancementType: 'custom',
          specificRequest: prompts[enhanceType as keyof typeof prompts] || enhanceType,
          context: `Meeting ID: ${meetingId}`
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      onContentChange(data.enhancedContent);
      showToast.success(`Applied ${enhanceType.replace('-', ' ')} enhancement`, { section: 'meeting_manager' });
    } catch (error) {
      console.error('Enhancement error:', error);
      showToast.error(error instanceof Error ? error.message : 'Enhancement failed', { section: 'meeting_manager' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Custom AI Enhancement
  const handleCustomAISubmit = async (prompt: string) => {
    if (!content.trim() || !prompt.trim()) {
      showToast.error("Please provide content and a custom prompt", { section: 'meeting_manager' });
      return;
    }

    setIsProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('enhance-meeting-minutes', {
        body: {
          originalContent: content,
          enhancementType: 'custom',
          specificRequest: prompt,
          context: `Meeting ID: ${meetingId}`
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      onContentChange(data.enhancedContent);
      showToast.success("Applied custom AI enhancement", { section: 'meeting_manager' });
      setShowCustomAIModal(false);
    } catch (error) {
      console.error('Custom enhancement error:', error);
      showToast.error(error instanceof Error ? error.message : 'Custom enhancement failed', { section: 'meeting_manager' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Find and Replace functionality
  const handleFindReplaceSubmit = (findText: string, replaceText: string, options: { caseSensitive: boolean; wholeWords: boolean; }) => {
    if (!findText) {
      showToast.error("Please enter text to find", { section: 'meeting_manager' });
      return;
    }

    try {
      let flags = 'g';
      if (!options.caseSensitive) flags += 'i';
      
      let pattern = findText;
      if (options.wholeWords) {
        pattern = `\\b${findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`;
      } else {
        pattern = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      
      const regex = new RegExp(pattern, flags);
      const newContent = content.replace(regex, replaceText);
      
      const matchCount = (content.match(regex) || []).length;
      
      if (matchCount > 0) {
        onContentChange(newContent);
        showToast.success(`Replaced ${matchCount} occurrence${matchCount > 1 ? 's' : ''}`, { section: 'meeting_manager' });
        setShowFindReplaceModal(false);
      } else {
        showToast.info("No matches found", { section: 'meeting_manager' });
      }
    } catch (error) {
      console.error('Find and replace failed:', error);
      showToast.error("Find and replace operation failed", { section: 'meeting_manager' });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full bg-background/80 backdrop-blur-sm border-border/50 hover:bg-accent/80"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Quick Pick
                <ChevronDown className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          className="w-64 bg-background/95 backdrop-blur-sm border-border/50 shadow-lg"
          align="start"
        >
          {/* Copy */}
          <DropdownMenuItem onClick={handleCopy} className="cursor-pointer">
            <Copy className="h-4 w-4 mr-2" />
            Copy Content
          </DropdownMenuItem>

          {/* Regenerate */}
          <DropdownMenuItem onClick={handleRegenerate} className="cursor-pointer">
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate
          </DropdownMenuItem>

          {/* Download Options */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <Download className="h-4 w-4 mr-2" />
              Download
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-background/95 backdrop-blur-sm border-border/50">
              <DropdownMenuItem onClick={handleDownloadWord} className="cursor-pointer">
                <FileText className="h-4 w-4 mr-2" />
                Word Document
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadPDF} className="cursor-pointer">
                <FileType className="h-4 w-4 mr-2" />
                PDF Document
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadText} className="cursor-pointer">
                <FileText className="h-4 w-4 mr-2" />
                Text File
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Edit Options */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <Edit3 className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-background/95 backdrop-blur-sm border-border/50">
              {/* Format & Style */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <Type className="h-4 w-4 mr-2" />
                  Format & Style
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="bg-background/95 backdrop-blur-sm border-border/50">
                  <DropdownMenuItem onClick={() => handleQuickPickAction('uppercase')} className="cursor-pointer">
                    UPPERCASE
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleQuickPickAction('lowercase')} className="cursor-pointer">
                    lowercase
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleQuickPickAction('title-case')} className="cursor-pointer">
                    Title Case
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleQuickPickAction('sentence-case')} className="cursor-pointer">
                    Sentence case
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleQuickPickAction('remove-extra-spaces')} className="cursor-pointer">
                    Remove Extra Spaces
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleQuickPickAction('add-bullet-points')} className="cursor-pointer">
                    Add Bullet Points
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleQuickPickAction('add-numbers')} className="cursor-pointer">
                    Add Numbers
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleQuickPickAction('remove-bullets')} className="cursor-pointer">
                    Remove Bullets
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleQuickPickAction('remove-numbers')} className="cursor-pointer">
                    Remove Numbers
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Find & Replace */}
              <DropdownMenuItem onClick={() => setShowFindReplaceModal(true)} className="cursor-pointer">
                <Search className="h-4 w-4 mr-2" />
                Find & Replace
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* AI Enhance */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <Sparkles className="h-4 w-4 mr-2" />
              AI Enhance
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-background/95 backdrop-blur-sm border-border/50">
              {/* Custom Enhancement */}
              <DropdownMenuItem onClick={() => setShowCustomAIModal(true)} className="cursor-pointer">
                <Wand2 className="h-4 w-4 mr-2" />
                Custom Enhancement
              </DropdownMenuItem>

              {/* Quick AI Actions */}
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => handleAIEnhancement('clinical-focus')} className="cursor-pointer">
                  <Zap className="h-4 w-4 mr-2" />
                  Clinical Focus
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAIEnhancement('action-analysis')} className="cursor-pointer">
                  <Zap className="h-4 w-4 mr-2" />
                  Action Analysis
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAIEnhancement('professional-tone')} className="cursor-pointer">
                  <Zap className="h-4 w-4 mr-2" />
                  Professional Tone
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAIEnhancement('risk-assessment')} className="cursor-pointer">
                  <Zap className="h-4 w-4 mr-2" />
                  Risk Assessment
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAIEnhancement('follow-up-plans')} className="cursor-pointer">
                  <Zap className="h-4 w-4 mr-2" />
                  Follow-up Plans
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAIEnhancement('patient-safety')} className="cursor-pointer">
                  <Zap className="h-4 w-4 mr-2" />
                  Patient Safety
                </DropdownMenuItem>
              </DropdownMenuGroup>

              {/* Clinical Quick Actions */}
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => handleQuickPickAction('clinical-summary')} className="cursor-pointer">
                  <FileText className="h-4 w-4 mr-2" />
                  Add Clinical Summary
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleQuickPickAction('action-items')} className="cursor-pointer">
                  <FileText className="h-4 w-4 mr-2" />
                  Extract Action Items
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleQuickPickAction('patient-care-focus')} className="cursor-pointer">
                  <FileText className="h-4 w-4 mr-2" />
                  Patient Care Focus
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Custom AI Prompt Modal */}
      <CustomAIPromptModal
        open={showCustomAIModal}
        onOpenChange={setShowCustomAIModal}
        onSubmit={handleCustomAISubmit}
        currentText={content}
      />

      {/* Find & Replace Modal */}
      <CustomFindReplaceModal
        open={showFindReplaceModal}
        onOpenChange={setShowFindReplaceModal}
        onSubmit={handleFindReplaceSubmit}
        currentText={content}
      />
    </>
  );
}