import { supabase } from "@/integrations/supabase/client";

export interface NameCorrection {
  id: string;
  incorrect_spelling: string;
  correct_spelling: string;
  is_active: boolean;
  created_at: string;
}

class UserNameCorrections {
  private corrections: Map<string, string> = new Map();
  private loaded = false;

  async loadCorrections(): Promise<void> {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) {
      this.corrections.clear();
      this.loaded = false;
      return;
    }

    const { data, error } = await supabase
      .from("user_name_corrections")
      .select("incorrect_spelling, correct_spelling")
      .eq("is_active", true);

    if (error) {
      console.error("Failed to load name corrections:", error);
      return;
    }

    this.corrections.clear();
    data?.forEach((row) => {
      // Store lowercase key for case-insensitive matching
      this.corrections.set(row.incorrect_spelling.toLowerCase(), row.correct_spelling);
    });
    this.loaded = true;
  }

  async addCorrection(incorrect: string, correct: string): Promise<boolean> {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) {
      console.error("No user session for saving correction");
      return false;
    }

    const { error } = await supabase
      .from("user_name_corrections")
      .upsert(
        {
          user_id: session.session.user.id,
          incorrect_spelling: incorrect.trim(),
          correct_spelling: correct.trim(),
          is_active: true,
        },
        { onConflict: "user_id,incorrect_spelling" }
      );

    if (error) {
      console.error("Failed to save correction:", error);
      return false;
    }

    // Update local cache
    this.corrections.set(incorrect.toLowerCase(), correct);
    return true;
  }

  async removeCorrection(incorrect: string): Promise<boolean> {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) return false;

    const { error } = await supabase
      .from("user_name_corrections")
      .delete()
      .eq("user_id", session.session.user.id)
      .eq("incorrect_spelling", incorrect);

    if (error) {
      console.error("Failed to remove correction:", error);
      return false;
    }

    this.corrections.delete(incorrect.toLowerCase());
    return true;
  }

  async getAllCorrections(): Promise<NameCorrection[]> {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) return [];

    const { data, error } = await supabase
      .from("user_name_corrections")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch corrections:", error);
      return [];
    }

    return data as NameCorrection[];
  }

  applyCorrections(text: string): string {
    if (!this.loaded || this.corrections.size === 0) return text;

    let result = text;
    this.corrections.forEach((correct, incorrectLower) => {
      // Create case-insensitive word-boundary regex
      const pattern = new RegExp(`\\b${escapeRegex(incorrectLower)}\\b`, "gi");
      result = result.replace(pattern, correct);
    });

    return result;
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const userNameCorrections = new UserNameCorrections();
