import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Grid3X3, FileText, Stethoscope, MessageSquareWarning, Sparkles, Clock, Shield, FolderOpen, Building2, Wrench, Languages, Thermometer, Heart, ChevronDown, ClipboardCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useServiceActivation } from '@/hooks/useServiceActivation';
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
  survey_manager: boolean;
  mock_cqc_inspection: boolean;
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
  survey_manager: true,
  mock_cqc_inspection: true,
};

// Service config with access check keys
const serviceConfig = [
  { key: 'ai4pm_service', label: 'Ask AI', icon: Sparkles, accessKey: null }, // Always available
  { key: 'meeting_notes', label: 'Meeting Notes', icon: FileText, accessKey: 'meeting_recorder' },
  { key: 'gp_scribe', label: 'Scribe', icon: Stethoscope, accessKey: 'gp_scribe' },
  { key: 'complaints_system', label: 'Complaints System', icon: MessageSquareWarning, accessKey: 'complaints_system' },
  { key: 'ai_4_pm', label: 'AI 4 PM Assistant', icon: Sparkles, accessKey: 'ai_4_pm' },
  { key: 'enhanced_access', label: 'Enhanced Access', icon: Clock, accessKey: 'enhanced_access' },
  { key: 'cqc_compliance', label: 'CQC Compliance', icon: Shield, accessKey: 'cqc_compliance_access' },
  { key: 'shared_drive', label: 'Shared Drive', icon: FolderOpen, accessKey: 'shared_drive_access' },
  { key: 'nres', label: 'NRES', icon: Building2, accessKey: 'nres' },
  { key: 'mic_test', label: 'Mic Test Service', icon: Wrench, accessKey: 'mic_test_service_access' },
  { key: 'translation', label: 'Translation Service', icon: Languages, accessKey: 'translation_service' },
  { key: 'fridge_monitoring', label: 'Fridge Monitoring', icon: Thermometer, accessKey: 'fridge_monitoring_access' },
  { key: 'lg_capture', label: 'LG Capture', icon: FileText, accessKey: 'lg_capture' },
  { key: 'bp_service', label: 'BP Average Service', icon: Heart, accessKey: 'bp_service' },
  { key: 'survey_manager', label: 'Survey Manager', icon: FileText, accessKey: 'survey_manager_access' },
  { key: 'mock_cqc_inspection', label: 'Mock CQC Inspection', icon: ClipboardCheck, accessKey: 'cqc_compliance_access' },
] as const;

export const ServiceVisibilitySettings = () => {
  const { user, hasModuleAccess } = useAuth();
  const { hasServiceAccess } = useServiceActivation();
  const queryClient = useQueryClient();
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

      // Invalidate the query cache so Header picks up the change
      queryClient.invalidateQueries({ queryKey: ['service-visibility', user.id] });

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

  // Check if user has access to a service
  const userHasServiceAccess = (accessKey: string | null): boolean => {
    if (accessKey === null) return true; // Always available (like AI4PM)
    
    // Check module access first (from AuthContext)
    if (hasModuleAccess(accessKey)) return true;
    
    // Check service activation (from useServiceActivation)
    if (accessKey === 'nres') return hasServiceAccess('nres');
    if (accessKey === 'lg_capture') return hasServiceAccess('lg_capture');
    if (accessKey === 'bp_service') return hasServiceAccess('bp_service');
    
    return false;
  };

  // Filter to only show services the user has access to
  const availableServices = serviceConfig.filter(service => 
    userHasServiceAccess(service.accessKey)
  );

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

  if (availableServices.length === 0) {
    return null; // Don't show section if no services available
  }

  return (
    <Collapsible defaultOpen={false}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-left">
                  <Grid3X3 className="h-5 w-5" />
                  Service Menu Visibility
                </CardTitle>
                <p className="text-muted-foreground text-sm text-left mt-1">
                  Choose which of your available services appear in the Select Service menu.
                </p>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {availableServices.map(({ key, label, icon: Icon }) => (
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
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
