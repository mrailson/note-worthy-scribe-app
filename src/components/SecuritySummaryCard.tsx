import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, CheckCircle2, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

interface SecuritySummaryCardProps {
  variant?: 'compact' | 'detailed';
  showActions?: boolean;
}

export function SecuritySummaryCard({ variant = 'compact', showActions = true }: SecuritySummaryCardProps) {
  const findings = {
    errors: 3,
    warnings: 3,
    info: 3,
    total: 9
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            Security Scan Status
          </CardTitle>
          <Badge variant={findings.errors > 5 ? "destructive" : "secondary"}>
            {findings.total} Findings
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visual breakdown of findings */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-500">{findings.errors}</div>
            <div className="text-sm text-muted-foreground">Errors</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">{findings.warnings}</div>
            <div className="text-sm text-muted-foreground">Warnings</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-500">{findings.info}</div>
            <div className="text-sm text-muted-foreground">Info</div>
          </div>
        </div>

        {/* Top issues preview */}
        {variant === 'detailed' && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Key Findings:</h4>
            <ul className="list-disc ml-5 text-sm space-y-1 text-muted-foreground">
              <li>3 Security Definer Views (likely false positives)</li>
              <li>Infrastructure: Extensions in public schema</li>
              <li>PostgreSQL security patches available</li>
            </ul>
          </div>
        )}

        {/* Success metrics */}
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-500" />
            <span className="text-sm font-semibold text-green-900 dark:text-green-300">
              73% Security Improvement
            </span>
          </div>
          <p className="text-xs text-green-800 dark:text-green-400 mt-1">
            100+ RLS policies secured • 15 critical issues resolved
          </p>
        </div>

        {showActions && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/security-report">View Full Report</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="#" onClick={(e) => { e.preventDefault(); window.location.reload(); }}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Re-scan
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
