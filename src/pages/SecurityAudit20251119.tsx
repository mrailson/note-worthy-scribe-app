import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  ChevronRight,
  Download,
  ShieldAlert,
  Clock,
  AlertCircle,
  Info as InfoIcon,
  ArrowLeft
} from "lucide-react";

const SecurityAudit20251119 = () => {
  const navigate = useNavigate();
  const auditDate = "19th November 2025";
  const auditTime = "07:18";
  const totalFindings = 6;
  const errorCount = 0;
  const warningCount = 5;
  const infoCount = 1;

  const findings = [
    {
      id: "function_search_path_001",
      severity: "WARNING" as const,
      category: "FUNCTION_SEARCH_PATH",
      title: "Function search_path mutable: public.update_updated_at_column",
      description: "Set explicit search_path on function public.update_updated_at_column for security",
      impact: "Medium - Potential schema injection vulnerability in trigger function"
    },
    {
      id: "function_search_path_002",
      severity: "WARNING" as const,
      category: "FUNCTION_SEARCH_PATH",
      title: "Function search_path mutable: public.handle_new_user",
      description: "Set explicit search_path on function public.handle_new_user for security",
      impact: "Medium - User creation trigger may be vulnerable to schema attacks"
    },
    {
      id: "function_search_path_003",
      severity: "WARNING" as const,
      category: "FUNCTION_SEARCH_PATH",
      title: "Function search_path mutable: public.update_meeting_updated_at",
      description: "Set explicit search_path on function public.update_meeting_updated_at for security",
      impact: "Low - Meeting timestamp trigger has mutable search path"
    },
    {
      id: "extension_location_001",
      severity: "WARNING" as const,
      category: "EXTENSION_LOCATION",
      title: "Extension not in dedicated schema: pg_stat_statements",
      description: "Install extension pg_stat_statements in dedicated schema for better security",
      impact: "Low - PostgreSQL statistics extension in public schema"
    },
    {
      id: "extension_location_002",
      severity: "WARNING" as const,
      category: "EXTENSION_LOCATION",
      title: "Extension not in dedicated schema: pgcrypto",
      description: "Install extension pgcrypto in dedicated schema for better security",
      impact: "Low - Cryptography extension in public schema"
    },
    {
      id: "postgres_version",
      severity: "INFO" as const,
      category: "POSTGRES_VERSION",
      title: "Postgres version requires security patches",
      description: "Current Postgres version may have known security issues. Review available patches.",
      impact: "Informational - Regular version updates recommended"
    }
  ];

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "ERROR":
        return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case "WARNING":
        return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case "INFO":
        return <InfoIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      default:
        return null;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "ERROR":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">Critical Error</Badge>;
      case "WARNING":
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Warning</Badge>;
      case "INFO":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">Informational</Badge>;
      default:
        return null;
    }
  };

  const handleDownload = () => {
    window.print();
  };

  return (
    <>
      <Header />
      <div className="container mx-auto py-8 px-4 max-w-7xl print:px-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6 print:hidden">
          <Link to="/cso-report" className="hover:text-foreground transition-colors">CSO Report</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">Security Audit Report</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <ShieldAlert className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Security Audit Report</h1>
                <p className="text-muted-foreground mt-1">{auditDate}</p>
              </div>
            </div>
            <div className="flex gap-2 print:hidden">
              <Button onClick={() => navigate('/cso-report')} variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to CSO Report
              </Button>
              <Button onClick={handleDownload} variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Download Report
              </Button>
            </div>
          </div>
          
          {/* Audit Metadata */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block mb-1">Audit Date</span>
                  <span className="font-semibold">{auditDate}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Scan Time</span>
                  <span className="font-semibold">{auditTime}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Report Version</span>
                  <span className="font-semibold">2.0</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Classification</span>
                  <span className="font-semibold">MHRA Class 1</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Status</span>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                    <CheckCircle className="w-3 h-3 mr-1" /> 0 Critical Issues
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Executive Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Executive Summary
            </CardTitle>
            <CardDescription>Comprehensive security assessment as at {auditDate}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-foreground">{totalFindings}</div>
                    <div className="text-sm text-muted-foreground mt-1">Total Findings</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600 dark:text-red-400">{errorCount}</div>
                    <div className="text-sm text-muted-foreground mt-1">Critical Errors</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{warningCount}</div>
                    <div className="text-sm text-muted-foreground mt-1">Warnings</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{infoCount}</div>
                    <div className="text-sm text-muted-foreground mt-1">Informational</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Audit Metadata</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Scan Time:</span>
                    <span className="font-medium">{auditTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Audit Type:</span>
                    <span className="font-medium">Automated Security Scan</span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-700 dark:text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-green-900 dark:text-green-300 mb-2">Overall Security Posture</h4>
                    <p className="text-sm text-green-800 dark:text-green-400">
                      This audit identified <strong>no critical errors</strong>. All database tables have appropriate Row Level Security (RLS) policies enabled. However, 5 warnings were identified concerning database function security hardening and infrastructure configuration that should be addressed as part of ongoing security improvements.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Critical Issues Breakdown */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="w-5 h-5" />
              Critical Security Controls - All Verified
            </CardTitle>
            <CardDescription>0 critical security issues - All RLS policies are properly enabled</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 dark:text-green-300 mb-3">Row Level Security (RLS) Status</h4>
                <p className="text-sm text-green-800 dark:text-green-400 mb-3">
                  All database tables containing sensitive healthcare and patient data have Row Level Security (RLS) properly enabled and configured:
                </p>
                <ul className="space-y-2 text-sm text-green-800 dark:text-green-400">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span><span className="font-mono bg-green-100 dark:bg-green-950/40 px-2 py-1 rounded text-xs">gp_practices</span> - Healthcare practice information properly secured with RLS</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>All user data tables protected with appropriate authentication policies</span>
                  </li>
                </ul>
                <div className="mt-4 p-3 bg-white dark:bg-background rounded border border-green-200 dark:border-green-900">
                  <p className="text-sm font-semibold text-green-900 dark:text-green-300 mb-1">Compliance Status:</p>
                  <p className="text-sm text-green-800 dark:text-green-400">
                    RLS configuration meets UK GDPR and NHS Data Security and Protection Toolkit requirements for access control and data protection.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Findings Table */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Detailed Security Findings</CardTitle>
            <CardDescription>Complete list of all {totalFindings} identified issues (0 errors, 5 warnings, 1 info)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Severity</TableHead>
                    <TableHead className="w-[120px]">Category</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Impact Assessment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {findings.map((finding) => (
                    <TableRow key={finding.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getSeverityIcon(finding.severity)}
                          {getSeverityBadge(finding.severity)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {finding.category.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{finding.title}</p>
                          <p className="text-xs text-muted-foreground">{finding.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{finding.impact}</p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              Recommendations and Action Plan
            </CardTitle>
            <CardDescription>Prioritised remediation steps</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-bold px-2 py-1 rounded">MEDIUM</span>
                Recommended Actions (Within 2 Weeks)
              </h3>
              <ul className="space-y-2 text-sm ml-4">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span>Set explicit search_path on all database functions to prevent schema injection attacks</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span>Review and relocate PostgreSQL extensions (pg_stat_statements, pgcrypto) to dedicated schemas</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span>Implement automated RLS policy testing in CI/CD pipeline</span>
                </li>
              </ul>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span className="bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-xs font-bold px-2 py-1 rounded">MEDIUM</span>
                Ongoing Security Improvements
              </h3>
              <ul className="space-y-2 text-sm ml-4">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span>Review PostgreSQL version and apply available security patches</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span>Schedule regular security audits (recommended: quarterly)</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span>Establish security scanning as part of standard deployment process</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Audit Methodology */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Audit Methodology</CardTitle>
            <CardDescription>Tools and processes used in this security assessment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Scanning Tools</h4>
              <ul className="space-y-1 text-sm text-muted-foreground ml-4">
                <li>• Supabase Security Linter (built-in database security scanner)</li>
                <li>• Enhanced Security Scanner (custom vulnerability detection)</li>
                <li>• Row Level Security (RLS) policy validator</li>
                <li>• Database function security analyser</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Scope of Audit</h4>
              <ul className="space-y-1 text-sm text-muted-foreground ml-4">
                <li>• Database table security configuration</li>
                <li>• Row Level Security (RLS) policy coverage</li>
                <li>• Database function security settings</li>
                <li>• PostgreSQL extension configuration</li>
                <li>• Authentication and authorisation mechanisms</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Limitations</h4>
              <p className="text-sm text-muted-foreground">
                This audit is focused on database-layer security and does not cover application-level security, network security, 
                infrastructure hardening, or third-party integrations. A comprehensive penetration test is recommended for complete 
                security assurance.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground space-y-2 pb-8">
          <Separator className="mb-4" />
          <p>Security Audit Report - {auditDate}</p>
          <p>Generated by NoteWell Security Scanning System</p>
          <p className="text-xs">Report Reference: AUDIT-20251119-0718</p>
          <div className="flex items-center justify-center gap-4 mt-4 print:hidden">
            <Button variant="outline" size="sm" asChild>
              <Link to="/cso-report">View CSO Report</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/compliance/security">Security Compliance Dashboard</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/security-report">Live Security Data</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SecurityAudit20251119;
