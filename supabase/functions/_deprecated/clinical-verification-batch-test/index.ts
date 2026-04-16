import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface TestPrompt {
  id: string;
  prompt: string;
  description: string;
  expectedComplexity: 'low' | 'medium' | 'high';
}

const testPrompts: TestPrompt[] = [
  {
    id: 'diabetes_management',
    prompt: 'Provide comprehensive guidance on Type 2 diabetes management including HbA1c targets, first-line medications, lifestyle interventions, and monitoring requirements according to NICE guidelines.',
    description: 'Diabetes Management Guidelines',
    expectedComplexity: 'high'
  },
  {
    id: 'hypertension_treatment',
    prompt: 'What are the current NICE recommendations for treating hypertension in adults, including step-wise approach, target blood pressure levels, and choice of antihypertensive medications?',
    description: 'Hypertension Treatment Protocol',
    expectedComplexity: 'medium'
  },
  {
    id: 'antibiotic_prescribing',
    prompt: 'Provide guidance on antibiotic prescribing for common respiratory tract infections, including when to prescribe, choice of antibiotic, duration, and antimicrobial resistance considerations.',
    description: 'Antibiotic Prescribing Guidelines',
    expectedComplexity: 'high'
  },
  {
    id: 'asthma_management',
    prompt: 'What is the step-wise approach to asthma management in adults according to BTS/SIGN guidelines, including inhaler techniques and when to refer to specialist care?',
    description: 'Adult Asthma Management',
    expectedComplexity: 'medium'
  },
  {
    id: 'contraception_choices',
    prompt: 'Summarize the available contraceptive methods for women, their effectiveness rates, contraindications, and factors to consider when counseling patients about contraceptive choices.',
    description: 'Contraception Counseling Guide',
    expectedComplexity: 'low'
  }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting batch clinical verification tests...');
    
    const results = [];
    
    for (const testPrompt of testPrompts) {
      console.log(`Testing: ${testPrompt.description}`);
      
      try {
        // Call the existing clinical verification service
        const verificationResponse = await supabase.functions.invoke('clinical-verification-service', {
          body: {
            messageId: `test_${testPrompt.id}_${Date.now()}`,
            originalPrompt: testPrompt.prompt,
            responses: [{
              role: 'assistant',
              content: `Clinical response for ${testPrompt.description}. This is a test response to evaluate AI model verification capabilities for ${testPrompt.expectedComplexity} complexity medical queries.`,
              model: 'test-model',
              responseTime: Math.random() * 3000 + 1000
            }]
          }
        });

        if (verificationResponse.error) {
          console.error(`Verification failed for ${testPrompt.id}:`, verificationResponse.error);
          results.push({
            testId: testPrompt.id,
            description: testPrompt.description,
            complexity: testPrompt.expectedComplexity,
            status: 'failed',
            error: verificationResponse.error.message,
            timestamp: new Date().toISOString()
          });
        } else {
          console.log(`Verification completed for ${testPrompt.id}`);
          results.push({
            testId: testPrompt.id,
            description: testPrompt.description,
            complexity: testPrompt.expectedComplexity,
            status: 'completed',
            verificationData: verificationResponse.data,
            timestamp: new Date().toISOString()
          });
        }

        // Wait 2 seconds between tests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Error testing ${testPrompt.id}:`, error);
        results.push({
          testId: testPrompt.id,
          description: testPrompt.description,
          complexity: testPrompt.expectedComplexity,
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Store results in database for analysis
    const { error: insertError } = await supabase
      .from('clinical_verification_tests')
      .insert({
        batch_id: `batch_${Date.now()}`,
        test_results: results,
        total_tests: testPrompts.length,
        completed_tests: results.filter(r => r.status === 'completed').length,
        failed_tests: results.filter(r => r.status === 'failed').length
      });

    if (insertError) {
      console.error('Error storing test results:', insertError);
    }

    const summary = {
      totalTests: testPrompts.length,
      completedTests: results.filter(r => r.status === 'completed').length,
      failedTests: results.filter(r => r.status === 'failed').length,
      errorTests: results.filter(r => r.status === 'error').length,
      results: results
    };

    console.log('Batch testing completed:', summary);

    return new Response(JSON.stringify({
      success: true,
      summary,
      message: `Completed ${summary.completedTests}/${summary.totalTests} clinical verification tests`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in batch clinical verification:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to run batch clinical verification tests'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});