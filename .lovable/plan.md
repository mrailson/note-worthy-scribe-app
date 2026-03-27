

# Fix: Word Document Upload Failures Not Surfacing Errors to Users

## Problem
When Julia Railson uploaded a Word document in Ask AI, it failed silently. The file processing pipeline has several issues:

1. **Silent failures** — When file processing fails in `InputArea.tsx`, the loading badge disappears but no toast or error message is shown to the user (only `console.error`)
2. **All-or-nothing processing** — `Promise.all` in `useEnhancedFileProcessing.ts` means one failed file kills the entire batch
3. **`.doc` files accepted but rejected** — The file input `accept` attribute includes `.doc`, but the processor immediately throws for `.doc` files with no user-friendly toast
4. **No audit trail** — No server-side logging of upload attempts, so we can't investigate failures after the fact

## Changes

### 1. Add user-facing error toasts in InputArea.tsx
In `handleFileSelect`, show a descriptive toast when file processing fails instead of just `console.error`. Same fix in `FloatingMobileInput.tsx`.

### 2. Switch from Promise.all to Promise.allSettled
In `useEnhancedFileProcessing.ts`, use `Promise.allSettled` so valid files still get processed even if one file fails. Show individual error toasts per failed file.

### 3. Improve .