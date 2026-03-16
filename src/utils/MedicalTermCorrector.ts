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
  private contextualCorrections: Map<string, { correction: string; context?: string; confidence: number }> = new Map();
  private usageStats: Map<string, number> = new Map();
  private isLoaded = false;

  async loadCorrections(userId?: string): Promise<void> {
    try {
      let query = supabase
        .from('medical_term_corrections')
        .select('*');

      // Load user-specific corrections if user ID provided
      if (userId) {
        // Load user's own + global + practice-level corrections
        query = query.or(`user_id.eq.${userId},is_global.eq.true,practice_id.not.is.null`);
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
        
        // Store contextual information
        this.contextualCorrections.set(key, {
          correction: correction.correct_term,
          context: correction.context_phrase,
          confidence: this.calculateConfidence(correction)
        });
        
        // Track usage statistics
        this.usageStats.set(key, correction.usage_count);
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
    contextPhrase?: string,
    userId?: string
  ): Promise<boolean> {
    try {
      let actualUserId = userId;
      
      if (!actualUserId) {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
          throw new Error('User must be authenticated to add corrections');
        }
        actualUserId = user.data.user.id;
      }

      // Check if correction already exists
      const { data: existing } = await supabase
        .from('medical_term_corrections')
        .select('id, usage_count')
        .eq('user_id', actualUserId)
        .eq('incorrect_term', incorrectTerm.trim())
        .maybeSingle();

      if (existing) {
        // Update existing correction
        const { error } = await supabase
          .from('medical_term_corrections')
          .update({
            correct_term: correctTerm.trim(),
            usage_count: existing.usage_count + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) {
          console.error('Error updating medical term correction:', error);
          return false;
        }
      } else {
        // Look up user's practice for automatic sharing
        let practiceId = null;
        try {
          const { data: practiceIds } = await supabase.rpc('get_user_practice_ids', { p_user_id: actualUserId });
          practiceId = practiceIds && practiceIds.length > 0 ? practiceIds[0] : null;
        } catch (e) {
          console.warn('Could not determine practice_id for correction sharing');
        }

        // Insert new correction
        const { error } = await supabase
          .from('medical_term_corrections')
          .insert({
            user_id: actualUserId,
            incorrect_term: incorrectTerm.trim(),
            correct_term: correctTerm.trim(),
            context_phrase: contextPhrase?.trim(),
            usage_count: 1,
            is_global: false,
            practice_id: practiceId,
          });

        if (error) {
          console.error('Error adding medical term correction:', error);
          return false;
        }
      }

      // Update local cache
      this.corrections.set(incorrectTerm.toLowerCase().trim(), correctTerm.trim());
      console.log(`✅ Added/updated correction: "${incorrectTerm}" → "${correctTerm}"`);
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

  applyCorrections(text: string, context?: string): string {
    if (!this.isLoaded || !text) {
      return text;
    }

    let correctedText = text;

    // Apply contextual corrections first (higher priority)
    this.contextualCorrections.forEach((correctionData, incorrectTerm) => {
      // If context is provided, check if it matches
      if (context && correctionData.context) {
        const contextMatch = context.toLowerCase().includes(correctionData.context.toLowerCase());
        if (!contextMatch) return; // Skip if context doesn't match
      }

      // Create regex for case-insensitive word boundary matching
      const regex = new RegExp(`\\b${this.escapeRegex(incorrectTerm)}\\b`, 'gi');
      correctedText = correctedText.replace(regex, (match) => {
        // Preserve case when replacing
        return this.preserveCase(match, correctionData.correction);
      });
    });

    // Apply standard corrections for any remaining matches
    this.corrections.forEach((correctTerm, incorrectTerm) => {
      if (!this.contextualCorrections.has(incorrectTerm)) {
        const regex = new RegExp(`\\b${this.escapeRegex(incorrectTerm)}\\b`, 'gi');
        correctedText = correctedText.replace(regex, (match) => {
          return this.preserveCase(match, correctTerm);
        });
      }
    });

    return correctedText;
  }

  private calculateConfidence(correction: MedicalTermCorrection): number {
    // Calculate confidence based on usage count, context, and other factors
    let confidence = 0.5; // Base confidence
    
    // Higher usage = higher confidence
    if (correction.usage_count > 10) confidence += 0.3;
    else if (correction.usage_count > 5) confidence += 0.2;
    else if (correction.usage_count > 0) confidence += 0.1;
    
    // Context presence increases confidence
    if (correction.context_phrase) confidence += 0.2;
    
    // Global corrections are more trusted
    if (correction.is_global) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  private preserveCase(original: string, replacement: string): string {
    // If original is all uppercase, make replacement uppercase
    if (original === original.toUpperCase()) {
      return replacement.toUpperCase();
    }
    
    // If original is title case, make replacement title case
    if (original[0] === original[0].toUpperCase() && original.slice(1) === original.slice(1).toLowerCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
    }
    
    return replacement;
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Returns which corrections were applied to a given text
  getAppliedCorrections(text: string): Array<{ from: string; to: string }> {
    if (!this.isLoaded || !text) return [];

    const applied: Array<{ from: string; to: string }> = [];
    const seen = new Set<string>();

    this.contextualCorrections.forEach((correctionData, incorrectTerm) => {
      const regex = new RegExp(`\\b${this.escapeRegex(incorrectTerm)}\\b`, 'gi');
      if (regex.test(text) && !seen.has(incorrectTerm)) {
        seen.add(incorrectTerm);
        applied.push({ from: incorrectTerm, to: correctionData.correction });
      }
    });

    this.corrections.forEach((correctTerm, incorrectTerm) => {
      if (!this.contextualCorrections.has(incorrectTerm)) {
        const regex = new RegExp(`\\b${this.escapeRegex(incorrectTerm)}\\b`, 'gi');
        if (regex.test(text) && !seen.has(incorrectTerm)) {
          seen.add(incorrectTerm);
          applied.push({ from: incorrectTerm, to: correctTerm });
        }
      }
    });

    return applied;
  }

  getCorrections(): Map<string, string> {
    return new Map(this.corrections);
  }

  hasCorrections(): boolean {
    return this.corrections.size > 0;
  }

  getContextualCorrections(): Map<string, { correction: string; context?: string; confidence: number }> {
    return new Map(this.contextualCorrections);
  }

  getUsageStats(): Map<string, number> {
    return new Map(this.usageStats);
  }

  // Batch apply corrections to multiple texts
  async batchApplyCorrections(texts: string[], context?: string): Promise<string[]> {
    return texts.map(text => this.applyCorrections(text, context));
  }

  // Get correction suggestions based on context
  getSuggestions(text: string, context?: string): Array<{ incorrect: string; correct: string; confidence: number }> {
    const suggestions: Array<{ incorrect: string; correct: string; confidence: number }> = [];
    
    this.contextualCorrections.forEach((correctionData, incorrectTerm) => {
      const regex = new RegExp(`\\b${this.escapeRegex(incorrectTerm)}\\b`, 'gi');
      if (regex.test(text)) {
        let confidence = correctionData.confidence;
        
        // Adjust confidence based on context match
        if (context && correctionData.context) {
          const contextMatch = context.toLowerCase().includes(correctionData.context.toLowerCase());
          confidence = contextMatch ? confidence * 1.2 : confidence * 0.8;
        }
        
        suggestions.push({
          incorrect: incorrectTerm,
          correct: correctionData.correction,
          confidence: Math.min(confidence, 1.0)
        });
      }
    });
    
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  // Get suggestions for popup (returns just the correction strings)
  async getSuggestionsForText(text: string, limit: number = 5): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('medical_term_corrections')
        .select('correct_term, usage_count')
        .or(`incorrect_term.ilike.${text},incorrect_term.ilike.%${text}%`)
        .order('usage_count', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return data?.map(d => d.correct_term) || [];
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      return [];
    }
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