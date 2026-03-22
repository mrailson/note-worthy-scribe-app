

# Plan: Expand Live Preview panel — wider, deeper, 4 lines per engine

## What changes

**Single file**: `src/components/recording-flow/LiveTranscriptGlassPanel.tsx`

### 1. Panel width
- Change `width: 420` → `width: 620` (line 105)

### 2. Panel height / debug mode
- Change debug `maxHeight: 250` → `maxHeight: 480` (line 155)
- Change "All" mode `maxHeight: 120` → `maxHeight: 140`

### 3. Engine sections — allow 4 lines of wrapping text
- In `EngineSection`, remove `whiteSpace: 'nowrap'` from lines (line 274)
- Replace with `-webkit-line-clamp: 4`, `display: -webkit-box`, `-webkit-box-orient: vertical`, `overflow: hidden` — allows up to 4 wrapped lines with ellipsis
- Same for partial text (line 282)

### 4. Deepgram / Whisper text splitting
Currently Deepgram and Whisper each pass a single string as `lines={[text]}`. To show 4 lines of content, split them into ~4 sentence-based segments before passing to `EngineSection`:
- Deepgram: split `deepgramText` by sentence boundaries (`. `) into up to 4 segments
- Whisper: split `whisperChunkText` similarly into up to 4 segments
- This gives each engine distinct line entries that render as separate rows

### 5. Assembly already uses `visibleLines` (up to 4 finals) — no change needed there

