import React, { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import {
  Briefcase,
  Headphones,
  LayoutPanelTop,
  Presentation,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { ComplaintAudioOverviewPlayer } from '@/components/complaints/ComplaintAudioOverviewPlayer';
import { ComplaintReviewConversation } from '@/components/complaints/ComplaintReviewConversation';
import { ComplaintInfographicModal } from '@/components/complaints/ComplaintInfographicModal';
import { ComplaintPowerPointModal } from '@/components/complaints/ComplaintPowerPointModal';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import { format } from 'date-fns';

interface ExecutiveBriefingSuiteProps {
  complaint: {
    id: string;
    reference_number: string;
    category: string;
    received_at?: string;
    created_at: string;
    complaint_outcomes?: Array<{ outcome_type?: string }>;
  };
  audioOverview: {
    audio_overview_url?: string | null;
    audio_overview_text?: string | null;
    audio_overview_duration?: number | null;
  } | null;
  reviewConversations: any[];
  isGeneratingAudio?: boolean;
  onRegenerateAudio: () => void;
  onRefresh: () => void;
  onReviewComplete: () => void;
  onRegenerateSummary: (conversationId: string, newSummary: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AIReportData {
  complaintOverview: string;
  keyLearnings: Array<{ learning: string; category: string; impact: string }>;
  practiceStrengths: string[];
  improvementSuggestions: Array<{ suggestion: string; rationale: string; priority: string }>;
  outcomeRationale: string;
}

export const ExecutiveBriefingSuite: React.FC<ExecutiveBriefingSuiteProps> = ({
  complaint,
  audioOverview,
  reviewConversations,
  isGeneratingAudio = false,
  onRegenerateAudio,
  onRefresh,
  onReviewComplete,
  onRegenerateSummary,
  isOpen,
  onOpenChange,
}) => {
  const [showInfographicModal, setShowInfographicModal] = useState(false);
  const [showPowerPointModal, setShowPowerPointModal] = useState(false);
  const [aiReportData, setAiReportData] = useState<AIReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const reportFetchedRef = useRef<string | null>(null);
  const reportDataRef = useRef<AIReportData | null>(null);
  const inFlightRef = useRef(false);

  const fetchAIReportData = useCallback(async (): Promise<AIReportData | null> => {
    // Return cached data if already fetched for this complaint
    if (reportDataRef.current && reportFetchedRef.current === complaint.id) {
      return reportDataRef.current;
    }

    // Prevent parallel fetches
    if (inFlightRef.current) {
      return null;
    }

    inFlightRef.current = true;
    setLoadingReport(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'generate-complaint-ai-report',
        { body: { complaintId: complaint.id } }
      );

      if (error) throw error;
      if (!data) throw new Error('No report data returned');

      reportFetchedRef.current = complaint.id;
      reportDataRef.current = data;
      setAiReportData(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch AI report data:', err);
      showToast.error('Failed to load AI report data. Please try again.');
      return null;
    } finally {
      setLoadingReport(false);
      inFlightRef.current = false;
    }
  }, [complaint.id]); // No aiReportData dependency — use ref instead

  const handleInfographicClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const data = await fetchAIReportData();
    if (data) {
      setShowInfographicModal(true);
    }
  }, [fetchAIReportData]);

  const handlePowerPointClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const data = await fetchAIReportData();
    if (data) {
      setShowPowerPointModal(true);
    }
  }, [fetchAIReportData]);

  const receivedDate = format(
    new Date(complaint.received_at || complaint.created_at),
    'dd MMMM yyyy'
  );
  const outcomeType = complaint.complaint_outcomes?.[0]?.outcome_type;

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50">
          <CardHeader>
            <div className="flex items-start justify-between w-full">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex-1 justify-between p-0 h-auto hover:bg-transparent"
                >
                  <div className="text-left">
                    <CardTitle className="flex items-center gap-2 text-indigo-800">
                      <Briefcase className="h-5 w-5" />
                      Executive Briefing Suite
                    </CardTitle>
                    <CardDescription className="text-indigo-600">
                      AI-powered briefing tools for management, partners and PLT sessions
                    </CardDescription>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 text-indigo-800" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-indigo-800" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRefresh();
                }}
                className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100"
                title="Refresh briefing data"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="space-y-5">
              {/* Three briefing tools grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Audio Briefing */}
                <div className="rounded-xl border border-indigo-200 bg-white/80 backdrop-blur-sm p-4 flex flex-col items-center text-center space-y-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <Headphones className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Audio Briefing</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      1-2 min executive audio overview
                    </p>
                  </div>
                  {!audioOverview?.audio_overview_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isGeneratingAudio}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRegenerateAudio();
                      }}
                      className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
                    >
                      {isGeneratingAudio ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-1" />
                      )}
                      {isGeneratingAudio ? 'Generating…' : 'Generate Audio'}
                    </Button>
                  )}
                  {audioOverview?.audio_overview_url && (
                    <span className="text-xs font-medium text-green-600">✓ Ready — see player below</span>
                  )}
                </div>

                {/* 2. Staff Notice Board */}
                <div className="rounded-xl border border-purple-200 bg-white/80 backdrop-blur-sm p-4 flex flex-col items-center text-center space-y-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                    <LayoutPanelTop className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Staff Notice Board</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Single-page anonymised overview for the staffroom
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleInfographicClick}
                    disabled={loadingReport}
                    className="w-full border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
                  >
                    {loadingReport ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-1" />
                    )}
                    Generate Overview
                  </Button>
                </div>

                {/* 3. Staff PowerPoint */}
                <div className="rounded-xl border border-amber-200 bg-white/80 backdrop-blur-sm p-4 flex flex-col items-center text-center space-y-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                    <Presentation className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Training PowerPoint</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Presentation for PLT sessions
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePowerPointClick}
                    disabled={loadingReport}
                    className="w-full border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                  >
                    {loadingReport ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-1" />
                    )}
                    Generate PowerPoint
                  </Button>
                </div>
              </div>

              {/* Audio player – only show when audio has been generated */}
              {audioOverview?.audio_overview_url && (
                <div className="rounded-xl border border-indigo-200 bg-white/80 backdrop-blur-sm p-4">
                  <ComplaintAudioOverviewPlayer
                    complaintId={complaint.id}
                    audioOverviewUrl={audioOverview.audio_overview_url}
                    audioOverviewText={audioOverview.audio_overview_text}
                    audioOverviewDuration={audioOverview.audio_overview_duration}
                    onRegenerateAudio={onRegenerateAudio}
                  />
                </div>
              )}

              {/* AI Critical Friend Review – only if audio exists */}
              {audioOverview?.audio_overview_url && (
                <div className="rounded-xl border border-indigo-200 bg-white/80 backdrop-blur-sm p-4">
                  <ComplaintReviewConversation
                    complaintId={complaint.id}
                    reviewConversations={reviewConversations}
                    onReviewComplete={onReviewComplete}
                    onRegenerateSummary={onRegenerateSummary}
                  />
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Modals */}
      {aiReportData && (
        <>
          <ComplaintInfographicModal
            isOpen={showInfographicModal}
            onClose={() => setShowInfographicModal(false)}
            complaintData={{
              referenceNumber: complaint.reference_number,
              category: complaint.category,
              receivedDate,
              outcomeType,
              complaintOverview: aiReportData.complaintOverview,
              keyLearnings: aiReportData.keyLearnings,
              practiceStrengths: aiReportData.practiceStrengths,
              improvementSuggestions: aiReportData.improvementSuggestions,
            }}
          />
          <ComplaintPowerPointModal
            isOpen={showPowerPointModal}
            onClose={() => setShowPowerPointModal(false)}
            complaintData={{
              referenceNumber: complaint.reference_number,
              category: complaint.category,
              receivedDate,
              outcomeType,
              complaintOverview: aiReportData.complaintOverview,
              keyLearnings: aiReportData.keyLearnings,
              practiceStrengths: aiReportData.practiceStrengths,
              improvementSuggestions: aiReportData.improvementSuggestions,
              outcomeRationale: aiReportData.outcomeRationale,
            }}
          />
        </>
      )}
    </>
  );
};
