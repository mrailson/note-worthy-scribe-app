import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Edit, Save, Copy, Download, Sparkles, ChevronDown, Check, Loader2 } from "lucide-react";
import { ReferralDraft, ReferralPriority, PRIORITY_LABELS, PRIORITY_COLOURS } from "@/types/referral";
import { useToast } from "@/hooks/use-toast";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

interface PracticeDetails {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  signature?: string;
}

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
  practiceDetails?: PracticeDetails;
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
  practiceDetails,
}) => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(draft.letterContent);
  const [confirmed, setConfirmed] = useState(false);

  // Render letter content with missing fields highlighted in yellow - ONLY square brackets
  const renderLetterWithHighlights = (content: string) => {
    // Remove markdown ** formatting
    const cleanedContent = content.replace(/\*\*/g, '');
    
    // Only match [text] patterns (square brackets with content)
    const parts: React.ReactNode[] = [];
    const regex = /\[([^\]]+)\]/g;
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(cleanedContent)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{cleanedContent.slice(lastIndex, match.index)}</span>);
      }
      
      // Add the highlighted bracket content
      parts.push(
        <span 
          key={`missing-${match.index}`} 
          className="bg-yellow-200 text-yellow-900 px-1 rounded font-medium"
          title="Missing information - please complete"
        >
          [{match[1]}]
        </span>
      );
      
      lastIndex = regex.lastIndex;
    }
    
    // Add remaining text
    if (lastIndex < cleanedContent.length) {
      parts.push(<span key={`text-${lastIndex}`}>{cleanedContent.slice(lastIndex)}</span>);
    }
    
    return parts.length > 0 ? parts : cleanedContent;
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
    if (!confirmed) {
      toast({ 
        variant: "destructive", 
        title: "Confirmation required", 
        description: "Please confirm the checkbox before confirming the referral." 
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
                  {/* Letterhead */}
                  <div className="flex items-start justify-between mb-6 pb-4 border-b">
                    {/* Practice logo on left */}
                    <div className="flex-shrink-0">
                      {practiceDetails?.logoUrl ? (
                        <img 
                          src={practiceDetails.logoUrl} 
                          alt={practiceDetails?.name || "Practice Logo"} 
                          className="h-16 w-auto max-w-[200px] object-contain"
                        />
                      ) : (
                        <div className="h-16 w-32 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                          No Logo
                        </div>
                      )}
                    </div>
                    
                    {/* Practice details on right */}
                    <div className="text-right text-sm text-muted-foreground">
                      {practiceDetails?.name && (
                        <p className="font-semibold text-foreground">{practiceDetails.name}</p>
                      )}
                      {practiceDetails?.address && (
                        <p className="whitespace-pre-line">{practiceDetails.address}</p>
                      )}
                      {practiceDetails?.phone && (
                        <p>Tel: {practiceDetails.phone}</p>
                      )}
                      {practiceDetails?.email && (
                        <p>Email: {practiceDetails.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Formatted letter view with highlighted missing fields */}
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                      {renderLetterWithHighlights(draft.letterContent)}
                    </div>
                  </div>

                  {/* Signature block */}
                  {practiceDetails?.signature && (
                    <div className="mt-8 pt-4 border-t">
                      <div 
                        className="text-sm text-foreground"
                        dangerouslySetInnerHTML={{ __html: practiceDetails.signature }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer - fixed at bottom */}
        <div className="border-t p-4 space-y-3 shrink-0 bg-background">
          {/* Combined confirmation checkbox */}
          {!draft.clinicianConfirmed && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="clinician-confirmation"
                checked={confirmed}
                onCheckedChange={(checked) => {
                  setConfirmed(checked as boolean);
                  onSafetyNettingChange(checked as boolean);
                }}
              />
              <Label htmlFor="clinician-confirmation" className="text-sm cursor-pointer">
                I confirm this referral is clinically appropriate, the clinical facts are accurate, and safety-netting advice has been given
              </Label>
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
                  disabled={!confirmed}
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
