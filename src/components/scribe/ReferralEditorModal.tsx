import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Edit, Save, Copy, Download, Sparkles, ChevronDown, Check, AlertCircle, Loader2 } from "lucide-react";
import { ReferralDraft, ReferralPriority, PRIORITY_LABELS, PRIORITY_COLOURS } from "@/types/referral";
import { useToast } from "@/hooks/use-toast";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

interface ReferralEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  draft: ReferralDraft;
  onContentChange: (content: string) => void;
  onToneRewrite: (tone: 'friendly' | 'concise' | 'add-availability' | 'formal') => void;
  onSafetyNettingChange: (given: boolean) => void;
  onConfirm: () => void;
  onUnconfirm: () => void;
  isRewriting: boolean;
}

const TONE_OPTIONS = [
  { value: 'friendly', label: 'Make Friendlier', description: 'Warmer, more approachable tone' },
  { value: 'concise', label: 'Make More Concise', description: 'Shorter, more direct' },
  { value: 'add-availability', label: 'Add Patient Availability', description: 'Include scheduling preferences' },
  { value: 'formal', label: 'Make More Formal', description: 'Professional NHS style' },
] as const;

export const ReferralEditorModal: React.FC<ReferralEditorModalProps> = ({
  isOpen,
  onClose,
  draft,
  onContentChange,
  onToneRewrite,
  onSafetyNettingChange,
  onConfirm,
  onUnconfirm,
  isRewriting,
}) => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(draft.letterContent);
  const [clinicallyAppropriate, setClinicallyAppropriate] = useState(false);
  const [factsAccurate, setFactsAccurate] = useState(false);

  // Render letter content with missing fields highlighted in yellow
  const renderLetterWithHighlights = (content: string) => {
    // Match [[MISSING: ...]] or [MISSING: ...] or common placeholder patterns
    const missingPattern = /\[\[MISSING:\s*([^\]]+)\]\]|\[MISSING:\s*([^\]]+)\]|\[([^\]]*(?:please update|Patient Name|Date of Birth|NHS Number|Practice|Phone|Email|GMC|Name|Address|DOB)[^\]]*)\]/gi;
    
    const parts = content.split(missingPattern);
    
    return parts.map((part, index) => {
      if (part === undefined || part === '') return null;
      
      // Check if this part matches a missing field pattern
      const isMissingField = missingPattern.test(`[[MISSING: ${part}]]`) || 
                            missingPattern.test(`[${part}]`) ||
                            /please update|Patient Name|Date of Birth|NHS Number|GMC|MISSING/i.test(part);
      
      // Reset the regex lastIndex
      missingPattern.lastIndex = 0;
      
      if (isMissingField && part.trim()) {
        return (
          <span 
            key={index} 
            className="bg-yellow-200 text-yellow-900 px-1 rounded font-medium"
            title="Missing information - please complete"
          >
            [{part.replace(/MISSING:\s*/i, '')}]
          </span>
        );
      }
      
      return <span key={index}>{part}</span>;
    });
  };

  const handleSaveEdit = () => {
    onContentChange(editedContent);
    setIsEditing(false);
    toast({ title: "Letter updated", description: "Your changes have been saved." });
  };

  const handleCancelEdit = () => {
    setEditedContent(draft.letterContent);
    setIsEditing(false);
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(draft.letterContent);
      toast({ title: "Copied", description: "Letter copied to clipboard." });
    } catch (error) {
      toast({ variant: "destructive", title: "Copy failed", description: "Could not copy to clipboard." });
    }
  };

  const handleDownloadDocx = async () => {
    try {
      const paragraphs = draft.letterContent.split('\n\n').map(para => {
        if (para.startsWith('**') && para.endsWith('**')) {
          return new Paragraph({
            children: [new TextRun({ text: para.replace(/\*\*/g, ''), bold: true })],
            spacing: { after: 200 },
          });
        }
        return new Paragraph({
          children: [new TextRun({ text: para })],
          spacing: { after: 200 },
        });
      });

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: `Referral Letter - ${draft.recipientService}`,
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 400 },
            }),
            ...paragraphs,
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `referral-${draft.specialty}-${new Date().toISOString().split('T')[0]}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({ title: "Downloaded", description: "Referral letter downloaded as DOCX." });
    } catch (error) {
      console.error('Error generating DOCX:', error);
      toast({ variant: "destructive", title: "Download failed", description: "Could not generate document." });
    }
  };

  const handleConfirm = () => {
    if (!clinicallyAppropriate || !factsAccurate) {
      toast({ 
        variant: "destructive", 
        title: "Confirmation required", 
        description: "Please confirm both checkboxes before confirming the referral." 
      });
      return;
    }
    onConfirm();
    toast({ title: "Referral confirmed", description: "The referral letter has been confirmed." });
  };

  const priorityLabel = PRIORITY_LABELS[draft.urgency as ReferralPriority] || draft.urgency;
  const priorityColour = PRIORITY_COLOURS[draft.urgency as ReferralPriority] || 'bg-muted text-muted-foreground';

  // Sync edited content when draft changes
  React.useEffect(() => {
    setEditedContent(draft.letterContent);
  }, [draft.letterContent]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-full max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-semibold">
                Referral to {draft.recipientService}
              </DialogTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{draft.specialty}</span>
                <span>•</span>
                <Badge className={priorityColour}>{priorityLabel}</Badge>
                {draft.toneVersion !== 'neutral' && (
                  <>
                    <span>•</span>
                    <Badge variant="outline" className="text-xs">
                      Tone: {draft.toneVersion}
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Content - scrollable area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-6">
            <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
              {isEditing ? (
                <div className="p-4 space-y-3">
                  <Label htmlFor="edit-letter" className="text-sm font-medium">
                    Edit Letter Content
                  </Label>
                  <Textarea
                    id="edit-letter"
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="min-h-[500px] font-mono text-sm leading-relaxed resize-none"
                    placeholder="Edit the referral letter..."
                  />
                </div>
              ) : (
                <div className="p-6 max-h-[50vh] overflow-y-auto">
                  {/* Formatted letter view with highlighted missing fields */}
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                      {renderLetterWithHighlights(draft.letterContent)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer - fixed at bottom */}
        <div className="border-t p-4 space-y-3 shrink-0 bg-background">
          {/* Safety netting */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="safety-netting"
              checked={draft.safetyNettingGiven}
              onCheckedChange={(checked) => onSafetyNettingChange(checked as boolean)}
            />
            <Label htmlFor="safety-netting" className="text-sm cursor-pointer">
              Safety-netting advice given to patient
            </Label>
          </div>

          {/* Confirmation checkboxes */}
          {!draft.clinicianConfirmed && (
            <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Clinician Confirmation Required
              </div>
              <div className="space-y-2 ml-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="clinically-appropriate"
                    checked={clinicallyAppropriate}
                    onCheckedChange={(checked) => setClinicallyAppropriate(checked as boolean)}
                  />
                  <Label htmlFor="clinically-appropriate" className="text-sm cursor-pointer">
                    I confirm this referral is clinically appropriate
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="facts-accurate"
                    checked={factsAccurate}
                    onCheckedChange={(checked) => setFactsAccurate(checked as boolean)}
                  />
                  <Label htmlFor="facts-accurate" className="text-sm cursor-pointer">
                    I confirm the clinical facts are accurate
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons - wrap on smaller screens */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {isEditing ? (
                <>
                  <Button size="sm" onClick={handleSaveEdit}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" disabled={isRewriting}>
                        {isRewriting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Tone
                        <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      {TONE_OPTIONS.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onClick={() => onToneRewrite(option.value)}
                          className="flex flex-col items-start py-2"
                        >
                          <span className="font-medium">{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleCopyToClipboard}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadDocx}>
                <Download className="h-4 w-4 mr-2" />
                DOCX
              </Button>
              {draft.clinicianConfirmed ? (
                <Button size="sm" variant="outline" onClick={onUnconfirm}>
                  <Check className="h-4 w-4 mr-2 text-green-600" />
                  Confirmed
                </Button>
              ) : (
                <Button 
                  size="sm"
                  onClick={handleConfirm}
                  disabled={!clinicallyAppropriate || !factsAccurate}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Confirm
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
