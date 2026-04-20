

## Upload PCN DES 26/27 Board Briefing to public folder

### What I'll do
Copy the uploaded file `Blue_PCN_DES_2627_Board_Briefing.html` into the project's `public/documents/DES27/` folder so it's served as a static file (no login required, no code changes needed beyond the file copy).

### File placement
- **Source**: `user-uploads://Blue_PCN_DES_2627_Board_Briefing.html`
- **Destination**: `public/documents/DES27/blue-pcn-des-2627-board-briefing.html`

(Lowercased, hyphenated filename to match the existing convention used by `des-2627-briefing.html` in the same folder.)

### Public links (live immediately after the file is copied and the frontend is republished)
- https://gpnotewell.co.uk/documents/DES27/blue-pcn-des-2627-board-briefing.html
- https://notewell.dialai.co.uk/documents/DES27/blue-pcn-des-2627-board-briefing.html
- https://meetingmagic.lovable.app/documents/DES27/blue-pcn-des-2627-board-briefing.html

These URLs bypass React Router and the auth guard entirely — anyone with the link can open them, no Notewell account needed.

### Important note on publishing
Static files in `public/` are part of the **frontend bundle**. After the copy, you'll need to click **Publish → Update** in Lovable for the file to appear on `gpnotewell.co.uk`. Until then it will only be visible on the preview URL.

### What I will NOT do
- No new React route, no in-app viewer chrome, no homepage tile, no login-page promotion — just the file copy and the public link, as requested.
- No edits to the HTML itself.

