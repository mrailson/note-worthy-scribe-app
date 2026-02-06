

# Enable Speaker Notes and Voiceover in Presentation Studio

## What's Happening Now

1. **Speaker Notes**: The Gamma edge function always includes speaker notes instructions, regardless of whether the "Include Speaker Notes" toggle is on or off. The toggle exists in the UI but the setting is ignored by the edge function -- notes are always generated. This is actually fine behaviour for when it's ON, but when it's OFF, notes are still generated.

2. **Voiceover**: The "Include Voiceover" toggle exists in the Presentation Studio UI, but the actual voiceover logic is a placeholder (`// This would call the voiceover generation - for now we skip`). The full voiceover pipeline already works in the Ask AI bubble (via `useGammaPowerPointWithVoiceover`), so we just need to wire it into the Presentation Studio.

## What Will Change

### 1. Speaker Notes toggle works properly
- When ON (default): Speaker notes are generated in the hidden notes pane (already working)
- When OFF: The edge function will skip the speaker notes instruction, producing clean slides without notes

### 2. Voiceover pipeline connected in Presentation Studio
When the voiceover toggle is ON, after the Gamma presentation is generated:
1. Generate narration scripts from the slide content using Claude (via `generate-presentation-scripts`)
2. Generate audio for each slide using ElevenLabs (via `generate-slide-narration`)
3. Build a new PPTX with embedded audio clips and speaker notes (via `generate-pptx-with-audio`)
4. Download the final file with voiceover

## Technical Details

### File 1: `supabase/functions/generate-powerpoint-gamma/index.ts`
- Extract `includeSpeakerNotes` from the request body (defaults to `true` for backwards compatibility)
- Wrap the speaker notes instruction block in a conditional -- only include it when `includeSpeakerNotes` is true

### File 2: `src/hooks/usePresentationStudio.ts`
Replace the placeholder voiceover block (lines 372-377) with the real pipeline:

1. **Phase: generating-audio (75%)** -- Call `generate-presentation-scripts` with the topic, supporting content, and slide count to get narration scripts from Claude
2. **Phase: generating-audio (75-85%)** -- Loop through each script and call `generate-slide-narration` to produce ElevenLabs audio, using the user's selected `voiceId`
3. **Phase: packaging (90%)** -- Call `generate-pptx-with-audio` with the slides and embedded audio to produce the final PPTX with both speaker notes and audio clips
4. Download the resulting PPTX (base64) and update the result with `hasVoiceover: true`

The existing edge functions (`generate-presentation-scripts`, `generate-slide-narration`, `generate-pptx-with-audio`) are fully functional and already deployed -- no changes needed to those.

### File 3: `src/hooks/useGammaPowerPoint.ts`
- Pass `includeSpeakerNotes: true` in the request body to the Gamma edge function, ensuring Ask AI bubble presentations always get notes (matching current behaviour explicitly)

### Summary of Changes
- `supabase/functions/generate-powerpoint-gamma/index.ts` -- conditional speaker notes
- `src/hooks/usePresentationStudio.ts` -- wire up voiceover pipeline
- `src/hooks/useGammaPowerPoint.ts` -- explicitly pass speaker notes flag

