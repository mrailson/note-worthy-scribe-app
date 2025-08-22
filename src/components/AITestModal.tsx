import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, PlayCircle, Clock, CheckCircle, XCircle } from 'lucide-react';
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

const AI_MODELS = [
  { id: 'gpt-5-2025-08-07', name: 'GPT-5', service: 'openai' },
  { id: 'gpt-4o', name: 'GPT-4o', service: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', service: 'openai' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', service: 'anthropic' },
  { id: 'grok-beta', name: 'Grok Beta', service: 'grok' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', service: 'gemini' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', service: 'gemini' }
];

export function AITestModal({ open, onOpenChange }: AITestModalProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isTestingAll, setIsTestingAll] = useState(false);

  const testSingleModel = async (modelId: string, modelName: string) => {
    const startTime = Date.now();
    
    setTestResults(prev => prev.map(result => 
      result.model === modelName 
        ? { ...result, status: 'pending' as const }
        : result
    ));

    try {
      const { data, error } = await supabase.functions.invoke('ai-4-pm-chat', {
        body: {
          messages: [{ role: 'user', content: prompt }],
          model: modelId,
          systemPrompt: "You are a helpful AI assistant. Provide clear and concise responses."
        }
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      if (error) {
        console.error('API Error:', error);
        throw new Error(error.message || 'API request failed');
      }

      // Handle different response formats
      let responseText = '';
      if (data) {
        responseText = data.content || data.response || data.message || JSON.stringify(data);
      }

      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response received from API');
      }

      setTestResults(prev => prev.map(result => 
        result.model === modelName 
          ? { 
              ...result, 
              response: responseText,
              responseTime,
              status: 'success' as const
            }
          : result
      ));

    } catch (error: any) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      setTestResults(prev => prev.map(result => 
        result.model === modelName 
          ? { 
              ...result, 
              responseTime,
              status: 'error' as const,
              error: error.message || 'Unknown error'
            }
          : result
      ));
    }
  };

  const handleSingleTest = async () => {
    if (!prompt.trim() || !selectedModel) {
      toast({ title: "Please enter a prompt and select a model", variant: "destructive" });
      return;
    }

    const model = AI_MODELS.find(m => m.id === selectedModel);
    if (!model) return;

    // Initialize result for this model
    setTestResults([{
      model: model.name,
      response: '',
      responseTime: 0,
      status: 'idle'
    }]);

    await testSingleModel(selectedModel, model.name);
  };

  const handleTestAll = async () => {
    if (!prompt.trim()) {
      toast({ title: "Please enter a prompt", variant: "destructive" });
      return;
    }

    setIsTestingAll(true);
    
    // Initialize results for all models
    const initialResults: TestResult[] = AI_MODELS.map(model => ({
      model: model.name,
      response: '',
      responseTime: 0,
      status: 'idle'
    }));
    
    setTestResults(initialResults);

    // Test all models in parallel
    const testPromises = AI_MODELS.map(model => 
      testSingleModel(model.id, model.name)
    );

    await Promise.allSettled(testPromises);
    setIsTestingAll(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Model Testing</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Input Section */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Test Prompt</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your test prompt (e.g., 'Tell me about metformin dosing')"
                rows={3}
                className="w-full"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Select Model (Single Test)</label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an AI model" />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name} ({model.service})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-4">
              <Button 
                onClick={handleSingleTest}
                disabled={!prompt.trim() || !selectedModel}
                className="flex items-center gap-2"
              >
                <PlayCircle className="h-4 w-4" />
                Test Selected Model
              </Button>
              
              <Button 
                onClick={handleTestAll}
                disabled={!prompt.trim() || isTestingAll}
                variant="outline"
                className="flex items-center gap-2"
              >
                {isTestingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                Test All Models
              </Button>
            </div>
          </div>

          {/* Results Section */}
          {testResults.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Test Results</h3>
              
              <div className="grid gap-4">
                {testResults.map((result, index) => (
                  <Card key={index} className="w-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          {getStatusIcon(result.status)}
                          {result.model}
                        </CardTitle>
                        
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(result.status)}>
                            {result.status}
                          </Badge>
                          
                          {result.responseTime > 0 && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {result.responseTime}ms
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      {result.status === 'pending' && (
                        <div className="flex items-center gap-2 text-blue-600">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Testing in progress...
                        </div>
                      )}
                      
                      {result.status === 'error' && (
                        <div className="text-red-600">
                          <strong>Error:</strong> {result.error}
                        </div>
                      )}
                      
                      {result.status === 'success' && result.response && (
                        <div className="space-y-2">
                          <div className="text-sm text-gray-600">Response:</div>
                          <div className="bg-gray-50 p-3 rounded-md text-sm whitespace-pre-wrap">
                            {result.response}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Summary for test all */}
              {testResults.length > 1 && (
                <Card className="border-2 border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-base">Performance Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="font-medium text-green-600">Successful</div>
                        <div>{testResults.filter(r => r.status === 'success').length}</div>
                      </div>
                      <div>
                        <div className="font-medium text-red-600">Failed</div>
                        <div>{testResults.filter(r => r.status === 'error').length}</div>
                      </div>
                      <div>
                        <div className="font-medium text-blue-600">Average Time</div>
                        <div>
                          {testResults.filter(r => r.status === 'success' && r.responseTime > 0).length > 0
                            ? Math.round(
                                testResults
                                  .filter(r => r.status === 'success' && r.responseTime > 0)
                                  .reduce((sum, r) => sum + r.responseTime, 0) /
                                testResults.filter(r => r.status === 'success' && r.responseTime > 0).length
                              )
                            : 0}ms
                        </div>
                      </div>
                      <div>
                        <div className="font-medium text-purple-600">Fastest</div>
                        <div>
                          {testResults.filter(r => r.status === 'success' && r.responseTime > 0).length > 0
                            ? Math.min(
                                ...testResults
                                  .filter(r => r.status === 'success' && r.responseTime > 0)
                                  .map(r => r.responseTime)
                              )
                            : 0}ms
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}