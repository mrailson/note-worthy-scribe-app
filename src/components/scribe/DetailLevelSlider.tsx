import { Slider } from "@/components/ui/slider";
import { OUTPUT_LEVELS } from "@/constants/consultationSettings";

interface DetailLevelSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export const DetailLevelSlider = ({ value, onChange }: DetailLevelSliderProps) => {
  const currentLevel = OUTPUT_LEVELS.find(level => level.value === value) || OUTPUT_LEVELS[2];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">Detail Level</label>
        <span className="text-xs font-semibold text-primary">{currentLevel.label}</span>
      </div>
      
      <Slider
        value={[value]}
        onValueChange={(vals) => onChange(vals[0])}
        min={1}
        max={5}
        step={1}
        className="w-full"
      />
      
      <div className="flex justify-between text-[10px] text-muted-foreground">
        {OUTPUT_LEVELS.map((level) => (
          <span 
            key={level.value} 
            className={`${level.value === value ? 'text-primary font-medium' : ''}`}
          >
            {level.label}
          </span>
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground italic">
        {currentLevel.description}
      </p>
    </div>
  );
};
