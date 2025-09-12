import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter } from 'recharts';
import { CheckCircle, XCircle, AlertTriangle, Clock, PlayCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AIModelData {
  model: string;
  service: string;
  confidenceScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  responseTime: number;
  successRate: number;
  status: 'success' | 'failed' | 'timeout';
  agreementLevel?: number;
}

export const AIModelVerificationChart: React.FC = () => {
  const [isRunningBatchTest, setIsRunningBatchTest] = useState(false);
  // Data extracted from edge function logs
  const modelData: AIModelData[] = [
    {
      model: 'gpt-4o-mini',
      service: 'OpenAI',
      confidenceScore: 87,
      riskLevel: 'low',
      responseTime: 5759,
      successRate: 100,
      status: 'success',
      agreementLevel: 85
    },
    {
      model: 'claude-3-5-haiku',
      service: 'Claude',
      confidenceScore: 87,
      riskLevel: 'low',
      responseTime: 6231,
      successRate: 100,
      status: 'success',
      agreementLevel: 88
    },
    {
      model: 'gemini-pro',
      service: 'Google',
      confidenceScore: 0,
      riskLevel: 'high',
      responseTime: 0,
      successRate: 0,
      status: 'failed',
      agreementLevel: 0
    },
    {
      model: 'grok-2',
      service: 'Grok',
      confidenceScore: 0,
      riskLevel: 'high',
      responseTime: 0,
      successRate: 0,
      status: 'failed',
      agreementLevel: 0
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'timeout': return <Clock className="w-4 h-4 text-amber-600" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const performanceData = modelData.map(model => ({
    name: model.service,
    confidence: model.confidenceScore,
    speed: model.responseTime > 0 ? Math.max(0, 10000 - model.responseTime) / 100 : 0,
    reliability: model.successRate,
    agreement: model.agreementLevel || 0
  }));

  const confidenceData = modelData.map(model => ({
    service: model.service,
    confidence: model.confidenceScore,
    responseTime: model.responseTime / 1000, // Convert to seconds
    status: model.status
  }));

  const handleRunBatchTest = async () => {
    setIsRunningBatchTest(true);
    toast.info('Starting batch clinical verification tests...');
    
    try {
      const { data, error } = await supabase.functions.invoke('clinical-verification-batch-test');
      
      if (error) {
        console.error('Batch test error:', error);
        toast.error('Failed to run batch tests: ' + error.message);
      } else {
        console.log('Batch test results:', data);
        toast.success(`Batch testing completed! ${data.summary?.completedTests}/${data.summary?.totalTests} tests successful`);
      }
    } catch (error) {
      console.error('Error running batch tests:', error);
      toast.error('Error running batch tests');
    } finally {
      setIsRunningBatchTest(false);
    }
  };

  return (
    <div className="space-y-6 text-base">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                📊 AI Model Verification Performance Analysis
              </CardTitle>
              <CardDescription className="text-base">
                Comparison of AI models using BNF Metformin verification task
              </CardDescription>
            </div>
            <Button
              onClick={handleRunBatchTest}
              disabled={isRunningBatchTest}
              variant="outline"
              size="sm"
            >
              {isRunningBatchTest ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Run 5 More Tests
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Model Status Overview */}
            <div className="space-y-4">
              <h3 className="font-semibold text-xl">Model Status Overview</h3>
              <div className="space-y-3">
                {modelData.map((model, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(model.status)}
                      <div>
                        <span className="font-medium text-lg">{model.service}</span>
                        <div className="text-base text-muted-foreground">{model.model}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getRiskBadgeVariant(model.riskLevel)} className="text-sm">
                        {model.riskLevel} risk
                      </Badge>
                      <span className="text-base font-medium">
                        {model.confidenceScore}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Confidence Score Chart */}
            <div>
              <h3 className="font-semibold text-xl mb-4">Confidence Scores</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={confidenceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="service" style={{ fontSize: '14px' }} />
                  <YAxis domain={[0, 100]} style={{ fontSize: '14px' }} />
                  <Tooltip />
                  <Bar 
                    dataKey="confidence" 
                    fill="hsl(var(--primary))"
                    name="Confidence Score"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Performance Radar Chart */}
          <div className="mt-6">
            <h3 className="font-semibold text-xl mb-4">Multi-Dimensional Performance</h3>
            <ResponsiveContainer width="100%" height={450}>
              <RadarChart data={performanceData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="name" style={{ fontSize: '14px' }} />
                <PolarRadiusAxis domain={[0, 100]} style={{ fontSize: '14px' }} />
                <Radar
                  name="Confidence"
                  dataKey="confidence"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.1}
                />
                <Radar
                  name="Speed"
                  dataKey="speed"
                  stroke="hsl(var(--secondary))"
                  fill="hsl(var(--secondary))"
                  fillOpacity={0.1}
                />
                <Radar
                  name="Reliability"
                  dataKey="reliability"
                  stroke="hsl(var(--accent))"
                  fill="hsl(var(--accent))"
                  fillOpacity={0.1}
                />
                <Radar
                  name="Agreement"
                  dataKey="agreement"
                  stroke="hsl(var(--muted-foreground))"
                  fill="hsl(var(--muted-foreground))"
                  fillOpacity={0.1}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Response Time vs Confidence Scatter */}
          <div className="mt-6">
            <h3 className="font-semibold text-xl mb-4">Response Time vs Confidence</h3>
            <ResponsiveContainer width="100%" height={350}>
              <ScatterChart data={confidenceData.filter(d => d.responseTime > 0)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="responseTime" 
                  name="Response Time (seconds)"
                  label={{ value: 'Response Time (seconds)', position: 'insideBottom', offset: -10, fontSize: 14 }}
                  style={{ fontSize: '14px' }}
                />
                <YAxis 
                  dataKey="confidence" 
                  name="Confidence Score"
                  label={{ value: 'Confidence Score (%)', angle: -90, position: 'insideLeft', fontSize: 14 }}
                  domain={[0, 100]}
                  style={{ fontSize: '14px' }}
                />
                <Tooltip 
                  formatter={(value, name) => [
                    `${value}${name === 'confidence' ? '%' : 's'}`, 
                    name === 'confidence' ? 'Confidence' : 'Response Time'
                  ]}
                  labelFormatter={(value, payload) => 
                    payload && payload[0] ? `${payload[0].payload.service}` : ''
                  }
                />
                <Scatter 
                  dataKey="confidence" 
                  fill="hsl(var(--primary))"
                  name="AI Models"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Key Insights */}
          <div className="mt-6 p-5 bg-muted/30 rounded-lg">
            <h3 className="font-semibold text-xl mb-3">Key Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-base">
              <div>
                <h4 className="font-medium text-green-700 mb-2 text-lg">✅ Best Performers</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• <strong>Claude (88% agreement)</strong> - Highest consensus</li>
                  <li>• <strong>OpenAI (87% confidence)</strong> - Fastest response</li>
                  <li>• Both achieve 100% success rate</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-red-700 mb-2 text-lg">❌ Failed Models</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• <strong>Google Gemini</strong> - 403 Forbidden error</li>
                  <li>• <strong>Grok</strong> - 404 Not Found error</li>
                  <li>• Both require API configuration</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="mt-4 p-5 border-l-4 border-primary bg-primary/5 rounded-r-lg">
            <h4 className="font-semibold text-primary mb-2 text-lg">🎯 Recommendations</h4>
            <ul className="text-base space-y-1">
              <li>• <strong>Primary:</strong> Use Claude 3.5 Haiku for highest agreement scores</li>
              <li>• <strong>Secondary:</strong> Use OpenAI GPT-4o-mini for faster responses</li>
              <li>• <strong>Fallback:</strong> Configure Google Gemini and Grok APIs for redundancy</li>
              <li>• <strong>Optimal:</strong> Run both Claude + OpenAI in parallel for best coverage</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};