import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sparkles, Zap, PoundSterling, Brain } from 'lucide-react';

type ModelOption = 'claude' | 'gemini' | 'openai';

export const PolicyEnhancementModelSettings = () => {
  const [selectedModel, setSelectedModel] = useState<ModelOption>('claude');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSetting();
  }, []);

  const loadSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'policy_enhancement_model')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading setting:', error);
      }

      if (data?.setting_value) {
        const value = typeof data.setting_value === 'string' 
          ? data.setting_value 
          : (data.setting_value as { model?: string })?.model || 'claude';
        setSelectedModel(value as ModelOption);
      }
    } catch (error) {
      console.error('Error loading policy enhancement model setting:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelChange = async (value: ModelOption) => {
    setIsSaving(true);
    try {
      // Check if setting exists
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('setting_key', 'policy_enhancement_model')
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('system_settings')
          .update({
            setting_value: { model: value },
            updated_at: new Date().toISOString()
          })
          .eq('setting_key', 'policy_enhancement_model');

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('system_settings')
          .insert({
            setting_key: 'policy_enhancement_model',
            setting_value: { model: value },
            description: 'AI model used for policy enhancement: claude or gemini'
          });

        if (error) throw error;
      }

      setSelectedModel(value);
      const modelNames = {
        claude: 'Claude Sonnet 4',
        gemini: 'Gemini 3 Flash',
        openai: 'OpenAI GPT-5'
      };
      toast.success(`Policy enhancement model changed to ${modelNames[value]}`);
    } catch (error) {
      console.error('Error saving setting:', error);
      toast.error('Failed to save setting');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Policy Enhancement AI Model
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Policy Enhancement AI Model
        </CardTitle>
        <CardDescription>
          Choose which AI model to use for enhancing generated policies against CQC compliance requirements
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedModel}
          onValueChange={(value) => handleModelChange(value as ModelOption)}
          disabled={isSaving}
          className="space-y-4"
        >
          <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="claude" id="claude" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="claude" className="flex items-center gap-2 cursor-pointer font-medium">
                Claude Sonnet 4
                <Badge variant="default" className="text-xs">Recommended</Badge>
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Best quality enhancement with comprehensive CQC compliance checking. More thorough but slower.
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Highest quality
                </span>
                <span className="flex items-center gap-1">
                  <PoundSterling className="h-3 w-3" />
                  ~4.5p per policy
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="openai" id="openai" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="openai" className="flex items-center gap-2 cursor-pointer font-medium">
                OpenAI GPT-5
                <Badge variant="outline" className="text-xs">Premium</Badge>
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                OpenAI's latest model with strong reasoning. Excellent for complex policy requirements.
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Brain className="h-3 w-3" />
                  Advanced reasoning
                </span>
                <span className="flex items-center gap-1">
                  <PoundSterling className="h-3 w-3" />
                  ~3.5p per policy
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="gemini" id="gemini" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="gemini" className="flex items-center gap-2 cursor-pointer font-medium">
                Gemini 3 Flash
                <Badge variant="secondary" className="text-xs">Budget</Badge>
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Fast and cost-effective enhancement. Good quality but less thorough than Claude.
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Fastest
                </span>
                <span className="flex items-center gap-1">
                  <PoundSterling className="h-3 w-3" />
                  ~0.5p per policy
                </span>
              </div>
            </div>
          </div>
        </RadioGroup>

        <p className="text-xs text-muted-foreground mt-4">
          Changes apply immediately to all new policy generations. Existing policies are not affected.
        </p>
      </CardContent>
    </Card>
  );
};
