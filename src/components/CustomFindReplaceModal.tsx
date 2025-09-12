import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Search, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

interface CustomFindReplaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (findText: string, replaceText: string, options: { caseSensitive: boolean; wholeWords: boolean }) => void;
  currentText: string;
}

export const CustomFindReplaceModal: React.FC<CustomFindReplaceModalProps> = ({
  open,
  onOpenChange,
  onSubmit,
  currentText
}) => {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWords, setWholeWords] = useState(false);

  const commonReplacements = [
    { find: 'GP', replace: 'General Practitioner' },
    { find: 'NHS', replace: 'National Health Service' },
    { find: 'COPD', replace: 'Chronic Obstructive Pulmonary Disease' },
    { find: 'BP', replace: 'Blood Pressure' },
    { find: 'ECG', replace: 'Electrocardiogram' },
    { find: 'A&E', replace: 'Accident & Emergency' },
    { find: 'CCG', replace: 'Clinical Commissioning Group' },
    { find: 'NICE', replace: 'National Institute for Health and Care Excellence' }
  ];

  const handleSubmit = () => {
    if (findText.trim()) {
      onSubmit(findText, replaceText, { caseSensitive, wholeWords });
      setFindText('');
      setReplaceText('');
      onOpenChange(false);
    }
  };

  const handleCommonReplacementClick = (find: string, replace: string) => {
    setFindText(find);
    setReplaceText(replace);
  };

  const textPreview = currentText.length > 150 
    ? currentText.substring(0, 150) + '...' 
    : currentText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Custom Find & Replace
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Current Text Preview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Current Content:</Label>
            <div className="p-3 bg-muted rounded-md border text-sm max-h-32 overflow-y-auto">
              {textPreview}
            </div>
          </div>

          <Separator />

          {/* Common Replacements */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Common NHS Replacements (click to use):</Label>
            <div className="grid grid-cols-2 gap-2">
              {commonReplacements.map((replacement, index) => (
                <Badge 
                  key={index}
                  variant="secondary" 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors p-2 justify-between"
                  onClick={() => handleCommonReplacementClick(replacement.find, replacement.replace)}
                >
                  <span className="font-semibold">{replacement.find}</span>
                  <ArrowRight className="h-3 w-3 mx-1" />
                  <span className="text-xs">{replacement.replace}</span>
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Find and Replace Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="find-text" className="text-sm font-medium">
                Find:
              </Label>
              <Input
                id="find-text"
                placeholder="Text to find..."
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="replace-text" className="text-sm font-medium">
                Replace with:
              </Label>
              <Input
                id="replace-text"
                placeholder="Replacement text..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
              />
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="case-sensitive"
                checked={caseSensitive}
                onCheckedChange={(checked) => setCaseSensitive(checked as boolean)}
              />
              <Label htmlFor="case-sensitive" className="text-sm">
                Case sensitive
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="whole-words"
                checked={wholeWords}
                onCheckedChange={(checked) => setWholeWords(checked as boolean)}
              />
              <Label htmlFor="whole-words" className="text-sm">
                Whole words only
              </Label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!findText.trim()}
              className="gap-2"
            >
              <Search className="h-4 w-4" />
              Replace All
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};