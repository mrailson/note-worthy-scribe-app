import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, Armchair } from 'lucide-react';

export type BPMode = 'standard' | 'sit-stand';

interface BPModeSelectorProps {
  mode: BPMode;
  onModeChange: (mode: BPMode) => void;
  disabled?: boolean;
}

export const BPModeSelector = ({ mode, onModeChange, disabled }: BPModeSelectorProps) => {
  return (
    <Card className="border-dashed">
      <CardContent className="py-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Label className="text-base font-semibold text-foreground">Mode:</Label>
          <RadioGroup
            value={mode}
            onValueChange={(value) => onModeChange(value as BPMode)}
            className="flex flex-col sm:flex-row gap-4 sm:gap-8"
            disabled={disabled}
          >
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="standard" id="standard" className="h-5 w-5" />
              <Label 
                htmlFor="standard" 
                className="flex items-center gap-2 cursor-pointer font-medium text-base"
              >
                <Activity className="h-5 w-5 text-blue-500" />
                Standard Home BP
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="sit-stand" id="sit-stand" className="h-5 w-5" />
              <Label 
                htmlFor="sit-stand" 
                className="flex items-center gap-2 cursor-pointer font-medium text-base"
              >
                <Armchair className="h-5 w-5 text-purple-500" />
                Sit/Stand Assessment
              </Label>
            </div>
          </RadioGroup>
        </div>
        {mode === 'sit-stand' && (
          <p className="text-sm text-muted-foreground mt-3 sm:ml-16">
            Postural BP assessment – will detect and separate sitting vs standing readings
          </p>
        )}
      </CardContent>
    </Card>
  );
};
