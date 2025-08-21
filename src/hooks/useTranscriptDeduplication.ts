import { useState, useRef, useCallback } from 'react';
import { transcriptCleaner, CleaningOptions, RemovedSegment } from '@/utils/TranscriptCleaner';

export interface TranscriptSection {
  id: string;
  text: string;
  speaker: string;
  timestamp: string;
  confidence: number;
  isFinal: boolean;
}

export interface CleaningStats {
  totalSections: number;
  duplicatesRemoved: number;
  bytesReduced: number;
  lastCleaningTime: string | null;
}

export interface DeduplicationSettings {
  enabled: boolean;
  cleaningLevel: 'light' | 'medium' | 'aggressive';
  realTimeDeduplication: boolean;
  showRawTranscript: boolean;
}

const CLEANING_LEVEL_OPTIONS: Record<string, CleaningOptions> = {
  light: {
    removeHallucinations: true,
    fixGrammar: false,
    addPunctuation: false,
    removeFiller: false,
    mergeFragments: false,
    confidenceThreshold: 0.5,
    minimumLength: 3
  },
  medium: {
    removeHallucinations: true,
    fixGrammar: true,
    addPunctuation: true,
    removeFiller: false,
    mergeFragments: true,
    confidenceThreshold: 0.6,
    minimumLength: 5
  },
  aggressive: {
    removeHallucinations: true,
    fixGrammar: true,
    addPunctuation: true,
    removeFiller: true,
    mergeFragments: true,
    confidenceThreshold: 0.7,
    minimumLength: 8
  }
};

export const useTranscriptDeduplication = () => {
  const [rawSections, setRawSections] = useState<TranscriptSection[]>([]);
  const [cleanedSections, setCleanedSections] = useState<TranscriptSection[]>([]);
  const [cleaningStats, setCleaningStats] = useState<CleaningStats>({
    totalSections: 0,
    duplicatesRemoved: 0,
    bytesReduced: 0,
    lastCleaningTime: null
  });
  
  const [settings, setSettings] = useState<DeduplicationSettings>({
    enabled: true,
    cleaningLevel: 'medium',
    realTimeDeduplication: true,
    showRawTranscript: false
  });

  // Track recent sections for similarity comparison
  const recentSectionsRef = useRef<TranscriptSection[]>([]);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate text similarity between two strings
  const calculateSimilarity = useCallback((text1: string, text2: string): number => {
    if (!text1 || !text2) return 0;
    
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    if (words1.length === 0 && words2.length === 0) return 1;
    if (words1.length === 0 || words2.length === 0) return 0;

    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }, []);

  // Check if a new section is a duplicate of recent sections
  const isDuplicateSection = useCallback((newSection: TranscriptSection): boolean => {
    if (!settings.realTimeDeduplication || recentSectionsRef.current.length === 0) {
      return false;
    }

    // Check against the last 5 sections for duplicates
    const recentSections = recentSectionsRef.current.slice(-5);
    
    for (const existingSection of recentSections) {
      // Skip if same speaker and timestamp (interim/final update)
      if (existingSection.speaker === newSection.speaker && 
          existingSection.timestamp === newSection.timestamp) {
        continue;
      }

      const similarity = calculateSimilarity(existingSection.text, newSection.text);
      
      // Consider it a duplicate if similarity > 80%
      if (similarity > 0.8) {
        console.log(`🚫 Duplicate detected: ${Math.round(similarity * 100)}% similar`);
        console.log(`   Existing: "${existingSection.text.substring(0, 50)}..."`);
        console.log(`   New: "${newSection.text.substring(0, 50)}..."`);
        return true;
      }
    }

    return false;
  }, [settings.realTimeDeduplication, calculateSimilarity]);

  // Clean a section's text using TranscriptCleaner
  const cleanSectionText = useCallback((section: TranscriptSection): TranscriptSection => {
    if (!settings.enabled) return section;

    const cleaningOptions = CLEANING_LEVEL_OPTIONS[settings.cleaningLevel];
    const cleanedText = transcriptCleaner.cleanTranscript(section.text, cleaningOptions);

    return {
      ...section,
      text: cleanedText
    };
  }, [settings.enabled, settings.cleaningLevel]);

  // Add a new transcript section
  const addSection = useCallback((section: TranscriptSection) => {
    // Always add to raw sections
    setRawSections(prev => {
      // Handle interim/final updates
      const existingIndex = prev.findIndex(s => 
        s.speaker === section.speaker && 
        s.timestamp === section.timestamp &&
        !s.isFinal
      );

      if (existingIndex >= 0 && section.isFinal) {
        // Replace interim with final
        const updated = [...prev];
        updated[existingIndex] = section;
        return updated;
      } else if (existingIndex >= 0 && !section.isFinal) {
        // Update existing interim
        const updated = [...prev];
        updated[existingIndex] = section;
        return updated;
      } else {
        // Add new section
        return [...prev, section];
      }
    });

    // Process for cleaned sections with deduplication
    if (settings.enabled && !isDuplicateSection(section)) {
      const cleanedSection = cleanSectionText(section);
      
      setCleanedSections(prev => {
        // Handle interim/final updates for cleaned sections too
        const existingIndex = prev.findIndex(s => 
          s.speaker === cleanedSection.speaker && 
          s.timestamp === cleanedSection.timestamp &&
          !s.isFinal
        );

        let updated: TranscriptSection[];
        if (existingIndex >= 0 && section.isFinal) {
          updated = [...prev];
          updated[existingIndex] = cleanedSection;
        } else if (existingIndex >= 0 && !section.isFinal) {
          updated = [...prev];
          updated[existingIndex] = cleanedSection;
        } else {
          updated = [...prev, cleanedSection];
        }

        return updated;
      });

      // Update recent sections for similarity checking (only final sections)
      if (section.isFinal) {
        recentSectionsRef.current = [...recentSectionsRef.current.slice(-4), section];
      }
    } else if (isDuplicateSection(section)) {
      // Update stats for duplicate removal
      setCleaningStats(prev => ({
        ...prev,
        duplicatesRemoved: prev.duplicatesRemoved + 1,
        bytesReduced: prev.bytesReduced + section.text.length,
        lastCleaningTime: new Date().toISOString()
      }));
    }

    // Update total sections stat
    setCleaningStats(prev => ({
      ...prev,
      totalSections: prev.totalSections + 1
    }));
  }, [settings.enabled, isDuplicateSection, cleanSectionText]);

  // Batch process existing sections with new cleaning level
  const reprocessAllSections = useCallback(() => {
    if (!settings.enabled) {
      setCleanedSections(rawSections);
      return;
    }

    console.log(`🧹 Reprocessing ${rawSections.length} sections with ${settings.cleaningLevel} cleaning...`);
    
    const cleaningOptions = CLEANING_LEVEL_OPTIONS[settings.cleaningLevel];
    const processed: TranscriptSection[] = [];
    const seenTexts = new Set<string>();
    let duplicatesRemoved = 0;
    let bytesReduced = 0;

    for (const section of rawSections) {
      // Clean the text
      const cleanedText = transcriptCleaner.cleanTranscript(section.text, cleaningOptions);
      const cleanedSection = { ...section, text: cleanedText };

      // Check for duplicates if real-time deduplication is enabled
      if (settings.realTimeDeduplication) {
        const normalizedText = cleanedText.toLowerCase().trim();
        
        // Simple duplicate check - can be enhanced with similarity
        let isDuplicate = false;
        for (const existingText of seenTexts) {
          const similarity = calculateSimilarity(normalizedText, existingText);
          if (similarity > 0.8) {
            isDuplicate = true;
            duplicatesRemoved++;
            bytesReduced += section.text.length;
            break;
          }
        }

        if (!isDuplicate) {
          seenTexts.add(normalizedText);
          processed.push(cleanedSection);
        }
      } else {
        processed.push(cleanedSection);
      }
    }

    setCleanedSections(processed);
    setCleaningStats(prev => ({
      ...prev,
      duplicatesRemoved: prev.duplicatesRemoved + duplicatesRemoved,
      bytesReduced: prev.bytesReduced + bytesReduced,
      lastCleaningTime: new Date().toISOString()
    }));

    console.log(`✅ Reprocessing complete: ${processed.length} sections, ${duplicatesRemoved} duplicates removed`);
  }, [rawSections, settings, calculateSimilarity]);

  // Update settings and reprocess if needed
  const updateSettings = useCallback((newSettings: Partial<DeduplicationSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      
      // If cleaning level changed or deduplication was toggled, reprocess
      if (updated.cleaningLevel !== prev.cleaningLevel || 
          updated.realTimeDeduplication !== prev.realTimeDeduplication ||
          updated.enabled !== prev.enabled) {
        // Delay reprocessing to avoid immediate updates
        setTimeout(() => reprocessAllSections(), 100);
      }
      
      return updated;
    });
  }, [reprocessAllSections]);

  // Get the appropriate sections based on settings
  const getSections = useCallback((): TranscriptSection[] => {
    return settings.showRawTranscript ? rawSections : cleanedSections;
  }, [settings.showRawTranscript, rawSections, cleanedSections]);

  // Clear all sections
  const clearSections = useCallback(() => {
    setRawSections([]);
    setCleanedSections([]);
    recentSectionsRef.current = [];
    setCleaningStats({
      totalSections: 0,
      duplicatesRemoved: 0,
      bytesReduced: 0,
      lastCleaningTime: null
    });
  }, []);

  // Get removed segments from the transcript cleaner
  const getRemovedSegments = useCallback((): RemovedSegment[] => {
    return transcriptCleaner.getRemovedSegments();
  }, []);

  return {
    // Data
    sections: getSections(),
    rawSections,
    cleanedSections,
    cleaningStats,
    settings,
    
    // Actions
    addSection,
    updateSettings,
    clearSections,
    reprocessAllSections,
    getRemovedSegments,
    
    // Utilities
    calculateSimilarity,
    isDuplicateSection
  };
};