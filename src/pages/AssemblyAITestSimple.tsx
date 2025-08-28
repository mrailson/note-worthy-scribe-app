import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function AssemblyAITestSimple() {
  const [isTestingToken, setIsTestingToken] = useState(false);
  const [tokenResult, setTokenResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testTokenGeneration = async () => {
    setIsTestingToken(true);
    setError(null);
    setTokenResult(null);
    
    try {
      console.log('Testing AssemblyAI token generation...');
      
      const { data, error } = await supabase.functions.invoke('assemblyai-realtime-token', {
        method: 'GET'
      });
      
      console.log('Raw response:', { data, error });
      
      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(`Function call failed: ${JSON.stringify(error)}`);
      }
      
      if (data?.error) {
        console.error('Function returned error:', data.error);
        throw new Error(`Token generation failed: ${data.error}`);
      }
      
      if (!data?.token) {
        console.error('No token in response:', data);
        throw new Error('No token received from server');
      }
      
      console.log('Token received successfully!');
      setTokenResult(`Token received! Length: ${data.token.length} characters`);
      
      // Test WebSocket connection with token
      console.log('Testing WebSocket connection...');
      const wsUrl = `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&token=${encodeURIComponent(data.token)}&format_turns=true`;
      const testWs = new WebSocket(wsUrl);
      
      testWs.onopen = () => {
        console.log('WebSocket connection successful!');
        setTokenResult(prev => prev + '\nWebSocket connection: SUCCESS ✓');
        testWs.close();
      };
      
      testWs.onerror = (error) => {
        console.error('WebSocket connection error:', error);
        setError('WebSocket connection failed - check token validity');
      };
      
      testWs.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        if (event.code !== 1000 && event.code !== 1001) {
          setError(`WebSocket failed to connect (Code: ${event.code}): ${event.reason || 'Unknown reason'}`);
        }
      };
      
    } catch (err) {
      console.error('Token test error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsTestingToken(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">AssemblyAI Connection Test</h1>
        <p className="text-muted-foreground">
          Test the AssemblyAI API key and WebSocket connection
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Connection Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <Button 
              onClick={testTokenGeneration} 
              disabled={isTestingToken}
              size="lg"
            >
              {isTestingToken ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Testing...
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>
          </div>

          {/* Success Result */}
          {tokenResult && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Badge variant="default" className="bg-green-600">SUCCESS</Badge>
                <div className="flex-1">
                  <pre className="text-sm text-green-800 whitespace-pre-wrap">{tokenResult}</pre>
                </div>
              </div>
            </div>
          )}

          {/* Error Result */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-red-800 mb-1">Connection Failed</h3>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-muted/30 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Test Steps:</h3>
            <ol className="text-sm text-muted-foreground space-y-1">
              <li>1. Check if ASSEMBLYAI_API_KEY is configured in Supabase</li>
              <li>2. Generate a temporary access token</li>
              <li>3. Test WebSocket connection to AssemblyAI</li>
              <li>4. Report success or failure details</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">Troubleshooting:</h3>
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>If token generation fails:</strong> The ASSEMBLYAI_API_KEY may not be set in Supabase secrets</p>
            <p><strong>If WebSocket fails:</strong> The token may be invalid or AssemblyAI service may be down</p>
            <p><strong>Network errors:</strong> Check browser console for CORS or network issues</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}