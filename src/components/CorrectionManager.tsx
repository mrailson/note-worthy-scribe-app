import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { medicalTermCorrector, type MedicalTermCorrection } from "@/utils/MedicalTermCorrector";
import { 
  Trash2, 
  Search, 
  Plus, 
  BookOpen, 
  TrendingUp,
  Filter,
  RotateCcw
} from "lucide-react";

interface CorrectionManagerProps {
  onClose: () => void;
  onCorrectionApplied?: (find: string, replace: string) => void;
}

export function CorrectionManager({ onClose, onCorrectionApplied }: CorrectionManagerProps) {
  const { toast } = useToast();
  const [corrections, setCorrections] = useState<MedicalTermCorrection[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [newIncorrect, setNewIncorrect] = useState("");
  const [newCorrect, setNewCorrect] = useState("");
  const [newContext, setNewContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'usage' | 'alphabetical' | 'recent'>('usage');

  useEffect(() => {
    loadCorrections();
  }, []);

  const loadCorrections = async () => {
    setLoading(true);
    try {
      // This would be enhanced to load from the database
      // For now, we'll get the in-memory corrections
      const correctionMap = medicalTermCorrector.getCorrections();
      const correctionsList: MedicalTermCorrection[] = Array.from(correctionMap.entries()).map(([incorrect, correct], index) => ({
        id: `${index}`,
        incorrect_term: incorrect,
        correct_term: correct,
        context_phrase: '',
        usage_count: 0,
        is_global: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      
      setCorrections(correctionsList);
    } catch (error) {
      toast({
        title: "Load Failed",
        description: "Could not load corrections.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addCorrection = async () => {
    if (!newIncorrect.trim() || !newCorrect.trim()) return;

    try {
      const success = await medicalTermCorrector.addCorrection(
        newIncorrect.trim(),
        newCorrect.trim(),
        newContext.trim() || undefined
      );

      if (success) {
        await medicalTermCorrector.refreshCorrections();
        await loadCorrections();
        
        setNewIncorrect("");
        setNewCorrect("");
        setNewContext("");
        
        toast({
          title: "Correction Added",
          description: `Added: "${newIncorrect}" → "${newCorrect}"`
        });
      }
    } catch (error) {
      toast({
        title: "Add Failed",
        description: "Could not add correction.",
        variant: "destructive"
      });
    }
  };

  const deleteCorrection = async (incorrectTerm: string) => {
    try {
      const success = await medicalTermCorrector.deleteCorrection(incorrectTerm);
      
      if (success) {
        await medicalTermCorrector.refreshCorrections();
        await loadCorrections();
        
        toast({
          title: "Correction Deleted",
          description: `Deleted correction for: "${incorrectTerm}"`
        });
      }
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Could not delete correction.",
        variant: "destructive"
      });
    }
  };

  const applyCorrection = (incorrect: string, correct: string) => {
    if (onCorrectionApplied) {
      onCorrectionApplied(incorrect, correct);
      onClose();
    }
  };

  const filteredCorrections = corrections
    .filter(c => 
      c.incorrect_term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.correct_term.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'usage':
          return b.usage_count - a.usage_count;
        case 'alphabetical':
          return a.incorrect_term.localeCompare(b.incorrect_term);
        case 'recent':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        default:
          return 0;
      }
    });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Correction Library
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Add New Correction */}
          <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <Plus className="h-4 w-4" />
              <h3 className="font-medium">Add New Correction</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Find (incorrect)</label>
                <Input
                  value={newIncorrect}
                  onChange={(e) => setNewIncorrect(e.target.value)}
                  placeholder="e.g., docter"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Replace with (correct)</label>
                <Input
                  value={newCorrect}
                  onChange={(e) => setNewCorrect(e.target.value)}
                  placeholder="e.g., Doctor"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Context (optional)</label>
              <Input
                value={newContext}
                onChange={(e) => setNewContext(e.target.value)}
                placeholder="e.g., medical professional"
              />
            </div>
            
            <Button 
              onClick={addCorrection}
              disabled={!newIncorrect.trim() || !newCorrect.trim()}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Correction
            </Button>
          </div>

          <Separator />

          {/* Search and Filter */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search corrections..."
                className="pl-10"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="border rounded px-3 py-2 text-sm bg-background"
              >
                <option value="usage">By Usage</option>
                <option value="alphabetical">Alphabetical</option>
                <option value="recent">Most Recent</option>
              </select>
            </div>

            <Button
              onClick={loadCorrections}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RotateCcw className="h-3 w-3" />
              Refresh
            </Button>
          </div>

          {/* Corrections List */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-2 pr-4">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading corrections...
                  </div>
                ) : filteredCorrections.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No corrections found</p>
                    {searchTerm && <p className="text-sm">Try adjusting your search</p>}
                  </div>
                ) : (
                  filteredCorrections.map((correction) => (
                    <div 
                      key={correction.id}
                      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                              {correction.incorrect_term}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-mono text-sm px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                              {correction.correct_term}
                            </span>
                          </div>
                          
                          {correction.context_phrase && (
                            <p className="text-xs text-muted-foreground">
                              Context: {correction.context_phrase}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Used {correction.usage_count} times
                            </Badge>
                            {correction.is_global && (
                              <Badge variant="outline" className="text-xs">
                                Global
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {onCorrectionApplied && (
                            <Button
                              onClick={() => applyCorrection(correction.incorrect_term, correction.correct_term)}
                              variant="outline"
                              size="sm"
                            >
                              Apply
                            </Button>
                          )}
                          <Button
                            onClick={() => deleteCorrection(correction.incorrect_term)}
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}