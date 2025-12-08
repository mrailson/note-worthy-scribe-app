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
      <CardContent className="py-6">
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium text-muted-foreground">Mode:</Label>
          <RadioGroup
            value={mode}
            onValueChange={(value) => onModeChange(value as BPMode)}
            className="flex gap-6"
            disabled={disabled}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="standard" id="standard" />
              <Label 
                htmlFor="standard" 
                className="flex items-center gap-2 cursor-pointer font-normal"
              >
                <Activity className="h-4 w-4 text-blue-500" />
                Standard Home BP
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="sit-stand" id="sit-stand" />
              <Label 
                htmlFor="sit-stand" 
                className="flex items-center gap-2 cursor-pointer font-normal"
              >
                <Armchair className="h-4 w-4 text-purple-500" />
                Sit/Stand Assessment
              </Label>
            </div>
          </RadioGroup>
        </div>
        {mode === 'sit-stand' && (
          <p className="text-xs text-muted-foreground mt-2 ml-12">
            Postural BP assessment - will detect and separate sitting vs standing readings
          </p>
        )}
      </CardContent>
    </Card>
  );
};
