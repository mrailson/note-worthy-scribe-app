import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Settings, Sparkles, Zap, PoundSterling, FileText, Brain, AlertTriangle, FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

export type PolicyGenerationModel = 
  | 'claude-sonnet-4-6' 
  | 'claude-haiku-4-5' 
  | 'gpt-4o-mini' 
  | 'gemini-2.5-flash' 
  | 'gemini-2.5-pro';

export type PolicyLength = 'compact' | 'concise' | 'standard' | 'full';

const MODEL_STORAGE_KEY = 'policy-generation-model';
const LENGTH_STORAGE_KEY = 'policy-generation-length';


export const getPolicyGenerationModel = (): PolicyGenerationModel => {
  const saved = localStorage.getItem(MODEL_STORAGE_KEY);
  if (saved && MODEL_OPTIONS.some(m => m.value === saved)) return saved as PolicyGenerationModel;
  return 'gemini-2.5-flash';
};

export const getPolicyGenerationLength = (): PolicyLength => {
  const saved = localStorage.getItem(LENGTH_STORAGE_KEY);
  if (saved === 'compact' || saved === 'concise' || saved === 'standard') return saved;
  return 'full';
};


export const getModelDisplayLabel = (model: string): string => {
  const found = MODEL_OPTIONS.find(m => m.value === model);
  return found?.label || model;
};

const MODEL_OPTIONS: { 
  value: PolicyGenerationModel; 
  label: string; 
  provider: string;
  badge: string; 
  badgeVariant: 'default' | 'secondary' | 'outline';
  stats: string; 
  icon: typeof Sparkles;
  requiresKey?: string;
}[] = [
  { 
    value: 'claude-sonnet-4-6', 
    label: 'Claude Sonnet 4.6', 
    provider: 'Anthropic',
    badge: 'Default', 
    badgeVariant: 'default',
    stats: 'Standard cost · ~5-10 min',
    icon: Sparkles,
  },
  { 
    value: 'claude-haiku-4-5', 
    label: 'Claude Haiku 4.5', 
    provider: 'Anthropic',
    badge: 'Budget', 
    badgeVariant: 'secondary',
    stats: '~80% cheaper · ~2-3 min',
    icon: Zap,
  },
  { 
    value: 'gpt-4o-mini', 
    label: 'GPT-4o Mini', 
    provider: 'OpenAI',
    badge: 'Budget', 
    badgeVariant: 'secondary',
    stats: '~80% cheaper · ~2-3 min',
    icon: Zap,
    
  },
  { 
    value: 'gemini-2.5-flash', 
    label: 'Gemini 2.5 Flash', 
    provider: 'Google',
    badge: 'Budget', 
    badgeVariant: 'secondary',
    stats: '~85% cheaper · ~2 min',
    icon: Zap,
  },
  { 
    value: 'gemini-2.5-pro', 
    label: 'Gemini 2.5 Pro', 
    provider: 'Google',
    badge: 'Reasoning', 
    badgeVariant: 'outline',
    stats: '~50% cheaper · ~4-5 min',
    icon: Brain,
    
  },
];

const LENGTH_OPTIONS: { value: PolicyLength; label: string; description: string; pages: string; time: string }[] = [
  { value: 'compact', label: 'Compact', description: 'Key essentials — quick reference style', pages: '~8 pages', time: '~2 min' },
  { value: 'concise', label: 'Concise', description: 'Core requirements with essential detail', pages: '~13 pages', time: '~3 min' },
  { value: 'standard', label: 'Standard', description: 'Balanced coverage with good procedural detail', pages: '~20 pages', time: '~6 min' },
  { value: 'full', label: 'Comprehensive', description: 'Full regulatory detail — CQC inspection-ready', pages: '~40 pages', time: '~10 min' },
];

export const PolicyGenerationModelSettings = () => {
  const [model, setModel] = useState<PolicyGenerationModel>('gemini-2.5-flash');
  const [length, setLength] = useState<PolicyLength>('full');
  const [open, setOpen] = useState(false);

  const [gapCheckGemini, setGapCheckGemini] = useState(false);

  useEffect(() => {
    setModel(getPolicyGenerationModel());
    setLength(getPolicyGenerationLength());
    setGapCheckGemini(getGapCheckForGemini());
  }, []);

  const handleModelChange = (value: PolicyGenerationModel) => {
    setModel(value);
    localStorage.setItem(MODEL_STORAGE_KEY, value);
  };

  const handleLengthChange = (value: PolicyLength) => {
    setLength(value);
    localStorage.setItem(LENGTH_STORAGE_KEY, value);
  };

  const selectedModelOption = MODEL_OPTIONS.find(m => m.value === model);

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

      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
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
            <RadioGroup
              value={model}
              onValueChange={(v) => handleModelChange(v as PolicyGenerationModel)}
              className="space-y-2"
            >
              {MODEL_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <div
                    key={opt.value}
                    className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                      model === opt.value ? 'border-primary/50 bg-primary/5' : ''
                    }`}
                    onClick={() => handleModelChange(opt.value)}
                  >
                    <RadioGroupItem value={opt.value} id={`model-${opt.value}`} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <Label htmlFor={`model-${opt.value}`} className="flex items-center gap-2 cursor-pointer text-sm font-medium flex-wrap">
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {opt.label}
                        <Badge variant={opt.badgeVariant} className="text-xs">{opt.badge}</Badge>
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{opt.provider}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{opt.stats}</span>
                      </div>
                      {opt.requiresKey && (
                        <div className="flex items-center gap-1 mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span>Requires {opt.requiresKey} in Supabase secrets</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
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

          <Separator />

          {/* Dev: Gap Check for Gemini */}
          <div className="border border-dashed border-muted-foreground/30 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="gap-check-gemini" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <FlaskConical className="h-4 w-4 text-amber-500" />
                Gap Check for Gemini
                <Badge variant="outline" className="text-[10px]">Test</Badge>
              </Label>
              <Switch
                id="gap-check-gemini"
                checked={gapCheckGemini}
                onCheckedChange={(checked) => {
                  setGapCheckGemini(checked);
                  localStorage.setItem(GAP_CHECK_GEMINI_KEY, String(checked));
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              When enabled, Gemini 2.5 Flash runs gap analysis &amp; remediation after generation. Enhance remains skipped. Adds ~1-2 min.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            These settings apply to all new policy generations. Existing policies are not affected.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
