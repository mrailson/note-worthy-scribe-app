

## Auto-Transcribe and Analyse Audio Evidence on Upload

### Overview
When an audio file (e.g. a phone call recording) is uploaded as evidence, it will automatically be transcribed using the existing `speech-to-text` edge function and then analysed by AI to produce a detailed report covering: call transcript summary, tone of the call, how the complaint was handled, any rudeness or hostility from the patient, and lessons for the practice.

### Current Behaviour
- Audio files are uploaded and given a static AI summary: *"Audio recording uploaded. Use the Transcribe button to extract the audio content."*
- The user must manually click "Transcribe" to get the transcript
- No automatic tone/call analysis is performed

### What Changes

#### 1. Update `analyse-evidence-file` Edge Function
Modify the `audio` case in the edge function to:
1. **Transcribe the audio** by calling the existing `speech-to-text` edge function internally (service-to-service call via Supabase URL)
2. **Analyse the transcript** using Gemini 3 Flash with a complaint-specific prompt that covers:
   - Brief summary of the call contents
   - Tone of the caller and staff (professional, rude, hostile, calm, distressed, etc.)
   - How the complaint/issue was handled during the call
   - Any concerning behaviour from the patient (rudeness, aggression, threats)
   - Any concerning behaviour from staff (dismissive, unhelpful, rude)
   - Lessons or recommendations for the practice
3. Return both the `summary` (the AI analysis report) and `evidenceType: "audio"` as before
4. Also return the raw `transcript` text so the frontend can auto-save it

#### 2. Update `InvestigationEvidence.tsx` Upload Pipeline
In the `processFile` function, after receiving the analysis response for audio files:
1. Auto-save the transcript to `complaint_investigation_transcripts` (the same table used by the manual Transcribe button) so it appears in the Audio Transcripts tab
2. Store the detailed AI analysis as the `ai_summary` on the evidence record
3. The audio file will show the full AI analysis in the evidence list instead of the generic placeholder

#### 3. Enhanced Evidence File Display for Audio
Audio evidence files will now display the AI analysis report (tone, handling, lessons) directly in the Evidence Files tab, giving investigators immediate insight without needing to click Transcribe separately.

### File Changes

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/analyse-evidence-file/index.ts` | Edit | Add audio transcription via speech-to-text + AI analysis with complaint-context prompt |
| `src/components/InvestigationEvidence.tsx` | Edit | Auto-save transcript to `complaint_investigation_transcripts` when audio is processed |

### Technical Details

**Edge Function Audio Flow:**
```text
Audio file received (base64)
    |
    v
Call speech-to-text edge function (internal service call)
    |
    v
Receive transcript text
    |
    v
Send transcript to Gemini 3 Flash with complaint-analysis prompt
    |
    v
Return { evidenceType: "audio", summary: "[detailed analysis]", transcript: "[raw text]" }
```

**AI Analysis Prompt will cover:**
- Summary of call contents (2-3 sentences)
- Tone assessment (caller and staff)
- Complaint handling quality
- Patient behaviour observations (rudeness, aggression, distress)
- Staff behaviour observations (professionalism, empathy, dismissiveness)
- Practice lessons and recommendations

**Service-to-Service Call:**
The `analyse-evidence-file` function will call `speech-to-text` using the Supabase internal URL (`SUPABASE_URL/functions/v1/speech-to-text`) with the `SUPABASE_ANON_KEY` for authentication. This reuses the existing Whisper transcription pipeline including preprocessing and hallucination detection.

**Frontend Auto-Save:**
When the analysis response includes a `transcript` field, the upload pipeline will automatically insert a record into `complaint_investigation_transcripts` with the transcribed text, so it immediately appears in the Audio Transcripts tab alongside any manually triggered transcriptions.

