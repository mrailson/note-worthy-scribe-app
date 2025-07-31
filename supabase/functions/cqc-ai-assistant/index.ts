import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface RequestBody {
  messages: Message[];
  practiceContext?: {
    policies?: Array<{
      title: string;
      policy_type: string;
      cqc_domain: string;
      status: string;
    }>;
    recentAlerts?: Array<{
      title: string;
      message: string;
      priority: string;
    }>;
    complianceStatus?: Record<string, number>;
  };
}

const CQC_SYSTEM_PROMPT = `You are an NHS GP Practice CQC Compliance Expert Assistant. You provide comprehensive, UK NICE and NHS-aligned guidance for GP practice inspections based on the latest CQC Key Lines of Enquiry (KLOEs).

Your expertise covers:
- The five CQC domains: Safe, Effective, Caring, Responsive, Well-led
- NHS England compliance requirements
- CQC inspection processes and expectations
- Policy development and evidence management
- Best practice recommendations

Guidelines:
1. Always provide practical, actionable advice
2. Include specific checklists when relevant
3. Reference current CQC standards and KLOE requirements
4. Suggest specific evidence types and documentation
5. Be concise but comprehensive
6. Focus on preparing practices for CQC inspections
7. Highlight critical compliance gaps

When answering:
- Start with a brief summary
- Provide detailed guidance with bullet points
- Include templates or examples where helpful
- Suggest immediate actions and long-term improvements
- Reference relevant CQC domains

Remember: Patient safety and quality of care are paramount in all recommendations.`;

async function callOpenAI(messages: Message[], practiceContext?: any): Promise<string> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Build context from practice data
  let contextPrompt = "";
  if (practiceContext) {
    contextPrompt += "\n\nPractice Context:\n";
    
    if (practiceContext.policies?.length > 0) {
      contextPrompt += "Current Policies:\n";
      practiceContext.policies.forEach((policy: any) => {
        contextPrompt += `- ${policy.title} (${policy.policy_type}, ${policy.cqc_domain}, Status: ${policy.status})\n`;
      });
    }
    
    if (practiceContext.recentAlerts?.length > 0) {
      contextPrompt += "\nRecent Alerts:\n";
      practiceContext.recentAlerts.forEach((alert: any) => {
        contextPrompt += `- ${alert.title}: ${alert.message} (Priority: ${alert.priority})\n`;
      });
    }
    
    if (practiceContext.complianceStatus) {
      contextPrompt += "\nCurrent Compliance Status:\n";
      Object.entries(practiceContext.complianceStatus).forEach(([domain, percentage]) => {
        contextPrompt += `- ${domain}: ${percentage}%\n`;
      });
    }

    if (practiceContext.uploadedFiles?.length > 0) {
      contextPrompt += "\nUploaded Documents:\n";
      practiceContext.uploadedFiles.forEach((file: any) => {
        contextPrompt += `- ${file.name}: ${file.content}\n`;
      });
    }
  }

  const gptMessages = [
    { role: 'system', content: CQC_SYSTEM_PROMPT + contextPrompt },
    ...messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  ];

  console.log('Sending request to OpenAI with', messages.length, 'messages');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: gptMessages,
      max_tokens: 2000,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  console.log('OpenAI response received successfully');
  return data.choices[0].message.content;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, practiceContext }: RequestBody = await req.json();

    console.log(`Processing CQC AI request with ${messages.length} messages`);

    const response = await callOpenAI(messages, practiceContext);

    return new Response(
      JSON.stringify({ response }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in cqc-ai-assistant function:', error);
    
    let errorMessage = 'An unexpected error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    );
  }
});