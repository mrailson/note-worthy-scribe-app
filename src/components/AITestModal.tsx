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
import { Loader2, TestTube, Clock, CheckCircle, XCircle, Zap, Download, ChevronDown, ChevronUp, FileText } from 'lucide-react';
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
  fullResponse?: string; // Store complete untruncated response
  responseLength?: number; // Track response length
  review?: ClinicalReview; // GPT-5 review against gold standard
}

interface ClinicalReview {
  confidenceScore: number; // 0-99
  riskLevel: 'GREEN' | 'ORANGE' | 'RED';
  overallAssessment: string;
  strengths: string[];
  concerns: string[];
  missingSections: string[];
  clinicalAccuracy: string;
  nhsCompliance: string;
  safetyRating: string;
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

const CLINICAL_TEST_QUERY = "You are an expert UK NHS GP assistant. Use only UK primary care sources including NICE guidelines, NHS.uk, BNF, MHRA alerts, the Green Book, and local ICB protocols. Do not use non-UK or non-NHS sources. Present information in concise, GP-friendly bullet points using UK medical terminology. Provide a concise BNF summary including: adult dosing range, titration guidance, renal/hepatic adjustments, major interactions, contraindications, and common adverse effects. Metformin.";

// Simple markdown formatter for basic formatting
const formatText = (text: string) => {
  if (!text) return text;
  
  return text
    // Bold text **text** -> <strong>text</strong>
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic text *text* -> <em>text</em>
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>')
    // Headers ### -> <h3>
    .replace(/^### (.*$)/gm, '<h3 class="font-semibold text-sm mt-2 mb-1">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="font-semibold text-base mt-2 mb-1">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="font-bold text-lg mt-2 mb-1">$1</h1>')
    // Bullet points
    .replace(/^- (.*$)/gm, '<div class="ml-3">• $1</div>')
    // Line breaks
    .replace(/\n/g, '<br/>');
};

// Component to render formatted text
const FormattedText: React.FC<{ text: string; className?: string }> = ({ text, className = "" }) => {
  return (
    <div 
      className={className} 
      dangerouslySetInnerHTML={{ __html: formatText(text) }}
    />
  );
};

const clinicalQuickPicks = [
  {
    title: "BNF Drug Lookup – Ramipril",
    category: "Clinical - BNF Drugs",
    prompt: "You are an expert UK NHS GP assistant. Use only UK primary care sources: NICE guidance, NHS.uk, BNF, MHRA Drug Safety Update/alerts, the Green Book (if relevant), and local ICB protocols. Do not use non-UK sources. Present concise, GP-friendly bullet points in UK medical terminology.\nProduce exactly these sections:\n\nIndications (adult, primary care)\nAdult dosing & titration (include starting dose, up-titration intervals, BP/U&E checks)\nRenal/hepatic adjustment (eGFR/Cr thresholds; when to avoid/seek specialist advice)\nMajor interactions (e.g., NSAIDs, K-sparing diuretics, lithium)\nContraindications & cautions (pregnancy, bilateral RAS, hypotension, hyperkalaemia)\nMonitoring (U&E/K⁺ timing after initiation/titration; BP targets)\nCommon adverse effects\nSick-day rules\nReferences (BNF/NICE/MHRA/ICB with titles + URLs)\n\nDrug: Ramipril. If information is not present in UK sources, state \"Not specified in UK sources\" and do not infer.",
    goldStandard: "Indications (adult): Hypertension; symptomatic heart failure; post-MI; diabetic nephropathy (per local pathways).\n\nAdult dosing & titration (HTN): Start 2.5–5 mg once daily; titrate to BP target; max 10 mg daily (once daily or 5 mg bd). HF/post-MI often start lower (e.g., 1.25 mg od), up-titrate. Check U&E/K⁺ before, and 1–2 weeks after initiation/dose change. Avoid abrupt up-titration on diuretics/elderly.\n\nRenal/hepatic: Caution in renal impairment; avoid in bilateral renal artery stenosis. Hold during intercurrent illness (see Sick-day rules).\n\nMajor interactions: NSAIDs, K-sparing diuretics/potassium, lithium, other antihypertensives (hypotension).\n\nContraindications/cautions: Pregnancy, history of ACE-i angioedema, severe aortic stenosis, hyperkalaemia.\n\nMonitoring: BP; U&E/K⁺ at baseline and after dose changes; watch for cough/renal function changes.\n\nCommon AEs: Cough, dizziness, hyperkalaemia, renal impairment.\n\nSick-day rules: Pause ACE-i during dehydration/AKI risk (vomiting/diarrhoea; NSAID use).\n\nReferences: NHS medicines: ramipril; NICE CKS (ACE-i dosing/starts)."
  },
  {
    title: "BNF Drug Lookup – Sertraline",
    category: "Clinical - BNF Drugs",
    prompt: "You are an expert UK NHS GP assistant. Use only UK primary care sources: NICE guidance, NHS.uk, BNF, MHRA Drug Safety Update/alerts, the Green Book (if relevant), and local ICB protocols. Do not use non-UK sources. Present concise, GP-friendly bullet points in UK medical terminology.\nProduce exactly these sections:\n\nIndications\nAdult dosing & titration (onset/time to effect)\nRenal/hepatic guidance\nMajor interactions (MAOIs, linezolid, triptans, warfarin, QTc cautions)\nContraindications & cautions (serotonin syndrome risks, switching rules)\nMonitoring\nCommon adverse effects\nPregnancy/breastfeeding (UK sources)\nReferences\n\nDrug: Sertraline.",
    goldStandard: "Indications: Depression, GAD, panic disorder, PTSD, OCD (adult).\n\nAdult dosing & titration: 50 mg od initially; increase by 50 mg steps at ≥1-week intervals to max 200 mg od. Time to effect ~1–2 weeks; reassess 4–6 weeks.\n\nRenal/hepatic: Use lower doses/caution in hepatic impairment.\n\nMajor interactions: MAOIs/linezolid (contraindicated/serotonin syndrome), triptans, warfarin (monitor INR), other serotonergic drugs; alcohol caution.\n\nContraindications/cautions: Current/recent MAOI; significant QTc risks (caution); seizure disorder.\n\nMonitoring: Symptom response, suicidality early in treatment, bleeding risk with NSAIDs/anticoagulants.\n\nCommon AEs: GI upset, insomnia/somnolence, sexual dysfunction, headache.\n\nPregnancy/breastfeeding: May be used if benefits outweigh risks—use UK sources for shared decision.\n\nReferences: NHS sertraline; NICE CKS antidepressant dosing."
  },
  {
    title: "BNF Drug Lookup – Apixaban (DOAC)",
    category: "Clinical - BNF Drugs",
    prompt: "You are an expert UK NHS GP assistant. Use only UK primary care sources: NICE guidance, NHS.uk, BNF, MHRA Drug Safety Update/alerts, the Green Book (if relevant), and local ICB protocols. Do not use non-UK sources. Present concise, GP-friendly bullet points in UK medical terminology.\nProduce exactly these sections:\n\nIndications (NVAF, DVT/PE tx & prophylaxis)\nAdult dosing (include renal criteria, age/weight/Cr thresholds for dose reduction)\nPeri-procedural advice (primary-care scope)\nMajor interactions (strong CYP3A4/P-gp)\nContraindications & cautions\nMonitoring (renal function interval, adherence)\nPatient counselling & bleeding red flags\nReferences\n\nDrug: Apixaban.",
    goldStandard: "Indications: NVAF (stroke prevention); DVT/PE treatment and prophylaxis.\n\nAdult dosing (examples):\nNVAF: 5 mg bd; consider 2.5 mg bd if older/frail/renal criteria met per UK guidance.\nDVT/PE tx: 10 mg bd for 7 days, then 5 mg bd.\n\nRenal/hepatic: Dose-reduce/avoid with significant renal impairment; avoid in hepatic disease with coagulopathy—check UK monographs.\n\nMajor interactions: Strong P-gp/CYP3A4 inhibitors/inducers; avoid dual anticoagulation; additive bleed with antiplatelets/NSAIDs.\n\nContraindications/cautions: Active bleeding; lesions at high bleed risk; severe hepatic disease.\n\nMonitoring: Baseline renal/hepatic function; periodic renal check; adherence; bleed red flags and counselling.\n\nReferences: NHS apixaban; MHRA DOAC safety; SPS DOAC interactions."
  },
  {
    title: "Hypertension – Adult Primary Care Management",
    category: "Clinical - Guidelines",
    prompt: "You are an expert UK NHS GP assistant. Use only UK primary care sources: NICE guidance, NHS.uk, BNF, MHRA Drug Safety Update/alerts, the Green Book (if relevant), and local ICB protocols. Do not use non-UK sources. Present concise, GP-friendly bullet points in UK medical terminology.\nProduce exactly these sections:\n\nDiagnosis & confirmation (clinic vs ABPM/HBPM thresholds)\nTreatment targets (age/diabetes/CKD nuance)\nStepwise drug algorithm (A/C/D sequence; considerations for Black African/Caribbean heritage and diabetes) with BNF starting doses\nMonitoring (U&E, BP review cadence)\nLifestyle advice (concise)\nWhen to refer / urgent red flags\nFollow-up intervals\nReferences (NICE/BNF/ICB with URLs).",
    goldStandard: "Diagnosis: Confirm with ABPM/HBPM; base ABPM on average daytime readings.\n\nTargets (individualise): See visual summary—age/comorbidity specific; aim clinic <140/90 mmHg (or lower if tolerated) in most adults; lower targets in DM/CKD as per NICE.\n\nStepwise drugs:\nStep 1: A-drug (ACE-i/ARB) if ≤55 y; CCB if ≥55 y or African/Caribbean family origin (prefer ARB over ACE-i in this group).\nStep 2: A + C. Step 3: A + C + D (thiazide-like). Step 4: Consider spironolactone/alpha-/beta-blocker and specialist advice.\n\nMonitoring: U&E/K⁺ after RAAS up-titration; annual review; lifestyle advice.\n\nRed flags: Same-day if accelerated HTN (retinal haemorrhage/papilloedema) or life-threatening symptoms.\n\nReferences: NICE NG136 (visual & guideline pages)."
  },
  {
    title: "Adult Asthma – Acute Exacerbation",
    category: "Clinical - Emergency",
    prompt: "You are an expert UK NHS GP assistant. Use only UK primary care sources: NICE guidance, NHS.uk, BNF, MHRA Drug Safety Update/alerts, the Green Book (if relevant), and local ICB protocols. Do not use non-UK sources. Present concise, GP-friendly bullet points in UK medical terminology.\nProduce exactly these sections:\n\nSeverity assessment\nImmediate treatment (inhaled SABA doses; oral prednisolone BNF dosing)\nOxygen/peak flow targets\nWhen to admit/999\nPost-exacerbation review (ICS step-up, inhaler technique, adherence)\nSafety-netting\nFollow-up timeline\nReferences.",
    goldStandard: "Assess severity: PEFR %, RR, SpO₂, speech, cyanosis, exhaustion.\n\nImmediate treatment: Inhaled SABA via spacer/nebuliser; give oral prednisolone 40–50 mg once daily (adult) immediately; oxygen if hypoxic; consider ipratropium in moderate–severe attacks.\n\nRefer 999/admit: Life-threatening features or poor response.\n\nPost-exacerbation: Check inhaler technique/adherence; step-up controller; provide written action plan; arrange follow-up.\n\nReferences: NICE CKS (Asthma – acute exacerbation); NHS prednisolone usage advice."
  }
];

export const AITestModal: React.FC<AITestModalProps> = ({ open, onOpenChange }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].id);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [clinicalResults, setClinicalResults] = useState<ClinicalTestResult[]>([]);
  const [isClinicalTesting, setIsClinicalTesting] = useState(false);
  const [testRunTime, setTestRunTime] = useState<string>('');
  const [selectedClinicalQuery, setSelectedClinicalQuery] = useState(CLINICAL_TEST_QUERY);
  const [selectedClinicalTitle, setSelectedClinicalTitle] = useState('Default Metformin Query');
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const testSingleModel = async (modelId: string): Promise<TestResult> => {
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-api-test', {
        body: {
          model: modelId,
          prompt: prompt
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
        responseTime: data.responseTime || responseTime,
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

  // Helper function to get gold standard for current query
  const getCurrentGoldStandard = (): string | null => {
    const currentPick = clinicalQuickPicks.find(pick => pick.prompt === selectedClinicalQuery);
    return currentPick?.goldStandard || null;
  };

  // GPT-5 Review function
  const runGPT5Review = async (modelOutput: string, goldStandard: string, queryTitle: string): Promise<ClinicalReview | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('gpt5-clinical-reviewer', {
        body: {
          modelOutput,
          goldStandard,
          queryTitle
        }
      });

      if (error) {
        console.error('GPT-5 Review Error:', error);
        return null;
      }

      return data.review;
    } catch (error) {
      console.error('Error calling GPT-5 reviewer:', error);
      return null;
    }
  };

  const testClinicalPerformance = async (service: 'standard' | 'fast', model: string): Promise<ClinicalTestResult> => {
    const startTime = Date.now();
    
    try {
      let data, error;
      
      if (service === 'fast') {
        // Use gpt5-fast-clinical with correct format
        const response = await supabase.functions.invoke('gpt5-fast-clinical', {
          body: {
            messages: [{ role: 'user', content: selectedClinicalQuery }],
            model: model,
            systemPrompt: 'You are a clinical AI assistant providing accurate medical information based on UK NHS guidelines.'
          }
        });
        data = response.data;
        error = response.error;
      } else {
        // Use ai-4-pm-chat with correct format
        const response = await supabase.functions.invoke('ai-4-pm-chat', {
          body: {
            messages: [{ role: 'user', content: selectedClinicalQuery }],
            model: model,
            systemPrompt: 'You are a clinical AI assistant providing accurate medical information based on UK NHS guidelines.',
            verificationLevel: 'clinical'
          }
        });
        data = response.data;
        error = response.error;
      }

      const responseTime = Date.now() - startTime;

      if (error) {
        return {
          model: model,
          service: service === 'fast' ? 'Fast Clinical' : 'Standard AI',
          response: `Error: ${error.message}`,
          responseTime,
          status: 'error',
          error: error.message
        };
      }

      return {
        model: model,
        service: service === 'fast' ? 'Fast Clinical' : 'Standard AI',
        response: data?.response || data?.content || 'No response received',
        responseTime: data?.responseTime || responseTime,
        status: 'success'
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        model: model,
        service: service === 'fast' ? 'Fast Clinical' : 'Standard AI',
        response: `Error: ${error.message}`,
        responseTime,
        status: 'error',
        error: error.message
      };
    }
  };

  const testClinicalModelDirect = async (modelId: string): Promise<ClinicalTestResult> => {
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-api-test', {
        body: {
          model: modelId,
          prompt: selectedClinicalQuery
        }
      });

      const responseTime = Date.now() - startTime;

      if (error) {
        return {
          model: modelId,
          service: 'Direct API',
          response: `Error: ${error.message}`,
          responseTime,
          status: 'error',
          error: error.message,
          fullResponse: '',
          responseLength: 0
        };
      }

      const fullResponse = data?.response || 'No response received';
      
      return {
        model: modelId,
        service: 'Direct API',
        response: fullResponse.length > 200 ? fullResponse.substring(0, 200) + '...' : fullResponse, // Truncated for display
        responseTime: data?.responseTime || responseTime,
        status: 'success',
        fullResponse: fullResponse, // Store complete response
        responseLength: fullResponse.length
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        model: modelId,
        service: 'Direct API',
        response: `Error: ${error.message}`,
        responseTime,
        status: 'error',
        error: error.message,
        fullResponse: '',
        responseLength: 0
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
    setTestRunTime(new Date().toLocaleString()); // Store test run time

    try {
      console.log('Starting comprehensive clinical performance test...');
      
      // Get gold standard for current query
      const goldStandard = getCurrentGoldStandard();
      const hasGoldStandard = !!goldStandard;
      
      // Use the working ai-api-test approach for all models consistently
      const testPromises = [
        // All models via direct API (this approach works for all)
        testClinicalModelDirect('gpt-5-2025-08-07'),
        testClinicalModelDirect('gpt-4o'),
        testClinicalModelDirect('gpt-4o-mini'),
        testClinicalModelDirect('claude-4-sonnet'),
        testClinicalModelDirect('grok-beta'),
        testClinicalModelDirect('gemini-1.5-pro')
      ];

      const results = await Promise.all(testPromises);
      
      // If we have a gold standard, run GPT-5 reviews for successful results
      if (hasGoldStandard && goldStandard) {
        console.log('Running GPT-5 reviews against gold standard...');
        
        const reviewPromises = results
          .filter(result => result.status === 'success' && result.fullResponse)
          .map(async (result) => {
            const review = await runGPT5Review(
              result.fullResponse!,
              goldStandard,
              selectedClinicalTitle
            );
            return { ...result, review };
          });
        
        const reviewedResults = await Promise.all(reviewPromises);
        
        // Merge reviewed results back with original results
        const finalResults = results.map(originalResult => {
          const reviewedResult = reviewedResults.find(r => 
            r.model === originalResult.model && r.service === originalResult.service
          );
          return reviewedResult || originalResult;
        });
        
        setClinicalResults(finalResults);
        
        toast({
          title: "Clinical Test with GPT-5 Reviews Completed",
          description: `Tested ${results.length} AI models with quality scoring`,
        });
      } else {
        setClinicalResults(results);
        
        toast({
          title: "Clinical Test Completed",
          description: `Tested ${results.length} AI models for clinical performance`,
        });
      }
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

  const downloadClinicalReport = () => {
    if (clinicalResults.length === 0 || !testRunTime) {
      toast({
        title: "No Data",
        description: "Please run the clinical performance test first",
        variant: "destructive",
      });
      return;
    }

    // Generate comprehensive report
    let report = `AI CLINICAL PERFORMANCE TEST REPORT\n`;
    report += `${'='.repeat(80)}\n\n`;
    report += `Date & Time: ${testRunTime}\n`;
    report += `Test Type: Clinical Performance Analysis\n`;
    report += `Models Tested: ${clinicalResults.length}\n\n`;
    
    report += `TEST PROMPT:\n`;
    report += `${'-'.repeat(40)}\n`;
    report += `${CLINICAL_TEST_QUERY}\n\n`;
    
    report += `RESULTS SUMMARY:\n`;
    report += `${'-'.repeat(40)}\n`;
    const successful = clinicalResults.filter(r => r.status === 'success');
    const failed = clinicalResults.filter(r => r.status === 'error');
    report += `✓ Successful: ${successful.length}/${clinicalResults.length}\n`;
    report += `✗ Failed: ${failed.length}/${clinicalResults.length}\n`;
    
    if (successful.length > 0) {
      const avgTime = Math.round(successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length);
      const fastest = successful.reduce((prev, current) => prev.responseTime < current.responseTime ? prev : current);
      const slowest = successful.reduce((prev, current) => prev.responseTime > current.responseTime ? prev : current);
      const avgLength = Math.round(successful.reduce((sum, r) => sum + (r.responseLength || 0), 0) / successful.length);
      
      report += `Average Response Time: ${avgTime}ms\n`;
      report += `Fastest: ${fastest.model} (${fastest.responseTime}ms)\n`;
      report += `Slowest: ${slowest.model} (${slowest.responseTime}ms)\n`;
      report += `Average Response Length: ${avgLength} characters\n`;
      
      // Add response length breakdown
      report += `\nResponse Lengths by Model:\n`;
      successful.forEach(r => {
        report += `  ${r.model}: ${r.responseLength || 0} characters\n`;
      });
    }
    
    report += `\nDETAILED RESULTS FOR ANALYSIS:\n`;
    report += `${'='.repeat(80)}\n\n`;
    
    // Add detailed results for each model with full responses
    clinicalResults.forEach((result, index) => {
      report += `${index + 1}. MODEL: ${result.model}\n`;
      report += `${'-'.repeat(60)}\n`;
      report += `Service: ${result.service}\n`;
      report += `Status: ${result.status.toUpperCase()}\n`;
      report += `Response Time: ${result.responseTime}ms\n`;
      report += `Response Length: ${result.responseLength || 0} characters\n`;
      
      if (result.error) {
        report += `Error: ${result.error}\n`;
      } else {
        report += `\nFULL RESPONSE:\n`;
        report += `${'-'.repeat(30)}\n`;
        // Include complete untruncated response for analysis
        const fullResponse = result.fullResponse || result.response;
        report += `${fullResponse}\n`;
      }
      
      report += `\n${'='.repeat(60)}\n\n`;
    });
    
    // Add analysis section
    report += `ANALYSIS METADATA:\n`;
    report += `${'-'.repeat(40)}\n`;
    report += `Total Response Characters: ${successful.reduce((sum, r) => sum + (r.responseLength || 0), 0)}\n`;
    report += `Models by Response Speed (fastest to slowest):\n`;
    successful
      .sort((a, b) => a.responseTime - b.responseTime)
      .forEach((r, i) => {
        report += `  ${i + 1}. ${r.model}: ${r.responseTime}ms (${r.responseLength} chars)\n`;
      });
    
    report += `\nModels by Response Length (longest to shortest):\n`;
    successful
      .sort((a, b) => (b.responseLength || 0) - (a.responseLength || 0))
      .forEach((r, i) => {
        report += `  ${i + 1}. ${r.model}: ${r.responseLength} chars (${r.responseTime}ms)\n`;
      });
    
    report += `\nREPORT GENERATED: ${new Date().toLocaleString()}\n`;
    report += `Test completed using AI4GP Clinical Performance Testing Suite\n`;
    report += `Ready for onward analysis and comparison\n`;

    // Create and download the file
    const blob = new Blob([report], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `Clinical-AI-Performance-Report_${timestamp}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: "Report Downloaded",
      description: "Complete clinical performance report with full responses saved for analysis",
    });
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

  // Helper functions for expand functionality
  const toggleExpanded = (resultKey: string) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resultKey)) {
        newSet.delete(resultKey);
      } else {
        newSet.add(resultKey);
      }
      return newSet;
    });
  };

  const getResultKey = (result: ClinicalTestResult, index: number) => {
    return `${result.model}-${result.service}-${index}`;
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'GREEN':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-500';
      case 'ORANGE':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-500';
      case 'RED':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-500';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-500';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-6xl h-[90vh] max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TestTube className="h-4 w-4 sm:h-5 sm:w-5" />
            AI Model Tester
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="standard" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="standard" className="text-xs sm:text-sm">Standard Testing</TabsTrigger>
            <TabsTrigger value="clinical" className="text-xs sm:text-sm">Clinical Performance</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="standard" className="h-full m-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                {/* Input Section */}
                <div className="space-y-3 order-1">
                  <div>
                    <Label htmlFor="prompt" className="text-sm font-medium">
                      Test Prompt
                    </Label>
                    <Textarea
                      id="prompt"
                      placeholder="Enter your prompt to test across models..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="min-h-[80px] sm:min-h-[100px] mt-1 text-sm"
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

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                      onClick={handleSingleTest} 
                      disabled={isLoading}
                      variant="outline"
                      className="flex-1 text-xs sm:text-sm"
                      size="sm"
                    >
                      {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      Test Selected Model
                    </Button>
                    <Button 
                      onClick={handleTestAll} 
                      disabled={isLoading}
                      className="flex-1 text-xs sm:text-sm"
                      size="sm"
                    >
                      {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      Test All Models
                    </Button>
                  </div>
                </div>

                {/* Results Section */}
                <div className="space-y-3 order-2 lg:order-none overflow-hidden">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Test Results</Label>
                    {testResults.length > 0 && (
                      <div className="text-xs text-muted-foreground hidden sm:block">
                        Fastest: {testResults.reduce((prev, current) => 
                          prev.responseTime < current.responseTime ? prev : current
                        ).model} ({testResults.reduce((prev, current) => 
                          prev.responseTime < current.responseTime ? prev : current
                        ).responseTime}ms)
                      </div>
                    )}
                  </div>
                  
                  <ScrollArea className="h-[300px] lg:h-[400px]">
                    <div className="space-y-2 pr-2">
                      {testResults.map((result, index) => (
                        <Card key={index} className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{result.model}</span>
                              {getStatusIcon(result.status)}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {result.responseTime}ms
                            </div>
                          </div>
                          <div className="text-xs bg-muted p-2 rounded max-h-24 overflow-y-auto">
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
                        <div className="text-center text-muted-foreground py-6">
                          <p className="text-sm">Run tests to see results here</p>
                        </div>
                      )}
                      
                      {isLoading && (
                        <div className="text-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Running tests...</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="clinical" className="h-full m-0 overflow-y-auto">
              <ScrollArea className="h-full">
                <div className="space-y-3 pr-2 pb-4">
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 sm:p-4 rounded-lg">
                    <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2 text-sm sm:text-base">
                      <Zap className="w-4 h-4" />
                      Clinical Performance Test
                    </h3>
                    <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">
                      This comprehensive test compares clinical AI performance across multiple models (GPT-5, Claude, Grok, Gemini) 
                      and different service configurations including our standard AI function with clinical verification and the 
                      lightweight fast clinical function.
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                      Current Test: <strong>{selectedClinicalTitle}</strong>
                    </p>
                  </div>

                   {/* Clinical Quick Picks */}
                  <Card className="p-3 sm:p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2 text-sm sm:text-base">
                      <span className="text-green-600">🩺</span>
                      NHS Clinical Quick Picks
                    </h4>
                    <ScrollArea className="h-64 sm:h-72 md:h-80">
                      <div className="grid grid-cols-1 gap-3 pr-2">
                        {clinicalQuickPicks.map((pick, index) => (
                          <div
                            key={index}
                            className={`p-2 sm:p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                              selectedClinicalQuery === pick.prompt 
                                ? 'border-green-600 bg-green-50 dark:bg-green-950 ring-2 ring-green-600 ring-opacity-20 shadow-md' 
                                : 'border-border hover:border-green-400 hover:bg-green-50/50 dark:hover:bg-green-950/50'
                            }`}
                            onClick={() => {
                              setSelectedClinicalQuery(pick.prompt);
                              setSelectedClinicalTitle(pick.title);
                            }}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1">
                              <div className={`font-medium text-xs sm:text-sm mb-1 sm:mb-0 ${
                                selectedClinicalQuery === pick.prompt ? 'text-green-700 dark:text-green-300' : 'text-primary'
                              }`}>
                                {pick.title}
                              </div>
                              <Badge variant="outline" className="text-xs flex-shrink-0 self-start sm:ml-2">
                                {pick.category}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {pick.goldStandard ? '✓ Gold Standard Available' : 'Standard NHS Query'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </Card>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                      onClick={handleClinicalTest} 
                      disabled={isClinicalTesting}
                      className="flex-1 text-xs sm:text-sm"
                      size="sm"
                    >
                      {isClinicalTesting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <TestTube className="w-4 h-4 mr-2" />}
                      Run Clinical Performance Test
                    </Button>
                    
                    {clinicalResults.length > 0 && (
                      <Button 
                        onClick={downloadClinicalReport}
                        variant="outline"
                        className="flex-shrink-0 text-xs sm:text-sm"
                        size="sm"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Report
                      </Button>
                    )}
                  </div>

                   {clinicalResults.length > 0 && (
                     <Tabs defaultValue="results" className="w-full">
                       <TabsList className="grid w-full grid-cols-2 mb-3">
                         <TabsTrigger value="results" className="text-xs">Test Results</TabsTrigger>
                         <TabsTrigger value="goldstandard" className="text-xs">Gold Standard</TabsTrigger>
                       </TabsList>
                       
                       <TabsContent value="results" className="m-0">
                         <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                           {clinicalResults.map((result, index) => {
                             const resultKey = getResultKey(result, index);
                             const isExpanded = expandedResults.has(resultKey);
                             
                             return (
                               <Card key={index} className="p-3">
                                 <div className="flex items-center justify-between mb-3">
                                   <div className="flex items-center gap-2">
                                     <Badge variant={
                                       result.service === 'Fast Clinical' ? 'default' : 
                                       result.service === 'Standard AI' ? 'secondary' : 
                                       'outline'
                                     } className="text-xs">
                                       {result.service}
                                     </Badge>
                                     {getStatusIcon(result.status)}
                                   </div>
                                   <div className="flex items-center gap-1 text-xs font-medium">
                                     <Clock className="w-3 h-3" />
                                     {result.responseTime}ms
                                   </div>
                                 </div>
                                 
                                 {/* GPT-5 Review Results */}
                                 {result.review && (
                                   <div className="mb-3">
                                     <div className="flex items-center gap-2 mb-2">
                                       <div className={`px-2 py-1 rounded text-xs font-bold ${getRiskLevelColor(result.review.riskLevel)}`}>
                                         {result.review.confidenceScore}/99
                                       </div>
                                       <Badge variant="outline" className={`text-xs ${getRiskLevelColor(result.review.riskLevel)}`}>
                                         {result.review.riskLevel}
                                       </Badge>
                                     </div>
                                     <div className="text-xs text-muted-foreground">
                                       {result.review.clinicalAccuracy} • {result.review.safetyRating}
                                     </div>
                                   </div>
                                 )}
                                 
                                 <div className="space-y-2">
                                   <div className="text-xs font-medium">
                                     Model: {result.model}
                                   </div>
                                   
                                   <div className="relative">
                                     <ScrollArea className={isExpanded ? "h-64" : "h-24"}>
                                       <div className="text-xs bg-muted p-2 rounded">
                                         <FormattedText 
                                           text={isExpanded ? (result.fullResponse || result.response) : result.response}
                                           className="whitespace-pre-wrap"
                                         />
                                       </div>
                                     </ScrollArea>
                                     
                                     {result.fullResponse && result.fullResponse !== result.response && (
                                       <Button
                                         variant="ghost"
                                         size="sm"
                                         className="absolute -bottom-1 right-0 h-6 px-2 text-xs bg-background border"
                                         onClick={() => toggleExpanded(resultKey)}
                                       >
                                         {isExpanded ? (
                                           <>
                                             <ChevronUp className="w-3 h-3 mr-1" />
                                             Collapse
                                           </>
                                         ) : (
                                           <>
                                             <ChevronDown className="w-3 h-3 mr-1" />
                                             Expand
                                           </>
                                         )}
                                       </Button>
                                     )}
                                   </div>
                                   
                                   {/* Review Details */}
                                   {result.review && isExpanded && (
                                     <div className="text-xs text-muted-foreground space-y-2 border-t pt-2">
                                       <div className="font-medium mb-1">GPT-5 Detailed Review:</div>
                                       
                                       <div>
                                         <strong>Overall Assessment:</strong>
                                         <div className="mt-1 p-2 bg-muted rounded">
                                           <FormattedText text={result.review.overallAssessment} />
                                         </div>
                                       </div>
                                       
                                       {result.review.strengths.length > 0 && (
                                         <div>
                                           <strong className="text-green-600 dark:text-green-400">Strengths:</strong>
                                           <ul className="mt-1 list-disc list-inside space-y-1">
                                             {result.review.strengths.map((strength, i) => (
                                               <li key={i} className="text-green-600 dark:text-green-400">
                                                 <FormattedText text={strength} className="inline" />
                                               </li>
                                             ))}
                                           </ul>
                                         </div>
                                       )}
                                       
                                       {result.review.concerns.length > 0 && (
                                         <div>
                                           <strong className="text-red-600 dark:text-red-400">Concerns:</strong>
                                           <ul className="mt-1 list-disc list-inside space-y-1">
                                             {result.review.concerns.map((concern, i) => (
                                               <li key={i} className="text-red-600 dark:text-red-400">
                                                 <FormattedText text={concern} className="inline" />
                                               </li>
                                             ))}
                                           </ul>
                                         </div>
                                       )}
                                       
                                       {result.review.missingSections.length > 0 && (
                                         <div>
                                           <strong className="text-orange-600 dark:text-orange-400">Missing Sections:</strong>
                                           <ul className="mt-1 list-disc list-inside space-y-1">
                                             {result.review.missingSections.map((missing, i) => (
                                               <li key={i} className="text-orange-600 dark:text-orange-400">
                                                 <FormattedText text={missing} className="inline" />
                                               </li>
                                             ))}
                                           </ul>
                                         </div>
                                       )}
                                       
                                       <div className="grid grid-cols-2 gap-2 mt-2">
                                         <div>
                                           <strong>NHS Compliance:</strong>
                                           <div className="mt-1 text-xs">
                                             <FormattedText text={result.review.nhsCompliance} />
                                           </div>
                                         </div>
                                         <div>
                                           <strong>Safety Rating:</strong>
                                           <div className="mt-1 text-xs">
                                             <FormattedText text={result.review.safetyRating} />
                                           </div>
                                         </div>
                                       </div>
                                     </div>
                                   )}
                                   
                                   {!isExpanded && result.review && (
                                     <div className="text-xs text-muted-foreground">
                                       <div className="font-medium mb-1">GPT-5 Review Summary:</div>
                                       <div className="truncate">
                                         <FormattedText text={result.review.overallAssessment} className="inline" />
                                       </div>
                                       {result.review.strengths.length > 0 && (
                                         <div className="text-green-600 dark:text-green-400 mt-1">
                                           ✓ <FormattedText text={result.review.strengths.slice(0, 2).join(', ')} className="inline" />
                                         </div>
                                       )}
                                       {result.review.concerns.length > 0 && (
                                         <div className="text-red-600 dark:text-red-400 mt-1">
                                           ⚠ <FormattedText text={result.review.concerns.slice(0, 1).join(', ')} className="inline" />
                                         </div>
                                       )}
                                     </div>
                                   )}
                                   
                                   {result.error && (
                                     <div className="text-xs text-destructive">
                                       Error: {result.error}
                                     </div>
                                   )}
                                 </div>
                               </Card>
                             );
                           })}
                         </div>
                       </TabsContent>
                       
                       <TabsContent value="goldstandard" className="m-0">
                         <Card className="p-4">
                           <h4 className="font-medium mb-3 flex items-center gap-2">
                             <FileText className="w-4 h-4" />
                             Gold Standard for: {selectedClinicalTitle}
                           </h4>
                            {getCurrentGoldStandard() ? (
                              <ScrollArea className="h-96">
                                <div className="text-sm p-3 bg-muted rounded">
                                  <FormattedText 
                                    text={getCurrentGoldStandard() || ""} 
                                    className="whitespace-pre-wrap"
                                  />
                                </div>
                              </ScrollArea>
                            ) : (
                             <div className="text-center text-muted-foreground py-8">
                               <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                               <p>No gold standard available for this query</p>
                               <p className="text-xs mt-1">Select a clinical quick pick with gold standard to compare AI outputs</p>
                             </div>
                           )}
                         </Card>
                       </TabsContent>
                     </Tabs>
                   )}

                  {clinicalResults.length > 0 && (
                    <Card className="p-3 sm:p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                      <h4 className="font-medium text-green-900 dark:text-green-100 mb-2 text-sm sm:text-base">Clinical Performance Analysis</h4>
                      <div className="text-xs sm:text-sm text-green-700 dark:text-green-300 space-y-1">
                        {(() => {
                          const successful = clinicalResults.filter(r => r.status === 'success');
                          const reviewed = clinicalResults.filter(r => r.review);
                          
                          if (successful.length === 0) return <p>No successful responses to analyze.</p>;
                          
                          const fastest = successful.reduce((prev, current) => 
                            prev.responseTime < current.responseTime ? prev : current
                          );
                          
                          const slowest = successful.reduce((prev, current) => 
                            prev.responseTime > current.responseTime ? prev : current
                          );
                          
                          const avgResponseTime = Math.round(successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length);
                          
                          const standardResult = clinicalResults.find(r => r.service === 'Standard AI');
                          const fastResult = clinicalResults.find(r => r.service === 'Fast Clinical');
                          
                          const modelStats = successful.reduce((acc, r) => {
                            const model = r.model.split('-')[0]; // Get base model name
                            if (!acc[model]) acc[model] = [];
                            acc[model].push(r.responseTime);
                            return acc;
                          }, {} as Record<string, number[]>);

                          // GPT-5 Review Statistics
                          const avgConfidence = reviewed.length > 0 ? 
                            Math.round(reviewed.reduce((sum, r) => sum + (r.review?.confidenceScore || 0), 0) / reviewed.length) : 0;
                          
                          const riskBreakdown = reviewed.reduce((acc, r) => {
                            if (r.review) {
                              acc[r.review.riskLevel] = (acc[r.review.riskLevel] || 0) + 1;
                            }
                            return acc;
                          }, {} as Record<string, number>);

                          const topScorer = reviewed.reduce((prev, current) => 
                            (current.review?.confidenceScore || 0) > (prev.review?.confidenceScore || 0) ? current : prev
                          , reviewed[0]);
                          
                          return (
                            <>
                              <p>• Successful responses: {successful.length}/{clinicalResults.length}</p>
                              <p>• Fastest: {fastest.model} via {fastest.service} ({fastest.responseTime}ms)</p>
                              <p>• Slowest: {slowest.model} via {slowest.service} ({slowest.responseTime}ms)</p>
                              <p>• Average response time: {avgResponseTime}ms</p>
                              
                              {reviewed.length > 0 && (
                                <div className="border-t border-green-200 dark:border-green-700 mt-2 pt-2">
                                  <p className="font-medium">GPT-5 Quality Review:</p>
                                  <p>• Average confidence score: {avgConfidence}/99</p>
                                  <p>• Top performer: {topScorer?.model} ({topScorer?.review?.confidenceScore}/99, {topScorer?.review?.riskLevel})</p>
                                  <p>• Risk distribution: 🟢{riskBreakdown.GREEN || 0} 🟠{riskBreakdown.ORANGE || 0} 🔴{riskBreakdown.RED || 0}</p>
                                  <p>• NHS compliance: {reviewed.filter(r => r.review?.nhsCompliance?.includes('Compliant')).length}/{reviewed.length} fully compliant</p>
                                </div>
                              )}
                              
                              {standardResult && fastResult && standardResult.status === 'success' && fastResult.status === 'success' && (
                                <>
                                  <div className="border-t border-green-200 dark:border-green-700 mt-2 pt-2">
                                    <p className="font-medium">GPT-5 Service Comparison:</p>
                                    <p>• Standard AI: {standardResult.responseTime}ms</p>
                                    <p>• Fast Clinical: {fastResult.responseTime}ms</p>
                                    <p>• Speed improvement: {((standardResult.responseTime - fastResult.responseTime) / standardResult.responseTime * 100).toFixed(1)}% faster</p>
                                  </div>
                                </>
                              )}
                              
                              <div className="border-t border-green-200 dark:border-green-700 mt-2 pt-2">
                                <p className="font-medium">Model Performance:</p>
                                {Object.entries(modelStats).map(([model, times]) => (
                                  <p key={model}>• {model.toUpperCase()}: avg {Math.round(times.reduce((a, b) => a + b, 0) / times.length)}ms</p>
                                ))}
                              </div>
                              
                              {avgResponseTime < 10000 && (
                                <p className="mt-2 font-medium text-green-800 dark:text-green-200">⭐ Target achieved: Average clinical response under 10 seconds!</p>
                              )}

                              {avgConfidence >= 80 && reviewed.length > 0 && (
                                <p className="mt-2 font-medium text-green-800 dark:text-green-200">🏆 Excellent quality: Average confidence {avgConfidence}/99</p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </Card>
                  )}

                  {isClinicalTesting && (
                    <div className="text-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Running clinical performance comparison...</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};