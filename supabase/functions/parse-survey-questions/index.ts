import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedQuestion {
  question_text: string;
  question_type: "rating" | "text" | "multiple_choice" | "yes_no" | "scale";
  options: string[];
  is_required: boolean;
  confidence: number;
}

interface ParseResult {
  title: string;
  questions: ParsedQuestion[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, contentType, fileName } = await req.json();
    
    console.log(`Parsing survey questions from ${contentType} content, fileName: ${fileName}`);
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `You are an expert at extracting survey questions from documents and images.

Your task is to analyse the provided content and extract:
1. A suggested survey title (infer from content, filename, or headers)
2. All survey-style questions with their appropriate types

QUESTION TYPE DETECTION RULES:
- "rating" (1-5 stars): Questions asking to rate something, satisfaction scales 1-5
- "scale" (1-10): Net Promoter Score (NPS), likelihood scales, scales explicitly 1-10
- "yes_no": Binary questions, true/false, agree/disagree without middle options
- "multiple_choice": Questions with specific listed options to choose from
- "text": Open-ended questions asking for feedback, comments, suggestions

DETECTION HINTS:
- "How likely are you to recommend..." → scale (NPS)
- "Rate your experience" or "satisfaction" → rating
- "Would you recommend..." with yes/no only → yes_no
- "Which of the following..." → multiple_choice
- "Please describe...", "What could we improve...", "Any comments..." → text
- Questions with bullet points or numbered options → multiple_choice (extract the options)

For multiple_choice questions, extract all the listed options.
Set is_required to true for main questions, false for optional/additional feedback questions.
Assign a confidence score (0.0-1.0) based on how certain you are about the question type.

If the content doesn't appear to contain survey questions, return an empty questions array.`;

    const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

    if (contentType === "image") {
      userContent.push({
        type: "text",
        text: `Extract survey questions from this image. The image may contain handwritten notes, a printed survey form, or a document with survey questions. File name: ${fileName || "image"}`,
      });
      userContent.push({
        type: "image_url",
        image_url: { url: content },
      });
    } else {
      userContent.push({
        type: "text",
        text: `Extract survey questions from the following document content. File name: ${fileName || "document"}\n\n---\n${content}\n---`,
      });
    }

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
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_survey",
              description: "Extract survey title and questions from the content",
              parameters: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                    description: "Suggested survey title based on content",
                  },
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
                          description: "The detected question type",
                        },
                        options: {
                          type: "array",
                          items: { type: "string" },
                          description: "Options for multiple choice questions",
                        },
                        is_required: {
                          type: "boolean",
                          description: "Whether the question should be required",
                        },
                        confidence: {
                          type: "number",
                          description: "Confidence score 0.0-1.0 for the detection",
                        },
                      },
                      required: ["question_text", "question_type", "options", "is_required", "confidence"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["title", "questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_survey" } },
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

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== "extract_survey") {
      console.error("No valid tool call in response");
      return new Response(
        JSON.stringify({ title: fileName || "Imported Survey", questions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: ParseResult;
    try {
      result = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error("Failed to parse tool arguments:", parseError);
      return new Response(
        JSON.stringify({ title: fileName || "Imported Survey", questions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Extracted ${result.questions.length} questions with title: "${result.title}"`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in parse-survey-questions:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
