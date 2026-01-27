import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Save, 
  Loader2, 
  User, 
  Users, 
  Shield, 
  Building2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface PolicyProfileData {
  // Practice Info
  practice_name: string;
  address: string;
  postcode: string;
  ods_code: string;
  list_size: number | null;
  clinical_system: string;
  
  // Branch Site
  has_branch_site: boolean;
  branch_site_name: string;
  branch_site_address: string;
  branch_site_postcode: string;
  branch_site_phone: string;
  
  // Key Personnel
  practice_manager_name: string;
  lead_gp_name: string;
  senior_gp_partner: string;
  
  // Information Governance
  caldicott_guardian: string;
  dpo_name: string;
  siro: string;
  
  // Safeguarding
  safeguarding_lead_adults: string;
  safeguarding_lead_children: string;
  
  // Health & Safety
  infection_control_lead: string;
  health_safety_lead: string;
  fire_safety_officer: string;
  complaints_lead: string;
  
  // Services
  services_offered: Record<string, boolean>;
}

const defaultData: PolicyProfileData = {
  practice_name: "",
  address: "",
  postcode: "",
  ods_code: "",
  list_size: null,
  clinical_system: "",
  has_branch_site: false,
  branch_site_name: "",
  branch_site_address: "",
  branch_site_postcode: "",
  branch_site_phone: "",
  practice_manager_name: "",
  lead_gp_name: "",
  senior_gp_partner: "",
  caldicott_guardian: "",
  dpo_name: "",
  siro: "",
  safeguarding_lead_adults: "",
  safeguarding_lead_children: "",
  infection_control_lead: "",
  health_safety_lead: "",
  fire_safety_officer: "",
  complaints_lead: "",
  services_offered: {},
};

const serviceOptions = [
  { key: 'minor_surgery', label: 'Minor Surgery' },
  { key: 'dispensing', label: 'Dispensing' },
  { key: 'travel_health', label: 'Travel Health' },
  { key: 'sexual_health', label: 'Sexual Health' },
  { key: 'occupational_health', label: 'Occupational Health' },
  { key: 'teaching_practice', label: 'Teaching Practice' },
  { key: 'training_practice', label: 'Training Practice' },
  { key: 'extended_hours', label: 'Extended Hours' },
  { key: 'walk_in_centre', label: 'Walk-in Centre' },
];

export const PolicyProfileDefaults = () => {
  const { user } = useAuth();
  const [data, setData] = useState<PolicyProfileData>(defaultData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [practiceDetailsId, setPracticeDetailsId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load existing practice details
  useEffect(() => {
    const loadPracticeDetails = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // First check practice_details for the user
        const { data: pd, error } = await supabase
          .from('practice_details')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (pd) {
          setPracticeDetailsId(pd.id);
          setData({
            practice_name: pd.practice_name || "",
            address: pd.address || "",
            postcode: (pd as any).postcode || "",
            ods_code: (pd as any).ods_code || "",
            list_size: (pd as any).list_size || null,
            clinical_system: (pd as any).clinical_system || "",
            has_branch_site: (pd as any).has_branch_site || false,
            branch_site_name: (pd as any).branch_site_name || "",
            branch_site_address: (pd as any).branch_site_address || "",
            branch_site_postcode: (pd as any).branch_site_postcode || "",
            branch_site_phone: (pd as any).branch_site_phone || "",
            practice_manager_name: (pd as any).practice_manager_name || "",
            lead_gp_name: (pd as any).lead_gp_name || "",
            senior_gp_partner: (pd as any).senior_gp_partner || "",
            caldicott_guardian: (pd as any).caldicott_guardian || "",
            dpo_name: (pd as any).dpo_name || "",
            siro: (pd as any).siro || "",
            safeguarding_lead_adults: (pd as any).safeguarding_lead_adults || "",
            safeguarding_lead_children: (pd as any).safeguarding_lead_children || "",
            infection_control_lead: (pd as any).infection_control_lead || "",
            health_safety_lead: (pd as any).health_safety_lead || "",
            fire_safety_officer: (pd as any).fire_safety_officer || "",
            complaints_lead: (pd as any).complaints_lead || "",
            services_offered: (pd as any).services_offered || {},
          });
        } else {
          // Try to get practice info from gp_practices via user_roles
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('practice_id')
            .eq('user_id', user.id)
            .not('practice_id', 'is', null)
            .limit(1)
            .maybeSingle();

          if (roleData?.practice_id) {
            const { data: gpPractice } = await supabase
              .from('gp_practices')
              .select('*')
              .eq('id', roleData.practice_id)
              .single();

            if (gpPractice) {
              setData(prev => ({
                ...prev,
                practice_name: gpPractice.name || "",
                address: gpPractice.address || "",
              }));
            }
          }
        }
      } catch (error) {
        console.error('Error loading practice details:', error);
        toast.error('Failed to load practice details');
      } finally {
        setIsLoading(false);
      }
    };

    loadPracticeDetails();
  }, [user]);

  const updateField = (field: keyof PolicyProfileData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const toggleService = (key: string) => {
    setData(prev => ({
      ...prev,
      services_offered: {
        ...prev.services_offered,
        [key]: !prev.services_offered[key],
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('You must be logged in to save');
      return;
    }

    setIsSaving(true);

    try {
      const updateData = {
        practice_name: data.practice_name,
        address: data.address,
        postcode: data.postcode,
        ods_code: data.ods_code,
        list_size: data.list_size,
        clinical_system: data.clinical_system,
        has_branch_site: data.has_branch_site,
        branch_site_name: data.branch_site_name,
        branch_site_address: data.branch_site_address,
        branch_site_postcode: data.branch_site_postcode,
        branch_site_phone: data.branch_site_phone,
        practice_manager_name: data.practice_manager_name,
        lead_gp_name: data.lead_gp_name,
        senior_gp_partner: data.senior_gp_partner,
        caldicott_guardian: data.caldicott_guardian,
        dpo_name: data.dpo_name,
        siro: data.siro,
        safeguarding_lead_adults: data.safeguarding_lead_adults,
        safeguarding_lead_children: data.safeguarding_lead_children,
        infection_control_lead: data.infection_control_lead,
        health_safety_lead: data.health_safety_lead,
        fire_safety_officer: data.fire_safety_officer,
        complaints_lead: data.complaints_lead,
        services_offered: data.services_offered,
        updated_at: new Date().toISOString(),
      };

      console.log('💾 Saving policy profile defaults:', {
        practiceDetailsId,
        infection_control_lead: updateData.infection_control_lead,
        health_safety_lead: updateData.health_safety_lead,
      });

      if (practiceDetailsId) {
        // Update existing record
        const { data: updatedRow, error } = await supabase
          .from('practice_details')
          .update(updateData)
          .eq('id', practiceDetailsId)
          .select()
          .single();

        if (error) throw error;
        console.log('✅ Updated practice_details:', updatedRow);
      } else {
        // Create new record
        const { data: newRecord, error } = await supabase
          .from('practice_details')
          .insert({
            ...updateData,
            user_id: user.id,
            is_default: true,
          })
          .select()
          .single();

        if (error) throw error;
        console.log('✅ Created new practice_details:', newRecord);
        setPracticeDetailsId(newRecord.id);
      }

      toast.success('Policy profile defaults saved successfully');
      setHasChanges(false);
    } catch (error) {
      console.error('❌ Error saving practice details:', error);
      toast.error('Failed to save practice details');
    } finally {
      setIsSaving(false);
    }
  };

  // Count filled fields for progress indicator
  const personnelFields = [
    'practice_manager_name', 'lead_gp_name', 'senior_gp_partner',
    'caldicott_guardian', 'dpo_name', 'siro',
    'safeguarding_lead_adults', 'safeguarding_lead_children',
    'infection_control_lead', 'health_safety_lead', 'fire_safety_officer', 'complaints_lead'
  ] as const;
  
  const filledCount = personnelFields.filter(f => data[f]?.trim()).length;
  const totalCount = personnelFields.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading profile defaults...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unsaved Changes Banner */}
      {hasChanges && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">You have unsaved changes</span>
          </div>
          <Button onClick={handleSave} disabled={isSaving} variant="default" size="sm">
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Now
          </Button>
        </div>
      )}

      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Policy Profile Defaults</h2>
          <p className="text-muted-foreground">
            Set up your practice's default information for automatic insertion into generated policies
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Progress Indicator */}
          <div className="flex items-center gap-2 text-sm">
            {filledCount === totalCount ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-muted-foreground">
              {filledCount}/{totalCount} roles configured
            </span>
          </div>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges} variant={hasChanges ? "default" : "outline"}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Defaults
          </Button>
        </div>
      </div>

      {/* Practice Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Practice Information</CardTitle>
          </div>
          <CardDescription>
            Basic practice details used in policy headers and footers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="practice_name">Practice Name</Label>
              <Input
                id="practice_name"
                value={data.practice_name}
                onChange={(e) => updateField('practice_name', e.target.value)}
                placeholder="Enter practice name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ods_code">ODS Code</Label>
              <Input
                id="ods_code"
                value={data.ods_code}
                onChange={(e) => updateField('ods_code', e.target.value)}
                placeholder="e.g. A12345"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={data.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="Full practice address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postcode">Postcode</Label>
              <Input
                id="postcode"
                value={data.postcode}
                onChange={(e) => updateField('postcode', e.target.value)}
                placeholder="e.g. SW1A 1AA"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="list_size">Patient List Size</Label>
              <Input
                id="list_size"
                type="number"
                value={data.list_size || ''}
                onChange={(e) => updateField('list_size', e.target.value ? parseInt(e.target.value, 10) : null)}
                placeholder="e.g. 12000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clinical_system">Clinical System</Label>
              <select
                id="clinical_system"
                value={data.clinical_system}
                onChange={(e) => updateField('clinical_system', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select clinical system...</option>
                <option value="EMIS Web">EMIS Web</option>
                <option value="SystmOne">SystmOne (TPP)</option>
                <option value="Vision">Vision</option>
                <option value="Microtest">Microtest</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branch Site */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Branch Site</CardTitle>
          </div>
          <CardDescription>
            If your practice has a branch site, add its details here for use in policies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="has_branch_site"
              checked={data.has_branch_site}
              onCheckedChange={(checked) => updateField('has_branch_site', checked)}
            />
            <Label htmlFor="has_branch_site" className="font-normal cursor-pointer">
              This practice has a branch site
            </Label>
          </div>

          {data.has_branch_site && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="branch_site_name">Branch Site Name</Label>
                  <Input
                    id="branch_site_name"
                    value={data.branch_site_name}
                    onChange={(e) => updateField('branch_site_name', e.target.value)}
                    placeholder="e.g. Oakwood Branch Surgery"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch_site_phone">Branch Site Phone</Label>
                  <Input
                    id="branch_site_phone"
                    value={data.branch_site_phone}
                    onChange={(e) => updateField('branch_site_phone', e.target.value)}
                    placeholder="e.g. 01onal 234567"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="branch_site_address">Branch Site Address</Label>
                  <Input
                    id="branch_site_address"
                    value={data.branch_site_address}
                    onChange={(e) => updateField('branch_site_address', e.target.value)}
                    placeholder="Full branch site address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch_site_postcode">Branch Site Postcode</Label>
                  <Input
                    id="branch_site_postcode"
                    value={data.branch_site_postcode}
                    onChange={(e) => updateField('branch_site_postcode', e.target.value)}
                    placeholder="e.g. SW1A 2BB"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Personnel */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Key Personnel</CardTitle>
          </div>
          <CardDescription>
            Leadership roles commonly referenced in practice policies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="practice_manager_name">
                Practice Manager
                <Badge variant="outline" className="ml-2 text-xs">Required</Badge>
              </Label>
              <Input
                id="practice_manager_name"
                value={data.practice_manager_name}
                onChange={(e) => updateField('practice_manager_name', e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead_gp_name">
                Lead GP / Clinical Lead
                <Badge variant="outline" className="ml-2 text-xs">Required</Badge>
              </Label>
              <Input
                id="lead_gp_name"
                value={data.lead_gp_name}
                onChange={(e) => updateField('lead_gp_name', e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senior_gp_partner">Senior GP Partner</Label>
              <Input
                id="senior_gp_partner"
                value={data.senior_gp_partner}
                onChange={(e) => updateField('senior_gp_partner', e.target.value)}
                placeholder="Full name"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Information Governance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Information Governance</CardTitle>
          </div>
          <CardDescription>
            IG and data protection roles for Information Governance policies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="caldicott_guardian">Caldicott Guardian</Label>
              <Input
                id="caldicott_guardian"
                value={data.caldicott_guardian}
                onChange={(e) => updateField('caldicott_guardian', e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dpo_name">Data Protection Officer (DPO)</Label>
              <Input
                id="dpo_name"
                value={data.dpo_name}
                onChange={(e) => updateField('dpo_name', e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siro">SIRO (Senior Information Risk Owner)</Label>
              <Input
                id="siro"
                value={data.siro}
                onChange={(e) => updateField('siro', e.target.value)}
                placeholder="Full name"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Safeguarding & Clinical Leads */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Safeguarding & Clinical Leads</CardTitle>
          </div>
          <CardDescription>
            Specialist leads for safeguarding, health & safety, and clinical policies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="safeguarding_lead_adults">Safeguarding Lead (Adults)</Label>
              <Input
                id="safeguarding_lead_adults"
                value={data.safeguarding_lead_adults}
                onChange={(e) => updateField('safeguarding_lead_adults', e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="safeguarding_lead_children">Safeguarding Lead (Children)</Label>
              <Input
                id="safeguarding_lead_children"
                value={data.safeguarding_lead_children}
                onChange={(e) => updateField('safeguarding_lead_children', e.target.value)}
                placeholder="Full name"
              />
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="infection_control_lead">Infection Prevention & Control Lead</Label>
              <Input
                id="infection_control_lead"
                value={data.infection_control_lead}
                onChange={(e) => updateField('infection_control_lead', e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="health_safety_lead">Health & Safety Lead</Label>
              <Input
                id="health_safety_lead"
                value={data.health_safety_lead}
                onChange={(e) => updateField('health_safety_lead', e.target.value)}
                placeholder="Full name"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fire_safety_officer">Fire Safety Officer</Label>
              <Input
                id="fire_safety_officer"
                value={data.fire_safety_officer}
                onChange={(e) => updateField('fire_safety_officer', e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complaints_lead">Complaints Lead</Label>
              <Input
                id="complaints_lead"
                value={data.complaints_lead}
                onChange={(e) => updateField('complaints_lead', e.target.value)}
                placeholder="Full name"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services Offered */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Services Offered</CardTitle>
          <CardDescription>
            Select services your practice provides - this helps tailor policy content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {serviceOptions.map((service) => (
              <div key={service.key} className="flex items-center space-x-2">
                <Checkbox
                  id={service.key}
                  checked={data.services_offered[service.key] || false}
                  onCheckedChange={() => toggleService(service.key)}
                />
                <Label htmlFor={service.key} className="font-normal cursor-pointer">
                  {service.label}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bottom Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || !hasChanges} size="lg">
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Policy Profile Defaults
        </Button>
      </div>
    </div>
  );
};
