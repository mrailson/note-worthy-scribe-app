# Evidence Viewer Modal — inline preview for SDA Claims

## Goal

Replace the current "open signed URL in a new browser tab" behaviour on every "View" button in claim evidence with a single in-app modal viewer that:

- Opens centred over the claim, blocks the background.
- Shows the current file (image / PDF / Word / Excel) inline, no download required.
- Has Previous / Next buttons (and ←/→ keyboard shortcuts) to flip through every uploaded file for that claim/staff line, in upload order.
- Shows file name, type, size, position (e.g. "3 of 4") and a small thumbnail strip at the bottom for direct jump.
- Has a Download button as a fallback (so the existing capability is not lost).
- Closes on ESC, backdrop click, or X.

This replaces the current behaviour where every "View" button calls `getDownloadUrl(...)` and opens a new tab — which is what makes flicking through 4 supporting files feel clunky for the Verifier and SNO Approver.

## Format support

| Type | Detected by | Render |
|------|-------------|--------|
| Images (png/jpg/jpeg/gif/webp/svg/bmp) | extension or `file_type` starting with `image/` | `<img>` fitted to viewport, contain |
| PDF | `.pdf` or `application/pdf` | `<iframe>` of the signed URL — browser-native PDF viewer |
| Word (.docx/.doc) | extension | Render via Microsoft Office Online viewer iframe: `https://view.officeapps.live.com/op/embed.aspx?src=<encoded signed url>` (works for any publicly reachable URL — Supabase signed URLs qualify for the 1-hour lifetime) |
| Excel (.xlsx/.xls/.csv) | extension | Same Office Online embed |
| PowerPoint (.pptx/.ppt) | extension | Same Office Online embed (free bonus) |
| Anything else | fallback | "Preview not available — Download" CTA inside the modal |

The Office Online embed is a no-install, public Microsoft service that already works with any HTTPS URL, including Supabase signed URLs. No new dependencies, no edge function, no parsing.

## New component

`src/components/nres/hours-tracker/EvidenceViewerModal.tsx`

Props:

```ts
{
  open: boolean;
  files: ClaimEvidenceFile[];        // ordered list to flick through
  initialIndex: number;               // which file to show first
  getDownloadUrl: (path: string) => Promise<string | null>;
  onClose: () => void;
}
```

Internally:

- Keeps `index` state, syncs to `initialIndex` whenever `open` flips true.
- For the current file, calls `getDownloadUrl(file.file_path)` once, caches the signed URL in a `Map<fileId, url>` so prev/next is instant on revisit.
- Pre-fetches the URL for `index+1` and `index-1` in the background for snappy paging.
- Renders the right viewer based on the extension table above.
- Header: file name, "N of M", type pill, Download button, X.
- Footer: "← Previous" and "Next →" buttons, disabled at the ends; thumbnail strip listing each file name with active highlight; clicking a thumbnail jumps to it.
- Keyboard: ArrowLeft / ArrowRight / Escape.
- Sized: `max-w-6xl w-[92vw] h-[88vh]`, content area uses flex so the viewer fills the remaining space.

Built using existing shadcn `Dialog` for consistency with the rest of the app.

## Wiring — every existing "View" button

The single source of truth for "View" buttons is `src/components/nres/hours-tracker/ClaimEvidencePanel.tsx`. Two call sites:

1. `EvidenceSlot` (used by `ClaimEvidencePanel` and by `StaffLineEvidence`'s read-only branch) — line ~168.
2. `StaffLineEvidence` inline `other_supporting` editor branch — line ~322.

Refactor:

- `ClaimEvidencePanel` and `StaffLineEvidence` each own one `EvidenceViewerModal` instance.
- They build the ordered `files` list from the same data they already have (`filesByType`, `allFilesForStaff`).
- They pass an `onView(file)` callback into `EvidenceSlot` that opens the modal at the right index instead of calling `handleDownload`.
- `EvidenceSlot` keeps a `Download` icon-only fallback button next to "View" so power users can still grab a file directly.
- Every consumer (Practice Dashboard, Verifier Dashboard, PML Dashboard, Claims Tab) gets the new viewer for free — no edits needed in those files because they all render through `StaffLineEvidence` / `ClaimEvidencePanel`.

## Files touched

```text
NEW  src/components/nres/hours-tracker/EvidenceViewerModal.tsx
EDIT src/components/nres/hours-tracker/ClaimEvidencePanel.tsx
       - add modal state in ClaimEvidencePanel
       - add modal state in StaffLineEvidence
       - replace window.open(url) handlers with setViewerIndex(...)
       - render <EvidenceViewerModal> at the bottom of each component
       - keep Download button as secondary action
```

No DB changes, no edge functions, no new dependencies.

## Out of scope

- Annotating / commenting on evidence inside the viewer.
- Side-by-side comparison of two files.
- Print or rotate controls (browser PDF viewer already provides these for PDFs).
- Server-side conversion of legacy `.doc`/`.xls` (Office Online embed handles them; if it ever fails for a specific file, the Download fallback covers it).

## Risks and mitigations

- **Office Online requires the URL to be publicly reachable.** Supabase signed URLs are public-by-token for the 1-hour lifetime, so this works. If a session hits the modal after 1 hour without paging, we re-issue the signed URL on demand (already handled by always going through `getDownloadUrl`).
- **CORS / iframe sandboxing.** PDFs and images load from Supabase storage — already proven to work today via the "View" → new tab path. Iframes for PDFs use the signed URL directly. Office Online loads inside its own iframe and fetches the URL server-side, so no client CORS issue.
- **Mobile.** Modal collapses to full-screen on small viewports; thumbnail strip becomes horizontally scrollable. Download fallback always visible.
