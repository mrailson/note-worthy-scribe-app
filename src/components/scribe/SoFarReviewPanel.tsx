import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SoFarAnalysis, ConsultationContextFile } from "@/types/scribe";
import { supabase } from "@/integrations/supabase/client";
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  ClipboardList,
  ChevronDown,
  Sparkles,
  FileText
} from "lucide-react";
import { showToast } from "@/utils/toastWrapper";

interface SoFarReviewPanelProps {
  transcript: string;
  contextFiles: ConsultationContextFile[];
}

export const SoFarReviewPanel = ({ transcript, contextFiles }: SoFarReviewPanelProps) => {
  const [analysis, setAnalysis] = useState<SoFarAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    summary: true,
    redFlags: true,
    issues: true,
    questions: true,
    wrapUp: true
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const refreshAnalysis = async () => {
    if (!transcript?.trim()) {
      showToast.warning("No transcript available yet", { section: 'gpscribe' });
      return;
    }

    setIsLoading(true);
    try {
      const contextContent = contextFiles
        .filter(f => !f.isProcessing && !f.error)
        .map(f => `[${f.name}]:\n${f.content}`)
        .join('\n\n');

      const { data, error } = await supabase.functions.invoke('analyse-consultation-so-far', {
        body: { 
          transcript,
          contextContent: contextContent || undefined
        }
      });

      if (error) throw error;

      setAnalysis({
        ...data,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error analysing consultation:', error);
      showToast.error('Failed to analyse consultation', { section: 'gpscribe' });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!analysis && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Consultation Analysis</h3>
        <p className="text-muted-foreground text-sm mb-6 max-w-sm">
          Get AI-powered insights on the consultation so far, including suggested wrap-up questions and outstanding issues.
        </p>
        <Button 
          onClick={refreshAnalysis} 
          disabled={!transcript?.trim()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Analyse Consultation
        </Button>
        {!transcript?.trim() && (
          <p className="text-xs text-muted-foreground mt-3">
            Start speaking to enable analysis
          </p>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Analysing consultation...</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        {/* Header with Refresh */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>Last updated: {analysis && formatTime(analysis.lastUpdated)}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAnalysis}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Section */}
        {analysis?.summary && (
          <Card>
            <Collapsible open={expandedSections.summary} onOpenChange={() => toggleSection('summary')}>
              <CollapsibleTrigger asChild>
                <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-primary" />
                      Summary
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.summary ? 'rotate-180' : ''}`} />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-3 px-4">
                  <p className="text-sm leading-relaxed">{analysis.summary}</p>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* Red Flags Section */}
        {analysis?.redFlagsIdentified && analysis.redFlagsIdentified.length > 0 && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <Collapsible open={expandedSections.redFlags} onOpenChange={() => toggleSection('redFlags')}>
              <CollapsibleTrigger asChild>
                <CardHeader className="py-3 px-4 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/20">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                      <span className="text-amber-700 dark:text-amber-400">Red Flags Identified</span>
                      <span className="text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded-full">
                        {analysis.redFlagsIdentified.length}
                      </span>
                    </span>
                    <ChevronDown className={`h-4 w-4 text-amber-600 transition-transform ${expandedSections.redFlags ? 'rotate-180' : ''}`} />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-3 px-4">
                  <ul className="space-y-1.5">
                    {analysis.redFlagsIdentified.map((flag, idx) => (
                      <li key={idx} className="text-sm flex items-start gap-2">
                        <span className="text-amber-600 mt-0.5">•</span>
                        <span>{flag}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* Issues Discussed */}
        {analysis?.issuesDiscussed && analysis.issuesDiscussed.length > 0 && (
          <Card>
            <Collapsible open={expandedSections.issues} onOpenChange={() => toggleSection('issues')}>
              <CollapsibleTrigger asChild>
                <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Issues Discussed
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">
                        {analysis.issuesDiscussed.length}
                      </span>
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.issues ? 'rotate-180' : ''}`} />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-3 px-4">
                  <ul className="space-y-1.5">
                    {analysis.issuesDiscussed.map((issue, idx) => (
                      <li key={idx} className="text-sm flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* Outstanding Questions */}
        {analysis?.outstandingQuestions && analysis.outstandingQuestions.length > 0 && (
          <Card>
            <Collapsible open={expandedSections.questions} onOpenChange={() => toggleSection('questions')}>
              <CollapsibleTrigger asChild>
                <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-blue-600" />
                      Questions to Consider
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">
                        {analysis.outstandingQuestions.length}
                      </span>
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.questions ? 'rotate-180' : ''}`} />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-3 px-4">
                  <ul className="space-y-1.5">
                    {analysis.outstandingQuestions.map((q, idx) => (
                      <li key={idx} className="text-sm flex items-start gap-2">
                        <span className="text-blue-600 mt-0.5">?</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* Suggested Wrap-Up */}
        {analysis?.suggestedWrapUp && analysis.suggestedWrapUp.length > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <Collapsible open={expandedSections.wrapUp} onOpenChange={() => toggleSection('wrapUp')}>
              <CollapsibleTrigger asChild>
                <CardHeader className="py-3 px-4 cursor-pointer hover:bg-primary/10">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Suggested Wrap-Up
                      <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                        {analysis.suggestedWrapUp.length}
                      </span>
                    </span>
                    <ChevronDown className={`h-4 w-4 text-primary transition-transform ${expandedSections.wrapUp ? 'rotate-180' : ''}`} />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-3 px-4">
                  <ul className="space-y-1.5">
                    {analysis.suggestedWrapUp.map((item, idx) => (
                      <li key={idx} className="text-sm flex items-start gap-2">
                        <span className="text-primary mt-0.5">→</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
};
