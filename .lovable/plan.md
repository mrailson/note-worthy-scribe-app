

## Add Custom Text Box Placement

Add a "Text" placeable element alongside the existing Block and Separated signature fields. Users can add one or more free-text annotations (short labels, notes, etc.) and position them on the PDF just like signature fields.

### Changes

#### 1. Extend Types (`generateSignedPdf.ts`)
- Add `TextAnnotation` type: `{ text: string; page: number; x: number; y: number; fontSize?: number }`
- Add `textAnnotations?: TextAnnotation[]` to `SignaturePlacement`
- Add `drawTextAnnotations` function that renders each text annotation on the PDF using Helvetica at the configured font size

#### 2. Update `SignaturePositionPicker.tsx`
- Add a "Custom Text" section below the Block/Separated controls (always visible regardless of mode)
- UI: A text input + "Add" button to create a new text annotation
- Each added text appears as a draggable tag on the PDF (similar to separated field tags), with a delete button in the sidebar list
- Text tags use a distinct colour (e.g. grey/neutral) to differentiate from signatory fields
- Text annotations share the same click-to-place and drag behaviour as existing fields
- Font size for text annotations uses the same `separatedFontSize` slider value

#### 3. Update `CreateApprovalFlow.tsx`
- Add `textAnnotations` state (`TextAnnotation[]`)
- Pass to `SignaturePositionPicker` and include in the `signature_placement` JSON saved to the database

#### 4. Update `PublicApproval.tsx`
- Render ghost indicators for any text annotations (so signatories can see the text on the approval page)

#### 5. PDF Generation (`generateSignedPdf.ts`)
- `drawTextAnnotations`: iterate over `textAnnotations`, draw each text string at its position using Helvetica at the specified font size — no box or border, just clean text

### Files to Modify
| File | Change |
|------|--------|
| `src/utils/generateSignedPdf.ts` | Add `TextAnnotation` type, `drawTextAnnotations` function |
| `src/components/document-approval/SignaturePositionPicker.tsx` | Add text input + placeable text tags |
| `src/components/document-approval/CreateApprovalFlow.tsx` | Add `textAnnotations` state, pass through and save |
| `src/pages/PublicApproval.tsx` | Render text annotation ghost indicators |

