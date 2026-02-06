## ✅ IMPLEMENTED

# Standardise Batch Transcription Audio -- Server-Side Preprocessing (Corrected)

## Summary

Eliminate WAV encoding from the client entirely. Standardise all batch transcription to a single preprocessed stream before ASR by transcoding server-side using ffmpeg. Clients will continue uploading their native browser format (WebM/Opus on desktop/Android, M4A/AAC on iOS) -- no format changes on mobile at all. A new edge function handles transcoding to FLAC 16-bit, 16 kHz, mono before forwarding to any ASR provider.

Transcoding to FLAC ensures consistent preprocessing and input characteristics across ASR engines; it does not restore information lost in Opus/AAC capture. The benefit comes from standardised resampling, stable loudness, and a single canonical intermediate format -- not from the container itself.

## Critical Corrections Applied

| Issue | Correction |
|-------|-----------|
| Pure-JS FLAC encoder proposed | Rejected entirely. No browser-side FLAC encoding. Server-side ffmpeg only |
| "VERBATIM FLAC" claimed 40-60% compression | Verbatim FLAC is ~same size as WAV. Real compression requires ffmpeg's predictive coding, done server-side |
| "FLAC preserves accuracy" framing | FLAC does not restore information lost in Opus/AAC. Accuracy benefit comes from consistent preprocessing |
| Multiple conflicting ffmpeg normalisation commands | Single chosen approach: `highpass=f=80` + `loudnorm` (EBU R128). No alternatives left in spec |
| "Supabase Edge can shell out" | Corrected: Deno edge functions cannot run native binaries. Primary approach is ffmpeg.wasm; fallback is external worker service |
| Fallback "wrap PCM in FLAC headers" claimed as trivial | Removed. Fallback is honest: client resamples via OfflineAudioContext, uploads WAV/PCM, server forwards as WAV if transcoding is unavailable |
| No instruction to protect mobile capture codec | Added explicit rule: never force WAV or any uncompressed codec on mobile MediaRecorder |

## Current State (What Exists)

| Component | Current Behaviour | Changes? |
|-----------|-------------------|----------|
| `audioTranscoder.ts` | Resamples to 16 kHz mono, encodes as 16-bit PCM WAV (manual RIFF header writer) | Remove WAV encoder entirely |
| `audioSilenceTrimmer.ts` | Trims silence, re-encodes to WAV via duplicate WAV encoder | Remove duplicate WAV encoder |
| `MeetingRecorder.tsx` | Only path that calls `transcodeToWhisperFormat()` before upload | Remove client-side transcode call |
| `DesktopWhisperTranscriber.ts` | Sends raw WebM/Opus (128 kbps) directly | No change -- already correct |
| `WhisperTranscriber.ts` | Sends raw WebM/Opus directly | No change -- already correct |
| `SimpleIOSTranscriber.ts` | Sends raw M4A/MP4 directly (20s rotation) | No change -- already correct |
| `WhisperBatchTranscriber.ts` | Sends raw WebM directly | No change -- already correct |
| `speech-to-text/index.ts` | Accepts base64 audio, forwards to OpenAI `whisper-1` as-is | Add server-side transcode step |
| `speech-to-text-chunked/index.ts` | Accepts FormData blob, forwards to OpenAI `whisper-1` as-is | Add server-side transcode step |
| `process-meeting-audio/index.ts` | Forces `.webm` extension on everything, forwards to OpenAI | Add server-side transcode step, remove forced `.webm` |
| `standalone-whisper/index.ts` | Trial-and-error format loop (tries mp4, mp3, wav, webm, ogg) | Replace with single FLAC path via transcode |

Key insight: Four of five transcribers already upload native format without any client-side transcoding. Only `MeetingRecorder.tsx` transcodes to WAV. The plan removes that one WAV path and adds server-side standardisation to all edge functions.

## Architecture

```text
BEFORE                                        AFTER
======                                        =====
Browser                                       Browser
  |                                             |
  +-- MeetingRecorder: transcode to WAV -->     +-- All paths: upload native format
  +-- Desktop: raw WebM/Opus ------------>        (WebM/Opus or M4A/AAC)
  +-- iOS: raw M4A/AAC ----------------->         |
  +-- Whisper: raw WebM ----------------->        v
  +-- Batch: raw WebM ----------------->      Edge Function receives blob
  |                                             |
  v                                             v
Edge Function                               transcode-audio (ffmpeg.wasm)
  |                                             |-- highpass=f=80
  v                                             |-- loudnorm (EBU R128)
Forward to OpenAI as-is                         |-- resample 16kHz mono
(inconsistent formats)                          |-- encode FLAC 16-bit
                                                |-- NO noise suppression
                                                |
                                                v
                                            FLAC blob (~300-500KB per 25s)
                                                |
                                                v
                                            Forward to ASR provider
                                            (OpenAI / Deepgram / AssemblyAI)
```

## What Changes

### 1. New Edge Function: `transcode-audio`

A server-side transcoding service that accepts any audio format and returns FLAC 16 kHz mono 16-bit.

**Single ffmpeg command (no competing alternatives)**:
```text
ffmpeg -i input \
  -af "highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11" \
  -ar 16000 -ac 1 -c:a flac -sample_fmt s16 \
  output.flac
```

This uses EBU R128 loudness normalisation (`loudnorm`), which is:
- Consistent across recordings (targets -16 LUFS)
- Prevents clipping (true peak limited to -1.5 dBFS)
- Better than simple peak normalisation for speech (handles varying speaker volumes)
- A single, well-defined filter chain with no ambiguity

**No noise suppression** is applied -- ASR models handle this better natively.

**Runtime environment**:
- Primary: ffmpeg.wasm compiled for Deno (if performance and memory permit within edge function limits)
- Preferred fallback: A small dedicated transcoding worker (Cloud Run, Fly.io, or Lambda) called by the edge function via HTTP
- Last resort: Client does lightweight resample to 16 kHz mono via `OfflineAudioContext`, uploads as WAV/PCM; server forwards as WAV without FLAC conversion (larger files but still functional)

The function accepts audio as either base64 JSON body or FormData blob, and returns the transcoded FLAC as a binary response or base64 JSON.

### 2. Remove Client-Side WAV Encoding

**`src/utils/audioTranscoder.ts`**:
- Remove `audioBufferToWav()` function entirely (the manual RIFF header writer at lines 93-143)
- Remove `writeString()` helper (lines 145-149)
- Simplify `transcodeToWhisperFormat()` to return the original blob unchanged (pass-through)
- Update `shouldTranscode()` to always return `false` (client no longer transcodes)
- Mark the file as deprecated with comments pointing to server-side `transcode-audio`
- Update `TranscodeOptions` type to remove `format` field

**`src/utils/audioSilenceTrimmer.ts`**:
- Remove the duplicate WAV encoder (`audioBufferToBlob()`)
- Keep the silence detection/trimming logic (still useful for filtering silent chunks before upload)
- Change `trimSilence()` to return the original blob after trimming, in its native format, without re-encoding to WAV

**CRITICAL RULE**: Do not force `audio/wav` or any uncompressed codec on mobile `MediaRecorder`. The capture codec must remain the browser's native format (WebM/Opus or M4A/AAC).

### 3. Simplify Client Upload Paths

**`MeetingRecorder.tsx`** (the only transcriber that currently transcodes):
- Remove the `transcodeToWhisperFormat()` call (lines ~1542-1549)
- Send the silence-trimmed blob directly in its native format
- Update chunk durations: first chunk 20s, subsequent chunks 25s

**Other transcribers** (no changes needed -- they already upload native format):
- `DesktopWhisperTranscriber.ts`: Already sends raw WebM/Opus at 128 kbps
- `WhisperTranscriber.ts`: Already sends raw WebM/Opus
- `SimpleIOSTranscriber.ts`: Already sends raw M4A/AAC with 20s rotation
- `WhisperBatchTranscriber.ts`: Already sends raw WebM

### 4. Update Chunking Configuration

**`src/config/whisperChunking.ts`**:
- `chunkDurationMs`: 15000 to 25000 (25 seconds)
- `overlapMs`: 1000 to 2500 (2.5 seconds)
- `accumulateUntilMs`: 15000 to 25000

**`MeetingRecorder.tsx`**:
- First chunk duration: 10s to 20s
- Subsequent chunk duration: 30s to 25s

Other transcribers already use appropriate durations within the 20-30s guidance.

### 5. Update STT Edge Functions to Transcode Before ASR

Each batch transcription edge function will call the `transcode-audio` service before forwarding to the ASR provider. The transcode call is an internal function-to-function invocation.

**`speech-to-text/index.ts`** (base64 path, used by MeetingRecorder and DesktopWhisperTranscriber):
- After receiving the base64 audio and decoding to bytes, invoke `transcode-audio` to get FLAC
- Forward the FLAC blob to OpenAI instead of the raw format
- Add FLAC to the MIME type mapping: `'audio/flac' -> 'flac'`
- Remove the WAV default fallback (line 55: `let detectedMimeType = mimeType || 'audio/wav'` becomes `'audio/webm'`)

**`speech-to-text-chunked/index.ts`** (FormData path, used by WhisperTranscriber and SimpleIOSTranscriber):
- After receiving the FormData blob, invoke `transcode-audio`
- Forward FLAC to OpenAI
- Add `'audio/flac' -> 'flac'` to file extension detection (after line 125)
- No other structural changes -- the retry logic and response parsing remain the same

**`process-meeting-audio/index.ts`** (FormData path):
- After receiving the file, invoke `transcode-audio`
- Remove the forced `.webm` extension logic (lines 61-64 and line 81)
- Forward FLAC to OpenAI
- Remove the hardcoded `audio/webm` type override

**`standalone-whisper/index.ts`** (base64 path, batch fallback):
- After receiving the base64 audio, invoke `transcode-audio`
- Remove the entire multi-format trial loop (lines 62-119) -- no longer needed
- Forward single FLAC blob to OpenAI
- Significantly simplifies this function

### 6. Minimum Capture Bitrate Guidance

Current settings are already adequate:

| Platform | Format | Current Bitrate | Minimum for Accuracy |
|----------|--------|-----------------|---------------------|
| Desktop/Android | WebM/Opus | 128 kbps | 48 kbps (32 kbps absolute minimum) |
| iOS | M4A/AAC | iOS default (~64-128 kbps) | 64 kbps |

No code changes needed. Current capture quality is well above minimum thresholds.

### 7. File Size Safety Check

Add a pre-upload size check in the `transcode-audio` function:
- Warn in logs if input exceeds 20 MB
- Reject with 413 if input exceeds 24 MB
- At typical capture bitrates, a 25-second chunk is 150-400 KB -- well under the limit
- This is purely a safety net for edge cases

## Technical Details

### Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/transcode-audio/index.ts` | Server-side ffmpeg transcoding to FLAC 16 kHz mono 16-bit with highpass and loudnorm |

### Files to Modify

| File | Change |
|------|--------|
| `src/utils/audioTranscoder.ts` | Remove WAV encoder, simplify to pass-through, deprecate |
| `src/utils/audioSilenceTrimmer.ts` | Remove duplicate WAV encoder, keep silence detection, return native format |
| `src/config/whisperChunking.ts` | Update `chunkDurationMs` to 25000, `overlapMs` to 2500, `accumulateUntilMs` to 25000 |
| `src/components/MeetingRecorder.tsx` | Remove `transcodeToWhisperFormat()` call, update chunk durations (20s first, 25s subsequent) |
| `supabase/functions/speech-to-text/index.ts` | Add transcode-audio call before OpenAI, add FLAC MIME support, remove WAV default |
| `supabase/functions/speech-to-text-chunked/index.ts` | Add transcode-audio call before OpenAI, add FLAC extension mapping |
| `supabase/functions/process-meeting-audio/index.ts` | Add transcode-audio call, remove forced `.webm` extension and type override |
| `supabase/functions/standalone-whisper/index.ts` | Add transcode-audio call, remove multi-format trial loop entirely |
| `supabase/config.toml` | Register `transcode-audio` function with `verify_jwt = false` (internal use) |

### Size Comparison (25-second speech chunk)

```text
Format              Approx Size   Role
WebM/Opus (48kbps)  ~150 KB       Client upload (desktop/Android)
M4A/AAC (64kbps)    ~200 KB       Client upload (iOS)
WAV 16kHz mono      ~800 KB       ELIMINATED (was only used by MeetingRecorder)
FLAC 16kHz mono     ~300-500 KB   Server intermediate (canonical format for all ASR)
```

The client uploads are already small (150-200 KB). The FLAC intermediate (300-500 KB) is larger than the compressed upload but ensures consistent, lossless-from-the-resample-point input to all ASR engines. The WAV path (800 KB) is eliminated entirely.

### Implementation Order

1. Create `transcode-audio` edge function with ffmpeg.wasm (or identify fallback approach if WASM is too heavy)
2. Test `transcode-audio` with sample WebM and M4A inputs to verify FLAC output quality
3. Register in `supabase/config.toml` and deploy
4. Update `speech-to-text-chunked` to call `transcode-audio` (most frequently used path -- test first)
5. Update remaining edge functions (`speech-to-text`, `process-meeting-audio`, `standalone-whisper`)
6. Remove client-side WAV encoding from `audioTranscoder.ts` and `audioSilenceTrimmer.ts`
7. Remove `transcodeToWhisperFormat()` call from `MeetingRecorder.tsx`
8. Update chunking config (`whisperChunking.ts`)
9. Deploy all edge functions and verify with real recordings on desktop, Android, and iOS

### Risk: ffmpeg.wasm in Supabase Edge Functions

Supabase Edge Functions run on Deno with constrained memory and no native binary access. ffmpeg.wasm may be too large or too slow for the edge function environment.

**Mitigation strategy** (in priority order):

1. **ffmpeg.wasm**: Test first. If it loads within Deno's memory limits and transcodes a 25-second chunk in under 5 seconds, use it
2. **External transcoding worker**: Deploy a lightweight Cloud Run / Fly.io / Lambda service that runs native ffmpeg. The edge function calls it via HTTP, passing the audio blob, and receives FLAC back. Adds ~1-2s network latency but is reliable and well-tested
3. **Client resample + server forwards WAV**: If neither server-side option works, the client continues to resample to 16 kHz mono via `OfflineAudioContext` and uploads as WAV/PCM. The server forwards WAV directly to ASR without FLAC conversion. This is the least preferred option as it keeps larger file sizes and more client CPU usage, but it works

The implementation should start with option 1 and have option 2 ready as an immediate fallback. Option 3 is the "nothing changes" safety net.

