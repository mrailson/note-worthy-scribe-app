import { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, AlertCircle, MinusCircle, Circle, FileText, Download, ArrowUpCircle, ArrowDownCircle, Zap, ClipboardCheck, ShieldCheck, ChevronsUpDown, Shield, Info } from 'lucide-react';
import { DomainSection } from './DomainSection';
import { InspectionReport } from './InspectionReport';
import { SiteIssuesSection } from './SiteIssuesSection';
import { StatusSummaryCard } from './StatusSummaryCard';
import { FundamentalsChecklist, INSPECTION_TYPES, FundamentalsStats, FundamentalRecord } from './fundamentals';
import { InspectionSession, InspectionElement, InspectionType, useMockInspection } from '@/hooks/useMockInspection';
import { InspectionAccessManager } from './InspectionAccessManager';
import { useAuth } from '@/contexts/AuthContext';
import { generateFilteredInspectionReport } from '@/utils/generateFilteredInspectionReport';

interface InspectionDashboardProps {
  session: InspectionSession;
  elements: InspectionElement[];
  practiceName: string;
  onClose: () => void;
  onUpgradeType?: (newType: InspectionType) => Promise<boolean>;
}

const DOMAIN_CONFIG = {
  safe: { 
    label: 'Safe', 
    color: 'text-red-600', 
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
    priority: true,
    description: 'Are people protected from abuse and avoidable harm?'
  },
  well_led: { 
    label: 'Well-led', 
    color: 'text-purple-600', 
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
    priority: true,
    description: 'Is leadership and governance effective and responsive?'
  },
  effective: { 
    label: 'Effective', 
    color: 'text-blue-600', 
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    priority: false,
    description: 'Does care achieve good outcomes and promote quality of life?'
  },
  caring: { 
    label: 'Caring', 
    color: 'text-green-600', 
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800',
    priority: false,
    description: 'Do staff treat people with compassion and dignity?'
  },
  responsive: { 
    label: 'Responsive', 
    color: 'text-orange-600', 
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
    priority: false,
    description: 'Do services meet people\'s needs?'
  }
};

export const InspectionDashboard = ({ 
  session, 
  elements, 
  practiceName, 
  onClose,
  onUpgradeType
}: InspectionDashboardProps) => {
  const { user } = useAuth();
  const [showReport, setShowReport] = useState(false);
  const [localElements, setLocalElements] = useState<InspectionElement[]>(elements);
  const [localSession, setLocalSession] = useState<InspectionSession>(session);
  const [fundamentalsStats, setFundamentalsStats] = useState<FundamentalsStats>({
    total: 0,
    verified: 0,
    issuesFound: 0,
    notApplicable: 0,
    notChecked: 0,
    percent: 0,
    records: []
  });

  // Helper to generate filtered report for fundamentals
  const generateFundamentalsReport = useCallback(async (status: string, statusLabel: string) => {
    const records = fundamentalsStats.records || [];
    const filteredRecords = records.filter(r => r.status === status);
    
    await generateFilteredInspectionReport({
      title: `Mock CQC Inspection - ${statusLabel}`,
      practice: { name: practiceName },
      statusLabel,
      items: filteredRecords.map(r => ({
        id: r.id,
        key: r.item_key,
        name: r.item_name,
        category: r.category,
        status: r.status,
        notes: r.notes,
        assignedTo: r.assigned_to,
        fixByDate: r.fix_by_date,
        fixByPreset: r.fix_by_preset,
        photoUrl: r.photo_url,
        photoFileName: r.photo_file_name
      }))
    });
  }, [fundamentalsStats.records, practiceName]);

  // Helper to generate filtered report for domain elements
  const generateDomainElementsReport = useCallback(async (status: string, statusLabel: string) => {
    const filteredElements = localElements.filter(e => e.status === status);
    
    await generateFilteredInspectionReport({
      title: `Mock CQC Inspection - ${statusLabel}`,
      practice: { name: practiceName },
      statusLabel,
      items: filteredElements.map(e => ({
        id: e.id,
        key: e.element_key,
        name: e.element_name,
        domain: e.domain,
        status: e.status,
        notes: e.evidence_notes,
        evidenceFiles: Array.isArray(e.evidence_files) 
          ? (e.evidence_files as Array<{ type: string; url?: string; name: string }>)
          : []
      }))
    });
  }, [localElements, practiceName]);

  // Get items for hover display - fundamentals
  const getFundamentalsItems = useCallback((status: string) => {
    const records = fundamentalsStats.records || [];
    return records
      .filter(r => r.status === status)
      .map(r => ({
        id: r.id,
        key: r.item_key,
        name: r.item_name,
        notes: r.notes,
        assignedTo: r.assigned_to,
        fixByDate: r.fix_by_date,
        fixByPreset: r.fix_by_preset,
        photoUrl: r.photo_url,
        photoFileName: r.photo_file_name
      }));
  }, [fundamentalsStats.records]);

  // Get items for hover display - domain elements
  const getDomainElementItems = useCallback((status: string) => {
    return localElements
      .filter(e => e.status === status)
      .map(e => ({
        id: e.id,
        key: e.element_key,
        name: e.element_name,
        notes: e.evidence_notes
      }));
  }, [localElements]);
  const { updateElement: updateElementInDb, completeInspection } = useMockInspection();

  // Check if current user is the owner of this session
  const isOwner = user?.id === session.user_id;

  const inspectionTypeConfig = INSPECTION_TYPES[localSession.inspection_type];

  const handleChangeType = async (newType: InspectionType) => {
    if (newType === localSession.inspection_type) return;
    if (onUpgradeType) {
      const success = await onUpgradeType(newType);
      if (success) {
        setLocalSession(prev => ({ ...prev, inspection_type: newType }));
      }
    }
  };

  // Get available type options (all types except current)
  const getTypeOptions = () => {
    const types: { key: InspectionType; label: string; direction: 'up' | 'down' | null }[] = [];
    const currentIndex = ['short', 'mid', 'long'].indexOf(localSession.inspection_type);
    
    if (localSession.inspection_type !== 'short') {
      types.push({ key: 'short', label: 'Short', direction: 'down' });
    }
    if (localSession.inspection_type !== 'mid') {
      types.push({ 
        key: 'mid', 
        label: 'Standard', 
        direction: currentIndex < 1 ? 'up' : 'down' 
      });
    }
    if (localSession.inspection_type !== 'long') {
      types.push({ key: 'long', label: 'Full', direction: 'up' });
    }
    return types;
  };
  
  // Calculate progress from local elements
  const getProgress = () => {
    const total = localElements.length;
    const assessed = localElements.filter(e => e.status !== 'not_assessed').length;
    const met = localElements.filter(e => e.status === 'met').length;
    const partiallyMet = localElements.filter(e => e.status === 'partially_met').length;
    const notMet = localElements.filter(e => e.status === 'not_met').length;

    return {
      total,
      assessed,
      met,
      partiallyMet,
      notMet,
      percentComplete: total > 0 ? Math.round((assessed / total) * 100) : 0
    };
  };

  // Get elements by domain from local state
  const getElementsByDomain = (domain: string) => {
    return localElements
      .filter(e => e.domain === domain)
      .sort((a, b) => a.element_key.localeCompare(b.element_key));
  };

  // Wrapper to update both DB and local state
  const handleUpdateElement = async (
    elementId: string,
    updates: Partial<Pick<InspectionElement, 'status' | 'evidence_notes' | 'improvement_comments' | 'evidence_files'>>
  ) => {
    const success = await updateElementInDb(elementId, updates);
    if (success) {
      setLocalElements(prev => 
        prev.map(el => el.id === elementId ? { ...el, ...updates } : el)
      );
    }
    return success;
  };

  const progress = getProgress();
  
  // Order domains with priority first
  const domainOrder = ['safe', 'well_led', 'effective', 'caring', 'responsive'];

  const handleCompleteAndReport = async () => {
    await completeInspection();
    setShowReport(true);
  };

  if (showReport) {
    return (
      <InspectionReport 
        session={session}
        elements={localElements}
        practiceName={practiceName}
        onBack={() => setShowReport(false)}
      />
    );
  }

  return (
    <>
      <Helmet>
        <title>Mock Inspection - {practiceName} | Meeting Magic</title>
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Header />
        
        <main className="container mx-auto px-4 py-6 max-w-5xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Exit
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">{practiceName}</h1>
                  <Badge variant="outline" className={inspectionTypeConfig.color}>
                    {inspectionTypeConfig.label} Inspection
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">Mock CQC Inspection • {inspectionTypeConfig.duration}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <InspectionAccessManager
                sessionId={session.id}
                sessionPracticeId={session.practice_id}
                isOwner={isOwner}
              />
              {getTypeOptions().map(option => (
                <Button 
                  key={option.key}
                  variant="outline" 
                  size="sm"
                  onClick={() => handleChangeType(option.key)}
                  className="gap-1"
                >
                  {option.direction === 'up' ? (
                    <ArrowUpCircle className="h-4 w-4" />
                  ) : (
                    <ArrowDownCircle className="h-4 w-4" />
                  )}
                  {option.direction === 'up' ? 'Upgrade' : 'Change'} to {option.label}
                </Button>
              ))}
              <Button onClick={handleCompleteAndReport} disabled={progress.assessed === 0}>
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </div>
          </div>

          {/* Progress Overview */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-sm text-muted-foreground">
                  {progress.assessed} of {progress.total} elements assessed ({progress.percentComplete}%)
                </span>
              </div>
              <Progress value={progress.percentComplete} className="h-2 mb-4" />
              
              {/* Fundamentals Checklist Summary */}
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Fundamentals Checklist</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatusSummaryCard
                    icon={CheckCircle2}
                    iconColorClass="text-green-600"
                    count={fundamentalsStats.verified}
                    label="Verified"
                    bgColorClass="bg-green-50 dark:bg-green-950/30"
                    items={getFundamentalsItems('verified')}
                    practiceName={practiceName}
                    onDownloadReport={fundamentalsStats.verified > 0 
                      ? () => generateFundamentalsReport('verified', 'Verified Items')
                      : undefined
                    }
                  />
                  <StatusSummaryCard
                    icon={AlertCircle}
                    iconColorClass="text-red-600"
                    count={fundamentalsStats.issuesFound}
                    label="Issues Found"
                    bgColorClass="bg-red-50 dark:bg-red-950/30"
                    items={getFundamentalsItems('issue_found')}
                    practiceName={practiceName}
                    onDownloadReport={fundamentalsStats.issuesFound > 0 
                      ? () => generateFundamentalsReport('issue_found', 'Issues Found')
                      : undefined
                    }
                  />
                  <StatusSummaryCard
                    icon={MinusCircle}
                    iconColorClass="text-muted-foreground"
                    count={fundamentalsStats.notApplicable}
                    label="N/A"
                    bgColorClass="bg-muted/30"
                    items={getFundamentalsItems('not_applicable')}
                    practiceName={practiceName}
                  />
                  <StatusSummaryCard
                    icon={Circle}
                    iconColorClass="text-muted-foreground"
                    count={fundamentalsStats.notChecked}
                    label="Not Checked"
                    bgColorClass="bg-muted/50"
                    items={[]}
                    practiceName={practiceName}
                  />
                </div>
              </div>

              {/* Domain Elements Summary */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Domain Elements</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatusSummaryCard
                    icon={CheckCircle2}
                    iconColorClass="text-green-600"
                    count={progress.met}
                    label="Met"
                    bgColorClass="bg-green-50 dark:bg-green-950/30"
                    items={getDomainElementItems('met')}
                    practiceName={practiceName}
                    onDownloadReport={progress.met > 0 
                      ? () => generateDomainElementsReport('met', 'Elements Met')
                      : undefined
                    }
                  />
                  <StatusSummaryCard
                    icon={MinusCircle}
                    iconColorClass="text-amber-600"
                    count={progress.partiallyMet}
                    label="Partially Met"
                    bgColorClass="bg-amber-50 dark:bg-amber-950/30"
                    items={getDomainElementItems('partially_met')}
                    practiceName={practiceName}
                    onDownloadReport={progress.partiallyMet > 0 
                      ? () => generateDomainElementsReport('partially_met', 'Partially Met Elements')
                      : undefined
                    }
                  />
                  <StatusSummaryCard
                    icon={AlertCircle}
                    iconColorClass="text-red-600"
                    count={progress.notMet}
                    label="Not Met"
                    bgColorClass="bg-red-50 dark:bg-red-950/30"
                    items={getDomainElementItems('not_met')}
                    practiceName={practiceName}
                    onDownloadReport={progress.notMet > 0 
                      ? () => generateDomainElementsReport('not_met', 'Not Met Elements')
                      : undefined
                    }
                  />
                  <StatusSummaryCard
                    icon={Circle}
                    iconColorClass="text-muted-foreground"
                    count={progress.total - progress.assessed}
                    label="Not Assessed"
                    bgColorClass="bg-muted/50"
                    items={[]}
                    practiceName={practiceName}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Encouragement Message */}
          {progress.percentComplete > 0 && progress.percentComplete < 100 && (
            <div className="mb-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-sm">
                {progress.percentComplete < 25 
                  ? "🚀 Great start! Take your time working through each area."
                  : progress.percentComplete < 50
                  ? "👍 Making good progress! You're building a clearer picture of your compliance."
                  : progress.percentComplete < 75
                  ? "💪 Over halfway there! Keep going, you're doing brilliantly."
                  : "🎯 Nearly complete! Just a few more areas to review."
                }
              </p>
            </div>
          )}

          {/* Data Protection Disclaimer */}
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800/50">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">Data Protection Reminder</p>
                <p className="text-sm text-amber-700 dark:text-amber-400/90">
                  This tool is <strong>not intended</strong> for storing Patient Identifiable Data (PID), Staff Identifiable Data, 
                  or any other personal information. Please use general descriptions and reference numbers only. 
                  All notes and evidence should be anonymised.
                </p>
              </div>
            </div>
          </div>

          {/* Fundamentals Checklist - Primary Walkthrough */}
          <div className="mb-6">
            <FundamentalsChecklist 
              sessionId={localSession.id} 
              inspectionType={localSession.inspection_type}
              onStatsChange={setFundamentalsStats}
            />
          </div>

          {/* Domain Sections */}
          <div className="space-y-4">
            {domainOrder.map(domain => {
              const config = DOMAIN_CONFIG[domain as keyof typeof DOMAIN_CONFIG];
              const domainElements = getElementsByDomain(domain);
              
              if (domainElements.length === 0) return null;
              
              return (
                <DomainSection
                  key={domain}
                  domain={domain}
                  label={config.label}
                  description={config.description}
                  color={config.color}
                  bgColor={config.bgColor}
                  borderColor={config.borderColor}
                  isPriority={config.priority}
                  elements={domainElements}
                  onUpdateElement={handleUpdateElement}
                />
              );
            })}

            {/* Site Issues Section */}
            <SiteIssuesSection sessionId={session.id} />
          </div>
        </main>
      </div>
    </>
  );
};
