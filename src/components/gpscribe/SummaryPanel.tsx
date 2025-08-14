import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EditStates, EditContent, ExpandDialog } from "@/types/gpscribe";
import { Brain, Copy, Download, Edit, Check, X, Maximize2, Mail } from "lucide-react";
import { toast } from "sonner";

interface SummaryPanelProps {
  transcript: string;
  isGenerating: boolean;
  gpSummary: string;
  fullNote: string;
  patientCopy: string;
  traineeFeedback: string;
  referralLetter: string;
  editStates: EditStates;
  editContent: EditContent;
  expandDialog: ExpandDialog;
  onGenerateSummary: () => void;
  onGenerateReferralLetter: () => void;
  onStartEdit: (field: keyof EditStates) => void;
  onCancelEdit: (field: keyof EditStates) => void;
  onSaveEdit: (field: keyof EditStates) => void;
  onEditContentChange: (field: keyof EditContent, value: string) => void;
  onExportPDF: (content: string, title: string) => void;
  onExportWord: (content: string, title: string) => void;
  onExpandContent: (title: string, content: string) => void;
  onCloseExpandDialog: () => void;
}

export const SummaryPanel = ({
  transcript,
  isGenerating,
  gpSummary,
  fullNote,
  patientCopy,
  traineeFeedback,
  referralLetter,
  editStates,
  editContent,
  expandDialog,
  onGenerateSummary,
  onGenerateReferralLetter,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditContentChange,
  onExportPDF,
  onExportWord,
  onExpandContent,
  onCloseExpandDialog
}: SummaryPanelProps) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const renderContentSection = (
    title: string,
    content: string,
    field: keyof EditStates,
    showEmailButton = false
  ) => {
    const isEditing = editStates[field];
    
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{title}</CardTitle>
            {content && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => copyToClipboard(content)}
                  variant="outline"
                  size="sm"
                  className="touch-manipulation min-h-[44px]"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => onStartEdit(field)}
                  variant="outline"
                  size="sm"
                  disabled={isEditing}
                  className="touch-manipulation min-h-[44px]"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => onExpandContent(title, content)}
                  variant="outline"
                  size="sm"
                  className="touch-manipulation min-h-[44px]"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => onExportPDF(content, title)}
                  variant="outline"
                  size="sm"
                  className="touch-manipulation min-h-[44px]"
                >
                  <Download className="h-4 w-4" />
                </Button>
                {showEmailButton && (
                  <Button
                    onClick={() => onExportWord(content, title)}
                    variant="outline"
                    size="sm"
                    className="touch-manipulation min-h-[44px]"
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={editContent[field]}
                onChange={(e) => onEditContentChange(field, e.target.value)}
                className="min-h-[200px] resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => onCancelEdit(field)}
                  variant="outline"
                  size="sm"
                  className="touch-manipulation min-h-[44px]"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={() => onSaveEdit(field)}
                  size="sm"
                  className="bg-gradient-primary hover:bg-primary-hover touch-manipulation min-h-[44px]"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <Textarea
              value={content}
              readOnly
              className="min-h-[200px] resize-none"
              placeholder={`No ${title.toLowerCase()} generated yet.`}
            />
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Generate Summary Button */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button
          onClick={onGenerateSummary}
          disabled={!transcript.trim() || isGenerating}
          className="bg-gradient-primary hover:bg-primary-hover touch-manipulation min-h-[44px] text-base font-medium px-6"
          size="lg"
        >
          <Brain className="h-4 w-4 mr-2" />
          {isGenerating ? 'Generating...' : 'Generate Notes'}
        </Button>
        
        <Button
          onClick={onGenerateReferralLetter}
          disabled={!transcript.trim() || isGenerating}
          variant="outline"
          className="touch-manipulation min-h-[44px]"
          size="lg"
        >
          <Mail className="h-4 w-4 mr-2" />
          Generate Referral Letter
        </Button>
      </div>

      {/* Generated Content Sections */}
      {gpSummary && renderContentSection("GP Summary", gpSummary, "gpSummary")}
      {fullNote && renderContentSection("Full Clinical Note", fullNote, "fullNote")}
      {patientCopy && renderContentSection("Patient Copy", patientCopy, "patientCopy")}
      {traineeFeedback && renderContentSection("Trainee Feedback", traineeFeedback, "traineeFeedback")}
      {referralLetter && renderContentSection("Referral Letter", referralLetter, "referralLetter", true)}

      {/* Expand Dialog */}
      <Dialog open={expandDialog.isOpen} onOpenChange={onCloseExpandDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{expandDialog.title}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <Textarea
              value={expandDialog.content}
              readOnly
              className="min-h-[400px] resize-none text-sm"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};