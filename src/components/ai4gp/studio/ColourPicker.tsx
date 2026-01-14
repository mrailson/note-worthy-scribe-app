import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ColourPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

// Common NHS and medical colours for quick selection
const QUICK_COLOURS = [
  '#005EB8', // NHS Blue
  '#003087', // NHS Dark Blue
  '#41B6E6', // NHS Light Blue
  '#78BE20', // NHS Green
  '#00A499', // NHS Teal
  '#006747', // NHS Dark Green
  '#FAE100', // NHS Yellow
  '#DA291C', // NHS Red
  '#7C2855', // NHS Purple
  '#AE2573', // NHS Pink
  '#330072', // NHS Dark Purple
  '#768692', // NHS Grey
  '#231F20', // NHS Black
  '#FFFFFF', // White
  '#F0F4F5', // NHS Pale Grey
];

export const ColourPicker: React.FC<ColourPickerProps> = ({
  label,
  value,
  onChange,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Validate hex colour
    if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
      onChange(newValue);
    }
  };

  const handleQuickSelect = (colour: string) => {
    setInputValue(colour);
    onChange(colour);
    setIsOpen(false);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm">{label}</Label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 w-full p-2 border rounded-md hover:bg-muted/50 transition-colors"
          >
            <div 
              className="w-6 h-6 rounded border shadow-inner flex-shrink-0"
              style={{ backgroundColor: value }}
            />
            <span className="text-sm font-mono text-muted-foreground">
              {value.toUpperCase()}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-3">
            {/* Native colour picker */}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={value}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  onChange(e.target.value);
                }}
                className="w-10 h-10 cursor-pointer rounded border-0 p-0"
              />
              <Input
                value={inputValue}
                onChange={handleInputChange}
                placeholder="#005EB8"
                className="font-mono text-sm"
              />
            </div>
            
            {/* Quick select colours */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">NHS Colours</p>
              <div className="grid grid-cols-5 gap-1.5">
                {QUICK_COLOURS.map((colour) => (
                  <button
                    key={colour}
                    type="button"
                    className={cn(
                      "w-8 h-8 rounded border-2 transition-all hover:scale-110",
                      value === colour ? "border-primary ring-2 ring-primary/30" : "border-transparent"
                    )}
                    style={{ backgroundColor: colour }}
                    onClick={() => handleQuickSelect(colour)}
                    title={colour}
                  />
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
