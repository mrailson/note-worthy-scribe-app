import React, { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { medicalTermCorrector } from "@/utils/MedicalTermCorrector";
import { userNameCorrections } from "@/utils/UserNameCorrections";
import { ChangePreviewItem } from "./ChangePreviewItem";
import { CorrectionManager } from "./CorrectionManager";
import { 
  Search, 
  Replace, 
  Check, 
  X, 
  Settings,
  BookOpen
} from "lucide-react";

export interface PotentialChange {
  id: string;
  originalText: string;
  replacementText: string;
  context: string;
  startIndex: number;
  endIndex: number;
  confidence: 'high' | 'medium' | 'low';
  matchType: 'exact' | 'case' | 'partial';
}

interface EnhancedFindReplacePanelProps {
  getCurrentText: () => string;
  onApply: (updatedText: string) => void;
  /** Optional: Meeting ID for syncing corrections to backend transcripts */
  meetingId?: string;
  /** Optional: Callback to sync corrections to backend transcription tables */
  onTranscriptSync?: (finds: string[], replaceWith: string) => Promise<void>;
}

export default function EnhancedFindReplacePanel({ 
  getCurrentText, 
  onApply,
  meetingId,
  onTranscriptSync
}: EnhancedFindReplacePanelProps) {
  const { toast } = useToast();
  const [findInput, setFindInput] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  const [potentialChanges, setPotentialChanges] = useState<PotentialChange[]>([]);
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());
  const [showCorrectionManager, setShowCorrectionManager] = useState(false);
  const [preserveCase, setPreserveCase] = useState(true);
  const [wholeWordsOnly, setWholeWordsOnly] = useState(true);
  const [saveForFuture, setSaveForFuture] = useState(false);

  // Real-time scanning as user types
  const scanForChanges = useCallback(() => {
    if (!findInput.trim()) {
      setPotentialChanges([]);
      return;
    }

    const text = getCurrentText();
    const changes: PotentialChange[] = [];
    const searchTerm = findInput.trim();
    
    // Create regex based on options
    const flags = "gi";
    const pattern = wholeWordsOnly 
      ? new RegExp(`\\b${escapeRegex(searchTerm)}\\b`, flags)
      : new RegExp(escapeRegex(searchTerm), flags);

    let match;
    while ((match = pattern.exec(text)) !== null) {
      const startIndex = match.index;
      const endIndex = startIndex + match[0].length;
      
      // Get context (50 chars before and after)
      const contextStart = Math.max(0, startIndex - 50);
      const contextEnd = Math.min(text.length, endIndex + 50);
      const context = text.slice(contextStart, contextEnd);
      
      // Determine confidence based on match type
      let confidence: 'high' | 'medium' | 'low' = 'high';
      let matchType: 'exact' | 'case' | 'partial' = 'exact';
      
      if (match[0].toLowerCase() !== searchTerm.toLowerCase()) {
        confidence = 'medium';
        matchType = 'partial';
      } else if (match[0] !== searchTerm) {
        confidence = 'high';
        matchType = 'case';
      }

      changes.push({
        id: `${startIndex}-${endIndex}`,
        originalText: match[0],
        replacementText: preserveCase ? preserveCaseInReplacement(match[0], replaceWith) : replaceWith,
        context,
        startIndex,
        endIndex,
        confidence,
        matchType
      });

      // Prevent infinite loop
      if (!pattern.global) break;
    }

    // Sort by position in text
    changes.sort((a, b) => a.startIndex - b.startIndex);
    setPotentialChanges(changes);
    
    // Auto-select high confidence changes if replace text is provided
    if (replaceWith.trim()) {
      const highConfidenceIds = changes
        .filter(c => c.confidence === 'high')
        .map(c => c.id);
      setSelectedChanges(new Set(highConfidenceIds));
    }
  }, [findInput, replaceWith, getCurrentText, preserveCase, wholeWordsOnly]);

  // Trigger scan when inputs change
  React.useEffect(() => {
    const timer = setTimeout(scanForChanges, 300); // Debounce
    return () => clearTimeout(timer);
  }, [scanForChanges]);

  const handleChangeSelection = (changeId: string, selected: boolean) => {
    setSelectedChanges(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(changeId);
      } else {
        newSet.delete(changeId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allIds = potentialChanges.map(c => c.id);
    setSelectedChanges(new Set(allIds));
  };

  const handleSelectNone = () => {
    setSelectedChanges(new Set());
  };

  const applySelectedChanges = async () => {
    if (selectedChanges.size === 0) return;

    const selectedChangesList = potentialChanges.filter(c => selectedChanges.has(c.id));
    let updatedText = getCurrentText();
    
    // Apply changes in reverse order to maintain indices
    const sortedChanges = [...selectedChangesList].sort((a, b) => b.startIndex - a.startIndex);
    
    for (const change of sortedChanges) {
      updatedText = 
        updatedText.slice(0, change.startIndex) + 
        change.replacementText + 
        updatedText.slice(change.endIndex);
    }

    onApply(updatedText);
    
    // Silently sync corrections to backend transcription tables (non-blocking)
    if (meetingId && onTranscriptSync && findInput.trim() && replaceWith.trim()) {
      // Collect unique original texts from selected changes
      const findTerms = [...new Set(selectedChangesList.map(c => c.originalText))];
      
      // Run in background - don't await, don't block UI
      onTranscriptSync(findTerms, replaceWith.trim())
        .then(() => console.log('[FindReplace] Backend transcript sync completed'))
        .catch(err => console.error('[FindReplace] Backend transcript sync failed:', err));
    }
    
    // Save correction for future if checkbox is ticked
    let savedCorrection = false;
    if (saveForFuture && findInput.trim() && replaceWith.trim()) {
      try {
        await userNameCorrections.addCorrection(findInput.trim(), replaceWith.trim());
        await userNameCorrections.loadCorrections();
        savedCorrection = true;
      } catch (error) {
        console.error("Failed to save correction:", error);
      }
    }
    
    // Clear after applying
    setPotentialChanges([]);
    setSelectedChanges(new Set());
    setFindInput("");
    setSaveForFuture(false);
    
    toast({ 
      title: "Changes Applied", 
      description: savedCorrection 
        ? `Applied ${selectedChanges.size} changes and saved correction for future meetings.`
        : `Applied ${selectedChanges.size} changes to the text.`
    });
  };

  const saveAsCorrection = async () => {
    if (!findInput.trim() || !replaceWith.trim()) return;

    try {
      // Save to user's personal name corrections (persists to database)
      await userNameCorrections.addCorrection(findInput.trim(), replaceWith.trim());
      await userNameCorrections.loadCorrections(); // Refresh cache
      
      toast({ 
        title: "Correction Saved", 
        description: "This correction will be applied automatically to future meetings." 
      });
    } catch (error) {
      toast({ 
        title: "Save Failed", 
        description: "Could not save correction.", 
        variant: "destructive" 
      });
    }
  };

  const preserveCaseInReplacement = (original: string, replacement: string): string => {
    if (!preserveCase) return replacement;
    
    // If original is all uppercase, make replacement uppercase
    if (original === original.toUpperCase()) {
      return replacement.toUpperCase();
    }
    
    // If original is title case, make replacement title case
    if (original[0] === original[0].toUpperCase() && original.slice(1) === original.slice(1).toLowerCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
    }
    
    return replacement;
  };

  return (
    <div className="space-y-4">
      {/* Search Inputs */}
      <div className="space-y-3">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Find
          </Label>
          <Input
            value={findInput}
            onChange={(e) => setFindInput(e.target.value)}
            placeholder="Enter text to find..."
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Replace className="h-4 w-4" />
            Replace with
          </Label>
          <Input
            value={replaceWith}
            onChange={(e) => setReplaceWith(e.target.value)}
            placeholder="Enter replacement text..."
            className="w-full"
          />
        </div>

        {/* Options */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={preserveCase}
              onChange={(e) => setPreserveCase(e.target.checked)}
              className="rounded"
            />
            Preserve case
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={wholeWordsOnly}
              onChange={(e) => setWholeWordsOnly(e.target.checked)}
              className="rounded"
            />
            Whole words only
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saveForFuture}
              onChange={(e) => setSaveForFuture(e.target.checked)}
              className="rounded"
            />
            Save for future meetings
          </label>
        </div>
      </div>

      <Separator />

      {/* Results */}
      {potentialChanges.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              Found {potentialChanges.length} potential {potentialChanges.length === 1 ? 'change' : 'changes'}
            </h3>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSelectAll}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Check className="h-3 w-3" />
                All
              </Button>
              <Button
                onClick={handleSelectNone}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <X className="h-3 w-3" />
                None
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[400px] border rounded-lg">
            <div className="p-2 space-y-2">
              {potentialChanges.map((change) => (
                <ChangePreviewItem
                  key={change.id}
                  change={change}
                  selected={selectedChanges.has(change.id)}
                  onSelectionChange={(selected) => handleChangeSelection(change.id, selected)}
                />
              ))}
            </div>
          </ScrollArea>
          {potentialChanges.length > 3 && (
            <p className="text-xs text-muted-foreground text-center">
              Scroll to see all {potentialChanges.length} matches
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <Button
              onClick={() => setShowCorrectionManager(true)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <BookOpen className="h-3 w-3" />
              Manage Corrections
            </Button>

            <Button
              onClick={applySelectedChanges}
              disabled={selectedChanges.size === 0}
              className="gap-2"
            >
              <Replace className="h-4 w-4" />
              Apply {selectedChanges.size > 0 ? `${selectedChanges.size} ` : ''}Changes
            </Button>
          </div>
        </div>
      )}

      {/* No results message */}
      {findInput.trim() && potentialChanges.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No matches found for "{findInput}"</p>
        </div>
      )}

      {/* Correction Manager Modal */}
      {showCorrectionManager && (
        <CorrectionManager 
          onClose={() => setShowCorrectionManager(false)}
          onCorrectionApplied={(find, replace) => {
            setFindInput(find);
            setReplaceWith(replace);
          }}
        />
      )}
    </div>
  );
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}