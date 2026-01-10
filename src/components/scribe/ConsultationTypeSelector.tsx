import { ConsultationType, CONSULTATION_TYPE_LABELS } from "@/types/scribe";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Phone, Video, Users } from "lucide-react";

interface ConsultationTypeSelectorProps {
  value: ConsultationType;
  onChange: (type: ConsultationType) => void;
  disabled?: boolean;
}

const typeIcons: Record<ConsultationType, React.ReactNode> = {
  f2f: <Users className="h-4 w-4" />,
  telephone: <Phone className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />
};

export const ConsultationTypeSelector = ({
  value,
  onChange,
  disabled = false
}: ConsultationTypeSelectorProps) => {
  return (
    <ToggleGroup 
      type="single" 
      value={value} 
      onValueChange={(v) => v && onChange(v as ConsultationType)}
      disabled={disabled}
      className="justify-start"
    >
      {(Object.keys(CONSULTATION_TYPE_LABELS) as ConsultationType[]).map((type) => (
        <ToggleGroupItem
          key={type}
          value={type}
          aria-label={CONSULTATION_TYPE_LABELS[type]}
          className="flex items-center gap-2 px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {typeIcons[type]}
          <span className="hidden sm:inline">{CONSULTATION_TYPE_LABELS[type]}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
};
