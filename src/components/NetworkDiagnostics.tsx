import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Copy, Download } from "lucide-react";
import { toast } from "sonner";

interface DiagnosticResult {
  test: string;
  status: 'pass' | 'fail' | 'warning';
  duration?: number;
  details: string;
  recommendation?: string;
  technicalDetails?: string;
}

interface NetworkReport {
  timestamp: string;
  userAgent: string;
  results: DiagnosticResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    warningTests: number;
  };
}

const SUPABASE_URL = "https://dphcnbricafkbtizkoal.supabase.co";

export function NetworkDiagnostics() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [report, setReport] = useState<NetworkReport | null>(null);

  const runDiagnostic = async (test: string, testFunction: () => Promise<DiagnosticResult>) => {
    try {
      const result = await testFunction();
      setResults(prev => [...prev, result]);
      return result;
    } catch (error) {
      const failResult: DiagnosticResult = {
        test,
        status: 'fail',
        details: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recommendation: 'Contact your IT department if this issue persists'
      };
      setResults(prev => [...prev, failResult]);
      return failResult;
    }
  };

  const testDnsResolution = async (): Promise<DiagnosticResult> => {
    const start = performance.now();
    try {
      // Test DNS resolution by making a simple HEAD request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const duration = performance.now() - start;

      if (response.ok || response.status === 401) { // 401 is expected without auth
        return {
          test: 'DNS Resolution',
          status: duration > 2000 ? 'warning' : 'pass',
          duration: Math.round(duration),
          details: `DNS resolved successfully in ${Math.round(duration)}ms`,
          recommendation: duration > 2000 ? 'Slow DNS resolution may indicate network issues' : undefined
        };
      } else {
        return {
          test: 'DNS Resolution',
          status: 'fail',
          duration: Math.round(duration),
          details: `DNS resolution failed with status ${response.status}`,
          recommendation: 'Check if corporate firewall is blocking supabase.co domains'
        };
      }
    } catch (error) {
      const duration = performance.now() - start;
      return {
        test: 'DNS Resolution',
        status: 'fail',
        duration: Math.round(duration),
        details: error instanceof Error ? error.message : 'DNS resolution failed',
        recommendation: 'VPN or corporate firewall may be blocking DNS queries. Try disconnecting VPN temporarily.',
        technicalDetails: `Error type: ${error instanceof Error ? error.constructor.name : 'Unknown'}`
      };
    }
  };

  const testHttpsConnectivity = async (): Promise<DiagnosticResult> => {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'apikey': 'test-key'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const duration = performance.now() - start;

      // Expected responses: 401 (unauthorized) or 400 (bad request)
      if (response.status === 401 || response.status === 400) {
        return {
          test: 'HTTPS Connectivity',
          status: 'pass',
          duration: Math.round(duration),
          details: `HTTPS connection successful (${response.status})`,
          technicalDetails: `Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`
        };
      } else {
        return {
          test: 'HTTPS Connectivity',
          status: 'warning',
          duration: Math.round(duration),
          details: `Unexpected response status: ${response.status}`,
          recommendation: 'Connection established but received unexpected response'
        };
      }
    } catch (error) {
      const duration = performance.now() - start;
      return {
        test: 'HTTPS Connectivity',
        status: 'fail',
        duration: Math.round(duration),
        details: error instanceof Error ? error.message : 'HTTPS connection failed',
        recommendation: 'Corporate firewall or VPN may be blocking HTTPS traffic to Supabase',
        technicalDetails: `Port 443 to ${SUPABASE_URL} - ${error instanceof Error ? error.constructor.name : 'Unknown error'}`
      };
    }
  };

  const testCorsAndHeaders = async (): Promise<DiagnosticResult> => {
    const start = performance.now();
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'OPTIONS',
        headers: {
          'Origin': window.location.origin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization,apikey'
        }
      });
      
      const duration = performance.now() - start;
      const corsHeaders = response.headers.get('Access-Control-Allow-Origin');
      
      if (response.ok && corsHeaders) {
        return {
          test: 'CORS & Headers',
          status: 'pass',
          duration: Math.round(duration),
          details: 'CORS preflight successful',
          technicalDetails: `CORS headers: ${corsHeaders}`
        };
      } else {
        return {
          test: 'CORS & Headers',
          status: 'warning',
          duration: Math.round(duration),
          details: 'CORS preflight response received but may have issues',
          recommendation: 'Some browsers or corporate proxies may modify CORS headers'
        };
      }
    } catch (error) {
      const duration = performance.now() - start;
      return {
        test: 'CORS & Headers',
        status: 'fail',
        duration: Math.round(duration),
        details: error instanceof Error ? error.message : 'CORS test failed',
        recommendation: 'Corporate proxy may be stripping CORS headers'
      };
    }
  };

  const testLatencyAndSpeed = async (): Promise<DiagnosticResult> => {
    const tests = [];
    let totalDuration = 0;
    
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/`, { method: 'HEAD' });
        const duration = performance.now() - start;
        tests.push(duration);
        totalDuration += duration;
      } catch (error) {
        return {
          test: 'Latency & Speed',
          status: 'fail',
          details: 'Unable to measure latency',
          recommendation: 'Network connectivity issues detected'
        };
      }
    }
    
    const avgLatency = totalDuration / 3;
    const minLatency = Math.min(...tests);
    const maxLatency = Math.max(...tests);
    
    let status: 'pass' | 'warning' | 'fail' = 'pass';
    let recommendation: string | undefined;
    
    if (avgLatency > 2000) {
      status = 'fail';
      recommendation = 'Very slow connection detected. VPN or network issues likely.';
    } else if (avgLatency > 1000) {
      status = 'warning';
      recommendation = 'Slow connection detected. May impact user experience.';
    }
    
    return {
      test: 'Latency & Speed',
      status,
      duration: Math.round(avgLatency),
      details: `Average: ${Math.round(avgLatency)}ms, Range: ${Math.round(minLatency)}-${Math.round(maxLatency)}ms`,
      recommendation,
      technicalDetails: `Individual tests: ${tests.map(t => Math.round(t) + 'ms').join(', ')}`
    };
  };

  const runAllDiagnostics = useCallback(async () => {
    setIsRunning(true);
    setResults([]);
    setReport(null);

    const diagnosticResults: DiagnosticResult[] = [];

    // Run all tests
    diagnosticResults.push(await runDiagnostic('DNS Resolution', testDnsResolution));
    diagnosticResults.push(await runDiagnostic('HTTPS Connectivity', testHttpsConnectivity));
    diagnosticResults.push(await runDiagnostic('CORS & Headers', testCorsAndHeaders));
    diagnosticResults.push(await runDiagnostic('Latency & Speed', testLatencyAndSpeed));

    // Generate summary
    const summary = {
      totalTests: diagnosticResults.length,
      passedTests: diagnosticResults.filter(r => r.status === 'pass').length,
      failedTests: diagnosticResults.filter(r => r.status === 'fail').length,
      warningTests: diagnosticResults.filter(r => r.status === 'warning').length
    };

    const finalReport: NetworkReport = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      results: diagnosticResults,
      summary
    };

    setReport(finalReport);
    setIsRunning(false);
    
    toast.success("Network diagnostics completed");
  }, []);

  const copyReportToClipboard = () => {
    if (!report) return;
    
    const reportText = `
Network Diagnostics Report
Generated: ${new Date(report.timestamp).toLocaleString()}
User Agent: ${report.userAgent}
Domain: ${SUPABASE_URL}

SUMMARY:
✅ Passed: ${report.summary.passedTests}/${report.summary.totalTests}
⚠️  Warnings: ${report.summary.warningTests}
❌ Failed: ${report.summary.failedTests}

DETAILED RESULTS:
${report.results.map(result => `
${result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'} ${result.test}
   Duration: ${result.duration ? result.duration + 'ms' : 'N/A'}
   Details: ${result.details}
   ${result.recommendation ? 'Recommendation: ' + result.recommendation : ''}
   ${result.technicalDetails ? 'Technical: ' + result.technicalDetails : ''}
`).join('')}

FOR IT DEPARTMENTS:
- Domain: ${SUPABASE_URL}
- Required ports: 443 (HTTPS), 80 (HTTP redirect)
- Required protocols: HTTPS, WebSocket (WSS)
- DNS: Must resolve *.supabase.co domains
- CORS: Must allow cross-origin requests from application domain
    `.trim();

    navigator.clipboard.writeText(reportText);
    toast.success("Report copied to clipboard");
  };

  const downloadReport = () => {
    if (!report) return;
    
    const reportData = JSON.stringify(report, null, 2);
    const blob = new Blob([reportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-diagnostics-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Report downloaded");
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pass': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'fail': return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusBadgeVariant = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pass': return 'default';
      case 'warning': return 'secondary';
      case 'fail': return 'destructive';
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Network Connectivity Diagnostics
          {isRunning && <Loader2 className="w-4 h-4 animate-spin" />}
        </CardTitle>
        <CardDescription>
          Test network connectivity to diagnose VPN and corporate firewall issues
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="flex gap-3">
          <Button 
            onClick={runAllDiagnostics} 
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            {isRunning ? 'Running Diagnostics...' : 'Run Network Diagnostics'}
          </Button>
          
          {report && (
            <>
              <Button variant="outline" onClick={copyReportToClipboard}>
                <Copy className="w-4 h-4 mr-2" />
                Copy Report
              </Button>
              <Button variant="outline" onClick={downloadReport}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </>
          )}
        </div>

        {report && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>For IT Departments:</strong> This report can help identify VPN, firewall, or DNS issues. 
              Domain: <code>{SUPABASE_URL}</code> requires access on port 443 (HTTPS) with CORS support.
            </AlertDescription>
          </Alert>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Test Results</h3>
            
            {results.map((result, index) => (
              <Card key={index} className="border-l-4 border-l-transparent data-[status=pass]:border-l-green-500 data-[status=warning]:border-l-yellow-500 data-[status=fail]:border-l-red-500" data-status={result.status}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <span className="font-medium">{result.test}</span>
                      <Badge variant={getStatusBadgeVariant(result.status)}>
                        {result.status.toUpperCase()}
                      </Badge>
                    </div>
                    {result.duration && (
                      <span className="text-sm text-muted-foreground">
                        {result.duration}ms
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm mb-2">{result.details}</p>
                  
                  {result.recommendation && (
                    <div className="bg-blue-50 dark:bg-blue-950 p-2 rounded text-sm">
                      <strong>Recommendation:</strong> {result.recommendation}
                    </div>
                  )}
                  
                  {result.technicalDetails && (
                    <details className="mt-2">
                      <summary className="text-sm text-muted-foreground cursor-pointer">
                        Technical Details
                      </summary>
                      <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">
                        {result.technicalDetails}
                      </pre>
                    </details>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {report && (
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">{report.summary.passedTests}</div>
                  <div className="text-sm text-muted-foreground">Passed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{report.summary.warningTests}</div>
                  <div className="text-sm text-muted-foreground">Warnings</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{report.summary.failedTests}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{report.summary.totalTests}</div>
                  <div className="text-sm text-muted-foreground">Total Tests</div>
                </div>
              </div>
              
              <div className="mt-4 text-sm text-muted-foreground">
                Generated: {new Date(report.timestamp).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        )}
        
        <Alert>
          <AlertDescription>
            <strong>Common Issues:</strong>
            <ul className="mt-2 ml-4 list-disc text-sm space-y-1">
              <li><strong>DNS Resolution Failed:</strong> VPN or corporate DNS blocking *.supabase.co</li>
              <li><strong>HTTPS Connection Failed:</strong> Firewall blocking port 443</li>
              <li><strong>High Latency:</strong> VPN routing or network congestion</li>
              <li><strong>CORS Issues:</strong> Corporate proxy modifying headers</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}