import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { FileText, Download, Shield, AlertTriangle, Clock, CheckCircle, TrendingUp, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, differenceInDays } from 'date-fns';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';

interface CSOComplianceReportProps {
  complaintId: string;
  complaintReference: string;
}

interface ComplianceItem {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'completed' | 'in_progress' | 'pending' | 'overdue';
  dueDate: Date;
  assignedTo: string;
  nextSteps: string[];
  evidence: string[];
  riskLevel: 'high' | 'medium' | 'low';
}

interface CSOReportData {
  summary: {
    totalItems: number;
    completionRate: number;
    criticalItems: number;
    overdueItems: number;
    estimatedCompletionDate: Date;
  };
  dcb0129Compliance: {
    clinicalSafetyCase: ComplianceItem;
    hazardAnalysis: ComplianceItem;
    riskAssessment: ComplianceItem;
    postDeploymentMonitoring: ComplianceItem;
  };
  implementationTimeline: {
    phase: string;
    status: 'completed' | 'current' | 'upcoming';
    startDate: Date;
    endDate: Date;
    keyActivities: string[];
    dependencies: string[];
  }[];
  criticalActions: ComplianceItem[];
  recommendations: {
    priority: 'immediate' | 'short_term' | 'long_term';
    title: string;
    description: string;
    timeline: string;
    owner: string;
  }[];
}

export function CSOComplianceReport({ complaintId, complaintReference }: CSOComplianceReportProps) {
  const [open, setOpen] = useState(false);
  const [reportData, setReportData] = useState<CSOReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Mock data for demonstration - in real implementation this would come from the database
  const generateMockReportData = (): CSOReportData => {
    const now = new Date();
    return {
      summary: {
        totalItems: 12,
        completionRate: 75,
        criticalItems: 3,
        overdueItems: 1,
        estimatedCompletionDate: addDays(now, 14)
      },
      dcb0129Compliance: {
        clinicalSafetyCase: {
          id: '1',
          title: 'Clinical Safety Case Documentation',
          description: 'Complete clinical safety case as per DCB0129 requirements',
          priority: 'critical',
          status: 'completed',
          dueDate: addDays(now, -7),
          assignedTo: 'Clinical Safety Officer',
          nextSteps: ['Annual review scheduled', 'Update post-implementation monitoring'],
          evidence: ['Clinical Safety Plan v2.1', 'Hazard Log', 'Safety Case Report'],
          riskLevel: 'low'
        },
        hazardAnalysis: {
          id: '2',
          title: 'Comprehensive Hazard Analysis',
          description: 'Systematic identification and analysis of clinical hazards',
          priority: 'critical',
          status: 'in_progress',
          dueDate: addDays(now, 7),
          assignedTo: 'Clinical Safety Officer',
          nextSteps: ['Complete hazard identification workshop', 'Update hazard log', 'Submit for CSO review'],
          evidence: ['Hazard Analysis Worksheet', 'Clinical Risk Assessment'],
          riskLevel: 'medium'
        },
        riskAssessment: {
          id: '3',
          title: 'Clinical Risk Assessment',
          description: 'Assessment of clinical risks and mitigation strategies',
          priority: 'high',
          status: 'pending',
          dueDate: addDays(now, 14),
          assignedTo: 'Risk Management Team',
          nextSteps: ['Initiate risk assessment process', 'Engage clinical stakeholders', 'Document mitigation strategies'],
          evidence: [],
          riskLevel: 'high'
        },
        postDeploymentMonitoring: {
          id: '4',
          title: 'Post-Deployment Monitoring Plan',
          description: 'Ongoing monitoring and surveillance plan post-implementation',
          priority: 'high',
          status: 'pending',
          dueDate: addDays(now, 21),
          assignedTo: 'Clinical Safety Officer',
          nextSteps: ['Develop monitoring framework', 'Define KPIs and metrics', 'Set up monitoring infrastructure'],
          evidence: [],
          riskLevel: 'medium'
        }
      },
      implementationTimeline: [
        {
          phase: 'Pre-Implementation Assessment',
          status: 'completed',
          startDate: addDays(now, -30),
          endDate: addDays(now, -14),
          keyActivities: ['Initial safety assessment', 'Stakeholder engagement', 'Documentation review'],
          dependencies: ['CSO approval', 'Clinical governance sign-off']
        },
        {
          phase: 'Clinical Safety Documentation',
          status: 'current',
          startDate: addDays(now, -14),
          endDate: addDays(now, 7),
          keyActivities: ['Hazard analysis completion', 'Risk assessment', 'Safety case development'],
          dependencies: ['Clinical team input', 'IT security clearance']
        },
        {
          phase: 'Implementation & Monitoring',
          status: 'upcoming',
          startDate: addDays(now, 7),
          endDate: addDays(now, 28),
          keyActivities: ['System deployment', 'Staff training', 'Post-deployment monitoring'],
          dependencies: ['Technical infrastructure', 'Staff availability']
        }
      ],
      criticalActions: [
        {
          id: '5',
          title: 'Complete Outstanding Hazard Analysis',
          description: 'Critical: Hazard analysis workshop and documentation must be completed within 7 days',
          priority: 'critical',
          status: 'in_progress',
          dueDate: addDays(now, 7),
          assignedTo: 'Dr. Sarah Johnson (CSO)',
          nextSteps: [
            'Schedule final hazard identification workshop (Due: 3 days)',
            'Update comprehensive hazard log (Due: 5 days)',
            'Submit completed analysis for CSO review (Due: 7 days)'
          ],
          evidence: ['Draft hazard analysis', 'Workshop notes'],
          riskLevel: 'high'
        },
        {
          id: '6',
          title: 'Overdue Risk Mitigation Documentation',
          description: 'Critical: Risk mitigation strategies documentation is overdue and blocking implementation',
          priority: 'critical',
          status: 'overdue',
          dueDate: addDays(now, -2),
          assignedTo: 'Risk Management Team',
          nextSteps: [
            'IMMEDIATE: Complete risk mitigation documentation (Overdue by 2 days)',
            'Escalate to Clinical Director for resource allocation',
            'Implement interim risk controls pending documentation'
          ],
          evidence: [],
          riskLevel: 'high'
        }
      ],
      recommendations: [
        {
          priority: 'immediate',
          title: 'Expedite Risk Documentation',
          description: 'Address overdue risk mitigation documentation to prevent implementation delays',
          timeline: 'Within 48 hours',
          owner: 'Clinical Director'
        },
        {
          priority: 'short_term',
          title: 'Enhance Monitoring Framework',
          description: 'Develop comprehensive post-deployment monitoring with automated alerts',
          timeline: '2-3 weeks',
          owner: 'Clinical Safety Officer'
        },
        {
          priority: 'long_term',
          title: 'Establish Regular Review Process',
          description: 'Implement quarterly clinical safety reviews with stakeholder engagement',
          timeline: '3 months',
          owner: 'Clinical Governance Committee'
        }
      ]
    };
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // In a real implementation, you would fetch actual data from the database
      // For now, we'll use mock data
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setReportData(generateMockReportData());
    } catch (error) {
      console.error('Error fetching CSO report data:', error);
      toast.error('Failed to load CSO compliance report data');
    } finally {
      setLoading(false);
    }
  };

  const generateDetailedReport = async () => {
    setGenerating(true);
    try {
      // Generate comprehensive CSO report using the existing edge function but with enhanced parameters
      const { data: csoReportData, error: csoError } = await supabase.functions.invoke(
        'generate-cqc-compliance-report',
        { 
          body: { 
            complaintId,
            reportType: 'cso_detailed',
            includeTimelines: true,
            includeNextSteps: true,
            includeDCB0129: true
          } 
        }
      );
      
      if (csoError) {
        console.error('Failed to generate CSO compliance report:', csoError);
        toast.error(`Failed to generate CSO compliance report: ${csoError.message || 'Unknown error'}`);
        throw new Error(csoError.message || 'Failed to generate CSO compliance report');
      }
      
      console.log('CSO compliance report generated successfully:', csoReportData);
      toast.success(`Detailed CSO compliance report generated successfully for ${complaintReference}`);
      
      // Refresh the report data
      await fetchReportData();
      
    } catch (error) {
      console.error('Error generating CSO compliance report:', error);
      toast.error(`Failed to generate CSO compliance report: ${error.message || 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  };

  const downloadDetailedReport = async () => {
    if (!reportData) return;

    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: `CSO Compliance Report (Detailed) - ${complaintReference}`,
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              text: `Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
              spacing: { after: 200 },
            }),
            
            // Executive Summary
            new Paragraph({
              text: "Executive Summary",
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Completion Rate: ", bold: true }),
                new TextRun(`${reportData.summary.completionRate}% (${reportData.summary.totalItems} total items)`),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Critical Items Outstanding: ", bold: true }),
                new TextRun(`${reportData.summary.criticalItems}`),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Estimated Completion: ", bold: true }),
                new TextRun(format(reportData.summary.estimatedCompletionDate, 'dd/MM/yyyy')),
              ],
              spacing: { after: 300 },
            }),

            // DCB0129 Compliance Status
            new Paragraph({
              text: "DCB0129 Compliance Status",
              heading: HeadingLevel.HEADING_2,
            }),
            ...Object.entries(reportData.dcb0129Compliance).map(([key, item]) => [
              new Paragraph({
                children: [
                  new TextRun({ text: `${item.title}: `, bold: true }),
                  new TextRun(`${item.status.toUpperCase()} - Due: ${format(item.dueDate, 'dd/MM/yyyy')}`),
                ],
              }),
              new Paragraph({
                text: item.description,
                spacing: { after: 100 },
              }),
              ...item.nextSteps.map(step => new Paragraph({
                text: `• ${step}`,
                indent: { left: 200 },
              })),
              new Paragraph({ text: "", spacing: { after: 200 } }),
            ]).flat(),

            // Critical Actions with Timelines
            new Paragraph({
              text: "Critical Actions & Next Steps",
              heading: HeadingLevel.HEADING_2,
            }),
            ...reportData.criticalActions.map(action => [
              new Paragraph({
                children: [
                  new TextRun({ text: action.title, bold: true, color: action.status === 'overdue' ? 'FF0000' : '000000' }),
                ],
              }),
              new Paragraph({
                text: action.description,
                spacing: { after: 100 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Assigned to: ", bold: true }),
                  new TextRun(action.assignedTo),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Due Date: ", bold: true }),
                  new TextRun(format(action.dueDate, 'dd/MM/yyyy')),
                ],
              }),
              new Paragraph({
                text: "Next Steps:",
                spacing: { before: 100 },
              }),
              ...action.nextSteps.map(step => new Paragraph({
                text: `• ${step}`,
                indent: { left: 200 },
              })),
              new Paragraph({ text: "", spacing: { after: 300 } }),
            ]).flat(),

            // Recommendations
            new Paragraph({
              text: "Recommendations",
              heading: HeadingLevel.HEADING_2,
            }),
            ...reportData.recommendations.map(rec => [
              new Paragraph({
                children: [
                  new TextRun({ text: `[${rec.priority.toUpperCase()}] ${rec.title}`, bold: true }),
                ],
              }),
              new Paragraph({
                text: rec.description,
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Timeline: ", bold: true }),
                  new TextRun(rec.timeline),
                  new TextRun({ text: " | Owner: ", bold: true }),
                  new TextRun(rec.owner),
                ],
                spacing: { after: 200 },
              }),
            ]).flat(),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CSO-Compliance-Report-${complaintReference}-${format(new Date(), 'yyyy-MM-dd')}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Detailed CSO report downloaded successfully');
    } catch (error) {
      console.error('Failed to generate detailed report:', error);
      toast.error('Failed to generate detailed report');
    }
  };

  useEffect(() => {
    if (open) {
      fetchReportData();
    }
  }, [open]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700">
          <Shield className="h-4 w-4" />
          CSO Compliance Report (Detailed)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-600" />
            CSO Compliance Report (Detailed) - {complaintReference}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-2 mb-4">
          <Button 
            onClick={generateDetailedReport}
            disabled={generating}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
          >
            {generating ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4 mr-2" />
                Generate New Report
              </>
            )}
          </Button>
          
          <Button 
            onClick={downloadDetailedReport}
            disabled={!reportData}
            size="sm"
            variant="outline"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Detailed Report
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 animate-pulse" />
            Loading CSO compliance data...
          </div>
        ) : reportData ? (
          <ScrollArea className="max-h-[70vh]">
            <Tabs defaultValue="summary" className="space-y-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="dcb0129">DCB0129</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="critical">Critical Items</TabsTrigger>
                <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
              </TabsList>

              <TabsContent value="summary">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        Overall Progress
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Completion Rate</span>
                            <span>{reportData.summary.completionRate}%</span>
                          </div>
                          <Progress value={reportData.summary.completionRate} className="h-2" />
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Total Items</p>
                            <p className="text-2xl font-bold">{reportData.summary.totalItems}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Estimated Completion</p>
                            <p className="font-semibold">{format(reportData.summary.estimatedCompletionDate, 'dd/MM/yyyy')}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-red-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                        <AlertTriangle className="h-5 w-5" />
                        Attention Required
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Critical Items</span>
                          <Badge className="bg-red-100 text-red-800">
                            {reportData.summary.criticalItems}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Overdue Items</span>
                          <Badge className="bg-red-100 text-red-800">
                            {reportData.summary.overdueItems}
                          </Badge>
                        </div>
                        {reportData.summary.overdueItems > 0 && (
                          <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                            <AlertTriangle className="h-3 w-3 inline mr-1" />
                            Immediate action required on overdue items
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="dcb0129">
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-800 mb-2">DCB0129 Clinical Safety Requirements</h3>
                    <p className="text-sm text-blue-700">
                      Status of clinical safety documentation and compliance activities as required by NHS Digital DCB0129 standard.
                    </p>
                  </div>
                  
                  {Object.entries(reportData.dcb0129Compliance).map(([key, item]) => (
                    <Card key={key} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{item.title}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Badge className={getStatusColor(item.status)}>
                              {item.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                            <Badge className={getPriorityColor(item.priority)}>
                              {item.priority.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Due Date</label>
                            <p className="text-sm">{format(item.dueDate, 'dd/MM/yyyy')}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Assigned To</label>
                            <p className="text-sm">{item.assignedTo}</p>
                          </div>
                        </div>
                        
                        {item.nextSteps.length > 0 && (
                          <div className="mb-4">
                            <label className="text-xs font-medium text-muted-foreground">Next Steps</label>
                            <ul className="text-sm mt-1 space-y-1">
                              {item.nextSteps.map((step, index) => (
                                <li key={index} className="flex items-start gap-2">
                                  <CheckCircle className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
                                  {step}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {item.evidence.length > 0 && (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Supporting Evidence</label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.evidence.map((evidence, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {evidence}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="timeline">
                <div className="space-y-4">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h3 className="font-semibold text-purple-800 mb-2">Implementation Timeline</h3>
                    <p className="text-sm text-purple-700">
                      Key phases and milestones for CSO compliance implementation.
                    </p>
                  </div>

                  {reportData.implementationTimeline.map((phase, index) => (
                    <Card key={index} className={`border-l-4 ${
                      phase.status === 'completed' ? 'border-l-green-500' :
                      phase.status === 'current' ? 'border-l-blue-500' : 'border-l-gray-300'
                    }`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {phase.status === 'completed' ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : phase.status === 'current' ? (
                              <Clock className="h-5 w-5 text-blue-600" />
                            ) : (
                              <Calendar className="h-5 w-5 text-gray-400" />
                            )}
                            {phase.phase}
                          </CardTitle>
                          <Badge className={
                            phase.status === 'completed' ? 'bg-green-100 text-green-800' :
                            phase.status === 'current' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }>
                            {phase.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                          <div>
                            <label className="font-medium text-muted-foreground">Start Date</label>
                            <p>{format(phase.startDate, 'dd/MM/yyyy')}</p>
                          </div>
                          <div>
                            <label className="font-medium text-muted-foreground">End Date</label>
                            <p>{format(phase.endDate, 'dd/MM/yyyy')}</p>
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <label className="text-sm font-medium text-muted-foreground">Key Activities</label>
                          <ul className="text-sm mt-1 space-y-1">
                            {phase.keyActivities.map((activity, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-muted-foreground">•</span>
                                {activity}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Dependencies</label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {phase.dependencies.map((dep, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {dep}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="critical">
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Critical Actions Required
                    </h3>
                    <p className="text-sm text-red-700">
                      High-priority items requiring immediate attention with specific timelines and next steps.
                    </p>
                  </div>

                  {reportData.criticalActions.map((action) => (
                    <Card key={action.id} className={`border-l-4 ${
                      action.status === 'overdue' ? 'border-l-red-500 bg-red-50' : 'border-l-orange-500'
                    }`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg flex items-center gap-2">
                              {action.status === 'overdue' ? (
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                              ) : (
                                <Clock className="h-5 w-5 text-orange-600" />
                              )}
                              {action.title}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Badge className={getStatusColor(action.status)}>
                              {action.status === 'overdue' ? 'OVERDUE' : action.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                            <Badge className={getPriorityColor(action.priority)}>
                              {action.priority.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Due Date</label>
                            <p className={`text-sm ${action.status === 'overdue' ? 'text-red-600 font-semibold' : ''}`}>
                              {format(action.dueDate, 'dd/MM/yyyy')}
                              {action.status === 'overdue' && (
                                <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                                  {Math.abs(differenceInDays(new Date(), action.dueDate))} days overdue
                                </span>
                              )}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Assigned To</label>
                            <p className="text-sm">{action.assignedTo}</p>
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <label className="text-sm font-medium text-muted-foreground">Next Steps & Timelines</label>
                          <ul className="text-sm mt-2 space-y-2">
                            {action.nextSteps.map((step, index) => (
                              <li key={index} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                                <span className="inline-block w-6 h-6 bg-blue-100 text-blue-800 text-xs rounded-full text-center leading-6 flex-shrink-0">
                                  {index + 1}
                                </span>
                                {step}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {action.evidence.length > 0 && (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Current Evidence</label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {action.evidence.map((evidence, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {evidence}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="recommendations">
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-semibold text-green-800 mb-2">Strategic Recommendations</h3>
                    <p className="text-sm text-green-700">
                      Prioritised recommendations for improving CSO compliance and clinical safety processes.
                    </p>
                  </div>

                  {reportData.recommendations.map((rec, index) => (
                    <Card key={index} className={`border-l-4 ${
                      rec.priority === 'immediate' ? 'border-l-red-500' :
                      rec.priority === 'short_term' ? 'border-l-orange-500' : 'border-l-green-500'
                    }`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{rec.title}</CardTitle>
                          <Badge className={
                            rec.priority === 'immediate' ? 'bg-red-100 text-red-800' :
                            rec.priority === 'short_term' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                          }>
                            {rec.priority.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">{rec.description}</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Timeline</label>
                            <p className="text-sm">{rec.timeline}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Owner</label>
                            <p className="text-sm">{rec.owner}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </ScrollArea>
        ) : (
          <div className="text-center py-8">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No CSO Compliance Data</h3>
            <p className="text-muted-foreground mb-4">
              Generate a detailed CSO compliance report to view comprehensive clinical safety analysis.
            </p>
            <Button onClick={generateDetailedReport} className="bg-purple-600 hover:bg-purple-700">
              <TrendingUp className="h-4 w-4 mr-2" />
              Generate CSO Compliance Report
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}