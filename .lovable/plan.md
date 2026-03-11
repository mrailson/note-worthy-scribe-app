

## Auto-Generate Signed PDF for Completed Documents

**Problem**: When all signatories have approved, the document preview still shows the unsigned original. Users must manually click "Download Signed PDF" and refresh to see signatures in the preview.

**Solution**: Add an auto-generation effect in `ApprovalDocumentDetail` that triggers `handleGenerateSignedPdf` automatically when a completed document is opened without a `signed_file_url`. After generation, update local state so the preview immediately shows the signed version — no refresh needed.

### Changes

**File: `src/components/document-approval/ApprovalDocumentDetail.tsx`**

1. **Add `localSignedUrl` state** to track the signed file URL locally (initialized from `signedFileUrl` prop), so the preview updates without a page refresh.

2. **Add auto-generation `useEffect`**: When `isCompleted && !localSignedUrl && !loading && signatories.length > 0`, automatically run the signed PDF generation logic. After upload, set `localSignedUrl` to the new URL.

3. **Update the preview line** (line 693): Change `signedFileUrl || doc.file_url` → `localSignedUrl || doc.file_url`.

4. **Update `handleGenerateSignedPdf`**: After successful generation and upload, also call `setLocalSignedUrl(publicUrl)` so the preview refreshes inline.

5. **Show a subtle loading indicator** in the document preview card while auto-generation is in progress (reuse existing `generating` state).

