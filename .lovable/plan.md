## Problem

When the user clicks **Stop** on the meeting recorder, the UI currently goes through three visual states:

1. **Recording panel** with "Finalising Meeting… / Stopping audio streams…" (good — clearly busy)
2. **Brief "middle view"** — the recording card disappears as `resetMeeting()` runs and `isStoppingRecording` is flipped off ~300 ms before the modal mounts. The screen looks like the empty *Prepare* setup view (Attendees / Agenda panels), so it appears the meeting is **already done and discarded**.
3. **"Meeting Saved Successfully" modal** finally appears.

The middle flash is alarming — users think something has gone wrong or that they've lost the recording.

## Goal

Keep a clear "still finishing" signal visible on screen continuously from the moment **Stop** is pressed until the **Meeting Saved Successfully** modal is fully mounted. No behaviour change to the underlying save/transcribe pipeline.

## Approach

Add a lightweight full-screen **"Finalising your meeting"** overlay (fixed, semi-transparent backdrop + centred card with spinner, current step text, and reassurance copy). It is driven by a single new state flag `isFinalisingMeeting` that:

- Turns **on** the instant the user clicks Stop (alongside the existing `isStoppingRecording`).
- Stays **on** through `resetMeeting()` and the 300 ms grace gap.
- Turns **off** only after `showPostMeetingActions` has become `true` (i.e. the Saved modal is mounted).

Because the overlay sits above the page (z-index above the recorder card but below the Dialog modal), the empty Prepare view never becomes the focal point. The Saved modal then opens "through" the fading overlay.

## Changes

### `src/components/MeetingRecorder.tsx`

1. **New state** near the existing `isStoppingRecording`:
   ```ts
   const [isFinalisingMeeting, setIsFinalisingMeeting] = useState(false);
   ```

2. **Set on Stop**: in the stop handler (around line 4935 / 5246), set `setIsFinalisingMeeting(true)` at the same point `setIsStoppingRecording(true)` is called.

3. **Clear after modal mounts**: in both success and bg-error branches around lines 6036 and 6059, immediately after `setShowPostMeetingActions(true)`, schedule `setIsFinalisingMeeting(false)` on a short delay (e.g. 400 ms — slightly after the existing 300 ms `setIsStoppingRecording(false)` timer) so the overlay only fades out once the Dialog is on screen. Also clear it in the error path at line 6104 and the short-meeting early-return at ~5171.

4. **Render the overlay** near the bottom of the component's JSX (just before the `PostMeetingActionsModal` at line 8301):
   ```tsx
   {isFinalisingMeeting && (
     <div className="fixed inset-0 z-[60] bg-background/85 backdrop-blur-sm
                     flex items-center justify-center animate-in fade-in duration-200">
       <Card className="w-[min(92vw,420px)] shadow-2xl border-primary/20">
         <CardContent className="p-6 text-center space-y-3">
           <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
           <h3 className="text-lg font-semibold">Finalising your meeting…</h3>
           <p className="text-sm text-muted-foreground">
             Saving the recording, transcript and notes. Please don't close this tab —
             the confirmation will appear in a moment.
           </p>
           {stopRecordingStep && (
             <div className="text-xs font-medium text-blue-600 dark:text-blue-400
                             animate-pulse pt-1">
               {stopRecordingStep}
             </div>
           )}
         </CardContent>
       </Card>
     </div>
   )}
   ```

5. **Progress wording polish** — the existing `stopRecordingStep` cycles through "Stopping audio streams…", "Saving meeting…", "Generating notes…", "Complete!". These already drive the overlay's small status line, so the user sees the pipeline progress without code changes.

## What stays the same

- Existing in-card "Finalising Meeting… / Stopping…" UI is unchanged — it just becomes the layer underneath the overlay during the transition.
- Save / transcribe / notes-generation flow is untouched.
- `PostMeetingActionsModal` ("Meeting Saved Successfully") is untouched and opens on top of the fading overlay as it does today.

## Out of scope

- No changes to the post-meeting modal itself.
- No changes to background note generation or queue behaviour.
- No changes to mobile/iOS recording recovery paths beyond the same flag flip.

## QA checklist (after build)

1. Start a short meeting, press Stop → overlay appears immediately, stays visible through "Stopping audio streams… → Saving… → Complete!", then Saved modal appears on top with no blank Prepare view in between.
2. Force a background error (offline) → overlay still hands over cleanly to the Saved modal via the error branch.
3. Short meeting (<100 words) early return → overlay does not get stuck (cleared in early-return path).
