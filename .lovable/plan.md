

# Windows Explorer-Style Document Vault

## Overview
Transform the Document Vault from its current table-based layout into a Windows File Explorer-style interface with icon grid view, right-click context menus, clipboard operations (copy/paste), and familiar visual styling.

## Visual Changes

### 1. Grid Icon View (Windows Explorer style)
- Replace the current table layout with a grid of large folder/file icons
- Each item shows: icon (folder yellow / file type icon), name underneath, truncated with tooltip
- Items are selectable (click to select with blue highlight, Ctrl+click for multi-select)
- Double-click folders to open, double-click files to download
- Selected items get a blue highlight border like Windows

### 2. Right-Click Context Menu
- **Right-click on empty space**: New Folder, Paste, Upload Files, Refresh
- **Right-click on a folder**: Open, Copy, Cut, Rename, Delete, Manage Access
- **Right-click on a file**: Open/Download, Copy, Cut, Rename, Delete, Manage Access
- Uses the existing Radix `ContextMenu` component already installed in the project

### 3. Clipboard Operations (Copy/Cut/Paste)
- Internal clipboard state (not system clipboard) storing selected item references
- Copy: stores item IDs + type in state
- Cut: same as copy but marks items for move
- Paste: duplicates (copy) or moves (cut) items into the current folder via Supabase mutations
- Visual feedback: cut items shown with reduced opacity until pasted

### 4. Address/Navigation Bar
- Keep existing breadcrumbs but style them more like an Explorer address bar
- Back button for navigation history

### 5. Toolbar Updates
- Move "New Folder" and "Upload" out of the toolbar buttons -- they become primarily right-click actions
- Keep search bar in the toolbar
- Add a simple status bar at the bottom showing item count: "X items" or "X items selected"

## Files to Change

### Modified Files
1. **`src/components/nres/vault/VaultContentView.tsx`** -- Complete rewrite:
   - Grid layout with icon tiles instead of table rows
   - Selection state (single + multi-select with Ctrl)
   - Right-click context menus (on items and on empty space)
   - Double-click to open/download
   - Cut items shown with reduced opacity
   - Status bar with item/selection count

2. **`src/components/nres/vault/NRESDocumentVault.tsx`** -- Add clipboard state:
   - New state: `clipboard` (items + operation type: copy/cut)
   - New handlers: `handleCopy`, `handleCut`, `handlePaste`, `handleRename`
   - Pass clipboard state and handlers down to VaultContentView
   - New `useRenameVaultItem` mutation

3. **`src/components/nres/vault/VaultToolbar.tsx`** -- Simplify:
   - Remove New Folder and Upload buttons (moved to right-click menu)
   - Keep search bar only
   - Optionally keep Upload button as a convenience shortcut

### New Mutations (in `useNRESVaultData.ts`)
4. **`useNRESVaultData.ts`** -- Add new mutations:
   - `useRenameVaultItem`: updates folder/file name
   - `useMoveVaultItem`: moves a file/folder to a different parent folder
   - `useCopyVaultFile`: duplicates a file (copies in storage + creates new DB record)

## Technical Details

### Selection State
```text
- selectedItems: Set<string> (item IDs)
- Click: select single item, clear others
- Ctrl+Click: toggle item in selection
- Click empty space: clear selection
```

### Clipboard State (in NRESDocumentVault)
```text
clipboard: {
  items: Array<{ id, type, name, filePath? }>
  operation: 'copy' | 'cut'
} | null
```

### Context Menu Structure
```text
Empty space right-click:
  - New Folder -> opens name dialog
  - Upload Files -> triggers file input
  - Paste (enabled only if clipboard has items)
  - Refresh

Item right-click:
  - Open (folder) / Download (file)
  - Copy
  - Cut
  - Rename -> inline edit or dialog
  - Delete (if permitted)
  - Manage Access (if permitted)
```

### Grid Styling
- CSS Grid: `grid-template-columns: repeat(auto-fill, minmax(100px, 1fr))`
- Each tile: ~100px wide, folder icon (yellow) or file icon (by type), name below
- Selected: blue background/border
- Cut: 50% opacity
- Hover: light grey background

### Rename Flow
- Right-click -> Rename opens a small dialog (consistent with existing Create Folder dialog pattern)
- Updates the `name` field on the folder/file record

### Copy/Paste Flow for Files
- Copy + Paste: download from storage, re-upload with new path, insert new DB record in target folder
- Cut + Paste: update `folder_id` on the DB record (no storage move needed since path stays the same)

