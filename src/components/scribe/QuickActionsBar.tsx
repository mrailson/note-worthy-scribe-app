import { Button } from "@/components/ui/button";
import { 
  Copy, 
  FileText, 
  FilePlus, 
  Save, 
  Download,
  RotateCcw
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";

interface QuickActionsBarProps {
  emrFormat: 'emis' | 'systmone';
  onCopyAll: () => void;
  onSave: () => void;
  onNewConsultation: () => void;
  onExportPDF?: () => void;
  onExportWord?: () => void;
  onGeneratePatientLetter?: () => void;
  disabled?: boolean;
}

export const QuickActionsBar = ({
  emrFormat,
  onCopyAll,
  onSave,
  onNewConsultation,
  onExportPDF,
  onExportWord,
  onGeneratePatientLetter,
  disabled = false
}: QuickActionsBarProps) => {
  const isMobile = useIsMobile();
  
  const emrLabel = emrFormat === 'emis' ? 'EMIS' : 'SystmOne';

  return (
    <div className={`
      flex items-center gap-2 flex-wrap
      ${isMobile ? 'justify-center' : 'justify-end'}
    `}>
      {/* Primary Actions */}
      <Button
        onClick={onCopyAll}
        disabled={disabled}
        className="gap-2 bg-primary hover:bg-primary/90"
      >
        <Copy className="h-4 w-4" />
        Copy for {emrLabel}
      </Button>

      <Button
        variant="outline"
        onClick={onSave}
        disabled={disabled}
        className="gap-2"
      >
        <Save className="h-4 w-4" />
        {isMobile ? 'Save' : 'Save Consultation'}
      </Button>

      {/* Export Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={disabled} className="gap-2">
            <Download className="h-4 w-4" />
            {!isMobile && 'Export'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onExportPDF && (
            <DropdownMenuItem onClick={onExportPDF}>
              <FileText className="h-4 w-4 mr-2" />
              Export as PDF
            </DropdownMenuItem>
          )}
          {onExportWord && (
            <DropdownMenuItem onClick={onExportWord}>
              <FileText className="h-4 w-4 mr-2" />
              Export as Word
            </DropdownMenuItem>
          )}
          {onGeneratePatientLetter && (
            <DropdownMenuItem onClick={onGeneratePatientLetter}>
              <FilePlus className="h-4 w-4 mr-2" />
              Generate Patient Letter
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

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
    </div>
  );
};
