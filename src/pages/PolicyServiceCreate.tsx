import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, FileText, Loader2, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PolicyTypeSelector } from "@/components/policy/PolicyTypeSelector";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { PolicyReference } from "@/hooks/usePolicyReferenceLibrary";

const PolicyServiceCreate = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyReference | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handlePolicySelect = (policy: PolicyReference) => {
    setSelectedPolicy(policy);
  };

  const handleGenerate = () => {
    if (!selectedPolicy) {
      toast.error("Please select a policy type");
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmGenerate = async () => {
    setShowConfirm(false);
    if (!selectedPolicy || !user) return;

    setIsSubmitting(true);
    try {
      // Fetch practice details for the job
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

      // Insert background job
      const { error: insertError } = await supabase
        .from('policy_generation_jobs')
        .insert({
          user_id: user.id,
          policy_reference_id: selectedPolicy.id,
          policy_title: selectedPolicy.policy_name,
          practice_details: practiceDetails as any,
          email_when_ready: false,
          status: 'pending',
        });

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

      toast.success("Policy queued — track progress on My Policies", { duration: 5000 });
      navigate('/policy-service/my-policies');
    } catch (error) {
      console.error("Background generation error:", error);
      toast.error("Failed to queue policy generation");
    } finally {
      setIsSubmitting(false);
    }
  };

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

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>Select Policy Type</CardTitle>
            <CardDescription>
              Search and select the policy type you want to create
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PolicyTypeSelector
              selectedPolicy={selectedPolicy}
              onSelect={handlePolicySelect}
            />
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => navigate('/policy-service')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancel
          </Button>

          <Button onClick={handleGenerate} disabled={isSubmitting || !selectedPolicy}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Queuing...
              </>
            ) : (
              <>
                Generate Policy
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </main>

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Please Allow Time for Generation
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-3">
              <p>
                This comprehensive policy document will take between <strong>5 and 10 minutes</strong> to produce. It goes through a full and detailed review with a separate AI service to ensure regulatory compliance, so please be patient.
              </p>
              <p>
                The completed policy will appear on <strong>My Policies</strong> when ready. You can continue using other features while it generates.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmGenerate}>
              Continue &amp; Generate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PolicyServiceCreate;
