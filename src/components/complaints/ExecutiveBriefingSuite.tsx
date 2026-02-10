import React, { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Briefcase,
  Headphones,
  LayoutPanelTop,
  Presentation,
  ChevronUp,
  ChevronDown,
  Loader2,
  Sparkles,
  Download,
  Maximize2,
  ExternalLink,
  X,
} from 'lucide-react';
import { ComplaintAudioOverviewPlayer } from '@/components/complaints/ComplaintAudioOverviewPlayer';
import { ComplaintReviewConversation } from '@/components/complaints/ComplaintReviewConversation';
import { ComplaintPowerPointModal } from '@/components/complaints/ComplaintPowerPointModal';
import { useComplaintInfographic } from '@/hooks/useComplaintInfographic';
import { useComplaintPowerPoint } from '@/hooks/useComplaintPowerPoint';
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
  const [showPowerPointModal, setShowPowerPointModal] = useState(false);
  const [showFullscreenInfographic, setShowFullscreenInfographic] = useState(false);
  const [aiReportData, setAiReportData] = useState<AIReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingPowerPoint, setLoadingPowerPoint] = useState(false);
  const reportFetchedRef = useRef<string | null>(null);
  const reportDataRef = useRef<AIReportData | null>(null);
  const inFlightRef = useRef(false);

  const {
    generateInfographic,
    downloadInfographic,
    isGenerating: isGeneratingInfographic,
    generatedBlobUrl,
    error: infographicError,
  } = useComplaintInfographic(complaint.id);

  const {
    generatePowerPoint,
    downloadPersistedPowerPoint,
    persistedData: persistedPowerPoint,
    isGenerating: isGeneratingPowerPoint,
  } = useComplaintPowerPoint(complaint.id);

  const fetchAIReportData = useCallback(async (): Promise<AIReportData | null> => {
    if (reportDataRef.current && reportFetchedRef.current === complaint.id) {
      return reportDataRef.current;
    }

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
  }, [complaint.id]);

  const handleInfographicClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const data = await fetchAIReportData();
    if (data) {
      const result = await generateInfographic({
        referenceNumber: complaint.reference_number,
        category: complaint.category,
        receivedDate,
        outcomeType,
        complaintOverview: data.complaintOverview,
        keyLearnings: data.keyLearnings,
        practiceStrengths: data.practiceStrengths,
        improvementSuggestions: data.improvementSuggestions,
      });
      if (result.success) {
        showToast.success('Staff learning infographic generated!');
      } else {
        showToast.error(result.error || 'Failed to generate infographic');
      }
    }
  }, [fetchAIReportData, generateInfographic, complaint.reference_number, complaint.category]);

  const handlePowerPointClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingPowerPoint(true);
    try {
      const data = await fetchAIReportData();
      if (data) {
        setShowPowerPointModal(true);
      }
    } finally {
      setLoadingPowerPoint(false);
    }
  }, [fetchAIReportData]);

  const receivedDate = format(
    new Date(complaint.received_at || complaint.created_at),
    'dd MMMM yyyy'
  );
  const outcomeType = complaint.complaint_outcomes?.[0]?.outcome_type;

  const isInfographicLoading = isGeneratingInfographic;
  const isInfographicPreparing = loadingReport && !loadingPowerPoint;

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50">
          <CardHeader>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-0 h-auto hover:bg-transparent"
              >
                <div className="text-left">
                  <CardTitle className="flex items-center gap-2 text-indigo-800">
                    <Briefcase className="h-5 w-5" />
                    Complaint Executive Overview
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
                  {!audioOverview?.audio_overview_url && !isGeneratingAudio && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRegenerateAudio();
                      }}
                      className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      Generate Audio
                    </Button>
                  )}
                  {isGeneratingAudio && (
                    <div className="w-full flex items-center justify-center gap-2 py-1 text-indigo-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs font-medium">Generating…</span>
                    </div>
                  )}
                  {audioOverview?.audio_overview_url && !isGeneratingAudio && (
                    <div className="w-full space-y-2">
                      <div className="w-full text-left">
                        <ComplaintAudioOverviewPlayer
                          complaintId={complaint.id}
                          audioOverviewUrl={audioOverview.audio_overview_url}
                          audioOverviewText={audioOverview.audio_overview_text}
                          audioOverviewDuration={audioOverview.audio_overview_duration}
                          onRegenerateAudio={onRegenerateAudio}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRegenerateAudio();
                        }}
                        className="w-full text-xs text-muted-foreground hover:text-indigo-700"
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Regenerate
                      </Button>
                    </div>
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
                  {!generatedBlobUrl && !isInfographicLoading && !isInfographicPreparing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleInfographicClick}
                      className="w-full border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      Generate Overview
                    </Button>
                  )}
                  {(isInfographicLoading || isInfographicPreparing) && (
                    <div className="w-full flex items-center justify-center gap-2 py-1 text-purple-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs font-medium">
                        {isInfographicPreparing ? 'Preparing data…' : 'Generating infographic…'}
                      </span>
                    </div>
                  )}
                  {generatedBlobUrl && !isInfographicLoading && !isInfographicPreparing && (
                    <div className="w-full space-y-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowFullscreenInfographic(true);
                        }}
                        className="w-full rounded-lg overflow-hidden border border-purple-200 hover:border-purple-400 transition-colors cursor-pointer"
                      >
                        <img
                          src={generatedBlobUrl}
                          alt="Staff learning infographic"
                          className="w-full h-auto object-contain"
                        />
                      </button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadInfographic(complaint.reference_number);
                          }}
                          className="flex-1 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowFullscreenInfographic(true);
                          }}
                          className="flex-1 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
                        >
                          <Maximize2 className="h-3.5 w-3.5 mr-1" />
                          Full Screen
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleInfographicClick}
                        className="w-full text-xs text-muted-foreground hover:text-purple-700"
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Regenerate
                      </Button>
                    </div>
                  )}
                  {infographicError && !isInfographicLoading && !isInfographicPreparing && (
                    <p className="text-xs text-destructive">{infographicError}</p>
                  )}
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
                  {!persistedPowerPoint && !loadingPowerPoint && !isGeneratingPowerPoint && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePowerPointClick}
                      disabled={loadingPowerPoint}
                      className="w-full border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      Generate PowerPoint
                    </Button>
                  )}
                  {(loadingPowerPoint || isGeneratingPowerPoint) && (
                    <div className="w-full flex items-center justify-center gap-2 py-1 text-amber-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs font-medium">
                        {loadingPowerPoint ? 'Preparing data…' : 'Generating presentation…'}
                      </span>
                    </div>
                  )}
                  {persistedPowerPoint && !loadingPowerPoint && !isGeneratingPowerPoint && (
                    <div className="w-full space-y-2">
                      {persistedPowerPoint.thumbnailUrl && (
                        <div className="w-full rounded-lg overflow-hidden border border-amber-200">
                          <img
                            src={persistedPowerPoint.thumbnailUrl}
                            alt="PowerPoint title slide"
                            className="w-full h-auto object-contain"
                          />
                        </div>
                      )}
                      {persistedPowerPoint.slideCount && (
                        <p className="text-xs text-muted-foreground">
                          {persistedPowerPoint.slideCount} slides
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadPersistedPowerPoint(complaint.reference_number);
                          }}
                          className="flex-1 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Download
                        </Button>
                        {persistedPowerPoint.gammaUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="flex-1 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                          >
                            <a
                              href={persistedPowerPoint.gammaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3.5 w-3.5 mr-1" />
                              View / Edit
                            </a>
                          </Button>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePowerPointClick}
                        className="w-full text-xs text-muted-foreground hover:text-amber-700"
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Regenerate
                      </Button>
                    </div>
                  )}
                </div>
              </div>


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

      {/* Fullscreen infographic viewer */}
      <Dialog open={showFullscreenInfographic} onOpenChange={setShowFullscreenInfographic}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0 gap-0 overflow-hidden [&>button]:hidden">
          <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-purple-50 to-pink-50">
            <div className="flex items-center gap-2">
              <LayoutPanelTop className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-semibold text-foreground">
                Staff Learning Infographic — {complaint.reference_number}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadInfographic(complaint.reference_number)}
                className="h-7 text-xs"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Download
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowFullscreenInfographic(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="overflow-auto p-4 flex items-center justify-center bg-muted/20">
            {generatedBlobUrl && (
              <img
                src={generatedBlobUrl}
                alt="Staff learning infographic"
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* PowerPoint Modal */}
      {aiReportData && (
        <ComplaintPowerPointModal
          isOpen={showPowerPointModal}
          onClose={() => setShowPowerPointModal(false)}
          complaintId={complaint.id}
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
      )}
    </>
  );
};
