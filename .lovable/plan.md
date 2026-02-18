
## Fix: Shrink backup label to icon-only and reduce file size

### 1. BackupIndicator -- icon only
Remove the "Backup active" text and segment label from `BackupIndicator.tsx`. Keep just the Shield icon inside the badge with a tooltip for context.

### 2. Fix backup file size (the actual bug)
The bitrate fix from earlier was applied to `useAudioBackup.ts`, but MeetingRecorder uses `useBackupRecorder.ts` which creates its own `MediaRecorder` on line 86 **without** the `audioBitsPerSecond` option. This is why backups are still ~10MB for 5 minutes.

Add `audioBitsPerSecond: 16000` to the MediaRecorder options in `useBackupRecorder.ts` line 86.

### Technical details

**File: `src/components/offline/BackupIndicator.tsx`**
- Replace the Badge contents with just the Shield icon (no text)
- Wrap in a Tooltip showing "Backup active" on hover
- Remove `animate-pulse` (distracting) or keep it subtle

**File: `src/hooks/useBackupRecorder.ts`** (line 86)
```typescript
// BEFORE:
const recorder = new MediaRecorder(stream, { mimeType: mimeTypeRef.current });

// AFTER:
const recorder = new MediaRecorder(stream, {
  mimeType: mimeTypeRef.current,
  audioBitsPerSecond: 16000, // 16kbps mono -- ~7MB/hour
});
```

This should bring a 5-minute recording down from ~10MB to roughly 600KB.
