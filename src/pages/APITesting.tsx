import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Zap, Brain, TrendingUp, Copy, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { Header } from "@/components/Header";

interface APITestResult {
  model: string;
  response: string;
  responseTime: number;
  tokensPerSecond?: number;
  status: 'running' | 'completed' | 'error';
  error?: string;
  startTime?: number;
}

interface TestHistory {
  id: string;
  prompt: string;
  timestamp: number;
  results: APITestResult[];
  selectedModels: string[];
}

const APITesting = () => {
  const { user, loading, hasModuleAccess } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [results, setResults] = useState<APITestResult[]>([]);
  const [history, setHistory] = useState<TestHistory[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([
    'claude-4-sonnet', 'gpt-5', 'gpt', 'grok-beta'
  ]);

  const availableModels = [
    { id: 'claude-4-sonnet', name: 'Claude 4 Sonnet', color: 'bg-orange-500' },
    { id: 'claude-4-opus', name: 'Claude 4 Opus', color: 'bg-purple-500' },
    { id: 'gpt-5', name: 'GPT-5', color: 'bg-green-500' },
    { id: 'gpt', name: 'GPT-4o', color: 'bg-blue-500' },
    { id: 'grok-beta', name: 'Grok', color: 'bg-red-500' },
    { id: 'chatgpt5', name: 'ChatGPT-5', color: 'bg-teal-500' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', color: 'bg-indigo-500' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', color: 'bg-pink-500' }
  ];

  const predefinedPrompts = [
    {
      category: "Clinical Query",
      prompt: "Provide a concise BNF summary for Metformin including: adult dosing range, titration guidance, renal/hepatic adjustments, major interactions, contraindications, and common adverse effects."
    },
    {
      category: "Quick Facts",
      prompt: "What are the current NHS England guidelines for GP practice opening hours?"
    },
    {
      category: "Complex Analysis",
      prompt: "Analyze the cost-effectiveness of implementing AI-assisted diagnostics in UK primary care settings, considering NICE technology appraisal criteria, patient safety implications, and integration with existing GP workflows."
    },
    {
      category: "Code Generation",
      prompt: "Write a Python function that calculates BMI from height and weight, includes error handling, and returns appropriate NHS weight category classifications."
    }
  ];

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Header onNewMeeting={() => {}} />
        <div className="max-w-md mx-auto mt-8">
          <Card>
            <CardHeader>
              <CardTitle>API Testing & Comparison Service</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Please log in to access the API testing and comparison service.
              </p>
              <LoginForm />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }


  const toggleModel = (modelId: string) => {
    setSelectedModels(prev => 
      prev.includes(modelId) 
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId]
    );
  };

  const runTests = async () => {
    if (!prompt.trim() || selectedModels.length === 0) {
      toast.error('Please enter a prompt and select at least one model');
      return;
    }

    setIsRunning(true);
    const initialResults: APITestResult[] = selectedModels.map(model => ({
      model,
      response: '',
      responseTime: 0,
      status: 'running' as const,
      startTime: Date.now()
    }));
    
    setResults(initialResults);

    // Run tests in parallel for all selected models
    const testPromises = selectedModels.map(async (model, index) => {
      try {
        const startTime = Date.now();
        
        const { data, error } = await supabase.functions.invoke('api-testing-service', {
          body: {
            prompt,
            model,
            systemPrompt: "You are a helpful AI assistant. Provide clear, accurate responses."
          }
        });

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        if (error) throw error;

        // Update results immediately when each test completes
        setResults(prev => prev.map((result, i) => 
          i === index ? {
            ...result,
            response: data.response,
            responseTime,
            tokensPerSecond: data.tokensPerSecond,
            status: 'completed' as const
          } : result
        ));

      } catch (error) {
        console.error(`Error testing ${model}:`, error);
        setResults(prev => prev.map((result, i) => 
          i === index ? {
            ...result,
            status: 'error' as const,
            error: error.message || 'Unknown error',
            responseTime: Date.now() - (result.startTime || Date.now())
          } : result
        ));
      }
    });

    await Promise.all(testPromises);
    
    // Save to history
    const historyEntry: TestHistory = {
      id: Date.now().toString(),
      prompt,
      timestamp: Date.now(),
      results: results.filter(r => r.status === 'completed'),
      selectedModels
    };
    setHistory(prev => [historyEntry, ...prev]);
    
    setIsRunning(false);
  };

  const clearResults = () => {
    setResults([]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const getModelInfo = (modelId: string) => 
    availableModels.find(m => m.id === modelId) || { name: modelId, color: 'bg-gray-500' };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatMarkdown = (text: string) => {
    // Simple markdown formatting for better readability
    return text
      .split('\n')
      .map((line, index) => {
        // Handle headers
        if (line.startsWith('# ')) {
          return <h1 key={index} className="text-lg font-bold mt-4 mb-2">{line.substring(2)}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={index} className="text-base font-bold mt-3 mb-2">{line.substring(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={index} className="text-sm font-bold mt-2 mb-1">{line.substring(4)}</h3>;
        }
        
        // Handle bold text **text** - improved regex to catch all cases
        const boldRegex = /\*\*(.*?)\*\*/g;
        const parts = [];
        let lastIndex = 0;
        let match;
        
        while ((match = boldRegex.exec(line)) !== null) {
          // Add text before the bold
          if (match.index > lastIndex) {
            parts.push(line.substring(lastIndex, match.index));
          }
          // Add the bold text
          parts.push(<strong key={`bold-${index}-${match.index}`}>{match[1]}</strong>);
          lastIndex = match.index + match[0].length;
        }
        
        // Add remaining text after last bold
        if (lastIndex < line.length) {
          parts.push(line.substring(lastIndex));
        }
        
        // If no bold text was found, just return the line
        if (parts.length === 0) {
          parts.push(line);
        }
        
        return <p key={index} className="mb-2 leading-relaxed">{parts}</p>;
      });
  };

  const getFastestModel = () => {
    const completedResults = results.filter(r => r.status === 'completed');
    if (completedResults.length === 0) return null;
    return completedResults.reduce((fastest, current) => 
      current.responseTime < fastest.responseTime ? current : fastest
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Header onNewMeeting={() => {}} />
      
      <div className="mt-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">API Testing & Comparison Service</h1>
          <p className="text-lg text-muted-foreground">
            Test the same prompt across multiple AI models and compare response times, quality, and characteristics
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Panel */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Test Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Model Selection */}
                <div>
                  <label className="text-sm font-medium mb-3 block">Select Models to Test</label>
                  <div className="grid grid-cols-1 gap-2">
                    {availableModels.map(model => (
                      <div
                        key={model.id}
                        className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedModels.includes(model.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => toggleModel(model.id)}
                      >
                        <div className={`w-3 h-3 rounded-full ${model.color} mr-3`} />
                        <span className="text-sm font-medium">{model.name}</span>
                        {selectedModels.includes(model.id) && (
                          <div className="ml-auto w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-white" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Predefined Prompts */}
                <div>
                  <label className="text-sm font-medium mb-3 block">Quick Start Prompts</label>
                  <div className="space-y-3">
                    {predefinedPrompts.map((p, i) => (
                      <div
                        key={i}
                        className={`p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                          prompt === p.prompt 
                            ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600 ring-opacity-20 shadow-md' 
                            : 'border-border hover:border-blue-400 hover:bg-blue-50/50'
                        }`}
                        onClick={() => setPrompt(p.prompt)}
                      >
                        <div className={`font-medium text-sm mb-2 ${
                          prompt === p.prompt ? 'text-blue-700' : 'text-primary'
                        }`}>
                          {p.category}
                        </div>
                        <div className="text-xs text-muted-foreground leading-relaxed whitespace-normal break-words">
                          {p.prompt}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Prompt */}
                <div>
                  <label className="text-sm font-medium mb-3 block">Custom Prompt</label>
                  <Textarea
                    placeholder="Enter your prompt here..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    className="focus:ring-2 focus:ring-blue-600 focus:border-blue-600 border-2 transition-all duration-200"
                  />
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button 
                    onClick={runTests} 
                    disabled={isRunning || !prompt.trim() || selectedModels.length === 0}
                    className="w-full"
                  >
                    {isRunning ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                        Running Tests...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Run API Tests
                      </>
                    )}
                  </Button>

                  {results.length > 0 && (
                    <Button variant="outline" onClick={clearResults} className="w-full">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Clear Results
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2">
            {results.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Test Results
                  </CardTitle>
                  {!isRunning && results.some(r => r.status === 'completed') && (
                    <div className="text-sm text-muted-foreground">
                      Fastest response: {getFastestModel() && (
                        <Badge variant="secondary" className="ml-1">
                          {getModelInfo(getFastestModel()!.model).name} - {formatTime(getFastestModel()!.responseTime)}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="responses">Responses</TabsTrigger>
                      <TabsTrigger value="analysis">Analysis</TabsTrigger>
                      <TabsTrigger value="history">History</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                      {results.map((result, index) => {
                        const modelInfo = getModelInfo(result.model);
                        return (
                          <div key={index} className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${modelInfo.color}`} />
                                <span className="font-medium">{modelInfo.name}</span>
                                <Badge variant={
                                  result.status === 'completed' ? 'default' :
                                  result.status === 'error' ? 'destructive' : 'secondary'
                                }>
                                  {result.status}
                                </Badge>
                              </div>
                              <div className="text-right">
                                {result.status === 'completed' && (
                                  <div className="text-sm">
                                    <Clock className="w-4 h-4 inline mr-1" />
                                    {formatTime(result.responseTime)}
                                  </div>
                                )}
                              </div>
                            </div>

                            {result.status === 'running' && (
                              <div className="space-y-2">
                                <div className="text-sm text-muted-foreground">Processing...</div>
                                <Progress value={undefined} className="w-full" />
                              </div>
                            )}

                            {result.status === 'error' && (
                              <div className="text-sm text-destructive">
                                Error: {result.error}
                              </div>
                            )}

                            {result.status === 'completed' && (
                              <div className="text-sm text-muted-foreground line-clamp-3">
                                {result.response.substring(0, 200)}...
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </TabsContent>

                    <TabsContent value="responses" className="space-y-4">
                      {results.filter(r => r.status === 'completed').map((result, index) => {
                        const modelInfo = getModelInfo(result.model);
                        return (
                          <Card key={index}>
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full ${modelInfo.color}`} />
                                  <span className="font-medium">{modelInfo.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{formatTime(result.responseTime)}</Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(result.response)}
                                  >
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="text-sm space-y-1">
                                {formatMarkdown(result.response)}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </TabsContent>

                    <TabsContent value="analysis" className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Speed Analysis */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Speed Ranking</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {results
                                .filter(r => r.status === 'completed')
                                .sort((a, b) => a.responseTime - b.responseTime)
                                .map((result, index) => {
                                  const modelInfo = getModelInfo(result.model);
                                  return (
                                     <div key={result.model} className="flex items-center justify-between text-sm">
                                       <div className="flex items-center gap-2">
                                         <span className="w-4 text-center font-mono">{index + 1}</span>
                                         <div className={`w-2 h-2 rounded-full ${modelInfo.color}`} />
                                         <span>{modelInfo.name}</span>
                                       </div>
                                       <span className="font-mono">{formatTime(result.responseTime)}</span>
                                     </div>
                                  );
                                })}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Response Length */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Response Length</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {results
                                .filter(r => r.status === 'completed')
                                .sort((a, b) => b.response.length - a.response.length)
                                .map((result) => {
                                  const modelInfo = getModelInfo(result.model);
                                  return (
                                    <div key={result.model} className="flex items-center justify-between text-sm">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${modelInfo.color}`} />
                                        <span>{modelInfo.name}</span>
                                      </div>
                                      <span className="font-mono">{result.response.length} chars</span>
                                    </div>
                                  );
                                })}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Response time per 1000 chars */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Response time per 1000 chars</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {results
                                .filter(r => r.status === 'completed')
                                .sort((a, b) => {
                                  const aRatio = (a.responseTime / 1000) / (a.response.length / 1000);
                                  const bRatio = (b.responseTime / 1000) / (b.response.length / 1000);
                                  return aRatio - bRatio;
                                })
                                .map((result) => {
                                  const modelInfo = getModelInfo(result.model);
                                  const timePerThousandChars = (result.responseTime / 1000) / (result.response.length / 1000);
                                  return (
                                    <div key={result.model} className="flex items-center justify-between text-sm">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${modelInfo.color}`} />
                                        <span>{modelInfo.name}</span>
                                      </div>
                                      <span className="font-mono">{timePerThousandChars.toFixed(2)}s</span>
                                    </div>
                                  );
                                })}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Success Rate */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Success Rate</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {availableModels.map(model => {
                                const result = results.find(r => r.model === model.id);
                                const status = result?.status || 'not-tested';
                                return (
                                  <div key={model.id} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${model.color}`} />
                                      <span>{model.name}</span>
                                    </div>
                                    <Badge variant={
                                      status === 'completed' ? 'default' :
                                      status === 'error' ? 'destructive' : 'outline'
                                    }>
                                      {status === 'completed' ? 'Success' :
                                       status === 'error' ? 'Failed' : 'Not tested'}
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="history" className="space-y-4">
                      {history.length > 0 ? (
                        <div className="space-y-4">
                          {history.map((entry) => (
                            <Card key={entry.id}>
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="text-sm text-muted-foreground">
                                      {new Date(entry.timestamp).toLocaleString()}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {entry.selectedModels.length} models tested
                                    </div>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPrompt(entry.prompt)}
                                  >
                                    Reuse Prompt
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-3">
                                  <div>
                                    <div className="text-sm font-medium mb-1">Prompt:</div>
                                    <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                                      {entry.prompt.length > 200 
                                        ? `${entry.prompt.substring(0, 200)}...`
                                        : entry.prompt
                                      }
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <div className="text-sm font-medium mb-2">Results:</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {entry.results.map((result) => {
                                        const modelInfo = getModelInfo(result.model);
                                        return (
                                          <div key={result.model} className="p-2 border rounded">
                                            <div className="flex items-center gap-2 mb-1">
                                              <div className={`w-2 h-2 rounded-full ${modelInfo.color}`} />
                                              <span className="text-xs font-medium">{modelInfo.name}</span>
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {formatTime(result.responseTime)} • {result.response.length} chars
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <Card>
                          <CardContent className="py-12 text-center">
                            <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">No Test History</h3>
                            <p className="text-muted-foreground">
                              Your previous test results will appear here after running tests.
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {results.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Brain className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Tests Run Yet</h3>
                  <p className="text-muted-foreground">
                    Configure your test settings and run your first API comparison test.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default APITesting;