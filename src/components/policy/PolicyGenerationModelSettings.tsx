import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Sparkles, Zap, PoundSterling } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type PolicyGenerationModel = 'claude-sonnet-4-6' | 'claude-haiku-4-5';

const STORAGE_KEY = 'policy-generation-model';

export const getPolicyGenerationModel = (): PolicyGenerationModel => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'claude-haiku-4-5') return 'claude-haiku-4-5';
  return 'claude-sonnet-4-6';
};

export const PolicyGenerationModelSettings = () => {
  const [model, setModel] = useState<PolicyGenerationModel>('claude-sonnet-4-6');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setModel(getPolicyGenerationModel());
  }, []);

  const handleToggle = (useHaiku: boolean) => {
    const newModel: PolicyGenerationModel = useHaiku ? 'claude-haiku-4-5' : 'claude-sonnet-4-6';
    setModel(newModel);
    localStorage.setItem(STORAGE_KEY, newModel);
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
            Choose the AI model used for generating policies. This preference is saved locally.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
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

          {/* Current selection display */}
          <div className={`p-4 rounded-lg border-2 transition-colors ${isHaiku ? 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20' : 'border-primary/50 bg-primary/5'}`}>
            <div className="flex items-center gap-2 mb-2">
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
            <p className="text-xs text-muted-foreground">
              {isHaiku
                ? 'Faster responses at lower cost. Good for standard policies — ideal for comparison testing.'
                : 'Highest quality generation with comprehensive regulatory compliance. Recommended for production use.'
              }
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
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

          <p className="text-xs text-muted-foreground">
            This setting applies to all new policy generations. Existing policies are not affected.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
