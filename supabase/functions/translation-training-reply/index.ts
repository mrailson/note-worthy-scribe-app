import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SCENARIO_CONTEXTS: Record<string, string> = {
  new_patient_registration:
    "You are registering at a new GP practice for the first time. You need to provide your name, date of birth, address, and previous GP details. You may be unsure about some details or ask for clarification about forms.",
  prescription_collection:
    "You are at the GP reception to collect a prescription. You may need to confirm your name and date of birth. You might ask about dosage, whether the medication is ready, or if there are any changes.",
  appointment_booking:
    "You are trying to book an appointment with the GP. You may have preferences about timing, mention symptoms briefly, or ask about availability. You might be unsure about which type of appointment you need.",
  general_enquiry:
    "You are at the GP reception with a general question. This could be about test results, referral letters, sick notes, or administrative matters. You may be a bit confused about the process.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { conversationHistory, patientLanguage, scenario } = await req.json();

    if (!patientLanguage) {
      return new Response(
        JSON.stringify({ error: "patientLanguage is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scenarioContext =
      SCENARIO_CONTEXTS[scenario] || SCENARIO_CONTEXTS["general_enquiry"];

    // Build conversation context for the AI
    const conversationLines = (conversationHistory || [])
      .map(
        (msg: { speaker: string; englishText: string }) =>
          `${msg.speaker === "staff" ? "Receptionist" : "Patient"}: ${msg.englishText}`
      )
      .join("\n");

    const systemPrompt = `You are role-playing as a patient at a GP (General Practice) reception desk in the UK. You MUST respond ONLY in the language with code "${patientLanguage}". Do NOT include any English in your response.

Scenario: ${scenarioContext}

Guidelines:
- Keep replies short and natural (1-2 sentences maximum)
- Respond as a real patient would — sometimes hesitant, sometimes confused, occasionally asking clarifying questions
- Use natural, everyday speech patterns (not formal or literary language)
- Stay in character throughout the conversation
- If the receptionist asks a question, answer it appropriately for the scenario
- Occasionally add realistic details (e.g. a name, a street, a symptom) to make it feel authentic
- Do NOT break character or acknowledge that this is a training exercise
- Do NOT include translations, transliterations, or any meta-commentary
- Respond ONLY with the patient's spoken words in "${patientLanguage}"`;

    const messages = [
      { role: "system", content: systemPrompt },
    ];

    if (conversationLines) {
      messages.push({
        role: "user",
        content: `Here is the conversation so far:\n${conversationLines}\n\nNow generate the patient's next reply in "${patientLanguage}" only.`,
      });
    } else {
      messages.push({
        role: "user",
        content: `The receptionist has just greeted you. Generate your first response as a patient arriving at the GP reception, in "${patientLanguage}" only.`,
      });
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
          temperature: 0.8,
          max_tokens: 200,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please top up in workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const patientReply =
      data.choices?.[0]?.message?.content?.trim() || "";

    if (!patientReply) {
      throw new Error("Empty response from AI");
    }

    return new Response(
      JSON.stringify({ patientReply }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("translation-training-reply error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
