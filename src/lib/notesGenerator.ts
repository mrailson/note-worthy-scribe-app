// src/lib/notesGenerator.ts
// Client-side helper — calls your Supabase edge function with length + format params

import { supabase } from "@/integrations/supabase/client";

export type NotesLength = "brief" | "standard" | "detailed" | "comprehensive";
export type NotesFormat =
  | "standard"
  | "nhs_formal"
  | "clinical_notes"
  | "action_focused"
  | "educational_cpd"
  | "ageing_well";

interface GenerateNotesParams {
  transcript: string;
  format: NotesFormat;
  length: NotesLength;
  meetingTitle: string;
  attendees?: string[];
  date?: string;
}

interface GenerateNotesResult {
  notes: string;
  wordCount: number;
  generateDocx: boolean; // true when length === 'comprehensive'
}

export async function generateNotesWithLength(
  params: GenerateNotesParams
): Promise<GenerateNotesResult> {
  const { data, error } = await supabase.functions.invoke<GenerateNotesResult>(
    "generate-meeting-notes",
    { body: params }
  );

  if (error) throw new Error(error.message);
  if (!data) throw new Error("No data returned from edge function");

  return data;
}
