import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutList, Zap, ClipboardList } from "lucide-react";

export type ViewMode = 'soap' | 'narrativeClinical' | 'summary';

interface ConsultationViewModeSelectorProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

const viewModes = [
  { value: 'soap' as ViewMode, label: 'SOAP', icon: LayoutList, description: 'S/O/A/P sections' },
  { value: 'narrativeClinical' as ViewMode, label: 'Clinical', icon: ClipboardList, description: 'H/E/A/I/P layout' },
  { value: 'summary' as ViewMode, label: 'Summary', icon: Zap, description: 'Key points' },
];

export const ConsultationViewModeSelector = ({ value, onChange }: ConsultationViewModeSelectorProps) => {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">View Mode</label>
      <ToggleGroup 
        type="single" 
        value={value} 
        onValueChange={(val) => val && onChange(val as ViewMode)}
        className="justify-start"
      >
        {viewModes.map((mode) => (
          <ToggleGroupItem 
            key={mode.value} 
            value={mode.value}
            aria-label={mode.label}
            className="flex items-center gap-1.5 px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <mode.icon className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{mode.label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
};
