import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Shield, FileText, Download, Eye, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { toast } from 'sonner';

interface HazardItem {
  id: string;
  system: 'meeting_manager' | 'complaint_system';
  hazardId: string;
  title: string;
  description: string;
  clinicalContext: string;
  potentialHarm: string;
  severity: 'catastrophic' | 'major' | 'moderate' | 'minor' | 'negligible';
  probability: 'frequent' | 'probable' | 'occasional' | 'remote' | 'improbable';
  riskLevel: 'high' | 'medium' | 'low';
  currentControls: string[];
  additionalControls: string[];
  residualRisk: 'high' | 'medium' | 'low';
  status: 'identified' | 'mitigated' | 'accepted' | 'residual';
  owner: string;
  reviewDate: string;
}

const hazardAnalysisData: HazardItem[] = [
  // Meeting Manager Hazards
  {
    id: 'MM-H001',
    system: 'meeting_manager',
    hazardId: 'MM-H001',
    title: 'Incorrect Transcription of Clinical Information',
    description: 'AI transcription system misinterprets or incorrectly transcribes spoken clinical information during patient consultations',
    clinicalContext: 'GP consultations, clinical assessments, medication reviews, diagnosis discussions',
    potentialHarm: 'Incorrect clinical records leading to misdiagnosis, inappropriate treatment, medication errors, delayed care',
    severity: 'major',
    probability: 'occasional',
    riskLevel: 'high',
    currentControls: [
      'Human review and validation of all transcripts',
      'Clear audio quality requirements and monitoring',
      'Medical terminology training for AI models',
      'Version control and audit trails for all edits'
    ],
    additionalControls: [
      'Implement confidence scoring for transcriptions',
      'Flag uncertain medical terms for manual review',
      'Regular accuracy testing with clinical scenarios',
      'Integration with clinical decision support systems'
    ],
    residualRisk: 'medium',
    status: 'mitigated',
    owner: 'Clinical Safety Officer',
    reviewDate: '2025-01-15'
  },
  {
    id: 'MM-H002',
    system: 'meeting_manager',
    hazardId: 'MM-H002',
    title: 'Unauthorised Access to Patient Consultation Recordings',
    description: 'Breach of patient confidentiality through unauthorised access to recorded consultations or transcripts',
    clinicalContext: 'All patient consultations containing sensitive medical information',
    potentialHarm: 'Privacy breach, loss of patient trust, regulatory non-compliance, psychological harm to patients',
    severity: 'major',
    probability: 'remote',
    riskLevel: 'medium',
    currentControls: [
      'Role-based access controls with MFA',
      'End-to-end encryption for recordings and transcripts',
      'Comprehensive audit logging of all access',
      'Regular access reviews and user de-provisioning',
      'Data retention policies and automatic deletion'
    ],
    additionalControls: [
      'Implement zero-trust network architecture',
      'Enhanced monitoring for unusual access patterns',
      'Regular penetration testing and vulnerability assessments',
      'Patient consent management system integration'
    ],
    residualRisk: 'low',
    status: 'mitigated',
    owner: 'Information Security Manager',
    reviewDate: '2025-02-01'
  },
  {
    id: 'MM-H003',
    system: 'meeting_manager',
    hazardId: 'MM-H003',
    title: 'System Unavailability During Critical Consultations',
    description: 'Meeting recording or transcription system becomes unavailable during urgent or critical patient consultations',
    clinicalContext: 'Emergency consultations, complex diagnoses, medication adjustments, critical care decisions',
    potentialHarm: 'Loss of important clinical information, incomplete documentation, reduced care quality',
    severity: 'moderate',
    probability: 'occasional',
    riskLevel: 'medium',
    currentControls: [
      'High availability infrastructure with 99.9% uptime',
      'Automatic failover mechanisms',
      'Real-time system monitoring and alerting',
      'Manual documentation fallback procedures',
      'Regular system maintenance windows outside clinical hours'
    ],
    additionalControls: [
      'Implement redundant recording capabilities',
      'Local backup recording on clinician devices',
      'Enhanced disaster recovery procedures',
      'Staff training on alternative documentation methods'
    ],
    residualRisk: 'low',
    status: 'mitigated',
    owner: 'Technical Operations Manager',
    reviewDate: '2025-01-30'
  },

  // Complaint System Hazards
  {
    id: 'CS-H001',
    system: 'complaint_system',
    hazardId: 'CS-H001',
    title: 'Delayed or Missed Processing of Serious Safety Complaints',
    description: 'Complaint system fails to properly categorise, escalate, or process complaints related to patient safety incidents',
    clinicalContext: 'Patient safety incidents, medication errors, diagnostic delays, treatment complications',
    potentialHarm: 'Failure to identify systemic safety issues, continued patient harm, regulatory non-compliance',
    severity: 'major',
    probability: 'occasional',
    riskLevel: 'high',
    currentControls: [
      'Automated risk categorisation based on keywords',
      'Mandatory review timeframes with escalation',
      'Integration with incident reporting systems',
      'Senior clinician review for all safety-related complaints',
      'Real-time monitoring dashboards'
    ],
    additionalControls: [
      'AI-powered risk assessment for complaint triage',
      'Direct integration with CQC reporting systems',
      'Automated alerts to clinical governance teams',
      'Pattern recognition for recurring safety themes'
    ],
    residualRisk: 'medium',
    status: 'mitigated',
    owner: 'Clinical Governance Lead',
    reviewDate: '2025-01-20'
  },
  {
    id: 'CS-H002',
    system: 'complaint_system',
    hazardId: 'CS-H002',
    title: 'Breach of Complainant Confidentiality',
    description: 'Unauthorised disclosure of complaint details, patient information, or complainant identity',
    clinicalContext: 'All complaints containing patient data, family concerns, sensitive clinical information',
    potentialHarm: 'Privacy breach, loss of trust, regulatory sanctions, psychological harm to complainants',
    severity: 'major',
    probability: 'remote',
    riskLevel: 'medium',
    currentControls: [
      'Strict access controls based on role and need-to-know',
      'Encryption of all complaint data at rest and in transit',
      'Comprehensive audit trails for all system access',
      'Regular training on confidentiality requirements',
      'Secure communication channels for complaint handling'
    ],
    additionalControls: [
      'Implement data loss prevention (DLP) systems',
      'Enhanced monitoring for data export activities',
      'Regular compliance audits and penetration testing',
      'Automated redaction of sensitive information in reports'
    ],
    residualRisk: 'low',
    status: 'mitigated',
    owner: 'Data Protection Officer',
    reviewDate: '2025-02-15'
  },
  {
    id: 'CS-H003',
    system: 'complaint_system',
    hazardId: 'CS-H003',
    title: 'Inadequate Investigation Leading to Continued Harm',
    description: 'Complaint investigation process fails to identify root causes or implement effective corrective actions',
    clinicalContext: 'Complex clinical complaints, systemic issues, recurring problems, multi-disciplinary concerns',
    potentialHarm: 'Continued patient harm, failure to improve services, regulatory enforcement action',
    severity: 'major',
    probability: 'occasional',
    riskLevel: 'high',
    currentControls: [
      'Structured investigation methodology (RCA/SWARM)',
      'Multi-disciplinary investigation teams',
      'Mandatory action plan development and tracking',
      'Regular review of complaint themes and trends',
      'Integration with quality improvement programmes'
    ],
    additionalControls: [
      'External expert review for complex cases',
      'Standardised investigation templates and checklists',
      'Outcome measurement and effectiveness tracking',
      'Learning dissemination across the organisation'
    ],
    residualRisk: 'medium',
    status: 'mitigated',
    owner: 'Quality Improvement Manager',
    reviewDate: '2025-01-25'
  }
];

export function HazardAnalysisReport() {
  const [selectedSystem, setSelectedSystem] = useState<string>('all');
  const [selectedHazard, setSelectedHazard] = useState<HazardItem | null>(null);

  const filteredHazards = selectedSystem === 'all' 
    ? hazardAnalysisData 
    : hazardAnalysisData.filter(hazard => hazard.system === selectedSystem);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'catastrophic': return 'bg-red-100 text-red-800 border-red-200';
      case 'major': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'minor': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'negligible': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSystemName = (system: string) => {
    switch (system) {
      case 'meeting_manager': return 'Meeting Manager';
      case 'complaint_system': return 'Complaint System';
      default: return system;
    }
  };

  const downloadHazardAnalysis = async () => {
    try {
      const systems = ['meeting_manager', 'complaint_system'];
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: 'Notewell Clinical Safety Hazard Analysis Report',
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              text: `Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
              spacing: { after: 400 },
            }),
            new Paragraph({
              text: 'Executive Summary',
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
              text: `This hazard analysis covers ${hazardAnalysisData.length} identified hazards across two core Notewell systems in scope for the initial pilot: Meeting Manager and Complaint System. All hazards have been assessed using clinical risk management principles in accordance with DCB0129 requirements.`,
              spacing: { after: 300 },
            }),

            // Generate sections for each system
            ...systems.map(systemKey => {
              const systemHazards = hazardAnalysisData.filter(h => h.system === systemKey);
              const systemName = getSystemName(systemKey);
              
              return [
                new Paragraph({
                  text: `${systemName} - Hazard Analysis`,
                  heading: HeadingLevel.HEADING_2,
                }),
                new Paragraph({
                  text: `${systemHazards.length} hazards identified for ${systemName}`,
                  spacing: { after: 200 },
                }),
                ...systemHazards.map(hazard => [
                  new Paragraph({
                    text: `${hazard.hazardId}: ${hazard.title}`,
                    heading: HeadingLevel.HEADING_3,
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Risk Level: ', bold: true }),
                      new TextRun(`${hazard.riskLevel.toUpperCase()} (${hazard.severity}/${hazard.probability})`),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Clinical Context: ', bold: true }),
                      new TextRun(hazard.clinicalContext),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Potential Harm: ', bold: true }),
                      new TextRun(hazard.potentialHarm),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Current Controls: ', bold: true }),
                    ],
                  }),
                  ...hazard.currentControls.map(control => new Paragraph({
                    text: `• ${control}`,
                    indent: { left: 200 },
                  })),
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Residual Risk: ', bold: true }),
                      new TextRun(hazard.residualRisk.toUpperCase()),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Owner: ', bold: true }),
                      new TextRun(hazard.owner),
                      new TextRun({ text: ' | Review Date: ', bold: true }),
                      new TextRun(hazard.reviewDate),
                    ],
                    spacing: { after: 300 },
                  }),
                ]).flat(),
              ];
            }).flat(),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Notewell-Hazard-Analysis-${format(new Date(), 'yyyy-MM-dd')}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Hazard Analysis report downloaded successfully');
    } catch (error) {
      console.error('Failed to generate hazard analysis report:', error);
      toast.error('Failed to generate hazard analysis report');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-orange-600" />
            Clinical Safety Hazard Analysis
          </h2>
          <p className="text-muted-foreground">
            DCB0129 compliant hazard identification and risk assessment for Notewell systems
          </p>
        </div>
        <Button onClick={downloadHazardAnalysis} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Download Full Report
        </Button>
      </div>

      <Tabs value={selectedSystem} onValueChange={setSelectedSystem}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Systems ({hazardAnalysisData.length})</TabsTrigger>
          <TabsTrigger value="meeting_manager">Meeting Manager ({hazardAnalysisData.filter(h => h.system === 'meeting_manager').length})</TabsTrigger>
          <TabsTrigger value="complaint_system">Complaint System ({hazardAnalysisData.filter(h => h.system === 'complaint_system').length})</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedSystem} className="space-y-4">
          <div className="grid gap-4">
            {filteredHazards.map((hazard) => (
              <Card key={hazard.id} className="border-l-4 border-l-orange-500">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Shield className="h-5 w-5 text-orange-600" />
                        {hazard.hazardId}: {hazard.title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getSystemName(hazard.system)} | Owner: {hazard.owner}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Badge className={getRiskColor(hazard.riskLevel)}>
                        {hazard.riskLevel.toUpperCase()} RISK
                      </Badge>
                      <Badge className={getSeverityColor(hazard.severity)}>
                        {hazard.severity.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-1">Clinical Context</h4>
                      <p className="text-sm text-muted-foreground">{hazard.clinicalContext}</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-sm mb-1">Potential Harm</h4>
                      <p className="text-sm text-muted-foreground">{hazard.potentialHarm}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-sm mb-2">Current Controls</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {hazard.currentControls.slice(0, 3).map((control, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-green-600 mt-0.5">•</span>
                              {control}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-sm mb-2">Risk Assessment</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Probability:</span>
                            <Badge variant="outline">{hazard.probability}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Residual Risk:</span>
                            <Badge className={getRiskColor(hazard.residualRisk)}>
                              {hazard.residualRisk.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Review Date:</span>
                            <span className="text-muted-foreground">{hazard.reviewDate}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedHazard(hazard)}
                        className="flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Hazard Detail Modal */}
      {selectedHazard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedHazard(null)}>
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <CardHeader className="border-b">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <AlertTriangle className="h-6 w-6 text-orange-600" />
                    {selectedHazard.hazardId}: {selectedHazard.title}
                  </CardTitle>
                  <p className="text-muted-foreground">{getSystemName(selectedHazard.system)}</p>
                </div>
                <Button variant="outline" onClick={() => setSelectedHazard(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            
            <ScrollArea className="max-h-[70vh]">
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <Badge className={getRiskColor(selectedHazard.riskLevel)} variant="secondary">
                      {selectedHazard.riskLevel.toUpperCase()} RISK
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">Overall Risk</p>
                  </div>
                  <div className="text-center">
                    <Badge className={getSeverityColor(selectedHazard.severity)} variant="secondary">
                      {selectedHazard.severity.toUpperCase()}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">Severity</p>
                  </div>
                  <div className="text-center">
                    <Badge variant="outline">{selectedHazard.probability.toUpperCase()}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">Probability</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground">{selectedHazard.description}</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Clinical Context</h3>
                  <p className="text-muted-foreground">{selectedHazard.clinicalContext}</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Potential Harm</h3>
                  <p className="text-muted-foreground">{selectedHazard.potentialHarm}</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Current Risk Controls</h3>
                  <ul className="space-y-2">
                    {selectedHazard.currentControls.map((control, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span className="text-muted-foreground">{control}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Additional Controls Recommended</h3>
                  <ul className="space-y-2">
                    {selectedHazard.additionalControls.map((control, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-blue-600 mt-0.5">→</span>
                        <span className="text-muted-foreground">{control}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <h4 className="font-medium mb-1">Responsible Owner</h4>
                    <p className="text-muted-foreground">{selectedHazard.owner}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Next Review Date</h4>
                    <p className="text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {selectedHazard.reviewDate}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Residual Risk Assessment</h4>
                      <p className="text-sm text-muted-foreground">Risk level after current controls</p>
                    </div>
                    <Badge className={getRiskColor(selectedHazard.residualRisk)}>
                      {selectedHazard.residualRisk.toUpperCase()} RESIDUAL RISK
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </ScrollArea>
          </Card>
        </div>
      )}
    </div>
  );
}