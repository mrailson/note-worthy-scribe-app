import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Clock, Zap, Brain, TrendingUp, Copy, RotateCcw, ChevronDown } from "lucide-react";
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
  apiUsed?: string;
  streamingEnabled?: boolean;
  responsesAPIUsed?: boolean;
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
    'claude-4-sonnet', 'gpt', 'grok-beta'
  ]);
  const [useResponsesAPI, setUseResponsesAPI] = useState(false);
  const [enableStreaming, setEnableStreaming] = useState(false);
  const [isModelSectionOpen, setIsModelSectionOpen] = useState(true);
  const [testMode, setTestMode] = useState<'fast' | 'quality'>('fast');
  const [nhsVerificationResults, setNhsVerificationResults] = useState<any[]>([]);
  const [challengeResults, setChallengeResults] = useState<any[]>([]);
  const [showRawJSON, setShowRawJSON] = useState(false);
  const [rawResponses, setRawResponses] = useState<any[]>([]);

  const availableModels = [
    { id: 'claude-4-sonnet', name: 'Claude 4 Sonnet', color: 'bg-orange-500' },
    { id: 'claude-4-opus', name: 'Claude 4 Opus', color: 'bg-purple-500' },
    { id: 'gpt', name: 'GPT-4o', color: 'bg-blue-500' },
    { id: 'gpt-5', name: 'GPT-5', color: 'bg-emerald-500' },
    { id: 'chatgpt5', name: 'GPT-4o Mini', color: 'bg-teal-500' },
    { id: 'grok-beta', name: 'Grok', color: 'bg-red-500' },
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
      category: "NHS Verification Test",
      prompt: "Is a healthy 70-year-old eligible for flu vaccination under NHS England AW 2025/26 programme?"
    },
    {
      category: "Challenge & Verify",
      prompt: "Reply with PONG."
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

  const selectAllModels = () => {
    setSelectedModels(availableModels.map(model => model.id));
  };

  const unselectAllModels = () => {
    setSelectedModels([]);
  };

  const allModelsSelected = selectedModels.length === availableModels.length;

  const runTests = async () => {
    if (!prompt.trim() || selectedModels.length === 0) {
      toast.error('Please enter a prompt and select at least one model');
      return;
    }

    setIsRunning(true);
    setRawResponses([]); // Clear previous raw responses
    
    const initialResults: APITestResult[] = selectedModels.map(model => ({
      model,
      response: '',
      responseTime: 0,
      status: 'running' as const,
      startTime: Date.now()
    }));
    
    setResults(initialResults);

    // Configure test parameters based on mode
    const testConfig = testMode === 'fast' 
      ? { 
          model: 'gpt-4o-mini', 
          maxTokens: 256, 
          temperature: 0.2,
          systemPrompt: "You are a helpful AI assistant. Provide clear, concise responses." 
        }
      : { 
          model: 'gpt-4o', 
          maxTokens: 1024, 
          temperature: 0.2,
          systemPrompt: "You are a helpful AI assistant. Provide clear, detailed, and accurate responses." 
        };

    // Run tests in parallel for all selected models
    const testPromises = selectedModels.map(async (model, index) => {
      try {
        const startTime = Date.now();
        
        const { data, error } = await supabase.functions.invoke('api-testing-service', {
          body: {
            prompt,
            model: testMode === 'fast' ? 'chatgpt5' : model, // Use fast model in FAST mode
            systemPrompt: testConfig.systemPrompt,
            useResponsesAPI,
            enableStreaming,
            testMode,
            maxTokens: testConfig.maxTokens,
            temperature: testConfig.temperature
          }
        });

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        if (error) throw error;

        // Store raw response for debugging
        setRawResponses(prev => [...prev, { model, data, timestamp: Date.now() }]);

        // Update results immediately when each test completes
        setResults(prev => prev.map((result, i) => 
          i === index ? {
            ...result,
            response: data.response,
            responseTime,
            tokensPerSecond: data.tokensPerSecond,
            apiUsed: data.apiUsed,
            streamingEnabled: data.streamingEnabled,
            responsesAPIUsed: data.responsesAPIUsed,
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
    
    // Run NHS verification if relevant
    if (prompt.toLowerCase().includes('nhs') || prompt.toLowerCase().includes('vaccination') || prompt.toLowerCase().includes('eligible')) {
      await runNHSVerification();
    }

    // Run Challenge & Verify if it's the PONG test
    if (prompt.toLowerCase().includes('pong')) {
      await runChallengeVerify();
    }
    
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

  const runNHSVerification = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('nhs-verification-service', {
        body: {
          originalPrompt: prompt,
          responses: results.filter(r => r.status === 'completed').map(r => ({
            model: r.model,
            response: r.response
          }))
        }
      });

      if (error) throw error;
      setNhsVerificationResults([data]);
    } catch (error) {
      console.error('NHS verification error:', error);
    }
  };

  const runChallengeVerify = async () => {
    try {
      const completedResults = results.filter(r => r.status === 'completed');
      const challengePromises = completedResults.map(async (result) => {
        const { data, error } = await supabase.functions.invoke('challenge-verify-service', {
          body: {
            originalPrompt: prompt,
            previousAnswer: result.response,
            model: result.model
          }
        });

        if (error) throw error;
        return { model: result.model, verification: data };
      });

      const verificationResults = await Promise.all(challengePromises);
      setChallengeResults(verificationResults);
    } catch (error) {
      console.error('Challenge & Verify error:', error);
    }
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
                {/* Model Selection - Collapsible */}
                <Collapsible open={isModelSectionOpen} onOpenChange={setIsModelSectionOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-0 h-auto text-sm font-medium"
                    >
                      <span>Select Models to Test ({selectedModels.length} selected)</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          isModelSectionOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-3">
                    {/* Select/Unselect All Buttons */}
                    <div className="flex gap-2 mb-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectAllModels}
                        disabled={allModelsSelected}
                        className="flex-1 text-xs"
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={unselectAllModels}
                        disabled={selectedModels.length === 0}
                        className="flex-1 text-xs"
                      >
                        Unselect All
                      </Button>
                    </div>
                    
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
                  </CollapsibleContent>
                </Collapsible>

                {/* Test Mode Selection */}
                <div className="space-y-4">
                  <label className="text-sm font-medium block">Test Mode</label>
                  
                  <div className="flex gap-2">
                    <Button
                      variant={testMode === 'fast' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTestMode('fast')}
                      className="flex-1"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      FAST
                    </Button>
                    <Button
                      variant={testMode === 'quality' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTestMode('quality')}
                      className="flex-1"
                    >
                      <Brain className="w-4 h-4 mr-2" />
                      QUALITY
                    </Button>
                  </div>
                  
                  <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    {testMode === 'fast' ? (
                      <div>
                        <strong>FAST Mode:</strong> gpt-4o-mini, 256 tokens max, temperature 0.2
                        <br />Optimized for speed and quick responses
                      </div>
                    ) : (
                      <div>
                        <strong>QUALITY Mode:</strong> gpt-4o, 512-1024 tokens max, temperature 0.2
                        <br />Optimized for detailed, high-quality responses
                      </div>
                    )}
                  </div>
                </div>

                {/* API Configuration */}
                <div className="space-y-4">
                  <label className="text-sm font-medium block">API Configuration</label>
                  
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="useResponsesAPI"
                        checked={useResponsesAPI}
                        onChange={(e) => setUseResponsesAPI(e.target.checked)}
                        className="w-4 h-4 rounded border-border"
                      />
                      <label htmlFor="useResponsesAPI" className="text-sm font-medium">
                        Use OpenAI Responses API
                      </label>
                      <Badge variant="secondary" className="text-xs">
                        New
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      Uses OpenAI's new /v1/responses endpoint instead of /v1/chat/completions for better performance
                    </p>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="enableStreaming"
                        checked={enableStreaming}
                        onChange={(e) => setEnableStreaming(e.target.checked)}
                        className="w-4 h-4 rounded border-border"
                      />
                      <label htmlFor="enableStreaming" className="text-sm font-medium">
                        Enable Streaming
                      </label>
                      <Badge variant="secondary" className="text-xs">
                        Faster
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      Stream responses as they're generated to reduce perceived latency
                    </p>
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
                    <>
                      <Button variant="outline" onClick={clearResults} className="w-full">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Clear Results
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        onClick={() => setShowRawJSON(!showRawJSON)} 
                        className="w-full text-xs"
                      >
                        {showRawJSON ? 'Hide' : 'Show'} Raw JSON Panel
                      </Button>
                    </>
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
                    <TabsList className="grid w-full grid-cols-6">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="responses">Responses</TabsTrigger>
                      <TabsTrigger value="analysis">Analysis</TabsTrigger>
                      <TabsTrigger value="nhs-verify">NHS Verify</TabsTrigger>
                      <TabsTrigger value="challenge">Challenge</TabsTrigger>
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
                                 {result.status === 'completed' && result.apiUsed && (
                                   <Badge variant="outline" className="text-xs">
                                     {result.apiUsed}
                                   </Badge>
                                 )}
                                 {result.status === 'completed' && result.streamingEnabled && (
                                   <Badge variant="secondary" className="text-xs">
                                     Streaming
                                   </Badge>
                                 )}
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
                                   {result.apiUsed && (
                                     <Badge variant="outline" className="text-xs">
                                       {result.apiUsed}
                                     </Badge>
                                   )}
                                   {result.streamingEnabled && (
                                     <Badge variant="secondary" className="text-xs">
                                       Streaming
                                     </Badge>
                                   )}
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

                    <TabsContent value="nhs-verify" className="space-y-4">
                      {nhsVerificationResults.length > 0 ? (
                        <div className="space-y-4">
                          {nhsVerificationResults.map((result, index) => (
                            <Card key={index}>
                              <CardHeader>
                                <CardTitle className="text-sm flex items-center gap-2">
                                  🏥 NHS England Verification Panel
                                  <Badge variant="outline">Source: NHS England</Badge>
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div>
                                  <h4 className="font-medium mb-2">Eligibility Criteria (Verbatim):</h4>
                                  <div className="bg-muted/50 p-3 rounded-lg text-sm">
                                    {result.eligibilityCriteria}
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="font-medium mb-2">Programme Dates:</h4>
                                  <div className="bg-muted/50 p-3 rounded-lg text-sm">
                                    {result.programmeDates}
                                  </div>
                                </div>

                                <div>
                                  <h4 className="font-medium mb-2">Verification:</h4>
                                  <div className={`p-3 rounded-lg text-sm ${
                                    result.verdict === 'correct' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                                  }`}>
                                    <strong>Verdict:</strong> {result.verdict}
                                    <br />
                                    <strong>Explanation:</strong> {result.explanation}
                                  </div>
                                </div>

                                <div>
                                  <h4 className="font-medium mb-2">References:</h4>
                                  <div className="space-y-1">
                                    {result.references?.map((ref: string, i: number) => (
                                      <div key={i} className="text-xs text-blue-600 underline">
                                        {ref}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <Card>
                          <CardContent className="py-12 text-center">
                            <h3 className="text-lg font-medium mb-2">NHS Verification Panel</h3>
                            <p className="text-muted-foreground">
                              Run a test with NHS-related queries to see source-of-truth verification from NHS England.
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="challenge" className="space-y-4">
                      {challengeResults.length > 0 ? (
                        <div className="space-y-4">
                          {challengeResults.map((result, index) => (
                            <Card key={index}>
                              <CardHeader>
                                <CardTitle className="text-sm flex items-center gap-2">
                                  ⚡ Challenge & Verify - {result.model}
                                  <Badge variant="outline">Accuracy Check</Badge>
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div>
                                  <h4 className="font-medium mb-2">Original Response:</h4>
                                  <div className="bg-muted/50 p-3 rounded-lg text-sm">
                                    {result.verification.originalResponse}
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="font-medium mb-2">Verification Analysis:</h4>
                                  <div className={`p-3 rounded-lg text-sm ${
                                    result.verification.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
                                  }`}>
                                    <strong>Status:</strong> {result.verification.isCorrect ? 'Correct' : 'Needs Correction'}
                                    <br />
                                    <strong>Analysis:</strong> {result.verification.analysis}
                                  </div>
                                </div>

                                {result.verification.correctedAnswer && (
                                  <div>
                                    <h4 className="font-medium mb-2">Corrected Response:</h4>
                                    <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm">
                                      {result.verification.correctedAnswer}
                                    </div>
                                  </div>
                                )}

                                <div>
                                  <h4 className="font-medium mb-2">Confidence Score:</h4>
                                  <div className="flex items-center gap-2">
                                    <Progress value={result.verification.confidence * 100} className="flex-1" />
                                    <span className="text-sm font-mono">{(result.verification.confidence * 100).toFixed(1)}%</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <Card>
                          <CardContent className="py-12 text-center">
                            <h3 className="text-lg font-medium mb-2">Challenge & Verify</h3>
                            <p className="text-muted-foreground">
                              Use the "Reply with PONG" test to see AI response verification and correction.
                            </p>
                          </CardContent>
                        </Card>
                      )}
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

            {/* Raw JSON Panel */}
            {showRawJSON && rawResponses.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-sm">Raw JSON Responses</CardTitle>
                </CardHeader>
                <CardContent>
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="text-xs">
                        View Raw API Responses ({rawResponses.length})
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-4 mt-4">
                        {rawResponses.map((response, index) => (
                          <div key={index} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">{response.model}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(response.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <pre className="text-xs bg-muted/50 p-2 rounded overflow-auto max-h-40">
                              {JSON.stringify(response.data, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
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