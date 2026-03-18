

## Separated Signature Field Placement

### Summary

Add a second placement mode ("Separated") alongside the existing "Block" (stamp) mode. In Separated mode, each signatory gets **5 independently draggable elements** on the PDF: Signature (cursive), Name, Role, Organisation, and Date. Font size is configurable. Block mode remains unchanged.

### Changes Required

#### 1. Update Types (`generateSignedPdf.ts`)

Extend `SignatoryPosition` and `SignaturePlacement` to support field-level positions:

```ts
interface FieldPosition { page: number; x: number; y: number; }

interface SignaturePlacement {
  method: 'append' | 'stamp' | 'separated';
  // ... existing fields ...
  fieldPositions?: Record<string, {  // keyed by signatory ID
    signature?: FieldPosition;
    name?: FieldPosition;
    role?: FieldPosition;
    organisation?: FieldPosition;
    date?: FieldPosition;
  }>;
  separatedFontSize?: number; // default 14
}
```

#### 2. Update `SignaturePositionPicker.tsx`

- Add a toggle at the top: **Block | Separated** mode selector
- In **Separated** mode, each signatory shows 5 sub-items (Signature, Name, Role, Organisation, Date) as individually placeable/draggable elements on the PDF
- Each field rendered as a small labelled tag (colour-coded per signatory) with the field type shown
- Add a font size slider (8–24pt, default 14)
- Block mode works exactly as today

#### 3. Update `drawStampSignatures` in `generateSignedPdf.ts`

- Add a new `drawSeparatedSignatures` function that reads `fieldPositions` and draws each field independently at its position using the configured font size
- Signature field uses the cursive `DancingScript` font
- Name/Role/Organisation/Date use Helvetica at the configured size
- No background box or border around individual fields (clean placement)

#### 4. Update `CreateApprovalFlow.tsx`

- Pass the new placement method and field positions through to the approval document record
- Store `fieldPositions` and `separatedFontSize` in the `signature_placement` JSON column

#### 5. Update `PublicApproval.tsx` ghost indicators

- When method is `separated`, show individual ghost markers for each field position instead of the single combined block

### Data Flow

- `signature_placement` column already stores JSON — just extend the shape
- No schema migration needed
- Backwards compatible: existing documents with `method: 'stamp'` continue working unchanged

### Files to Modify

| File | Change |
|------|--------|
| `src/utils/generateSignedPdf.ts` | Add `drawSeparatedSignatures`, extend types |
| `src/components/document-approval/SignaturePositionPicker.tsx` | Add mode toggle, per-field placement, font size slider |
| `src/components/document-approval/CreateApprovalFlow.tsx` | Pass new placement data |
| `src/pages/PublicApproval.tsx` | Render per-field ghost indicators |

