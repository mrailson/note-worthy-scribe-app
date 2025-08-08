import { supabase } from '@/integrations/supabase/client';

export interface MedicalTermCorrection {
  id: string;
  incorrect_term: string;
  correct_term: string;
  context_phrase?: string;
  usage_count: number;
  is_global: boolean;
  created_at: string;
  updated_at: string;
}

export class MedicalTermCorrector {
  private corrections: Map<string, string> = new Map();
  private isLoaded = false;

  async loadCorrections(userId?: string): Promise<void> {
    try {
      let query = supabase
        .from('medical_term_corrections')
        .select('*');

      // Load user-specific corrections if user ID provided
      if (userId) {
        query = query.or(`user_id.eq.${userId},is_global.eq.true`);
      } else {
        // Load only global corrections for anonymous users
        query = query.eq('is_global', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading medical term corrections:', error);
        return;
      }

      // Clear existing corrections
      this.corrections.clear();

      // Load corrections into memory for fast lookup
      data?.forEach((correction) => {
        const key = correction.incorrect_term.toLowerCase().trim();
        this.corrections.set(key, correction.correct_term);
      });

      this.isLoaded = true;
      console.log(`📋 Loaded ${this.corrections.size} medical term corrections`);
    } catch (error) {
      console.error('Failed to load medical term corrections:', error);
    }
  }

  async addCorrection(
    incorrectTerm: string,
    correctTerm: string,
    contextPhrase?: string
  ): Promise<boolean> {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('User must be authenticated to add corrections');
      }

      const { error } = await supabase
        .from('medical_term_corrections')
        .insert({
          user_id: user.data.user.id,
          incorrect_term: incorrectTerm.trim(),
          correct_term: correctTerm.trim(),
          context_phrase: contextPhrase?.trim(),
          usage_count: 0,
          is_global: false,
        });

      if (error) {
        console.error('Error adding medical term correction:', error);
        return false;
      }

      // Update local cache
      this.corrections.set(incorrectTerm.toLowerCase().trim(), correctTerm.trim());
      console.log(`✅ Added correction: "${incorrectTerm}" → "${correctTerm}"`);
      return true;
    } catch (error) {
      console.error('Failed to add medical term correction:', error);
      return false;
    }
  }

  async deleteCorrection(incorrectTerm: string): Promise<boolean> {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('User must be authenticated to delete corrections');
      }

      const { error } = await supabase
        .from('medical_term_corrections')
        .delete()
        .match({
          user_id: user.data.user.id,
          incorrect_term: incorrectTerm.trim(),
        });

      if (error) {
        console.error('Error deleting medical term correction:', error);
        return false;
      }

      // Update local cache
      this.corrections.delete(incorrectTerm.toLowerCase().trim());
      console.log(`🗑️ Deleted correction for: "${incorrectTerm}"`);
      return true;
    } catch (error) {
      console.error('Failed to delete medical term correction:', error);
      return false;
    }
  }

  applyCorrections(text: string): string {
    if (!this.isLoaded || !text) {
      return text;
    }

    let correctedText = text;

    // Apply each correction
    this.corrections.forEach((correctTerm, incorrectTerm) => {
      // Create regex for case-insensitive word boundary matching
      const regex = new RegExp(`\\b${this.escapeRegex(incorrectTerm)}\\b`, 'gi');
      correctedText = correctedText.replace(regex, correctTerm);
    });

    return correctedText;
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  getCorrections(): Map<string, string> {
    return new Map(this.corrections);
  }

  hasCorrections(): boolean {
    return this.corrections.size > 0;
  }

  async refreshCorrections(userId?: string): Promise<void> {
    await this.loadCorrections(userId);
  }

  // Update usage count when a correction is applied
  async incrementUsageCount(incorrectTerm: string): Promise<void> {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Get current usage count and increment it
      const { data: currentData } = await supabase
        .from('medical_term_corrections')
        .select('usage_count')
        .match({
          user_id: user.data.user.id,
          incorrect_term: incorrectTerm.trim(),
        })
        .single();

      if (currentData) {
        await supabase
          .from('medical_term_corrections')
          .update({ usage_count: currentData.usage_count + 1 })
          .match({
            user_id: user.data.user.id,
            incorrect_term: incorrectTerm.trim(),
          });
      }
    } catch (error) {
      console.error('Failed to increment usage count:', error);
    }
  }
}

// Singleton instance for global use
export const medicalTermCorrector = new MedicalTermCorrector();

// Common medical terms that are frequently misheard
export const COMMON_MEDICAL_CORRECTIONS = new Map([
  ['cof', 'QOF'],
  ['quality outcomes framework', 'QOF'],
  ['ars', 'ARRS'],
  ['additional roles reimbursement scheme', 'ARRS'],
  ['pcn', 'PCN'],
  ['primary care network', 'PCN'],
  ['cqc', 'CQC'],
  ['care quality commission', 'CQC'],
  ['gms', 'GMS'],
  ['general medical services', 'GMS'],
  ['pms', 'PMS'],
  ['personal medical services', 'PMS'],
  ['dna', 'DNA'],
  ['did not attend', 'DNA'],
  ['nhs', 'NHS'],
  ['national health service', 'NHS'],
  ['gp', 'GP'],
  ['general practitioner', 'GP'],
  ['mhra', 'MHRA'],
  ['medicines and healthcare products regulatory agency', 'MHRA'],
  ['nice', 'NICE'],
  ['national institute for health and care excellence', 'NICE'],
  ['bnf', 'BNF'],
  ['british national formulary', 'BNF'],
  ['gmc', 'GMC'],
  ['general medical council', 'GMC'],
  ['rcgp', 'RCGP'],
  ['royal college of general practitioners', 'RCGP'],
]);