import React, { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Users,
  Globe,
  Lock,
  Eye,
  Download,
  ExternalLink,
  Info,
  TrendingDown,
  Clock,
  MapPin,
  Server,
  AlertCircle,
} from "lucide-react";
import { calculateRiskScores, getRiskLevel, formatLikelihood, formatSeverity, calculateRiskStatistics } from "@/utils/dpiaRiskMatrix";
import type { Risk } from "@/utils/dpiaRiskMatrix";

// Sample risk data - in production this would come from a database
const risks: Risk[] = [
  {
    id: "risk-1",
    title: "Unauthorised Access to Patient Records",
    description: "Malicious actor or unauthorised staff member gains access to patient identifiable health data",
    inherentLikelihood: "high",
    inherentSeverity: "very_high",
    residualLikelihood: "medium",
    residualSeverity: "high",
    controls: ["RLS policies", "RBAC", "MFA", "Audit logging", "IP anomaly detection"],
    additionalMeasures: ["Biometric auth for high-risk roles (Q1 2026)", "UEBA deployment (Q2 2026)"],
    responsibility: "IT Security Manager",
    timeline: "Q1-Q2 2026"
  },
  {
    id: "risk-2",
    title: "Third-Party Processor Compromise",
    description: "Third-party processor suffers security breach exposing patient data",
    inherentLikelihood: "medium",
    inherentSeverity: "very_high",
    residualLikelihood: "low",
    residualSeverity: "high",
    controls: ["ISO 27001 certified processors", "UK data residency", "DPAs executed", "Zero-day retention"],
    additionalMeasures: ["Migrate EmailJS to UK service (Q1 2026)", "Annual audit reviews"],
    responsibility: "DPO",
    timeline: "Q1 2026"
  },
  {
    id: "risk-3",
    title: "AI-Generated Clinical Errors",
    description: "AI provides inaccurate translation or prescribing guidance leading to patient harm",
    inherentLikelihood: "medium",
    inherentSeverity: "very_high",
    residualLikelihood: "low",
    residualSeverity: "very_high",
    controls: ["Human-in-the-loop mandatory", "AI disclaimers", "Clinical Safety Case", "Incident reporting"],
    additionalMeasures: ["Clinical reference group (Q4 2025)", "Automated QA for high-risk meds (Q1 2026)"],
    responsibility: "Clinical Safety Officer",
    timeline: "Q4 2025 - Q1 2026"
  },
];

const DPIA: React.FC = () => {
  const [activeTab, setActiveTab] = useState("overview");

  const riskStats = calculateRiskStatistics(risks);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Data Protection Impact Assessment (DPIA)
              </h1>
              <p className="text-muted-foreground mt-1">
                PCN Services Ltd - Integrated Care Management Platform
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <Badge variant="outline" className="text-sm">
              <FileText className="h-3 w-3 mr-1" />
              Version 1.0
            </Badge>
            <Badge variant="outline" className="text-sm">
              <Clock className="h-3 w-3 mr-1" />
              17th November 2025
            </Badge>
            <Badge variant="secondary" className="text-sm">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              UK GDPR Article 35 Compliant
            </Badge>
            <Badge variant="secondary" className="text-sm">
              <Shield className="h-3 w-3 mr-1" />
              NHS DSPT Aligned
            </Badge>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Classification: Official - Sensitive</AlertTitle>
            <AlertDescription>
              This DPIA contains confidential security and privacy information. Distribution limited to authorised stakeholders only.
              Next review: 17th November 2026
            </AlertDescription>
          </Alert>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="risks">Risk Assessment</TabsTrigger>
            <TabsTrigger value="processors">Processors</TabsTrigger>
            <TabsTrigger value="transfers">Int'l Transfers</TabsTrigger>
            <TabsTrigger value="rights">Data Subject Rights</TabsTrigger>
            <TabsTrigger value="approval">Sign-Off</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Executive Summary</CardTitle>
                <CardDescription>
                  High-level assessment of data protection impact and compliance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Necessity Justification */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-primary" />
                    DPIA Necessity
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    This DPIA is <strong>mandatory</strong> under UK GDPR Article 35 as the processing involves:
                  </p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                      <div>
                        <p className="font-medium">Systematic &amp; Extensive Profiling</p>
                        <p className="text-sm text-muted-foreground">AI-driven clinical decision support</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                      <div>
                        <p className="font-medium">Large-scale Special Category Data</p>
                        <p className="text-sm text-muted-foreground">Patient health records processing</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                      <div>
                        <p className="font-medium">Systematic Monitoring</p>
                        <p className="text-sm text-muted-foreground">Continuous audit logging</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                      <div>
                        <p className="font-medium">Innovative Technology</p>
                        <p className="text-sm text-muted-foreground">AI/ML for medical translation</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Data Controller Details */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Data Controller Details
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Organisation</p>
                      <p className="text-base">PCN Services Ltd</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">ICO Registration Number</p>
                      <p className="text-base font-semibold">ZB226324</p>
                      <p className="text-sm text-muted-foreground">Expires: 03/10/2026</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Address</p>
                      <p className="text-base">Ground Floor, 2 Woodberry Grove</p>
                      <p className="text-base">London, N12 0DR</p>
                      <p className="text-base">United Kingdom</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Contact Details</p>
                      <p className="text-base">malcolm.railson@nhs.net</p>
                      <p className="text-base">07740812180</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Data Protection Officer</p>
                      <p className="text-base">dpo@gpnotewell.co.uk</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Caldicott Guardian</p>
                      <p className="text-base">[Medical Director Name]</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Processing Scope */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Processing Scope
                  </h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Data Subjects</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">50,000+</p>
                        <p className="text-sm text-muted-foreground">Patients per annum</p>
                        <p className="text-sm text-muted-foreground mt-1">200+ Healthcare staff</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Modules</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">8</p>
                        <p className="text-sm text-muted-foreground">Major processing modules</p>
                        <p className="text-sm text-muted-foreground mt-1">40+ distinct operations</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Processors</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">4</p>
                        <p className="text-sm text-muted-foreground">Third-party processors</p>
                        <p className="text-sm text-muted-foreground mt-1">All DPAs executed</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Separator />

                {/* Risk Summary */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-primary" />
                    Overall Risk Rating
                  </h3>
                  <Alert className="bg-success/10 border-success">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <AlertTitle className="text-success">Residual Risk: MEDIUM (Acceptable)</AlertTitle>
                    <AlertDescription>
                      Comprehensive technical and organisational measures reduce residual risks to acceptable levels.
                      {riskStats.percentages.critical === 0 && riskStats.percentages.high === 0 && (
                        <span className="font-medium"> No critical or high residual risks identified.</span>
                      )}
                    </AlertDescription>
                  </Alert>

                  <div className="grid md:grid-cols-4 gap-3 mt-4">
                    <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Low Risk</p>
                      <p className="text-2xl font-bold text-success">{riskStats.riskLevelCounts.low}</p>
                      <p className="text-xs text-muted-foreground">{riskStats.percentages.low.toFixed(0)}% of risks</p>
                    </div>
                    <div className="p-4 bg-warning/10 rounded-lg border border-warning/20">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Medium Risk</p>
                      <p className="text-2xl font-bold text-warning">{riskStats.riskLevelCounts.medium}</p>
                      <p className="text-xs text-muted-foreground">{riskStats.percentages.medium.toFixed(0)}% of risks</p>
                    </div>
                    <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                      <p className="text-sm font-medium text-muted-foreground mb-1">High Risk</p>
                      <p className="text-2xl font-bold text-destructive">{riskStats.riskLevelCounts.high}</p>
                      <p className="text-xs text-muted-foreground">{riskStats.percentages.high.toFixed(0)}% of risks</p>
                    </div>
                    <div className="p-4 bg-destructive/20 rounded-lg border border-destructive">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Critical Risk</p>
                      <p className="text-2xl font-bold text-destructive">{riskStats.riskLevelCounts.critical}</p>
                      <p className="text-xs text-muted-foreground">{riskStats.percentages.critical.toFixed(0)}% of risks</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Legal Basis */}
            <Card>
              <CardHeader>
                <CardTitle>Legal Basis for Processing</CardTitle>
                <CardDescription>UK GDPR Article 6 and Article 9 compliance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Patient Data Processing</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">Article 6(1)(e)</span> - Public task in the exercise of official authority
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">Article 9(2)(h)</span> - Health or social care purposes (provision of healthcare, medical diagnosis)
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">Health and Social Care Act 2012</span> - NHS service provision obligations
                      </div>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Staff Data Processing</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">Article 6(1)(b)</span> - Necessary for employment contract performance
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">Article 6(1)(c)</span> - Legal obligation (employment law compliance)
                      </div>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Related Documentation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Related Documentation
                </CardTitle>
                <CardDescription>Supporting compliance and safety documentation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-3">
                  <a href="/cso-report" className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                    <Shield className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Clinical Safety Case Report</p>
                      <p className="text-sm text-muted-foreground">DCB0129 compliance</p>
                    </div>
                    <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                  </a>
                  <a href="/data-flow-architecture" className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                    <Server className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Data Flow Architecture</p>
                      <p className="text-sm text-muted-foreground">System diagrams</p>
                    </div>
                    <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                  </a>
                  <a href="/privacy-policy" className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                    <Lock className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Privacy Policy</p>
                      <p className="text-sm text-muted-foreground">Data subject information</p>
                    </div>
                    <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                  </a>
                  <a href="/hazard-log" className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                    <AlertTriangle className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Hazard Log</p>
                      <p className="text-sm text-muted-foreground">Clinical safety hazards</p>
                    </div>
                    <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                  </a>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Risk Assessment Tab */}
          <TabsContent value="risks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Privacy Risk Register</CardTitle>
                <CardDescription>
                  Comprehensive assessment of privacy risks with inherent and residual ratings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {risks.map(risk => {
                      const scores = calculateRiskScores(risk);
                      return (
                        <Card key={risk.id} className="border-l-4" style={{ borderLeftColor: `hsl(var(--${scores.residualLevel === 'low' ? 'success' : scores.residualLevel === 'medium' ? 'warning' : 'destructive'}))` }}>
                          <CardHeader>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <CardTitle className="text-lg">{risk.title}</CardTitle>
                                <CardDescription className="mt-2">{risk.description}</CardDescription>
                              </div>
                              <Badge variant={scores.residualLevel === 'low' ? 'secondary' : scores.residualLevel === 'medium' ? 'default' : 'destructive'} className="flex-shrink-0">
                                {scores.residualLevel.toUpperCase()}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Risk Scores */}
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="p-3 bg-muted/50 rounded-lg">
                                <p className="text-sm font-medium text-muted-foreground mb-2">Inherent Risk</p>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm">Likelihood:</span>
                                  <Badge variant="outline">{formatLikelihood(risk.inherentLikelihood)}</Badge>
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm">Severity:</span>
                                  <Badge variant="outline">{formatSeverity(risk.inherentSeverity)}</Badge>
                                </div>
                                <p className="text-2xl font-bold">{scores.inherentScore} / 25</p>
                                <p className="text-sm text-muted-foreground">Risk Score</p>
                              </div>
                              <div className="p-3 bg-success/10 rounded-lg border border-success/20">
                                <p className="text-sm font-medium text-muted-foreground mb-2">Residual Risk</p>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm">Likelihood:</span>
                                  <Badge variant="outline">{formatLikelihood(risk.residualLikelihood)}</Badge>
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm">Severity:</span>
                                  <Badge variant="outline">{formatSeverity(risk.residualSeverity)}</Badge>
                                </div>
                                <p className="text-2xl font-bold text-success">{scores.residualScore} / 25</p>
                                <p className="text-sm text-muted-foreground">Risk Score</p>
                              </div>
                            </div>

                            <Separator />

                            {/* Controls */}
                            <div>
                              <p className="font-semibold mb-2 flex items-center gap-2">
                                <Shield className="h-4 w-4 text-primary" />
                                Current Controls
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {risk.controls.map((control, idx) => (
                                  <Badge key={idx} variant="secondary">
                                    {control}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            {/* Additional Measures */}
                            {risk.additionalMeasures.length > 0 && (
                              <>
                                <Separator />
                                <div>
                                  <p className="font-semibold mb-2 flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-warning" />
                                    Additional Measures Required
                                  </p>
                                  <ul className="space-y-1">
                                    {risk.additionalMeasures.map((measure, idx) => (
                                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                        <span className="text-primary mt-1">•</span>
                                        <span>{measure}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </>
                            )}

                            {/* Responsibility & Timeline */}
                            <div className="grid md:grid-cols-2 gap-4 pt-2">
                              <div className="flex items-center gap-2 text-sm">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Responsibility:</span>
                                <span className="font-medium">{risk.responsibility}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Timeline:</span>
                                <span className="font-medium">{risk.timeline}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Third-Party Processors Tab */}
          <TabsContent value="processors" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Third-Party Data Processor Assessment</CardTitle>
                <CardDescription>Due diligence and risk assessment for all processors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Supabase */}
                <div className="border rounded-lg p-4 bg-success/5 border-success/20">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Server className="h-5 w-5 text-primary" />
                        Supabase
                      </h3>
                      <p className="text-sm text-muted-foreground">Database & Infrastructure Provider</p>
                    </div>
                    <Badge variant="secondary" className="bg-success/20 text-success">LOW RISK</Badge>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Location</p>
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        United Kingdom (London data centre)
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Certifications</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline">ISO 27001</Badge>
                        <Badge variant="outline">SOC 2 Type II</Badge>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Data Processed</p>
                      <p className="text-sm">All platform data (patient records, staff data, audit logs)</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">DPA Status</p>
                      <p className="flex items-center gap-2 text-success">
                        <CheckCircle2 className="h-4 w-4" />
                        UK GDPR-compliant DPA executed
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-2"><strong>Security Measures:</strong></p>
                  <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                    <li>• AES-256 encryption at rest, TLS 1.3 in transit</li>
                    <li>• Row Level Security (RLS) policies enforced</li>
                    <li>• Automated daily backups with 30-day retention</li>
                    <li>• 24/7 security operations centre</li>
                  </ul>

                  <p className="text-sm"><strong>Conclusion:</strong> Established provider with strong security posture. UK data residency eliminates international transfer concerns.</p>
                </div>

                {/* OpenAI */}
                <div className="border rounded-lg p-4 bg-warning/5 border-warning/20">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        OpenAI
                      </h3>
                      <p className="text-sm text-muted-foreground">AI Content Generation Provider</p>
                    </div>
                    <Badge variant="default" className="bg-warning/20 text-warning">MEDIUM RISK</Badge>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Location</p>
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        United States
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Certifications</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline">SOC 2 Type II</Badge>
                        <Badge variant="outline">ISO 27001</Badge>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Data Processed</p>
                      <p className="text-sm">Anonymised clinical queries (no patient identifiers)</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Transfer Mechanism</p>
                      <p className="text-sm">UK IDTA + Standard Contractual Clauses</p>
                    </div>
                  </div>

                  <Alert className="mb-4">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>Zero-day retention policy:</strong> API calls not used to train models, no customer data stored
                    </AlertDescription>
                  </Alert>

                  <p className="text-sm text-muted-foreground mb-2"><strong>Risk Mitigation:</strong></p>
                  <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                    <li>• Patient identifiers removed before API calls (anonymised)</li>
                    <li>• Clinical oversight required (human-in-the-loop)</li>
                    <li>• Zero-day retention means no data for US government to access</li>
                    <li>• All AI outputs flagged with disclaimer</li>
                  </ul>

                  <p className="text-sm"><strong>Conclusion:</strong> International transfer to non-adequate jurisdiction mitigated by anonymisation and zero-day retention. Clinical validation required.</p>
                </div>

                {/* ElevenLabs */}
                <div className="border rounded-lg p-4 bg-success/5 border-success/20">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        ElevenLabs
                      </h3>
                      <p className="text-sm text-muted-foreground">Voice Synthesis Provider</p>
                    </div>
                    <Badge variant="secondary" className="bg-success/20 text-success">LOW RISK</Badge>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Location</p>
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        United States / Europe
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Data Processed</p>
                      <p className="text-sm">Text for voice synthesis (no patient identifiers)</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Data Retention</p>
                      <p className="text-sm">Transient processing only</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Use Case</p>
                      <p className="text-sm">Non-clinical (UI/UX enhancement)</p>
                    </div>
                  </div>

                  <p className="text-sm"><strong>Conclusion:</strong> Low risk given transient processing, non-clinical use case, and absence of patient identifiable data.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* International Transfers Tab */}
          <TabsContent value="transfers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>International Data Transfers</CardTitle>
                <CardDescription>Transfer Impact Assessments for non-UK processors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <Globe className="h-4 w-4" />
                  <AlertTitle>Transfer Mechanisms</AlertTitle>
                  <AlertDescription>
                    All international transfers protected by UK International Data Transfer Agreement (IDTA) or Standard Contractual Clauses (SCCs) with supplementary measures.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">OpenAI - United States Transfer</h3>
                    <div className="space-y-3">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Legal Framework Risk</p>
                          <p className="text-sm">US CLOUD Act permits government data access</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Data Sensitivity</p>
                          <Badge variant="secondary" className="bg-success/20 text-success">LOW (Anonymised)</Badge>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-sm font-semibold mb-2">Supplementary Measures:</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                            <span><strong>Technical:</strong> Data anonymisation (no patient identifiers), TLS 1.3 encryption</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                            <span><strong>Contractual:</strong> Zero-day retention (no data for US govt to access), prohibition on third-party disclosure</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                            <span><strong>Organisational:</strong> Clinical oversight mandatory, regular security audits</span>
                          </li>
                        </ul>
                      </div>
                      <Alert className="bg-success/10 border-success">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <AlertDescription className="text-sm">
                          <strong>Conclusion:</strong> Transfer permissible. Anonymisation and zero-day retention substantially reduce risks.
                        </AlertDescription>
                      </Alert>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">ElevenLabs - US/Europe Transfer</h3>
                    <div className="space-y-3">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Government Access Risk</p>
                          <Badge variant="secondary" className="bg-success/20 text-success">LOW-MEDIUM</Badge>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Data Type</p>
                          <p className="text-sm">Text-only (generic medical instructions)</p>
                        </div>
                      </div>
                      <Alert className="bg-success/10 border-success">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <AlertDescription className="text-sm">
                          <strong>Conclusion:</strong> Transfer permissible. Low risk given data minimisation and non-clinical use.
                        </AlertDescription>
                      </Alert>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Eye className="h-5 w-5 text-primary" />
                    Ongoing Transfer Monitoring
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Annual Transfer Impact Assessment (TIA) review for each processor</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Monitor EU/UK adequacy decisions and US privacy law changes</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Any change in processor location or sub-processors triggers TIA update</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Data subject mechanism to raise concerns about international transfers</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Subject Rights Tab */}
          <TabsContent value="rights" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Data Subject Rights Implementation</CardTitle>
                <CardDescription>Procedures for handling UK GDPR rights requests</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Eye className="h-4 w-4 text-primary" />
                        Right of Access (SARs)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <p><strong>Timeline:</strong> 1 month (extendable to 2 months if complex)</p>
                      <p><strong>Fee:</strong> Free (unless manifestly unfounded)</p>
                      <p className="text-muted-foreground">Identity verification required. All personal data extracted and provided in electronic format.</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        Right to Rectification
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <p><strong>Timeline:</strong> 1 month</p>
                      <p><strong>Fee:</strong> Free</p>
                      <p className="text-muted-foreground">Clinical record corrections require clinician approval. Historical versions retained with audit trail.</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-primary" />
                        Right to Erasure
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <p><strong>Timeline:</strong> 1 month</p>
                      <p><strong>Fee:</strong> Free</p>
                      <p className="text-muted-foreground">Exemptions apply for legal obligations (e.g., NHS 10-year retention for patient records).</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Lock className="h-4 w-4 text-primary" />
                        Right to Restriction
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <p><strong>Timeline:</strong> 1 month</p>
                      <p><strong>Fee:</strong> Free</p>
                      <p className="text-muted-foreground">Data flagged as "restricted" (storage only) during accuracy disputes or legal claims.</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Download className="h-4 w-4 text-primary" />
                        Right to Data Portability
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <p><strong>Timeline:</strong> 1 month</p>
                      <p><strong>Fee:</strong> Free</p>
                      <p className="text-muted-foreground">Personal data provided in commonly used electronic format (JSON, CSV, XML).</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-primary" />
                        Right to Object
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <p><strong>Timeline:</strong> 1 month</p>
                      <p><strong>Fee:</strong> Free</p>
                      <p className="text-muted-foreground">Processing ceased unless overriding legitimate grounds demonstrated (e.g., clinical governance).</p>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3">Automated Decision-Making (GDPR Article 22)</h3>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>No Solely Automated Decisions</AlertTitle>
                    <AlertDescription className="space-y-2 text-sm">
                      <p>The platform does NOT make solely automated decisions. All AI-assisted processes require human oversight:</p>
                      <ul className="mt-2 space-y-1">
                        <li>• <strong>AI4GP clinical support:</strong> Human-in-the-loop mandatory, clinician makes final decision</li>
                        <li>• <strong>Complaint triage:</strong> Manual review and assignment by staff</li>
                        <li>• <strong>Prescribing policy checks:</strong> Automated flagging only, clinician decides</li>
                      </ul>
                      <p className="mt-3">Data subjects have the right to human intervention, explanation of AI rationale, and ability to contest AI outputs.</p>
                    </AlertDescription>
                  </Alert>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3">Contact for Rights Requests</h3>
                  <Card className="bg-muted/50">
                    <CardContent className="pt-6">
                      <p className="text-sm mb-2"><strong>Data Protection Officer (DPO)</strong></p>
                      <p className="text-sm text-muted-foreground">Email: dpo@gpnotewell.co.uk</p>
                      <p className="text-sm text-muted-foreground">Address: PCN Services Ltd, [Practice Address]</p>
                      <p className="text-sm text-muted-foreground mt-3">All rights requests will be acknowledged within 3 working days and responded to within 1 month.</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sign-Off Tab */}
          <TabsContent value="approval" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>DPIA Approval and Sign-Off</CardTitle>
                <CardDescription>Required approvals before platform deployment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Approval Status: Awaiting Sign-Off</AlertTitle>
                  <AlertDescription>
                    This DPIA requires approval from the following stakeholders before deployment can proceed.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  {[
                    { role: "Data Protection Officer", status: "pending" },
                    { role: "Senior Information Risk Owner (SIRO)", status: "pending" },
                    { role: "Caldicott Guardian", status: "pending" },
                    { role: "Clinical Safety Officer", status: "pending" },
                    { role: "Information Governance Lead", status: "pending" },
                    { role: "Chief Technology Officer", status: "pending" },
                    { role: "Medical Director", status: "pending" },
                    { role: "ICB Data Protection Lead", status: "pending" },
                  ].map((approver, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{approver.role}</p>
                          <p className="text-sm text-muted-foreground">[Name] - [Organisation]</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-warning/10 text-warning">
                        Pending
                      </Badge>
                    </div>
                  ))}
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3">Conditions of Approval</h3>
                  <p className="text-sm text-muted-foreground mb-3">Approval is conditional upon:</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <span>Migration to UK-based email service (Q1 2026)</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <span>Penetration testing by CREST-accredited provider (Q1 2026)</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <span>Staff data protection training &gt;95% completion (prior to go-live)</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <span>Patient information materials finalised and published (prior to go-live)</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <span>Quarterly Privacy Steering Group meetings</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <span>Annual DPIA review (or upon material changes)</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3">DPO Recommendation</h3>
                  <Alert className="bg-success/10 border-success">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <AlertTitle className="text-success">APPROVE DEPLOYMENT (with conditions)</AlertTitle>
                    <AlertDescription>
                      This DPIA demonstrates thorough privacy risk analysis. Residual risks reduced to acceptable levels through comprehensive technical and organisational measures. Platform suitable for NHS deployment subject to completion of outstanding actions and ongoing monitoring.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Next Review</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  <Clock className="h-6 w-6 text-primary" />
                  <div>
                    <p className="font-semibold">Scheduled Review Date</p>
                    <p className="text-sm text-muted-foreground">17th November 2026 (or upon material changes)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>Full DPIA documentation available in project reports</span>
              </div>
              <a
                href="/reports/Data_Protection_Impact_Assessment.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download Full DPIA
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DPIA;
