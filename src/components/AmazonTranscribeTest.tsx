import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Activity, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const AmazonTranscribeTest = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [credentialsValid, setCredentialsValid] = useState<boolean | null>(null);
  const [websocketUrl, setWebsocketUrl] = useState('');
  const [testResults, setTestResults] = useState<string[]>([]);

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResults([]);
      setCredentialsValid(null);
      setWebsocketUrl('');
      
      setTestResults(prev => [...prev, '🔄 Testing AWS credentials...']);
      
      // Test 1: Check if credentials are configured
      const { data: credCheck, error: credError } = await supabase.functions.invoke('amazon-transcribe', {
        body: { action: 'check_credentials' }
      });

      if (credError) {
        throw new Error(`Credentials check failed: ${credError.message}`);
      }

      if (credCheck?.available) {
        setTestResults(prev => [...prev, '✅ AWS credentials are configured and valid']);
        setCredentialsValid(true);
      } else {
        setTestResults(prev => [...prev, '❌ AWS credentials are not configured']);
        setCredentialsValid(false);
        return;
      }

      setTestResults(prev => [...prev, '🔄 Testing WebSocket URL generation...']);

      // Test 2: Generate WebSocket URL (this tests the signing process)
      const { data: urlData, error: urlError } = await supabase.functions.invoke('amazon-transcribe', {
        body: { 
          action: 'get_websocket_url',
          region: 'us-east-1',
          languageCode: 'en-US',
          sampleRate: 16000
        }
      });

      if (urlError) {
        throw new Error(`WebSocket URL generation failed: ${urlError.message}`);
      }

      if (urlData?.websocketUrl) {
        setWebsocketUrl(urlData.websocketUrl);
        setTestResults(prev => [...prev, '✅ WebSocket URL generated successfully']);
        setTestResults(prev => [...prev, `📋 URL length: ${urlData.websocketUrl.length} characters`]);
        setTestResults(prev => [...prev, `🌍 Region: ${urlData.region}`]);
        setTestResults(prev => [...prev, `🗣️ Language: ${urlData.languageCode}`]);
      } else {
        setTestResults(prev => [...prev, '❌ Failed to generate WebSocket URL']);
        return;
      }

      setTestResults(prev => [...prev, '']);
      setTestResults(prev => [...prev, '✅ Amazon Transcribe integration test successful!']);
      setTestResults(prev => [...prev, '']);
      setTestResults(prev => [...prev, '📝 Note: Direct WebSocket connections from browsers to AWS']);
      setTestResults(prev => [...prev, '   services are not supported due to CORS policies.']);
      setTestResults(prev => [...prev, '   Production usage requires a backend WebSocket proxy.']);

      toast.success('Amazon Transcribe credentials verified successfully!');
      
    } catch (error) {
      console.error('Test failed:', error);
      setTestResults(prev => [...prev, `❌ Test failed: ${error.message}`]);
      setCredentialsValid(false);
      toast.error('Amazon Transcribe test failed: ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  const getStatusBadge = () => {
    if (testing) return <Badge variant="secondary">Testing...</Badge>;
    if (credentialsValid === true) return <Badge variant="default" className="bg-green-500">Valid</Badge>;
    if (credentialsValid === false) return <Badge variant="destructive">Invalid</Badge>;
    return <Badge variant="outline">Not Tested</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Amazon Transcribe Test
          </CardTitle>
          <CardDescription>
            Test AWS credentials and Amazon Transcribe service integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => setIsOpen(true)}
            className="w-full"
          >
            <Activity className="w-4 h-4 mr-2" />
            Test Amazon Transcribe Integration
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Amazon Transcribe Integration Test
            </DialogTitle>
            <DialogDescription>
              Verify AWS credentials and service configuration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Status and Controls */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium">Credentials Status:</div>
                {getStatusBadge()}
              </div>
              <Button 
                onClick={handleTest}
                disabled={testing}
                className="flex items-center gap-2"
              >
                {testing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {testing ? 'Testing...' : 'Run Test'}
              </Button>
            </div>

            {/* Test Results */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Test Results</h3>
              <div className="min-h-[200px] p-4 border rounded-lg bg-muted/50 font-mono text-sm">
                {testResults.length > 0 ? (
                  testResults.map((result, index) => (
                    <div key={index} className="leading-relaxed">
                      {result}
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground italic">
                    Click "Run Test" to verify Amazon Transcribe integration
                  </p>
                )}
              </div>
            </div>

            {/* WebSocket URL Preview (for debugging) */}
            {websocketUrl && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Generated WebSocket URL (for debugging)</h3>
                <div className="p-3 border rounded-lg bg-muted/30">
                  <p className="text-xs font-mono break-all">{websocketUrl}</p>
                </div>
              </div>
            )}

            {/* Information */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• This test verifies AWS credentials and WebSocket URL generation</p>
              <p>• Amazon Transcribe streaming requires server-side WebSocket proxy for production use</p>
              <p>• Direct browser connections to AWS WebSocket endpoints have CORS limitations</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};