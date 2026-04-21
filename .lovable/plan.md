

## Add Role Pill Visibility Toggles to My Profile

### Summary
Add a new section in the **My Profile** modal (under the "👤 My Profile" tab) that lets you show or hide each role pill on the Ask AI welcome screen. Each role gets an on/off toggle, and the preference persists via the existing `nw_ai_settings` localStorage mechanism.

### Changes — single file: `src/components/AskAI/NotewellChat.jsx`

**1. Extend `DEFAULT_SETTINGS` (line ~23)**
Add a new key `visibleRoles` with all five roles enabled by default:
```js
visibleRoles: {
  "Practice Manager": true,
  "GP Partner": true,
  "Admin / Reception": true,
  "PCN Manager": true,
  "Ageing Well": true,
}
```

**2. Add toggle UI to the Profile tab in `UserProfileModal` (after the Quick-add section, ~line 728)**
Insert a new section titled **"Role pills"** with a brief description ("Choose which role pills appear on the welcome screen") and five toggle rows — one per role — styled identically to the existing Document Settings toggles (same switch button, label, and layout pattern). Each toggle calls `saveSettings` to patch the `visibleRoles` object.

**3. Filter visible roles in `WelcomeScreen` (line ~1146)**
Replace `const ROLES = Object.keys(ROLE_SUGGESTIONS);` with a filtered version that reads `settings.visibleRoles` and only includes roles where the value is `true` (defaulting to all visible if the setting is missing).

**4. Pass `settings` to `WelcomeScreen`**
The `WelcomeScreen` component currently receives `user, vp, onSuggestion, onHelp, onProfile, onPopulateInput`. Add `settings` as an additional prop, threaded from the parent `NotewellChat` component where it is already available.

### Behaviour
- All five pills visible by default (backward-compatible).
- Toggling a pill off hides it immediately on next visit to the welcome screen.
- If the currently active role is hidden, the active role resets to the first visible one.
- Settings persist across sessions via `localStorage` (`nw_ai_settings`), same as all other settings.
- No database changes required.

