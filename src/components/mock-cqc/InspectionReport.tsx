import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, CheckCircle2, AlertCircle, MinusCircle, FileText, Loader2 } from 'lucide-react';
import { InspectionSession, InspectionElement as HookInspectionElement } from '@/hooks/useMockInspection';
import { generateMockInspectionReport } from '@/utils/generateMockInspectionReport';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface InspectionReportProps {
  session: InspectionSession;
  elements: HookInspectionElement[];
  practiceName: string;
  onBack: () => void;
}

const DOMAIN_LABELS: Record<string, string> = {
  safe: 'Safe',
  well_led: 'Well-led',
  effective: 'Effective',
  caring: 'Caring',
  responsive: 'Responsive'
};

export const InspectionReport = ({
  session,
  elements,
  practiceName,
  onBack
}: InspectionReportProps) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  // Calculate summary stats
  const stats = {
    total: elements.length,
    met: elements.filter(e => e.status === 'met').length,
    partiallyMet: elements.filter(e => e.status === 'partially_met').length,
    notMet: elements.filter(e => e.status === 'not_met').length,
    notApplicable: elements.filter(e => e.status === 'not_applicable').length,
    notAssessed: elements.filter(e => e.status === 'not_assessed').length
  };

  // Get priority items (not met and partially met)
  const priorityItems = elements
    .filter(e => e.status === 'not_met' || e.status === 'partially_met')
    .sort((a, b) => {
      // Not met first, then partially met
      if (a.status === 'not_met' && b.status !== 'not_met') return -1;
      if (a.status !== 'not_met' && b.status === 'not_met') return 1;
      // Within same status, priority domains first
      const priorityDomains = ['safe', 'well_led'];
      const aIsPriority = priorityDomains.includes(a.domain);
      const bIsPriority = priorityDomains.includes(b.domain);
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      return 0;
    });

  const handleDownloadReport = async () => {
    setIsGenerating(true);
    try {
      await generateMockInspectionReport({
        practiceName,
        inspectionDate: session.started_at || new Date().toISOString(),
        elements,
        stats
      });
      toast({
        title: "Report downloaded",
        description: "Your mock inspection report has been saved."
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Failed to generate report",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Calculate overall rating
  const getOverallRating = () => {
    const assessed = stats.total - stats.notAssessed - stats.notApplicable;
    if (assessed === 0) return 'Incomplete';
    
    const metPercent = (stats.met / assessed) * 100;
    const notMetPercent = (stats.notMet / assessed) * 100;
    
    if (notMetPercent > 20) return 'Requires Improvement';
    if (notMetPercent > 10 || stats.partiallyMet > stats.met * 0.5) return 'Requires Improvement';
    if (metPercent > 90) return 'Good';
    return 'Requires Improvement';
  };

  const overallRating = getOverallRating();

  return (
    <>
      <Helmet>
        <title>Inspection Report - {practiceName} | Meeting Magic</title>
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Header />
        
        <main className="container mx-auto px-4 py-6 max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Inspection
              </Button>
            </div>
            <Button onClick={handleDownloadReport} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download Word Report
                </>
              )}
            </Button>
          </div>

          {/* Report Title */}
          <Card className="mb-6">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Mock CQC Inspection Report</CardTitle>
              <CardDescription className="text-lg">{practiceName}</CardDescription>
              <p className="text-sm text-muted-foreground">
                {new Date(session.started_at || '').toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </CardHeader>
          </Card>

          {/* Overall Assessment */}
          <Card className={cn(
            "mb-6 border-2",
            overallRating === 'Good' ? "border-green-500" : "border-amber-500"
          )}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Overall Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-center p-6 rounded-lg",
                overallRating === 'Good' 
                  ? "bg-green-50 dark:bg-green-950/30" 
                  : "bg-amber-50 dark:bg-amber-950/30"
              )}>
                <p className={cn(
                  "text-3xl font-bold mb-2",
                  overallRating === 'Good' ? "text-green-600" : "text-amber-600"
                )}>
                  {overallRating}
                </p>
                <p className="text-muted-foreground">
                  Based on {stats.total - stats.notAssessed} assessed elements
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-600">{stats.met}</p>
                  <p className="text-sm text-muted-foreground">Met</p>
                </div>
                <div className="text-center p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                  <MinusCircle className="h-6 w-6 text-amber-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-amber-600">{stats.partiallyMet}</p>
                  <p className="text-sm text-muted-foreground">Partially Met</p>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-red-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-red-600">{stats.notMet}</p>
                  <p className="text-sm text-muted-foreground">Not Met</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{stats.notApplicable}</p>
                  <p className="text-sm text-muted-foreground">Not Applicable</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Priority Actions */}
          {priorityItems.length > 0 && (
            <Card className="mb-6 border-red-200 dark:border-red-800">
              <CardHeader className="bg-red-50 dark:bg-red-950/30">
                <CardTitle className="text-red-600 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Priority Actions ({priorityItems.length})
                </CardTitle>
                <CardDescription>
                  These areas need attention to improve your CQC compliance
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {priorityItems.map((item, index) => (
                    <div 
                      key={item.id}
                      className={cn(
                        "p-4 rounded-lg border",
                        item.status === 'not_met' 
                          ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                          : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className={cn(
                          "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white flex-shrink-0",
                          item.status === 'not_met' ? "bg-red-600" : "bg-amber-600"
                        )}>
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded",
                              item.status === 'not_met' ? "bg-red-200 text-red-800" : "bg-amber-200 text-amber-800"
                            )}>
                              {item.status === 'not_met' ? 'Not Met' : 'Partially Met'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {DOMAIN_LABELS[item.domain]}
                            </span>
                          </div>
                          <p className="font-medium mb-1">
                            {item.element_key}: {item.element_name}
                          </p>
                          {item.improvement_comments && (
                            <div className="mt-2 p-2 bg-white dark:bg-background rounded border">
                              <p className="text-sm text-muted-foreground">
                                <strong>Suggested improvement:</strong> {item.improvement_comments}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Positive Findings */}
          {stats.met > 0 && (
            <Card className="mb-6 border-green-200 dark:border-green-800">
              <CardHeader className="bg-green-50 dark:bg-green-950/30">
                <CardTitle className="text-green-600 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  What's Working Well ({stats.met} areas)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  {elements
                    .filter(e => e.status === 'met')
                    .map(item => (
                      <div 
                        key={item.id}
                        className="flex items-center gap-2 p-2 rounded bg-green-50 dark:bg-green-950/30"
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm">
                          {item.element_key}: {item.element_name}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {DOMAIN_LABELS[item.domain]}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Encouragement Footer */}
          <div className="mt-8 p-6 bg-primary/5 rounded-lg border border-primary/20 text-center">
            <h3 className="font-semibold mb-2">Remember: This is a learning tool</h3>
            <p className="text-sm text-muted-foreground">
              Mock inspections help identify areas for improvement in a safe environment. 
              Use this report to guide your action planning and prioritise your compliance efforts.
              Every practice has areas to improve – what matters is your commitment to continuous improvement.
            </p>
          </div>
        </main>
      </div>
    </>
  );
};
