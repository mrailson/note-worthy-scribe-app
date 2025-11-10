import { useState } from "react";
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
  ArrowUp
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
            <div><span className="font-semibold">Version:</span> 1.0</div>
            <div><span className="font-semibold">Date:</span> {new Date().toLocaleDateString('en-GB')}</div>
            <div><span className="font-semibold">Status:</span> <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">DRAFT FOR REVIEW</Badge></div>
            <div><span className="font-semibold">Initial Classification:</span> Non MHRA Medical Device with a view to MHRA Class 1 Medical Device</div>
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

              <div className="mt-6 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-700 dark:text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-orange-900 dark:text-orange-300 mb-1">Action Required</h4>
                    <p className="text-sm text-orange-800 dark:text-orange-400">
                      Formal Data Protection Impact Assessment (DPIA) documentation is required for all three services before deployment. DPO sign-off mandatory.
                    </p>
                  </div>
                </div>
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
                    <div>
                      <h4 className="font-semibold text-orange-900 dark:text-orange-300 mb-1">Critical Security Actions</h4>
                      <ul className="text-sm text-orange-800 dark:text-orange-400 space-y-1 mt-2">
                        <li>• Complete comprehensive security audit and address all identified warnings</li>
                        <li>• Implement security scanning as part of CI/CD pipeline</li>
                        <li>• Conduct penetration testing (minimum annual schedule)</li>
                        <li>• Establish vulnerability disclosure process</li>
                        <li>• Develop and test security incident response plan</li>
                        <li>• Document and verify all system navigation and access control paths</li>
                      </ul>
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
                    <p className="text-sm text-muted-foreground mt-1">Class I Medical Device Software (under UK MDR 2002) - Applied for 9th November 2025</p>
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
