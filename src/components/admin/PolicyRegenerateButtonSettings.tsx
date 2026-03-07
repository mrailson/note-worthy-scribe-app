import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

export const PolicyRegenerateButtonSettings = () => {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSetting();
  }, []);

  const fetchSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'policy_regenerate_button_visible')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const val = data.setting_value as { enabled?: boolean };
        setEnabled(val?.enabled ?? true);
      }
    } catch (error) {
      console.error('Error fetching regenerate button setting:', error);
    }
  };

  const updateSetting = async (newEnabled: boolean) => {
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('setting_key', 'policy_regenerate_button_visible')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('system_settings')
          .update({
            setting_value: { enabled: newEnabled },
            updated_at: new Date().toISOString(),
          })
          .eq('setting_key', 'policy_regenerate_button_visible');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('system_settings')
          .insert({
            setting_key: 'policy_regenerate_button_visible',
            setting_value: { enabled: newEnabled },
            description: 'Show or hide the Regenerate button on completed policy cards',
          });
        if (error) throw error;
      }

      setEnabled(newEnabled);
      toast.success(`Regenerate button ${newEnabled ? 'shown' : 'hidden'} on policy cards`);
    } catch (error) {
      console.error('Error updating regenerate button setting:', error);
      toast.error('Failed to update setting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Policy Regenerate Button
        </CardTitle>
        <CardDescription>
          Control whether the regenerate (version) button appears on completed policy cards
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-1">
            <Label htmlFor="regenerate-visibility" className="text-base font-semibold">
              Show Regenerate Button on Policy Cards
            </Label>
            <p className="text-sm text-muted-foreground">
              Currently {enabled ? 'visible' : 'hidden'} for all users
            </p>
          </div>
          <Switch
            id="regenerate-visibility"
            checked={enabled}
            onCheckedChange={updateSetting}
            disabled={loading}
          />
        </div>
      </CardContent>
    </Card>
  );
};
