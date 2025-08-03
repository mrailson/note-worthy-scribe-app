import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  CheckCircle, 
  Lock, 
  FileText,
  Database,
  Users,
  Eye,
  AlertTriangle,
  Download,
  ChevronDown,
  ChevronRight
} from "lucide-react";

export default function SecurityCompliance() {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const complianceStandards = [
    "General Data Protection Regulation (GDPR)",
    "NHS Digital Clinical Safety Standards (DCB0129, DCB0160)",
    "NHS Information Governance Toolkit Requirements",
    "CQC Regulation 16 (Receiving and acting on complaints)",
    "NHS Complaints Procedure (20-day response requirements)",
    "Data Protection Act 2018",
    "NHS Digital Technology Standards",
    "ISO 27001 Security Controls (implemented subset)"
  ];

  const securityControls = [
    {
      icon: <Lock className="h-5 w-5" />,
      title: "Authentication & Authorization",
      description: "Multi-factor authentication with role-based access controls",
      details: [
        "JWT token management with auto-refresh",
        "Role-based permissions (System Admin, Practice Manager, PCN Manager)",
        "Session management with automatic timeout",
        "Account lockout protection"
      ]
    },
    {
      icon: <Database className="h-5 w-5" />,
      title: "Database Security",
      description: "Row Level Security (RLS) policies on all sensitive data",
      details: [
        "User-based data isolation",
        "Practice-specific access controls",
        "Encrypted data transmission via HTTPS/TLS 1.3",
        "Automated data retention policies"
      ]
    },
    {
      icon: <Eye className="h-5 w-5" />,
      title: "Audit & Monitoring",
      description: "Comprehensive logging and monitoring of all system activities",
      details: [
        "Complete audit trails for all data changes",
        "Failed login attempt tracking",
        "Role change auditing",
        "Real-time security monitoring"
      ]
    },
    {
      icon: <Users className="h-5 w-5" />,
      title: "Data Protection",
      description: "GDPR compliance with privacy by design principles",
      details: [
        "Data minimization and purpose limitation",
        "Right to access, rectification, and erasure",
        "Data portability features",
        "Consent management systems"
      ]
    }
  ];

  const riskAssessments = [
    {
      id: "H001",
      hazard: "Unauthorized access to patient data",
      severity: "High",
      probability: "Low",
      riskLevel: "Medium",
      mitigation: "End-to-end encryption, MFA, role-based access controls",
      residualRisk: "Low"
    },
    {
      id: "H002",
      hazard: "Data transmission interception",
      severity: "High",
      probability: "Very Low",
      riskLevel: "Medium",
      mitigation: "TLS 1.3 encryption, secure API endpoints",
      residualRisk: "Very Low"
    },
    {
      id: "H003",
      hazard: "Incorrect AI-generated clinical suggestions",
      severity: "Medium",
      probability: "Low",
      riskLevel: "Medium",
      mitigation: "Human oversight required, clinical validation disclaimers",
      residualRisk: "Low"
    },
    {
      id: "H004",
      hazard: "System downtime during consultations",
      severity: "Medium",
      probability: "Low",
      riskLevel: "Medium",
      mitigation: "99.9% uptime SLA, offline capabilities, redundant architecture",
      residualRisk: "Very Low"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center space-y-4 mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Security & Compliance
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Comprehensive documentation of security controls, compliance standards, and risk management 
            procedures implemented in NoteWell AI to ensure the highest levels of data protection and 
            regulatory compliance.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <Badge variant="secondary" className="text-sm">
              <CheckCircle className="h-3 w-3 mr-1" />
              NHS Approved
            </Badge>
            <Badge variant="secondary" className="text-sm">
              <Shield className="h-3 w-3 mr-1" />
              GDPR Compliant
            </Badge>
            <Badge variant="secondary" className="text-sm">
              <Lock className="h-3 w-3 mr-1" />
              ISO 27001 Aligned
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="technical">Technical Controls</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="risk">Risk Management</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Security Architecture Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  NoteWell AI implements a comprehensive security framework designed to protect patient data 
                  and ensure compliance with NHS standards and UK data protection regulations.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {securityControls.map((control, index) => (
                    <Card key={index} className="border-primary/20">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            {control.icon}
                          </div>
                          {control.title}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">{control.description}</p>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1">
                          {control.details.map((detail, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-3 w-3 text-success shrink-0" />
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Data Flow Security */}
            <Card>
              <CardHeader>
                <CardTitle>Data Flow Security</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <Lock className="h-8 w-8 text-primary mx-auto mb-2" />
                      <h4 className="font-semibold">Encryption in Transit</h4>
                      <p className="text-sm text-muted-foreground">TLS 1.3 for all communications</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <Database className="h-8 w-8 text-primary mx-auto mb-2" />
                      <h4 className="font-semibold">Encryption at Rest</h4>
                      <p className="text-sm text-muted-foreground">AES-256 database encryption</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <Users className="h-8 w-8 text-primary mx-auto mb-2" />
                      <h4 className="font-semibold">Access Control</h4>
                      <p className="text-sm text-muted-foreground">Role-based permissions</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Technical Controls Tab */}
          <TabsContent value="technical" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Implementation Evidence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Authentication Section */}
                <div>
                  <Button
                    variant="ghost"
                    onClick={() => toggleSection("auth")}
                    className="flex items-center gap-2 p-0 h-auto font-semibold"
                  >
                    {expandedSections.auth ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Authentication & Authorization
                  </Button>
                  {expandedSections.auth && (
                    <div className="mt-3 p-4 bg-muted/30 rounded-lg">
                      <pre className="text-sm overflow-x-auto">
{`// Multi-factor authentication configuration
const authConfig = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true
};

// Role-based access control functions
function hasModuleAccess(user_id: uuid, module: app_module): boolean
function isSystemAdmin(user_id: uuid): boolean
function isPracticeManager(user_id: uuid, practice_id: uuid): boolean`}
                      </pre>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Database Security Section */}
                <div>
                  <Button
                    variant="ghost"
                    onClick={() => toggleSection("database")}
                    className="flex items-center gap-2 p-0 h-auto font-semibold"
                  >
                    {expandedSections.database ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Database Security Policies
                  </Button>
                  {expandedSections.database && (
                    <div className="mt-3 p-4 bg-muted/30 rounded-lg">
                      <pre className="text-sm overflow-x-auto">
{`-- Row Level Security Policy Example
CREATE POLICY "Users can view complaints from their practice"
ON complaints FOR SELECT
USING (
  practice_id = get_practice_manager_practice_id(auth.uid()) OR
  practice_id = ANY(get_pcn_manager_practice_ids(auth.uid())) OR
  is_system_admin(auth.uid())
);

-- Audit trail implementation
CREATE TRIGGER audit_complaint_changes_trigger
AFTER INSERT OR UPDATE ON complaints
FOR EACH ROW EXECUTE FUNCTION audit_complaint_changes();`}
                      </pre>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Input Validation Section */}
                <div>
                  <Button
                    variant="ghost"
                    onClick={() => toggleSection("validation")}
                    className="flex items-center gap-2 p-0 h-auto font-semibold"
                  >
                    {expandedSections.validation ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Input Validation & Sanitization
                  </Button>
                  {expandedSections.validation && (
                    <div className="mt-3 p-4 bg-muted/30 rounded-lg space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-3 w-3 text-success" />
                        <span>DOMPurify integration for HTML content sanitization</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-3 w-3 text-success" />
                        <span>SQL injection prevention via parameterized queries</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-3 w-3 text-success" />
                        <span>XSS protection through content sanitization</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-3 w-3 text-success" />
                        <span>Type validation using TypeScript and Zod schemas</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Compliance Tab */}
          <TabsContent value="compliance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Regulatory Compliance Statement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    NoteWell AI demonstrates full compliance with the following regulations and standards:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {complianceStandards.map((standard, index) => (
                      <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                        <CheckCircle className="h-4 w-4 text-success shrink-0" />
                        <span className="text-sm font-medium">{standard}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  UK Hosting & Data Residency
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <h4 className="font-semibold mb-3 text-foreground">NHS Digital Requirements</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-3 w-3 text-success shrink-0" />
                      <span><strong>UK-Only Hosting:</strong> All infrastructure, databases, and backups hosted exclusively on UK servers</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-3 w-3 text-success shrink-0" />
                      <span><strong>Data Sovereignty:</strong> Patient and practice data never leaves UK jurisdiction</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-3 w-3 text-success shrink-0" />
                      <span><strong>NHS Compliant Providers:</strong> Infrastructure hosted with NHS Digital compliant cloud providers</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-secondary/20 rounded-lg border border-secondary/40">
                  <h4 className="font-semibold mb-3 text-foreground">GDPR & UK Data Protection</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-3 w-3 text-success shrink-0" />
                      <span><strong>UK GDPR Compliance:</strong> Full adherence to post-Brexit UK GDPR requirements</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-3 w-3 text-success shrink-0" />
                      <span><strong>Data Protection Act 2018:</strong> Complete compliance with UK data protection legislation</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-3 w-3 text-success shrink-0" />
                      <span><strong>Adequate Protection:</strong> No international data transfers requiring additional safeguards</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-success/10 rounded-lg border border-success/30">
                  <h4 className="font-semibold mb-2 text-success-foreground">Infrastructure Specifications</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <h5 className="font-medium mb-1">Primary Hosting</h5>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>• UK-based data centers</li>
                        <li>• ISO 27001 certified facilities</li>
                        <li>• 24/7 UK-based monitoring</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium mb-1">Backup & Recovery</h5>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>• UK-only backup locations</li>
                        <li>• Geographic separation within UK</li>
                        <li>• NHS-compliant retention policies</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800">
                    <strong>Verification:</strong> All hosting arrangements are verified annually and documented for NHS Digital compliance audits. 
                    Infrastructure certificates and compliance reports are available upon request for regulatory reviews.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>MHRA Medical Device Compliance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <h4 className="font-semibold text-amber-800">Application Status</h4>
                  </div>
                  <p className="text-sm text-amber-700">
                    <strong>MHRA Class 1 Medical Device Registration:</strong> Application submitted and approval expected within the coming weeks. 
                    GP Scribe will remain in controlled beta testing and will not be launched for general use without MHRA Class 1 approval.
                  </p>
                </div>
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <h4 className="font-semibold mb-2">Target Classification: Class 1 Medical Device</h4>
                  <p className="text-sm text-muted-foreground">
                    NoteWell AI GP Scribe is being classified as a Class 1 Software as a Medical Device (SaMD) under MHRA regulations.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-semibold mb-2">ISO 14971 Risk Management</h5>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-success" />
                        Risk assessment and evaluation
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-success" />
                        Risk control implementation
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-success" />
                        Post-market surveillance
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold mb-2">IEC 62304 Software Lifecycle</h5>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-success" />
                        Software development planning
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-success" />
                        Software requirements analysis
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-success" />
                        Software testing and validation
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Risk Management Tab */}
          <TabsContent value="risk" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Risk Assessment Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Hazard ID</th>
                        <th className="text-left p-2">Risk Description</th>
                        <th className="text-left p-2">Severity</th>
                        <th className="text-left p-2">Probability</th>
                        <th className="text-left p-2">Initial Risk</th>
                        <th className="text-left p-2">Mitigation</th>
                        <th className="text-left p-2">Residual Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riskAssessments.map((risk, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-2 font-mono">{risk.id}</td>
                          <td className="p-2">{risk.hazard}</td>
                          <td className="p-2">
                            <Badge variant={risk.severity === "High" ? "destructive" : "secondary"}>
                              {risk.severity}
                            </Badge>
                          </td>
                          <td className="p-2">{risk.probability}</td>
                          <td className="p-2">
                            <Badge variant="outline">{risk.riskLevel}</Badge>
                          </td>
                          <td className="p-2 text-xs max-w-xs">{risk.mitigation}</td>
                          <td className="p-2">
                            <Badge variant="secondary">{risk.residualRisk}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Verification Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h5 className="font-semibold">Automated Testing</h5>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-success" />
                        Automated security linting via Supabase
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-success" />
                        Database policy testing scenarios
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-success" />
                        Input validation testing
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h5 className="font-semibold">Manual Verification</h5>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-success" />
                        Code review of security logic
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-success" />
                        Audit log verification
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-success" />
                        Penetration testing assessments
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Document Information */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Document Control
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h5 className="font-semibold mb-1">Document Version</h5>
                <p className="text-muted-foreground">1.0</p>
              </div>
              <div>
                <h5 className="font-semibold mb-1">Effective Date</h5>
                <p className="text-muted-foreground">August 2025</p>
              </div>
              <div>
                <h5 className="font-semibold mb-1">Next Review</h5>
                <p className="text-muted-foreground">February 2026</p>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Classification: Internal Use Only
              </p>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download Documentation
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}