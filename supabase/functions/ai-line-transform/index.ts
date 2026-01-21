import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

interface TransformRequest {
  meetingId?: string;
  consultationId?: string;
  lineContent: string;
  action: 'regenerate' | 'check_tone' | 'reduce' | 'expand' | 'formalise' | 'clarify' | 'clinical';
  context?: string;
  contextType?: 'meeting' | 'clinical';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { lineContent, action, context, contextType } = await req.json() as TransformRequest;

    if (!lineContent || !action) {
      throw new Error('Missing required fields: lineContent and action');
    }

    console.log(`Processing ${action} action for line: "${lineContent.substring(0, 50)}..."`);

    // Build the prompt based on the action and context type
    const isClinical = contextType === 'clinical';
    
    let systemPrompt = isClinical
      ? `You are an expert medical editor for NHS clinical documentation. You help improve clinical text while maintaining accuracy, using appropriate medical terminology, and ensuring clarity for healthcare professionals. Always respond with ONLY the improved text, no explanations or quotes around it.`
      : `You are an expert editor for professional meeting notes. You help improve text while maintaining clarity and professionalism. Always respond with ONLY the improved text, no explanations or quotes around it.`;
    
    let userPrompt = '';
    
    switch (action) {
      case 'regenerate':
        if (isClinical) {
          userPrompt = `Rewrite this clinical statement to be clearer and more professional while maintaining medical accuracy:\n\n"${lineContent}"\n\nContext from the clinical notes:\n${context || 'No additional context provided.'}`;
        } else {
          userPrompt = `Rewrite this line to be clearer and more professional while keeping the same meaning:\n\n"${lineContent}"\n\nContext from the meeting notes:\n${context || 'No additional context provided.'}`;
        }
        break;
        
      case 'check_tone':
        userPrompt = `Review this line and soften any harsh, accusatory, or unprofessional language. Make it more diplomatic and constructive while preserving the core message:\n\n"${lineContent}"`;
        break;
        
      case 'reduce':
        if (isClinical) {
          userPrompt = `Make this clinical statement more concise by removing unnecessary words while preserving all clinically relevant information:\n\n"${lineContent}"`;
        } else {
          userPrompt = `Make this line more concise by removing unnecessary words while keeping the essential information:\n\n"${lineContent}"`;
        }
        break;
        
      case 'expand':
        if (isClinical) {
          userPrompt = `Expand this clinical statement with more relevant clinical detail to make it clearer and more comprehensive:\n\n"${lineContent}"\n\nContext from the clinical notes:\n${context || 'No additional context provided.'}`;
        } else {
          userPrompt = `Expand this line with more detail and context to make it clearer and more comprehensive:\n\n"${lineContent}"\n\nContext from the meeting notes:\n${context || 'No additional context provided.'}`;
        }
        break;
        
      case 'formalise':
        userPrompt = `Convert this line to formal NHS governance language, suitable for official meeting minutes:\n\n"${lineContent}"`;
        break;
      
      case 'clarify':
        userPrompt = `Clarify this clinical statement to remove any ambiguity whilst maintaining accuracy. Make the meaning precise and unambiguous for healthcare professionals:\n\n"${lineContent}"\n\nContext from the clinical notes:\n${context || 'No additional context provided.'}`;
        break;
        
      case 'clinical':
        userPrompt = `Convert this to formal NHS clinical language suitable for medical records. Use appropriate medical terminology and standard clinical phrasing:\n\n"${lineContent}"\n\nContext from the clinical notes:\n${context || 'No additional context provided.'}`;
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const transformedContent = data.choices?.[0]?.message?.content?.trim();

    if (!transformedContent) {
      throw new Error('No content returned from AI');
    }

    // Clean up the response - remove quotes if the AI added them
    const cleanedContent = transformedContent
      .replace(/^["']|["']$/g, '')
      .trim();

    console.log(`Transformed "${lineContent.substring(0, 30)}..." to "${cleanedContent.substring(0, 30)}..."`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        transformedContent: cleanedContent,
        action 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in ai-line-transform:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
