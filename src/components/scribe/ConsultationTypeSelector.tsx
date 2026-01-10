import { ConsultationType, ConsultationCategory, CONSULTATION_TYPE_LABELS, CONSULTATION_CATEGORY_LABELS } from "@/types/scribe";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Phone, Video, Users, Stethoscope, Heart, HandHeart } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();

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
          className={`justify-start flex-wrap ${isMobile ? 'gap-1.5' : ''}`}
        >
          {(Object.keys(CONSULTATION_CATEGORY_LABELS) as ConsultationCategory[]).map((cat) => (
            <ToggleGroupItem
              key={cat}
              value={cat}
              aria-label={CONSULTATION_CATEGORY_LABELS[cat]}
              className={`flex items-center gap-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground touch-manipulation ${isMobile ? 'px-2.5 py-2.5 h-auto' : 'px-3 py-2 gap-2'}`}
            >
              {categoryIcons[cat]}
              <span className={isMobile ? "text-xs" : "text-xs sm:text-sm"}>{CONSULTATION_CATEGORY_LABELS[cat]}</span>
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
          className={`justify-start ${isMobile ? 'w-full' : ''}`}
        >
          {(Object.keys(CONSULTATION_TYPE_LABELS) as ConsultationType[]).map((type) => (
            <ToggleGroupItem
              key={type}
              value={type}
              aria-label={CONSULTATION_TYPE_LABELS[type]}
              className={`flex items-center gap-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground touch-manipulation ${isMobile ? 'flex-1 px-2 py-2.5 h-auto flex-col' : 'px-4 gap-2'}`}
            >
              {typeIcons[type]}
              <span className={isMobile ? "text-xs" : "hidden sm:inline"}>{CONSULTATION_TYPE_LABELS[type]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
};
