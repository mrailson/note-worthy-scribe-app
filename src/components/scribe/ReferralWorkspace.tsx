import React, { useEffect } from 'react';
import { useReferralWorkspace } from '@/hooks/useReferralWorkspace';
import { ReferralSuggestionCard } from './ReferralSuggestionCard';
import { ReferralDraftEditor } from './ReferralDraftEditor';
import { ReferralConfirmationGate } from './ReferralConfirmationGate';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, 
  Loader2, 
  FileText,
  ArrowLeft,
  AlertCircle,
  Send
} from 'lucide-react';
import { ReferralSuggestion } from '@/types/referral';

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

  const [selectedSuggestionId, setSelectedSuggestionId] = React.useState<string | null>(null);

  const handleGenerateDraft = async (suggestion: ReferralSuggestion) => {
    setSelectedSuggestionId(suggestion.id);
    await generateDraft(suggestion);
  };

  const handleBackToSuggestions = () => {
    clearDraft();
    setSelectedSuggestionId(null);
  };

  // Auto-analyse on mount if we have data
  useEffect(() => {
    if ((transcript || notes) && suggestions.length === 0 && !isAnalysing) {
      // Don't auto-analyse, let user trigger it
    }
  }, []);

  const hasConsultationData = Boolean(transcript || notes);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Referral Workspace</h2>
        </div>
        
        {!currentDraft && hasConsultationData && (
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
          <Button
            onClick={handleBackToSuggestions}
            variant="ghost"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Suggestions
          </Button>
        )}
      </div>

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
          // Draft editor view
          <div className="h-full flex flex-col lg:flex-row gap-4">
            <div className="flex-1 min-h-0">
              <ReferralDraftEditor
                draft={currentDraft}
                onContentChange={updateDraftContent}
                onToneRewrite={rewriteTone}
                onSafetyNettingChange={setSafetyNetting}
                isRewriting={isRewriting}
              />
            </div>
            <div className="lg:w-80 shrink-0">
              <ReferralConfirmationGate
                draft={currentDraft}
                onConfirm={confirmDraft}
                onUnconfirm={unconfirmDraft}
                onCopy={copyToClipboard}
              />
            </div>
          </div>
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
