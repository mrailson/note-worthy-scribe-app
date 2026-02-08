import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeneratedQuestion {
  question_text: string;
  question_type: "rating" | "text" | "multiple_choice" | "yes_no" | "scale";
  options: string[];
  is_required: boolean;
  confidence: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, surveyType, existingQuestionCount } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Please provide a description of the questions you need." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating survey questions from prompt: "${prompt.substring(0, 100)}..."`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const surveyContext = surveyType && surveyType !== "custom"
      ? `The survey is a "${surveyType}" type survey.`
      : "";

    const orderingContext = existingQuestionCount && existingQuestionCount > 0
      ? `There are already ${existingQuestionCount} questions in the survey, so generate questions that complement rather than duplicate existing ones.`
      : "";

    const systemPrompt = `You are an expert survey designer specialising in NHS GP practice surveys.

Your task is to generate survey questions based on the user's description.

CONTEXT:
${surveyContext}
${orderingContext}

QUESTION TYPE RULES:
- "rating" (1-5 stars): Questions asking to rate something, satisfaction scales 1-5
- "scale" (1-10): Net Promoter Score (NPS), likelihood scales, scales explicitly 1-10
- "yes_no": Binary questions, true/false, agree/disagree without middle options
- "multiple_choice": Questions with specific listed options to choose from
- "text": Open-ended questions asking for feedback, comments, suggestions

GUIDELINES:
- Generate clear, professional, unbiased questions
- Use appropriate question types based on what's being asked
- For multiple_choice questions, provide 3-5 sensible options
- Set is_required to true for main questions, false for optional/follow-up questions
- Assign confidence scores (0.8-1.0) based on how well the question matches the request
- Use British English spelling and conventions
- Keep questions concise but clear
- If the user asks for a specific number of questions, generate that many
- If no number specified, generate 3-5 questions as appropriate`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate survey questions based on this description: ${prompt}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_questions",
              description: "Generate structured survey questions based on the user's description",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question_text: {
                          type: "string",
                          description: "The full question text",
                        },
                        question_type: {
                          type: "string",
                          enum: ["rating", "text", "multiple_choice", "yes_no", "scale"],
                          description: "The appropriate question type",
                        },
                        options: {
                          type: "array",
                          items: { type: "string" },
                          description: "Options for multiple choice questions (empty array for other types)",
                        },
                        is_required: {
                          type: "boolean",
                          description: "Whether the question should be required",
                        },
                        confidence: {
                          type: "number",
                          description: "Confidence score 0.0-1.0 for the question relevance",
                        },
                      },
                      required: ["question_text", "question_type", "options", "is_required", "confidence"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_questions" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received:", JSON.stringify(data).substring(0, 500));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== "generate_questions") {
      console.error("No valid tool call in response");
      return new Response(
        JSON.stringify({ questions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: { questions: GeneratedQuestion[] };
    try {
      result = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error("Failed to parse tool arguments:", parseError);
      return new Response(
        JSON.stringify({ questions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generated ${result.questions.length} questions`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-survey-questions:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
