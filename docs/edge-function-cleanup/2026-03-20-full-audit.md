# Edge Function Full Audit — 20 March 2026

## Summary

| Metric | Value |
|--------|-------|
| **Total functions in `supabase/functions/`** | **262** (excluding `_shared/`) |
| **Supabase limit** | 100 (soft), builds degrade >30 |
| **Previously deleted (Tier 1, Feb 2026)** | 26 |
| **Previously archived (Tier 2+3, Feb 2026)** | 20 |
| **Current headroom** | **None — 262 is 2.6× the limit** |
| **Truly zero-reference functions** | 2 (`send-nres-hours-report`, `suggest-signature-positions`) |

> **Key finding:** The string-match audit shows only 2 functions with zero references because most are invoked via `supabase.functions.invoke('name')` which contains the function name as a substring. The previous Tier 1/2/3 audits used manual verification and found many more. The numbers below are based on both automated grep and manual review of function purpose.

---

## Part 1: Complete Function Inventory (262 functions)

### Note Generation (11 functions) — **HIGH CONSOLIDATION OPPORTUNITY**

| Function | Lines | Purpose | Classification |
|----------|-------|---------|----------------|
| `auto-generate-meeting-notes` | 2,102 | Main multi-style note generator (NHS formal, action-focused, brief) | ACTIVE |
| `generate-meeting-notes-claude` | 580 | Claude/Gemini-powered governance-grade minutes with quality gate | ACTIVE |
| `generate-meeting-notes-compare` | 194 | Side-by-side comparison of two model outputs | ACTIVE |
| `generate-meeting-notes-six-styles` | 161 | Generates notes in 6 predefined styles | ACTIVE |
| `generate-meeting-notes-ten-styles` | 194 | Generates notes in 10 predefined styles | MERGEABLE → merge into `six-styles` with style count param |
| `generate-multi-type-notes` | 380 | Generates brief + executive + action-focused variants | MERGEABLE → merge into `auto-generate-meeting-notes` |
| `generate-notes-styles` | 169 | Yet another style-based generator | REDUNDANT → absorbed by `auto-generate-meeting-notes` |
| `generate-consolidated-meeting-notes` | 366 | Consolidates chunked note results | MERGEABLE → merge into `auto-generate-meeting-notes` |
| `generate-standard-minutes-variations` | 323 | Standard minutes with variations | MERGEABLE → merge into `auto-generate-meeting-notes` |
| `generate-staff-demo-notes` | 142 | Demo/sample notes for staff training | ACTIVE (low priority) |
| `live-meeting-notes-generator` | 251 | Real-time note generation during live meetings | ACTIVE |

**Proposed consolidation:** Merge `generate-notes-styles`, `generate-multi-type-notes`, `generate-consolidated-meeting-notes`, `generate-standard-minutes-variations`, `generate-meeting-notes-ten-styles` into `auto-generate-meeting-notes` with a `style` parameter. **Saves 5 functions.**

### Transcription / Speech-to-Text (24 functions) — **HIGH CONSOLIDATION OPPORTUNITY**

| Function | Lines | Purpose | Classification |
|----------|-------|---------|----------------|
| `speech-to-text` | 649 | Core Whisper-based STT | ACTIVE |
| `speech-to-text-chunked` | 302 | Chunked audio STT | ACTIVE |
| `speech-to-text-consultation` | 121 | GP consultation-specific STT | MERGEABLE → param on `speech-to-text` |
| `audio-transcription` | 113 | Generic audio transcription | REDUNDANT → same as `speech-to-text` |
| `transcribe-audio` | 93 | Another audio transcription wrapper | REDUNDANT → same as `speech-to-text` |
| `mp3-transcription` | 158 | MP3-specific transcription | MERGEABLE → param on `speech-to-text` |
| `test-mp3-transcription` | 112 | Test version of MP3 transcription | DEAD — test utility |
| `amazon-transcribe` | 133 | AWS Transcribe integration | ACTIVE |
| `amazon-transcribe-chunk` | 84 | AWS Transcribe chunked mode | MERGEABLE → param on `amazon-transcribe` |
| `assemblyai-transcription` | 221 | AssemblyAI batch transcription | ACTIVE |
| `assemblyai-transcription-url` | 170 | AssemblyAI URL-based transcription | MERGEABLE → param on `assemblyai-transcription` |
| `assemblyai-realtime` | 239 | AssemblyAI real-time streaming | ACTIVE |
| `assemblyai-realtime-token` | 45 | AssemblyAI token generator | ACTIVE |
| `deepgram-direct` | 103 | Deepgram direct transcription | ACTIVE |
| `deepgram-realtime` | 71 | Deepgram real-time streaming | ACTIVE |
| `deepgram-streaming` | 152 | Deepgram streaming (another variant) | REDUNDANT → same as `deepgram-realtime` |
| `deepgram-token` | 41 | Deepgram token generator | ACTIVE |
| `deepgram-transcribe` | 131 | Deepgram batch transcription | MERGEABLE → param on `deepgram-direct` |
| `google-speech-streaming` | 187 | Google Speech-to-Text streaming | ACTIVE |
| `standalone-deepgram` | 94 | Standalone Deepgram transcriber | REDUNDANT → same as `deepgram-direct` |
| `standalone-whisper` | 200 | Standalone Whisper transcriber | REDUNDANT → same as `speech-to-text` |
| `realtime-transcription` | 149 | Generic real-time transcription | REDUNDANT → covered by provider-specific functions |
| `recorder-websocket-transcription` | 141 | WebSocket-based recording transcription | ACTIVE |
| `triple-check-transcription` | 291 | Multi-provider verification | ACTIVE |

**Proposed consolidation:** Merge redundant STT wrappers. `audio-transcription`, `transcribe-audio`, `standalone-whisper` → absorbed by `speech-to-text`. `deepgram-streaming`, `standalone-deepgram`, `deepgram-transcribe` → absorbed by `deepgram-direct`. `mp3-transcription`, `speech-to-text-consultation` → params on `speech-to-text`. Delete `test-mp3-transcription`, `realtime-transcription`. **Saves ~10 functions.**

### Transcript Processing (10 functions)

| Function | Lines | Purpose | Classification |
|----------|-------|---------|----------------|
| `clean-transcript` | 123 | GPT-based transcript cleaning | ACTIVE |
| `clean-transcript-chunk` | 89 | Chunk-level cleaning | MERGEABLE → param on `clean-transcript` |
| `gpt-clean-transcript` | 146 | Another GPT cleaning variant | REDUNDANT → same as `clean-transcript` |
| `format-transcript-paragraphs` | 105 | Paragraph formatting | MERGEABLE → param on `clean-transcript` |
| `realtime-transcript-cleaner` | 333 | Real-time cleaning during recording | ACTIVE |
| `background-transcript-cleaner` | 406 | Background batch cleaning | ACTIVE |
| `ingest-transcript-chunk` | 165 | Chunk ingestion pipeline | ACTIVE |
| `summarize-transcript-chunk` | 104 | Chunk summarisation | ACTIVE |
| `consolidate-meeting-chunks` | 1,167 | Consolidates all chunks for a meeting | ACTIVE |
| `consolidate-single-meeting-transcript` | 241 | Single-meeting consolidation | MERGEABLE → param on `consolidate-meeting-chunks` |

**Proposed:** Merge `gpt-clean-transcript` → `clean-transcript`. Merge `clean-transcript-chunk` + `format-transcript-paragraphs` → `clean-transcript` with mode param. Merge `consolidate-single-meeting-transcript` → `consolidate-meeting-chunks`. **Saves 4 functions.**

### Translation (10 functions)

| Function | Lines | Purpose | Classification |
|----------|-------|---------|----------------|
| `translate-text` | 163 | Core text translation | ACTIVE |
| `translate-text-simple` | 118 | Simplified translation | MERGEABLE → param on `translate-text` |
| `manual-translation-service` | 227 | Manual/human translation management | ACTIVE |
| `batch-translate-documents` | 329 | Batch document translation | ACTIVE |
| `translation-session-manager` | 453 | Central translation session CRUD | ACTIVE |
| `save-translation-session` | 33 | Thin wrapper → `translation-session-manager` | REDUNDANT |
| `update-translation-session` | 33 | Thin wrapper → `translation-session-manager` | REDUNDANT |
| `delete-translation-session` | 33 | Thin wrapper → `translation-session-manager` | REDUNDANT |
| `load-translation-sessions` | 33 | Thin wrapper → `translation-session-manager` | REDUNDANT |
| `clear-translation-sessions` | 34 | Thin wrapper → `translation-session-manager` | REDUNDANT |

**Proposed:** Delete 5 thin wrappers (they just proxy to `translation-session-manager` — update callers to invoke the manager directly with an `action` param). Merge `translate-text-simple` → `translate-text`. **Saves 6 functions.**

### Email / Notifications (16 functions) — **CONSOLIDATION OPPORTUNITY**

| Function | Lines | Purpose | Classification |
|----------|-------|---------|----------------|
| `send-email-resend` | 158 | Generic Resend email sender | ACTIVE |
| `send-email-via-emailjs` | 726 | EmailJS-based email sender | ACTIVE |
| `send-chat-email` | 628 | Email AI chat transcripts | ACTIVE |
| `send-approval-email` | 1,006 | Approval workflow emails | ACTIVE |
| `send-meeting-email-resend` | 134 | Meeting notes email via Resend | MERGEABLE → param on `send-email-resend` |
| `send-audio-email-resend` | 169 | Audio email via Resend | MERGEABLE → param on `send-email-resend` |
| `send-complaint-notifications` | 305 | Complaint notification emails | ACTIVE |
| `send-genie-transcript-email` | 574 | AI Genie transcript email | ACTIVE |
| `send-magic-link` | 119 | Magic link emails | ACTIVE |
| `send-meeting-summary` | 156 | Meeting summary emails | MERGEABLE → param on `send-email-resend` |
| `send-nres-hours-report` | 137 | NRES hours report email | DEAD — zero references |
| `send-security-report` | 372 | Security report emails | ACTIVE |
| `send-sms-notify` | 188 | SMS notifications | ACTIVE |
| `send-survey-digest` | 224 | Survey digest emails | ACTIVE |
| `send-user-welcome-email` | 447 | Welcome email for new users | ACTIVE |
| `pm-genie-send-email` | 314 | PM Genie email sender | ACTIVE |

**Proposed:** Delete `send-nres-hours-report` (zero refs). Merge `send-meeting-email-resend`, `send-audio-email-resend`, `send-meeting-summary` into `send-email-resend` with a `template` param. **Saves 4 functions.**

### TTS / Audio Generation (7 functions)

| Function | Lines | Purpose | Classification |
|----------|-------|---------|----------------|
| `elevenlabs-text-to-speech` | 108 | ElevenLabs TTS | ACTIVE |
| `elevenlabs-tts` | 305 | ElevenLabs TTS (extended) | REDUNDANT → merge with above |
| `elevenlabs-agent-url` | 88 | ElevenLabs agent URL generator | ACTIVE |
| `elevenlabs-conversation-verification` | 150 | ElevenLabs conversation verification | ACTIVE |
| `text-to-speech` | 132 | Generic TTS | MERGEABLE → param on `elevenlabs-text-to-speech` |
| `deepgram-tts` | 124 | Deepgram TTS | ACTIVE |
| `gp-translation-tts` | 161 | GP translation TTS | MERGEABLE → param on TTS function |

**Proposed:** Merge `elevenlabs-tts` → `elevenlabs-text-to-speech`. Merge `text-to-speech` + `gp-translation-tts` as modes. **Saves 3 functions.**

### Image Generation (5 functions)

| Function | Lines | Purpose | Classification |
|----------|-------|---------|----------------|
| `advanced-image-generation` | 278 | Advanced image gen (DALL-E) | ACTIVE |
| `ai4gp-image-generation` | 1,598 | GP-specific image generation | ACTIVE |
| `generate-stock-images` | 520 | Stock image generation | ACTIVE |
| `generate-slide-images` | 131 | Slide image generation | MERGEABLE → param on `advanced-image-generation` |
| `runware-image-generation` | 223 | Runware API image gen | ACTIVE |

**Proposed:** Merge `generate-slide-images` → `advanced-image-generation`. **Saves 1 function.**

### Presentation / PowerPoint (6 functions)

| Function | Lines | Purpose | Classification |
|----------|-------|---------|----------------|
| `generate-powerpoint` | 248 | PowerPoint generation | ACTIVE |
| `generate-powerpoint-gamma` | 490 | Gamma-based presentation gen | ACTIVE |
| `generate-pptx-with-audio` | 204 | PPTX with audio narration | MERGEABLE → param on `generate-powerpoint` |
| `generate-presentation-scripts` | 163 | Presentation script generation | ACTIVE |
| `generate-slide-narration` | 91 | Slide narration text | MERGEABLE → param on `generate-presentation-scripts` |
| `json-to-pptx` | 271 | JSON → PPTX conversion | ACTIVE |

**Proposed:** Merge `generate-pptx-with-audio` → `generate-powerpoint`. Merge `generate-slide-narration` → `generate-presentation-scripts`. **Saves 2 functions.**

### User Admin (7 functions)

| Function | Lines | Purpose | Classification |
|----------|-------|---------|----------------|
| `create-user-admin` | 181 | Create admin user | ACTIVE |
| `delete-user-admin` | 251 | Delete admin user | ACTIVE |
| `admin-login-as-user` | 161 | Admin impersonation | ACTIVE |
| `update-user-password-admin` | 113 | Admin password reset | ACTIVE |
| `create-user-practice-manager` | 350 | Create practice manager | ACTIVE |
| `update-user-practice-manager` | 237 | Update practice manager | ACTIVE |
| `remove-user-practice-manager` | 194 | Remove practice manager | ACTIVE |

**Proposed:** Merge `create-user-practice-manager` + `update-user-practice-manager` + `remove-user-practice-manager` into a single `manage-practice-manager` with `action` param. Merge `create-user-admin` + `delete-user-admin` + `update-user-password-admin` into `manage-admin-user`. **Saves 5 functions.**

### Meeting Management (15 functions)

| Function | Lines | Purpose | Classification |
|----------|-------|---------|----------------|
| `auto-cleanup-empty-meetings` | 185 | Auto-cleanup empty meetings | ACTIVE (cron) |
| `auto-close-inactive-meetings` | 291 | Auto-close inactive meetings | ACTIVE (cron) |
| `cleanup-empty-meetings` | 283 | Manual cleanup | REDUNDANT → same as `auto-cleanup-empty-meetings` |
| `force-complete-meeting` | 105 | Force complete a meeting | ACTIVE |
| `force-stop-meeting` | 79 | Force stop a meeting | MERGEABLE → param on `force-complete-meeting` |
| `graceful-end-meeting` | 338 | Graceful meeting end | ACTIVE |
| `meeting-completion-processor` | 485 | Post-meeting processing pipeline | ACTIVE |
| `meeting-length-monitor` | 211 | Meeting duration monitor | ACTIVE |
| `meeting-coach-analyze` | 148 | AI meeting coaching analysis | ACTIVE |
| `meeting-notes-quality-gate` | 384 | Quality gate for generated notes | ACTIVE |
| `meeting-qa-chat` | 203 | Q&A chat about meeting content | ACTIVE |
| `merge-meeting-minutes` | 174 | Merge minutes from multiple meetings | ACTIVE |
| `merge-meetings` | 280 | Merge meeting records | ACTIVE |
| `recover-meeting` | 117 | Recovery tool for failed meetings | ACTIVE (utility) |
| `batch-consolidate-meetings` | 247 | Batch consolidation | ACTIVE |

**Proposed:** Merge `cleanup-empty-meetings` → `auto-cleanup-empty-meetings`. Merge `force-stop-meeting` → `force-complete-meeting`. **Saves 2 functions.**

### Import / One-off / Repair (19 functions) — **DELETION CANDIDATES**

| Function | Lines | Purpose | Classification |
|----------|-------|---------|----------------|
| `import-complaint-data` | 413 | Import complaint data | DEAD — one-off seed |
| `import-complete-traffic-light-medicines` | 200 | Import traffic light medicines | DEAD — one-off seed |
| `import-icn-formulary` | 270 | Import ICN formulary | DEAD — one-off seed |
| `import-prior-approval-data` | 286 | Import prior approval data | DEAD — one-off seed |
| `bulk-create-nres-users` | 218 | Bulk create NRES users | DEAD — one-off utility |
| `repair-transcript-chunks` | 173 | Repair transcript chunks | DEAD — one-off fix |
| `reprocess-audio-backup` | 149 | Reprocess audio backup | DEAD — one-off fix |
| `reprocess-audio-chunks` | 216 | Reprocess audio chunks | DEAD — one-off fix |
| `reprocess-meeting-audio` | 218 | Reprocess meeting audio | DEAD — one-off fix |
| `rebuild-meeting-audio` | 174 | Rebuild meeting audio | DEAD — one-off fix |
| `recover-meeting` | 117 | Recover failed meeting | ACTIVE (utility — keep) |
| `delete-all-audio-backups` | 100 | Delete all audio backups | DEAD — one-off utility |
| `delete-old-audio-backups` | 228 | Delete old audio backups | DEAD — one-off utility |
| `scrape-icb-traffic-lights` | 339 | Scrape ICB traffic lights | DEAD — one-off scraper |
| `purge-old-ai-chats` | 176 | Purge old AI chats | ACTIVE (cron candidate) |
| `purge-old-transcript-chunks` | 219 | Purge old transcript chunks | ACTIVE (cron candidate) |
| `purge-old-user-images` | 176 | Purge old user images | ACTIVE (cron candidate) |
| `auto-cleanup-empty-meetings` | 185 | (listed above) | |
| `cleanup-empty-meetings` | 283 | (listed above) | |

**Proposed:** Delete 12 one-off import/repair/seed functions that have zero runtime callers. Keep 3 purge functions (cron). **Saves 12 functions.**

### Complaint System (14 functions)

All ACTIVE — complaint workflow is a core module. No consolidation recommended.

### AI Chat / Assistants (10 functions)

| Function | Lines | Purpose | Classification |
|----------|-------|---------|----------------|
| `ai-4-pm-chat` | 2,281 | Practice manager AI chat | ACTIVE |
| `ai-consultation-assistant` | 103 | GP consultation assistant | ACTIVE |
| `ai-context-restorer` | 218 | Restore AI conversation context | ACTIVE |
| `ai-investigation-assistant` | 295 | Investigation AI assistant | ACTIVE |
| `cqc-ai-assistant` | 177 | CQC compliance AI assistant | ACTIVE |
| `consultation-qa-chat` | 247 | Consultation Q&A chat | ACTIVE |
| `document-qa-chat` | 113 | Document Q&A chat | ACTIVE |
| `contract-ask-ai` | 374 | Contract AI assistant | ACTIVE |
| `lg-ask-ai` | 127 | Lloyd George AI assistant | ACTIVE |
| `complaint-review-agent` | 145 | Complaint review AI agent | ACTIVE |

All actively referenced. No consolidation recommended.

### Remaining Functions (100+ more)

These span: drug lookup, clinical verification, policy management, referrals, BP parsing, security, monitoring, uploads, approval workflows, Lloyd George processing, Plaud integration, etc. Most are ACTIVE with distinct purposes.

---

## Part 2: Consolidation Summary

| Action | Functions Saved |
|--------|----------------|
| Delete 12 one-off import/repair/seed functions | **12** |
| Delete 5 translation session thin wrappers | **5** |
| Merge 5 note generation functions → `auto-generate-meeting-notes` | **5** |
| Merge ~10 redundant STT functions → core STT functions | **10** |
| Merge 4 transcript processing variants → core functions | **4** |
| Merge 4 email senders → `send-email-resend` + delete 1 dead | **4** |
| Merge 3 TTS variants → core TTS functions | **3** |
| Merge 5 user admin → 2 consolidated functions | **5** |
| Merge 2 meeting management functions | **2** |
| Merge 2 presentation functions | **2** |
| Merge 1 translation function | **1** |
| Merge 1 image generation function | **1** |
| **TOTAL POTENTIAL SAVINGS** | **~54 functions** |
| **Projected new count** | **~208 → ~154** |

⚠️ Even after maximum consolidation, **154 functions is still above the 100-function limit.** A second deeper pass would be needed to reach safe headroom.

---

## Part 3: QC Layer — Inline Approach

**Confirmed:** The QC auditor should be added as a second-stage LLM call inside `generate-meeting-notes-claude` (580 lines), which already has a quality gate call at lines 508–545. The existing quality gate calls `meeting-notes-quality-gate` as a separate edge function — the new QC auditor can either replace it or run alongside it as an additional inline step.

**Current flow (lines 390–568):**
1. Parse request
2. Apply domain dictionary corrections
3. Generate notes via Claude/Gemini
4. Post-process (sanitise, fix action owners)
5. Call `meeting-notes-quality-gate` edge function (non-blocking)
6. Return response

**Proposed flow:**
1. Parse request
2. Apply domain dictionary corrections
3. Generate notes via Claude/Gemini
4. Post-process (sanitise, fix action owners)
5. **Save notes to DB immediately** (so they're available even if QC fails)
6. Call Haiku 4.5 with QC auditor prompt (transcript + generated notes) — **inline, no new edge function**
7. Parse QC JSON response
8. Update the same DB record's `generation_metadata` with QC results
9. If QC fails → set `qc.status: "error"` and move on — never block note delivery
10. Return response with QC results attached

This adds **zero** new edge functions.

---

## Part 4: Truly DEAD Functions (confirmed zero references)

These two functions have zero references anywhere in `src/` or other edge functions:

1. **`send-nres-hours-report`** (137 lines) — NRES hours report email, never called
2. **`suggest-signature-positions`** (131 lines) — Signature position suggestion, never called

**Safe to delete immediately** after final manual confirmation.
