import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, FileText, ChevronDown, ChevronUp, FileDown, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { ClinicalActionsPanel, ClinicalAction } from './ClinicalActionsPanel';
import { SafetyNettingPanel } from './SafetyNettingPanel';
import { formatSoapNote } from '@/utils/emrFormatters';

type ViewMode = 'quick' | 'standard' | 'detailed' | 'comparison';
type EmrFormat = 'emis' | 'systmone';

interface SoapNote {
  S: string;
  O: string;
  A: string;
  P: string;
}

interface EnhancedSoapNotesDisplayProps {
  shorthand?: SoapNote;
  standard?: SoapNote;
  summaryLine?: string;
  patientCopy?: string;
  referral?: string;
  review?: string;
  clinicalActions?: ClinicalAction;
  consultationType?: string;
  onCopySection?: (section: keyof SoapNote) => void;
  onCopyAll?: () => void;
  onExport?: () => void;
}

const soapSections = [
  {
    key: 'S' as const,
    title: 'S – Subjective',
    icon: '💬',
    description: 'Patient\'s perspective and symptoms',
    color: 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
  },
  {
    key: 'O' as const,
    title: 'O – Objective',
    icon: '🩺',
    description: 'Clinical findings and observations',
    color: 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
  },
  {
    key: 'A' as const,
    title: 'A – Assessment',
    icon: '🔎',
    description: 'Clinical impression and diagnosis',
    color: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
  },
  {
    key: 'P' as const,
    title: 'P – Plan',
    icon: '✅',
    description: 'Treatment and follow-up',
    color: 'border-l-violet-500 bg-violet-50/50 dark:bg-violet-950/20'
  }
];

export const EnhancedSoapNotesDisplay: React.FC<EnhancedSoapNotesDisplayProps> = ({
  shorthand,
  standard,
  summaryLine,
  patientCopy,
  referral,
  review,
  clinicalActions,
  consultationType,
  onCopySection,
  onCopyAll,
  onExport
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [emrFormat, setEmrFormat] = useState<EmrFormat>('emis');

  // Load EMR format preference from localStorage
  useEffect(() => {
    const savedFormat = localStorage.getItem('emrFormat') as EmrFormat;
    if (savedFormat === 'emis' || savedFormat === 'systmone') {
      setEmrFormat(savedFormat);
    }
  }, []);

  // Save EMR format preference to localStorage
  const handleEmrFormatChange = (format: EmrFormat) => {
    setEmrFormat(format);
    localStorage.setItem('emrFormat', format);
  };

  const soapNotes = viewMode === 'quick' ? shorthand : standard;

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionKey)) {
        newSet.delete(sectionKey);
      } else {
        newSet.add(sectionKey);
      }
      return newSet;
    });
  };

  const handleCopySection = (section: keyof SoapNote) => {
    if (!soapNotes) return;
    
    const formattedText = formatSoapNote(emrFormat, soapNotes, section, consultationType);
    navigator.clipboard.writeText(formattedText);
    
    const systemName = emrFormat === 'emis' ? 'EMIS Web' : 'SystmOne';
    toast.success(`${section} section copied for ${systemName}`);
    
    if (onCopySection) {
      onCopySection(section);
    }
  };

  const handleCopyAll = () => {
    if (!soapNotes) return;
    
    const formattedText = formatSoapNote(emrFormat, soapNotes, undefined, consultationType);
    navigator.clipboard.writeText(formattedText);
    
    const systemName = emrFormat === 'emis' ? 'EMIS Web' : 'SystmOne';
    toast.success(`Complete SOAP notes copied for ${systemName}`);
    
    if (onCopyAll) {
      onCopyAll();
    }
  };

  const handleCopySummary = () => {
    if (!summaryLine) return;
    
    navigator.clipboard.writeText(summaryLine);
    toast.success('Summary line copied to clipboard');
  };

  const handleCopyPatientCopy = () => {
    if (!patientCopy) return;
    
    navigator.clipboard.writeText(patientCopy);
    toast.success('Patient copy copied to clipboard');
  };

  const handleExportToWord = async () => {
    try {
      toast.info('Generating consultation document...');
      const { exportConsultationToWord } = await import('@/utils/consultationWordExport');
      
      await exportConsultationToWord({
        shorthand,
        standard,
        summaryLine,
        patientCopy,
        referral,
        review,
        clinicalActions,
        consultationType
      });
      
      toast.success('Consultation document downloaded');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export consultation document');
    }
  };

  const handleExportPatientLetter = async () => {
    if (!patientCopy) {
      toast.error('No patient information available to export');
      return;
    }
    
    try {
      toast.info('Creating your patient letter...');
      const { exportPatientLetterToWord } = await import('@/utils/patientLetterExport');
      
      await exportPatientLetterToWord({
        patientCopy,
        summaryLine,
        consultationType
      });
      
      toast.success('Patient letter downloaded successfully');
    } catch (error) {
      console.error('Patient letter export failed:', error);
      toast.error('Failed to create patient letter');
    }
  };

  if (!soapNotes && !summaryLine) {
    return null;
  }

  const renderSoapCard = (section: typeof soapSections[0], content: string, isCompact: boolean = false) => {
    const isExpanded = expandedSections.has(section.key);
    const shouldTruncate = isCompact && !isExpanded && content.length > 200;
    const displayContent = shouldTruncate ? content.slice(0, 200) + '...' : content;

    return (
      <Card key={section.key} className={`border-l-4 ${section.color}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{section.icon}</span>
              <div>
                <CardTitle className="text-base">{section.title}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {section.description}
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              {shouldTruncate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSection(section.key)}
                  className="h-8 w-8 p-0"
                >
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopySection(section.key)}
                className="h-8 w-8 p-0"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm whitespace-pre-wrap leading-relaxed">
            {displayContent || 'No information recorded'}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderQuickView = () => (
    <div className="space-y-4">
      {summaryLine && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-3">
              <p className="text-lg font-semibold flex-1">{summaryLine}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopySummary}
                className="h-8 w-8 p-0 shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-3">
        {soapNotes && soapSections.map(section => 
          renderSoapCard(section, soapNotes[section.key], true)
        )}
      </div>
    </div>
  );

  const renderStandardView = () => (
    <div className="space-y-4">
      {summaryLine && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-3">
              <p className="text-base font-medium flex-1">{summaryLine}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopySummary}
                className="h-8 w-8 p-0 shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {soapNotes && soapSections.map(section => 
          renderSoapCard(section, soapNotes[section.key])
        )}
      </div>
    </div>
  );

  const renderDetailedView = () => (
    <div className="space-y-6">
      {summaryLine && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-3">
              <p className="text-lg font-semibold flex-1">{summaryLine}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopySummary}
                className="h-8 w-8 p-0 shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-6">
        {soapNotes && soapSections.map(section => 
          renderSoapCard(section, soapNotes[section.key])
        )}
      </div>
    </div>
  );

  const renderComparisonView = () => (
    <div className="space-y-4">
      {summaryLine && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-3">
              <p className="text-base font-medium flex-1">{summaryLine}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopySummary}
                className="h-8 w-8 p-0 shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Shorthand (Quick Reference)</h3>
          {shorthand && soapSections.map(section => 
            renderSoapCard(section, shorthand[section.key])
          )}
        </div>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Standard (Full Detail)</h3>
          {standard && soapSections.map(section => 
            renderSoapCard(section, standard[section.key])
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Patient Consultation Notes</h3>
          {consultationType && (
            <p className="text-sm text-muted-foreground">
              Consultation Type: {consultationType}
            </p>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Tabs */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
            <span className="text-xs font-medium text-muted-foreground">View:</span>
            <div className="flex gap-1">
              <Button
                variant={viewMode === 'quick' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('quick')}
                className="h-7 px-3 text-xs"
              >
                Quick
              </Button>
              <Button
                variant={viewMode === 'standard' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('standard')}
                className="h-7 px-3 text-xs"
              >
                Standard
              </Button>
              <Button
                variant={viewMode === 'detailed' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('detailed')}
                className="h-7 px-3 text-xs"
              >
                Detailed
              </Button>
              <Button
                variant={viewMode === 'comparison' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('comparison')}
                className="h-7 px-3 text-xs"
              >
                Compare
              </Button>
            </div>
          </div>

          {/* EMR Format Selector - Compact */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
            <span className="text-xs font-medium text-muted-foreground">Format:</span>
            <div className="flex gap-1">
              <Button
                variant={emrFormat === 'emis' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleEmrFormatChange('emis')}
                className="h-7 px-3 text-xs"
              >
                EMIS
              </Button>
              <Button
                variant={emrFormat === 'systmone' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleEmrFormatChange('systmone')}
                className="h-7 px-3 text-xs"
              >
                SystmOne
              </Button>
            </div>
          </div>

          {/* Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <MoreVertical className="h-4 w-4" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleCopyAll}>
                <Copy className="h-4 w-4 mr-2" />
                Copy All
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportToWord}>
                <FileDown className="h-4 w-4 mr-2" />
                Export to Word
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <Tabs defaultValue="clinical" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="clinical">Clinical Notes</TabsTrigger>
          <TabsTrigger value="patient">Patient Copy</TabsTrigger>
          <TabsTrigger value="referral">Referral</TabsTrigger>
          <TabsTrigger value="review">Clinical Review</TabsTrigger>
        </TabsList>

        <TabsContent value="clinical" className="space-y-4 mt-4">
          {viewMode === 'quick' && renderQuickView()}
          {viewMode === 'standard' && renderStandardView()}
          {viewMode === 'detailed' && renderDetailedView()}
          {viewMode === 'comparison' && renderComparisonView()}
        </TabsContent>

        <TabsContent value="patient" className="space-y-4 mt-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="text-xl">💌</span>
                    Patient Letter
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Plain language summary for the patient - Download as a beautifully formatted letter
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyPatientCopy}
                    className="h-8 w-8 p-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleExportPatientLetter}
                    className="gap-2"
                  >
                    <FileDown className="h-4 w-4" />
                    Download Letter
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {patientCopy || 'No patient summary available'}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referral" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Referral Guidance</CardTitle>
              <p className="text-sm text-muted-foreground">
                Specialist referral recommendations
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                {referral || 'No referral indicated'}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review" className="space-y-4 mt-4">
          {/* Clinical Actions & Safety Netting */}
          {(clinicalActions || review) && (
            <div className="grid gap-4 md:grid-cols-2">
              {clinicalActions && <ClinicalActionsPanel actions={clinicalActions} />}
              {review && <SafetyNettingPanel safetyAdvice={[review]} />}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Info footer */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        <span>SOAP format consultation notes generated from meeting transcript</span>
      </div>
    </div>
  );
};
