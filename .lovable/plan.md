

## Problem

The PDF preview in `SignaturePositionPicker` and `CreateApprovalFlow` uses a CDN URL for the PDF.js worker, which is being blocked (likely by an ad blocker or CSP). The console shows:

> "Failed to fetch dynamically imported module: https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.296/pdf.worker.min.mjs"

Other components in the project (e.g., `NRESPresentationPage`, `LGPdfThumbnailPreview`, `pdfPageExtractor`) already use the correct bundled worker approach that works reliably.

## Fix

Replace the CDN worker URL with the bundled worker pattern in two files:

### 1. `src/components/document-approval/SignaturePositionPicker.tsx`
Change line 9 from:
```
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
```
To:
```
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();
```

### 2. `src/components/document-approval/CreateApprovalFlow.tsx`
Change the dynamic worker setup (~line 749) from:
```
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
```
To the same bundled pattern used elsewhere in the project.

This is a two-line fix across two files. No database or backend changes needed.

