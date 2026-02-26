
# GP Contract 2026/27 Update — Header Link and Page

## What will be added

1. **New GP Contract page** (`/gp-contract`) that renders the uploaded HTML infographic as a full-page view with proper styling, a back button, and download/print support.

2. **Header link** in the blue "Notewell AI" bar — a new button visible only to logged-in users, placed alongside the existing Home and Select Service buttons. It will use a distinctive style (e.g. a subtle highlight) to draw attention as a new feature.

## Technical Details

### 1. Copy the HTML file to the project
- Copy `user-uploads://gp-contract-26.27-infographic_draft2.html` to `public/documents/gp-contract-2627.html`

### 2. Create new page: `src/pages/GPContract.tsx`
- Renders the HTML infographic inside an iframe (`/documents/gp-contract-2627.html`)
- Includes the standard Header component
- Adds a print/download button
- Wrapped in ProtectedRoute so only logged-in users can access it

### 3. Add route in `src/App.tsx`
- Add lazy import for `GPContract`
- Add protected route: `/gp-contract`

### 4. Add button to `src/components/Header.tsx`
- Add a new button between "Home" and "Select Service" in the desktop nav (visible when `user` is truthy)
- Label: "GP Contract 26/27" with a `FileText` icon
- Style with a slight highlight (e.g. `bg-amber-500/30 hover:bg-amber-500/40`) to make it stand out as new
- Also add the link to the mobile drawer menu for mobile users
- Links to `/gp-contract`
