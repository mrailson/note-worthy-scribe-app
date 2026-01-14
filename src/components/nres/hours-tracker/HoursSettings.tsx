import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Settings, Pencil, Check, X } from 'lucide-react';

interface HoursSettingsProps {
  hourlyRate: number | null;
  hasRateSet: boolean;
  saving: boolean;
  onSaveRate: (rate: number) => Promise<void>;
}

export function HoursSettings({ hourlyRate, hasRateSet, saving, onSaveRate }: HoursSettingsProps) {
  const [isEditing, setIsEditing] = useState(!hasRateSet);
  const [rateInput, setRateInput] = useState(hourlyRate?.toString() || '');

  const handleSave = async () => {
    const rate = parseFloat(rateInput);
    if (isNaN(rate) || rate <= 0) return;
    
    await onSaveRate(rate);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setRateInput(hourlyRate?.toString() || '');
    setIsEditing(false);
  };

  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Settings className="w-4 h-4" />
          My Hourly Rate Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasRateSet || isEditing ? (
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-[200px]">
              <Label htmlFor="hourly-rate" className="text-xs text-muted-foreground">
                {hasRateSet ? 'Update hourly rate' : 'Set your hourly rate (persists for all entries)'}
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                <Input
                  id="hourly-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="75.00"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
            <Button 
              onClick={handleSave} 
              disabled={saving || !rateInput}
              size="sm"
            >
              <Check className="w-4 h-4 mr-1" />
              Save
            </Button>
            {hasRateSet && (
              <Button 
                variant="outline" 
                onClick={handleCancel}
                size="sm"
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-foreground">
              £{hourlyRate?.toFixed(2)}/hr
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsEditing(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="w-3 h-3 mr-1" />
              Edit
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
