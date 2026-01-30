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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  ArrowUp,
  ExternalLink,
  ChevronDown,
  FileCheck,
  Calendar
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
  type ComplianceItem,
  type SecurityControl,
  type ThirdPartyRisk,
  type ChecklistItem
} from "@/data/csoReportData";

const CSOReport = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string>("executive");
  const [isExporting, setIsExporting] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isArchitectureModalOpen, setIsArchitectureModalOpen] = useState(false);

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

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CATASTROPHIC":
        return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
      case "MAJOR":
        return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300";
      case "MODERATE":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300";
      case "LOW":
        return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLIANT":
      case "COMPLETE":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"><CheckCircle className="w-3 h-3 mr-1" /> {status}</Badge>;
      case "PARTIAL":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"><AlertTriangle className="w-3 h-3 mr-1" /> {status}</Badge>;
      case "OUTSTANDING":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"><XCircle className="w-3 h-3 mr-1" /> {status}</Badge>;
      case "HIGH":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">{status}</Badge>;
      case "MEDIUM":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">{status}</Badge>;
      case "LOW":
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
        {/* Document Header */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-l-4 border-primary p-6 mb-8 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-6 h-6 text-primary" />
            <Badge variant="outline" className="text-xs">NHS OFFICIAL-SENSITIVE</Badge>
          </div>
          <h1 className="text-3xl font-bold mb-2">Clinical Safety Officer & Data Protection Officer Assessment Report</h1>
          <p className="text-xl text-muted-foreground mb-4">Notewell AI System Services</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div><span className="font-semibold">Version:</span> 2.2</div>
            <div><span className="font-semibold">Date:</span> 30 January 2026</div>
            <div><span className="font-semibold">Status:</span> <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">MHRA REGISTERED</Badge></div>
            <div><span className="font-semibold">Medical Device Classification:</span> MHRA Class I Medical Device (UK MDR 2002) - Registered since December 2025 (Manufacturer Self-Certification)</div>
          </div>
        </div>

        {/* Document Badge Component */}
        <Card className="mb-8 border-l-4 border-primary bg-gradient-to-r from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-3 mb-3">
                  <FileText className="w-6 h-6 text-primary" />
                  <h3 className="text-lg font-semibold">Clinical Safety Officer Assessment Report</h3>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span><strong>Last updated:</strong> 30 January 2026</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span><strong>Prepared by:</strong> NoteWell Clinical Safety Team</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button 
                  className="gap-2"
                  asChild
                >
                  <a 
                    href="/documents/NoteWell_CSO_Report_v2.2.pdf"
                    download="NoteWell_CSO_Report_v2.2.pdf"
                  >
                    <Download className="w-4 h-4" />
                    Download CSO Report (v2.2)
                  </a>
                </Button>
                <Badge className="self-end bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                  Version 2.2
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Navigation - Collapsible */}
        <Collapsible open={isNavOpen} onOpenChange={setIsNavOpen} className="mb-8">
          <Card className="sticky top-4 z-10 shadow-lg">
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Quick Navigation
                  </div>
                  <ChevronDown className={`w-5 h-5 transition-transform ${isNavOpen ? 'rotate-180' : ''}`} />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {[
                    { id: "executive", label: "Executive Summary", icon: Award },
                    { id: "services", label: "Services", icon: Database },
                    { id: "risks", label: "Risk Assessment", icon: AlertTriangle },
                    { id: "gdpr", label: "GDPR Compliance", icon: Lock },
                    { id: "security", label: "Security", icon: Shield },
                    { id: "third-party", label: "Third Parties", icon: Users },
                    { id: "nhs-assurance", label: "NHS Assurance Pack & DTAC", icon: FileText },
                    { id: "checklist", label: "Checklist", icon: CheckCircle },
                    { id: "roadmap", label: "Deployment Roadmap", icon: Calendar }
                  ].map((nav) => (
                    <Button
                      key={nav.id}
                      variant={activeSection === nav.id ? "default" : "outline"}
                      size="sm"
                      className="justify-start"
                      onClick={() => scrollToSection(nav.id)}
                    >
                      <nav.icon className="w-4 h-4 mr-2" />
                      {nav.label}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    asChild
                  >
                    <Link to="/dpia">
                      <Lock className="w-4 h-4 mr-2" />
                      DPIA
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    asChild
                  >
                    <Link to="/dcb0129">
                      <FileCheck className="w-4 h-4 mr-2" />
                      DCB0129 Hub
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Executive Summary */}
        <section id="executive" className="mb-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
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
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-6 mt-6">
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
                      <button
                        onClick={() => scrollToSection('hazard-log')}
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                      >
                        <FileText className="w-3 h-3" />
                        <span className="underline">View Safety Case</span>
                      </button>
                      <br />
                      <a 
                        href="/documents/MHRA_Class_1_Registration_Evidence.pdf" 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                      >
                        <FileCheck className="w-3 h-3" />
                        <span className="underline">MHRA Class I Registration & Declaration of Conformity</span>
                      </a>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-blue-100 dark:border-blue-900">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-medium text-muted-foreground">Hazard Log</span>
                      <Clock className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-sm font-semibold mb-2">Draft Updated – Pending Host CSO Sign-off</p>
                    <p className="text-xs text-muted-foreground mb-2">Meeting Notes & Complaints only (AI4GP excluded from pilot scope)</p>
                    <button
                      onClick={() => scrollToSection('hazard-log')}
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span className="underline">View Hazard Log</span>
                    </button>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-blue-100 dark:border-blue-900">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-medium text-muted-foreground">DPIA</span>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="text-sm font-semibold mb-2">Completed</p>
                    <button
                      onClick={() => scrollToSection('dpia-summary')}
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      <Shield className="w-3 h-3" />
                      <span className="underline">View DPIA Summary</span>
                    </button>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-blue-100 dark:border-blue-900">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-medium text-muted-foreground">SIRO Sign-Off</span>
                      <Clock className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-sm font-semibold mb-2">Pending</p>
                    <a 
                      href="/documents/NoteWell_SIRO_Statement_Full.pdf" 
                      download 
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span className="underline">Statement</span>
                    </a>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-blue-100 dark:border-blue-900">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-medium text-muted-foreground">Caldicott Guardian Approval</span>
                      <Clock className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-sm font-semibold mb-2">Pending</p>
                    <a 
                      href="/documents/NoteWell_Caldicott_Statement_Full.pdf" 
                      download 
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span className="underline">Statement</span>
                    </a>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-blue-100 dark:border-blue-900">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-medium text-muted-foreground">Pen Test</span>
                      <Clock className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-sm font-semibold mb-1">Commissioned by Host NHS Organisation</p>
                    <p className="text-xs text-muted-foreground">External web app scope; remediation tracked to closure</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-blue-100 dark:border-blue-900">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-medium text-muted-foreground">Hosting</span>
                      <Clock className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-sm font-semibold mb-1">Development: AWS London via Supabase</p>
                    <p className="text-xs text-muted-foreground mb-3">Target: NHS-hosted tenant (LHIS preferred)</p>
                    <div 
                      className="relative cursor-pointer group"
                      onClick={() => setIsArchitectureModalOpen(true)}
                    >
                      <img 
                        src={architectureDiagram} 
                        alt="NoteWell Architecture Diagram showing system components and data flow" 
                        className="w-full h-20 object-cover rounded-md border border-border mt-2 transition-opacity group-hover:opacity-80"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors rounded-md">
                        <div className="bg-white dark:bg-gray-900 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                          <ExternalLink className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground text-center mt-1">Click to view full diagram</p>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-blue-100 dark:border-blue-900">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-medium text-muted-foreground">Cyber Essentials</span>
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    </div>
                    <p className="text-sm font-semibold mb-2">Mandatory Pre-Go-Live Requirement</p>
                    <p className="text-xs text-muted-foreground mb-2">Or equivalent controls accepted by host organisation</p>
                    <a 
                      href="https://iasme.co.uk/cyber-essentials/frequently-asked-questions/" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span className="underline">Learn more</span>
                    </a>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-blue-100 dark:border-blue-900">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-medium text-muted-foreground">DPAs</span>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="text-sm font-semibold mb-2">Completed (OpenAI, Supabase)</p>
                    <div className="space-y-1">
                      <a 
                        href="/documents/Supabase_User_DPA_August_5_2025.pdf" 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        <span className="underline">Supabase DPA</span>
                      </a>
                      <br />
                      <a 
                        href="/documents/Data_Processing_Agreement_PCN_Services_Ltd_and_OpenAI.pdf" 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        <span className="underline">OpenAI DPA</span>
                      </a>
                    </div>
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
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                      <span>Robust technical architecture with strong authentication and encryption</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                      <span>Comprehensive audit trails for accountability</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                      <span>Patient data masking and role-based access controls</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                      <span>Clear user disclaimers and safety warnings</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                      <span>Scalable cloud infrastructure with automatic backups</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                      <span>Secure navigation and documentation access controls</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                      <span>Data Processing Agreements in place with OpenAI (signed 10 November 2025) and Supabase (signed 5 August 2025)</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-lg mb-3 flex items-center gap-2 text-orange-700 dark:text-orange-400">
                    <AlertCircle className="w-5 h-5" />
                    Areas Requiring Attention
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-orange-600 flex-shrink-0" />
                      <span>DCB0129 Safety Case maintained by PCN Services Ltd (draft complete) – requires formal adoption and sign-off by hosting NHS organisation's Clinical Safety Officer on migration</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-orange-600 flex-shrink-0" />
                      <span>Proportionate external web application penetration test post-migration to NHS hosting (target 2026)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-orange-600 flex-shrink-0" />
                      <span>Finalisation and sign-off of the DPIA by ICB IG lead (Meeting Notes & Complaints)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-orange-600 flex-shrink-0" />
                      <span>Confirmation of hosting model and DSPT ownership (NHS tenant preferred) – <strong>Hard gate: no live NHS patient data processing until DSPT ownership confirmed and current submission in place</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-orange-600 flex-shrink-0" />
                      <span>Clinical validation workflows implementation (mandatory human review, governance sign-off)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-orange-600 flex-shrink-0" />
                      <span>Mandatory user training programme (including MFA and SAR/FOI export process)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-orange-600 flex-shrink-0" />
                      <span>MFA enforcement for all production users accessing PII-bearing modules</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <p className="text-sm font-medium">
                  <strong>Recommendation:</strong> System may proceed to controlled deployment within max 15 practice pilot (max 5 for first month), subject to completion of critical requirements within 90 days. Full NHS rollout should not proceed until GREEN rating achieved. Recent improvements to system navigation and documentation access have strengthened security posture.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Service Descriptions */}
        <section id="services" className="mb-8">
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
                {/* Service Description - Non-Commercial Model */}
                <div className="border-l-4 border-primary bg-gradient-to-r from-primary/5 to-background rounded-lg p-6 space-y-4">
                  <h3 className="text-xl font-semibold mb-3">Service Description (Non-Commercial, NHS-Aligned Model)</h3>
                  <div className="prose dark:prose-invert max-w-none text-sm">
                    <p className="leading-relaxed">
                      NoteWell AI is a neighbourhood-aligned digital service designed to support primary care with complaints handling, governance, meeting management and regulatory compliance. It is not a commercial software product; instead, it is being developed collaboratively with the ICS as a shared NHS capability that practices can use without individual procurement or licensing. Funding is requested to support assurance, hosting and controlled deployment within an NHS tenant (e.g., LHIS), enabling the neighbourhood to provide a consistent, safe and centrally governed tool that reduces administrative burden, strengthens compliance, and supports the Modern General Practice model. This investment allows the neighbourhood to deliver a high-impact governance and quality improvement service at scale, aligned with ICP priorities and reusable across the wider system.
                    </p>
                  </div>
                </div>

                <Separator className="my-6" />

                {/* Individual Services */}
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
                      <div>
                        <h4 className="font-semibold mb-2 text-sm">Data Processed:</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {service.dataProcessed.map((data, dataIdx) => (
                            <li key={dataIdx}>• {data}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* System Criticality Classification */}
        <section id="criticality" className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Shield className="w-6 h-6" />
                System Criticality Classification
              </CardTitle>
              <CardDescription>Business criticality and MHRA classification assessment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-6">
                <div className="flex items-start gap-3 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-green-900 dark:text-green-300">
                      Class I, Non-Business-Critical Workflow Tool
                    </h3>
                    <p className="text-base text-green-800 dark:text-green-400 leading-relaxed">
                      NoteWell AI is a <strong>non-business-critical Class I workflow tool</strong> used for administrative and governance processes. All supported functions can continue manually if required.
                    </p>
                  </div>
                </div>
                <div className="pl-9 space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                    <span><strong>MHRA Classification:</strong> Class I medical device software (low risk, non-invasive)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                    <span><strong>Business Continuity:</strong> All functions can be performed manually without system dependency</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                    <span><strong>Clinical Impact:</strong> No direct clinical decision-making; all outputs require human review</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                    <span><strong>System Integration:</strong> Standalone system with no EMIS/S1 integration or write-back capability</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Proportionate Penetration Test Scope */}
        <section id="pentest" className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Lock className="w-6 h-6" />
                Proportionate Penetration Test Scope
              </CardTitle>
              <CardDescription>Risk-based security testing approach appropriate to system classification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-4 text-blue-900 dark:text-blue-300">
                  Proportionate External Web Application Testing
                </h3>
                <p className="text-base text-blue-800 dark:text-blue-400 mb-4 leading-relaxed">
                  Given NoteWell's Class I classification, standalone architecture, and absence of NHS infrastructure integration, a <strong>proportionate external web application penetration test</strong> is the appropriate technical assurance route.
                </p>
                <div className="space-y-3">
                  <h4 className="font-semibold text-base text-blue-900 dark:text-blue-300">In Scope:</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                      <span><strong>External web application test only</strong> – publicly accessible web interface</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                      <span><strong>OWASP Top 10 coverage</strong> – injection, broken authentication, XSS, etc.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                      <span><strong>API endpoint testing</strong> – REST API security and input validation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                      <span><strong>Authentication/session management</strong> – login security, session handling</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                      <span><strong>RBAC & RLS validation</strong> – role-based access control testing</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                      <span><strong>TLS & configuration checks</strong> – encryption and security headers</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-6">
                <h4 className="font-semibold text-base mb-3 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-gray-600" />
                  Out of Scope (Not Required)
                </h4>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  The following testing approaches are <strong>out of scope and not required</strong> due to the system's risk profile, standalone architecture, and absence of NHS infrastructure integration:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 mt-0.5 text-gray-600 flex-shrink-0" />
                    <span><strong>Red teaming</strong> – adversarial simulation not proportionate to Class I risk</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 mt-0.5 text-gray-600 flex-shrink-0" />
                    <span><strong>Network penetration testing</strong> – standalone SaaS with no NHS network integration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 mt-0.5 text-gray-600 flex-shrink-0" />
                    <span><strong>Social engineering</strong> – staff awareness is separate organisational control</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 mt-0.5 text-gray-600 flex-shrink-0" />
                    <span><strong>Phishing campaigns</strong> – user training responsibility, not system vulnerability</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 mt-0.5 text-gray-600 flex-shrink-0" />
                    <span><strong>Physical security assessments</strong> – cloud-hosted infrastructure managed by Supabase</span>
                  </li>
                </ul>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-amber-900 dark:text-amber-300 mb-1">Proportionate Assurance Rationale</h4>
                    <p className="text-sm text-amber-800 dark:text-amber-400 leading-relaxed">
                      This scope is proportionate to NoteWell's Class I classification, standalone architecture, non-business-critical status, and absence of direct NHS infrastructure integration. More extensive testing would not provide commensurate risk reduction benefits given the system's design and human-in-the-loop controls.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Hazard Log - DCB0129 */}
        <section id="hazard-log" className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
                Hazard Log – DCB0129 (Condensed and Proportionate)
              </CardTitle>
              <CardDescription>Summary of identified hazards with mitigations and residual risk assessments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Hazard 1 */}
              <div className="border rounded-lg p-5 bg-amber-50/50 dark:bg-amber-950/10">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <span className="bg-amber-100 dark:bg-amber-900 px-3 py-1 rounded text-sm">Hazard 1</span>
                  Incorrect or Misleading AI Output (Admin/Governance Context)
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold">Severity:</span>
                    <Badge className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Minor</Badge>
                  </div>
                  <div>
                    <span className="font-semibold">Likelihood:</span>
                    <Badge className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Medium</Badge>
                  </div>
                  <div>
                    <span className="font-semibold">Initial Risk:</span>
                    <Badge className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Medium</Badge>
                  </div>
                  <div>
                    <span className="font-semibold">Residual Risk:</span>
                    <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">Low</Badge>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="font-semibold text-sm">Mitigation:</span>
                  <p className="text-sm text-muted-foreground mt-1">Human review required; editable outputs; disclaimers; restricted issuing permissions</p>
                </div>
              </div>

              {/* Hazard 2 */}
              <div className="border rounded-lg p-5 bg-amber-50/50 dark:bg-amber-950/10">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <span className="bg-amber-100 dark:bg-amber-900 px-3 py-1 rounded text-sm">Hazard 2</span>
                  Misinterpretation of User Input by AI Models
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold">Severity:</span>
                    <Badge className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Minor</Badge>
                  </div>
                  <div>
                    <span className="font-semibold">Likelihood:</span>
                    <Badge className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Medium</Badge>
                  </div>
                  <div>
                    <span className="font-semibold">Initial Risk:</span>
                    <Badge className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Medium</Badge>
                  </div>
                  <div>
                    <span className="font-semibold">Residual Risk:</span>
                    <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">Low</Badge>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="font-semibold text-sm">Mitigation:</span>
                  <p className="text-sm text-muted-foreground mt-1">Human-in-the-loop; version history; guidance; training</p>
                </div>
              </div>

              {/* Hazard 3 */}
              <div className="border rounded-lg p-5 bg-red-50/50 dark:bg-red-950/10">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <span className="bg-red-100 dark:bg-red-900 px-3 py-1 rounded text-sm">Hazard 3</span>
                  Data Privacy Breach Due to Incorrect Permissions
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold">Severity:</span>
                    <Badge className="ml-2" variant="destructive">Major</Badge>
                  </div>
                  <div>
                    <span className="font-semibold">Likelihood:</span>
                    <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">Low</Badge>
                  </div>
                  <div>
                    <span className="font-semibold">Initial Risk:</span>
                    <Badge className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Medium</Badge>
                  </div>
                  <div>
                    <span className="font-semibold">Residual Risk:</span>
                    <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">Low</Badge>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="font-semibold text-sm">Mitigation:</span>
                  <p className="text-sm text-muted-foreground mt-1">RLS; RBAC; audit logs; session timeout; mandatory MFA (Authenticator App + Email/Code)</p>
                </div>
              </div>

              {/* Hazard 4 */}
              <div className="border rounded-lg p-5 bg-amber-50/50 dark:bg-amber-950/10">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <span className="bg-amber-100 dark:bg-amber-900 px-3 py-1 rounded text-sm">Hazard 4</span>
                  Transcription Inaccuracies Affecting Meeting Notes
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold">Severity:</span>
                    <Badge className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Minor</Badge>
                  </div>
                  <div>
                    <span className="font-semibold">Likelihood:</span>
                    <Badge className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Medium</Badge>
                  </div>
                  <div>
                    <span className="font-semibold">Initial Risk:</span>
                    <Badge className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Medium</Badge>
                  </div>
                  <div>
                    <span className="font-semibold">Residual Risk:</span>
                    <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">Low</Badge>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="font-semibold text-sm">Mitigation:</span>
                  <p className="text-sm text-muted-foreground mt-1">Human verification; audio replay; multiple output styles</p>
                </div>
              </div>

              {/* Overall Statement */}
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-green-900 dark:text-green-300 mb-2">Overall Statement</h4>
                    <p className="text-sm text-green-800 dark:text-green-400 leading-relaxed">
                      All identified hazards have effective mitigations in place. No residual high-risk hazards remain. NoteWell is suitable for limited NHS pilot deployment under CSO oversight.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/hazard-log">
                    <FileText className="w-4 h-4 mr-2" />
                    View Complete Hazard Log with Full Details
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* DPIA Summary */}
        <section id="dpia-summary" className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Lock className="w-6 h-6" />
                DPIA Summary – NoteWell AI (Updated 20/01/2026)
              </CardTitle>
              <CardDescription>Data Protection Impact Assessment summary for NHS primary care administrative workflows</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Purpose of Processing */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Purpose of Processing</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Administrative and governance workflows in NHS primary care: meetings, complaints handling, document creation.
                </p>
              </div>

              <Separator />

              {/* Data Categories */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Data Categories</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                    <span>Staff details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                    <span>Patient information (complaints only)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                    <span>Meeting transcripts and governance documentation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 mt-0.5 text-gray-600 flex-shrink-0" />
                    <span><strong>No diagnostic or treatment data</strong></span>
                  </li>
                </ul>
              </div>

              <Separator />

              {/* Lawful Basis */}
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
                <p className="text-sm text-muted-foreground mt-3 italic">
                  Complaints processing meets NHS Complaints Regulations 2009.
                </p>
              </div>

              <Separator />

              {/* Controls */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Controls</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="flex items-start gap-2 p-3 bg-accent/50 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">UK-only hosting (target: NHS tenant)</span>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-accent/50 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">AES-256 at rest, TLS 1.2+ in transit</span>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-accent/50 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Role-based access and RLS</span>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-accent/50 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Full audit logs</span>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-accent/50 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">No data used for training</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Privacy Risks & Mitigations */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Privacy Risks & Mitigations</h3>
                <div className="space-y-3">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-semibold text-sm">Unauthorised access</span>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">Low</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Mitigation: RLS/RBAC/Mandatory MFA</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-semibold text-sm">Excessive data capture</span>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">Low</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Mitigation: Access controls + retention</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-semibold text-sm">Complaint visibility</span>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">Low</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Mitigation: Masking + permissions</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-semibold text-sm">Model prompts</span>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">Low</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Mitigation: DPA with OpenAI + enforced data minimisation/masking controls; free-text identifiers blocked by design</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Data Processing Agreements */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Data Processing Agreements</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Data Processing Agreements are in place with all sub-processors to ensure GDPR compliance and data protection.
                </p>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="flex items-start gap-2 p-3 bg-accent/50 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="text-sm block mb-1">Supabase DPA (signed 5 August 2025)</span>
                      <a 
                        href="/documents/Supabase_User_DPA_August_5_2025.pdf" 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors underline"
                      >
                        Download Agreement
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-accent/50 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="text-sm block mb-1">OpenAI DPA (signed 10 November 2025)</span>
                      <a 
                        href="/documents/Data_Processing_Agreement_PCN_Services_Ltd_and_OpenAI.pdf" 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors underline"
                      >
                        Download Agreement
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Conclusion */}
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-green-900 dark:text-green-300 mb-2">Conclusion</h4>
                    <p className="text-sm text-green-800 dark:text-green-400 leading-relaxed">
                      Residual privacy risk is low. DPIA supports controlled deployment, pending SIRO and Caldicott sign-off.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/dpia">
                    <FileText className="w-4 h-4 mr-2" />
                    View Complete DPIA Documentation
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Risk Assessment Tables */}
        <section id="risks" className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <AlertTriangle className="w-6 h-6" />
                Detailed Risk Assessment
              </CardTitle>
              <CardDescription>Clinical risk assessment for each service following DCB0129 methodology</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="meeting" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="meeting">Meeting Notes ({meetingNotesRisks.length} Risks)</TabsTrigger>
                  <TabsTrigger value="complaints">Complaints ({complaintsRisks.length} Risks)</TabsTrigger>
                </TabsList>
                <TabsContent value="meeting" className="mt-6">
                  <RiskTable risks={meetingNotesRisks} title="Meeting Notes System - Clinical Risk Assessment" />
                </TabsContent>
                <TabsContent value="complaints" className="mt-6">
                  <RiskTable risks={complaintsRisks} title="Complaints Management System - Clinical Risk Assessment" />
                </TabsContent>
              </Tabs>

              <div className="mt-6 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-700 dark:text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">AI4GP Excluded from Pilot Scope</h4>
                    <p className="text-sm text-blue-800 dark:text-blue-400">
                      AI4GP is explicitly excluded from this pilot and from the current assurance scope. AI4GP risks are not included in the above tables. A separate risk assessment will be completed if AI4GP is brought into scope for future phases.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-700 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-1">High Priority Risks Identified</h4>
                    <p className="text-sm text-yellow-800 dark:text-yellow-400">
                      Several HIGH risk ratings have been identified for Meeting Notes and Complaints. While strong controls are in place, further actions are required to reduce residual risks to acceptable levels before full deployment. These represent go-live gating conditions, not open aspirations.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* GDPR Compliance */}
        <section id="gdpr" className="mb-8">
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
                <p className="text-sm text-muted-foreground mb-4 italic">
                  <strong>Note:</strong> AI4GP is excluded from this pilot and from the current assurance scope. The table below covers Meeting Notes and Complaints only.
                </p>
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

              {/* DPIA Reference Card */}
              <div className="grid md:grid-cols-2 gap-4 mt-6">
                <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-700 dark:text-orange-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-orange-900 dark:text-orange-300 mb-1">Action Required</h4>
                      <p className="text-sm text-orange-800 dark:text-orange-400 mb-3">
                        Formal Data Protection Impact Assessment (DPIA) documentation is required for Meeting Notes and Complaints services before deployment. DPO sign-off mandatory.
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="border-orange-300 text-orange-900 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/20"
                        asChild
                      >
                        <Link to="/dpia">
                          <FileText className="w-4 h-4 mr-2" />
                          View Complete DPIA
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>

                <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Data Protection Impact Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Comprehensive DPIA completed covering:
                    </p>
                    <ul className="text-sm space-y-1 ml-4 list-disc text-muted-foreground">
                      <li>Meeting Manager (audio recording & transcription)</li>
                      <li>Complaints Management System</li>
                    </ul>
                    <p className="text-xs text-muted-foreground italic">Note: AI4GP excluded from pilot scope</p>
                    <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                      <Link to="/dpia">
                        <FileText className="w-4 h-4 mr-2" />
                        View Full DPIA Documentation
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Technical Security Assessment */}
        <section id="security" className="mb-8">
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

              <div className="mt-6 space-y-4">
                <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-700 dark:text-orange-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-orange-900 dark:text-orange-300 mb-1">Critical Security Actions</h4>
                      <ul className="text-sm text-orange-800 dark:text-orange-400 space-y-1 mt-2">
                        <li>• Complete comprehensive security audit and address all identified warnings</li>
                        <li>• Implement security scanning as part of CI/CD pipeline</li>
                        <li>• Conduct penetration testing (minimum annual schedule)</li>
                        <li>• Establish vulnerability disclosure process</li>
                        <li>• Develop and test security incident response plan</li>
                        <li>• Document and verify all system navigation and access control paths</li>
                      </ul>
                      <div className="mt-3 space-y-2">
                        <Button 
                          onClick={() => navigate('/compliance/security-audit-2025-11-19')}
                          variant="outline"
                          size="sm"
                          className="w-full bg-white dark:bg-background hover:bg-orange-100 dark:hover:bg-orange-950/40"
                        >
                          View Security Audit Report (19/11/2025)
                        </Button>
                        <p className="text-xs text-orange-700 dark:text-orange-500">
                          Latest comprehensive audit: 19th November 2025
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Third-Party Dependencies */}
        <section id="third-party" className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Users className="w-6 h-6" />
                Third-Party Dependencies & Integration Safety
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
        </section>

        {/* Deployment and Hosting Model */}
        <section id="hosting-model" className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Database className="w-6 h-6" />
                Deployment and Hosting Model – Current vs Target
              </CardTitle>
              <CardDescription>Critical hosting decisions for NHS deployment and ICB risk ownership</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Current State */}
                <div className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-6 rounded-r-lg">
                  <div className="flex items-start gap-3 mb-3">
                    <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-lg text-amber-900 dark:text-amber-300 mb-2">
                        Current (Development Only)
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        This configuration is suitable for development and testing only - not for live NHS deployment.
                      </p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-amber-200 dark:border-amber-900">
                      <h4 className="font-semibold text-sm mb-3">Platform</h4>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Lovable + Supabase</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>AWS London region</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>UK-only data storage</span>
                        </li>
                      </ul>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-amber-200 dark:border-amber-900">
                      <h4 className="font-semibold text-sm mb-3">Limitations</h4>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <span>Not NHS-controlled infrastructure</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <span>ICB concerns re: risk ownership</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <span>May complicate pen-test acceptance</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Target State */}
                <div className="border-l-4 border-green-500 bg-green-50 dark:bg-green-950/20 p-6 rounded-r-lg">
                  <div className="flex items-start gap-3 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-lg text-green-900 dark:text-green-300 mb-2">
                        Target (For Pilot Deployment)
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        NHS-hosted infrastructure for production deployment and ICB approval.
                      </p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-green-200 dark:border-green-900">
                      <h4 className="font-semibold text-sm mb-3">Preferred Options</h4>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span><strong>Primary:</strong> LHIS NHS tenant</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span><strong>Alternative:</strong> UHL tenant</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span><strong>PCN/Neighbourhood:</strong> Local tenant</span>
                        </li>
                      </ul>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-green-200 dark:border-green-900">
                      <h4 className="font-semibold text-sm mb-3">Benefits</h4>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Full NHS governance control</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Clear ICB risk ownership</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Easier pen-test acceptance</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Migration Path */}
                <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 p-6 rounded-r-lg">
                  <div className="flex items-start gap-3 mb-3">
                    <ArrowUp className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-lg text-blue-900 dark:text-blue-300 mb-2">
                        Migration Path
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Clear pathway from development environment to NHS production hosting.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-blue-200 dark:border-blue-900">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-300 flex items-center justify-center text-xs font-bold">1</span>
                      <div>
                        <p className="font-semibold text-sm">Export via GitHub Integration</p>
                        <p className="text-xs text-muted-foreground mt-1">Standard codebase export using built-in GitHub sync</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-blue-200 dark:border-blue-900">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-300 flex items-center justify-center text-xs font-bold">2</span>
                      <div>
                        <p className="font-semibold text-sm">Redeploy to NHS Environment</p>
                        <p className="text-xs text-muted-foreground mt-1">Deploy as standard React/Vite application into NHS-approved hosting</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-blue-200 dark:border-blue-900">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-300 flex items-center justify-center text-xs font-bold">3</span>
                      <div>
                        <p className="font-semibold text-sm">ICB Approval Process</p>
                        <p className="text-xs text-muted-foreground mt-1">Submit for pen-test and final ICB sign-off in NHS environment</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ICB Statement */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-2 border-amber-300 dark:border-amber-900 rounded-lg p-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-base mb-2">ICB Position Statement</h4>
                      <p className="text-sm mb-3">
                        <strong className="text-amber-900 dark:text-amber-300">"Running live with Lovable will be a challenge"</strong> - ICB Feedback
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Justification for NHS Hosting:</strong> Enables easier penetration test acceptance, clear ICB risk ownership, alignment with NHS data sovereignty requirements, and smoother governance approval processes. The application architecture is platform-agnostic and can be deployed to any standard web hosting environment.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Pre-Deployment Checklist */}
        <section id="checklist" className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <CheckCircle className="w-6 h-6" />
                Pre-Deployment Readiness Checklist
              </CardTitle>
              <CardDescription>Mandatory actions required before NHS deployment</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Group checklist by category */}
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
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex items-start gap-3 flex-1">
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
                              {item.note && (
                                <p className="text-sm text-muted-foreground mt-2 italic">
                                  <span className="font-medium">Note:</span> {item.note}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <Separator className="my-6" />

              {/* Summary Statistics */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Deployment Readiness Summary</h3>
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
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Deployment Roadmap */}
        <section id="roadmap" className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Calendar className="w-6 h-6" />
                Deployment Roadmap (NHS-Aligned)
              </CardTitle>
              <CardDescription>Staged NHS assurance pathway from prototype to production</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-base leading-relaxed mb-6">
                  The migration and deployment of NoteWell AI will follow a staged NHS assurance pathway. This ensures safe transition from prototype development to NHS-hosted production, with full compliance to clinical safety, IG, DSPT and technical security controls.
                </p>
              </div>

              <Accordion type="single" collapsible className="w-full">
                {/* Phase 0 */}
                <AccordionItem value="phase0">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 w-full">
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 shrink-0">Phase 0</Badge>
                      <div className="flex-1 text-left">
                        <div className="font-semibold">Foundation (Current Position)</div>
                        <div className="text-sm text-muted-foreground">Status: IN PROGRESS</div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                      <h4 className="font-semibold mb-2">Objectives</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li>Complete core assurance documentation (CSO Report, DPIA, Hazard Log, MHRA evidence)</li>
                        <li>Resolve critical/high technical vulnerabilities</li>
                        <li>Stabilise Lovable development environment</li>
                        <li>Prepare for migration to NHS tenant (LHIS/UHL)</li>
                        <li>Maintain working prototype for demonstrations and design validation</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Deliverables</h4>
                      <div className="space-y-2">
                        {[
                          { item: "MHRA Class I registration", complete: true },
                          { item: "Draft DCB0129 Safety Case", complete: true },
                          { item: "Full hazard log (Meeting Notes + Complaints)", complete: true },
                          { item: "Full CSO page + evidence pack", complete: true },
                          { item: "OpenAI + Supabase DPAs", complete: true },
                          { item: "Security warnings resolved", complete: true },
                          { item: "DPIA finalisation pending ICB IG Lead", complete: false },
                          { item: "Hosting decision TBC (LHIS/UHL preferred)", complete: false }
                        ].map((deliverable, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            {deliverable.complete ? (
                              <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                            ) : (
                              <Clock className="w-4 h-4 text-yellow-600 shrink-0" />
                            )}
                            <span className={deliverable.complete ? "text-muted-foreground" : "text-foreground"}>
                              {deliverable.item}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Phase 1 */}
                <AccordionItem value="phase1">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 w-full">
                      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 shrink-0">Phase 1</Badge>
                      <div className="flex-1 text-left">
                        <div className="font-semibold">NHS Hosting Migration</div>
                        <div className="text-sm text-muted-foreground">Weeks 0–4 • Status: NOT STARTED</div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                        <strong>Trigger for Phase 1:</strong> ICB confirm hosting organisation (expected: LHIS)
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Objectives</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li>Move NoteWell from Lovable-hosted environment into NHS-controlled hosting</li>
                        <li>Apply NHS-standard security baselines and MFA</li>
                        <li>Establish DSPT ownership</li>
                        <li>Implement proper backup/restore strategy and log retention</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Key Tasks</h4>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li>Establish GitHub → LHIS deployment pipeline ("security gate" model)</li>
                        <li>Deploy NoteWell backend + database into NHS tenant</li>
                        <li>Configure NHS authentication options (MFA mandatory)</li>
                        <li>Implement agreed log retention policy (CAF v4 aligned)</li>
                        <li>Implement immutable / ransomware-resilient backups</li>
                        <li>Apply NHS access control standards (RBAC/RLS review)</li>
                        <li>Re-run vulnerability scanning under LHIS stack</li>
                      </ol>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Deliverables</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li>NHS-hosted development + production environment</li>
                        <li>DSPT owner confirmed</li>
                        <li>Platform baseline security approved</li>
                        <li>MFA configuration finalised</li>
                        <li>Updated DPIA reflecting new hosting model</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Phase 2 */}
                <AccordionItem value="phase2">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 w-full">
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 shrink-0">Phase 2</Badge>
                      <div className="flex-1 text-left">
                        <div className="font-semibold">Assurance Completion & Pen Test</div>
                        <div className="text-sm text-muted-foreground">Weeks 4–8 • Status: NOT STARTED</div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                      <h4 className="font-semibold mb-2">Objectives</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li>Complete all mandatory NHS assurance prior to pilot</li>
                        <li>Execute CREST-aligned external web application penetration test</li>
                        <li>Obtain senior IG approvals (SIRO, Caldicott)</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Key Tasks</h4>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li>Finalise DPIA with ICB IG Lead</li>
                        <li>CSO review + approve hazard log & safety case</li>
                        <li>SIRO approval</li>
                        <li>Caldicott Guardian approval</li>
                        <li>Commission proportionate CREST web app pen test</li>
                        <li>Complete pen test remediation</li>
                        <li>Revalidate navigation, permissions, audit logs</li>
                        <li>Produce final Assurance Pack (bundle for pilot sites)</li>
                      </ol>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Deliverables</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li>Completed DCB0129 documentation</li>
                        <li>Completed DPIA (signed)</li>
                        <li>Approved SIRO + Caldicott statements</li>
                        <li>Pen Test Report + remediation summary</li>
                        <li>"Green/Amber" Assurance Pack for practices</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Phase 3 */}
                <AccordionItem value="phase3">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 w-full">
                      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 shrink-0">Phase 3</Badge>
                      <div className="flex-1 text-left">
                        <div className="font-semibold">Controlled Pilot</div>
                        <div className="text-sm text-muted-foreground">Weeks 8–16 • Status: FUTURE</div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="grid md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-muted rounded-lg p-3">
                        <div className="text-xs font-medium text-muted-foreground mb-1">Duration</div>
                        <div className="text-sm font-semibold">8 weeks minimum</div>
                      </div>
                      <div className="bg-muted rounded-lg p-3">
                        <div className="text-xs font-medium text-muted-foreground mb-1">Max Sites</div>
                        <div className="text-sm font-semibold">5 practices initially</div>
                      </div>
                      <div className="bg-muted rounded-lg p-3">
                        <div className="text-xs font-medium text-muted-foreground mb-1">Risk Ownership</div>
                        <div className="text-sm font-semibold">NHS hosting org</div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Objectives</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li>Evaluate safety, usability, governance compliance and operational value</li>
                        <li>Trial user access onboarding, MFA adoption and JML processes</li>
                        <li>Validate complaints workflows with real case studies</li>
                        <li>Validate meeting transcription accuracy and user satisfaction</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Key Tasks</h4>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li>Select 3–5 early-adopter practices</li>
                        <li>Provide full onboarding pack (training + IG materials)</li>
                        <li>Monitor access logs, security alerts, system performance</li>
                        <li>Capture user feedback and operational improvements</li>
                        <li>Evaluate SAR/FOI export workflows</li>
                        <li>Assess impact: admin time reduced, complaints cycle time, governance quality</li>
                        <li>Produce Pilot Evaluation Report</li>
                      </ol>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Deliverables</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li>Pilot Evaluation (qualitative + quantitative)</li>
                        <li>Updated risk register and hazard log</li>
                        <li>Prioritised improvements for wider rollout</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Phase 4 */}
                <AccordionItem value="phase4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 w-full">
                      <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 shrink-0">Phase 4</Badge>
                      <div className="flex-1 text-left">
                        <div className="font-semibold">Neighbourhood Rollout</div>
                        <div className="text-sm text-muted-foreground">Months 4–9 • Status: FUTURE</div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                      <h4 className="font-semibold mb-2">Objectives</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li>Scale NoteWell to all practices in the neighbourhood</li>
                        <li>Embed into governance frameworks and Neighbourhood Digital Transformation plans</li>
                        <li>Prepare for cross-ICB reuse</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Key Tasks</h4>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li>Expand onboarding to all practices (15–20 expected)</li>
                        <li>Provide group training and e-learning materials</li>
                        <li>Operationalise JML and support processes</li>
                        <li>Integrate with Neighbourhood governance dashboards</li>
                        <li>Publish public-facing Trust Centre (transparency portal)</li>
                        <li>Maintain annual pen test schedule</li>
                        <li>Plan for Phase 2 (AI4GP module) if approved</li>
                      </ol>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Deliverables</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li>Fully deployed neighbourhood-wide service</li>
                        <li>Annual assurance cycle (DPIA, pen test, CSO review)</li>
                        <li>Continuous improvement plan</li>
                        <li>Case for ICS-wide adoption</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Phase 5 */}
                <AccordionItem value="phase5">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 w-full">
                      <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 shrink-0">Phase 5</Badge>
                      <div className="flex-1 text-left">
                        <div className="font-semibold">ICS / Cross-System Adoption</div>
                        <div className="text-sm text-muted-foreground">Months 9+ • Status: OPTIONAL FUTURE PATHWAY</div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                      <h4 className="font-semibold mb-2">Objectives</h4>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                        <li>Enable use across Northamptonshire, Leicestershire and wider regional ICPs</li>
                        <li>Provide unified complaints and governance tooling for primary care</li>
                        <li>Strengthen system-wide governance, BI and transparency</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Separator className="my-6" />

              {/* Timeline Summary */}
              <div className="bg-gradient-to-r from-primary/5 to-background border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Summary Timeline</h3>
                <div className="space-y-3">
                  {[
                    { phase: "Phase 0", title: "Documentation & Prototype", status: "NOW", color: "blue" },
                    { phase: "Phase 1", title: "NHS Hosting Migration", status: "Weeks 0–4", color: "purple" },
                    { phase: "Phase 2", title: "Assurance + Pen Test", status: "Weeks 4–8", color: "green" },
                    { phase: "Phase 3", title: "Pilot Deployment", status: "Weeks 8–16", color: "orange" },
                    { phase: "Phase 4", title: "Neighbourhood Rollout", status: "Months 4–9", color: "teal" },
                    { phase: "Phase 5", title: "ICS Rollout", status: "Month 9+", color: "indigo" }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 flex items-center gap-3">
                        <span className="font-medium min-w-[80px]">{item.phase}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-sm">{item.title}</span>
                        <Badge variant="outline" className="ml-auto">{item.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* NHS Assurance Pack */}
        <section id="nhs-assurance" className="mb-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <FileText className="w-6 h-6" />
                    NHS Assurance, DTAC & Security Overview Pack
                  </CardTitle>
                  <CardDescription>For NHS ICB IT, Digital, IG & Clinical Safety Review - Version: November 2025</CardDescription>
                </div>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 text-lg px-4 py-2">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  MHRA Registered
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 1. Overview */}
              <div>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  1. Overview of NoteWell AI
                </h3>
                <div className="prose dark:prose-invert max-w-none space-y-3">
                  <p>NoteWell AI is a UK-hosted digital platform designed to support administrative and governance workflows across primary care. Core functions include:</p>
                  <ul className="space-y-1 ml-4">
                    <li>Meeting recording, transcription, and summarisation</li>
                    <li>Structured complaints management</li>
                    <li>Scribe support (SOAP/SystemOne-style summaries)</li>
                    <li>Governance action logs and audit trails</li>
                    <li>Secure document generation and export</li>
                  </ul>
                  <p className="font-medium">NoteWell does not provide autonomous diagnosis or treatment recommendations and currently has no direct integration with EMIS or SystmOne, making it a <strong>low-risk DTAC profile</strong>.</p>
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4 mt-4">
                    <p className="font-semibold text-green-900 dark:text-green-300">In November 2025, NoteWell AI was formally registered as an MHRA Class I Medical Device.</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 2. MHRA & Clinical Safety */}
              <div>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  2. MHRA & Clinical Safety Compliance
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="bg-muted/50">
                    <CardHeader>
                      <CardTitle className="text-lg">MHRA Compliance</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Registered as a Class I Medical Device (2025)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Manufacturer: PCN Services Ltd</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>UK Responsible Person: PCN Services Ltd</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Clinical Safety (DCB0129 & DCB0160)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>Draft DCB0129 Clinical Safety Case (awaiting NHS CSO adoption)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Hazard Log maintained (pilot modules only)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Clinical Safety Officer appointed & documented</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Human-in-the-loop model — no autonomous clinical action</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Risk mitigations include audit logs, access control, human review, and bounded outputs</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator />

              {/* 2.5 DTAC Assessment */}
              <div>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  2.5 NHS Digital Technology Assessment Criteria (DTAC)
                </h3>
                <div className="prose dark:prose-invert max-w-none space-y-3">
                  <p>
                    A comprehensive DTAC assessment has been completed covering all required criteria for NHS digital health technologies:
                  </p>
                  <div className="grid md:grid-cols-2 gap-3 not-prose">
                    <div className="flex items-start gap-2 p-3 border rounded-lg bg-background">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <div className="font-semibold">Section A: Company Information</div>
                        <div className="text-muted-foreground">Organisation & product details verified</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 border rounded-lg bg-background">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <div className="font-semibold">Section B: Value Proposition</div>
                        <div className="text-muted-foreground">Clinical & operational benefits documented</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 border rounded-lg bg-background">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <div className="font-semibold">Section C1: Clinical Safety</div>
                        <div className="text-muted-foreground">CSO appointed, DCB0129 compliant, hazard log maintained</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 border rounded-lg bg-background">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <div className="font-semibold">Section C2: Data Protection</div>
                        <div className="text-muted-foreground">ICO registered, DPIA completed, UK data residency</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 border rounded-lg bg-background">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <div className="font-semibold">Section C3: Technical Security</div>
                        <div className="text-muted-foreground">Cyber Essentials, penetration testing, incident response</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 border rounded-lg bg-background">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <div className="font-semibold">Section C4: Interoperability</div>
                        <div className="text-muted-foreground">Standards compliance (HL7 FHIR, SNOMED CT)</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 border rounded-lg bg-background">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <div className="font-semibold">Section D: Usability & Accessibility</div>
                        <div className="text-muted-foreground">WCAG compliance, user testing, training provided</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4 mt-4">
                    <p className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Full DTAC Assessment Available</p>
                    <p className="text-sm text-blue-800 dark:text-blue-400 mb-3">
                      The complete DTAC assessment document includes detailed evidence and documentation across all seven sections required for NHS procurement.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="bg-background hover:bg-muted"
                    >
                      <Link to="/dtac">
                        <FileText className="w-4 h-4 mr-2" />
                        View Full DTAC Assessment
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 3. Data Protection & GDPR */}
              <div>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  3. Data Protection & GDPR
                </h3>
                <p className="mb-4">NoteWell processes data strictly as a <strong>Data Processor</strong> for the NHS organisation.</p>
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    "DPIA completed and ready for sharing",
                    "UK-only hosting and data storage (target: NHS-hosted tenant for production)",
                    "All PHI/PII encrypted in transit (TLS 1.2+) and at rest (AES-256)",
                    "Role-based access control (RLS)",
                    "No data reused for AI training",
                    "Full audit logs of all content access",
                    "Retention, deletion and lifecycle controls implemented"
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-3 border rounded-lg bg-background">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Delivery Model & DSPT Ownership */}
              <div>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Delivery Model & DSPT Ownership
                </h3>

                <p className="mb-4">
                  NoteWell AI is being developed as a neighbourhood-aligned digital tool to support primary care governance, complaints handling and meeting management. The intention is not to operate NoteWell as a commercial product but as a shared NHS-facing service delivered in partnership with the local Integrated Care System (ICS), neighbourhood teams and approved NHS hosting providers.
                </p>

                <div className="space-y-4">
                  {/* Delivery Model */}
                  <div className="border rounded-lg p-4 bg-background">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      Delivery Model (Non-Commercial, NHS-Aligned)
                    </h4>
                    <p className="text-sm mb-3">
                      NoteWell will be provided to participating practices and neighbourhoods as a centrally managed service, not an individually purchased or locally installed solution.
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">Access will be controlled per practice via role-based permissions</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">No fee-for-service commercial model</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">Focus on improving governance capacity, reducing administrative burden, and supporting NHS regulatory compliance</span>
                      </div>
                    </div>
                  </div>

                  {/* Supplier Entity */}
                  <div className="border rounded-lg p-4 bg-background">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Supplier Entity (PCN Services Ltd – Neutral Vehicle)
                    </h4>
                    <p className="text-sm mb-3">
                      PCN Services Ltd is the legal entity currently acting as the developer and Data Processor for NoteWell during its early-stage development. It functions only as the governance and contracting vehicle for the tool and does not operate a commercial retail model.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm">
                        <strong>Future Structure (TBC):</strong> Depending on the final hosting and deployment structure, PCN Services Ltd may continue as the technical supplier or may transfer responsibilities to an NHS organisation.
                      </p>
                    </div>
                  </div>

                  {/* DSPT Ownership Options */}
                  <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 p-4 rounded-r-lg">
                    <h4 className="font-semibold mb-3 flex items-center gap-2 text-blue-900 dark:text-blue-300">
                      <Shield className="w-4 h-4" />
                      DSPT Ownership Options (To Be Confirmed with ICP/LHIS)
                    </h4>
                    <p className="text-sm mb-3">
                      The final DSPT route will depend on where the system is hosted for pilot and production:
                    </p>
                    
                    <div className="space-y-3">
                      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-blue-200 dark:border-blue-900">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-300 flex items-center justify-center text-xs font-bold">1</span>
                          <div>
                            <p className="font-semibold text-sm text-green-900 dark:text-green-300">If hosted within an NHS organisation (preferred option – LHIS/UHL/Neighbourhood):</p>
                          </div>
                        </div>
                        <ul className="ml-8 space-y-1 text-sm">
                          <li className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <span>DSPT responsibility sits with that NHS organisation</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <span>NoteWell operates as an NHS-provided service</span>
                          </li>
                        </ul>
                      </div>

                      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-amber-200 dark:border-amber-900">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-300 flex items-center justify-center text-xs font-bold">2</span>
                          <div>
                            <p className="font-semibold text-sm text-amber-900 dark:text-amber-300">If hosted under a supplier tenancy (interim option):</p>
                          </div>
                        </div>
                        <ul className="ml-8 space-y-1 text-sm">
                          <li className="flex items-start gap-2">
                            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <span>PCN Services Ltd will complete DSPT (Standard) as the supplier</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <span>The hosting partner (e.g., LHIS or equivalent) may also share DSPT controls</span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <p className="text-sm">
                        <strong>Strategic Direction:</strong> This choice will be made jointly with the ICP digital team as part of determining the final hosting model. The preferred strategic direction is for NoteWell to be hosted within an NHS-owned tenant, aligning DSPT ownership and governance under the NHS rather than a private entity.
                      </p>
                    </div>
                  </div>

                  {/* Hard Governance Gate */}
                  <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-2 border-red-400 dark:border-red-900 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold mb-2 text-red-900 dark:text-red-300">Hard Governance Gate – DSPT Ownership Required</p>
                        <p className="text-sm text-red-800 dark:text-red-400 mb-2">
                          <strong>No live NHS patient data will be processed until:</strong>
                        </p>
                        <ul className="text-sm text-red-800 dark:text-red-400 space-y-1 ml-4 list-disc">
                          <li>DSPT ownership is confirmed for the hosting organisation (or supplier if interim tenancy is used)</li>
                          <li>A current DSPT submission is in place and meets "Standards Met" status</li>
                        </ul>
                        <p className="text-sm text-red-800 dark:text-red-400 mt-2 italic">
                          Development environments use synthetic/test data only. This is a go-live gating condition.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Final Statement */}
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-2 border-amber-300 dark:border-amber-900 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold mb-1">DSPT Status</p>
                        <p className="text-sm text-muted-foreground">
                          A final DSPT statement will be added once the hosting organisation is confirmed (TBC).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Backups, Restore, SAR & FOI Support */}
              <div>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Backups, Restore, SAR & FOI Support
                </h3>
                
                <p className="mb-4">
                  The ICP security discussion highlighted the importance of clear backup and restore arrangements (including ransomware resilience), and practical support for Subject Access Requests (SARs) and Freedom of Information (FOI) requests, so NoteWell does not save time in one area only to create extra work elsewhere.
                </p>

                <div className="space-y-4">
                  {/* Backups & ransomware resilience */}
                  <div className="border rounded-lg p-4 bg-background">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Database className="w-4 h-4 text-blue-600" />
                      Backups & Ransomware Resilience
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">Supabase provides regular automated backups of the primary database (UK region)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">Access to backups is restricted to platform administrators</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">Options for immutable backups and recovery point objectives (RPO/RTO) are being explored with hosting partners (TBC)</span>
                      </div>
                    </div>
                  </div>

                  {/* Deletion vs backups */}
                  <div className="border rounded-lg p-4 bg-background">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Deletion vs Immutable Backups
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm"><strong>NHS-aligned position:</strong> Deletion requests will remove data from live systems. Historic backups are immutable for ransomware resilience but will expire per the defined retention schedule (typically 30-90 days for operational backups).</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">Deletion confirmation will note that data may persist in immutable backups until natural expiry, consistent with NHS standard practice for ransomware-resilient infrastructure.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">Final backup retention periods to be agreed with hosting organisation (TBC)</span>
                      </div>
                    </div>
                  </div>

                  {/* SAR/FOI support */}
                  <div className="border rounded-lg p-4 bg-background">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      SAR/FOI Support (Planned Feature)
                    </h4>
                    <div className="space-y-2 mb-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm"><strong>Requirement identified:</strong> Ability to efficiently retrieve all records relating to a specific patient or staff member for SAR/FOI</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm"><strong>Planned roadmap item:</strong> A search/export function (e.g. "return all complaints/meeting records for [NHS number / name / unique ID]") to generate SAR/FOI bundles</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">Until that feature is implemented, practices will be able to search using standard filters and export results, but a dedicated SAR/FOI workflow will be added to reduce burden</span>
                      </div>
                    </div>
                  </div>

                  {/* TBC items */}
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600" />
                      TBC Items
                    </h4>
                    <ul className="space-y-1 ml-4 text-sm">
                      <li>• Final backup strategy (including immutable options, RPO/RTO) – to be agreed with chosen hosting organisation</li>
                      <li>• SAR/FOI export design and implementation timetable</li>
                      <li>• These details will be incorporated into the DPIA, DSAR/FOI guidance for practices, and the public-facing Trust Centre when finalised</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 4. Technical Security Posture */}
              <div>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  4. Technical Security Posture
                </h3>
                
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="hosting">
                    <AccordionTrigger className="text-base font-semibold">Hosting & Deployment Model</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        {/* Current position */}
                        <div className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-4 rounded-r-lg">
                          <h4 className="font-semibold text-sm mb-2 text-amber-900 dark:text-amber-300">Current Position (Pilot)</h4>
                          <p className="text-sm mb-3">
                            NoteWell AI is currently hosted on Supabase (AWS London region) with the application layer deployed via the Lovable platform. All data is stored in the UK, encrypted in transit (TLS 1.2+) and at rest (AES-256).
                          </p>
                        </div>

                        {/* Target position */}
                        <div className="border-l-4 border-green-500 bg-green-50 dark:bg-green-950/20 p-4 rounded-r-lg">
                          <h4 className="font-semibold text-sm mb-2 text-green-900 dark:text-green-300">Target Position (Production / Neighbourhood Model)</h4>
                          <p className="text-sm mb-3">
                            The preferred strategic option is to host NoteWell within an NHS-controlled environment (e.g. LHIS/UHL tenant), using Lovable primarily as a development environment with code promoted via GitHub into a controlled NHS deployment pipeline.
                          </p>
                          <p className="text-sm font-semibold mb-2">This would allow:</p>
                          <ul className="space-y-2 ml-4">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span className="text-sm">Use of existing NHS security controls and monitoring</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span className="text-sm">Easier assurance for practices around complaints-related PII</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span className="text-sm">Alignment with ICB/ICP security and DSPT governance</span>
                            </li>
                          </ul>
                        </div>

                        {/* Decisions & dependencies */}
                        <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 p-4 rounded-r-lg">
                          <h4 className="font-semibold text-sm mb-2 text-blue-900 dark:text-blue-300">Decisions & Dependencies (TBC)</h4>
                          <ul className="space-y-2 text-sm">
                            <li className="flex items-start gap-2">
                              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <span><strong>Hosting organisation:</strong> TBC between Neighbourhood / LHIS / Trust (decision owner: ICP Digital/IT)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <span><strong>Final production tenancy:</strong> NHS tenant vs. supplier tenancy – to be confirmed as part of neighbourhood business case</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <span><strong>Timeline:</strong> Target decision for hosting model during neighbourhood planning (TBC – expected 2026)</span>
                            </li>
                          </ul>
                        </div>

                        {/* Important notice */}
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-2 border-amber-300 dark:border-amber-900 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                            <p className="text-sm">
                              <strong>Important:</strong> Until a final hosting decision is made, NoteWell will remain in UK-only Supabase/Lovable hosting for development and limited pilot discussions only, with no broad roll-out of complaints data processing.
                            </p>
                          </div>
                        </div>

                        {/* Infrastructure controls */}
                        <div className="mt-3">
                          <h4 className="font-semibold text-sm mb-2">Infrastructure Security Controls</h4>
                          <ul className="space-y-2 ml-4">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span className="text-sm">No public inbound services beyond HTTPS</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span className="text-sm">TLS enforced edge-to-end</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span className="text-sm">Segregated databases per tenant organisation via RLS</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="authentication">
                    <AccordionTrigger className="text-base font-semibold">Authentication & Access</AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2 ml-4">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>JWT-based identity</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Secure session expiry</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold">Multi-Factor Authentication (MFA) – Mandatory for Production</span>
                              <div className="mt-2 space-y-2 text-sm">
                                <p className="text-muted-foreground">
                                  Complaints content frequently contains sensitive PII. MFA is mandatory for all production users accessing PII-bearing modules, in line with NHS security expectations and ICB requirements.
                                </p>
                                <div className="bg-muted/50 rounded-lg p-3 mt-2">
                                  <p className="font-semibold mb-1">Current Position (Development Environment)</p>
                                  <ul className="space-y-1 ml-4">
                                    <li>• Supabase Auth supports email/password plus optional MFA (TOTP-based)</li>
                                    <li>• MFA is available but not enforced in development/testing environment</li>
                                    <li>• Will be enforced for all production users before pilot deployment</li>
                                  </ul>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-3 mt-2">
                                  <p className="font-semibold mb-1">Production MFA Implementation</p>
                                  <ul className="space-y-1 ml-4">
                                    <li>• Mandatory for all production users before pilot deployment</li>
                                    <li>• <strong>Authenticator App (TOTP)</strong> - compatible with Microsoft Authenticator, Google Authenticator, or any TOTP app</li>
                                    <li>• Alternative: Email verification code as fallback where appropriate</li>
                                    <li>• Final MFA configuration to be agreed with NHS hosting organisation (LHIS/UHL)</li>
                                  </ul>
                                </div>
                              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3 mt-2">
                                <p className="font-semibold mb-1 text-amber-900 dark:text-amber-300">Outstanding Actions</p>
                                <ul className="space-y-1 ml-4 text-muted-foreground">
                                  <li>• Enforce MFA in production Supabase configuration before pilot launch</li>
                                  <li>• Create training materials for MFA setup and use</li>
                                  <li>• Test MFA enrollment process with practice managers</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Row-Level Security (RLS) for organisation boundaries</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Least privilege principle applied across roles</span>
                        </li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="rbac-jml">
                    <AccordionTrigger className="text-base font-semibold">RBAC – Joiners, Movers & Leavers (JML)</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-sm mb-4">
                        A formal JML process will be implemented to ensure user access is accurate, timely, and practice-controlled. The process will operate as follows:
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-semibold">Joiners:</span> Practice Admins create new accounts and assign roles.
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-semibold">Movers:</span> When staff change practices, their previous access is automatically revoked (logic implemented; final workflow TBC).
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-semibold">Leavers:</span> Practice Admins disable accounts immediately; system auto-locks inactive accounts after 60 days (TBC).
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-semibold">Oversight:</span> NoteWell will maintain automated alerts for orphaned or legacy accounts (TBC).
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
                        <p className="text-sm"><strong>Note:</strong> A full JML policy will be published once finalised with the hosting organisation (TBC).</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="application">
                    <AccordionTrigger className="text-base font-semibold">Application Security Controls</AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2 ml-4">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>OWASP-aligned secure development lifecycle</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Code scanning dependencies monitoring</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>API rate-limiting and brute-force protection</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Strict CORS and origin rules</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>High-entropy random secret keys</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Error/exception sanitisation (no sensitive stack trace leakage)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span><strong>Session timeout policy:</strong> Maximum session timeout: 5 hours (standard modules); 4 hours or less for PII-bearing modules</span>
                        </li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="incident-monitoring">
                    <AccordionTrigger className="text-base font-semibold">Incident Monitoring & Response Ownership (Pilot Phase)</AccordionTrigger>
                    <AccordionContent>
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4 mb-4">
                        <h4 className="font-semibold text-sm mb-2 text-blue-900 dark:text-blue-300">Interim Accountable Model for Pilot</h4>
                        <p className="text-sm text-blue-800 dark:text-blue-400">
                          During the pilot phase, incident monitoring and response ownership will operate under an interim model pending formal NHS hosting migration.
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <Users className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-semibold">Neighbourhood Digital Team:</span> First-line monitoring of system health, user access issues, and operational alerts. Responsible for triaging incidents and escalating to appropriate parties.
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <Shield className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-semibold">Hosting Organisation (LHIS/NHS Tenant):</span> Security incident response, data breach handling, and integration with NHS incident management processes. Formal reporting to ICO where required.
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <FileText className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-semibold">PCN Services Ltd (Developer):</span> Technical issue resolution, bug fixes, and security patch deployment. Escalation pathway for platform-level issues.
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
                        <p className="text-sm"><strong>Note:</strong> A formal incident response matrix and escalation pathways will be documented once the hosting organisation is confirmed. This interim model ensures clear accountability during the pilot phase.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="pen-testing">
                    <AccordionTrigger className="text-base font-semibold">Penetration Testing Ownership</AccordionTrigger>
                    <AccordionContent>
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4 mb-4">
                        <h4 className="font-semibold text-sm mb-2 text-blue-900 dark:text-blue-300">Hosting NHS Organisation Responsibility</h4>
                        <p className="text-sm text-blue-800 dark:text-blue-400">
                          Penetration testing is commissioned and owned by the hosting NHS organisation. PCN Services Ltd supports the process but does not control the testing scope or timeline.
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-semibold">Commissioning:</span> The hosting NHS organisation (e.g., LHIS/UHL) commissions the penetration test via their approved CREST or CHECK accredited provider.
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-semibold">Scope:</span> External web application testing covering OWASP Top 10, authentication, access control, API endpoints, and TLS configuration. Red-team and internal network testing not required.
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-semibold">Remediation:</span> All findings will be tracked to closure with defined timelines. Critical/high severity findings must be remediated before go-live. Medium/low findings tracked via the hosting organisation's risk register.
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-semibold">Re-testing:</span> Re-testing of remediated critical/high findings will be conducted and tracked to closure by the hosting organisation.
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
                        <p className="text-sm"><strong>Go-Live Gate:</strong> No live NHS patient data will be processed until penetration testing is complete and all critical/high findings are remediated and re-tested.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="third-party-ai">
                    <AccordionTrigger className="text-base font-semibold">Third-Party AI Controls & Data Protection</AccordionTrigger>
                    <AccordionContent>
                      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4 mb-4">
                        <h4 className="font-semibold text-sm mb-2 text-blue-900 dark:text-blue-300">Technical Constraints for External LLM Use</h4>
                        <p className="text-sm text-blue-800 dark:text-blue-400">
                          External LLM use is technically constrained for PII-bearing modules through enforced controls. These are not policy statements but architectural safeguards.
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <Shield className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-semibold">Data Minimisation/Masking:</span> Patient identifiers are masked or removed before any data is sent to external AI services. Only structured, anonymised content is transmitted for processing.
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <Shield className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-semibold">Structured Prompts:</span> All AI prompts use structured templates that prevent free-text identifiers from being included. System prompts enforce clinical safety boundaries.
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <Shield className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-semibold">Free-Text Identifier Blocking:</span> NHS numbers, dates of birth, and other direct identifiers are blocked by design from being transmitted to external LLMs.
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-semibold">Disable External Processing:</span> The system includes the ability to disable external LLM processing entirely for specific modules or organisations where these controls cannot be guaranteed or where local policy requires it.
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
                        <p className="text-sm"><strong>DPA in Place:</strong> Data Processing Agreement with OpenAI (signed 10 November 2025) confirms no data reuse for training and UK-aligned processing terms.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="monitoring">
                    <AccordionTrigger className="text-base font-semibold">Monitoring & Audit</AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2 ml-4">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Full audit trail for user actions</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Tamper-resistant audit logging</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Monitoring for failed login attempts</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Incident response plan in place</span>
                        </li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="log-retention">
                    <AccordionTrigger className="text-base font-semibold">Log Retention & Monitoring</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-sm mb-4">
                        NoteWell generates audit and security logs for user logins and access to complaints and meeting records, configuration changes and role updates, and security-relevant events (e.g. repeated failed logins).
                      </p>
                      <p className="text-sm mb-4">
                        The ICB security lead highlighted the emerging mapping of DSPT → CAF v4, which will require applications to explicitly define log retention based on risk and use case, rather than a blanket value.
                      </p>

                      <div className="space-y-3">
                        {/* Current position */}
                        <div className="bg-muted/50 rounded-lg p-4">
                          <h4 className="font-semibold text-sm mb-2">Current Position</h4>
                          <ul className="space-y-2 text-sm">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>Logs are retained in Supabase for operational troubleshooting and security review</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <span>No formal, risk-based written log retention policy has yet been agreed</span>
                            </li>
                          </ul>
                        </div>

                        {/* Planned approach */}
                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
                          <h4 className="font-semibold text-sm mb-2 text-blue-900 dark:text-blue-300">Minimum Retention Standards (Pre-Go-Live Requirement)</h4>
                          <p className="text-sm mb-3">The following minimum retention periods will apply:</p>
                          <ul className="space-y-2 text-sm">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span><strong>Audit logs (access, modifications):</strong> Minimum 12 months</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span><strong>Security event logs:</strong> Minimum 12 months (or longer per CAF/DSPT requirements)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span><strong>Authentication logs:</strong> Minimum 12 months</span>
                            </li>
                          </ul>
                          <p className="text-sm mt-3 font-semibold">Balance:</p>
                          <ul className="space-y-1 ml-4 text-sm">
                            <li>• Security and forensic value of logs</li>
                            <li>• Supabase storage cost</li>
                            <li>• GDPR data minimisation and storage limitation (especially where logs may include identifiers)</li>
                          </ul>
                        </div>

                        {/* TBC items */}
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
                          <h4 className="font-semibold text-sm mb-2 text-amber-900 dark:text-amber-300">TBC Items</h4>
                          <ul className="space-y-1 ml-4 text-sm">
                            <li>• Final retention periods to be formally agreed with hosting organisation (minimum standards above will apply)</li>
                            <li>• Confirmation of which logs may contain PII and how these are redacted/rotated if required</li>
                            <li>• Once agreed, the log retention policy will be documented here and reflected in the DPIA and DSPT submissions</li>
                          </ul>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="cyber-essentials">
                    <AccordionTrigger className="text-base font-semibold">Cyber Essentials Requirement</AccordionTrigger>
                    <AccordionContent>
                      <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-2 border-red-400 dark:border-red-900 rounded-lg p-4 mb-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-bold mb-1 text-red-900 dark:text-red-300">Mandatory Pre-Go-Live Requirement</p>
                            <p className="text-sm text-red-800 dark:text-red-400">
                              Cyber Essentials certification (or equivalent controls accepted by the host organisation) is a mandatory go-live gating condition. The system will not process live NHS patient data until this requirement is satisfied.
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm mb-4">
                        NoteWell AI is working toward Cyber Essentials certification to support NHS adoption.
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-semibold">Cyber Essentials (Basic):</span> Mandatory pre-go-live (or equivalent controls accepted by host organisation)
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-semibold">Cyber Essentials Plus:</span> Not required for Class I medical device software, but may be explored depending on hosting structure (TBC)
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-semibold">Alignment:</span> Security controls already align to many CE requirements (MFA, encryption, access control, audit logging)
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                        <p className="text-sm"><strong>Next Steps:</strong> A formal Cyber Essentials readiness assessment will begin once the hosting organisation is confirmed. Host organisation may accept equivalent controls if they determine CE certification is not required for their risk tolerance.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="ai-safety-guardrails">
                    <AccordionTrigger className="text-base font-semibold">AI Safety Guardrails & Content Moderation</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-sm mb-4">
                        NoteWell implements a comprehensive <strong>six-layer protection system</strong> to prevent inappropriate AI use, protect against malicious inputs, and ensure clinical safety in healthcare settings.
                      </p>

                      <div className="space-y-4">
                        {/* Layer 1: Clinical Safety Monitoring */}
                        <div className="bg-muted/50 rounded-lg p-4">
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-red-600" />
                            1. Clinical Safety Monitoring
                          </h4>
                          <ul className="space-y-2 text-sm ml-6">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>60+ monitored medical terms across blood tests, diagnoses, medications, and clinical measurements</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>High-risk emergency keyword detection (cardiac arrest, stroke, overdose, etc.)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>Risk classification (low/medium/high) with appropriate action recommendations</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>AI fabrication prevention for medical information</span>
                            </li>
                          </ul>
                          <p className="text-xs text-muted-foreground mt-2 ml-6">Source: medicalSafety.ts</p>
                        </div>

                        {/* Layer 2: Input Security Validation */}
                        <div className="bg-muted/50 rounded-lg p-4">
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-blue-600" />
                            2. Input Security Validation
                          </h4>
                          <ul className="space-y-2 text-sm ml-6">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>SQL injection pattern detection and blocking</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>Cross-site scripting (XSS) prevention</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>Command injection protection</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>Input length limits (10,000 characters maximum)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>HTML entity encoding for output safety</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>File upload validation (type, size, extension checking)</span>
                            </li>
                          </ul>
                          <p className="text-xs text-muted-foreground mt-2 ml-6">Source: securityValidation.ts</p>
                        </div>

                        {/* Layer 3: Rate Limiting */}
                        <div className="bg-muted/50 rounded-lg p-4">
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-amber-600" />
                            3. Rate Limiting & Brute-Force Protection
                          </h4>
                          <ul className="space-y-2 text-sm ml-6">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>API rate limiting: 30 requests per minute</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>Authentication rate limiting: 5 attempts per 5 minutes</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>VPN-friendly corporate network detection with adjusted limits</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>Email-based rate limiting for additional protection</span>
                            </li>
                          </ul>
                          <p className="text-xs text-muted-foreground mt-2 ml-6">Source: enhancedSecurityValidation.ts</p>
                        </div>

                        {/* Layer 4: Offensive Language Filtering */}
                        <div className="bg-muted/50 rounded-lg p-4">
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-purple-600" />
                            4. Offensive Language Filtering
                          </h4>
                          <div className="space-y-3 ml-6">
                            <div>
                              <p className="text-sm font-medium text-red-700 dark:text-red-400">Blocked Terms (~30 severe terms)</p>
                              <p className="text-sm text-muted-foreground">Translation/processing completely blocked for severe profanity, racial slurs, hate speech, and threats</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Warning Terms (~30 mild terms)</p>
                              <p className="text-sm text-muted-foreground">Processing continues with content warning for mild profanity and insults</p>
                            </div>
                            <li className="flex items-start gap-2 list-none">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span className="text-sm">Applied to translation service and content moderation</span>
                            </li>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 ml-6">Source: translate-text/index.ts</p>
                        </div>

                        {/* Layer 5: AI Hallucination Detection */}
                        <div className="bg-muted/50 rounded-lg p-4">
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-cyan-600" />
                            5. AI Hallucination Detection
                          </h4>
                          <ul className="space-y-2 text-sm ml-6">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>125+ known hallucination phrases detected and filtered</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>"Thank you for watching" variations, webinar/meeting closing loops, call-to-action hallucinations</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>Repetitive content detection (low unique word ratio)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>Fabricated URL detection with NHS/medical URL whitelist</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>Repeated phrase pattern detection and confidence threshold checking</span>
                            </li>
                          </ul>
                          <p className="text-xs text-muted-foreground mt-2 ml-6">Source: whisperHallucinationPatterns.ts</p>
                        </div>

                        {/* Layer 6: Clinical Disclaimers */}
                        <div className="bg-muted/50 rounded-lg p-4">
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-green-600" />
                            6. Clinical Disclaimers & User Acknowledgement
                          </h4>
                          <ul className="space-y-2 text-sm ml-6">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>Persistent micro-banner disclaimers on all AI outputs</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>Modal terms of use requiring user acknowledgement</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>Clear guidance on clinical responsibility</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>Links to original sources (NICE, BNF, MHRA, NHS.uk)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>Audit trail text for clinical records</span>
                            </li>
                          </ul>
                          <p className="text-xs text-muted-foreground mt-2 ml-6">Source: DisclaimerComponents.tsx</p>
                        </div>
                      </div>

                      <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
                        <p className="text-sm"><strong>DCB0129 Alignment:</strong> These controls demonstrate that safety measures are proportionate to identified hazards, supporting clinical safety case requirements.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              <Separator />

              {/* 5. Interoperability */}
              <div>
                <h3 className="text-xl font-semibold mb-3">5. Interoperability Statement</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 border rounded-lg bg-background">
                    <XCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <span className="text-sm">No direct EMIS or SystmOne integration at present</span>
                  </div>
                  <div className="flex items-start gap-2 p-3 border rounded-lg bg-background">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Data output formats: PDF, DOCX, TXT, CSV, JSON</span>
                  </div>
                  <div className="flex items-start gap-2 p-3 border rounded-lg bg-background">
                    <Clock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">FHIR-compatible export planned for future phases</span>
                  </div>
                  <div className="flex items-start gap-2 p-3 border rounded-lg bg-background">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">API-first architecture allows controlled integration when required</span>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4">
                    <p className="font-semibold text-green-900 dark:text-green-300">Low interoperability risk profile under DTAC</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 6. DTAC Compliance Summary */}
              <div>
                <h3 className="text-xl font-semibold mb-3">6. DTAC Compliance Summary</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DTAC Domain</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Evidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Clinical Safety</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Met in principle (subject to go-live gating conditions)
                        </Badge>
                      </TableCell>
                      <TableCell>MHRA Class I, DCB0129 (draft pending CSO adoption)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Data Protection</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Met in principle (subject to go-live gating conditions)
                        </Badge>
                      </TableCell>
                      <TableCell>DPIA, UK-only hosting (target: NHS tenant)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Technical Security</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Met in principle (subject to go-live gating conditions)
                        </Badge>
                      </TableCell>
                      <TableCell>Encryption, access control, pen-test plan</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Interoperability</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Low-risk
                        </Badge>
                      </TableCell>
                      <TableCell>No EMIS/S1 write-back</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Usability & Accessibility</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          WCAG-aligned
                        </Badge>
                      </TableCell>
                      <TableCell>Primary care UI testing</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4 mt-4">
                  <p className="font-semibold text-green-900 dark:text-green-300">This constitutes a low-risk DTAC footprint suitable for pilot and deployment in GP practices, PCNs and Neighbourhoods.</p>
                </div>
              </div>

              <Separator />

              {/* 7. Penetration Test Requirements */}
              <div>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  7. Penetration Test Requirements (NHS-Ready Format)
                </h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Purpose</h4>
                    <p className="text-sm text-muted-foreground">To validate NoteWell's external security posture using CREST/NCSC-aligned methodology.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Scope (Required for NHS DTAC)</h4>
                    <Accordion type="multiple" className="w-full">
                      <AccordionItem value="webapp">
                        <AccordionTrigger className="text-sm font-semibold">A. External Web Application</AccordionTrigger>
                        <AccordionContent>
                          <ul className="space-y-1 ml-4 text-sm">
                            <li>• Login, MFA, reset flows</li>
                            <li>• Session management</li>
                            <li>• Access control & RLS checks</li>
                            <li>• Account provisioning restrictions</li>
                            <li>• Input validation</li>
                          </ul>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="api">
                        <AccordionTrigger className="text-sm font-semibold">B. API & Backend</AccordionTrigger>
                        <AccordionContent>
                          <ul className="space-y-1 ml-4 text-sm">
                            <li>• REST endpoint enumeration</li>
                            <li>• API authentication & authorisation</li>
                            <li>• Injection tests (SQL/NoSQL/ORM)</li>
                            <li>• Rate limiting & brute-force attempt handling</li>
                            <li>• Data leakage & error sanitisation</li>
                          </ul>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="infrastructure">
                        <AccordionTrigger className="text-sm font-semibold">C. Infrastructure & Config</AccordionTrigger>
                        <AccordionContent>
                          <ul className="space-y-1 ml-4 text-sm">
                            <li>• TLS review</li>
                            <li>• Exposed services</li>
                            <li>• Cloud misconfiguration checks</li>
                            <li>• Secrets management & key handling</li>
                          </ul>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="owasp">
                        <AccordionTrigger className="text-sm font-semibold">D. OWASP Top 10 Coverage</AccordionTrigger>
                        <AccordionContent>
                          <ul className="space-y-1 ml-4 text-sm">
                            <li>• Broken Access Control</li>
                            <li>• Injection</li>
                            <li>• Cryptographic failures</li>
                            <li>• Security misconfigurations</li>
                            <li>• Vulnerable components</li>
                            <li>• Authentication failures</li>
                            <li>• SSRF</li>
                            <li>• Logging/monitoring failures</li>
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Out of Scope</h4>
                    <p className="text-sm text-muted-foreground mb-2">Not required for a Class I DTAC review:</p>
                    <ul className="space-y-1 ml-4 text-sm text-muted-foreground">
                      <li>• Red teaming</li>
                      <li>• Phishing/social engineering</li>
                      <li>• Physical security</li>
                      <li>• Zero-day modelling</li>
                      <li>• Insider threat simulations</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Deliverables</h4>
                    <div className="grid md:grid-cols-2 gap-2">
                      {[
                        "Executive summary",
                        "Detailed technical findings",
                        "CVSS scoring",
                        "Recommendations",
                        "Re-test verification"
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 border rounded bg-background text-sm">
                          <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Frequency</h4>
                    <ul className="space-y-1 ml-4 text-sm">
                      <li>• Pre-deployment (2025/26)</li>
                      <li>• Annually thereafter</li>
                      <li>• After significant architecture changes</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 8. Documents Available */}
              <div>
                <h3 className="text-xl font-semibold mb-3">8. Documents Available for the ICB</h3>
                <p className="text-sm text-muted-foreground mb-4">The following can be made accessible directly inside NoteWell under Governance → Assurance Pack:</p>
                <div className="grid md:grid-cols-2 gap-2">
                  {[
                    { name: "MHRA Class I Certificate", link: "/documents/MHRA-Class-I-Registration-Certificate.pdf", isDownload: true },
                    { name: "DCB0129 Safety Case", link: "/safety-case", isDownload: false },
                    { name: "Hazard Log", link: "/hazard-log", isDownload: false },
                    { name: "DPIA", link: "/dpia", isDownload: false },
                    { name: "DTAC Assessment", link: "/dtac", isDownload: false },
                    { name: "Privacy Policy", link: "/privacy-policy", isDownload: false },
                    { name: "Security Posture Overview", link: "/security-posture", isDownload: false },
                    { name: "Penetration Test Scope", link: null, isDownload: false },
                    { name: "Incident Response Policy", link: "/incident-response", isDownload: false },
                    { name: "Data Flow Diagram & Architecture Summary", link: "/data-flow-architecture", isDownload: false },
                    { name: "DPAs with OpenAI & Supabase", link: null, isDownload: false },
                    { name: "Cyber Essentials (in progress) documents", link: null, isDownload: false }
                  ].map((doc, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-3 border rounded-lg bg-background hover:bg-muted/50 transition-colors">
                      <FileText className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      {doc.link ? (
                        doc.isDownload ? (
                          <a 
                            href={doc.link}
                            download
                            className="text-sm text-primary hover:underline font-medium"
                          >
                            {doc.name}
                          </a>
                        ) : (
                          <Link 
                            to={doc.link}
                            className="text-sm text-primary hover:underline font-medium"
                          >
                            {doc.name}
                          </Link>
                        )
                      ) : (
                        <span className="text-sm">{doc.name}</span>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 p-4 bg-muted/50 border rounded-lg">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold mb-2">Development Platform Security (Lovable/Supabase)</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        The current development environment is built on the Lovable platform (with Supabase backend), which maintains ISO 27001 and SOC 2 Type II compliance. 
                        Note: For production deployment, NoteWell will migrate to NHS-hosted infrastructure. View development platform security documentation:
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open('https://trust.platform.delve.co/lovable', '_blank')}
                        className="gap-2"
                      >
                        <Shield className="h-4 w-4" />
                        Lovable Trust Centre
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 9. Summary Statement */}
              <div>
                <h3 className="text-xl font-semibold mb-3">9. Summary Statement for NHS ICB IT</h3>
                <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 border border-green-200 dark:border-green-900 rounded-lg p-6">
                  <p className="text-base leading-relaxed">
                    NoteWell AI is a <strong>low-risk, MHRA Class I medical device</strong> designed for safe deployment across primary care in a non-business-critical, governance-focused role. 
                    A draft DPIA and draft clinical safety case (DCB0129) are in place for Meeting Notes & Complaints (with CSO/SIRO/Caldicott sign-off to follow once NHS hosting is confirmed). 
                    It maintains UK-only data storage with a target NHS-hosted tenant for production, implements strong encryption and comprehensive RLS policies, full audit logs, and a planned CREST-standard external web application penetration test after migration to NHS hosting (target 2026).
                  </p>
                  <p className="text-base leading-relaxed mt-4">
                    <strong>Hosting Model:</strong> Current development uses Lovable/Supabase (AWS London) for prototype purposes only. For pilot deployment, the system will migrate to NHS-hosted infrastructure (LHIS preferred) via GitHub export, enabling clearer ICB risk ownership and easier pen-test acceptance.
                  </p>
                  <p className="text-base leading-relaxed mt-4">
                    The tool involves <strong>no EMIS/S1 write-back</strong>, uses strict human-in-the-loop validation for all outputs, and is suitable for 
                    controlled pilot use in <strong>GP practices, PCNs and Neighbourhood teams</strong>, subject to completion of the outstanding governance and security actions documented in the Pre-Deployment Readiness Checklist.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Sign-Off Sections */}
        <section id="signoff" className="mb-8">
          <div className="space-y-6">
            {/* CSO Sign-Off */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    Clinical Safety Officer Sign-Off
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
                    <Download className="w-4 h-4 mr-2" />
                    Download CSO Report
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div>
                    <span className="font-semibold">System Safety Classification:</span>
                    <p className="text-sm text-muted-foreground mt-1">MHRA Class I Medical Device Software (UK MDR 2002) - Registered since December 2025 (Manufacturer Self-Certification)</p>
                  </div>
                  <div>
                    <span className="font-semibold">Overall Safety Rating:</span>
                    <Badge className="ml-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
                      AMBER - Conditionally Acceptable for NHS Deployment
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="grid md:grid-cols-3 gap-6 pt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">CSO Name:</label>
                    <div className="h-10 border-b-2 border-muted"></div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Signature:</label>
                    <div className="h-10 border-b-2 border-muted"></div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Date:</label>
                    <div className="h-10 border-b-2 border-muted"></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Next Review Date:</label>
                  <div className="h-10 border-b-2 border-muted max-w-xs"></div>
                </div>
              </CardContent>
            </Card>

            {/* DPO Sign-Off */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Data Protection Officer Sign-Off
                  </CardTitle>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/reports/NoteWell_DPO_SignOff.pdf" target="_blank" rel="noopener noreferrer">
                      <FileText className="w-4 h-4 mr-2" />
                      Review DPO Documentation
                    </a>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm">
                    <strong>For DPO Review:</strong> Please review the detailed Data Protection Officer documentation including DPIA summary, lawful basis, data flows, privacy controls, and compliance assessment before providing sign-off below.
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <div>
                    <span className="font-semibold">GDPR Compliance Status:</span>
                    <Badge className="ml-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
                      Conditionally Compliant - Subject to DPIA Completion
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="grid md:grid-cols-3 gap-6 pt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">DPO Name:</label>
                    <div className="h-10 border-b-2 border-muted"></div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Signature:</label>
                    <div className="h-10 border-b-2 border-muted"></div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Date:</label>
                    <div className="h-10 border-b-2 border-muted"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

          {/* Footer Actions */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t">
            <Button variant="outline" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <ArrowUp className="w-4 h-4 mr-2" />
              Back to Top
            </Button>
            <Button 
              variant="default" 
              disabled={isExporting}
              onClick={async () => {
                try {
                  setIsExporting(true);
                  const { exportCSOReportToWord } = await import('@/utils/exportCSOReport');
                  await exportCSOReportToWord();
                } catch (error) {
                  console.error('Error exporting report:', error);
                } finally {
                  setIsExporting(false);
                }
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? 'Generating...' : 'Export Report'}
            </Button>
          </div>

        {/* Confidentiality Notice */}
        <div className="mt-8 p-4 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
          <p className="font-semibold">NHS OFFICIAL-SENSITIVE</p>
          <p className="mt-1">This document contains sensitive information and should be handled in accordance with NHS Information Governance policies.</p>
          <p className="mt-1">© {new Date().getFullYear()} Notewell Healthcare Management System. All rights reserved.</p>
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
