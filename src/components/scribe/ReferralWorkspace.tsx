import React, { useState, useEffect } from 'react';
import { useReferralWorkspace } from '@/hooks/useReferralWorkspace';
import { ReferralSuggestionCard } from './ReferralSuggestionCard';
import { ReferralEditorModal } from './ReferralEditorModal';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Loader2, 
  FileText,
  AlertCircle,
  Send,
  ExternalLink,
  Check
} from 'lucide-react';
import { ReferralSuggestion, PRIORITY_LABELS, PRIORITY_COLOURS, ReferralPriority } from '@/types/referral';
import { supabase } from '@/integrations/supabase/client';

interface PracticeDetails {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  signature?: string;
}

interface ReferralWorkspaceProps {
  transcript?: string;
  notes?: any;
  consultationType?: string;
  userId?: string;
  patientContext?: {
    name?: string;
    dob?: string;
    nhsNumber?: string;
    address?: string;
  };
}

export function ReferralWorkspace({
  transcript,
  notes,
  consultationType,
  userId,
  patientContext
}: ReferralWorkspaceProps) {
  const {
    suggestions,
    extractedFacts,
    currentDraft,
    isAnalysing,
    isGeneratingDraft,
    isRewriting,
    error,
    analyseSuggestions,
    generateDraft,
    rewriteTone,
    updateDraftContent,
    confirmDraft,
    unconfirmDraft,
    setSafetyNetting,
    clearDraft,
    copyToClipboard
  } = useReferralWorkspace({
    transcript,
    notes,
    consultationType,
    userId,
    patientContext
  });

  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [practiceDetails, setPracticeDetails] = useState<PracticeDetails | null>(null);

  // Fetch practice details and GP signature for letterhead
  useEffect(() => {
    const fetchPracticeDetails = async () => {
      if (!userId) return;
      
      try {
        // Fetch practice details
        let practiceData: any = null;
        
        // First try to get the default practice
        const { data: defaultPractice } = await supabase
          .from('practice_details')
          .select('practice_name, address, phone, email, practice_logo_url, letter_signature')
          .eq('user_id', userId)
          .eq('is_default', true)
          .maybeSingle();
        
        if (defaultPractice) {
          practiceData = defaultPractice;
        } else {
          // Fallback to most recent practice
          const { data: anyPractice } = await supabase
            .from('practice_details')
            .select('practice_name, address, phone, email, practice_logo_url, letter_signature')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          practiceData = anyPractice;
        }

        // Use clinician signature from GP Scribe settings ("My Profile"), not the practice letter signature
        const { data: gpSignature } = await supabase
          .from('gp_signature_settings')
          .select('gp_name, job_title, gmc_number, practice_name')
          .eq('user_id', userId)
          .eq('is_default', true)
          .maybeSingle();

        const signatureHtml = gpSignature
          ? [
              gpSignature.gp_name ? `<p><strong>${gpSignature.gp_name}</strong></p>` : '',
              gpSignature.job_title ? `<p>${gpSignature.job_title}</p>` : '',
              gpSignature.gmc_number ? `<p>GMC: ${gpSignature.gmc_number}</p>` : '',
              gpSignature.practice_name || practiceData?.practice_name
                ? `<p>${gpSignature.practice_name || practiceData?.practice_name}</p>`
                : '',
            ]
              .filter(Boolean)
              .join('')
          : (practiceData?.letter_signature || '');

        if (practiceData) {
          setPracticeDetails({
            name: practiceData.practice_name,
            address: practiceData.address || undefined,
            phone: practiceData.phone || undefined,
            email: practiceData.email || undefined,
            logoUrl: practiceData.practice_logo_url || undefined,
            signature: signatureHtml || undefined,
          });
        }
      } catch (error) {
        console.error('Error fetching practice details:', error);
      }
    };

    fetchPracticeDetails();
  }, [userId]);

  const handleGenerateDraft = async (suggestion: ReferralSuggestion) => {
    setSelectedSuggestionId(suggestion.id);
    await generateDraft(suggestion);
    setIsModalOpen(true);
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleClearDraft = () => {
    clearDraft();
    setSelectedSuggestionId(null);
    setIsModalOpen(false);
  };

  const hasConsultationData = Boolean(transcript || notes);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Referral Workspace</h2>
        </div>
        
        {hasConsultationData && !currentDraft && (
          <Button
            onClick={analyseSuggestions}
            disabled={isAnalysing}
            size="sm"
          >
            {isAnalysing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analysing...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Analyse for Referrals
              </>
            )}
          </Button>
        )}

        {currentDraft && (
          <div className="flex items-center gap-2">
            <Button
              onClick={handleClearDraft}
              variant="ghost"
              size="sm"
            >
              New Referral
            </Button>
          </div>
        )}
      </div>

      {/* Referral Editor Modal */}
      {currentDraft && (
        <ReferralEditorModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          draft={currentDraft}
          onContentChange={updateDraftContent}
          onToneRewrite={rewriteTone}
          onSafetyNettingChange={setSafetyNetting}
          onConfirm={confirmDraft}
          onUnconfirm={unconfirmDraft}
          isRewriting={isRewriting}
          practiceDetails={practiceDetails || undefined}
        />
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 pt-4">
        {!hasConsultationData ? (
          // No consultation data
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No Consultation Data</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Complete a consultation first to analyse for referral suggestions.
              </p>
            </CardContent>
          </Card>
        ) : error ? (
          // Error state
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center py-12">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="font-medium mb-2">Analysis Failed</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-4">
                {error}
              </p>
              <Button onClick={analyseSuggestions} variant="outline">
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : currentDraft ? (
          // Draft ready - show summary card with option to open modal
          <Card className="h-full">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center text-center py-8 space-y-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  {currentDraft.clinicianConfirmed ? (
                    <Check className="h-8 w-8 text-green-600" />
                  ) : (
                    <FileText className="h-8 w-8 text-primary" />
                  )}
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{currentDraft.recipientService}</h3>
                  <p className="text-sm text-muted-foreground">{currentDraft.specialty}</p>
                  <Badge className={PRIORITY_COLOURS[currentDraft.urgency as ReferralPriority] || 'bg-muted'}>
                    {PRIORITY_LABELS[currentDraft.urgency as ReferralPriority] || currentDraft.urgency}
                  </Badge>
                </div>
                {currentDraft.clinicianConfirmed && (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <Check className="h-3 w-3 mr-1" />
                    Confirmed
                  </Badge>
                )}
                <Button onClick={handleOpenModal} className="mt-4">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Referral Letter
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : suggestions.length > 0 ? (
          // Suggestions list
          <ScrollArea className="h-full">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pr-4">
              {suggestions.map((suggestion) => (
                <ReferralSuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onGenerateDraft={handleGenerateDraft}
                  isGenerating={isGeneratingDraft && selectedSuggestionId === suggestion.id}
                  isSelected={selectedSuggestionId === suggestion.id}
                />
              ))}
            </div>

            {/* Extracted facts summary */}
            {extractedFacts && (
              <Card className="mt-6">
                <CardContent className="pt-4">
                  <h4 className="text-sm font-medium mb-3">Extracted Clinical Facts</h4>
                  <div className="grid gap-2 text-xs">
                    {extractedFacts.symptoms.length > 0 && (
                      <div>
                        <span className="font-medium text-muted-foreground">Symptoms:</span>{' '}
                        {extractedFacts.symptoms.join(', ')}
                      </div>
                    )}
                    {extractedFacts.riskFactors.length > 0 && (
                      <div>
                        <span className="font-medium text-muted-foreground">Risk Factors:</span>{' '}
                        {extractedFacts.riskFactors.join(', ')}
                      </div>
                    )}
                    {extractedFacts.negatives.length > 0 && (
                      <div>
                        <span className="font-medium text-muted-foreground">Negatives:</span>{' '}
                        {extractedFacts.negatives.join(', ')}
                      </div>
                    )}
                    {extractedFacts.medications.length > 0 && (
                      <div>
                        <span className="font-medium text-muted-foreground">Medications:</span>{' '}
                        {extractedFacts.medications.join(', ')}
                      </div>
                    )}
                    {extractedFacts.investigations.length > 0 && (
                      <div>
                        <span className="font-medium text-muted-foreground">Investigations:</span>{' '}
                        {extractedFacts.investigations.join(', ')}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </ScrollArea>
        ) : isAnalysing ? (
          // Loading state
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center py-12">
              <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
              <h3 className="font-medium mb-2">Analysing Consultation</h3>
              <p className="text-sm text-muted-foreground">
                Identifying potential referral pathways...
              </p>
            </CardContent>
          </Card>
        ) : (
          // Ready to analyse
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center py-12">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Ready to Analyse</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-4">
                Click "Analyse for Referrals" to identify potential referral pathways based on this consultation.
              </p>
              <Button onClick={analyseSuggestions}>
                <Search className="h-4 w-4 mr-2" />
                Analyse for Referrals
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer disclaimer */}
      <div className="pt-4 border-t mt-4 shrink-0">
        <p className="text-xs text-muted-foreground text-center italic">
          AI-assisted referral drafting tool. All suggestions are advisory only — final clinical decisions rest with the clinician.
        </p>
      </div>
    </div>
  );
}
