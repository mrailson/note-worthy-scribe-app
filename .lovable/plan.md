

# Training Videos Hub

## Overview
Create a new "Training Videos" page accessible from the user dropdown menu. The page will display a library of short Loom training videos, organised into categories, with search functionality and easy navigation.

## How It Works
- A new "Training Videos" menu item will appear in the user dropdown (between "User Settings" and "CSO Report")
- Clicking it opens a dedicated page with all training videos organised by category
- Each video is displayed as a card with a Loom embed, title, description, and duration
- A search bar at the top lets you filter videos by title, description, or category
- A sidebar/category nav lets you quickly jump to specific sections
- Videos are defined in a simple data array, making it trivial to add new ones -- just paste a Loom link

## Page Layout
- **Header**: Title, description, and search bar
- **Category Navigation**: Sticky sidebar (desktop) or horizontal scrollable tabs (mobile) listing all categories for quick jumping
- **Video Grid**: Cards grouped by category, each containing:
  - Loom embedded player (using Loom's embed URL format)
  - Video title
  - Short description of what it covers
  - Duration badge (e.g. "2 min")
  - Category tag

## Adding a New Video
You simply add an entry to the data array with:
- `title` -- e.g. "How to Use the Translation Service"
- `description` -- short summary
- `loomUrl` -- the Loom share link (automatically converted to embed format)
- `category` -- e.g. "Getting Started", "Ask AI", "Translation", "Meetings"
- `duration` -- e.g. "3 min"

## Technical Details

### New Files
1. **`src/pages/TrainingVideosHub.tsx`** -- Main page component with:
   - Search state filtering videos by title/description/category (case-insensitive)
   - Category grouping with scroll-to-section using `useRef` and `scrollIntoView`
   - Loom URL parsing (converts `loom.com/share/xxx` to `loom.com/embed/xxx`)
   - Responsive grid layout (1 col mobile, 2 cols tablet, 3 cols desktop)

2. **`src/data/trainingVideos.ts`** -- Data file containing the video definitions array and category list. This keeps the data separate from the UI for easy maintenance.

### Modified Files
3. **`src/components/Header.tsx`** -- Add "Training Videos" menu item with a `Video` icon in both the desktop dropdown and mobile drawer, placed after "User Settings"

4. **`src/App.tsx`** -- Add route: `/training-videos` pointing to the new page (wrapped in `ProtectedRoute` so only logged-in users see it)

5. **`src/components/admin/PageRouteAudit.tsx`** -- Register the new route in the audit list

### Loom Embed Approach
Each video card will use an iframe with Loom's embed URL:
```
https://www.loom.com/embed/{videoId}
```
extracted from the share link `https://www.loom.com/share/{videoId}`. The embed is wrapped in a 16:9 aspect ratio container.

### Search Implementation
Client-side filtering using a simple text match against title, description, and category fields. Results update instantly as the user types. When searching, category headers are hidden if no videos in that category match.

### Navigation
Each category section has an `id` anchor. The sidebar/tab navigation uses `scrollIntoView({ behavior: 'smooth' })` to jump to sections. An active indicator highlights the current section.

