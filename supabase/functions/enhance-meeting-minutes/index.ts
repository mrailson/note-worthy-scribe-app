import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { originalContent, enhancementType, specificRequest, context } = await req.json();

    if (!originalContent || !enhancementType) {
      throw new Error('Missing required fields: originalContent and enhancementType');
    }

    let systemPrompt = "";
    let userPrompt = "";

    // Define different enhancement types
    switch (enhancementType) {
      case 'make_detailed':
        systemPrompt = `You are an expert meeting minutes enhancer. Your task is to take existing meeting minutes and make them more detailed and comprehensive while maintaining accuracy. Add relevant context, expand on key points, and provide more thorough explanations.`;
        userPrompt = `Please make the following meeting minutes more detailed and comprehensive. Expand on key points, add relevant context, and provide more thorough explanations:\n\n${originalContent}`;
        break;

      case 'add_quotes':
        systemPrompt = `You are an expert meeting minutes enhancer. Your task is to enhance meeting minutes by adding realistic and appropriate direct quotes where they would naturally occur. The quotes should be professional, contextually appropriate, and enhance the clarity of decisions and discussions.`;
        userPrompt = `Please enhance the following meeting minutes by adding realistic direct quotes where appropriate. The quotes should sound natural and professional:\n\n${originalContent}`;
        break;

      case 'replace_content':
        systemPrompt = `You are an expert meeting minutes editor. Your task is to make specific replacements or modifications to meeting minutes based on user requests while maintaining the overall structure and professionalism of the document.`;
        userPrompt = `Please modify the following meeting minutes according to this request: "${specificRequest}"\n\nOriginal content:\n${originalContent}`;
        break;

      case 'improve_clarity':
        systemPrompt = `You are an expert meeting minutes enhancer. Your task is to improve the clarity and readability of meeting minutes while maintaining all the original information. Make the content more professional, well-organized, and easier to understand.`;
        userPrompt = `Please improve the clarity and readability of the following meeting minutes. Make them more professional and well-organized:\n\n${originalContent}`;
        break;

      case 'add_structure':
        systemPrompt = `You are an expert meeting minutes enhancer. Your task is to improve the structure and organization of meeting minutes by adding proper headings, sections, and formatting while maintaining all original content.`;
        userPrompt = `Please improve the structure and organization of the following meeting minutes by adding proper headings, sections, and formatting:\n\n${originalContent}`;
        break;

      case 'custom':
        systemPrompt = `You are an expert meeting minutes enhancer. Your task is to modify meeting minutes according to specific user requests while maintaining professionalism and accuracy.`;
        userPrompt = `Please modify the following meeting minutes according to this specific request: "${specificRequest}"\n\nOriginal content:\n${originalContent}`;
        break;

      default:
        throw new Error('Invalid enhancement type');
    }

    // Add context if provided
    if (context) {
      userPrompt += `\n\nAdditional context: ${context}`;
    }

    console.log('Enhancing meeting minutes with type:', enhancementType);

    const modelName = 'o4-mini-2025-04-16';
    const startedAt = Date.now();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const enhancedContent = data.choices[0].message.content;

    console.log('Successfully enhanced meeting minutes');

    return new Response(JSON.stringify({ 
      enhancedContent,
      originalLength: originalContent.length,
      enhancedLength: enhancedContent.length,
      model: modelName,
      elapsed_ms: Date.now() - startedAt
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in enhance-meeting-minutes function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});