import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Slider } from "@/components/ui/slider";
import { Settings2, ChevronDown, FileText, List, Zap, Loader2 } from "lucide-react";
import { OUTPUT_LEVELS } from "@/constants/consultationSettings";
import { ConsultationViewMode } from "@/types/scribe";

interface ConsultationViewControlsProps {
  viewMode: ConsultationViewMode;
  detailLevel: number;
  isRegenerating: boolean;
  onViewModeChange: (mode: ConsultationViewMode) => void;
  onDetailLevelChange: (level: number) => void;
}

export const ConsultationViewControls = ({
  viewMode,
  detailLevel,
  isRegenerating,
  onViewModeChange,
  onDetailLevelChange,
}: ConsultationViewControlsProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const currentLevel = OUTPUT_LEVELS.find(level => level.value === detailLevel) || OUTPUT_LEVELS[2];
  
  const viewModeLabels: Record<ConsultationViewMode, string> = {
    soap: 'SOAP',
    narrative: 'Narrative',
    summary: 'Summary'
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between px-4 py-3 h-auto bg-muted/30 hover:bg-muted/50 border rounded-lg"
        >
          <div className="flex items-center gap-3">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              Display: {viewModeLabels[viewMode]} · {currentLevel.label}
            </span>
            {isRegenerating && (
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="pt-3 space-y-4">
        <div className="p-4 rounded-lg border bg-background space-y-5">
          {/* View Mode */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">View Mode</label>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => value && onViewModeChange(value as ConsultationViewMode)}
              className="justify-start"
            >
              <ToggleGroupItem value="soap" aria-label="SOAP format" className="gap-1.5 text-xs">
                <List className="h-3.5 w-3.5" />
                SOAP
              </ToggleGroupItem>
              <ToggleGroupItem value="narrative" aria-label="Narrative format" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />
                Narrative
              </ToggleGroupItem>
              <ToggleGroupItem value="summary" aria-label="Summary format" className="gap-1.5 text-xs">
                <Zap className="h-3.5 w-3.5" />
                Summary
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Detail Level */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Detail Level</label>
              <span className="text-xs font-semibold text-primary flex items-center gap-2">
                {currentLevel.label}
                {isRegenerating && <Loader2 className="h-3 w-3 animate-spin" />}
              </span>
            </div>
            
            <Slider
              value={[detailLevel]}
              onValueChange={(vals) => onDetailLevelChange(vals[0])}
              min={1}
              max={5}
              step={1}
              className="w-full"
              disabled={isRegenerating}
            />
            
            <div className="flex justify-between text-[10px] text-muted-foreground">
              {OUTPUT_LEVELS.map((level) => (
                <span 
                  key={level.value} 
                  className={`${level.value === detailLevel ? 'text-primary font-medium' : ''}`}
                >
                  {level.label}
                </span>
              ))}
            </div>
            
            <p className="text-xs text-muted-foreground italic">
              {currentLevel.description}
            </p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
