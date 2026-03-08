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
import { Loader2, TestTube, Clock, CheckCircle, XCircle, Zap, Download, ChevronDown, ChevronUp, FileText, Maximize2, Minimize2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import DOMPurify from 'dompurify';
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
}

// AI Models Configuration  
const AI_MODELS = [
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash', service: 'google' },
  { id: 'google/gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', service: 'google' },
  { id: 'openai/gpt-5', name: 'GPT-5', service: 'openai' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', service: 'openai' },
  { id: 'claude-4-sonnet', name: 'Claude 4 Sonnet', service: 'anthropic' },
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
    // Headers #### -> <h4>, ### -> <h3>, ## -> <h2>, # -> <h1>
    .replace(/^#### (.*$)/gm, '<h4 class="font-semibold text-xs mt-2 mb-1">$1</h4>')
    .replace(/^### (.*$)/gm, '<h3 class="font-semibold text-sm mt-2 mb-1">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="font-semibold text-base mt-2 mb-1">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="font-bold text-lg mt-2 mb-1">$1</h1>')
    // Bullet points
    .replace(/^- (.*$)/gm, '<div class="ml-3">• $1</div>')
    // Line breaks
    .replace(/\n/g, '<br/>');
};

// Component to render formatted text with DOMPurify sanitisation
const FormattedText: React.FC<{ text: string; className?: string }> = ({ text, className = "" }) => {
  return (
    <div 
      className={className} 
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatText(text)) }}
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
  },
  {
    title: "Suspected TIA in Primary Care",
    category: "Clinical - Emergency",
    prompt: "You are an expert UK NHS GP assistant. Use only UK primary care sources: NICE guidance, NHS.uk, BNF, MHRA Drug Safety Update/alerts, the Green Book (if relevant), and local ICB protocols. Do not use non-UK sources. Present concise, GP-friendly bullet points in UK medical terminology.\n\nA 68-year-old developed sudden aphasia and right arm weakness lasting ~20 minutes; fully resolved 45 minutes ago. What should a UK GP do now? Please give immediate actions, treatment, referral, and safety-netting.",
    goldStandard: "Treat now: Give aspirin 300 mg stat (unless contraindicated). Document time given.\n\nUrgent referral: Same-day specialist TIA clinic assessment within 24 h of symptom onset. Do not use ABCD2 to triage urgency.\n\nImaging: No CT needed in primary care; imaging arranged after specialist review (MRI preferred when indicated).\n\nIf stroke suspected / recurrent symptoms / red flags → 999/ED.\n\nAfter confirmation of TIA (secondary prevention): start per specialist plan (e.g., antiplatelet switch/dual short-term per clinic, risk-factor control, carotid imaging if candidate for CEA).\n\nSafety-net: return/999 if recurrent neuro deficit, severe headache, or new neuro signs; avoid driving until specialist advice."
  },
  {
    title: "New Atrial Fibrillation Detection",
    category: "Clinical - Cardiology",
    prompt: "You are an expert UK NHS GP assistant. Use only UK primary care sources: NICE guidance, NHS.uk, BNF, MHRA Drug Safety Update/alerts, the Green Book (if relevant), and local ICB protocols. Do not use non-UK sources. Present concise, GP-friendly bullet points in UK medical terminology.\n\nA 75-year-old presents with palpitations; irregularly irregular pulse. What should a UK GP do now? Include diagnosis, anticoagulation thresholds, initial rate/rhythm control options, and when to refer.",
    goldStandard: "Confirm diagnosis: Do 12-lead ECG for AF if irregular pulse present. Consider ambulatory ECG if paroxysmal suspected.\n\nAssess stroke risk: Use CHA₂DS₂-VASc; offer a DOAC if score ≥2; consider a DOAC for men with score = 1; do not anticoagulate men 0 / women 1 (sex alone). Use ORBIT to discuss bleeding risk; do not withhold solely for age/falls.\n\nDrug choices: Prefer DOACs (apixaban, dabigatran, edoxaban, rivaroxaban); use VKA if DOAC unsuitable.\n\nRate control first-line (most patients): Beta-blocker or rate-limiting CCB (diltiazem/verapamil); avoid CCB in HFrEF; consider digoxin if sedentary; combination if monotherapy fails; do not use amiodarone for long-term rate control.\n\nRhythm control / acute AF: If <48 h since onset and symptomatic, consider rate or rhythm control; urgent electrical cardioversion if haemodynamic instability.\n\nEcho: Arrange TTE if it will change management (e.g., planning cardioversion, suspected structural disease).\n\nRefer: If symptoms not controlled or for consideration of rhythm strategies/ablation."
  },
  {
    title: "Uncomplicated Lower UTI – Non-pregnant Woman",
    category: "Clinical - Infections",
    prompt: "You are an expert UK NHS GP assistant. Use only UK primary care sources: NICE guidance, NHS.uk, BNF, MHRA Drug Safety Update/alerts, the Green Book (if relevant), and local ICB protocols. Do not use non-UK sources. Present concise, GP-friendly bullet points in UK medical terminology.\n\nA 32-year-old non-pregnant woman has dysuria, frequency and urgency for 1 day, afebrile, no flank pain. eGFR 80. How should a UK GP manage? Include when to test, first-/second-line antibiotics with doses and durations, and safety-netting.",
    goldStandard: "Diagnosis: With classic symptoms, you can treat empirically; send urine only if atypical features, treatment failure, recurrent UTIs, or risk factors.\n\nFirst-line antibiotic (if eGFR ≥ 45): Nitrofurantoin MR 100 mg BD 3 days (or 50 mg QID 3 days).\n\nAlternative first-line (if low resistance risk): Trimethoprim 200 mg BD 3 days.\n\nSecond-line (no improvement ≥48 h or unsuitable): Pivmecillinam 400 mg once, then 200 mg TDS to complete 3 days or Fosfomycin 3 g single dose.\n\nRenal caveat: Nitrofurantoin avoid if eGFR <45; may use with caution for short course if eGFR 30–44 where benefit outweighs risk (MDR suspected).\n\nSafety-net: seek care urgently if fever/flank pain/systemically unwell (possible pyelonephritis); return if no better in 48 h for culture-guided change."
  },
  {
    title: "COPD Exacerbation – Community Management",
    category: "Clinical - Respiratory",
    prompt: "You are an expert UK NHS GP assistant. Use only UK primary care sources: NICE guidance, NHS.uk, BNF, MHRA Drug Safety Update/alerts, the Green Book (if relevant), and local ICB protocols. Do not use non-UK sources. Present concise, GP-friendly bullet points in UK medical terminology.\n\nA known COPD patient has ↑dyspnoea and ↑cough. SpO₂ 92% on air, chest clear of consolidation, sputum now green. How should a UK GP treat in the community? Include steroids, when to give antibiotics (and choices/doses), oxygen targets, and when to refer.",
    goldStandard: "Bronchodilators: Increase SABA / consider nebuliser if needed.\n\nSteroids: Prednisolone 30 mg PO once daily for 5 days; give clear stop date.\n\nAntibiotics – only if bacterial features (e.g., purulent sputum ± ↑volume/breathlessness) or severe/systemically unwell: choose one for 5 days:\nAmoxicillin 500 mg TDS, Doxycicline 200 mg day 1 then 100 mg OD, or Clarithromycin 500 mg BD. Alternatives if high failure risk: Co-amoxiclav 500/125 mg TDS or Co-trimoxazole 960 mg BD; Levofloxacin 500 mg OD only if others unsuitable (MHRA restrictions).\n\nOxygen: If required, aim for the person's individualised target range (usual 88–92% in COPD with risk of hypercapnia); arrange ABGs if concerns.\n\nReassess / refer: If symptoms worsen rapidly, no improvement in 2–3 days, or severe systemic infection/sepsis/respiratory failure → hospital / specialist advice. Send sputum if failing antibiotics."
  },
  {
    title: "Fever in Child Under 5",
    category: "Clinical - Paediatrics", 
    prompt: "You are an expert UK NHS GP assistant. Use only UK primary care sources: NICE guidance, NHS.uk, BNF, MHRA Drug Safety Update/alerts, the Green Book (if relevant), and local ICB protocols. Do not use non-UK sources. Present concise, GP-friendly bullet points in UK medical terminology.\n\nA 10-month-old has fever 39.2 °C for 24 h, cough and rhinorrhoea, feeding a bit less but alert and interactive. What should a UK GP do? Include risk stratification (traffic-light), who needs same-day/ED review, and antipyretic/home-care advice.",
    goldStandard: "Risk stratify (NICE traffic-light):\nGreen (low risk): normal colour, responds normally, no respiratory distress, normal hydration.\nAmber (intermediate): e.g., nasal flaring, RR >50 (6–12 m), SpO₂ ≤95%, CRT ≥3 s, tachycardia by age, fever ≥39 °C in 3–6 months, poor feeding.\nRed (high): e.g., pale/mottled/ashen/blue, not responding/doesn't stay awake, grunting, RR >60, mod–severe chest indrawing, reduced skin turgor, non-blanching rash, bulging fontanelle, neck stiffness, status epilepticus, focal neuro signs/seizures, <3 months with ≥38 °C → urgent ED.\n\nAntipyretics: Use either paracetamol or ibuprofen if the child is distressed; do not give both together or alternate routinely; continue only while distressed; do not use to prevent febrile seizures; avoid tepid sponging; avoid over-/under-dressing.\n\nSafety-net: Red-flag symptoms, dehydration, persistent fever ≥5 days (consider Kawasaki), or parental concern → same-day review."
  }
];

const AITestModal: React.FC<AITestModalProps> = ({ open, onOpenChange }) => {
  const [selectedModel, setSelectedModel] = useState('');
  const [testPrompt, setTestPrompt] = useState('Write a short poem about artificial intelligence.');
  const [results, setResults] = useState<TestResult[]>([]);
  const [isTestingIndividual, setIsTestingIndividual] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Clinical testing state
  const [selectedClinicalQuery, setSelectedClinicalQuery] = useState(CLINICAL_TEST_QUERY);
  const [selectedClinicalTitle, setSelectedClinicalTitle] = useState('');
  const [clinicalResults, setClinicalResults] = useState<ClinicalTestResult[]>([]);
  const [isClinicalTesting, setIsClinicalTesting] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});

  // Get current gold standard if available
  const getCurrentGoldStandard = () => {
    const currentPick = clinicalQuickPicks.find(pick => pick.title === selectedClinicalTitle);
    return currentPick?.goldStandard || null;
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

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      if (error) {
        console.error(`Error testing ${model}:`, error);
        return {
          model,
          service,
          response: `Error: ${error.message || 'Unknown error'}`,
          responseTime,
          status: 'error',
          error: error.message
        };
      }

      // Store both truncated and full response
      const fullResponse = data.content || data.response || data.text || 'No response received';
      const truncatedResponse = fullResponse.length > 500 
        ? `${fullResponse.substring(0, 500)}...` 
        : fullResponse;

      return {
        model,
        service,
        response: truncatedResponse,
        fullResponse: fullResponse,
        responseLength: fullResponse.length,
        responseTime,
        status: 'success'
      };
    } catch (error) {
      console.error(`Error testing ${model}:`, error);
      return {
        model,
        service,
        response: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  const testClinicalModelDirect = async (modelId: string): Promise<ClinicalTestResult> => {
    const startTime = Date.now();
    
    try {
      console.log(`Testing ${modelId} with direct API approach...`);
      
      const response = await supabase.functions.invoke('ai-api-test', {
        body: {
          model: modelId,
          prompt: selectedClinicalQuery
        }
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      if (response.error) {
        console.error(`Error testing ${modelId}:`, response.error);
        return {
          model: modelId,
          service: 'direct-api',
          response: `Error: ${response.error.message || 'API test failed'}`,
          responseTime,
          status: 'error',
          error: response.error.message
        };
      }

      const fullResponse = response.data?.response || 'No response received';
      const truncatedResponse = fullResponse.length > 500 
        ? `${fullResponse.substring(0, 500)}...` 
        : fullResponse;

      console.log(`✅ ${modelId} test completed successfully in ${responseTime}ms`);

      return {
        model: modelId,
        service: 'direct-api',
        response: truncatedResponse,
        fullResponse: fullResponse,
        responseLength: fullResponse.length,
        responseTime,
        status: 'success'
      };
    } catch (error) {
      console.error(`Error testing ${modelId}:`, error);
      return {
        model: modelId,
        service: 'direct-api',
        response: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  const handleClinicalTest = async () => {
    if (!selectedClinicalQuery.trim()) {
      toast({
        title: "Error",
        description: "Please enter a clinical query",
        variant: "destructive",
      });
      return;
    }

    setIsClinicalTesting(true);
    setClinicalResults([]);
    
    try {
      console.log('Starting clinical performance test...');
      
      // Use the working ai-api-test approach for all models consistently
      const testPromises = [
        testClinicalModelDirect('google/gemini-3.1-pro-preview'),
        testClinicalModelDirect('google/gemini-2.5-flash'),
        testClinicalModelDirect('google/gemini-3-flash-preview'),
        testClinicalModelDirect('openai/gpt-5'),
        testClinicalModelDirect('openai/gpt-5-mini'),
        testClinicalModelDirect('claude-4-sonnet'),
      ];

      const results = await Promise.all(testPromises);
      
      setClinicalResults(results);
      
      toast({
        title: "Clinical Test Completed",
        description: `Tested ${results.length} AI models for clinical performance`,
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

  const downloadClinicalReport = () => {
    try {
      console.log('Generating clinical report...');
      
      const reportData = {
        query: selectedClinicalTitle,
        prompt: selectedClinicalQuery,
        goldStandard: getCurrentGoldStandard(),
        timestamp: new Date().toISOString(),
        results: clinicalResults.map(result => ({
          model: result.model,
          service: result.service,
          status: result.status,
          responseTime: result.responseTime,
          responseLength: result.responseLength || 0,
          response: result.fullResponse || result.response,
          error: result.error
        }))
      };

      const jsonStr = JSON.stringify(reportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `clinical-test-report-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Report Downloaded",
        description: "Clinical test report has been downloaded as JSON",
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'testing':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const toggleExpanded = (resultKey: string) => {
    setExpandedResults(prev => ({
      ...prev,
      [resultKey]: !prev[resultKey]
    }));
  };

  const getResultKey = (result: ClinicalTestResult) => {
    return `${result.model}-${result.service}`;
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${isFullscreen ? 'max-w-[98vw] h-[98vh]' : 'max-w-7xl max-h-[95vh]'} overflow-hidden flex flex-col`}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <TestTube className="w-5 h-5" />
              AI Model Tester
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="flex items-center gap-2"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="clinical" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="clinical" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Clinical Performance
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="clinical" className="flex-1 overflow-hidden flex flex-col space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clinical-query-select">Quick Pick Tests</Label>
                  <Select 
                    value={selectedClinicalTitle} 
                    onValueChange={(value) => {
                      const selectedPick = clinicalQuickPicks.find(pick => pick.title === value);
                      if (selectedPick) {
                        setSelectedClinicalTitle(selectedPick.title);
                        setSelectedClinicalQuery(selectedPick.prompt);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a clinical test" />
                    </SelectTrigger>
                    <SelectContent>
                      {clinicalQuickPicks.map((pick, index) => (
                        <SelectItem key={index} value={pick.title}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{pick.title}</span>
                            <span className="text-xs text-muted-foreground">{pick.category}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="clinical-query">Clinical Query</Label>
                    <Button 
                      onClick={handleClinicalTest} 
                      disabled={isClinicalTesting || !selectedClinicalQuery.trim()}
                      className="flex items-center gap-2"
                    >
                      {isClinicalTesting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          Test All Models
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea 
                    id="clinical-query"
                    placeholder="Enter clinical query or select from quick picks above..."
                    value={selectedClinicalQuery}
                    onChange={(e) => setSelectedClinicalQuery(e.target.value)}
                    className="min-h-[100px] text-sm"
                  />
                </div>
              </div>

              {/* Results Section */}
              {(clinicalResults.length > 0 || isClinicalTesting) && (
                <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Clinical Test Results</h3>
                    {clinicalResults.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={downloadClinicalReport}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Download Report
                        </Button>
                        <div className="text-sm text-muted-foreground">
                          {clinicalResults.filter(r => r.status === 'success').length}/{clinicalResults.length} successful
                        </div>
                      </div>
                    )}
                  </div>

                  <ScrollArea className="flex-1 max-h-[60vh]">
                    <div className="grid gap-3 pr-4">
                      {clinicalResults.map((result, index) => {
                        const resultKey = getResultKey(result);
                        const isExpanded = expandedResults[resultKey];
                        return (
                          <Card key={index} className="p-4">
                            <div className="space-y-3">
                              {/* Header */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {getStatusIcon(result.status)}
                                  <div>
                                    <div className="font-medium">{result.model}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {result.responseTime}ms • {result.responseLength || 0} chars
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  {result.status === 'success' && (
                                    <Badge variant="secondary" className="text-xs">
                                      Success
                                    </Badge>
                                  )}
                                  {result.status === 'error' && (
                                    <Badge variant="destructive" className="text-xs">
                                      Error
                                    </Badge>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleExpanded(resultKey)}
                                    className="flex items-center gap-1"
                                  >
                                    {isExpanded ? 'Show Less' : 'Show More'}
                                    {isExpanded ? 
                                      <ChevronUp className="w-3 h-3" /> : 
                                      <ChevronDown className="w-3 h-3" />
                                    }
                                  </Button>
                                </div>
                              </div>

                              {/* Response */}
                              <div className="space-y-2">
                                <Label className="text-xs font-medium text-muted-foreground">Response:</Label>
                                <ScrollArea className="max-h-96">
                                  <div className="p-3 bg-muted rounded-lg">
                                    <FormattedText 
                                      text={isExpanded ? (result.fullResponse || result.response) : result.response}
                                      className="text-sm leading-relaxed"
                                    />
                                  </div>
                                </ScrollArea>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AITestModal;