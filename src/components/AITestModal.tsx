import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, TestTube, Clock, CheckCircle, XCircle, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AITestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TestResult {
  model: string;
  response: string;
  responseTime: number;
  status: 'success' | 'error' | 'pending' | 'idle';
  error?: string;
}

interface ClinicalTestResult {
  model: string;
  service: string;
  response: string;
  responseTime: number;
  status: 'success' | 'error' | 'testing';
  error?: string;
}

// AI Models Configuration  
const AI_MODELS = [
  { id: 'gpt-5-2025-08-07', name: 'GPT-5', service: 'openai' },
  { id: 'gpt-4o', name: 'GPT-4o', service: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', service: 'openai' },
  { id: 'claude-4-sonnet', name: 'Claude 4 Sonnet', service: 'anthropic' },
  { id: 'grok-beta', name: 'Grok Beta', service: 'grok' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', service: 'google' },
];

const CLINICAL_TEST_QUERY = "Provide comprehensive information about metformin including: indication, contraindications, dosing, monitoring requirements, and common side effects. Include BNF guidance.";

export const AITestModal: React.FC<AITestModalProps> = ({ open, onOpenChange }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].id);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [clinicalResults, setClinicalResults] = useState<ClinicalTestResult[]>([]);
  const [isClinicalTesting, setIsClinicalTesting] = useState(false);

  const testSingleModel = async (modelId: string): Promise<TestResult> => {
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-4-pm-chat', {
        body: {
          messages: [{ role: 'user', content: prompt }],
          model: modelId,
          systemPrompt: 'You are a helpful AI assistant. Provide accurate and helpful responses.'
        }
      });

      const responseTime = Date.now() - startTime;

      if (error) {
        return {
          model: modelId,
          response: `Error: ${error.message}`,
          responseTime,
          status: 'error',
          error: error.message
        };
      }

      return {
        model: modelId,
        response: data.response || 'No response received',
        responseTime,
        status: 'success'
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        model: modelId,
        response: `Error: ${error.message}`,
        responseTime,
        status: 'error',
        error: error.message
      };
    }
  };

  const testClinicalPerformance = async (service: 'standard' | 'fast', model: string): Promise<ClinicalTestResult> => {
    const startTime = Date.now();
    
    try {
      const functionName = service === 'fast' ? 'gpt5-fast-clinical' : 'ai-4-pm-chat';
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          messages: [{ role: 'user', content: CLINICAL_TEST_QUERY }],
          model: model,
          systemPrompt: 'You are a clinical AI assistant providing accurate medical information based on UK NHS guidelines.'
        }
      });

      const responseTime = Date.now() - startTime;

      if (error) {
        return {
          model: model,
          service: service,
          response: `Error: ${error.message}`,
          responseTime,
          status: 'error',
          error: error.message
        };
      }

      return {
        model: model,
        service: service,
        response: data.response || 'No response received',
        responseTime: data.responseTime || responseTime,
        status: 'success'
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        model: model,
        service: service,
        response: `Error: ${error.message}`,
        responseTime,
        status: 'error',
        error: error.message
      };
    }
  };

  const handleSingleTest = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt to test",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setTestResults([]);

    try {
      const result = await testSingleModel(selectedModel);
      setTestResults([result]);
      
      toast({
        title: "Test Completed",
        description: `${selectedModel} test completed`,
      });
    } catch (error) {
      console.error('Error running single test:', error);
      toast({
        title: "Error",
        description: "An error occurred while running the test",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestAll = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt to test",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setTestResults([]);

    try {
      const results = await Promise.all(
        AI_MODELS.map(model => testSingleModel(model.id))
      );
      
      setTestResults(results);
      
      toast({
        title: "Tests Completed",
        description: `Tested ${results.length} models successfully`,
      });
    } catch (error) {
      console.error('Error running tests:', error);
      toast({
        title: "Error",
        description: "An error occurred while running tests",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClinicalTest = async () => {
    setIsClinicalTesting(true);
    setClinicalResults([]);

    try {
      console.log('Starting clinical performance comparison...');
      
      // Test GPT-5 with both services
      const [standardResult, fastResult] = await Promise.all([
        testClinicalPerformance('standard', 'gpt-5-2025-08-07'),
        testClinicalPerformance('fast', 'gpt-5-2025-08-07')
      ]);

      setClinicalResults([standardResult, fastResult]);
      
      toast({
        title: "Clinical Test Completed",
        description: `GPT-5 performance comparison completed`,
      });
    } catch (error) {
      console.error('Error running clinical test:', error);
      toast({
        title: "Error",
        description: "An error occurred during clinical testing",
        variant: "destructive",
      });
    } finally {
      setIsClinicalTesting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'testing':
      case 'pending':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'testing':
      case 'pending':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            AI Model Tester
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="standard" className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="standard">Standard Testing</TabsTrigger>
            <TabsTrigger value="clinical">Clinical Performance</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden mt-4">
            <TabsContent value="standard" className="h-full m-0">
              <div className="grid grid-cols-2 gap-6 h-full">
                {/* Left Column - Input */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="prompt" className="text-sm font-medium">
                      Test Prompt
                    </Label>
                    <Textarea
                      id="prompt"
                      placeholder="Enter your prompt to test across models..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="min-h-[100px] mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="model" className="text-sm font-medium">
                      Select Model (for single test)
                    </Label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_MODELS.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSingleTest} 
                      disabled={isLoading}
                      variant="outline"
                      className="flex-1"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Test Selected Model
                    </Button>
                    <Button 
                      onClick={handleTestAll} 
                      disabled={isLoading}
                      className="flex-1"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Test All Models
                    </Button>
                  </div>
                </div>

                {/* Right Column - Results */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Test Results</Label>
                    {testResults.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Fastest: {testResults.reduce((prev, current) => 
                          prev.responseTime < current.responseTime ? prev : current
                        ).model} ({testResults.reduce((prev, current) => 
                          prev.responseTime < current.responseTime ? prev : current
                        ).responseTime}ms)
                      </div>
                    )}
                  </div>
                  
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {testResults.map((result, index) => (
                        <Card key={index} className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{result.model}</span>
                              {getStatusIcon(result.status)}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {result.responseTime}ms
                            </div>
                          </div>
                          <div className="text-sm bg-muted p-2 rounded max-h-32 overflow-y-auto">
                            {result.response}
                          </div>
                          {result.error && (
                            <div className="text-xs text-destructive mt-1">
                              Error: {result.error}
                            </div>
                          )}
                        </Card>
                      ))}
                      
                      {testResults.length === 0 && !isLoading && (
                        <div className="text-center text-muted-foreground py-8">
                          Run tests to see results here
                        </div>
                      )}
                      
                      {isLoading && (
                        <div className="text-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Running tests...</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="clinical" className="h-full m-0">
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                  <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Clinical Performance Test
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    This test compares GPT-5 performance between the standard AI function (with file processing, verification, etc.) 
                    and the new lightweight fast clinical function designed for quick text-only medical queries.
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    Test Query: "{CLINICAL_TEST_QUERY}"
                  </p>
                </div>

                <Button 
                  onClick={handleClinicalTest} 
                  disabled={isClinicalTesting}
                  className="w-full"
                >
                  {isClinicalTesting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <TestTube className="w-4 h-4 mr-2" />}
                  Run Clinical Performance Test
                </Button>

                {clinicalResults.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {clinicalResults.map((result, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant={result.service === 'fast' ? 'default' : 'secondary'}>
                              {result.service === 'fast' ? 'Fast Clinical' : 'Standard AI'}
                            </Badge>
                            {getStatusIcon(result.status)}
                          </div>
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Clock className="w-4 h-4" />
                            {result.responseTime}ms
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="text-sm font-medium">
                            Model: {result.model}
                          </div>
                          
                          <ScrollArea className="h-40">
                            <div className="text-sm bg-muted p-3 rounded">
                              {result.response}
                            </div>
                          </ScrollArea>
                          
                          {result.error && (
                            <div className="text-xs text-destructive">
                              Error: {result.error}
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {clinicalResults.length > 0 && (
                  <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                    <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Performance Analysis</h4>
                    <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                      {(() => {
                        const standardResult = clinicalResults.find(r => r.service === 'standard');
                        const fastResult = clinicalResults.find(r => r.service === 'fast');
                        
                        if (!standardResult || !fastResult) {
                          return <div>Analysis unavailable - missing results</div>;
                        }
                        
                        const improvement = ((standardResult.responseTime - fastResult.responseTime) / standardResult.responseTime * 100).toFixed(1);
                        const speedup = (standardResult.responseTime / fastResult.responseTime).toFixed(1);
                        
                        return (
                          <>
                            <div>• Speed improvement: {improvement}% faster ({speedup}x speedup)</div>
                            <div>• Standard: {standardResult.responseTime}ms | Fast: {fastResult.responseTime}ms</div>
                            <div>• Both responses successful: {standardResult.status === 'success' && fastResult.status === 'success' ? '✅' : '❌'}</div>
                            {fastResult.responseTime < 10000 && (
                              <div className="font-medium text-green-800 dark:text-green-200">
                                ✨ Target achieved: Clinical response under 10 seconds!
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </Card>
                )}

                {isClinicalTesting && (
                  <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Running clinical performance comparison...</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};