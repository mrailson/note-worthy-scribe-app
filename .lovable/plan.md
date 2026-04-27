Plan to update the favicons with the attached robot assets

1. Add the new favicon files
- Copy the uploaded favicon assets into `public/`:
  - `favicon.ico`
  - `notewell-favicon-16x16.png`
  - `notewell-favicon-32x32.png`
  - `notewell-favicon-48x48.png`
  - `notewell-favicon-64x64.png`
  - `notewell-favicon-180x180.png`
  - `notewell-favicon-192x192.png`
  - `notewell-favicon-256x256.png`
  - `notewell-favicon-512x512.png`
- This restores `/favicon.ico`, which browsers request by default, but with the correct new robot icon.

2. Update the main app favicon tags
- Replace the current `/favicon-option1.png?v=6` favicon block in `index.html` with the attached snippet:
  - `/favicon.ico` for standard browser favicon
  - `/notewell-favicon-32x32.png`
  - `/notewell-favicon-192x192.png`
  - `/notewell-favicon-180x180.png` for Apple touch icon
- Apply the same metadata in `src/components/SEO.tsx` so React Helmet pages do not reintroduce the old icon.

3. Update static HTML pages
- Replace favicon references in the static public HTML pages currently pointing to `/favicon-option1.png?v=6` so they use the new favicon set as well.
- This includes documents, reports, and demo pages under `public/`.

4. Update in-app robot icon usages where appropriate
- Replace UI image references currently using `/favicon-option1.png` as the Notewell robot/avatar/toast icon with the new robot asset, preferably `/notewell-favicon-192x192.png` or `/notewell-favicon-512x512.png` depending on display size.
- Update the recording/visibility notification favicon restoration paths so browser tabs and notifications use the new icon.
- Also fix the remaining `/favicon-robot.png` reference in the mobile recorder if it is intended to show the same robot.

5. Keep retired white robot out
- Confirm there are no remaining references to `favicon-robot-white.png`.
- Do not re-add the retired white robot favicon.

6. Verify
- Run a global search for old favicon references:
  - `favicon-option1.png`
  - `favicon-robot-white.png`
  - `favicon-robot.png`
- Run the production build to confirm the changes compile successfully.

Technical details
- Files expected to change include `index.html`, `src/components/SEO.tsx`, favicon-related hooks/components, and static `.html` files under `public/`.
- The previous `public/favicon.ico` deletion will be reversed by copying in the uploaded replacement `favicon.ico`, so browser default favicon requests resolve to the correct robot.