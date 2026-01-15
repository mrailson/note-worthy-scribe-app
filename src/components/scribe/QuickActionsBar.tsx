import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Copy, 
  FileText, 
  FilePlus, 
  Save, 
  Download,
  RotateCcw,
  RefreshCw,
  Loader2,
  Check,
  Trash2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";

interface QuickActionsBarProps {
  emrFormat: 'emis' | 'systmone';
  onCopyAll: () => void;
  onSave: () => void;
  onNewConsultation: () => void;
  onDiscard?: () => void;
  onRegenerate?: () => void;
  onExportPDF?: () => void;
  onExportWord?: () => void;
  onGeneratePatientLetter?: () => void;
  disabled?: boolean;
  isSaving?: boolean;
  isSaved?: boolean;
  wordCount?: number;
}

export const QuickActionsBar = ({
  emrFormat,
  onCopyAll,
  onSave,
  onNewConsultation,
  onDiscard,
  onRegenerate,
  onExportPDF,
  onExportWord,
  onGeneratePatientLetter,
  disabled = false,
  isSaving = false,
  isSaved = false,
  wordCount = 0
}: QuickActionsBarProps) => {
  const isMobile = useIsMobile();
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  
  const emrLabel = emrFormat === 'emis' ? 'EMIS' : 'SystmOne';

  const handleDiscardClick = () => {
    if (wordCount > 100) {
      setShowDiscardConfirm(true);
    } else if (onDiscard) {
      onDiscard();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    if (onDiscard) {
      onDiscard();
    }
  };

  return (
    <>
      <div className={`
        flex items-center gap-2 flex-wrap
        ${isMobile ? 'justify-center' : 'justify-end'}
      `}>
        {/* New Consultation */}
        <Button
          variant="ghost"
          onClick={onNewConsultation}
          disabled={disabled}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          {!isMobile && 'New Consultation'}
        </Button>

        {/* Discard */}
        {onDiscard && (
          <Button
            variant="ghost"
            onClick={handleDiscardClick}
            disabled={disabled}
            className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            {!isMobile && 'Discard'}
          </Button>
        )}
      </div>

      {/* Discard Confirmation Dialog */}
      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard consultation?</AlertDialogTitle>
            <AlertDialogDescription>
              You have {wordCount} words in this transcript. Are you sure you want to discard this consultation? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDiscard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
