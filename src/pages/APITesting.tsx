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
  const [goldStandardResults, setGoldStandardResults] = useState<any[]>([]);
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
      title: "BNF Drug Lookup – Empagliflozin (SGLT2i)",
      category: "Clinical - BNF Drugs",
      prompt: "You are an expert UK NHS GP assistant. Use only UK primary care sources: NICE guidance, NHS.uk, BNF, MHRA Drug Safety Update/alerts, the Green Book (if relevant), and local ICB protocols. Do not use non-UK sources. Present concise, GP-friendly bullet points in UK medical terminology.\nProduce exactly these sections:\n\nIndications (T2DM ± CKD/HF per NICE)\nAdult dosing\nRenal thresholds for initiation/continuation\nMajor interactions & cautions (DKA risk incl. euglycaemic DKA, dehydration, genital infections)\nSick-day rules\nContraindications\nCommon adverse effects\nMonitoring\nReferences\n\nDrug: Empagliflozin.",
      goldStandard: "Indications: T2DM (glycaemic control); HF and CKD indications per UK guidance.\n\nAdult dosing: Start 10 mg od; may increase to 25 mg od. HF/CKD: typically 10 mg od.\n\nRenal: Check eGFR before/after initiation; initiation/continuation thresholds per NICE/BNF/local ICB.\n\nMajor interactions & cautions: Risk of (eu)DKA, dehydration/volume depletion; consider holding peri-op/acute illness; risk of genital mycotic infections.\n\nContraindications/cautions: Type 1 diabetes; pregnancy/breastfeeding (specialist).\n\nMonitoring: HbA1c; U&E/eGFR; sick-day rules; foot care if neuropathy.\n\nReferences: NHS empagliflozin; MHRA DKA advisory; NICE NG28 (treatment selection)."
    },
    {
      title: "Hypertension – Adult Primary Care Management",
      category: "Clinical - Guidelines",
      prompt: "You are an expert UK NHS GP assistant. Use only UK primary care sources: NICE guidance, NHS.uk, BNF, MHRA Drug Safety Update/alerts, the Green Book (if relevant), and local ICB protocols. Do not use non-UK sources. Present concise, GP-friendly bullet points in UK medical terminology.\nProduce exactly these sections:\n\nDiagnosis & confirmation (clinic vs ABPM/HBPM thresholds)\nTreatment targets (age/diabetes/CKD nuance)\nStepwise drug algorithm (A/C/D sequence; considerations for Black African/Caribbean heritage and diabetes) with BNF starting doses\nMonitoring (U&E, BP review cadence)\nLifestyle advice (concise)\nWhen to refer / urgent red flags\nFollow-up intervals\nReferences (NICE/BNF/ICB with URLs).",
      goldStandard: "Diagnosis: Confirm with ABPM/HBPM; base ABPM on average daytime readings.\n\nTargets (individualise): See visual summary—age/comorbidity specific; aim clinic <140/90 mmHg (or lower if tolerated) in most adults; lower targets in DM/CKD as per NICE.\n\nStepwise drugs:\nStep 1: A-drug (ACE-i/ARB) if ≤55 y; CCB if ≥55 y or African/Caribbean family origin (prefer ARB over ACE-i in this group).\nStep 2: A + C. Step 3: A + C + D (thiazide-like). Step 4: Consider spironolactone/alpha-/beta-blocker and specialist advice.\n\nMonitoring: U&E/K⁺ after RAAS up-titration; annual review; lifestyle advice.\n\nRed flags: Same-day if accelerated HTN (retinal haemorrhage/papilloedema) or life-threatening symptoms.\n\nReferences: NICE NG136 (visual & guideline pages)."
    },
    {
      title: "Atrial Fibrillation – Primary Care Assessment & Treatment",
      category: "Clinical - Guidelines",
      prompt: "You are an expert UK NHS GP assistant. Use only UK primary care sources: NICE guidance, NHS.uk, BNF, MHRA Drug Safety Update/alerts, the Green Book (if relevant), and local ICB protocols. Do not use non-UK sources. Present concise, GP-friendly bullet points in UK medical terminology.\nProduce exactly these sections:\n\nInitial assessment (ECG, bloods, reversible causes)\nStroke/bleed risk (CHA₂DS₂-VASc, HAS-BLED – state scoring use)\nAnticoagulation options with BNF doses/renal adjustments (DOACs)\nRate vs rhythm (primary-care scope)\nWhen to refer (syncope, HF, new WPW, refractory symptoms)\nSafety-netting\nReferences.",
      goldStandard: "Assessment: ECG confirmation; bloods (U&E, TFTs); check triggers (thyrotoxicosis, infection, alcohol).\n\nStroke/bleed risk: CHA₂DS₂-VASc for stroke; HAS-BLED for bleeding—use to structure discussion, not to deny therapy.\n\nAnticoagulation: Offer a DOAC first-line unless contraindicated; choose/dose per BNF, renal function, age/weight; counsel on bleeding and adherence.\n\nRate vs rhythm: Rate control first-line in most; rhythm for symptomatic/reversible cause—consider cardiology referral.\n\nRefer/urgent: Syncope, HF, haemodynamic instability, suspected WPW, refractory symptoms.\n\nReferences: NICE NG196 (AF)."
    },
    {
      title: "Type 2 Diabetes – Initial & Add-On Therapy",
      category: "Clinical - Guidelines",
      prompt: "You are an expert UK NHS GP assistant. Use only UK primary care sources: NICE guidance, NHS.uk, BNF, MHRA Drug Safety Update/alerts, the Green Book (if relevant), and local ICB protocols. Do not use non-UK sources. Present concise, GP-friendly bullet points in UK medical terminology.\nProduce exactly these sections:\n\nDiagnostic thresholds\nHbA1c targets\nFirst-line and add-on per NICE (metformin baseline, SGLT2i in ASCVD/CKD/HF, GLP-1 criteria)\nBNF dose/titration highlights\nMonitoring (HbA1c/U&E)\nHypoglycaemia education\nSick-day rules\nReferral triggers\nReferences.",
      goldStandard: "Diagnosis/targets: Diagnose per HbA1c/FBG thresholds; set individualised HbA1c target (e.g., 48–58 mmol/mol typical range).\n\nFirst-line: Metformin if tolerated.\n\nAdd-on choices: Use person-centred factors; prioritise SGLT2-i in ASCVD/CKD/HF; consider GLP-1 RA per criteria; avoid hypoglycaemia in high-risk.\n\nBNF dose notes: Include dose/titration snippets for chosen agents (e.g., metformin slow up-titration).\n\nMonitoring: HbA1c 3–6-monthly until stable, then 6–12-monthly; U&E, eGFR with SGLT2-i/Met; weight, BP, lipids; foot care.\n\nReferences: NICE NG28 + \"Choosing medicines\" visual summary."
    },
    {
      title: "Adult Asthma – Acute Exacerbation (Primary Care)",
      category: "Clinical - Emergency",
      prompt: "You are an expert UK NHS GP assistant. Use only UK primary care sources: NICE guidance, NHS.uk, BNF, MHRA Drug Safety Update/alerts, the Green Book (if relevant), and local ICB protocols. Do not use non-UK sources. Present concise, GP-friendly bullet points in UK medical terminology.\nProduce exactly these sections:\n\nSeverity assessment\nImmediate treatment (inhaled SABA doses; oral prednisolone BNF dosing)\nOxygen/peak flow targets\nWhen to admit/999\nPost-exacerbation review (ICS step-up, inhaler technique, adherence)\nSafety-netting\nFollow-up timeline\nReferences.",
      goldStandard: "Assess severity: PEFR %, RR, SpO₂, speech, cyanosis, exhaustion.\n\nImmediate treatment: Inhaled SABA via spacer/nebuliser; give oral prednisolone 40–50 mg once daily (adult) immediately; oxygen if hypoxic; consider ipratropium in moderate–severe attacks.\n\nRefer 999/admit: Life-threatening features or poor response.\n\nPost-exacerbation: Check inhaler technique/adherence; step-up controller; provide written action plan; arrange follow-up.\n\nReferences: NICE CKS (Asthma – acute exacerbation); NHS prednisolone usage advice."
    },
    {
      title: "UTI – Non-Pregnant Adult Female (Uncomplicated)",
      category: "Clinical - Infections",
      prompt: "You are an expert UK NHS GP assistant. Use only UK primary care sources: NICE guidance, NHS.uk, BNF, MHRA Drug Safety Update/alerts, the Green Book (if relevant), and local ICB protocols. Do not use non-UK sources. Present concise, GP-friendly bullet points in UK medical terminology.\nProduce exactly these sections:\n\nDiagnosis (symptom score; dipstick use)\nFirst-/second-line antibiotics with BNF doses/durations aligned to NICE antimicrobial prescribing & local ICB\nWhen to send MSU\nSpecial cases (pregnancy, men, catheters – brief signposts)\nPrevention for recurrent UTI\nRed flags & safety-netting\nReferences.",
      goldStandard: "Diagnosis: Typical dysuria/urgency; dipstick optional depending on age/symptoms; consider back-up prescription in milder cases.\n\nAntibiotics (align to NICE/local ICB):\nFirst-line: Nitrofurantoin (if eGFR ≥ 45) 3 days; Trimethoprim 3 days if low resistance risk.\nSecond-line/alternatives: Pivmecillinam 3 days or Fosfomycin single dose. (Check local ICB formulary for resistance patterns.)\n\nWhen to send MSU: Atypical features, recurrent UTI, treatment failure, red flags.\n\nSafety-net: Worsening/systemically unwell; pyelonephritis symptoms → urgent review.\n\nReferences: NICE NG109 (and visual summary); UK quick-reference (UKHSA/NHS England)."
    },
    {
      title: "Shingles (Herpes Zoster) Vaccination – Green Book",
      category: "Clinical - Immunisations",
      prompt: "You are an expert UK NHS GP assistant. Use only UK primary care sources: NICE guidance, NHS.uk, BNF, MHRA Drug Safety Update/alerts, the Green Book (if relevant), and local ICB protocols. Do not use non-UK sources. Present concise, GP-friendly bullet points in UK medical terminology.\nProduce exactly these sections:\n\nEligibility (routine, catch-up, clinical risk groups)\nVaccine products & schedules\nCo-administration\nContraindications & precautions (immunosuppression, pregnancy)\nPost-exposure considerations\nDocumentation/coding\nPatient counselling\nReferences (Green Book/NHS.uk/ICB).",
      goldStandard: "Eligibility (England, current):\nRoutine: People turning 65 (from 1 Sep 2023, remain eligible to 80th birthday), and 70–79 catch-up if not yet vaccinated.\nClinical risk: Severely immunosuppressed adults ≥50 y (recent updates extend to certain ≥18 y cohorts—check latest chapter update).\n\nSchedule: Shingrix 2 doses, usually 6–12 months apart (8 weeks–6 months in immunosuppressed).\n\nCo-administration: Can be co-administered with other inactivated vaccines per Green Book.\n\nContraindications/precautions: Anaphylaxis to a previous dose/component; defer if acutely unwell.\n\nCoding/admin: Record product, batch, site, route; follow GPES/technical guidance.\n\nReferences: Green Book Chapter 28a; NHS shingles vaccine page."
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

    // Run Gold Standard Comparison if available
    const matchingQuickPick = clinicalQuickPicks.find(qp => qp.prompt === prompt);
    if (matchingQuickPick && matchingQuickPick.goldStandard) {
      await runGoldStandardComparison();
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

  const runGoldStandardComparison = async () => {
    try {
      // Find the matching clinical quick pick for gold standard comparison
      const matchingQuickPick = clinicalQuickPicks.find(qp => qp.prompt === prompt);
      
      if (!matchingQuickPick || !matchingQuickPick.goldStandard) {
        console.log('No gold standard available for this prompt');
        return;
      }

      const completedResults = results.filter(r => r.status === 'completed');
      const goldStandardPromises = completedResults.map(async (result) => {
        const { data, error } = await supabase.functions.invoke('clinical-verification', {
          body: {
            messageId: `gold-standard-${Date.now()}`,
            originalPrompt: prompt,
            responses: [{
              role: 'assistant',
              content: result.response,
              model: result.model,
              responseTime: result.responseTime
            }],
            goldStandard: matchingQuickPick.goldStandard,
            comparisonMode: true
          }
        });

        if (error) throw error;
        return { 
          model: result.model, 
          goldStandardComparison: data,
          goldStandard: matchingQuickPick.goldStandard
        };
      });

      const goldStandardResults = await Promise.all(goldStandardPromises);
      
      // Store results in a new state for gold standard comparisons
      setGoldStandardResults(goldStandardResults);
      
    } catch (error) {
      console.error('Gold Standard Comparison error:', error);
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
                  
                  {/* Regular Prompts */}
                  <div className="space-y-3 mb-4">
                    <div className="text-xs font-medium text-muted-foreground mb-2">General Prompts</div>
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

                  {/* Clinical Quick Picks */}
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <span className="text-green-600">🩺</span>
                      NHS Clinical Quick Picks (GPT-5 Recommended)
                    </div>
                    {clinicalQuickPicks.map((p, i) => (
                      <div
                        key={`clinical-${i}`}
                        className={`p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                          prompt === p.prompt 
                            ? 'border-green-600 bg-green-50 ring-2 ring-green-600 ring-opacity-20 shadow-md' 
                            : 'border-border hover:border-green-400 hover:bg-green-50/50'
                        }`}
                        onClick={() => setPrompt(p.prompt)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className={`font-medium text-sm ${
                            prompt === p.prompt ? 'text-green-700' : 'text-primary'
                          }`}>
                            {p.title}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {p.category}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground leading-relaxed whitespace-normal break-words line-clamp-3">
                          {p.prompt.length > 150 ? p.prompt.substring(0, 150) + '...' : p.prompt}
                        </div>
                        {p.goldStandard && (
                          <div className="mt-2 text-xs text-green-600 font-medium">
                            ✓ Gold Standard Available
                          </div>
                        )}
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
                    <TabsList className="grid w-full grid-cols-7">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="responses">Responses</TabsTrigger>
                      <TabsTrigger value="analysis">Analysis</TabsTrigger>
                      <TabsTrigger value="nhs-verify">NHS Verify</TabsTrigger>
                      <TabsTrigger value="challenge">Challenge</TabsTrigger>
                      <TabsTrigger value="gold-standard">Gold Standard</TabsTrigger>
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

                    <TabsContent value="gold-standard" className="space-y-4">
                      {goldStandardResults.length > 0 ? (
                        <div className="space-y-4">
                          {goldStandardResults.map((result, index) => {
                            const modelInfo = getModelInfo(result.model);
                            const comparison = result.goldStandardComparison;
                            
                            return (
                              <Card key={index}>
                                <CardHeader>
                                  <CardTitle className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${modelInfo.color}`} />
                                    {modelInfo.name} - Gold Standard Comparison
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                  {comparison && (
                                    <>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                          <h4 className="font-semibold text-sm mb-2">Confidence Score</h4>
                                          <div className="flex items-center gap-2">
                                            <Progress 
                                              value={comparison.confidenceScore || 0} 
                                              className="flex-1" 
                                            />
                                            <span className="text-sm font-medium">
                                              {Math.round(comparison.confidenceScore || 0)}%
                                            </span>
                                          </div>
                                        </div>
                                        
                                        <div>
                                          <h4 className="font-semibold text-sm mb-2">Risk Level</h4>
                                          <Badge 
                                            variant={comparison.riskLevel === 'LOW' ? 'default' : 
                                                   comparison.riskLevel === 'MEDIUM' ? 'secondary' : 'destructive'}
                                          >
                                            {comparison.riskLevel}
                                          </Badge>
                                        </div>
                                      </div>

                                      {comparison.concerns && comparison.concerns.length > 0 && (
                                        <div>
                                          <h4 className="font-semibold text-sm mb-2">Key Concerns</h4>
                                          <ul className="space-y-1">
                                            {comparison.concerns.map((concern, i) => (
                                              <li key={i} className="text-sm text-red-600 flex items-start gap-2">
                                                <span className="text-red-500 mt-1">•</span>
                                                {concern}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}

                                      {comparison.strengths && comparison.strengths.length > 0 && (
                                        <div>
                                          <h4 className="font-semibold text-sm mb-2">Strengths</h4>
                                          <ul className="space-y-1">
                                            {comparison.strengths.map((strength, i) => (
                                              <li key={i} className="text-sm text-green-600 flex items-start gap-2">
                                                <span className="text-green-500 mt-1">•</span>
                                                {strength}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </>
                                  )}
                                  
                                  <div className="border-t pt-4">
                                    <h4 className="font-semibold text-sm mb-2">Gold Standard Reference</h4>
                                    <div className="bg-amber-50 p-3 rounded-md text-sm">
                                      {result.goldStandard}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      ) : (
                        <Card>
                          <CardContent className="text-center py-8">
                            <p className="text-muted-foreground">
                              No gold standard comparison available. 
                              {clinicalQuickPicks.find(qp => qp.prompt === prompt) 
                                ? ' Run a test to see results.' 
                                : ' Select a Clinical Quick Pick prompt to compare against gold standards.'
                              }
                            </p>
                          </CardContent>
                        </Card>
                      )}
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