export type QuickPickContext = {
  replyId: string;          // the current answer block id
  text: string;             // current answer content (plain markdown)
  userId: string;           // current user
  patientSafeMode?: boolean;// optional policy flag
};

export type TranslatePayload = {
  mode: "patient" | "clinician" | "auto" | "back-to-en";
  targetLang?: string;      // e.g. "pl"
  original?: string;        // original text (for back-translate display)
};

export type SummarisePayload = { 
  maxWords: 50 | 100 | 150; 
};

export type FormatPayload = { 
  system: "emis" | "systmone"; 
};

export interface QuickPickItem {
  id: string;
  label: string;
  children?: QuickPickItem[];
}

export interface QuickPickConfig {
  quickPick: QuickPickItem[];
}

export type QuickPickHandler = (ctx: QuickPickContext) => Promise<void> | void;