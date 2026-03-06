import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, FileText, Loader2, Clock, X, Layers } from "lucide-react";
import { getPolicyGenerationModel } from "@/components/policy/PolicyGenerationModelSettings";
import { useNavigate } from "react-router-dom";
import { PolicyTypeSelector } from "@/components/policy/PolicyTypeSelector";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PolicyReference } from "@/hooks/usePolicyReferenceLibrary";

const MAX_ACTIVE_JOBS_SONNET = 3;
const MAX_ACTIVE_JOBS_BUDGET = 10;

const BUDGET_MODELS: string[] = ['claude-haiku-4-5', 'gpt-4o-mini', 'gemini-2.5-flash', 'gemini-2.0-flash'];

const DEFAULT_LENGTH = 'full';

const PolicyServiceCreate = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyReference | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  

  // Batch mode state
  const [batchMode, setBatchMode] = useState(false);
  const [selectedPolicies, setSelectedPolicies] = useState<PolicyReference[]>([]);
  const [activeJobCount, setActiveJobCount] = useState(0);
  const [loadingSlots, setLoadingSlots] = useState(true);

  const currentModel = getPolicyGenerationModel();
  const isBudgetModel = BUDGET_MODELS.includes(currentModel);
  const maxActiveJobs = isBudgetModel ? MAX_ACTIVE_JOBS_BUDGET : MAX_ACTIVE_JOBS_SONNET;
  const availableSlots = Math.max(0, maxActiveJobs - activeJobCount);

  // Fetch active job count on mount
  useEffect(() => {
    if (!user) return;
    const fetchActiveCount = async () => {
      setLoadingSlots(true);
      try {
        const { count, error } = await supabase
          .from('policy_generation_jobs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .in('status', ['pending', 'generating', 'enhancing']);
        if (!error && count !== null) setActiveJobCount(count);
      } catch (e) {
        console.error('Failed to fetch active job count:', e);
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchActiveCount();
  }, [user]);

  const handlePolicySelect = (policy: PolicyReference) => {
    setSelectedPolicy(policy);
  };

  const handleAddToBatch = (policy: PolicyReference) => {
    if (selectedPolicies.length >= availableSlots) return;
    if (selectedPolicies.some(p => p.id === policy.id)) return;
    setSelectedPolicies(prev => [...prev, policy]);
  };

  const handleRemoveFromBatch = (policyId: string) => {
    setSelectedPolicies(prev => prev.filter(p => p.id !== policyId));
  };

  const handleGenerate = () => {
    if (batchMode) {
      if (selectedPolicies.length === 0) {
        toast.error("Please add at least one policy to the batch");
        return;
      }
    } else {
      if (!selectedPolicy) {
        toast.error("Please select a policy type");
        return;
      }
    }
    handleConfirmGenerate();
  };

  const handleConfirmGenerate = async () => {
    if (!user) return;

    const policiesToGenerate = batchMode 
      ? selectedPolicies.map(p => ({ ...p, _length: DEFAULT_LENGTH }))
      : (selectedPolicy ? [{ ...selectedPolicy, _length: DEFAULT_LENGTH }] : []);
    if (policiesToGenerate.length === 0) return;

    // Re-check slot availability
    const { count } = await supabase
      .from('policy_generation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['pending', 'generating', 'enhancing']);

    const currentActive = count ?? 0;
    if (currentActive + policiesToGenerate.length > maxActiveJobs) {
      toast.error(`You can only have ${maxActiveJobs} active jobs. You currently have ${currentActive}.`);
      setActiveJobCount(currentActive);
      return;
    }

    setIsSubmitting(true);
    try {
      // Fetch practice details once
      const { data: practiceData } = await supabase
        .from('practice_details')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle();

      const practiceDetails = practiceData ? {
        practice_name: practiceData.practice_name || '',
        address: practiceData.address || '',
        postcode: (practiceData as any).postcode || '',
        ods_code: (practiceData as any).ods_code || '',
        practice_manager_name: practiceData.practice_manager_name || '',
        lead_gp_name: practiceData.lead_gp_name || '',
        senior_gp_partner: (practiceData as any).senior_gp_partner || '',
        caldicott_guardian: (practiceData as any).caldicott_guardian || '',
        dpo_name: (practiceData as any).dpo_name || '',
        siro: (practiceData as any).siro || '',
        safeguarding_lead_adults: (practiceData as any).safeguarding_lead_adults || '',
        safeguarding_lead_children: (practiceData as any).safeguarding_lead_children || '',
        infection_control_lead: (practiceData as any).infection_control_lead || '',
        complaints_lead: (practiceData as any).complaints_lead || '',
        health_safety_lead: (practiceData as any).health_safety_lead || '',
        fire_safety_officer: (practiceData as any).fire_safety_officer || '',
        list_size: (practiceData as any).list_size || null,
        services_offered: (practiceData as any).services_offered || {},
        clinical_system: (practiceData as any).clinical_system || '',
        has_branch_site: (practiceData as any).has_branch_site || false,
        branch_site_name: (practiceData as any).branch_site_name || '',
        branch_site_address: (practiceData as any).branch_site_address || '',
        branch_site_postcode: (practiceData as any).branch_site_postcode || '',
        branch_site_phone: (practiceData as any).branch_site_phone || '',
      } : null;

      const selectedModel = getPolicyGenerationModel();
      
      // Insert one job per policy
      const rows = policiesToGenerate.map(policy => ({
        user_id: user.id,
        policy_reference_id: policy.id,
        policy_title: policy.policy_name,
        practice_details: practiceDetails as any,
        email_when_ready: false,
        status: 'pending' as const,
        metadata: { 
          generation_model: selectedModel, 
          policy_length: (policy as any)._length || 'full',
        } as any,
      }));

      const { error: insertError } = await supabase
        .from('policy_generation_jobs')
        .insert(rows);

      if (insertError) throw insertError;

      // Fire-and-forget: trigger the queue processor
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        fetch(`${supabaseUrl}/functions/v1/generate-policy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: 'process-job', job_user_id: user.id }),
        }).catch(() => {});
      }

      const policyWord = policiesToGenerate.length === 1 ? 'Policy' : 'Policies';
      toast.success(`${policiesToGenerate.length} ${policyWord} queued — track progress on My Policies`, { duration: 5000 });
      navigate('/policy-service/my-policies');
    } catch (error) {
      console.error("Background generation error:", error);
      toast.error("Failed to queue policy generation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateButtonLabel = () => {
    if (isSubmitting) return null;
    if (batchMode) {
      const count = selectedPolicies.length;
      if (count === 0) return 'Generate Policies';
      return `Generate ${count} ${count === 1 ? 'Policy' : 'Policies'}`;
    }
    return 'Generate Policy';
  };

  const canGenerate = batchMode ? selectedPolicies.length > 0 : !!selectedPolicy;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/policy-service')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Practice Policies
        </Button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <FileText className="h-8 w-8 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold">Create New Policy</h1>
        </div>

        {/* Mode Toggle */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="batch-mode" className="text-sm font-medium cursor-pointer">
                    Batch Mode
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Generate up to {availableSlots} {availableSlots === 1 ? 'policy' : 'policies'} at once
                    {isBudgetModel && <span className="text-primary ml-1">(Budget model — up to {MAX_ACTIVE_JOBS_BUDGET})</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {loadingSlots ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : availableSlots === 0 ? (
                  <span className="text-xs text-destructive font-medium">Queue full ({maxActiveJobs}/{maxActiveJobs} active)</span>
                ) : (
                  <Switch
                    id="batch-mode"
                    checked={batchMode}
                    onCheckedChange={(checked) => {
                      setBatchMode(checked);
                      if (!checked) {
                        setSelectedPolicies([]);
                      } else {
                        setSelectedPolicy(null);
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>Select Policy Type</CardTitle>
            <CardDescription>
              {batchMode
                ? `Add up to ${availableSlots} policies to your batch`
                : 'Search and select the policy type you want to create'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PolicyTypeSelector
              selectedPolicy={selectedPolicy}
              onSelect={handlePolicySelect}
              batchMode={batchMode}
              selectedPolicies={selectedPolicies}
              onAddToBatch={handleAddToBatch}
              maxSelections={availableSlots}
            />
          </CardContent>
        </Card>

        {/* Batch Basket */}
        {batchMode && (
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Batch Queue
                </CardTitle>
                <Badge variant={selectedPolicies.length >= availableSlots ? "default" : "secondary"}>
                  {selectedPolicies.length}/{availableSlots}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {selectedPolicies.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No policies added yet. Use the "+ Add" buttons above to add policies to your batch.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedPolicies.map((policy) => (
                    <div
                      key={policy.id}
                      className="flex items-center justify-between p-3 rounded-md border bg-primary/5 border-primary/20 gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-medium truncate">{policy.policy_name}</span>
                        <Badge variant="outline" className={`text-xs shrink-0 ${kloeColors[policy.cqc_kloe] || ''}`}>
                          {policy.cqc_kloe}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveFromBatch(policy.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {selectedPolicies.length < availableSlots && (
                    <p className="text-xs text-muted-foreground pt-1">
                      {availableSlots - selectedPolicies.length} more {availableSlots - selectedPolicies.length === 1 ? 'slot' : 'slots'} available
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => navigate('/policy-service')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancel
          </Button>

          <Button onClick={handleGenerate} disabled={isSubmitting || !canGenerate}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Queuing...
              </>
            ) : (
              <>
                {generateButtonLabel()}
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </main>

    </div>
  );
};

// Need kloeColors for basket badges
const kloeColors: Record<string, string> = {
  'Safe': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'Effective': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'Caring': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  'Responsive': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'Well-led': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export default PolicyServiceCreate;
