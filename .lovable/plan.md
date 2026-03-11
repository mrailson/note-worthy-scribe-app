

## Show Signature Block Outline on Public Approval Page

**Problem**: When a signatory opens the document to sign, they see the PDF but don't know where their signature will be placed. They may try to sign within the document display instead of scrolling down to the declaration form.

**Solution**: Overlay the signatory's signature block outline (dashed border, semi-transparent) on the correct page of the PDF viewer, with a message directing them to complete the declaration below.

### Changes

**1. Edge Function: `supabase/functions/process-approval/index.ts`** (line ~81-95)

Add `signature_placement` to the document data returned in the `get` action response, so the public page knows where to render the outline.

**2. Public Page: `src/pages/PublicApproval.tsx`**

- **DocumentData interface** (~line 39): Add `signature_placement: any | null` field.
- **InlinePDFViewer component**: Accept new props: `signaturePlacement` (the placement object) and `signatoryId` (current signatory's ID) and `signatoryName`.
- **Page rendering** (~line 242-254): For each rendered page, if the signatory has a stamp position on that page, overlay a dashed-border box at the correct coordinates (using percentage-based positioning from the `StampPosition` data). Inside the box, show the signatory's name and a brief message like "Your signature will appear here -- complete the declaration below."
- The overlay uses `position: relative` on the page wrapper with an `absolute`-positioned div for the outline, styled with a dashed primary-colour border, light background tint, and a downward arrow icon.

### Visual Result

On the PDF page where the signature is positioned, the signatory sees a clearly outlined dashed box with text: "{Name} -- Your signature will appear here. Complete the declaration below to sign." This prevents confusion and directs attention to the form.

