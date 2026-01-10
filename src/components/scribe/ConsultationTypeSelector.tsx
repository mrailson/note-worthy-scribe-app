import { ConsultationType, ConsultationCategory, CONSULTATION_TYPE_LABELS, CONSULTATION_CATEGORY_LABELS } from "@/types/scribe";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Phone, Video, Users, Stethoscope, Heart, HandHeart } from "lucide-react";

interface ConsultationTypeSelectorProps {
  value: ConsultationType;
  category: ConsultationCategory;
  onChange: (type: ConsultationType) => void;
  onCategoryChange: (category: ConsultationCategory) => void;
  disabled?: boolean;
}

const typeIcons: Record<ConsultationType, React.ReactNode> = {
  f2f: <Users className="h-4 w-4" />,
  telephone: <Phone className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />
};

const categoryIcons: Record<ConsultationCategory, React.ReactNode> = {
  general: <Stethoscope className="h-4 w-4" />,
  agewell: <Heart className="h-4 w-4" />,
  social_prescriber: <HandHeart className="h-4 w-4" />
};

export const ConsultationTypeSelector = ({
  value,
  category,
  onChange,
  onCategoryChange,
  disabled = false
}: ConsultationTypeSelectorProps) => {
  return (
    <div className="space-y-4">
      {/* Consultation Category */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Consultation Category
        </label>
        <ToggleGroup 
          type="single" 
          value={category} 
          onValueChange={(v) => v && onCategoryChange(v as ConsultationCategory)}
          disabled={disabled}
          className="justify-start flex-wrap"
        >
          {(Object.keys(CONSULTATION_CATEGORY_LABELS) as ConsultationCategory[]).map((cat) => (
            <ToggleGroupItem
              key={cat}
              value={cat}
              aria-label={CONSULTATION_CATEGORY_LABELS[cat]}
              className="flex items-center gap-2 px-3 py-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {categoryIcons[cat]}
              <span className="text-xs sm:text-sm">{CONSULTATION_CATEGORY_LABELS[cat]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Consultation Type (Method) */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Consultation Method
        </label>
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
      </div>
    </div>
  );
};
