import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, EyeOff, Settings } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const ConsultationVisibilitySettings = () => {
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'consultation_examples_visibility')
        .single();

      if (error) throw error;
      
      if (data) {
        const settingValue = data.setting_value as { enabled?: boolean };
        setGlobalEnabled(settingValue?.enabled ?? true);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load consultation visibility settings');
    }
  };

  const updateSettings = async (enabled: boolean) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ 
          setting_value: { enabled },
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'consultation_examples_visibility');

      if (error) throw error;

      setGlobalEnabled(enabled);
      toast.success(`GP consultation features ${enabled ? 'enabled' : 'disabled'} globally`);
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update consultation visibility settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          GP Consultation Features Visibility
        </CardTitle>
        <CardDescription>
          Control whether GP consultation examples and patient meeting type options are available to users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Eye className="h-4 w-4" />
          <AlertDescription>
            When disabled, users will not see GP consultation examples or the "Patient Meeting" option in meeting settings. Individual user overrides can be set in the user management section.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-1">
            <Label htmlFor="global-visibility" className="text-base font-semibold">
              Show GP Consultation Features (Default)
            </Label>
            <p className="text-sm text-muted-foreground">
              Current status: {globalEnabled ? 'Enabled' : 'Disabled'} for all users by default
            </p>
          </div>
          <Switch
            id="global-visibility"
            checked={globalEnabled}
            onCheckedChange={updateSettings}
            disabled={loading}
          />
        </div>

        <div className="p-4 bg-muted/30 rounded-lg space-y-2">
          <h4 className="font-medium text-sm">What this controls:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>GP consultation examples in the Examples Panel</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>"Patient Meeting (Complaint Handling or other Administration Reason)" option in Meeting Type dropdown</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>User-specific overrides can be configured in the User Management section</span>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
