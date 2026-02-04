import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, AlertCircle, MinusCircle, Circle, FileText, Download, ArrowUpCircle, Zap, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { DomainSection } from './DomainSection';
import { InspectionReport } from './InspectionReport';
import { SiteIssuesSection } from './SiteIssuesSection';
import { FundamentalsChecklist, INSPECTION_TYPES } from './fundamentals';
import { InspectionSession, InspectionElement, InspectionType, useMockInspection } from '@/hooks/useMockInspection';
import { InspectionAccessManager } from './InspectionAccessManager';
import { useAuth } from '@/contexts/AuthContext';

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
  const { updateElement: updateElementInDb, completeInspection } = useMockInspection();

  // Check if current user is the owner of this session
  const isOwner = user?.id === session.user_id;

  const inspectionTypeConfig = INSPECTION_TYPES[localSession.inspection_type];
  const canUpgrade = localSession.inspection_type !== 'long';

  const handleUpgrade = async (newType: InspectionType) => {
    if (onUpgradeType) {
      const success = await onUpgradeType(newType);
      if (success) {
        setLocalSession(prev => ({ ...prev, inspection_type: newType }));
      }
    }
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
              {canUpgrade && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleUpgrade(localSession.inspection_type === 'short' ? 'mid' : 'long')}
                >
                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                  Upgrade to {localSession.inspection_type === 'short' ? 'Standard' : 'Full'}
                </Button>
              )}
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
              
              {/* Status Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-lg font-semibold text-green-600">{progress.met}</p>
                    <p className="text-xs text-muted-foreground">Met</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                  <MinusCircle className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-lg font-semibold text-amber-600">{progress.partiallyMet}</p>
                    <p className="text-xs text-muted-foreground">Partially Met</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-lg font-semibold text-red-600">{progress.notMet}</p>
                    <p className="text-xs text-muted-foreground">Not Met</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Circle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-semibold">{progress.total - progress.assessed}</p>
                    <p className="text-xs text-muted-foreground">Not Assessed</p>
                  </div>
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

          {/* Fundamentals Checklist - Primary Walkthrough */}
          <div className="mb-6">
            <FundamentalsChecklist sessionId={localSession.id} inspectionType={localSession.inspection_type} />
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
