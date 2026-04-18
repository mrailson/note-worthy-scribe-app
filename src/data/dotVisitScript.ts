// src/data/dotVisitScript.ts
// Timed script for Sarah Mitchell's home visit to Dot Pearson.
// `t` is seconds elapsed from modal mount. Phases switch at hard-coded
// boundaries (see HomeVisitCaptureModal): prologue ends at 8.5s, recording
// at 80.5s, end-state card overlays at 88s.

export type VisitTurnKind = "card" | "transcript" | "separator" | "action";
export type Speaker = "sarah" | "dot";

export interface VisitTurn {
  t: number;                 // seconds from mount
  kind: VisitTurnKind;
  speaker?: Speaker;         // transcript only
  text: string;
  subtitle?: string;         // for cards (small line below)
  big?: boolean;             // emphasised card (consent moment)
  icon?: "wifi-off" | "consent";
}

export const DOT_VISIT_SCRIPT: VisitTurn[] = [
  // ──── PROLOGUE (overlay cards) ────
  { t: 0.0, kind: "card", text: "Sarah has just arrived at Dot's front door." },
  { t: 1.5, kind: "card", speaker: "sarah", text: "Hello Dot, lovely to see you. Is now still a good time?" },
  { t: 3.0, kind: "card", speaker: "dot", text: "Yes love, come in, the kettle's on." },
  { t: 4.5, kind: "card", text: "Sarah sits on the sofa next to Dot." },
  {
    t: 5.5,
    kind: "card",
    big: true,
    icon: "consent",
    text: "Sarah explains she'd like to use Notewell to help capture today's conversation, so she can focus on Dot rather than note-taking. Dot agrees.",
    subtitle: "Informed verbal consent recorded",
  },
  {
    t: 7.5,
    kind: "card",
    icon: "wifi-off",
    text: "No internet at Primrose Lane. That's fine — Notewell works offline.",
  },

  // ──── RECORDING (transcript bubbles) ────
  { t: 8.5, kind: "transcript", speaker: "sarah", text: "So, Dot, tell me a bit about how you're managing at home these days. How are you keeping?" },
  { t: 11.0, kind: "transcript", speaker: "dot", text: "Well, I mustn't grumble. Eric used to do all the fiddly bits you know, the bills and that. I'm doing my best." },
  { t: 14.0, kind: "transcript", speaker: "sarah", text: "It's been — eighteen months now since Eric passed?" },
  { t: 16.0, kind: "transcript", speaker: "dot", text: "Eighteen months this Tuesday gone. Still can't believe it really." },
  { t: 19.0, kind: "transcript", speaker: "sarah", text: "That's such a short time, Dot. And you've been managing on your own all this while. How's your sleep been?" },
  { t: 22.0, kind: "transcript", speaker: "dot", text: "Oh, not wonderful. I'm up two or three times most nights — bathroom, and the knees don't help either." },
  { t: 25.0, kind: "transcript", speaker: "sarah", text: "The knees — still the osteoarthritis we talked about on the phone?" },
  { t: 27.5, kind: "transcript", speaker: "dot", text: "Yes, both of them. I take the paracetamol when I remember but it doesn't really touch it these days." },
  { t: 30.5, kind: "transcript", speaker: "sarah", text: "Let me make a note for Dr Patel to have a proper look at that. Now — have you had any falls since we last spoke?" },
  { t: 33.5, kind: "transcript", speaker: "dot", text: "Well. There was the kitchen mat in September. And then in January I went over in the garden — silly really, just stepping off the patio." },
  { t: 37.5, kind: "transcript", speaker: "sarah", text: "Did either time you go to hospital?" },
  { t: 39.0, kind: "transcript", speaker: "dot", text: "No no, I picked myself up. Sandra was cross with me for not telling her about the first one." },
  { t: 42.0, kind: "transcript", speaker: "sarah", text: "And is Sandra still coming on Sundays?" },
  { t: 44.0, kind: "transcript", speaker: "dot", text: "Every Sunday. She brings the little ones, Archie and Poppy. That's the highlight of my week to be honest with you." },

  // ──── FAST-FORWARD SEPARATOR ────
  { t: 47.0, kind: "separator", text: "38 minutes later…" },

  { t: 48.0, kind: "transcript", speaker: "sarah", text: "Okay Dot, let me just check this Timed Up and Go. I need you to stand up from the chair without using your arms if you can, walk to that doorway, turn around, and come back and sit down." },
  { t: 51.5, kind: "transcript", speaker: "dot", text: "Righto, I'll do my best." },
  { t: 53.0, kind: "action", text: "Sarah times Dot with her phone stopwatch." },
  { t: 55.5, kind: "transcript", speaker: "sarah", text: "Twenty-two seconds, Dot. That's brilliant for how the knees are. Used the frame though, and I saw you reach for the chair arms." },
  { t: 59.5, kind: "transcript", speaker: "dot", text: "I can't do it any other way these days, love." },
  { t: 62.0, kind: "transcript", speaker: "sarah", text: "That's alright. I'm going to talk to the team about a community physio referral — help keep you strong." },
  { t: 64.5, kind: "transcript", speaker: "sarah", text: "One last thing — I've got a short questionnaire about mood. Just nine questions, yes/no sort of answers. Is that alright?" },
  { t: 67.5, kind: "transcript", speaker: "dot", text: "Go on then. Won't say I'm feeling jolly, mind." },
  { t: 70.5, kind: "transcript", speaker: "sarah", text: "That's exactly why we ask. Over the last two weeks, how often have you felt down, depressed, or hopeless?" },
  { t: 74.0, kind: "transcript", speaker: "dot", text: "Most days, I'd say. It comes in waves. The mornings are the hardest without him." },
  { t: 77.5, kind: "transcript", speaker: "sarah", text: "Thank you for telling me. That's really important for me to know." },

  // ──── RECORDING STOPS ────
  { t: 81.5, kind: "card", text: "Sarah thanks Dot, finishes her tea, and heads out to the car." },
  { t: 84.0, kind: "card", text: "In the car, Sarah opens Notewell on her phone…" },
];

// Timing constants used by the modal
export const PROLOGUE_END_T = 8.5;
export const RECORDING_START_T = 8.5;
export const FAST_FORWARD_T = 47.0;
export const RECORDING_STOP_T = 80.5;
export const END_STATE_T = 88.0;
export const RECORDING_DURATION_LABEL = "45:18";
export const WORD_COUNT = 7743;
