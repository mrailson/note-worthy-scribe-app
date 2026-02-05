import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, CheckCircle2, AlertCircle, MinusCircle, FileText, Loader2, MessageSquare, Paperclip, Link2, Image, ExternalLink, ChevronDown, ChevronRight, ClipboardCheck, Circle } from 'lucide-react';
import { InspectionSession, InspectionElement as HookInspectionElement } from '@/hooks/useMockInspection';
import { generateMockInspectionReport } from '@/utils/generateMockInspectionReport';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { FUNDAMENTALS_CATEGORIES, getVisibleItems, InspectionType } from './fundamentals';

interface EvidenceFile {
  type: string;
  url?: string;
  id?: string;
  name: string;
}

interface FundamentalRecord {
  id: string;
  session_id: string;
  category: string;
  item_key: string;
  item_name: string;
  status: string;
  notes: string | null;
  photo_url: string | null;
  photo_file_name: string | null;
  checked_at: string | null;
  assigned_to: string | null;
  fix_by_date: string | null;
  fix_by_preset: string | null;
}

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

const STATUS_CONFIG = {
  met: { label: 'Met', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950/30', icon: CheckCircle2 },
  partially_met: { label: 'Partially Met', color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30', icon: MinusCircle },
  not_met: { label: 'Not Met', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950/30', icon: AlertCircle },
  not_applicable: { label: 'N/A', color: 'text-muted-foreground', bgColor: 'bg-muted/50', icon: MinusCircle },
  not_assessed: { label: 'Not Assessed', color: 'text-muted-foreground', bgColor: 'bg-muted/30', icon: MinusCircle }
};

// Component to display evidence files/thumbnails
const EvidenceFilesDisplay = ({ files }: { files: EvidenceFile[] }) => {
  if (!files || files.length === 0) return null;

  const photos = files.filter(f => f.type === 'photo' || f.type === 'file' && f.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i));
  const links = files.filter(f => f.type === 'link');
  const documents = files.filter(f => f.type === 'file' && !f.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i));

  return (
    <div className="space-y-2">
      {/* Photo Thumbnails */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((file, idx) => (
            <a
              key={idx}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative group"
            >
              <img
                src={file.url}
                alt={file.name}
                className="h-16 w-16 object-cover rounded border hover:border-primary transition-colors"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded transition-colors flex items-center justify-center">
                <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Links */}
      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((file, idx) => (
            <a
              key={idx}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-600 rounded hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
            >
              <Link2 className="h-3 w-3" />
              {file.name}
            </a>
          ))}
        </div>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {documents.map((file, idx) => (
            <a
              key={idx}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors"
            >
              <FileText className="h-3 w-3" />
              {file.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

// Component to display a single element with all its evidence
const ElementDetailCard = ({ element, showDomain = true }: { element: HookInspectionElement; showDomain?: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const config = STATUS_CONFIG[element.status];
  const StatusIcon = config.icon;
  const evidenceFiles = Array.isArray(element.evidence_files) ? element.evidence_files as EvidenceFile[] : [];
  const hasEvidence = element.evidence_notes || element.improvement_comments || evidenceFiles.length > 0;

  return (
    <div className={cn("rounded-lg border p-4", config.bgColor)}>
      <div className="flex items-start gap-3">
        <StatusIcon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", config.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("text-xs px-2 py-0.5 rounded font-medium", config.bgColor, config.color)}>
              {config.label}
            </span>
            {showDomain && (
              <span className="text-xs text-muted-foreground">
                {DOMAIN_LABELS[element.domain]}
              </span>
            )}
          </div>
          <p className="font-medium text-sm mb-2">
            {element.element_key}: {element.element_name}
          </p>

          {hasEvidence && (
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2">
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span className="flex items-center gap-2">
                  {element.evidence_notes && <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Notes</span>}
                  {element.improvement_comments && <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> Actions</span>}
                  {evidenceFiles.length > 0 && <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" /> {evidenceFiles.length} file(s)</span>}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3">
                {/* Evidence Notes */}
                {element.evidence_notes && (
                  <div className="p-3 bg-white dark:bg-background rounded border">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <MessageSquare className="h-3 w-3" />
                      Evidence Notes
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{element.evidence_notes}</p>
                  </div>
                )}

                {/* Improvement Comments */}
                {element.improvement_comments && (
                  <div className="p-3 bg-white dark:bg-background rounded border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-1 text-xs text-amber-600 mb-1">
                      <FileText className="h-3 w-3" />
                      Improvement Actions
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{element.improvement_comments}</p>
                  </div>
                )}

                {/* Evidence Files */}
                {evidenceFiles.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                      <Paperclip className="h-3 w-3" />
                      Attachments
                    </div>
                    <EvidenceFilesDisplay files={evidenceFiles} />
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </div>
  );
};

export const InspectionReport = ({
  session,
  elements,
  practiceName,
  onBack
}: InspectionReportProps) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [fundamentals, setFundamentals] = useState<FundamentalRecord[]>([]);
  const [isLoadingFundamentals, setIsLoadingFundamentals] = useState(true);
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({
    safe: true,
    well_led: true,
    effective: true,
    caring: true,
    responsive: true
  });
  const [expandedFundamentalsCategories, setExpandedFundamentalsCategories] = useState<Record<string, boolean>>({});

  // Load fundamentals data
  useEffect(() => {
    const loadFundamentals = async () => {
      try {
        const { data, error } = await supabase
          .from('mock_inspection_fundamentals')
          .select('*')
          .eq('session_id', session.id);

        if (error) throw error;
        setFundamentals(data || []);
      } catch (error) {
        console.error('Error loading fundamentals:', error);
      } finally {
        setIsLoadingFundamentals(false);
      }
    };

    loadFundamentals();
  }, [session.id]);

  // Calculate fundamentals stats
  const fundamentalsStats = {
    total: fundamentals.length,
    verified: fundamentals.filter(f => f.status === 'verified').length,
    issuesFound: fundamentals.filter(f => f.status === 'issue_found').length,
    notApplicable: fundamentals.filter(f => f.status === 'not_applicable').length,
    notChecked: fundamentals.filter(f => f.status === 'not_checked').length
  };

  // Group fundamentals by category
  const fundamentalsByCategory = fundamentals.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, FundamentalRecord[]>);

  const toggleFundamentalsCategory = (category: string) => {
    setExpandedFundamentalsCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

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

  // Group elements by domain for complete overview
  const elementsByDomain = elements.reduce((acc, element) => {
    if (!acc[element.domain]) acc[element.domain] = [];
    acc[element.domain].push(element);
    return acc;
  }, {} as Record<string, HookInspectionElement[]>);

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

  const toggleDomain = (domain: string) => {
    setExpandedDomains(prev => ({ ...prev, [domain]: !prev[domain] }));
  };

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
                    <div key={item.id} className="relative">
                      <span className={cn(
                        "absolute -left-2 -top-2 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white z-10",
                        item.status === 'not_met' ? "bg-red-600" : "bg-amber-600"
                      )}>
                        {index + 1}
                      </span>
                      <ElementDetailCard element={item} showDomain={true} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fundamentals Checklist Section */}
          {fundamentals.length > 0 && (
            <Card className="mb-6 border-primary/20">
              <CardHeader className="bg-primary/5">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Fundamentals Checklist
                </CardTitle>
                <CardDescription>
                  Core compliance checks completed during the walkthrough
                </CardDescription>
                
                {/* Fundamentals Stats Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
                    <p className="text-xl font-bold text-green-600">{fundamentalsStats.verified}</p>
                    <p className="text-xs text-muted-foreground">Verified</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
                    <p className="text-xl font-bold text-red-600">{fundamentalsStats.issuesFound}</p>
                    <p className="text-xs text-muted-foreground">Issues Found</p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <MinusCircle className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xl font-bold">{fundamentalsStats.notApplicable}</p>
                    <p className="text-xs text-muted-foreground">N/A</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <Circle className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xl font-bold">{fundamentalsStats.notChecked}</p>
                    <p className="text-xs text-muted-foreground">Not Checked</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Group by category */}
                {FUNDAMENTALS_CATEGORIES.map(category => {
                  const categoryItems = fundamentalsByCategory[category.key] || [];
                  const checkedItems = categoryItems.filter(i => i.status !== 'not_checked');
                  if (checkedItems.length === 0) return null;

                  const categoryStats = {
                    verified: categoryItems.filter(i => i.status === 'verified').length,
                    issuesFound: categoryItems.filter(i => i.status === 'issue_found').length,
                    na: categoryItems.filter(i => i.status === 'not_applicable').length
                  };

                  return (
                    <Collapsible 
                      key={category.key} 
                      open={expandedFundamentalsCategories[category.key]} 
                      onOpenChange={() => toggleFundamentalsCategory(category.key)}
                    >
                      <div className="border rounded-lg overflow-hidden">
                        <CollapsibleTrigger className="w-full p-4 bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {expandedFundamentalsCategories[category.key] ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <span className="font-semibold">{category.name}</span>
                            <span className="text-sm text-muted-foreground">
                              ({checkedItems.length} items checked)
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            {categoryStats.verified > 0 && (
                              <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">{categoryStats.verified} Verified</span>
                            )}
                            {categoryStats.issuesFound > 0 && (
                              <span className="px-2 py-0.5 rounded bg-red-100 text-red-700">{categoryStats.issuesFound} Issues</span>
                            )}
                            {categoryStats.na > 0 && (
                              <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">{categoryStats.na} N/A</span>
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="p-4 space-y-3 border-t">
                            {checkedItems.map(item => {
                              const statusConfig = {
                                verified: { label: 'Verified', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950/30', icon: CheckCircle2 },
                                issue_found: { label: 'Issue Found', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950/30', icon: AlertCircle },
                                not_applicable: { label: 'N/A', color: 'text-muted-foreground', bgColor: 'bg-muted/50', icon: MinusCircle },
                                not_checked: { label: 'Not Checked', color: 'text-muted-foreground', bgColor: 'bg-muted/30', icon: Circle }
                              }[item.status] || { label: item.status, color: 'text-muted-foreground', bgColor: 'bg-muted/30', icon: Circle };
                              
                              const StatusIcon = statusConfig.icon;
                              const hasDetails = item.notes || item.photo_url || item.assigned_to || item.fix_by_date;

                              return (
                                <div 
                                  key={item.id} 
                                  className={cn("rounded-lg border p-4", statusConfig.bgColor)}
                                >
                                  <div className="flex items-start gap-3">
                                    <StatusIcon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", statusConfig.color)} />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className={cn("text-xs px-2 py-0.5 rounded font-medium", statusConfig.bgColor, statusConfig.color)}>
                                          {statusConfig.label}
                                        </span>
                                      </div>
                                      <p className="font-medium text-sm mb-2">
                                        {item.item_key}: {item.item_name}
                                      </p>

                                      {hasDetails && (
                                        <div className="space-y-2">
                                          {/* Notes */}
                                          {item.notes && (
                                            <div className="p-3 bg-white dark:bg-background rounded border">
                                              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                                <MessageSquare className="h-3 w-3" />
                                                Notes
                                              </div>
                                              <p className="text-sm whitespace-pre-wrap">{item.notes}</p>
                                            </div>
                                          )}

                                          {/* Assigned To & Fix By */}
                                          {(item.assigned_to || item.fix_by_date) && (
                                            <div className="flex flex-wrap gap-4 text-sm">
                                              {item.assigned_to && (
                                                <div>
                                                  <span className="text-muted-foreground">Assigned to: </span>
                                                  <span className="font-medium">{item.assigned_to}</span>
                                                </div>
                                              )}
                                              {item.fix_by_date && (
                                                <div>
                                                  <span className="text-muted-foreground">Fix by: </span>
                                                  <span className="font-medium">
                                                    {new Date(item.fix_by_date).toLocaleDateString('en-GB', {
                                                      day: 'numeric',
                                                      month: 'short',
                                                      year: 'numeric'
                                                    })}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          )}

                                          {/* Photo */}
                                          {item.photo_url && (
                                            <div>
                                              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                                                <Image className="h-3 w-3" />
                                                Photo Evidence
                                              </div>
                                              <a
                                                href={item.photo_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="relative group inline-block"
                                              >
                                                <img
                                                  src={item.photo_url}
                                                  alt={item.photo_file_name || 'Evidence'}
                                                  className="h-20 w-20 object-cover rounded border hover:border-primary transition-colors"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded transition-colors flex items-center justify-center">
                                                  <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                              </a>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Complete Domain Overview */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Complete Overview by Domain
              </CardTitle>
              <CardDescription>
                All assessed elements with notes, photos, and evidence
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {['safe', 'well_led', 'effective', 'caring', 'responsive'].map(domain => {
                const domainElements = elementsByDomain[domain] || [];
                const assessed = domainElements.filter(e => e.status !== 'not_assessed');
                if (assessed.length === 0) return null;

                const domainStats = {
                  met: domainElements.filter(e => e.status === 'met').length,
                  partiallyMet: domainElements.filter(e => e.status === 'partially_met').length,
                  notMet: domainElements.filter(e => e.status === 'not_met').length,
                  na: domainElements.filter(e => e.status === 'not_applicable').length
                };

                return (
                  <Collapsible 
                    key={domain} 
                    open={expandedDomains[domain]} 
                    onOpenChange={() => toggleDomain(domain)}
                  >
                    <div className="border rounded-lg overflow-hidden">
                      <CollapsibleTrigger className="w-full p-4 bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedDomains[domain] ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-semibold">{DOMAIN_LABELS[domain]}</span>
                          <span className="text-sm text-muted-foreground">
                            ({assessed.length} items)
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">{domainStats.met} Met</span>
                          {domainStats.partiallyMet > 0 && (
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700">{domainStats.partiallyMet} Partial</span>
                          )}
                          {domainStats.notMet > 0 && (
                            <span className="px-2 py-0.5 rounded bg-red-100 text-red-700">{domainStats.notMet} Not Met</span>
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="p-4 space-y-3 border-t">
                          {assessed.map(element => (
                            <ElementDetailCard key={element.id} element={element} showDomain={false} />
                          ))}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </CardContent>
          </Card>

          {/* Positive Findings Summary */}
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
