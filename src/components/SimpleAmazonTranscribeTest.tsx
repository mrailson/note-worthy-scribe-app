import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Activity } from 'lucide-react';

export const SimpleAmazonTranscribeTest = () => {
  const [testing, setTesting] = useState(false);

  const testEdgeFunction = async () => {
    console.log('=== TESTING EDGE FUNCTION ===');
    setTesting(true);
    
    try {
      const testUrl = 'https://dphcnbricafkbtizkoal.functions.supabase.co/amazon-transcribe-websocket-test';
      console.log('Testing function at:', testUrl);
      
      const response = await fetch(testUrl);
      const data = await response.json();
      
      console.log('Function test result:', data);
      toast.success('Function is working! Check console for details.');
      
    } catch (error) {
      console.error('Function test failed:', error);
      toast.error('Function test failed - see console');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Simple Amazon Test
        </CardTitle>
        <CardDescription>
          Basic connectivity test for Amazon Transcribe functions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={testEdgeFunction}
          disabled={testing}
          className="w-full"
        >
          {testing ? 'Testing...' : '🔧 Test Edge Function'}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Check browser console (F12) for detailed results
        </p>
      </CardContent>
    </Card>
  );
};