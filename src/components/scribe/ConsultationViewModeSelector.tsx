import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutList, Monitor, ClipboardList, Heart } from "lucide-react";
import { SystmOneIcon } from "@/components/icons/SystmOneIcon";

export type ViewMode = 'soap' | 'narrativeClinical' | 'systmone' | 'emis' | 'ageingWell';

interface ConsultationViewModeSelectorProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

interface ViewModeConfig {
  value: ViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string }> | null;
  customIcon?: boolean;
  description: string;
}

const viewModes: ViewModeConfig[] = [
  { value: 'soap', label: 'SOAP', icon: LayoutList, description: 'S/O/A/P sections' },
  { value: 'narrativeClinical', label: 'Clinical', icon: ClipboardList, description: 'H/E/A/I/P layout' },
  { value: 'systmone', label: 'SystmOne', icon: null, customIcon: true, description: 'Auto-optimised for TPP' },
  { value: 'emis', label: 'EMIS', icon: Monitor, description: 'EMIS-optimised' },
  { value: 'ageingWell', label: 'Ageing Well', icon: Heart, description: 'MDT Review' },
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
            {mode.customIcon ? (
              <SystmOneIcon size="sm" />
            ) : mode.icon ? (
              <mode.icon className="h-3.5 w-3.5" />
            ) : null}
            <span className="text-xs font-medium">{mode.label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
};
