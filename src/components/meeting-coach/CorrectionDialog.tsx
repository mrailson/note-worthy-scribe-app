import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { CorrectionRule, countMatches } from '@/utils/meetingCoachCorrections';
import { Tag, MapPin, Type, FileText, User, AlertTriangle } from 'lucide-react';

interface CorrectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (correction: CorrectionRule) => void;
  prefilledText?: string;
  insightText?: string;
}

const ERROR_TYPES = [
  { value: 'name', label: 'Wrong Name', icon: Tag },
  { value: 'place', label: 'Wrong Place Name', icon: MapPin },
  { value: 'acronym', label: 'Wrong Acronym', icon: Type },
  { value: 'details', label: 'Wrong Details', icon: FileText },
  { value: 'assignee', label: 'Wrong Assigned Person', icon: User },
  { value: 'other', label: 'Something Else', icon: AlertTriangle },
] as const;

export function CorrectionDialog({
  isOpen,
  onClose,
  onSave,
  prefilledText = '',
  insightText = ''
}: CorrectionDialogProps) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [errorType, setErrorType] = useState<CorrectionRule['type']>('name');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wordBoundary, setWordBoundary] = useState(true);
  const [matchCount, setMatchCount] = useState(0);

  useEffect(() => {
    if (prefilledText) {
      setFind(prefilledText);
    }
  }, [prefilledText]);

  useEffect(() => {
    if (find && insightText) {
      const rule: CorrectionRule = {
        id: '',
        find,
        replace: replace || find,
        type: errorType,
        caseInsensitive: !caseSensitive,
        wordBoundary,
        timestamp: new Date().toISOString()
      };
      setMatchCount(countMatches(insightText, rule));
    } else {
      setMatchCount(0);
    }
  }, [find, replace, caseSensitive, wordBoundary, insightText, errorType]);

  const handleSave = () => {
    if (!find.trim() || !replace.trim()) {
      return;
    }

    const correction: CorrectionRule = {
      id: `correction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      find: find.trim(),
      replace: replace.trim(),
      type: errorType,
      caseInsensitive: !caseSensitive,
      wordBoundary,
      timestamp: new Date().toISOString()
    };

    onSave(correction);
    handleClose();
  };

  const handleClose = () => {
    setFind('');
    setReplace('');
    setErrorType('name');
    setCaseSensitive(false);
    setWordBoundary(true);
    setMatchCount(0);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Quick Correction</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Error Type */}
          <div className="space-y-3">
            <Label>Error Type</Label>
            <RadioGroup value={errorType} onValueChange={(value) => setErrorType(value as CorrectionRule['type'])}>
              <div className="grid grid-cols-2 gap-3">
                {ERROR_TYPES.map(({ value, label, icon: Icon }) => (
                  <div key={value} className="flex items-center space-x-2">
                    <RadioGroupItem value={value} id={value} />
                    <Label 
                      htmlFor={value} 
                      className="flex items-center gap-2 cursor-pointer font-normal"
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Find Field */}
          <div className="space-y-2">
            <Label htmlFor="find">Find (incorrect text)</Label>
            <Input
              id="find"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="e.g., Bricksworth"
              autoFocus
            />
          </div>

          {/* Replace Field */}
          <div className="space-y-2">
            <Label htmlFor="replace">Replace with (correct text)</Label>
            <Input
              id="replace"
              value={replace}
              onChange={(e) => setReplace(e.target.value)}
              placeholder="e.g., Brixworth"
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <Label>Options</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="case-sensitive"
                  checked={caseSensitive}
                  onCheckedChange={(checked) => setCaseSensitive(checked as boolean)}
                />
                <Label htmlFor="case-sensitive" className="font-normal cursor-pointer">
                  Case sensitive matching
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="word-boundary"
                  checked={wordBoundary}
                  onCheckedChange={(checked) => setWordBoundary(checked as boolean)}
                />
                <Label htmlFor="word-boundary" className="font-normal cursor-pointer">
                  Match whole words only
                </Label>
              </div>
            </div>
          </div>

          {/* Preview */}
          {matchCount > 0 && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="text-muted-foreground">
                This correction will apply to <span className="font-semibold text-foreground">{matchCount}</span> {matchCount === 1 ? 'instance' : 'instances'} in the current insights.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!find.trim() || !replace.trim()}
          >
            Save Correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
