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
  Gamepad2
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
          <p className="text-xl text-muted-foreground mb-4">Notewell Healthcare Management System Services</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div><span className="font-semibold">Version:</span> 2.0</div>
            <div><span className="font-semibold">Date:</span> {new Date().toLocaleDateString('en-GB')}</div>
            <div><span className="font-semibold">Status:</span> <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">AWAITING SIGN-OFF</Badge></div>
            <div><span className="font-semibold">Medical Device Classification:</span> MHRA Class 1 Medical Device (UK MDR 2002) - Confirmed 19th November 2025</div>
          </div>
        </div>

        {/* Quick Navigation */}
        <Card className="mb-8 sticky top-4 z-10 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Quick Navigation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {[
                { id: "executive", label: "Executive Summary", icon: Award },
                { id: "services", label: "Services", icon: Database },
                { id: "risks", label: "Risk Assessment", icon: AlertTriangle },
                { id: "gdpr", label: "GDPR Compliance", icon: Lock },
                { id: "security", label: "Security", icon: Shield },
                { id: "third-party", label: "Third Parties", icon: Users },
                { id: "nhs-assurance", label: "NHS Assurance Pack", icon: FileText },
                { id: "checklist", label: "Checklist", icon: CheckCircle },
                { id: "recommendations", label: "Recommendations", icon: TrendingUp }
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
                <Link to="/nhs-quest" target="_blank" rel="noopener noreferrer">
                  <Gamepad2 className="w-4 h-4 mr-2" />
                  NHS Quest
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

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
                <p className="text-lg">
                  This report provides a comprehensive clinical safety and data protection assessment of three core Notewell services deployed within NHS primary care settings: <strong>AI4GP Service</strong>, <strong>Meeting Notes System</strong>, and <strong>Complaints Management System</strong>. The assessment is conducted in accordance with DCB0129 (Clinical Risk Management), DCB0160 (Clinical Safety), and GDPR/Data Protection Act 2018 requirements.
                </p>
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
                      <span>Multiple AI models with cross-validation capabilities</span>
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
                      <span>Data Processing Agreements in place with OpenAI and Supabase (signed 10/11/2025)</span>
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
                      <span>Formal DCB0129 Clinical Risk Management documentation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-orange-600 flex-shrink-0" />
                      <span>Resolution of security warnings and penetration testing</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-orange-600 flex-shrink-0" />
                      <span>Formal Data Protection Impact Assessment</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-orange-600 flex-shrink-0" />
                      <span>Clinical validation workflows implementation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-orange-600 flex-shrink-0" />
                      <span>Mandatory user training programme</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <p className="text-sm font-medium">
                  <strong>Recommendation:</strong> System may proceed to controlled deployment within max 10 practice pilot (max 5 for first month), subject to completion of critical requirements within 90 days. Full NHS rollout should not proceed until GREEN rating achieved. Recent improvements to system navigation and documentation access have strengthened security posture.
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
              <CardDescription>Overview of the three Notewell services under assessment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
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
              <Tabs defaultValue="ai4gp" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="ai4gp">AI4GP ({ai4gpRisks.length} Risks)</TabsTrigger>
                  <TabsTrigger value="meeting">Meeting Notes ({meetingNotesRisks.length} Risks)</TabsTrigger>
                  <TabsTrigger value="complaints">Complaints ({complaintsRisks.length} Risks)</TabsTrigger>
                </TabsList>
                <TabsContent value="ai4gp" className="mt-6">
                  <RiskTable risks={ai4gpRisks} title="AI4GP Service - Clinical Risk Assessment" />
                </TabsContent>
                <TabsContent value="meeting" className="mt-6">
                  <RiskTable risks={meetingNotesRisks} title="Meeting Notes System - Clinical Risk Assessment" />
                </TabsContent>
                <TabsContent value="complaints" className="mt-6">
                  <RiskTable risks={complaintsRisks} title="Complaints Management System - Clinical Risk Assessment" />
                </TabsContent>
              </Tabs>

              <div className="mt-6 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-700 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-1">High Priority Risks Identified</h4>
                    <p className="text-sm text-yellow-800 dark:text-yellow-400">
                      Several HIGH risk ratings have been identified across all three services. While strong controls are in place, further actions are required to reduce residual risks to acceptable levels before full deployment.
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Requirement</TableHead>
                      <TableHead className="min-w-[150px]">AI4GP</TableHead>
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
                        <TableCell className="text-sm">{item.ai4gp}</TableCell>
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
                        Formal Data Protection Impact Assessment (DPIA) documentation is required for all three services before deployment. DPO sign-off mandatory.
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
                      Comprehensive DPIA completed covering all processing activities:
                    </p>
                    <ul className="text-sm space-y-1 ml-4 list-disc text-muted-foreground">
                      <li>Meeting Manager (audio recording & transcription)</li>
                      <li>GP Scribe (clinical consultation notes)</li>
                      <li>Complaints Management System</li>
                    </ul>
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
              <div className="space-y-2">
                {preDeploymentChecklist.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      {item.status === 'COMPLETE' ? (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      ) : item.status === 'PARTIAL' ? (
                        <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{item.item}</p>
                        <p className="text-sm text-muted-foreground">Owner: {item.owner}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">{item.targetDate}</span>
                      {getStatusBadge(item.status)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid md:grid-cols-3 gap-4">
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {preDeploymentChecklist.filter(i => i.status === 'COMPLETE').length}
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-400">Completed</div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                    {preDeploymentChecklist.filter(i => i.status === 'PARTIAL').length}
                  </div>
                  <div className="text-sm text-yellow-700 dark:text-yellow-400">In Progress</div>
                </div>
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {preDeploymentChecklist.filter(i => i.status === 'OUTSTANDING').length}
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-400">Outstanding</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Recommendations */}
        <section id="recommendations" className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <TrendingUp className="w-6 h-6" />
                Recommendations
              </CardTitle>
              <CardDescription>Prioritised actions for successful NHS deployment</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="immediate" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="immediate">Immediate (Before Deployment)</TabsTrigger>
                  <TabsTrigger value="short">Short-Term (3 Months)</TabsTrigger>
                  <TabsTrigger value="long">Long-Term (12 Months)</TabsTrigger>
                </TabsList>

                <TabsContent value="immediate" className="mt-6">
                  <div className="space-y-3">
                    {recommendations.immediate.map((rec, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                        <AlertTriangle className="w-5 h-5 text-red-700 dark:text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-900 dark:text-red-300">{rec}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="short" className="mt-6">
                  <div className="space-y-3">
                    {recommendations.shortTerm.map((rec, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900">
                        <Clock className="w-5 h-5 text-yellow-700 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-yellow-900 dark:text-yellow-300">{rec}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="long" className="mt-6">
                  <div className="space-y-3">
                    {recommendations.longTerm.map((rec, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                        <TrendingUp className="w-5 h-5 text-blue-700 dark:text-blue-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-900 dark:text-blue-300">{rec}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
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
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>DCB0129 Clinical Safety Case completed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Full Hazard Log maintained</span>
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
                    "UK-only hosting and data storage",
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

              {/* 4. Technical Security Posture */}
              <div>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  4. Technical Security Posture
                </h3>
                
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="hosting">
                    <AccordionTrigger className="text-base font-semibold">Hosting & Infrastructure</AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2 ml-4">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>UK-only cloud infrastructure</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>No public inbound services beyond HTTPS</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>TLS enforced edge-to-end</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Segregated databases per tenant organisation via RLS</span>
                        </li>
                      </ul>
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
                          <span>Optional MFA</span>
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
                      </ul>
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
                          Fully met
                        </Badge>
                      </TableCell>
                      <TableCell>MHRA Class I, DCB0129</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Data Protection</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Fully met
                        </Badge>
                      </TableCell>
                      <TableCell>DPIA, UK-only hosting</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Technical Security</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Fully met (proportionate)
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
                    { name: "Cyber Essentials (in progress) documents", link: null, isDownload: false },
                    { name: "Data Flow Diagram & Architecture Summary", link: "/data-flow-architecture", isDownload: false }
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
                      <h4 className="font-semibold mb-2">Platform Security Certifications</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        NoteWell is built on the Lovable platform, which maintains ISO 27001 and SOC 2 Type II compliance. 
                        View full security documentation, compliance reports, and audit certificates:
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
                    NoteWell AI is a <strong>low-risk, MHRA Class I medical device</strong> designed for safe deployment across primary care. 
                    It meets all applicable DTAC domains, has completed its DPIA and clinical safety case (with CSO assessment complete and formal signoff in progress), 
                    and maintains UK-only hosting, strong encryption (100+ RLS policies, 73% security improvement achieved), full audit logs, and CREST-standard 
                    penetration testing scheduled for Q2 2025.
                  </p>
                  <p className="text-base leading-relaxed mt-4">
                    The tool involves <strong>no EMIS/S1 write-back</strong>, uses strict human-in-the-loop validation, and is suitable for 
                    pilot and scaled use in <strong>GP practices, PCNs and Neighbourhood teams</strong>.
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
                <CardTitle className="text-xl flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Clinical Safety Officer Sign-Off
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div>
                    <span className="font-semibold">System Safety Classification:</span>
                    <p className="text-sm text-muted-foreground mt-1">Class I Medical Device Software (UK MDR 2002) - Confirmed 19th November 2025</p>
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
                <CardTitle className="text-xl flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Data Protection Officer Sign-Off
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
    </div>
  );
};

export default CSOReport;
