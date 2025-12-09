import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Grid3X3, FileText, Stethoscope, MessageSquareWarning, Sparkles, Clock, Shield, FolderOpen, Building2, Wrench, Languages, Thermometer, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ServiceVisibility {
  ai4pm_service: boolean;
  meeting_notes: boolean;
  gp_scribe: boolean;
  complaints_system: boolean;
  ai_4_pm: boolean;
  enhanced_access: boolean;
  cqc_compliance: boolean;
  shared_drive: boolean;
  nres: boolean;
  mic_test: boolean;
  translation: boolean;
  fridge_monitoring: boolean;
  lg_capture: boolean;
  bp_service: boolean;
}

const defaultVisibility: ServiceVisibility = {
  ai4pm_service: true,
  meeting_notes: true,
  gp_scribe: true,
  complaints_system: true,
  ai_4_pm: true,
  enhanced_access: true,
  cqc_compliance: true,
  shared_drive: true,
  nres: true,
  mic_test: true,
  translation: true,
  fridge_monitoring: true,
  lg_capture: true,
  bp_service: true,
};

const serviceConfig = [
  { key: 'ai4pm_service', label: 'AI4PM Service', icon: Sparkles },
  { key: 'meeting_notes', label: 'Meeting Notes', icon: FileText },
  { key: 'gp_scribe', label: 'GP Scribe', icon: Stethoscope },
  { key: 'complaints_system', label: 'Complaints System', icon: MessageSquareWarning },
  { key: 'ai_4_pm', label: 'AI 4 PM Assistant', icon: Sparkles },
  { key: 'enhanced_access', label: 'Enhanced Access', icon: Clock },
  { key: 'cqc_compliance', label: 'CQC Compliance', icon: Shield },
  { key: 'shared_drive', label: 'Shared Drive', icon: FolderOpen },
  { key: 'nres', label: 'NRES', icon: Building2 },
  { key: 'mic_test', label: 'Mic Test Service', icon: Wrench },
  { key: 'translation', label: 'Translation Service', icon: Languages },
  { key: 'fridge_monitoring', label: 'Fridge Monitoring', icon: Thermometer },
  { key: 'lg_capture', label: 'LG Capture', icon: FileText },
  { key: 'bp_service', label: 'BP Average Service', icon: Heart },
] as const;

export const ServiceVisibilitySettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [visibility, setVisibility] = useState<ServiceVisibility>(defaultVisibility);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVisibility();
  }, [user]);

  const loadVisibility = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('setting_value')
        .eq('user_id', user.id)
        .eq('setting_key', 'service_visibility');

      if (error) throw error;

      if (data && data.length > 0) {
        const savedVisibility = data[0].setting_value as unknown as Partial<ServiceVisibility>;
        setVisibility({ ...defaultVisibility, ...savedVisibility });
      }
    } catch (error) {
      console.error('Error loading service visibility:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateVisibility = async (key: keyof ServiceVisibility, value: boolean) => {
    if (!user) return;

    const newVisibility = { ...visibility, [key]: value };
    setVisibility(newVisibility);

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          setting_key: 'service_visibility',
          setting_value: newVisibility,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,setting_key'
        });

      if (error) throw error;

      toast({
        title: "Service visibility updated"
      });
    } catch (error) {
      console.error('Error saving service visibility:', error);
      // Revert on error
      setVisibility(visibility);
      toast({
        title: "Failed to update service visibility",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5" />
            Service Menu Visibility
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Grid3X3 className="h-5 w-5" />
          Service Menu Visibility
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Choose which services appear in your Select Service menu. Only services you have access to will be shown.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {serviceConfig.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor={key} className="text-sm font-medium cursor-pointer">
                  {label}
                </Label>
              </div>
              <Switch
                id={key}
                checked={visibility[key as keyof ServiceVisibility]}
                onCheckedChange={(checked) => updateVisibility(key as keyof ServiceVisibility, checked)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
