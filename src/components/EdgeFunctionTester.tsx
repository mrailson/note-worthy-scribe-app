import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertCircle, Wifi } from "lucide-react";
import { toast } from "sonner";

export const EdgeFunctionTester: React.FC = () => {
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [testing, setTesting] = useState(false);

  const testWebSocketConnection = async () => {
    setTesting(true);
    const testId = 'websocket-connection';
    
    try {
      const wsUrl = `wss://dphcnbricafkbtizkoal.functions.supabase.co/functions/v1/amazon-transcribe-medical-ws`;
      console.log('Testing WebSocket connection to:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout after 10 seconds'));
        }, 10000);

        ws.onopen = () => {
          console.log('WebSocket test: Connection opened');
          clearTimeout(timeout);
          ws.close(1000, 'Test complete');
          resolve({
            success: true,
            message: 'WebSocket connection successful',
            details: {
              readyState: ws.readyState,
              url: wsUrl
            }
          });
        };

        ws.onerror = (error) => {
          console.error('WebSocket test error:', error);
          clearTimeout(timeout);
          reject(new Error('WebSocket connection failed'));
        };

        ws.onclose = (event) => {
          console.log('WebSocket test: Connection closed', event.code, event.reason);
          if (event.code !== 1000) {
            clearTimeout(timeout);
            reject(new Error(`Connection closed with code ${event.code}: ${event.reason}`));
          }
        };
      });

      setTestResults(prev => ({ ...prev, [testId]: result }));
      toast.success('WebSocket connection test passed');
      
    } catch (error) {
      console.error('WebSocket test failed:', error);
      setTestResults(prev => ({ 
        ...prev, 
        [testId]: {
          success: false,
          message: error.message,
          details: {
            error: error.toString(),
            timestamp: new Date().toISOString()
          }
        }
      }));
      toast.error(`WebSocket test failed: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  const testEdgeFunctionDeployment = async () => {
    setTesting(true);
    const testId = 'edge-function-deployment';
    
    try {
      // Try to make a simple HTTP request to check if the function exists
      const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/functions/v1/amazon-transcribe-medical-ws', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      const result = {
        success: response.status !== 404,
        message: response.status === 404 
          ? 'Edge function not found - may not be deployed'
          : `Edge function exists (Status: ${response.status})`,
        details: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          timestamp: new Date().toISOString()
        }
      };

      setTestResults(prev => ({ ...prev, [testId]: result }));
      
      if (result.success) {
        toast.success('Edge function deployment test passed');
      } else {
        toast.error('Edge function not found');
      }
      
    } catch (error) {
      console.error('Edge function test failed:', error);
      setTestResults(prev => ({ 
        ...prev, 
        [testId]: {
          success: false,
          message: `Network error: ${error.message}`,
          details: {
            error: error.toString(),
            timestamp: new Date().toISOString()
          }
        }
      }));
      toast.error(`Edge function test failed: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  const runAllTests = async () => {
    await testEdgeFunctionDeployment();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay
    await testWebSocketConnection();
  };

  const getStatusIcon = (result: any) => {
    if (!result) return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    return result.success 
      ? <CheckCircle className="h-4 w-4 text-green-500" />
      : <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusBadge = (result: any) => {
    if (!result) return <Badge variant="secondary">Not Tested</Badge>;
    return result.success 
      ? <Badge variant="default" className="bg-green-500">Pass</Badge>
      : <Badge variant="destructive">Fail</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Edge Function Diagnostics
        </CardTitle>
        <CardDescription>
          Test Amazon Transcribe Medical edge function deployment and connectivity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Button onClick={runAllTests} disabled={testing}>
            {testing ? 'Testing...' : 'Run All Tests'}
          </Button>
          <Button onClick={testEdgeFunctionDeployment} variant="outline" disabled={testing}>
            Test Deployment
          </Button>
          <Button onClick={testWebSocketConnection} variant="outline" disabled={testing}>
            Test WebSocket
          </Button>
        </div>

        <div className="space-y-4">
          {/* Edge Function Deployment Test */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(testResults['edge-function-deployment'])}
              <div>
                <div className="font-medium">Edge Function Deployment</div>
                <div className="text-sm text-muted-foreground">
                  Checks if the function is deployed and accessible
                </div>
              </div>
            </div>
            {getStatusBadge(testResults['edge-function-deployment'])}
          </div>

          {testResults['edge-function-deployment'] && (
            <Alert variant={testResults['edge-function-deployment'].success ? "default" : "destructive"}>
              <AlertDescription>
                <strong>Result:</strong> {testResults['edge-function-deployment'].message}
                {testResults['edge-function-deployment'].details && (
                  <details className="mt-2">
                    <summary className="cursor-pointer">View Details</summary>
                    <pre className="mt-2 text-xs overflow-auto">
                      {JSON.stringify(testResults['edge-function-deployment'].details, null, 2)}
                    </pre>
                  </details>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* WebSocket Connection Test */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(testResults['websocket-connection'])}
              <div>
                <div className="font-medium">WebSocket Connection</div>
                <div className="text-sm text-muted-foreground">
                  Tests WebSocket connectivity to the edge function
                </div>
              </div>
            </div>
            {getStatusBadge(testResults['websocket-connection'])}
          </div>

          {testResults['websocket-connection'] && (
            <Alert variant={testResults['websocket-connection'].success ? "default" : "destructive"}>
              <AlertDescription>
                <strong>Result:</strong> {testResults['websocket-connection'].message}
                {testResults['websocket-connection'].details && (
                  <details className="mt-2">
                    <summary className="cursor-pointer">View Details</summary>
                    <pre className="mt-2 text-xs overflow-auto">
                      {JSON.stringify(testResults['websocket-connection'].details, null, 2)}
                    </pre>
                  </details>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {Object.keys(testResults).length > 0 && (
          <div className="pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              <strong>Troubleshooting Tips:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>If edge function deployment fails: Check if AWS credentials are configured</li>
                <li>If WebSocket connection fails: Verify the function is deployed and the URL is correct</li>
                <li>Check the edge function logs for detailed error information</li>
                <li>Ensure Supabase project has WebSocket support enabled</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};