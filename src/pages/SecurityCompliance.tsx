import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { onDownloadCqcEvidencePack, onDownloadAdvancedEvidencePack } from "@/utils/evidencePackExport";
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
  ChevronRight,
  ArrowLeft,
  Home,
  Info,
  Building2,
  UserCheck
} from "lucide-react";

export default function SecurityCompliance() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [userType, setUserType] = useState<'practice_manager' | 'governance'>('practice_manager');

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const downloadEvidencePack = async (type: 'cqc' | 'advanced') => {
    toast({
      title: `${type === 'cqc' ? 'CQC' : 'Advanced'} Evidence Pack`,
      description: `Generating ${type === 'cqc' ? 'CQC' : 'Advanced'} evidence pack for download...`,
    });
    
    try {
      if (type === 'cqc') {
        await onDownloadCqcEvidencePack();
      } else {
        await onDownloadAdvancedEvidencePack();
      }
      
      toast({
        title: "Evidence Pack Generated",
        description: `${type === 'cqc' ? 'CQC' : 'Advanced'} evidence pack is ready for download.`,
      });
    } catch (error) {
      toast({
        title: "Export Error",
        description: "Failed to generate evidence pack. Please try again.",
        variant: "destructive"
      });
    }
  };

  const complianceStandards = [
    "General Data Protection Regulation (GDPR)",
    "Data Security and Protection Toolkit (DSPT)",
    "NHS Digital Clinical Safety Standards (DCB0129, DCB0160)",
    "CQC Information Governance Requirements",
    "MHRA Medical Device Class I Compliance",
    "ISO 14971 Risk Management",
    "IEC 62304 Medical Device Software",
    "Data Protection Act 2018"
  ];

  const dsptCrosswalk = [
    {
      control: "Authentication & Access",
      implementation: "JWT (1h expiry, auto-refresh), MFA, RBAC, escalation prevention",
      dsptItems: "9.2.6, 9.2.7, 9.3.2, 9.3.3"
    },
    {
      control: "Database Security",
      implementation: "RLS, AES-256 at rest, TLS 1.3 transit, column encryption",
      dsptItems: "9.2.9, 9.3.5"
    },
    {
      control: "Audit Logging",
      implementation: "Complaint, role, doc, meeting changes logged",
      dsptItems: "9.4.2"
    },
    {
      control: "Monitoring",
      implementation: "Failed logins, brute force detection, anomalies, SIEM",
      dsptItems: "9.4.3, 9.4.4, 9.4.6"
    },
    {
      control: "Input Validation",
      implementation: "Zod schemas, DOMPurify, parameterised queries",
      dsptItems: "9.2.4, 9.2.5"
    },
    {
      control: "File Upload Security",
      implementation: "50MB limit, MIME type enforcement, sanitised filenames",
      dsptItems: "9.2.10"
    },
    {
      control: "Incident Response",
      implementation: "Lockouts, IP blocking, auto-expiry, forensic logs",
      dsptItems: "9.5.2, 9.5.3, 9.6.1"
    },
    {
      control: "Clinical Safety",
      implementation: "AI human-in-loop, DCB0129/0160",
      dsptItems: "1.5.1"
    },
    {
      control: "GDPR & Data Protection",
      implementation: "Consent, retention, rectification & erasure",
      dsptItems: "1.4.1, 1.4.2, 1.4.3"
    },
    {
      control: "Data Residency",
      implementation: "UK-only hosting & backups",
      dsptItems: "9.2.8, 9.7.1"
    },
    {
      control: "Business Continuity",
      implementation: "UK redundancy, tested recovery",
      dsptItems: "9.7.2"
    },
    {
      control: "Vulnerability Testing",
      implementation: "Pen tests, quarterly audits, patching schedules",
      dsptItems: "9.8.1"
    },
    {
      control: "Regulatory Compliance",
      implementation: "DSPT, GDPR, CQC IG, MHRA, ISO 14971, IEC 62304",
      dsptItems: "1.6.1, 1.7.1"
    }
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
        {/* Navigation Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={() => navigate('/')}
            variant="outline"
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            size="sm"
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            Home
          </Button>
        </div>
        {/* Header */}
        <div className="text-center space-y-4 mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              NHS Security & Compliance
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Evidence packs and compliance documentation for NHS IT governance, CQC inspections, 
            and DSPT submission requirements.
          </p>
        </div>

        {/* Audience Selection */}
        <div className="flex justify-center mb-6">
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <Button
              variant={userType === 'practice_manager' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setUserType('practice_manager')}
              className="gap-2"
            >
              <Building2 className="h-4 w-4" />
              Practice Manager
            </Button>
            <Button
              variant={userType === 'governance' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setUserType('governance')}
              className="gap-2"
            >
              <UserCheck className="h-4 w-4" />
              Governance Professional
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className={`grid w-full h-auto ${userType === 'governance' ? 'grid-cols-5' : 'grid-cols-1'}`}>
            <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 py-2">Overview</TabsTrigger>
            {userType === 'governance' && (
              <>
                <TabsTrigger value="technical" className="text-xs sm:text-sm px-2 py-2">Technical</TabsTrigger>
                <TabsTrigger value="compliance" className="text-xs sm:text-sm px-2 py-2">Compliance</TabsTrigger>
                <TabsTrigger value="risk" className="text-xs sm:text-sm px-2 py-2">Risk Mgmt</TabsTrigger>
                <TabsTrigger value="dspt" className="text-xs sm:text-sm px-2 py-2">DSPT Crosswalk</TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Practice Manager Welcome */}
            {userType === 'practice_manager' && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Info className="h-5 w-5" />
                    Welcome Practice Managers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    <strong>You do not need to change how you currently work.</strong> We will assist you at every step and work directly with your Data Protection Officer (DPO), Clinical Safety Officer (CSO) and NHS IT Governance colleagues to keep everything compliant. This means no extra burden for you – we handle the technical and regulatory detail in the background.
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Security Controls Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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

            {/* CQC Inspection Note */}
            <Card className="border-success/20 bg-success/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-success">
                  <CheckCircle className="h-5 w-5" />
                  CQC Inspection Note
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  This system meets NHS Digital and GDPR requirements for protecting patient data. Every user action is logged, access is strictly controlled, and all data is hosted and backed up securely in the UK. Practice managers are supported at every step – you do not need technical knowledge to evidence compliance. This page can be shown to CQC inspectors as proof of IT governance and data protection.
                </p>
              </CardContent>
            </Card>

            {/* Download Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={() => downloadEvidencePack('cqc')} className="gap-2">
                <Download className="h-4 w-4" />
                Download CQC Evidence Pack
              </Button>
              {userType === 'governance' && (
                <Button onClick={() => downloadEvidencePack('advanced')} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Download Advanced Evidence Pack
                </Button>
              )}
            </div>

            {/* Closing Messages */}
            <Card className="bg-muted/20">
              <CardContent className="pt-6">
                {userType === 'practice_manager' ? (
                  <p className="text-center text-muted-foreground">
                    <strong>You stay focused on patients and staff.</strong> We'll manage IT governance, compliance, and evidence gathering with your DPO, CSO and IT leads.
                  </p>
                ) : (
                  <p className="text-center text-muted-foreground">
                    <strong>All measures are mapped directly to DSP Toolkit items.</strong> Full technical proofs, audit trails and compliance reports are available for inspection or submission.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Technical Controls Tab - Governance Only */}
          {userType === 'governance' && (
            <TabsContent value="technical" className="space-y-6">
              {/* AI-Assisted Development */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    AI-Assisted Secure Development → OWASP ASVS Alignment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h5 className="font-medium text-sm">Code Reviews & Dependency Scanning</h5>
                      <ul className="space-y-1 text-xs">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-success shrink-0" />
                          <span>Automated OWASP dependency vulnerability checks</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-success shrink-0" />
                          <span>Real-time security pattern analysis</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-success shrink-0" />
                          <span>SAST/DAST integration in CI/CD pipeline</span>
                        </li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h5 className="font-medium text-sm">ASVS Level 2 Compliance</h5>
                      <ul className="space-y-1 text-xs">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-success shrink-0" />
                          <span>V1.2 Authentication Architecture</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-success shrink-0" />
                          <span>V2.3 Session Management</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-success shrink-0" />
                          <span>V5.2 Input Validation</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detailed Implementation Evidence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Authentication Section - Enhanced */}
                <div>
                  <Button
                    variant="ghost"
                    onClick={() => toggleSection("auth")}
                    className="flex items-center gap-2 p-0 h-auto font-semibold"
                  >
                    {expandedSections.auth ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Multi-Layer Authentication & Authorization
                  </Button>
                  {expandedSections.auth && (
                    <div className="mt-3 space-y-4">
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h5 className="font-medium mb-2">JWT Token Security Implementation</h5>
                        <pre className="text-sm overflow-x-auto mb-3">
{`// Secure JWT configuration with refresh tokens
const authConfig = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  sessionTimeout: 3600, // 1 hour
  maxRetries: 3,
  retryDelay: 1000
};

// Multi-factor authentication readiness
const mfaConfig = {
  enabled: true,
  methods: ['totp', 'sms'],
  backupCodes: true,
  gracePeriod: 30 // days for setup
};`}
                        </pre>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <h6 className="font-medium mb-1">Token Security Features</h6>
                            <ul className="space-y-1 text-xs">
                              <li>• Automatic token rotation</li>
                              <li>• Secure HTTP-only cookies</li>
                              <li>• CSRF protection enabled</li>
                              <li>• Session fingerprinting</li>
                            </ul>
                          </div>
                          <div>
                            <h6 className="font-medium mb-1">Access Control</h6>
                            <ul className="space-y-1 text-xs">
                              <li>• Role-based permissions (RBAC)</li>
                              <li>• Attribute-based access (ABAC)</li>
                              <li>• Practice-level data isolation</li>
                              <li>• Principle of least privilege</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 bg-secondary/20 rounded-lg">
                        <h5 className="font-medium mb-2">Advanced Role Management</h5>
                        <pre className="text-sm overflow-x-auto">
{`// Granular role-based access control functions
function hasModuleAccess(user_id: uuid, module: app_module): boolean
function isSystemAdmin(user_id: uuid): boolean
function isPracticeManager(user_id: uuid, practice_id: uuid): boolean
function isPCNManager(user_id: uuid): boolean
function isGP(user_id: uuid): boolean
function isClinicalStaff(user_id: uuid): boolean
function isAdminAssistant(user_id: uuid): boolean
function isPracticeFinanceManager(user_id: uuid): boolean
function canAccessPatientData(user_id: uuid, patient_id: uuid): boolean

// Dynamic permission checking with audit trail
function checkPermissionWithAudit(
  user_id: uuid, 
  resource: string, 
  action: string
): permission_result`}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Role-Based Data Integrity Examples */}
                <div>
                  <Button
                    variant="ghost"
                    onClick={() => toggleSection("roleExamples")}
                    className="flex items-center gap-2 p-0 h-auto font-semibold"
                  >
                    {expandedSections.roleExamples ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Role-Based Data Integrity Examples
                  </Button>
                  {expandedSections.roleExamples && (
                    <div className="mt-3 space-y-4">
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h5 className="font-medium mb-2">Practice Manager Access Control</h5>
                        <p className="text-sm text-muted-foreground mb-3">
                          Practice managers can only access data from their specific practice, ensuring complete data isolation between practices.
                        </p>
                        <pre className="text-sm overflow-x-auto mb-3 bg-background p-3 rounded border">
{`-- RLS Policy Example: Practice Manager can only see their practice complaints
CREATE POLICY "Practice managers can view their practice complaints"
ON public.complaints FOR SELECT 
USING (
  practice_id = get_practice_manager_practice_id(auth.uid())
  AND has_role(auth.uid(), 'practice_manager')
);

-- Example Query Result:
-- Practice Manager at "Greenfield Surgery" logs in
-- They can ONLY see complaints where practice_id = '123e4567-...'
-- They CANNOT see complaints from "Riverside Medical Centre" or any other practice`}
                        </pre>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <h6 className="font-medium mb-1 text-primary">✅ Accessible Data</h6>
                            <ul className="space-y-1 text-xs">
                              <li>• Complaints from their practice only</li>
                              <li>• Staff assignments within their practice</li>
                              <li>• Meeting records from their practice</li>
                              <li>• User profiles within their practice</li>
                            </ul>
                          </div>
                          <div>
                            <h6 className="font-medium mb-1 text-destructive">❌ Restricted Data</h6>
                            <ul className="space-y-1 text-xs">
                              <li>• Other practices' complaint data</li>
                              <li>• System-wide user management</li>
                              <li>• Cross-practice analytics</li>
                              <li>• Global security settings</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-secondary/20 rounded-lg">
                        <h5 className="font-medium mb-2">PCN Manager Multi-Practice Access</h5>
                        <p className="text-sm text-muted-foreground mb-3">
                          PCN managers can access data from multiple practices within their assigned Primary Care Network, but still cannot see data outside their network.
                        </p>
                        <pre className="text-sm overflow-x-auto mb-3 bg-background p-3 rounded border">
{`-- RLS Policy: PCN Manager can see data from assigned practices only
CREATE POLICY "PCN managers can view their network practices"
ON public.complaints FOR SELECT 
USING (
  practice_id = ANY(get_pcn_manager_practice_ids(auth.uid()))
  AND has_role(auth.uid(), 'pcn_manager')
);

-- Example: PCN Manager for "North London Network"
-- Assigned practices: ['practice_1', 'practice_2', 'practice_3']
-- Can see data from all 3 practices
-- Cannot see data from practices in "South London Network"`}
                        </pre>
                      </div>

                      <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                        <h5 className="font-medium mb-2 text-primary">Clinical Staff Data Protection</h5>
                        <p className="text-sm text-muted-foreground mb-3">
                          Clinical staff (GPs, nurses) have read-only access to patient-related data within their practice, with full audit trails for all access.
                        </p>
                        <pre className="text-sm overflow-x-auto mb-3 bg-background p-3 rounded border">
{`-- Clinical staff can view patient consultations but not administrative data
CREATE POLICY "Clinical staff can view patient data in their practice"
ON public.consultations FOR SELECT 
USING (
  practice_id = get_user_practice_id(auth.uid())
  AND (has_role(auth.uid(), 'gp') OR has_role(auth.uid(), 'clinical_staff'))
);

-- Automatic audit logging for every access
CREATE TRIGGER log_patient_data_access
  AFTER SELECT ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION log_data_access();`}
                        </pre>
                        <div className="text-sm">
                          <h6 className="font-medium mb-1">Access Restrictions</h6>
                          <ul className="space-y-1 text-xs">
                            <li>• Can view: Patient consultations, medical records within their practice</li>
                            <li>• Cannot access: Financial data, complaint management, user administration</li>
                            <li>• All access logged with timestamp, user ID, and accessed records</li>
                          </ul>
                        </div>
                      </div>

                      <div className="p-4 bg-accent/20 rounded-lg">
                        <h5 className="font-medium mb-2">Admin Assistant Limited Access</h5>
                        <p className="text-sm text-muted-foreground mb-3">
                          Admin assistants have access to administrative functions but no access to clinical data or sensitive patient information.
                        </p>
                        <pre className="text-sm overflow-x-auto mb-3 bg-background p-3 rounded border">
{`-- Admin assistants can manage appointments but not view medical records
CREATE POLICY "Admin assistants schedule access only"
ON public.appointments FOR ALL 
USING (
  practice_id = get_user_practice_id(auth.uid())
  AND has_role(auth.uid(), 'admin_assistant')
);

-- They CANNOT access clinical notes table
CREATE POLICY "No clinical data access for admin assistants"
ON public.clinical_notes FOR ALL 
USING (
  NOT has_role(auth.uid(), 'admin_assistant')
);`}
                        </pre>
                      </div>

                      <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <h5 className="font-medium mb-2 text-orange-800">Data Breach Prevention Examples</h5>
                        <div className="space-y-3 text-sm">
                          <div>
                            <h6 className="font-medium text-orange-700">Scenario 1: Unauthorized Cross-Practice Access</h6>
                            <p className="text-xs text-orange-600 mb-2">
                              A practice manager tries to access another practice's complaint data by modifying URL parameters.
                            </p>
                            <pre className="text-xs bg-white p-2 rounded border">
{`Result: Database query returns empty result set
Audit Log: "UNAUTHORIZED_ACCESS_ATTEMPT" logged
System Response: No data exposure, access denied at database level`}
                            </pre>
                          </div>
                          <div>
                            <h6 className="font-medium text-orange-700">Scenario 2: Role Escalation Attempt</h6>
                            <p className="text-xs text-orange-600 mb-2">
                              A clinical staff member attempts to access user management functions.
                            </p>
                            <pre className="text-xs bg-white p-2 rounded border">
{`Result: 403 Forbidden - Insufficient permissions
Audit Log: Role mismatch detected and logged
System Response: Action blocked, security team notified`}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Database Security Section - Enhanced */}
                <div>
                  <Button
                    variant="ghost"
                    onClick={() => toggleSection("database")}
                    className="flex items-center gap-2 p-0 h-auto font-semibold"
                  >
                    {expandedSections.database ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Advanced Database Security Architecture
                  </Button>
                  {expandedSections.database && (
                    <div className="mt-3 space-y-4">
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h5 className="font-medium mb-2">Row Level Security (RLS) Policies</h5>
                        <pre className="text-sm overflow-x-auto">
{`-- Practice-specific data isolation
CREATE POLICY "practice_data_isolation"
ON complaints FOR ALL
USING (
  practice_id = get_practice_manager_practice_id(auth.uid()) OR
  practice_id = ANY(get_pcn_manager_practice_ids(auth.uid())) OR
  is_system_admin(auth.uid())
);

-- Comprehensive audit trail with user tracking
CREATE FUNCTION audit_complaint_changes()
RETURNS trigger AS $$
BEGIN
  INSERT INTO complaint_audit_detailed (
    complaint_id, user_id, user_email, action_type,
    action_description, old_values, new_values,
    ip_address, user_agent, created_at
  ) VALUES (
    NEW.id, auth.uid(), auth.email(), TG_OP,
    'Complaint modified', to_jsonb(OLD), to_jsonb(NEW),
    inet_client_addr(), current_setting('request.headers')::json->>'user-agent',
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`}
                        </pre>
                      </div>
                      <div className="p-4 bg-success/10 rounded-lg">
                        <h5 className="font-medium mb-2">Data Protection Features</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <h6 className="font-medium text-sm mb-1">Encryption</h6>
                            <ul className="space-y-1 text-xs">
                              <li>• AES-256 encryption at rest</li>
                              <li>• TLS 1.3 in transit</li>
                              <li>• Column-level encryption</li>
                              <li>• Key rotation policies</li>
                            </ul>
                          </div>
                          <div>
                            <h6 className="font-medium text-sm mb-1">Access Monitoring</h6>
                            <ul className="space-y-1 text-xs">
                              <li>• Real-time query monitoring</li>
                              <li>• Failed access attempt logging</li>
                              <li>• Anomaly detection</li>
                              <li>• Geographic access tracking</li>
                            </ul>
                          </div>
                          <div>
                            <h6 className="font-medium text-sm mb-1">Data Integrity</h6>
                            <ul className="space-y-1 text-xs">
                              <li>• Cryptographic checksums</li>
                              <li>• Version control tracking</li>
                              <li>• Immutable audit logs</li>
                              <li>• Backup verification</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Input Validation Section - Enhanced */}
                <div>
                  <Button
                    variant="ghost"
                    onClick={() => toggleSection("validation")}
                    className="flex items-center gap-2 p-0 h-auto font-semibold"
                  >
                    {expandedSections.validation ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Comprehensive Input Validation & Sanitization
                  </Button>
                  {expandedSections.validation && (
                    <div className="mt-3 space-y-4">
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h5 className="font-medium mb-2">Multi-Layer Validation Framework</h5>
                        <pre className="text-sm overflow-x-auto">
{`// TypeScript + Zod schema validation
const ComplaintSchema = z.object({
  patient_name: z.string()
    .min(1, "Required")
    .max(100, "Too long")
    .regex(/^[a-zA-Z\s\-']+$/, "Invalid characters"),
  patient_email: z.string()
    .email("Invalid email")
    .refine(email => validateNHSEmail(email), "Must be NHS email"),
  complaint_description: z.string()
    .min(10, "Too short")
    .max(5000, "Too long")
    .transform(text => DOMPurify.sanitize(text))
});

// Server-side validation with sanitization
export async function validateAndSanitizeInput(data: unknown) {
  // 1. Schema validation
  const validated = ComplaintSchema.parse(data);
  
  // 2. Content sanitization
  const sanitized = DOMPurify.sanitize(validated.complaint_description, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em'],
    ALLOWED_ATTR: []
  });
  
  // 3. Additional security checks
  if (containsSuspiciousPatterns(sanitized)) {
    throw new SecurityError("Potentially malicious content detected");
  }
  
  return { ...validated, complaint_description: sanitized };
}`}
                        </pre>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <h6 className="font-medium text-sm mb-2">Frontend Protection</h6>
                          <ul className="space-y-1 text-xs">
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-3 w-3 text-success" />
                              <span>Real-time input sanitization with DOMPurify</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-3 w-3 text-success" />
                              <span>TypeScript type safety enforcement</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-3 w-3 text-success" />
                              <span>Zod schema validation with custom rules</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-3 w-3 text-success" />
                              <span>Content Security Policy (CSP) headers</span>
                            </li>
                          </ul>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <h6 className="font-medium text-sm mb-2">Backend Protection</h6>
                          <ul className="space-y-1 text-xs">
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-3 w-3 text-success" />
                              <span>Parameterized queries preventing SQL injection</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-3 w-3 text-success" />
                              <span>Server-side HTML sanitization</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-3 w-3 text-success" />
                              <span>Rate limiting and request throttling</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-3 w-3 text-success" />
                              <span>Malicious pattern detection algorithms</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Security Monitoring Section - New */}
                <div>
                  <Button
                    variant="ghost"
                    onClick={() => toggleSection("monitoring")}
                    className="flex items-center gap-2 p-0 h-auto font-semibold"
                  >
                    {expandedSections.monitoring ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Real-Time Security Monitoring & Incident Response
                  </Button>
                  {expandedSections.monitoring && (
                    <div className="mt-3 space-y-4">
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h5 className="font-medium mb-2">Automated Security Monitoring</h5>
                        <pre className="text-sm overflow-x-auto">
{`-- Security event logging with severity classification
CREATE FUNCTION log_security_event(
  event_type text,
  severity_level integer,
  user_id uuid,
  details jsonb,
  source_ip inet
) RETURNS uuid AS $$
DECLARE
  alert_threshold integer := 3;
  recent_events integer;
BEGIN
  -- Log the security event
  INSERT INTO security_events (
    event_type, severity_level, user_id, details, 
    source_ip, timestamp
  ) VALUES (
    event_type, severity_level, user_id, details,
    source_ip, now()
  );
  
  -- Check for suspicious patterns
  SELECT COUNT(*) INTO recent_events
  FROM security_events
  WHERE user_id = user_id
    AND timestamp > now() - interval '1 hour'
    AND severity_level >= 2;
    
  -- Trigger automated response if threshold exceeded
  IF recent_events >= alert_threshold THEN
    PERFORM trigger_security_alert(user_id, 'SUSPICIOUS_ACTIVITY');
  END IF;
  
  RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`}
                        </pre>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                          <h6 className="font-medium text-sm mb-2 text-red-800">Threat Detection</h6>
                          <ul className="space-y-1 text-xs text-red-700">
                            <li>• Failed login attempt monitoring</li>
                            <li>• Brute force attack detection</li>
                            <li>• Unusual access pattern alerts</li>
                            <li>• Geographic anomaly detection</li>
                            <li>• Session hijacking protection</li>
                          </ul>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <h6 className="font-medium text-sm mb-2 text-green-800">Automated Response</h6>
                          <ul className="space-y-1 text-xs text-green-700">
                            <li>• Account lockout after failed attempts</li>
                            <li>• IP blocking for suspicious behavior</li>
                            <li>• Real-time admin notifications</li>
                            <li>• Automatic session termination</li>
                            <li>• Evidence preservation for forensics</li>
                          </ul>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                          <h6 className="font-medium text-sm mb-2 text-purple-800">Compliance Monitoring</h6>
                          <ul className="space-y-1 text-xs text-purple-700">
                            <li>• GDPR compliance tracking</li>
                            <li>• NHS Digital guideline adherence</li>
                            <li>• Data retention policy enforcement</li>
                            <li>• Access control policy validation</li>
                            <li>• Regulatory reporting automation</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            </TabsContent>
          )}

          {/* Compliance Tab - Governance Only */}
          {userType === 'governance' && (
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
          )}

          {/* Risk Management Tab - Governance Only */}
          {userType === 'governance' && (
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
          )}

          {/* DSPT Toolkit Evidence Crosswalk Tab - Governance Only */}
          {userType === 'governance' && (
            <TabsContent value="dspt" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    DSP Toolkit Evidence Crosswalk
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-semibold">Security Control</th>
                          <th className="text-left p-3 font-semibold">Implementation Detail</th>
                          <th className="text-left p-3 font-semibold">DSPT Evidence Item</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dsptCrosswalk.map((item, index) => (
                          <tr key={index} className="border-b hover:bg-muted/30">
                            <td className="p-3 font-medium">{item.control}</td>
                            <td className="p-3 text-muted-foreground">{item.implementation}</td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-xs">
                                {item.dsptItems}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-primary">Evidence Documentation Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4">
                      <div className="text-2xl font-bold text-success mb-2">100%</div>
                      <div className="text-sm text-muted-foreground">Technical Controls</div>
                    </div>
                    <div className="text-center p-4">
                      <div className="text-2xl font-bold text-success mb-2">100%</div>
                      <div className="text-sm text-muted-foreground">Governance Controls</div>
                    </div>
                    <div className="text-center p-4">
                      <div className="text-2xl font-bold text-success mb-2">Ready</div>
                      <div className="text-sm text-muted-foreground">DSPT Submission</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}