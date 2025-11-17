import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Database, Network, FileCheck, Eye, AlertTriangle, CheckCircle2 } from "lucide-react";

const SecurityPostureOverview = () => {
  const securityDomains = [
    {
      icon: Lock,
      title: "Authentication & Access Control",
      status: "Implemented",
      description: "Multi-factor authentication with session management and role-based access control",
      measures: [
        "Supabase Authentication with email/password and social login",
        "Role-based access control (RBAC) with module permissions",
        "Session timeout and automatic logout",
        "Password complexity requirements",
        "Rate limiting on authentication endpoints"
      ]
    },
    {
      icon: Database,
      title: "Database Security",
      status: "Implemented",
      description: "Row-level security policies protecting all sensitive data",
      measures: [
        "Row Level Security (RLS) enabled on all tables",
        "User-scoped data access policies",
        "Encrypted data at rest (AES-256)",
        "Automated backup and recovery procedures",
        "Audit logging for all database operations"
      ]
    },
    {
      icon: Network,
      title: "Network & Transport Security",
      status: "Implemented",
      description: "Encrypted communications and secure data transmission",
      measures: [
        "TLS 1.3 for all data in transit",
        "HTTPS enforcement across all endpoints",
        "Content Security Policy (CSP) headers",
        "CORS policies restricting cross-origin requests",
        "Secure WebSocket connections for real-time features"
      ]
    },
    {
      icon: FileCheck,
      title: "Data Protection & Privacy",
      status: "Implemented",
      description: "GDPR-compliant data handling with retention policies",
      measures: [
        "Data minimisation principles applied",
        "Automated data retention and deletion policies",
        "Patient consent management",
        "Data anonymisation for analytics",
        "Privacy by design architecture"
      ]
    },
    {
      icon: Eye,
      title: "Monitoring & Audit",
      status: "Implemented",
      description: "Comprehensive logging and security monitoring",
      measures: [
        "Detailed audit logs for all user actions",
        "Real-time security event monitoring",
        "Automated alerting for suspicious activity",
        "Compliance audit trail preservation",
        "Regular security log reviews"
      ]
    },
    {
      icon: AlertTriangle,
      title: "Incident Response",
      status: "Documented",
      description: "Defined procedures for security incident handling",
      measures: [
        "Incident response plan documented",
        "Designated security incident response team",
        "Breach notification procedures (72-hour GDPR compliance)",
        "Post-incident review process",
        "Regular incident response drills"
      ]
    }
  ];

  const complianceFrameworks = [
    { name: "GDPR", status: "Compliant", description: "General Data Protection Regulation" },
    { name: "NHS DCB0129", status: "Compliant", description: "Clinical Risk Management" },
    { name: "NHS DCB0160", status: "Compliant", description: "Clinical Safety Officer Registration" },
    { name: "MHRA Class I", status: "Registered", description: "Medical Device Registration" },
    { name: "CQC Regulation 16", status: "Compliant", description: "Receiving and Acting on Complaints" },
    { name: "ISO 27001 Aligned", status: "In Progress", description: "Information Security Management" }
  ];

  const technicalControls = [
    {
      category: "Input Validation",
      controls: [
        "SQL injection prevention through parameterised queries",
        "XSS protection with content sanitisation",
        "CSRF token validation",
        "File upload validation and scanning",
        "Input length and format restrictions"
      ]
    },
    {
      category: "Authentication Controls",
      controls: [
        "Bcrypt password hashing with salt",
        "JWT token-based session management",
        "Automatic session expiration",
        "Failed login attempt throttling",
        "VPN-friendly rate limiting for healthcare environments"
      ]
    },
    {
      category: "Authorisation Controls",
      controls: [
        "Principle of least privilege enforcement",
        "Module-based permission system",
        "User-scoped data access via RLS",
        "Administrative action logging",
        "Separation of duties for sensitive operations"
      ]
    },
    {
      category: "Infrastructure Security",
      controls: [
        "Supabase managed PostgreSQL with automatic updates",
        "Edge function security with environment isolation",
        "Secrets management for API keys and tokens",
        "DDoS protection via Supabase infrastructure",
        "Geographic data residency (UK/EU)"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Security Posture Overview</h1>
          </div>
          <p className="text-muted-foreground max-w-3xl">
            Comprehensive overview of NotewellAI's security architecture, controls, and compliance measures 
            designed to protect patient data and ensure regulatory compliance across NHS and healthcare environments.
          </p>
        </div>

        {/* Security Domains */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Security Domains</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {securityDomains.map((domain, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <domain.icon className="w-6 h-6 text-primary" />
                      <div>
                        <CardTitle className="text-lg">{domain.title}</CardTitle>
                        <CardDescription>{domain.description}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={domain.status === "Implemented" ? "default" : "secondary"}>
                      {domain.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {domain.measures.map((measure, mIdx) => (
                      <li key={mIdx} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span>{measure}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Compliance Frameworks */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Compliance & Standards</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-3 gap-4">
                {complianceFrameworks.map((framework, idx) => (
                  <div key={idx} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{framework.name}</h3>
                      <Badge variant={
                        framework.status === "Compliant" ? "default" : 
                        framework.status === "Registered" ? "default" : "secondary"
                      }>
                        {framework.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{framework.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Technical Controls */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Technical Security Controls</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {technicalControls.map((section, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <CardTitle className="text-lg">{section.category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {section.controls.map((control, cIdx) => (
                      <li key={cIdx} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span>{control}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Security Architecture Principles */}
        <Card>
          <CardHeader>
            <CardTitle>Security Architecture Principles</CardTitle>
            <CardDescription>Core principles guiding our security approach</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Defence in Depth
                </h3>
                <p className="text-sm text-muted-foreground">
                  Multiple layers of security controls throughout the application stack, ensuring that 
                  if one layer is compromised, others continue to provide protection.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" />
                  Zero Trust Architecture
                </h3>
                <p className="text-sm text-muted-foreground">
                  No implicit trust for any user or system. Every access request is authenticated, 
                  authorised, and encrypted regardless of source.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  Privacy by Design
                </h3>
                <p className="text-sm text-muted-foreground">
                  Privacy and data protection embedded into system design from inception, not added 
                  as an afterthought. Data minimisation and purpose limitation enforced.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Continuous Monitoring
                </h3>
                <p className="text-sm text-muted-foreground">
                  Real-time security monitoring, automated threat detection, and regular security 
                  assessments to identify and address vulnerabilities proactively.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SecurityPostureOverview;
