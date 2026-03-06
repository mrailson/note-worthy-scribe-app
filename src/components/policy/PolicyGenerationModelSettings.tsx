import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Sparkles, Zap, PoundSterling, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';

export type PolicyGenerationModel = 'claude-sonnet-4-6' | 'claude-haiku-4-5';
export type PolicyLength = 'compact' | 'concise' | 'standard' | 'full';

const MODEL_STORAGE_KEY = 'policy-generation-model';
const LENGTH_STORAGE_KEY = 'policy-generation-length';

export const getPolicyGenerationModel = (): PolicyGenerationModel => {
  const saved = localStorage.getItem(MODEL_STORAGE_KEY);
  if (saved === 'claude-haiku-4-5') return 'claude-haiku-4-5';
  return 'claude-sonnet-4-6';
};

export const getPolicyGenerationLength = (): PolicyLength => {
  const saved = localStorage.getItem(LENGTH_STORAGE_KEY);
  if (saved === 'compact' || saved === 'concise' || saved === 'standard') return saved;
  return 'full';
};

const LENGTH_OPTIONS: { value: PolicyLength; label: string; description: string; pages: string; time: string }[] = [
  { value: 'compact', label: 'Compact', description: 'Key essentials only — quick reference style', pages: '~8 pages', time: '~2 min' },
  { value: 'concise', label: 'Concise', description: 'Core requirements with essential detail', pages: '~13 pages', time: '~3 min' },
  { value: 'standard', label: 'Standard', description: 'Balanced coverage with good detail', pages: '~20 pages', time: '~6 min' },
  { value: 'full', label: 'Comprehensive', description: 'Full regulatory detail — CQC inspection-ready', pages: '~40 pages', time: '~10 min' },
];

export const PolicyGenerationModelSettings = () => {
  const [model, setModel] = useState<PolicyGenerationModel>('claude-sonnet-4-6');
  const [length, setLength] = useState<PolicyLength>('full');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setModel(getPolicyGenerationModel());
    setLength(getPolicyGenerationLength());
  }, []);

  const handleToggle = (useHaiku: boolean) => {
    const newModel: PolicyGenerationModel = useHaiku ? 'claude-haiku-4-5' : 'claude-sonnet-4-6';
    setModel(newModel);
    localStorage.setItem(MODEL_STORAGE_KEY, newModel);
  };

  const handleLengthChange = (value: PolicyLength) => {
    setLength(value);
    localStorage.setItem(LENGTH_STORAGE_KEY, value);
  };

  const isHaiku = model === 'claude-haiku-4-5';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Generation Settings</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Policy Generation Settings
          </DialogTitle>
          <DialogDescription>
            Configure AI model and output length. Preferences are saved locally.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Model Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">AI Model</Label>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Use Budget Model</Label>
                <p className="text-xs text-muted-foreground">
                  Switch to Claude Haiku 4.5 for faster, cheaper generation
                </p>
              </div>
              <Switch
                checked={isHaiku}
                onCheckedChange={handleToggle}
              />
            </div>

            <div className={`mt-2 p-3 rounded-lg border-2 transition-colors ${isHaiku ? 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20' : 'border-primary/50 bg-primary/5'}`}>
              <div className="flex items-center gap-2">
                {isHaiku ? (
                  <Zap className="h-4 w-4 text-amber-600" />
                ) : (
                  <Sparkles className="h-4 w-4 text-primary" />
                )}
                <span className="font-medium text-sm">
                  {isHaiku ? 'Claude Haiku 4.5' : 'Claude Sonnet 4.6'}
                </span>
                <Badge variant={isHaiku ? 'secondary' : 'default'} className="text-xs">
                  {isHaiku ? 'Budget' : 'Default'}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <PoundSterling className="h-3 w-3" />
                  {isHaiku ? '~80% cheaper' : 'Standard cost'}
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {isHaiku ? '~2-3 min' : '~5-10 min'}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Length Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Policy Length
            </Label>
            <RadioGroup
              value={length}
              onValueChange={(v) => handleLengthChange(v as PolicyLength)}
              className="space-y-2"
            >
              {LENGTH_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                    length === opt.value ? 'border-primary/50 bg-primary/5' : ''
                  }`}
                  onClick={() => handleLengthChange(opt.value)}
                >
                  <RadioGroupItem value={opt.value} id={`length-${opt.value}`} />
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={`length-${opt.value}`} className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                      {opt.label}
                      <Badge variant="outline" className="text-xs font-normal">{opt.pages}</Badge>
                      <Badge variant="outline" className="text-xs font-normal">{opt.time}</Badge>
                      {opt.value === 'full' && <Badge variant="default" className="text-xs">Default</Badge>}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          <p className="text-xs text-muted-foreground">
            These settings apply to all new policy generations. Existing policies are not affected.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
