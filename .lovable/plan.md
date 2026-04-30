## Proposed fix

Yes — the current issue is that the green **Online** pill only means “the browser has internet”, not “you are authenticated with Supabase”. That is why it can show Online but still fail to load old meetings or only discover the missing login when an upload starts.

I propose changing the recorder so it has a clear, honest status model:

```text
Internet online + signed in      -> Online · Signed in
Internet online + not signed in  -> Online · Sign in needed
No internet                      -> Offline / Offline mode
Auth still restoring             -> Checking login…
```

## What I will change

1. **Make AuthContext expose a real readiness/refresh check**
   - Keep the current persisted Supabase session behaviour.
   - Add a safe `refreshSessionStatus()` helper that checks/restores the current session using `getSession()` and, when needed, `refreshSession()`.
   - Avoid calling async Supabase auth methods inside `onAuthStateChange`, to prevent auth event deadlocks.
   - Keep role/module checks server-side through the existing user roles table.

2. **Update the mobile recorder status pill**
   - Replace the misleading plain **Online** label with a combined network + login state.
   - If internet is available but the user is not logged in, show a warning state such as **Online · Sign in needed** rather than green **Online**.
   - Tapping that status will explain what is wrong and offer a direct **Sign in** button.

3. **Force login before online-only actions**
   - When in online/live mode, starting a recording will first check the real auth session.
   - If the session is missing/expired, the user will be sent to login before recording/uploading, rather than finding out after upload.
   - The same check will be used for:
     - Sync all
     - Sync individual recording
     - Re-process notes
     - Email audio/notes actions where applicable
     - My Meetings / old meetings navigation

4. **Make My Meetings easier and safer to access**
   - The document/My Meetings button and the My Meetings card will verify the auth session first.
   - If not logged in, navigate to `/auth` with a return path so the user comes back to meetings/recorder after login.
   - This avoids the confusing “empty old meetings” or inaccessible list state.

5. **Improve the `/meetings` page guard**
   - Currently it can sit in loading state if no user is present because `fetchMeetings()` returns early without clearing loading.
   - I will make it explicitly handle:
     - auth still loading: show “Checking login…”
     - no user: show a clear sign-in prompt
     - signed in: load meetings as normal
   - This should make old meetings reliable and understandable.

6. **Improve login return flow**
   - Update `/auth` so if a user is redirected there from the recorder or meetings page, successful login returns them to the intended page instead of always going home.
   - Keep existing magic-link/password behaviour intact.

## Files likely to change

- `src/contexts/AuthContext.tsx`
- `src/components/recorder/NoteWellRecorderMobile.jsx`
- `src/pages/MeetingHistory.tsx`
- `src/pages/Auth.tsx`

## Expected result

After this change, **Online** will no longer imply the wrong thing. If you are connected but not actually logged in, the UI will say so immediately and provide a clear sign-in path. Online recording/sync/meeting history will require a valid session up front, so the app will not wait until upload completion to discover that authentication is missing.