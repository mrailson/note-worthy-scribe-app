import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import architectureDiagram from "@/assets/architecture-diagram.png";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Users,
  Lock,
  Database,
  TrendingUp,
  Award,
  AlertCircle,
  Clock,
  ChevronRight,
  Download,
  ExternalLink,
  FileCheck,
  Calendar,
  LayoutDashboard,
  ShieldCheck
} from "lucide-react";
import {
  services,
  ai4gpRisks,
  meetingNotesRisks,
  complaintsRisks,
  gdprCompliance,
  securityControls,
  thirdPartyRisks,
  preDeploymentChecklist,
  recommendations,
  type RiskAssessment,
} from "@/data/csoReportData";
import { CSOReportHeader, getSeverityColor, getStatusBadge } from "@/components/cso-report";

const CSOReport = () => {
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [isArchitectureModalOpen, setIsArchitectureModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const { exportCSOReportToWord } = await import('@/utils/exportCSOReport');
      await exportCSOReportToWord();
    } catch (error) {
      console.error('Error exporting report:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const RiskTable = ({ risks, title }: { risks: RiskAssessment[], title: string }) => (
    <div className="space-y-4">
      <h4 className="font-semibold text-lg">{title}</h4>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[100px]">Risk ID</TableHead>
              <TableHead className="min-w-[200px]">Hazard</TableHead>
              <TableHead className="min-w-[150px]">Clinical Context</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Likelihood</TableHead>
              <TableHead>Risk Rating</TableHead>
              <TableHead>Residual Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {risks.map((risk) => (
              <TableRow key={risk.id}>
                <TableCell className="font-mono text-sm">{risk.id}</TableCell>
                <TableCell className="font-medium">{risk.hazard}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{risk.clinicalContext}</TableCell>
                <TableCell><Badge className={getSeverityColor(risk.severity)}>{risk.severity}</Badge></TableCell>
                <TableCell><Badge variant="outline">{risk.likelihood}</Badge></TableCell>
                <TableCell><Badge className={getSeverityColor(risk.riskRating)}>{risk.riskRating}</Badge></TableCell>
                <TableCell><Badge className={getSeverityColor(risk.residualRisk)}>{risk.residualRisk}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {risks.map((risk) => (
          <AccordionItem key={risk.id} value={risk.id}>
            <AccordionTrigger className="text-sm">
              <span className="font-mono mr-2">{risk.id}</span> - View Controls & Actions
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div>
                <h5 className="font-semibold text-sm mb-2">Current Controls:</h5>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {risk.currentControls.map((control, idx) => (
                    <li key={idx}>{control}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-sm mb-2">Further Actions Required:</h5>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {risk.furtherActions.map((action, idx) => (
                    <li key={idx}>{action}</li>
                  ))}
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <CSOReportHeader />

        {/* Main Tabbed Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 h-auto gap-1 mb-8">
            <TabsTrigger value="overview" className="flex items-center gap-2 py-3">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="services-risks" className="flex items-center gap-2 py-3">
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">Services & Risks</span>
            </TabsTrigger>
            <TabsTrigger value="data-protection" className="flex items-center gap-2 py-3">
              <Lock className="w-4 h-4" />
              <span className="hidden sm:inline">Data Protection</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2 py-3">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="compliance" className="flex items-center gap-2 py-3">
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Compliance</span>
            </TabsTrigger>
            <TabsTrigger value="roadmap" className="flex items-center gap-2 py-3">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Roadmap</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8">
            {/* Executive Summary */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <Award className="w-6 h-6" />
                      Executive Summary
                    </CardTitle>
                    <CardDescription>Overall clinical safety and data protection assessment</CardDescription>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 text-lg px-4 py-2">
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    AMBER - Conditionally Acceptable
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="prose dark:prose-invert max-w-none">
                  <p className="text-base leading-relaxed mb-4">
                    <strong>Executive Summary (Updated 30/01/2026)</strong>
                  </p>
                  <p className="text-base leading-relaxed mb-4">
                    NoteWell AI is a Class I, low-risk, non-business-critical administrative and governance support tool for NHS primary care. It provides meeting transcription, structured complaints management, and document generation. NoteWell does not offer clinical decision-making, has no EMIS/S1 write-back, and all outputs require human review.
                  </p>
                  <p className="text-base leading-relaxed mb-4">
                    A full DCB0129 clinical safety analysis has been completed in draft, with a maintained Hazard Log, pending formal adoption by the hosting NHS organisation's Clinical Safety Officer. All data is UK-hosted, encrypted, role-restricted through RLS, and subject to comprehensive audit logging. NoteWell operates strictly as a Data Processor and does not reuse any data for AI training.
                  </p>
                  <p className="text-base leading-relaxed mb-4">
                    The appropriate technical assurance route is a proportionate external web application penetration test, covering OWASP Top 10, authentication, access control, API endpoints and TLS configuration. Red-team, network-level, physical or social engineering testing is not required due to the system's risk profile, standalone architecture, and absence of NHS infrastructure integration.
                  </p>
                  <p className="text-base leading-relaxed">
                    The DPIA has been completed and SIRO/Caldicott approvals will follow final review. Training materials for users will be completed before deployment. Subject to these, NoteWell is suitable for pilot deployment across GP practices and PCNs.
                  </p>
                </div>

                {/* Assurance Status Overview Panel */}
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-6">
                  <h4 className="font-semibold text-lg mb-4 flex items-center gap-2 text-blue-900 dark:text-blue-300">
                    <Shield className="w-5 h-5" />
                    Assurance Status Overview (30/01/2026)
                  </h4>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-blue-100 dark:border-blue-900">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-medium text-muted-foreground">Clinical Safety (DCB0129)</span>
                        <Clock className="w-4 h-4 text-amber-600" />
                      </div>
                      <p className="text-sm font-semibold mb-2">Draft Complete – Pending Host CSO Adoption</p>
                      <div className="space-y-1">
                        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setActiveTab("services-risks")}>
                          <FileText className="w-3 h-3 mr-1" />
                          View Safety Case
                        </Button>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-blue-100 dark:border-blue-900">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-medium text-muted-foreground">Hazard Log</span>
                        <Clock className="w-4 h-4 text-amber-600" />
                      </div>
                      <p className="text-sm font-semibold mb-2">Draft Updated – Pending Host CSO Sign-off</p>
                      <p className="text-xs text-muted-foreground">Meeting Notes & Complaints only</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-blue-100 dark:border-blue-900">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-medium text-muted-foreground">DPIA</span>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <p className="text-sm font-semibold mb-2">Completed</p>
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setActiveTab("data-protection")}>
                        <Shield className="w-3 h-3 mr-1" />
                        View DPIA Summary
                      </Button>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-blue-100 dark:border-blue-900">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-medium text-muted-foreground">SIRO Sign-Off</span>
                        <Clock className="w-4 h-4 text-amber-600" />
                      </div>
                      <p className="text-sm font-semibold mb-2">Pending</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-blue-100 dark:border-blue-900">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-medium text-muted-foreground">Caldicott Guardian</span>
                        <Clock className="w-4 h-4 text-amber-600" />
                      </div>
                      <p className="text-sm font-semibold mb-2">Pending</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-blue-100 dark:border-blue-900">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-medium text-muted-foreground">Pen Test</span>
                        <Clock className="w-4 h-4 text-amber-600" />
                      </div>
                      <p className="text-sm font-semibold mb-1">Commissioned by Host NHS Organisation</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-blue-100 dark:border-blue-900">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-medium text-muted-foreground">Hosting</span>
                        <Clock className="w-4 h-4 text-amber-600" />
                      </div>
                      <p className="text-sm font-semibold mb-1">Development: AWS London via Supabase</p>
                      <p className="text-xs text-muted-foreground mb-2">Target: NHS-hosted tenant (LHIS preferred)</p>
                      <div 
                        className="relative cursor-pointer group"
                        onClick={() => setIsArchitectureModalOpen(true)}
                      >
                        <img 
                          src={architectureDiagram} 
                          alt="NoteWell Architecture Diagram" 
                          className="w-full h-16 object-cover rounded-md border border-border transition-opacity group-hover:opacity-80"
                        />
                        <p className="text-xs text-muted-foreground text-center mt-1">Click to view diagram</p>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-blue-100 dark:border-blue-900">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-medium text-muted-foreground">Cyber Essentials</span>
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      </div>
                      <p className="text-sm font-semibold mb-2">Mandatory Pre-Go-Live</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-blue-100 dark:border-blue-900">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-medium text-muted-foreground">DPAs</span>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <p className="text-sm font-semibold mb-2">Completed (OpenAI, Supabase)</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-lg mb-3 flex items-center gap-2 text-green-700 dark:text-green-400">
                      <CheckCircle className="w-5 h-5" />
                      Key Strengths
                    </h4>
                    <ul className="space-y-2 text-sm">
                      {[
                        "Robust technical architecture with strong authentication and encryption",
                        "Comprehensive audit trails for accountability",
                        "Patient data masking and role-based access controls",
                        "Clear user disclaimers and safety warnings",
                        "Scalable cloud infrastructure with automatic backups",
                        "Data Processing Agreements in place with OpenAI and Supabase"
                      ].map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-lg mb-3 flex items-center gap-2 text-orange-700 dark:text-orange-400">
                      <AlertCircle className="w-5 h-5" />
                      Areas Requiring Attention
                    </h4>
                    <ul className="space-y-2 text-sm">
                      {[
                        "DCB0129 Safety Case pending formal adoption by hosting NHS organisation",
                        "Proportionate external web application penetration test post-migration",
                        "Finalisation and sign-off of the DPIA by ICB IG lead",
                        "Confirmation of hosting model and DSPT ownership",
                        "Clinical validation workflows implementation",
                        "MFA enforcement for all production users"
                      ].map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 mt-0.5 text-orange-600 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <p className="text-sm font-medium">
                    <strong>Recommendation:</strong> System may proceed to controlled deployment within max 15 practice pilot (max 5 for first month), subject to completion of critical requirements within 90 days. Full NHS rollout should not proceed until GREEN rating achieved.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Quick Links
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/dpia"><Lock className="w-4 h-4 mr-2" />DPIA</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/dcb0129"><FileCheck className="w-4 h-4 mr-2" />DCB0129 Hub</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/hazard-log"><AlertTriangle className="w-4 h-4 mr-2" />Hazard Log</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/dtac"><Shield className="w-4 h-4 mr-2" />DTAC</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Services & Risks Tab */}
          <TabsContent value="services-risks" className="space-y-8">
            {/* Service Descriptions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Database className="w-6 h-6" />
                  Service Descriptions
                </CardTitle>
                <CardDescription>Overview of the two Notewell services in scope for the initial pilot</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="border-l-4 border-primary bg-gradient-to-r from-primary/5 to-background rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-3">Service Description (Non-Commercial, NHS-Aligned Model)</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      NoteWell AI is a neighbourhood-aligned digital service designed to support primary care with complaints handling, governance, meeting management and regulatory compliance. It is not a commercial software product; instead, it is being developed collaboratively with the ICS as a shared NHS capability.
                    </p>
                  </div>

                  <Separator />

                  {services.map((service, idx) => (
                    <div key={idx} className="border rounded-lg p-6 space-y-4">
                      <div>
                        <h3 className="text-xl font-semibold mb-2">{service.name}</h3>
                        <p className="text-muted-foreground">{service.purpose}</p>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Key Capabilities:</h4>
                        <ul className="grid md:grid-cols-2 gap-2 text-sm">
                          {service.capabilities.map((cap, capIdx) => (
                            <li key={capIdx} className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                              <span>{cap}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4 pt-2">
                        <div>
                          <h4 className="font-semibold mb-2 text-sm">User Base:</h4>
                          <p className="text-sm text-muted-foreground">{service.userBase}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Hazard Log */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                  Hazard Log – DCB0129
                </CardTitle>
                <CardDescription>Summary of identified hazards with mitigations and residual risk assessments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  { id: 1, title: "Incorrect or Misleading AI Output", severity: "Minor", likelihood: "Medium", initial: "Medium", residual: "Low", mitigation: "Human review required; editable outputs; disclaimers; restricted issuing permissions" },
                  { id: 2, title: "Misinterpretation of User Input by AI Models", severity: "Minor", likelihood: "Medium", initial: "Medium", residual: "Low", mitigation: "Human-in-the-loop; version history; guidance; training" },
                  { id: 3, title: "Data Privacy Breach Due to Incorrect Permissions", severity: "Major", likelihood: "Low", initial: "Medium", residual: "Low", mitigation: "RLS; RBAC; audit logs; session timeout; mandatory MFA" },
                  { id: 4, title: "Transcription Inaccuracies Affecting Meeting Notes", severity: "Minor", likelihood: "Medium", initial: "Medium", residual: "Low", mitigation: "Human verification; audio replay; multiple output styles" }
                ].map((hazard) => (
                  <div key={hazard.id} className={`border rounded-lg p-5 ${hazard.severity === "Major" ? "bg-red-50/50 dark:bg-red-950/10" : "bg-amber-50/50 dark:bg-amber-950/10"}`}>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <span className={`${hazard.severity === "Major" ? "bg-red-100 dark:bg-red-900" : "bg-amber-100 dark:bg-amber-900"} px-3 py-1 rounded text-sm`}>Hazard {hazard.id}</span>
                      {hazard.title}
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div><span className="font-semibold">Severity:</span> <Badge className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">{hazard.severity}</Badge></div>
                      <div><span className="font-semibold">Likelihood:</span> <Badge className="ml-2" variant="outline">{hazard.likelihood}</Badge></div>
                      <div><span className="font-semibold">Initial Risk:</span> <Badge className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">{hazard.initial}</Badge></div>
                      <div><span className="font-semibold">Residual:</span> <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">{hazard.residual}</Badge></div>
                    </div>
                    <div className="mt-3">
                      <span className="font-semibold text-sm">Mitigation:</span>
                      <p className="text-sm text-muted-foreground mt-1">{hazard.mitigation}</p>
                    </div>
                  </div>
                ))}

                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-green-900 dark:text-green-300 mb-2">Overall Statement</h4>
                      <p className="text-sm text-green-800 dark:text-green-400">
                        All identified hazards have effective mitigations in place. No residual high-risk hazards remain. NoteWell is suitable for limited NHS pilot deployment under CSO oversight.
                      </p>
                    </div>
                  </div>
                </div>

                <Button variant="outline" className="w-full" asChild>
                  <Link to="/hazard-log"><FileText className="w-4 h-4 mr-2" />View Complete Hazard Log</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Risk Assessment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <TrendingUp className="w-6 h-6" />
                  Full Clinical Risk Assessment
                </CardTitle>
                <CardDescription>Detailed risk matrices for all services (Meeting Notes & Complaints in pilot scope)</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="meeting-notes" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="meeting-notes">Meeting Notes</TabsTrigger>
                    <TabsTrigger value="complaints">Complaints</TabsTrigger>
                  </TabsList>
                  <TabsContent value="meeting-notes">
                    <RiskTable risks={meetingNotesRisks} title="Meeting Notes & Transcription Risk Assessment" />
                  </TabsContent>
                  <TabsContent value="complaints">
                    <RiskTable risks={complaintsRisks} title="Complaints Management Risk Assessment" />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Protection Tab */}
          <TabsContent value="data-protection" className="space-y-8">
            {/* DPIA Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Lock className="w-6 h-6" />
                  DPIA Summary – NoteWell AI
                </CardTitle>
                <CardDescription>Data Protection Impact Assessment summary for NHS primary care administrative workflows</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-3">Purpose of Processing</h3>
                  <p className="text-sm text-muted-foreground">
                    Administrative and governance workflows in NHS primary care: meetings, complaints handling, document creation.
                  </p>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-lg mb-3">Data Categories</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 mt-0.5 text-blue-600" /><span>Staff details</span></li>
                    <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 mt-0.5 text-blue-600" /><span>Patient information (complaints only)</span></li>
                    <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 mt-0.5 text-blue-600" /><span>Meeting transcripts and governance documentation</span></li>
                    <li className="flex items-start gap-2"><XCircle className="w-4 h-4 mt-0.5 text-gray-600" /><span><strong>No diagnostic or treatment data</strong></span></li>
                  </ul>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-lg mb-3">Lawful Basis</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
                      <h4 className="font-semibold text-sm mb-2 text-blue-900 dark:text-blue-300">Article 6(1)(e)</h4>
                      <p className="text-sm text-blue-800 dark:text-blue-400">Public task</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 rounded-lg p-4">
                      <h4 className="font-semibold text-sm mb-2 text-purple-900 dark:text-purple-300">Article 9(2)(h)</h4>
                      <p className="text-sm text-purple-800 dark:text-purple-400">Health and social care management</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-lg mb-3">Controls</h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {[
                      "UK-only hosting (target: NHS tenant)",
                      "AES-256 at rest, TLS 1.2+ in transit",
                      "Role-based access and RLS",
                      "Full audit logs",
                      "No data used for training"
                    ].map((control, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-3 bg-accent/50 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{control}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-lg mb-3">Privacy Risks & Mitigations</h3>
                  <div className="space-y-3">
                    {[
                      { risk: "Unauthorised access", mitigation: "RLS/RBAC/Mandatory MFA" },
                      { risk: "Excessive data capture", mitigation: "Access controls + retention" },
                      { risk: "Complaint visibility", mitigation: "Masking + permissions" },
                      { risk: "Model prompts", mitigation: "DPA with OpenAI + enforced data minimisation/masking" }
                    ].map((item, idx) => (
                      <div key={idx} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-semibold text-sm">{item.risk}</span>
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">Low</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Mitigation: {item.mitigation}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Button variant="outline" className="w-full" asChild>
                  <Link to="/dpia"><FileText className="w-4 h-4 mr-2" />View Complete DPIA</Link>
                </Button>
              </CardContent>
            </Card>

            {/* GDPR Compliance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Lock className="w-6 h-6" />
                  GDPR & Data Protection Compliance
                </CardTitle>
                <CardDescription>Assessment against GDPR and Data Protection Act 2018 requirements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[180px]">Requirement</TableHead>
                        <TableHead className="min-w-[150px]">Meeting Notes</TableHead>
                        <TableHead className="min-w-[150px]">Complaints</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="min-w-[200px]">Evidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gdprCompliance.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.requirement}</TableCell>
                          <TableCell className="text-sm">{item.meetingNotes}</TableCell>
                          <TableCell className="text-sm">{item.complaints}</TableCell>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.evidence}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Technical Security Tab */}
          <TabsContent value="security" className="space-y-8">
            {/* Security Assessment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Shield className="w-6 h-6" />
                  Technical Security Assessment
                </CardTitle>
                <CardDescription>Security controls implementation and effectiveness rating</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Control Category</TableHead>
                        <TableHead className="min-w-[250px]">Implementation</TableHead>
                        <TableHead>Effectiveness</TableHead>
                        <TableHead className="min-w-[200px]">Gaps/Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {securityControls.map((control, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{control.category}</TableCell>
                          <TableCell className="text-sm">{control.implementation}</TableCell>
                          <TableCell>{getStatusBadge(control.effectiveness)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{control.gaps}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-6 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-orange-900 dark:text-orange-300 mb-1">Critical Security Actions</h4>
                      <ul className="text-sm text-orange-800 dark:text-orange-400 space-y-1 mt-2">
                        <li>• Complete comprehensive security audit</li>
                        <li>• Implement security scanning as part of CI/CD</li>
                        <li>• Conduct penetration testing (minimum annual)</li>
                        <li>• Establish vulnerability disclosure process</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Third-Party Dependencies */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Users className="w-6 h-6" />
                  Third-Party Dependencies
                </CardTitle>
                <CardDescription>Assessment of external service providers and data processors</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {thirdPartyRisks.map((provider, idx) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-lg">{provider.service}</h4>
                          <p className="text-sm text-muted-foreground">{provider.purpose}</p>
                        </div>
                        {getStatusBadge(provider.assuranceLevel)}
                      </div>

                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-semibold">Data Shared:</span>
                          <p className="text-muted-foreground mt-1">{provider.dataShared}</p>
                        </div>
                        <div>
                          <span className="font-semibold">Risk:</span>
                          <p className="text-muted-foreground mt-1">{provider.risk}</p>
                        </div>
                      </div>

                      <div>
                        <span className="font-semibold text-sm">Mitigation Measures:</span>
                        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {provider.mitigation.map((measure, mIdx) => (
                            <li key={mIdx} className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                              <span>{measure}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Hosting Model */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Database className="w-6 h-6" />
                  Deployment and Hosting Model
                </CardTitle>
                <CardDescription>Current vs Target hosting decisions for NHS deployment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-6 rounded-r-lg">
                  <div className="flex items-start gap-3 mb-3">
                    <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-lg text-amber-900 dark:text-amber-300 mb-2">Current (Development Only)</h3>
                      <p className="text-sm text-muted-foreground">Lovable + Supabase, AWS London region, UK-only data storage</p>
                    </div>
                  </div>
                </div>

                <div className="border-l-4 border-green-500 bg-green-50 dark:bg-green-950/20 p-6 rounded-r-lg">
                  <div className="flex items-start gap-3 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-lg text-green-900 dark:text-green-300 mb-2">Target (For Pilot Deployment)</h3>
                      <p className="text-sm text-muted-foreground">NHS-hosted infrastructure (LHIS/UHL preferred) for full governance control</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Compliance Tab */}
          <TabsContent value="compliance" className="space-y-8">
            {/* NHS Assurance Pack Summary */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <FileText className="w-6 h-6" />
                      NHS Assurance, DTAC & Security Overview
                    </CardTitle>
                    <CardDescription>For NHS ICB IT, Digital, IG & Clinical Safety Review</CardDescription>
                  </div>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 text-lg px-4 py-2">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    MHRA Registered
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Overview of NoteWell AI
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    NoteWell AI is a UK-hosted digital platform designed to support administrative and governance workflows across primary care. It does not provide autonomous diagnosis or treatment recommendations and has no direct integration with EMIS or SystmOne, making it a <strong>low-risk DTAC profile</strong>.
                  </p>
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4">
                    <p className="font-semibold text-green-900 dark:text-green-300">In November 2025, NoteWell AI was formally registered as an MHRA Class I Medical Device.</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-xl font-semibold mb-3">DTAC Assessment Summary</h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {[
                      { section: "A: Company Information", status: "Verified" },
                      { section: "B: Value Proposition", status: "Documented" },
                      { section: "C1: Clinical Safety", status: "CSO appointed, DCB0129 compliant" },
                      { section: "C2: Data Protection", status: "ICO registered, DPIA completed" },
                      { section: "C3: Technical Security", status: "Cyber Essentials planned" },
                      { section: "C4: Interoperability", status: "Standards compliance" },
                      { section: "D: Usability & Accessibility", status: "WCAG aligned" }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-3 border rounded-lg bg-background">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <div className="font-semibold">{item.section}</div>
                          <div className="text-muted-foreground">{item.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full mt-4" asChild>
                    <Link to="/dtac"><FileText className="w-4 h-4 mr-2" />View Full DTAC Assessment</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Pre-Deployment Checklist */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <CheckCircle className="w-6 h-6" />
                  Pre-Deployment Readiness Checklist
                </CardTitle>
                <CardDescription>Mandatory actions required before NHS deployment</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.entries(
                  preDeploymentChecklist.reduce((acc, item) => {
                    if (!acc[item.category]) {
                      acc[item.category] = [];
                    }
                    acc[item.category].push(item);
                    return acc;
                  }, {} as Record<string, typeof preDeploymentChecklist>)
                ).map(([category, items], categoryIdx) => (
                  <div key={categoryIdx} className="mb-8 last:mb-0">
                    <h3 className="text-lg font-semibold mb-4 text-primary">
                      {categoryIdx + 1}. {category}
                    </h3>
                    <div className="space-y-3">
                      {items.map((item, idx) => (
                        <div key={idx} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start gap-3">
                            {item.status === 'COMPLETE' ? (
                              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            ) : item.status === 'PARTIAL' ? (
                              <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <p className="font-semibold mb-1">{item.item}</p>
                              <div className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                                <p><span className="font-medium">Owner:</span> {item.owner}</p>
                                <p><span className="font-medium">Status:</span> {getStatusBadge(item.status)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <Separator className="my-6" />

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-700 dark:text-green-400 mb-1">
                      {preDeploymentChecklist.filter(i => i.status === 'COMPLETE').length}
                    </div>
                    <div className="text-sm font-medium text-green-700 dark:text-green-400">Complete</div>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-400 mb-1">
                      {preDeploymentChecklist.filter(i => i.status === 'PARTIAL').length}
                    </div>
                    <div className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Partial</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-red-700 dark:text-red-400 mb-1">
                      {preDeploymentChecklist.filter(i => i.status === 'OUTSTANDING').length}
                    </div>
                    <div className="text-sm font-medium text-red-700 dark:text-red-400">Outstanding</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roadmap & Sign-off Tab */}
          <TabsContent value="roadmap" className="space-y-8">
            {/* Deployment Roadmap */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Calendar className="w-6 h-6" />
                  Deployment Roadmap (NHS-Aligned)
                </CardTitle>
                <CardDescription>Staged NHS assurance pathway from prototype to production</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-base leading-relaxed">
                  The migration and deployment of NoteWell AI will follow a staged NHS assurance pathway. This ensures safe transition from prototype development to NHS-hosted production.
                </p>

                <Accordion type="single" collapsible className="w-full">
                  {[
                    { phase: "0", title: "Foundation (Current Position)", status: "IN PROGRESS", color: "blue" },
                    { phase: "1", title: "NHS Hosting Migration", status: "NOT STARTED", color: "purple" },
                    { phase: "2", title: "Assurance Completion & Pen Test", status: "NOT STARTED", color: "green" },
                    { phase: "3", title: "Controlled Pilot", status: "FUTURE", color: "orange" },
                    { phase: "4", title: "Full Rollout", status: "FUTURE", color: "red" }
                  ].map((item) => (
                    <AccordionItem key={item.phase} value={`phase${item.phase}`}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 w-full">
                          <Badge className={`bg-${item.color}-100 text-${item.color}-800 dark:bg-${item.color}-950 dark:text-${item.color}-300 shrink-0`}>Phase {item.phase}</Badge>
                          <div className="flex-1 text-left">
                            <div className="font-semibold">{item.title}</div>
                            <div className="text-sm text-muted-foreground">Status: {item.status}</div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Detailed phase information available in the full roadmap documentation.</p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <TrendingUp className="w-6 h-6" />
                  Recommendations & Actions
                </CardTitle>
                <CardDescription>Prioritised recommendations from the CSO assessment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recommendations.immediate.map((rec, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold">{rec}</h4>
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">Immediate</Badge>
                      </div>
                    </div>
                  ))}
                  {recommendations.shortTerm.map((rec, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold">{rec}</h4>
                        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">Short Term</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Sign-Off Sections */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    CSO Sign-Off
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div><span className="font-semibold">System Safety Classification:</span> <p className="text-sm text-muted-foreground">MHRA Class I Medical Device Software</p></div>
                    <div className="mt-2"><span className="font-semibold">Overall Safety Rating:</span> <Badge className="ml-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">AMBER</Badge></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">CSO Name:</label>
                      <div className="h-8 border-b-2 border-muted"></div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Date:</label>
                      <div className="h-8 border-b-2 border-muted"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    DPO Sign-Off
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div><span className="font-semibold">GDPR Compliance Status:</span> <Badge className="ml-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">Conditionally Compliant</Badge></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">DPO Name:</label>
                      <div className="h-8 border-b-2 border-muted"></div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Date:</label>
                      <div className="h-8 border-b-2 border-muted"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Export Button */}
        <div className="flex justify-center mt-8">
          <Button 
            variant="default" 
            disabled={isExporting}
            onClick={handleExport}
          >
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? 'Generating...' : 'Export Full Report'}
          </Button>
        </div>

        {/* Confidentiality Notice */}
        <div className="mt-8 p-4 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
          <p className="font-semibold">NHS OFFICIAL-SENSITIVE</p>
          <p className="mt-1">This document contains sensitive information and should be handled in accordance with NHS Information Governance policies.</p>
          <p className="mt-1">© {new Date().getFullYear()} GP Notewell AI. All rights reserved.</p>
        </div>
      </div>

      {/* Architecture Diagram Modal */}
      <Dialog open={isArchitectureModalOpen} onOpenChange={setIsArchitectureModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>NoteWell Architecture Diagram</DialogTitle>
          </DialogHeader>
          <div className="mt-4 overflow-auto max-h-[70vh]">
            <img 
              src={architectureDiagram} 
              alt="NoteWell Architecture Diagram showing system components and data flow" 
              className="w-full h-auto object-contain rounded-md border border-border"
            />
            <p className="text-sm text-muted-foreground mt-4">
              <strong>Current hosting:</strong> Development environment on AWS London via Supabase
              <br />
              <strong>Target:</strong> NHS-hosted tenant (LHIS preferred) for production deployment
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CSOReport;
