

## Stock Image Library for Image Studio

### Overview
Add a searchable, categorised stock image library to Image Studio, pre-populated with images relevant to GP practices and Northamptonshire Primary Care. Users can browse, search, filter by category, and download images for use in presentations, documents, etc.

### What Changes

**1. Database: `stock_images` table**

A new table to store curated stock image metadata:

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (PK) | Unique identifier |
| title | TEXT | Descriptive title (e.g. "Patient consultation") |
| description | TEXT | Longer description for search matching |
| category | TEXT | Primary category (e.g. "Patients", "Buildings") |
| tags | TEXT[] | Array of searchable tags |
| image_url | TEXT | Public URL from storage bucket |
| storage_path | TEXT | Path within the storage bucket |
| file_size | INTEGER | File size in bytes |
| is_active | BOOLEAN | Soft-delete / hide toggle |
| created_at | TIMESTAMPTZ | When added |

RLS: All authenticated users can SELECT (read-only library). Only admins (or service role) can INSERT/UPDATE/DELETE.

**2. Storage bucket: `stock-images`**

A public bucket to serve images without authentication tokens in URLs, making them easy to download and paste into PowerPoint.

**3. Categories**

Pre-defined categories tailored to GP/primary care:

- **Patients** -- diverse patient images, consultation scenes
- **Buildings** -- GP surgery exteriors, Northamptonshire landmarks, NHS buildings
- **Reception & Waiting Areas** -- front desk, waiting rooms, check-in screens
- **Clinical Rooms** -- consultation rooms, examination areas, equipment
- **Staff & Teams** -- GPs, nurses, receptionists, practice managers, multidisciplinary teams
- **Technology** -- computer screens, EMIS/SystmOne mockups, telehealth, digital tools
- **Community & Wellbeing** -- community health, social prescribing, outdoor activities
- **Meetings & Training** -- boardrooms, training sessions, presentations
- **Branding & Logos** -- NHS logos, NPCA branding elements, PCN logos
- **Infographic Elements** -- icons, arrows, backgrounds, decorative elements

**4. New component: `StockImageLibrary.tsx`**

A browsable panel within Image Studio with:

- Category sidebar/filter chips across the top
- Search bar filtering on title, description, and tags
- Thumbnail grid with hover preview
- Click to view full size in a lightbox
- Download button (saves the image file directly)
- "Use in Studio" button to load the image into the Edit Image panel
- Image count per category shown on filter chips

**5. Integration into `ImageStudioModal.tsx`**

Add a third mode alongside "Create New" and "Edit Image":

- **Stock Library** -- new button with a `Library` icon in the mode toggle row
- When selected, replaces the tab content with the `StockImageLibrary` component
- "Use in Studio" action switches to Edit mode with the selected stock image loaded

Alternatively, add a "Stock Library" tab within the existing gallery modal, keeping the studio modes as they are. The stock library would sit as a new tab in `ImageGalleryModal` alongside "All Images", "Favourites", and "Categories".

The chosen approach: **Add as a new mode in Image Studio** (third button in the header), keeping it prominent and easy to discover.

**6. Admin upload workflow**

For populating the library, add a simple admin section (visible only to admin users) within the Stock Library panel:

- Drag-and-drop upload area
- Fields for title, category (dropdown), tags (comma-separated)
- Bulk upload support
- Edit/delete existing stock images

Admin detection uses the existing `is_admin` check from the user profile.

### Architecture Flow

```text
Image Studio Modal
  |-- [Create New]  [Edit Image]  [Stock Library]
  |
  Stock Library mode:
    +-- Search bar
    +-- Category filter chips (with counts)
    +-- Thumbnail grid (from stock_images table)
    |     |-- Click: select & show details
    |     |-- Download button
    |     |-- "Use in Studio" button --> switches to Edit mode
    +-- Admin section (if admin user)
          |-- Upload new stock images
          |-- Edit/delete existing
```

### Files Changed

| File | Change |
|------|--------|
| SQL migration | New `stock_images` table, `stock-images` public bucket, RLS policies |
| `src/components/ai4gp/studio/StockImageLibrary.tsx` | **New** -- browsable/searchable stock image grid |
| `src/components/ai4gp/studio/StockImageUploader.tsx` | **New** -- admin upload component |
| `src/components/ai4gp/ImageStudioModal.tsx` | Add "Stock Library" as third mode |
| `src/hooks/useStockImages.ts` | **New** -- hook for fetching/filtering/managing stock images |
| `src/integrations/supabase/types.ts` | Auto-updated with new table type |

### Technical Details

- Images served from a **public** Supabase storage bucket so URLs work directly in PowerPoint without auth tokens
- Full-text search uses PostgreSQL `ILIKE` on title/description plus `@>` array containment on tags
- Category counts fetched with a grouped query for the filter chips
- Download uses a direct `<a>` tag with the public storage URL and `download` attribute
- Stock images are read-only for regular users; admin flag gates the upload UI
- Lazy-loaded thumbnails with intersection observer for performance on large libraries

