import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET") || "";
const FN_URL = `${supabaseUrl}/functions/v1/process-ppg-call`;

const admin = createClient(supabaseUrl, serviceKey);

async function hmacHex(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async () => {
  const results: any = {};

  // Cleanup any prior test rows
  await admin.from("nres_ppg_responses").delete().in("elevenlabs_conversation_id", [
    "TEST-006-bearer-still-works", "TEST-007-hmac-auth",
  ]);

  // ==== TEST C — Bearer + x-source (flat payload) ====
  const flatPayload = {
    conversation_id: "TEST-006-bearer-still-works",
    agent_id: "agent_test",
    duration_seconds: 95,
    started_at: "2026-05-07T10:30:00.000Z",
    ended_at: "2026-05-07T10:31:35.000Z",
    data_collection: {
      survey_completed: true,
      practice_id: "towcester",
      practice_label: "Towcester Medical Centre",
      rating: "better",
    },
    transcript: [
      { role: "agent", message: "Hello, how was your experience?", time_offset_s: 0 },
      { role: "user", message: "Better than last time.", time_offset_s: 5 },
    ],
  };
  const cResp = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceKey}`,
      "x-source": "elevenlabs",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(flatPayload),
  });
  results.testC = { status: cResp.status, body: await cResp.json() };

  // ==== TEST D — HMAC signature on nested ElevenLabs payload ====
  const startUnix = 1746619200;
  const nestedPayload = {
    type: "post_call_transcription",
    data: {
      conversation_id: "TEST-007-hmac-auth",
      agent_id: "agent_test_hmac",
      metadata: { start_time_unix_secs: startUnix, call_duration_secs: 120 },
      analysis: {
        data_collection_results: {
          practice_id: { data_collection_id: "practice_id", value: "brackley", rationale: "user said brackley" },
          practice_label: { data_collection_id: "practice_label", value: "Brackley Medical Centre", rationale: "" },
          rating: { data_collection_id: "rating", value: "same", rationale: "" },
          survey_completed: { data_collection_id: "survey_completed", value: true, rationale: "" },
        },
      },
      transcript: [
        { role: "agent", message: "Hi, can I take your feedback?", time_in_call_secs: 0 },
        { role: "user", message: "Yes please.", time_in_call_secs: 4 },
        { role: "agent", message: "How was the visit?", time_in_call_secs: 8 },
        { role: "user", message: "About the same as usual.", time_in_call_secs: 12 },
      ],
    },
  };
  const rawBody = JSON.stringify(nestedPayload);
  const ts = Math.floor(Date.now() / 1000).toString();
  const hash = await hmacHex(webhookSecret, `${ts}.${rawBody}`);
  const sigHeader = `t=${ts},v0=${hash}`;

  const dResp = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "elevenlabs-signature": sigHeader,
      "Content-Type": "application/json",
    },
    body: rawBody,
  });
  results.testD = { status: dResp.status, body: await dResp.json(), sigSent: sigHeader };

  // Verify rows
  const { data: rows } = await admin
    .from("nres_ppg_responses")
    .select("id, elevenlabs_conversation_id, channel, practice_id, rating")
    .in("elevenlabs_conversation_id", ["TEST-006-bearer-still-works", "TEST-007-hmac-auth"]);
  results.rows = rows;

  return new Response(JSON.stringify(results, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
