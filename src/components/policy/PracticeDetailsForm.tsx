import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePracticeContext } from "@/hooks/usePracticeContext";

const POLICY_LIST_SIZE_KEY = 'policy_service_list_size';

interface PolicyReference {
  id: string;
  policy_name: string;
  category: string;
  cqc_kloe: string;
  priority: string;
  guidance_sources: string[];
  required_roles: string[];
  description: string | null;
}

interface PracticeDetails {
  practice_name: string;
  address: string;
  postcode: string;
  ods_code: string;
  practice_manager_name: string;
  lead_gp_name: string;
  caldicott_guardian: string;
  dpo_name: string;
  safeguarding_lead_adults: string;
  safeguarding_lead_children: string;
  infection_control_lead: string;
  complaints_lead: string;
  health_safety_lead: string;
  fire_safety_officer: string;
  list_size: number | null;
  services_offered: Record<string, boolean>;
}

interface PracticeDetailsFormProps {
  selectedPolicy: PolicyReference | null;
  onSubmit: (details: PracticeDetails) => void;
  initialData: PracticeDetails | null;
}

const defaultDetails: PracticeDetails = {
  practice_name: "",
  address: "",
  postcode: "",
  ods_code: "",
  practice_manager_name: "",
  lead_gp_name: "",
  caldicott_guardian: "",
  dpo_name: "",
  safeguarding_lead_adults: "",
  safeguarding_lead_children: "",
  infection_control_lead: "",
  complaints_lead: "",
  health_safety_lead: "",
  fire_safety_officer: "",
  list_size: null,
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
];

export const PracticeDetailsForm = ({ selectedPolicy, onSubmit, initialData }: PracticeDetailsFormProps) => {
  const { user } = useAuth();
  const { practiceContext, practiceDetails: notewellPracticeDetails } = usePracticeContext();
  const [details, setDetails] = useState<PracticeDetails>(initialData || defaultDetails);
  const [isLoading, setIsLoading] = useState(!initialData); // Skip loading if we have initialData
  const [hasLoadedFromDb, setHasLoadedFromDb] = useState(!!initialData);

  // Determine which conditional fields to show based on the policy's required_roles
  const requiredRoles = selectedPolicy?.required_roles || [];
  const showCaldicott = requiredRoles.includes('caldicott_guardian') || selectedPolicy?.category === 'Information Governance';
  const showDPO = requiredRoles.includes('dpo_name') || selectedPolicy?.category === 'Information Governance';
  const showSafeguardingAdults = requiredRoles.includes('safeguarding_lead_adults') || selectedPolicy?.policy_name?.toLowerCase().includes('safeguarding');
  const showSafeguardingChildren = requiredRoles.includes('safeguarding_lead_children') || selectedPolicy?.policy_name?.toLowerCase().includes('safeguarding');
  const showInfectionControl = requiredRoles.includes('infection_control_lead') || selectedPolicy?.policy_name?.toLowerCase().includes('infection');
  const showComplaints = requiredRoles.includes('complaints_lead') || selectedPolicy?.policy_name?.toLowerCase().includes('complaint');
  const showHealthSafety = requiredRoles.includes('health_safety_lead') || selectedPolicy?.category === 'Health & Safety';
  const showFireSafety = requiredRoles.includes('fire_safety_officer') || selectedPolicy?.policy_name?.toLowerCase().includes('fire');

  // Load persisted list size from localStorage
  const getPersistedListSize = (): number | null => {
    try {
      const stored = localStorage.getItem(POLICY_LIST_SIZE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        return isNaN(parsed) ? null : parsed;
      }
    } catch {
      // localStorage not available
    }
    return null;
  };

  // Persist list size to localStorage
  const persistListSize = (size: number | null) => {
    try {
      if (size !== null && size > 0) {
        localStorage.setItem(POLICY_LIST_SIZE_KEY, size.toString());
      }
    } catch {
      // localStorage not available
    }
  };

  // Load practice details from database and Notewell context
  useEffect(() => {
    const loadPracticeDetails = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const persistedListSize = getPersistedListSize();

        // 1) Always try to merge in Notewell practice context when it becomes available.
        // IMPORTANT: Only fill empty fields so we don't overwrite user edits.
        const nd: any = notewellPracticeDetails || {};
        const notewellAddress: string | undefined = practiceContext?.practiceAddress || nd.address;
        const notewellManager: string | undefined = nd.practice_manager_name;

        if (
          practiceContext?.practiceName ||
          notewellAddress ||
          notewellManager ||
          nd.practice_name ||
          nd.ods_code ||
          nd.postcode ||
          nd.list_size
        ) {
          setDetails(prev => {
            const prevServices = prev.services_offered || {};
            const hasPrevServices = Object.keys(prevServices).length > 0;

            return {
              ...prev,
              practice_name: prev.practice_name || practiceContext?.practiceName || nd.practice_name || "",
              address: prev.address || notewellAddress || "",
              postcode: prev.postcode || nd.postcode || "",
              ods_code: prev.ods_code || nd.ods_code || "",
              practice_manager_name: prev.practice_manager_name || notewellManager || "",
              lead_gp_name: prev.lead_gp_name || nd.lead_gp_name || "",
              caldicott_guardian: prev.caldicott_guardian || nd.caldicott_guardian || "",
              dpo_name: prev.dpo_name || nd.dpo_name || "",
              safeguarding_lead_adults: prev.safeguarding_lead_adults || nd.safeguarding_lead_adults || "",
              safeguarding_lead_children: prev.safeguarding_lead_children || nd.safeguarding_lead_children || "",
              infection_control_lead: prev.infection_control_lead || nd.infection_control_lead || "",
              complaints_lead: prev.complaints_lead || nd.complaints_lead || "",
              health_safety_lead: prev.health_safety_lead || nd.health_safety_lead || "",
              fire_safety_officer: prev.fire_safety_officer || nd.fire_safety_officer || "",
              list_size: prev.list_size ?? nd.list_size ?? persistedListSize ?? null,
              services_offered: hasPrevServices ? prevServices : (nd.services_offered || {}),
            };
          });
          setIsLoading(false);
        }

        // If we've already done the fallback DB load, don't do it again.
        if (hasLoadedFromDb || initialData) {
          setIsLoading(false);
          return;
        }

        // 2) Preferred DB source: user's Notewell practice_details (contains address from Practice Details screen)
        const { data: notewellDbDetails } = await supabase
          .from('practice_details')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (notewellDbDetails) {
          const pd: any = notewellDbDetails;
          setDetails(prev => ({
            ...prev,
            practice_name: prev.practice_name || pd.practice_name || "",
            address: prev.address || pd.address || "",
            // NOTE: practice_details may not have a separate postcode column in this project
            postcode: prev.postcode || pd.postcode || "",
            ods_code: prev.ods_code || pd.ods_code || "",
            practice_manager_name: prev.practice_manager_name || pd.practice_manager_name || "",
            lead_gp_name: prev.lead_gp_name || pd.lead_gp_name || "",
            caldicott_guardian: prev.caldicott_guardian || pd.caldicott_guardian || "",
            dpo_name: prev.dpo_name || pd.dpo_name || "",
            safeguarding_lead_adults: prev.safeguarding_lead_adults || pd.safeguarding_lead_adults || "",
            safeguarding_lead_children: prev.safeguarding_lead_children || pd.safeguarding_lead_children || "",
            infection_control_lead: prev.infection_control_lead || pd.infection_control_lead || "",
            complaints_lead: prev.complaints_lead || pd.complaints_lead || "",
            health_safety_lead: prev.health_safety_lead || pd.health_safety_lead || "",
            fire_safety_officer: prev.fire_safety_officer || pd.fire_safety_officer || "",
            list_size: prev.list_size ?? pd.list_size ?? persistedListSize ?? null,
            services_offered: Object.keys(prev.services_offered || {}).length > 0
              ? prev.services_offered
              : (pd.services_offered || {}),
          }));
          // Do NOT return here: some installs store address in gp_practices, while practice_details may only contain logo.
        }

        // Fallback: Get user's practice assignment from gp_practices
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('practice_id')
          .eq('user_id', user.id)
          .not('practice_id', 'is', null)
          .limit(1)
          .maybeSingle();

        if (roleData?.practice_id) {
          const { data: practiceData } = await supabase
            .from('gp_practices')
            .select('*')
            .eq('id', roleData.practice_id)
            .single();

          if (practiceData) {
            setDetails(prev => ({
              ...prev,
              practice_name: prev.practice_name || practiceData.name || "",
              address: prev.address || practiceData.address || "",
              postcode: prev.postcode || (practiceData as any).postcode || "",
              ods_code: prev.ods_code || (practiceData as any).practice_code || "",
              practice_manager_name: prev.practice_manager_name || (practiceData as any).practice_manager_name || "",
              lead_gp_name: prev.lead_gp_name || (practiceData as any).lead_gp_name || "",
              caldicott_guardian: prev.caldicott_guardian || (practiceData as any).caldicott_guardian || "",
              dpo_name: prev.dpo_name || (practiceData as any).dpo_name || "",
              safeguarding_lead_adults: prev.safeguarding_lead_adults || (practiceData as any).safeguarding_lead_adults || "",
              safeguarding_lead_children: prev.safeguarding_lead_children || (practiceData as any).safeguarding_lead_children || "",
              infection_control_lead: prev.infection_control_lead || (practiceData as any).infection_control_lead || "",
              complaints_lead: prev.complaints_lead || (practiceData as any).complaints_lead || "",
              health_safety_lead: prev.health_safety_lead || (practiceData as any).health_safety_lead || "",
              fire_safety_officer: prev.fire_safety_officer || (practiceData as any).fire_safety_officer || "",
              list_size: prev.list_size ?? (practiceData as any).list_size ?? persistedListSize ?? null,
              services_offered: Object.keys(prev.services_offered || {}).length > 0
                ? prev.services_offered
                : ((practiceData as any).services_offered || {}),
            }));
          }
        } else if (persistedListSize) {
          // Even if no practice found, apply persisted list size
          setDetails(prev => ({
            ...prev,
            list_size: persistedListSize,
          }));
        }
        setHasLoadedFromDb(true);
      } catch (error) {
        console.error('Error loading practice details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPracticeDetails();
  }, [user, hasLoadedFromDb, initialData, practiceContext, notewellPracticeDetails]);

  // Auto-submit when details change
  useEffect(() => {
    if (!isLoading) {
      onSubmit(details);
    }
  }, [details, isLoading]);

  const updateField = (field: keyof PracticeDetails, value: any) => {
    setDetails(prev => ({ ...prev, [field]: value }));
    
    // Persist list size when updated
    if (field === 'list_size' && value !== null && value > 0) {
      persistListSize(value);
    }
  };

  const toggleService = (key: string) => {
    setDetails(prev => ({
      ...prev,
      services_offered: {
        ...prev.services_offered,
        [key]: !prev.services_offered[key],
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading practice details...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Practice Info Header */}
      <div className="flex items-center gap-2 text-muted-foreground mb-4">
        <Building2 className="h-4 w-4" />
        <span className="text-sm">Practice details will be included in the generated policy</span>
      </div>

      {/* Core Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="practice_name">Practice Name *</Label>
          <Input
            id="practice_name"
            value={details.practice_name}
            onChange={(e) => updateField('practice_name', e.target.value)}
            placeholder="Enter practice name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ods_code">ODS Code</Label>
          <Input
            id="ods_code"
            value={details.ods_code}
            onChange={(e) => updateField('ods_code', e.target.value)}
            placeholder="e.g. A12345"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Practice Address *</Label>
        <Input
          id="address"
          value={details.address}
          onChange={(e) => updateField('address', e.target.value)}
          placeholder="Full address including postcode"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="practice_manager_name">Practice Manager *</Label>
          <Input
            id="practice_manager_name"
            value={details.practice_manager_name}
            onChange={(e) => updateField('practice_manager_name', e.target.value)}
            placeholder="Full name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lead_gp_name">Lead GP / Clinical Lead *</Label>
          <Input
            id="lead_gp_name"
            value={details.lead_gp_name}
            onChange={(e) => updateField('lead_gp_name', e.target.value)}
            placeholder="Full name"
            required
          />
        </div>
      </div>

      {/* Conditional Role Fields */}
      {(showCaldicott || showDPO) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {showCaldicott && (
            <div className="space-y-2">
              <Label htmlFor="caldicott_guardian">Caldicott Guardian</Label>
              <Input
                id="caldicott_guardian"
                value={details.caldicott_guardian}
                onChange={(e) => updateField('caldicott_guardian', e.target.value)}
                placeholder="Full name"
              />
            </div>
          )}
          {showDPO && (
            <div className="space-y-2">
              <Label htmlFor="dpo_name">Data Protection Officer</Label>
              <Input
                id="dpo_name"
                value={details.dpo_name}
                onChange={(e) => updateField('dpo_name', e.target.value)}
                placeholder="Full name"
              />
            </div>
          )}
        </div>
      )}

      {(showSafeguardingAdults || showSafeguardingChildren) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {showSafeguardingAdults && (
            <div className="space-y-2">
              <Label htmlFor="safeguarding_lead_adults">Safeguarding Lead - Adults</Label>
              <Input
                id="safeguarding_lead_adults"
                value={details.safeguarding_lead_adults}
                onChange={(e) => updateField('safeguarding_lead_adults', e.target.value)}
                placeholder="Full name"
              />
            </div>
          )}
          {showSafeguardingChildren && (
            <div className="space-y-2">
              <Label htmlFor="safeguarding_lead_children">Safeguarding Lead - Children</Label>
              <Input
                id="safeguarding_lead_children"
                value={details.safeguarding_lead_children}
                onChange={(e) => updateField('safeguarding_lead_children', e.target.value)}
                placeholder="Full name"
              />
            </div>
          )}
        </div>
      )}

      {showInfectionControl && (
        <div className="space-y-2">
          <Label htmlFor="infection_control_lead">Infection Control Lead</Label>
          <Input
            id="infection_control_lead"
            value={details.infection_control_lead}
            onChange={(e) => updateField('infection_control_lead', e.target.value)}
            placeholder="Full name"
          />
        </div>
      )}

      {showComplaints && (
        <div className="space-y-2">
          <Label htmlFor="complaints_lead">Complaints Lead</Label>
          <Input
            id="complaints_lead"
            value={details.complaints_lead}
            onChange={(e) => updateField('complaints_lead', e.target.value)}
            placeholder="Full name"
          />
        </div>
      )}

      {(showHealthSafety || showFireSafety) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {showHealthSafety && (
            <div className="space-y-2">
              <Label htmlFor="health_safety_lead">Health & Safety Lead</Label>
              <Input
                id="health_safety_lead"
                value={details.health_safety_lead}
                onChange={(e) => updateField('health_safety_lead', e.target.value)}
                placeholder="Full name"
              />
            </div>
          )}
          {showFireSafety && (
            <div className="space-y-2">
              <Label htmlFor="fire_safety_officer">Fire Safety Officer</Label>
              <Input
                id="fire_safety_officer"
                value={details.fire_safety_officer}
                onChange={(e) => updateField('fire_safety_officer', e.target.value)}
                placeholder="Full name"
              />
            </div>
          )}
        </div>
      )}

      {/* List Size */}
      <div className="space-y-2">
        <Label htmlFor="list_size">Approximate List Size</Label>
        <Input
          id="list_size"
          type="number"
          value={details.list_size || ''}
          onChange={(e) => updateField('list_size', e.target.value ? parseInt(e.target.value) : null)}
          placeholder="Number of patients"
        />
      </div>

      {/* Services Offered */}
      <div className="space-y-3">
        <Label>Services Offered</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {serviceOptions.map(service => (
            <div key={service.key} className="flex items-center space-x-2">
              <Checkbox
                id={service.key}
                checked={details.services_offered[service.key] || false}
                onCheckedChange={() => toggleService(service.key)}
              />
              <Label htmlFor={service.key} className="text-sm font-normal cursor-pointer">
                {service.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
