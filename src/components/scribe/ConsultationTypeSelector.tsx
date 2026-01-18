import { useState } from "react";
import { ConsultationType, ConsultationCategory, CONSULTATION_TYPE_LABELS, CONSULTATION_CATEGORY_LABELS, F2F_ACCOMPANIED_LABELS } from "@/types/scribe";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Phone, Video, Users, Stethoscope, Heart, HandHeart, ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";

interface ConsultationTypeSelectorProps {
  value: ConsultationType;
  category: ConsultationCategory;
  onChange: (type: ConsultationType) => void;
  onCategoryChange: (category: ConsultationCategory) => void;
  f2fAccompanied?: boolean;
  onF2fAccompaniedChange?: (accompanied: boolean) => void;
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
  f2fAccompanied = false,
  onF2fAccompaniedChange,
  disabled = false
}: ConsultationTypeSelectorProps) => {
  const isMobile = useIsMobile();
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Consultation Category - Collapsed by default */}
      <Collapsible open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
        <div className="text-center">
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              disabled={disabled}
            >
              Category: {CONSULTATION_CATEGORY_LABELS[category]}
              <ChevronDown className={`h-3 w-3 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="pt-2">
          <div className="space-y-2 text-center">
            <ToggleGroup 
              type="single" 
              value={category} 
              onValueChange={(v) => v && onCategoryChange(v as ConsultationCategory)}
              disabled={disabled}
              className={`justify-center flex-wrap ${isMobile ? 'gap-1.5' : ''}`}
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
        </CollapsibleContent>
      </Collapsible>

      {/* Consultation Type (Method) */}
      <div className="space-y-2 text-center">
        <label className="text-xs font-medium text-muted-foreground">
          Consultation Method
        </label>
        <ToggleGroup 
          type="single" 
          value={value} 
          onValueChange={(v) => v && onChange(v as ConsultationType)}
          disabled={disabled}
          className={`justify-center ${isMobile ? 'w-full' : ''}`}
        >
          {(Object.keys(CONSULTATION_TYPE_LABELS) as ConsultationType[]).map((type) => (
            <ToggleGroupItem
              key={type}
              value={type}
              aria-label={CONSULTATION_TYPE_LABELS[type]}
              className={`flex items-center gap-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground touch-manipulation ${isMobile ? 'flex-1 px-2 py-2.5 h-auto flex-col' : 'px-4 gap-2'}`}
              onClick={(e) => {
                // If clicking on F2F and it's already selected, toggle accompanied state
                if (type === 'f2f' && value === 'f2f' && onF2fAccompaniedChange) {
                  e.preventDefault();
                  onF2fAccompaniedChange(!f2fAccompanied);
                }
              }}
            >
              {typeIcons[type]}
              <span className={isMobile ? "text-xs" : "hidden sm:inline"}>
                {type === 'f2f' 
                  ? `${CONSULTATION_TYPE_LABELS[type]} (${f2fAccompanied ? F2F_ACCOMPANIED_LABELS.accompanied : F2F_ACCOMPANIED_LABELS.alone})`
                  : CONSULTATION_TYPE_LABELS[type]
                }
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
};