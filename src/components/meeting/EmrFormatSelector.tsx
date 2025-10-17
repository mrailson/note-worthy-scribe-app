import React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export type EmrFormat = 'emis' | 'systmone';

interface EmrFormatSelectorProps {
  selectedFormat: EmrFormat;
  onFormatChange: (format: EmrFormat) => void;
}

export const EmrFormatSelector: React.FC<EmrFormatSelectorProps> = ({
  selectedFormat,
  onFormatChange
}) => {
  return (
    <div className="flex items-center gap-3 p-2 border rounded-lg bg-background">
      <Label className="text-sm font-medium whitespace-nowrap">Copy Format:</Label>
      <RadioGroup
        value={selectedFormat}
        onValueChange={(value) => onFormatChange(value as EmrFormat)}
        className="flex gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="emis" id="emis" />
          <Label htmlFor="emis" className="text-sm cursor-pointer font-normal">
            EMIS Web
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="systmone" id="systmone" />
          <Label htmlFor="systmone" className="text-sm cursor-pointer font-normal">
            SystmOne
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
};
