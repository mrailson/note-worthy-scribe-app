import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerificationRequest {
  patient_id: string;
  practice_ods: string;
}

interface LLMAssessment {
  model: string;
  front_sheet_score: number;
  snomed_score: number;
  completeness_score: number;
  safety_score: number;
  overall_score: number;
  issues: string[];
  assessment: string;
}

interface SnomedCodeVerification {
  term: string;
  code: string;
  rag_rating: 'green' | 'amber' | 'red';
  confidence: number;
  issues: string[];
  verified_by_models: string[];
}

interface VerificationResult {
  overall_rag_rating: 'green' | 'amber' | 'red';
  overall_score: number;
  front_sheet_assessment: {
    rag_rating: 'green' | 'amber' | 'red';
    score: number;
    issues: string[];
    llm_consensus: LLMAssessment[];
  };
  snomed_assessment: {
    rag_rating: 'green' | 'amber' | 'red';
    score: number;
    issues_per_code: SnomedCodeVerification[];
    llm_consensus: LLMAssessment[];
  };
  recommendations: string[];
  verified_at: string;
  models_used: string[];
}

function getRagRating(score: number): 'green' | 'amber' | 'red' {
  if (score >= 85) return 'green';
  if (score >= 60) return 'amber';
  return 'red';
}

async function verifyWithClaude(
  apiKey: string,
  summaryJson: any,
  snomedJson: any,
  ocrText: string
): Promise<LLMAssessment> {
  const systemPrompt = `You are an expert clinical data quality auditor for NHS Lloyd George records digitisation.

Your task is to verify the quality and accuracy of AI-extracted clinical data by comparing it against the original OCR text.

Score each category 0-100:
1. FRONT SHEET QUALITY: Is the clinical summary accurate? Are diagnoses, allergies, medications correct?
2. SNOMED CODE ACCURACY: Are the SNOMED codes correct and supported by evidence in the OCR text?
3. COMPLETENESS: Were important clinical findings missed that appear in the OCR?
4. SAFETY: Are there any dangerous errors, hallucinations, or incorrect codes that could harm patient care?

Be strict and thorough. If something is not clearly evidenced in the OCR text, mark it as an issue.

Respond ONLY with valid JSON in this exact format:
{
  "front_sheet_score": <0-100>,
  "snomed_score": <0-100>,
  "completeness_score": <0-100>,
  "safety_score": <0-100>,
  "overall_score": <0-100>,
  "issues": ["list of specific issues found"],
  "assessment": "brief overall assessment"
}`;

  const userPrompt = `Verify this LG Capture extraction:

=== CLINICAL SUMMARY (to verify) ===
${JSON.stringify(summaryJson, null, 2)}

=== SNOMED CODES (to verify) ===
${JSON.stringify(snomedJson, null, 2)}

=== ORIGINAL OCR TEXT (ground truth) ===
${ocrText.substring(0, 30000)}

Verify each extracted item has supporting evidence in the OCR text. Flag any hallucinations, incorrect codes, or missing important findings.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON response from Claude');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      model: 'claude-sonnet-4',
      front_sheet_score: parsed.front_sheet_score || 0,
      snomed_score: parsed.snomed_score || 0,
      completeness_score: parsed.completeness_score || 0,
      safety_score: parsed.safety_score || 0,
      overall_score: parsed.overall_score || 0,
      issues: parsed.issues || [],
      assessment: parsed.assessment || '',
    };
  } catch (error) {
    console.error('Error with Claude:', error);
    return {
      model: 'claude-sonnet-4',
      front_sheet_score: 0,
      snomed_score: 0,
      completeness_score: 0,
      safety_score: 0,
      overall_score: 0,
      issues: [`Failed to verify with Claude: ${error.message}`],
      assessment: 'Verification failed',
    };
  }
}

async function verifyWithModel(
  modelName: string,
  displayName: string,
  apiKey: string,
  summaryJson: any,
  snomedJson: any,
  ocrText: string,
  endpoint: string
): Promise<LLMAssessment> {
  const systemPrompt = `You are an expert clinical data quality auditor for NHS Lloyd George records digitisation.

Your task is to verify the quality and accuracy of AI-extracted clinical data by comparing it against the original OCR text.

Score each category 0-100:
1. FRONT SHEET QUALITY: Is the clinical summary accurate? Are diagnoses, allergies, medications correct?
2. SNOMED CODE ACCURACY: Are the SNOMED codes correct and supported by evidence in the OCR text?
3. COMPLETENESS: Were important clinical findings missed that appear in the OCR?
4. SAFETY: Are there any dangerous errors, hallucinations, or incorrect codes that could harm patient care?

Be strict and thorough. If something is not clearly evidenced in the OCR text, mark it as an issue.

Respond ONLY with valid JSON in this exact format:
{
  "front_sheet_score": <0-100>,
  "snomed_score": <0-100>,
  "completeness_score": <0-100>,
  "safety_score": <0-100>,
  "overall_score": <0-100>,
  "issues": ["list of specific issues found"],
  "assessment": "brief overall assessment"
}`;

  const userPrompt = `Verify this LG Capture extraction:

=== CLINICAL SUMMARY (to verify) ===
${JSON.stringify(summaryJson, null, 2)}

=== SNOMED CODES (to verify) ===
${JSON.stringify(snomedJson, null, 2)}

=== ORIGINAL OCR TEXT (ground truth) ===
${ocrText.substring(0, 30000)}

Verify each extracted item has supporting evidence in the OCR text. Flag any hallucinations, incorrect codes, or missing important findings.`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${modelName} API error:`, errorText);
      throw new Error(`${modelName} API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      model: displayName,
      front_sheet_score: parsed.front_sheet_score || 0,
      snomed_score: parsed.snomed_score || 0,
      completeness_score: parsed.completeness_score || 0,
      safety_score: parsed.safety_score || 0,
      overall_score: parsed.overall_score || 0,
      issues: parsed.issues || [],
      assessment: parsed.assessment || '',
    };
  } catch (error) {
    console.error(`Error with ${modelName}:`, error);
    return {
      model: displayName,
      front_sheet_score: 0,
      snomed_score: 0,
      completeness_score: 0,
      safety_score: 0,
      overall_score: 0,
      issues: [`Failed to verify with ${modelName}: ${error.message}`],
      assessment: 'Verification failed',
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patient_id, practice_ods }: VerificationRequest = await req.json();

    if (!patient_id || !practice_ods) {
      return new Response(
        JSON.stringify({ error: 'patient_id and practice_ods are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

    if (!openaiKey && !lovableKey && !anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'No API keys configured for verification' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const basePath = `${practice_ods}/${patient_id}`;

    // Load summary JSON
    let summaryJson = null;
    try {
      const { data: summaryData } = await supabase.storage
        .from('lg')
        .download(`${basePath}/final/summary.json`);
      if (summaryData) {
        summaryJson = JSON.parse(await summaryData.text());
      }
    } catch (e) {
      console.error('Failed to load summary:', e);
    }

    // Load SNOMED JSON
    let snomedJson = null;
    try {
      const { data: snomedData } = await supabase.storage
        .from('lg')
        .download(`${basePath}/final/snomed.json`);
      if (snomedData) {
        snomedJson = JSON.parse(await snomedData.text());
      }
    } catch (e) {
      console.error('Failed to load SNOMED:', e);
    }

    // Load OCR text
    let ocrText = '';
    try {
      const { data: ocrData } = await supabase.storage
        .from('lg')
        .download(`${basePath}/work/ocr_merged.json`);
      if (ocrData) {
        const ocrJson = JSON.parse(await ocrData.text());
        ocrText = Array.isArray(ocrJson) ? ocrJson.join('\n\n') : JSON.stringify(ocrJson);
      }
    } catch (e) {
      // Try alternate path
      try {
        const { data: ocrData } = await supabase.storage
          .from('lg')
          .download(`${basePath}/final/ocr_merged.json`);
        if (ocrData) {
          const ocrJson = JSON.parse(await ocrData.text());
          ocrText = Array.isArray(ocrJson) ? ocrJson.join('\n\n') : JSON.stringify(ocrJson);
        }
      } catch (e2) {
        console.error('Failed to load OCR:', e2);
      }
    }

    if (!summaryJson && !snomedJson) {
      return new Response(
        JSON.stringify({ error: 'No summary or SNOMED data found to verify' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting multi-LLM verification for patient ${patient_id}`);

    // Run verification with multiple models in parallel
    const verificationPromises: Promise<LLMAssessment>[] = [];
    const modelsUsed: string[] = [];

    // Use OpenAI GPT-5
    if (openaiKey) {
      verificationPromises.push(
        verifyWithModel('gpt-5-2025-08-07', 'gpt-5', openaiKey, summaryJson, snomedJson, ocrText, 'https://api.openai.com/v1/chat/completions')
      );
      modelsUsed.push('gpt-5');
    }

    // Use Claude (Anthropic)
    if (anthropicKey) {
      verificationPromises.push(
        verifyWithClaude(anthropicKey, summaryJson, snomedJson, ocrText)
      );
      modelsUsed.push('claude-sonnet-4');
    }

    // Use Lovable AI (Gemini)
    if (lovableKey) {
      verificationPromises.push(
        verifyWithModel('google/gemini-3-flash-preview', 'gemini-3-flash', lovableKey, summaryJson, snomedJson, ocrText, 'https://ai.gateway.lovable.dev/v1/chat/completions')
      );
      modelsUsed.push('gemini-3-flash');

      // Also use Gemini 3.1 Pro for additional verification
      verificationPromises.push(
        verifyWithModel('google/gemini-3.1-pro-preview', 'gemini-3.1-pro', lovableKey, summaryJson, snomedJson, ocrText, 'https://ai.gateway.lovable.dev/v1/chat/completions')
      );
      modelsUsed.push('gemini-3.1-pro');
    }

    const assessments = await Promise.all(verificationPromises);
    const successfulAssessments = assessments.filter(a => a.overall_score > 0);

    if (successfulAssessments.length === 0) {
      return new Response(
        JSON.stringify({ error: 'All verification attempts failed', details: assessments }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate average scores
    const avgFrontSheet = Math.round(successfulAssessments.reduce((sum, a) => sum + a.front_sheet_score, 0) / successfulAssessments.length);
    const avgSnomed = Math.round(successfulAssessments.reduce((sum, a) => sum + a.snomed_score, 0) / successfulAssessments.length);
    const avgOverall = Math.round(successfulAssessments.reduce((sum, a) => sum + a.overall_score, 0) / successfulAssessments.length);

    // Collect all unique issues
    const allIssues = [...new Set(successfulAssessments.flatMap(a => a.issues))];

    // Build SNOMED code verification (simplified - mark all codes with average confidence)
    const snomedCodes: SnomedCodeVerification[] = [];
    if (snomedJson) {
      const categories = ['diagnoses', 'surgeries', 'allergies', 'immunisations'];
      for (const cat of categories) {
        if (snomedJson[cat]) {
          for (const item of snomedJson[cat]) {
            snomedCodes.push({
              term: item.term || item.condition || item.allergen || item.vaccine,
              code: item.code || item.snomed_code || 'N/A',
              rag_rating: getRagRating(avgSnomed),
              confidence: avgSnomed,
              issues: [],
              verified_by_models: modelsUsed.filter((_, i) => successfulAssessments[i]?.snomed_score >= 60),
            });
          }
        }
      }
    }

    // Generate recommendations based on scores
    const recommendations: string[] = [];
    if (avgFrontSheet < 85) {
      recommendations.push('Review clinical summary against original documents before use');
    }
    if (avgSnomed < 85) {
      recommendations.push('Verify SNOMED codes manually before importing to clinical system');
    }
    if (avgOverall < 60) {
      recommendations.push('Consider re-processing this record with manual review');
    }
    if (allIssues.length > 0) {
      recommendations.push(`Address ${allIssues.length} issue(s) identified by verification`);
    }

    const result: VerificationResult = {
      overall_rag_rating: getRagRating(avgOverall),
      overall_score: avgOverall,
      front_sheet_assessment: {
        rag_rating: getRagRating(avgFrontSheet),
        score: avgFrontSheet,
        issues: allIssues.filter(i => i.toLowerCase().includes('summary') || i.toLowerCase().includes('diagnosis') || i.toLowerCase().includes('clinical')),
        llm_consensus: successfulAssessments,
      },
      snomed_assessment: {
        rag_rating: getRagRating(avgSnomed),
        score: avgSnomed,
        issues_per_code: snomedCodes,
        llm_consensus: successfulAssessments,
      },
      recommendations,
      verified_at: new Date().toISOString(),
      models_used: modelsUsed,
    };

    // Update database with verification results
    const { error: updateError } = await supabase
      .from('lg_patients')
      .update({
        verification_status: avgOverall >= 85 ? 'verified' : avgOverall >= 60 ? 'issues_found' : 'failed',
        verification_score: avgOverall,
        verification_rag: result.overall_rag_rating,
        verification_results: result,
        verified_at: result.verified_at,
      })
      .eq('id', patient_id);

    if (updateError) {
      console.error('Failed to update verification status:', updateError);
    }

    console.log(`Verification complete for ${patient_id}: ${result.overall_rag_rating} (${avgOverall}%)`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Verification service error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});