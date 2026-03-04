import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, FileText, Loader2, Mail, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PolicyTypeSelector } from "@/components/policy/PolicyTypeSelector";
import { PracticeDetailsForm } from "@/components/policy/PracticeDetailsForm";
import { PolicyPreviewPanel } from "@/components/policy/PolicyPreviewPanel";
import { usePolicyGeneration } from "@/hooks/usePolicyGeneration";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { PolicyReference } from "@/hooks/usePolicyReferenceLibrary";
import { usePolicyCompletions } from "@/hooks/usePolicyCompletions";

interface PracticeDetails {
  practice_name: string;
  address: string;
  postcode: string;
  ods_code: string;
  practice_manager_name: string;
  lead_gp_name: string;
  senior_gp_partner: string;
  caldicott_guardian: string;
  dpo_name: string;
  siro: string;
  safeguarding_lead_adults: string;
  safeguarding_lead_children: string;
  infection_control_lead: string;
  complaints_lead: string;
  health_safety_lead: string;
  fire_safety_officer: string;
  list_size: number | null;
  services_offered: Record<string, boolean>;
  // Branch site fields
  clinical_system?: string;
  has_branch_site?: boolean;
  branch_site_name?: string;
  branch_site_address?: string;
  branch_site_postcode?: string;
  branch_site_phone?: string;
}

const PolicyServiceCreate = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyReference | null>(null);
  const [practiceDetails, setPracticeDetails] = useState<PracticeDetails | null>(null);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [generatedMetadata, setGeneratedMetadata] = useState<any>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [practiceLogoUrl, setPracticeLogoUrl] = useState<string | null>(null);
  const [wasEnhanced, setWasEnhanced] = useState(false);
  const [enhancementWarning, setEnhancementWarning] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(180);
  const [emailWhenReady, setEmailWhenReady] = useState(false);
  const [isSubmittingBackground, setIsSubmittingBackground] = useState(false);
  const { generatePolicy, isGenerating, isEnhancing } = usePolicyGeneration();
  const { saveCompletion } = usePolicyCompletions();

  // Countdown timer during generation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating || isEnhancing) {
      setCountdown(180);
      interval = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating, isEnhancing]);

  // Fetch practice logo URL
  useEffect(() => {
    const fetchPracticeLogo = async () => {
      if (!user) return;
      
      try {
        const { data } = await supabase
          .from('practice_details')
          .select('logo_url, practice_logo_url')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (data) {
          setPracticeLogoUrl(data.practice_logo_url || data.logo_url || null);
        }
      } catch (error) {
        console.error('Error fetching practice logo:', error);
      }
    };
    
    fetchPracticeLogo();
  }, [user]);

  const steps = [
    { number: 1, title: "Select Policy Type" },
    { number: 2, title: "Confirm Practice Details" },
    { number: 3, title: "Review & Download" },
  ];

  const handlePolicySelect = (policy: PolicyReference) => {
    setSelectedPolicy(policy);
  };

  const handlePracticeDetailsSubmit = (details: PracticeDetails) => {
    setPracticeDetails(details);
  };

  const handleGenerate = async () => {
    if (!selectedPolicy || !practiceDetails) {
      toast.error("Please complete all required fields");
      return;
    }

    try {
      const result = await generatePolicy({
        policyReferenceId: selectedPolicy.id,
        practiceDetails,
      });

      if (result) {
        setGeneratedContent(result.content);
        setGeneratedMetadata(result.metadata);
        setGenerationId(result.generationId);
        setWasEnhanced(result.enhanced);
        setEnhancementWarning(result.enhancementWarning || null);
        setStep(3);

        // Auto-save to My Policies so completed policies always appear
        await saveCompletion({
          policyReferenceId: selectedPolicy.id,
          policyTitle: result.metadata.title,
          policyContent: result.content,
          metadata: result.metadata,
          practiceId: null,
        });
      }
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("Failed to generate policy. Please try again.");
    }
  };

  const handleBackgroundGenerate = async () => {
    if (!selectedPolicy || !practiceDetails || !user) {
      toast.error("Please complete all required fields");
      return;
    }

    setIsSubmittingBackground(true);
    try {
      // Insert job row
      const { error: insertError } = await supabase
        .from('policy_generation_jobs')
        .insert({
          user_id: user.id,
          policy_reference_id: selectedPolicy.id,
          policy_title: selectedPolicy.policy_name,
          practice_details: practiceDetails as any,
          email_when_ready: emailWhenReady,
          status: 'pending',
        });

      if (insertError) throw insertError;

      // Fire-and-forget: trigger the process-job action
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
        }).catch(() => {}); // Fire and forget
      }

      toast.success(
        emailWhenReady
          ? "Policy queued — you'll receive an email when it's ready"
          : "Policy queued — track progress on My Policies",
        { duration: 5000 }
      );

      navigate('/policy-service/my-policies');
    } catch (error) {
      console.error("Background generation error:", error);
      toast.error("Failed to queue policy generation");
    } finally {
      setIsSubmittingBackground(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && !selectedPolicy) {
      toast.error("Please select a policy type");
      return;
    }
    if (step === 2) {
      handleGenerate();
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    if (step === 1) {
      navigate('/policy-service');
    } else {
      setStep(step - 1);
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

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8 max-w-lg mx-auto">
          {steps.map((s, index) => (
            <div key={s.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    step > s.number
                      ? "bg-primary text-primary-foreground"
                      : step === s.number
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s.number ? <Check className="h-5 w-5" /> : s.number}
                </div>
                <span className="text-xs mt-2 text-center max-w-[80px]">
                  {s.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-16 sm:w-24 h-0.5 mx-2 ${
                    step > s.number ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>{steps[step - 1].title}</CardTitle>
            <CardDescription>
              {step === 1 && "Search and select the policy type you want to create"}
              {step === 2 && "Review and confirm your practice details for the policy"}
              {step === 3 && "Review your generated policy and download it"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 1 && (
              <PolicyTypeSelector
                selectedPolicy={selectedPolicy}
                onSelect={handlePolicySelect}
              />
            )}
            {step === 2 && (
              <PracticeDetailsForm
                selectedPolicy={selectedPolicy}
                onSubmit={handlePracticeDetailsSubmit}
                initialData={practiceDetails}
              />
            )}
            {step === 3 && generatedContent && (
              <PolicyPreviewPanel
                content={generatedContent}
                metadata={generatedMetadata}
                policyName={selectedPolicy?.policy_name || "Policy"}
                policyReferenceId={selectedPolicy?.id}
                practiceId={null}
                generationId={generationId}
                practiceDetails={practiceDetails || undefined}
                practiceLogoUrl={practiceLogoUrl}
                wasEnhanced={wasEnhanced}
                enhancementWarning={enhancementWarning}
              />
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex flex-col gap-4 mt-6">
          {step === 2 && (
            <Card className="bg-muted/50 border-dashed">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="emailWhenReady"
                      checked={emailWhenReady}
                      onCheckedChange={(checked) => setEmailWhenReady(!!checked)}
                    />
                    <Label htmlFor="emailWhenReady" className="text-sm cursor-pointer flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      Email me when ready
                    </Label>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={handleBackgroundGenerate}
                    disabled={isGenerating || isEnhancing || isSubmittingBackground}
                    className="gap-2"
                  >
                    {isSubmittingBackground ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Clock className="h-4 w-4" />
                    )}
                    Generate in Background
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Queue this policy and continue working. It will appear on My Policies when complete.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {step === 1 ? "Cancel" : "Back"}
            </Button>
            
            {step < 3 && (
              <Button onClick={handleNext} disabled={isGenerating || isEnhancing}>
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Ready in {countdown} seconds...
                  </>
                ) : isEnhancing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enhancing... {countdown}s
                  </>
                ) : (
                  <>
                    {step === 2 ? "Generate Policy" : "Next"}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
            
            {step === 3 && (
              <Button onClick={() => navigate('/policy-service')}>
                Create Another Policy
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PolicyServiceCreate;
