import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, ShieldAlert, Info, Download, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";

interface SecurityFinding {
  id: string;
  name: string;
  description: string;
  level: "error" | "warn" | "info";
}

const SecurityReport = () => {
  const [reportData] = useState<SecurityFinding[]>([
    // Critical Errors - Infrastructure
    {
      id: "SUPA_security_definer_view",
      name: "Security Definer View",
      description: "Detects views defined with the SECURITY DEFINER property. These views enforce Postgres permissions and row level security policies (RLS) of the view creator, rather than that of the querying user.",
      level: "error"
    },
    // Critical Errors - User Data Exposure
    {
      id: "PUBLIC_USER_DATA",
      name: "User Email Addresses and Personal Data Could Be Stolen",
      description: "The 'profiles' table contains email addresses, full names, job titles, departments, and NHS trust information but lacks RLS policies to prevent public read access. Hackers could enumerate all users in the system and harvest their contact information for phishing attacks or identity theft.",
      level: "error"
    },
    {
      id: "PUBLIC_USER_DATA",
      name: "User Login Activity and IP Addresses Could Be Tracked by Attackers",
      description: "The 'user_sessions' table stores IP addresses, user agents, login times, and session IDs. Without proper RLS, attackers could monitor when users are active, track their locations via IP addresses, and potentially hijack sessions.",
      level: "error"
    },
    {
      id: "PUBLIC_USER_DATA",
      name: "Staff Personal Information in Complaints Could Be Exposed",
      description: "The 'complaint_involved_parties' table contains staff names, emails, roles, and access tokens. If publicly readable, this exposes staff members mentioned in complaints to harassment or retaliation.",
      level: "error"
    },
    {
      id: "PUBLIC_USER_DATA",
      name: "Staff Contact Details and Pay Rates Could Be Stolen",
      description: "The 'staff_members' table contains names, emails, phone numbers, hourly rates, and GP rates. Public access would expose sensitive employment and compensation data.",
      level: "error"
    },
    {
      id: "PUBLIC_USER_DATA",
      name: "Meeting Attendee Contact Information Could Be Harvested",
      description: "The 'attendees' table stores names, emails, organisations, roles, and titles of meeting participants. Without RLS protection, this creates a directory of contacts that could be scraped for spam or social engineering attacks.",
      level: "error"
    },
    {
      id: "PUBLIC_USER_DATA",
      name: "Healthcare Provider Contact Details Could Be Exposed",
      description: "The 'specialist_services' table contains hospital names, departments, contact persons, emails, phones, and addresses. Public access could lead to spam targeting healthcare providers or misuse of referral information.",
      level: "error"
    },
    {
      id: "PUBLIC_USER_DATA",
      name: "Staff Signatures and Credentials Could Be Forged",
      description: "The 'complaint_signatures' table stores names, job titles, qualifications, emails, phones, and signature images/text. Public access would allow attackers to impersonate staff members in official correspondence.",
      level: "error"
    },
    // Critical Errors - Sensitive Data
    {
      id: "EXPOSED_SENSITIVE_DATA",
      name: "Patient Complaint Details Including Personal Information Could Be Leaked",
      description: "The 'complaints' table contains patient names, dates of birth, addresses, contact emails, phones, and detailed complaint descriptions. Public access would violate patient confidentiality and GDPR.",
      level: "error"
    },
    {
      id: "EXPOSED_SENSITIVE_DATA",
      name: "Confidential Meeting Transcripts Could Be Read by Unauthorised Users",
      description: "The 'meetings' table stores meeting titles, descriptions, participants, transcripts, and clinical notes (SOAP notes). Without proper RLS, sensitive clinical discussions or business meetings could be exposed.",
      level: "error"
    },
    {
      id: "EXPOSED_SENSITIVE_DATA",
      name: "Detailed Meeting Transcripts with Speaker Names Could Be Accessed",
      description: "The 'meeting_transcripts' table contains timestamped transcript content with speaker names and confidence scores. Public access would expose verbatim conversations from clinical consultations or confidential meetings.",
      level: "error"
    },
    {
      id: "EXPOSED_SENSITIVE_DATA",
      name: "Clinical Consultation Notes Could Be Stolen",
      description: "The 'consultation_notes' table stores clinical notes, transcripts, consultation types, and confidence scores. Public access would violate patient confidentiality and medical ethics.",
      level: "error"
    },
    {
      id: "EXPOSED_SENSITIVE_DATA",
      name: "Patient Translation Sessions with Medical Terms Could Be Exposed",
      description: "The 'translation_sessions' table stores patient language, translations, medical terms detected, and session metadata. Public access could reveal sensitive patient communications and medical conditions.",
      level: "error"
    },
    {
      id: "EXPOSED_SENSITIVE_DATA",
      name: "Patient-Doctor Translation Conversations Could Be Read",
      description: "The 'manual_translation_entries' table contains original and translated text from patient consultations, including medical terms and safety flags. Public access would expose confidential medical conversations.",
      level: "error"
    },
    {
      id: "EXPOSED_SENSITIVE_DATA",
      name: "Draft Email Replies and Patient Context Could Be Stolen",
      description: "The 'communications' table stores email text, draft replies, context notes, response guidance, and uploaded files. Public access would expose sensitive patient correspondence and clinical decision-making.",
      level: "error"
    },
    // Warnings - Infrastructure
    {
      id: "SUPA_extension_in_public",
      name: "Extension in Public",
      description: "Detects extensions installed in the `public` schema. Extensions should be installed in the `extensions` schema for better security isolation.",
      level: "warn"
    },
    {
      id: "SUPA_vulnerable_postgres_version",
      name: "Current Postgres version has security patches available",
      description: "Upgrade your postgres database to apply important security patches. Keeping database software up-to-date is essential for security.",
      level: "warn"
    },
    // Warnings - Missing RLS Protection
    {
      id: "MISSING_RLS_PROTECTION",
      name: "Audit Logs Could Reveal Security Vulnerabilities to Attackers",
      description: "The 'system_audit_log' table tracks all database operations including IP addresses, user agents, and data changes. While RLS exists, verify it properly restricts access to system administrators and practice managers viewing only their practice data.",
      level: "warn"
    },
    {
      id: "MISSING_RLS_PROTECTION",
      name: "User Permission Assignments Could Be Manipulated",
      description: "The 'user_roles' table controls access to sensitive features like complaints management, CQC compliance, and fridge monitoring. Ensure they properly prevent privilege escalation by restricting role assignment to practice managers and system administrators only.",
      level: "warn"
    },
    {
      id: "MISSING_RLS_PROTECTION",
      name: "Meeting Sharing Could Be Exploited to Access Unauthorised Content",
      description: "The 'meeting_shares' table controls who can access shared meetings. Verify that RLS policies prevent users from creating shares for meetings they don't own, and that access level restrictions are properly enforced.",
      level: "warn"
    },
    {
      id: "MISSING_RLS_PROTECTION",
      name: "Shared Drive Permissions Could Allow Unauthorised File Access",
      description: "The 'shared_drive_permissions' table uses complex permission logic with inherited permissions and multiple action types. Verify that the RLS policies properly prevent users from granting themselves elevated access.",
      level: "warn"
    },
    {
      id: "MISSING_RLS_PROTECTION",
      name: "Complaint Supporting Documents Could Be Accessed by Wrong Users",
      description: "The 'complaint_documents' table stores file paths and metadata for complaint evidence. Verify RLS policies properly restrict access to practice staff handling the complaint.",
      level: "warn"
    },
    {
      id: "MISSING_RLS_PROTECTION",
      name: "Meeting Documents Could Be Downloaded by Unauthorised Users",
      description: "The 'meeting_documents' table stores file paths for meeting attachments. Verify that RLS policies properly restrict access to meeting owners and shared users.",
      level: "warn"
    }
  ]);

  const scanDate = new Date();
  const errorCount = reportData.filter(f => f.level === "error").length;
  const warnCount = reportData.filter(f => f.level === "warn").length;

  const handleExport = () => {
    const reportText = `
DATABASE SECURITY ASSESSMENT REPORT
Generated: ${format(scanDate, "dd/MM/yyyy HH:mm")}
================================================================================

EXECUTIVE SUMMARY
-----------------
Total Findings: ${reportData.length}
Critical Issues (ERROR): ${errorCount}
Warnings (WARN): ${warnCount}

RISK ASSESSMENT: ${errorCount > 10 ? "HIGH" : errorCount > 5 ? "MEDIUM" : "LOW"}

CRITICAL ISSUES REQUIRING IMMEDIATE ATTENTION
==============================================

${reportData.filter(f => f.level === "error").map((finding, idx) => `
${idx + 1}. ${finding.name}
   Category: ${finding.id}
   Impact: CRITICAL
   
   Description:
   ${finding.description}
   
   Recommended Action:
   Implement Row Level Security (RLS) policies to restrict access to authorised users only.
   
`).join("\n")}

WARNINGS REQUIRING REVIEW
==========================

${reportData.filter(f => f.level === "warn").map((finding, idx) => `
${idx + 1}. ${finding.name}
   Category: ${finding.id}
   Impact: MEDIUM
   
   Description:
   ${finding.description}
   
   Recommended Action:
   Review and verify existing RLS policies provide adequate protection.
   
`).join("\n")}

REMEDIATION PRIORITIES
======================
1. Immediate (Within 24 hours): Address all CRITICAL issues related to patient data exposure
2. Short-term (Within 1 week): Fix staff data and contact information exposure
3. Medium-term (Within 2 weeks): Review and strengthen all RLS policies
4. Long-term (Within 1 month): Apply infrastructure updates (Postgres version, extensions)

COMPLIANCE IMPACT
=================
- GDPR: Multiple patient data tables lack proper access controls
- NHS DSPT: Security controls require strengthening
- Data Protection Act 2018: Risk of unauthorised personal data access

END OF REPORT
================================================================================
`;

    const blob = new Blob([reportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Security-Assessment-${format(scanDate, "yyyy-MM-dd-HHmm")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "warn":
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      default:
        return <Info className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "error":
        return <Badge variant="destructive">CRITICAL</Badge>;
      case "warn":
        return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">WARNING</Badge>;
      default:
        return <Badge variant="outline">INFO</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">Database Security Assessment Report</h1>
                <p className="text-muted-foreground mt-1">
                  Generated: {format(scanDate, "dd MMMM yyyy 'at' HH:mm")}
                </p>
              </div>
            </div>
            <Button onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Executive Summary */}
        <Card className="mb-6 border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl">Executive Summary</CardTitle>
            <CardDescription>Overall security posture assessment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="border-2">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2">{reportData.length}</div>
                    <div className="text-sm text-muted-foreground">Total Findings</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 border-destructive/50">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-destructive mb-2">{errorCount}</div>
                    <div className="text-sm text-muted-foreground">Critical Issues</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 border-warning/50">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-warning mb-2">{warnCount}</div>
                    <div className="text-sm text-muted-foreground">Warnings</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className={`p-4 rounded-lg border-2 ${errorCount > 10 ? "bg-destructive/5 border-destructive" : errorCount > 5 ? "bg-warning/5 border-warning" : "bg-green-500/5 border-green-500"}`}>
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className={`h-5 w-5 ${errorCount > 10 ? "text-destructive" : errorCount > 5 ? "text-warning" : "text-green-500"}`} />
                <span className="font-semibold">
                  Overall Risk Level: {errorCount > 10 ? "HIGH" : errorCount > 5 ? "MEDIUM" : "LOW"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {errorCount > 10 ? "Immediate action required to address critical security vulnerabilities." : 
                 errorCount > 5 ? "Several security issues require prompt attention." :
                 "Security posture is generally good but requires ongoing monitoring."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Critical Issues */}
        {errorCount > 0 && (
          <Card className="mb-6 border-destructive/20">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <XCircle className="h-6 w-6 text-destructive" />
                Critical Issues Requiring Immediate Attention
              </CardTitle>
              <CardDescription>
                {errorCount} error{errorCount !== 1 ? 's' : ''} found - High priority remediation required
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData
                  .filter(f => f.level === "error")
                  .map((finding, idx) => (
                    <Card key={`${finding.id}-${idx}`} className="border-destructive/20">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            {getLevelIcon(finding.level)}
                            <div className="flex-1">
                              <CardTitle className="text-base mb-1">{finding.name}</CardTitle>
                              <div className="flex items-center gap-2 mb-2">
                                {getLevelBadge(finding.level)}
                                <Badge variant="outline" className="text-xs">
                                  {finding.id}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">{finding.description}</p>
                        <div className="bg-muted p-3 rounded-md">
                          <p className="text-xs font-semibold mb-1">Recommended Action:</p>
                          <p className="text-xs text-muted-foreground">
                            Implement Row Level Security (RLS) policies to restrict access to authorised users only.
                            Verify that only users with legitimate business need can access this data.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Warnings */}
        {warnCount > 0 && (
          <Card className="mb-6 border-warning/20">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-warning" />
                Warnings Requiring Review
              </CardTitle>
              <CardDescription>
                {warnCount} warning{warnCount !== 1 ? 's' : ''} found - Verify existing protections are adequate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData
                  .filter(f => f.level === "warn")
                  .map((finding, idx) => (
                    <Card key={`${finding.id}-${idx}`} className="border-warning/20">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            {getLevelIcon(finding.level)}
                            <div className="flex-1">
                              <CardTitle className="text-base mb-1">{finding.name}</CardTitle>
                              <div className="flex items-center gap-2 mb-2">
                                {getLevelBadge(finding.level)}
                                <Badge variant="outline" className="text-xs">
                                  {finding.id}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">{finding.description}</p>
                        <div className="bg-muted p-3 rounded-md">
                          <p className="text-xs font-semibold mb-1">Recommended Action:</p>
                          <p className="text-xs text-muted-foreground">
                            Review existing security controls and verify they provide adequate protection.
                            Consider implementing additional monitoring or access restrictions if needed.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Remediation Priorities */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl">Remediation Priorities</CardTitle>
            <CardDescription>Recommended timeline for addressing identified issues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-2 bg-destructive rounded-full flex-shrink-0" />
                <div>
                  <h4 className="font-semibold mb-1">Immediate (Within 24 hours)</h4>
                  <p className="text-sm text-muted-foreground">
                    Address all CRITICAL issues related to patient data exposure (complaints, consultation notes, translation sessions)
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex gap-3">
                <div className="w-2 bg-warning rounded-full flex-shrink-0" />
                <div>
                  <h4 className="font-semibold mb-1">Short-term (Within 1 week)</h4>
                  <p className="text-sm text-muted-foreground">
                    Fix staff data and contact information exposure (profiles, staff_members, signatures)
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex gap-3">
                <div className="w-2 bg-primary rounded-full flex-shrink-0" />
                <div>
                  <h4 className="font-semibold mb-1">Medium-term (Within 2 weeks)</h4>
                  <p className="text-sm text-muted-foreground">
                    Review and strengthen all RLS policies, verify document access controls
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex gap-3">
                <div className="w-2 bg-muted-foreground rounded-full flex-shrink-0" />
                <div>
                  <h4 className="font-semibold mb-1">Long-term (Within 1 month)</h4>
                  <p className="text-sm text-muted-foreground">
                    Apply infrastructure updates (Postgres version upgrade, extension relocation)
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Impact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Compliance Impact</CardTitle>
            <CardDescription>Regulatory and standards implications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold">GDPR:</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    Multiple patient data tables currently lack proper access controls, creating risk of unauthorised processing
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold">NHS DSPT:</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    Security controls require strengthening to meet NHS Data Security and Protection Toolkit standards
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold">Data Protection Act 2018:</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    Risk of unauthorised personal data access must be addressed to maintain compliance
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SecurityReport;
