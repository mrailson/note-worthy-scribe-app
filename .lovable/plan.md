

# Gemini Live API Voice Agent — Browser Integration

## Problem
The provided Python script uses desktop-only libraries (PyAudio, OpenCV, mss). It cannot run in a browser. We need to adapt the same Gemini Live API concept into a React component using the `@google/genai` JavaScript SDK and Web Audio APIs.

## Architecture

```text
Browser                          Edge Function                  Google
┌──────────────┐    POST /token  ┌──────────────┐   REST API   ┌─────────┐
│ React UI     │ ───────────────►│ gemini-live- │ ────────────►│ Gemini  │
│ (AudioWorklet│    { token }    │ token        │   ephemeral  │ API     │
│  + WebSocket)│ ◄───────────── │              │   token      │         │
│              │                 └──────────────┘              │         │
│              │    WebSocket (wss://)                          │         │
│              │ ──────────────────────────────────────────────►│ Live API│
└──────────────┘                                               └─────────┘
```

## What We'll Build

### 1. Edge function: `gemini-live-token`
- Uses the existing `GEMINI_API_KEY` secret to generate an ephemeral token via `@google/genai` SDK
- Returns `{ token, model }` to the client
- Token is short-lived (~30 min), single-use — keeps the API key secure

### 2. React component: `GeminiLiveVoiceAgent`
- Replaces the placeholder content in `VoiceConversationTab.tsx`
- Uses `@google/genai` JS SDK's `ai.live.connect()` with the ephemeral token
- Captures microphone via `navigator.mediaDevices.getUserMedia` + AudioWorklet (reusing existing `pcm16-writer.js` worklet for 16kHz PCM resampling)
- Sends 16-bit PCM audio chunks to the Gemini Live session
- Receives 24kHz PCM audio responses and plays them via Web Audio API
- Mirrors the Python script's config: model `gemini-3.1-flash-live-preview`, voice "Zephyr", audio-only response modality, context window compression

### 3. UI Features
- **Connect/Disconnect button** with status indicator (connecting, connected, listening, agent speaking)
- **Audio visualisation** — simple pulsing orb showing input/output levels
- **Text transcript display** — shows any text responses from the agent
- **Mode selector** — audio-only (default), matching the Python script's modes minus camera/screen (not applicable for this test)
- **Volume control** slider for output audio

### 4. npm dependency
- Install `@google/genai` package

## Key Technical Details

- **Audio format**: Input 16kHz mono 16-bit PCM (matches the existing `pcm16-writer.js` worklet), output 24kHz mono 16-bit PCM
- **Playback**: Create an `AudioContext` at 24kHz, decode raw PCM into `AudioBuffer`, queue for gapless playback
- **Interruption handling**: When user speaks while agent is playing, clear the audio playback queue (same pattern as the Python script's `receive_audio` method)
- **Session config**: Matches the Python script — `response_modalities: ["AUDIO"]`, `media_resolution: "MEDIA_RESOLUTION_MEDIUM"`, Zephyr voice, context window compression with 104857 trigger tokens

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/gemini-live-token/index.ts` | Create — ephemeral token endpoint |
| `src/components/gemini/GeminiLiveVoiceAgent.tsx` | Create — main voice agent component |
| `src/components/document-email/VoiceConversationTab.tsx` | Modify — embed the new component |

