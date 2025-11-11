import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, FileText, ChevronDown, ChevronUp, FileDown, MoreVertical, Mail } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { showToast } from '@/utils/toastWrapper';
import { ClinicalActionsPanel, ClinicalAction } from './ClinicalActionsPanel';
import { SafetyNettingPanel } from './SafetyNettingPanel';
import { formatSoapNote } from '@/utils/emrFormatters';
import { PatientLetterPreview } from './PatientLetterPreview';
import { exportConsultationToWord } from '@/utils/consultationWordExport';
import { supabase } from '@/integrations/supabase/client';
import { saveAs } from 'file-saver';

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
  onEmailPatientCopy?: () => void;
}

const getSoapSections = (emrFormat: EmrFormat) => {
  if (emrFormat === 'emis') {
    return [
      {
        key: 'S' as const,
        title: 'History',
        icon: '💬',
        description: 'Patient\'s presenting complaint and history',
        color: 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
      },
      {
        key: 'O' as const,
        title: 'Examination',
        icon: '🩺',
        description: 'Clinical findings and observations',
        color: 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
      },
      {
        key: 'A' as const,
        title: 'Comment',
        icon: '🔎',
        description: 'Clinical impression and diagnosis',
        color: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
      },
      {
        key: 'P' as const,
        title: 'Plan',
        icon: '✅',
        description: 'Treatment and follow-up',
        color: 'border-l-violet-500 bg-violet-50/50 dark:bg-violet-950/20'
      }
    ];
  } else {
    return [
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
  }
};

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
  onExport,
  onEmailPatientCopy
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
    showToast.success(`${section} section copied for ${systemName}`, { section: 'meeting_manager' });
    
    if (onCopySection) {
      onCopySection(section);
    }
  };

  const handleCopyAll = () => {
    if (!soapNotes) return;
    
    const formattedText = formatSoapNote(emrFormat, soapNotes, undefined, consultationType);
    navigator.clipboard.writeText(formattedText);
    
    const systemName = emrFormat === 'emis' ? 'EMIS Web' : 'SystmOne';
    showToast.success(`Complete SOAP notes copied for ${systemName}`, { section: 'meeting_manager' });
    
    if (onCopyAll) {
      onCopyAll();
    }
  };

  const handleCopySummary = () => {
    if (!summaryLine) return;
    
    navigator.clipboard.writeText(summaryLine);
    showToast.success('Summary line copied to clipboard', { section: 'meeting_manager' });
  };

  const handleCopyPatientCopy = () => {
    if (!patientCopy) return;
    
    navigator.clipboard.writeText(patientCopy);
    showToast.success('Patient copy copied to clipboard', { section: 'meeting_manager' });
  };

  const handleExportToWord = async () => {
    try {
      showToast.info('Generating consultation document...', { section: 'meeting_manager' });

      await exportConsultationToWord({
        shorthand,
        standard,
        summaryLine,
        patientCopy,
        referral,
        review,
        clinicalActions,
        consultationType,
        consultationDate: new Date()
      });

      showToast.success('Consultation document downloaded', { section: 'meeting_manager' });
    } catch (error) {
      console.error('Export failed:', error);
      showToast.error('Failed to export consultation document');
    }
  };

  const handleExportPatientLetter = async () => {
    if (!patientCopy) {
      showToast.error('No patient information available to export');
      return;
    }
    
    try {
      showToast.info('Creating your patient letter...', { section: 'meeting_manager' });
      const { exportPatientLetterToWord } = await import('@/utils/patientLetterExport');
      
      await exportPatientLetterToWord({
        patientCopy,
        summaryLine,
        consultationType,
        clinicalActions,
        review,
        referral
      });
      
      showToast.success('Patient letter downloaded successfully', { section: 'meeting_manager' });
    } catch (error) {
      console.error('Patient letter export failed:', error);
      showToast.error('Failed to create patient letter');
    }
  };

  if (!soapNotes && !summaryLine) {
    return null;
  }

  const soapSections = getSoapSections(emrFormat);

  const renderSoapCard = (section: typeof soapSections[0], content: string, isCompact: boolean = false) => {
    const isExpanded = expandedSections.has(section.key);
    const shouldTruncate = isCompact && !isExpanded && content?.length > 200;
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

          {/* Inline quick actions and Popover menu (replaces dropdown) */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="Email patient copy"
              onClick={() => {
                if (onEmailPatientCopy) {
                  onEmailPatientCopy();
                } else {
                  showToast.info('Email action not available', { section: 'meeting_manager' });
                }
              }}
            >
              <Mail className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="Download Word document"
              onClick={handleExportToWord}
              title="Download Word document"
            >
              <FileDown className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="Copy all clinical notes"
              onClick={handleCopyAll}
              title="Copy all clinical notes"
            >
              <Copy className="h-4 w-4" />
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="More actions">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={6} className="z-[9999] w-56 p-1">
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start gap-2"
                    onClick={handleCopyAll}
                  >
                    <Copy className="h-4 w-4" />
                    Copy all
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start gap-2"
                    onClick={handleExportToWord}
                  >
                    <FileDown className="h-4 w-4" />
                    Export to Word
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
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
                    Patient Letter Preview
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    This shows how your patient letter will look when downloaded
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyPatientCopy}
                    className="h-8 w-8 p-0"
                    title="Copy text"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {onEmailPatientCopy && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onEmailPatientCopy}
                      className="gap-2"
                      title="Email patient letter"
                    >
                      <Mail className="h-4 w-4" />
                      Email Letter
                    </Button>
                  )}
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
              {patientCopy ? (
                <PatientLetterPreview
                  patientCopy={patientCopy}
                  summaryLine={summaryLine}
                  consultationType={consultationType}
                  clinicalActions={clinicalActions}
                  review={review}
                  referral={referral}
                />
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No patient letter available
                </p>
              )}
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
        <span>SOAP format consultation notes generated from meeting transcript - AI can and does make mistakes so please check the notes accurately reflect the consultation</span>
      </div>
    </div>
  );
};
