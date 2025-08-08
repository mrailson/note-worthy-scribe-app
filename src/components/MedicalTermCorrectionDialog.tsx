import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { medicalTermCorrector, MedicalTermCorrection } from "@/utils/MedicalTermCorrector";
import { supabase } from "@/integrations/supabase/client";
import {
  Edit3,
  Plus,
  X,
  Settings,
  BookOpen,
  Trash2,
  Save,
  RotateCcw
} from "lucide-react";

interface MedicalTermCorrectionDialogProps {
  selectedText?: string;
  onCorrectionAdded?: () => void;
}

export const MedicalTermCorrectionDialog = ({
  selectedText,
  onCorrectionAdded
}: MedicalTermCorrectionDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [incorrectTerm, setIncorrectTerm] = useState(selectedText || "");
  const [correctTerm, setCorrectTerm] = useState("");
  const [contextPhrase, setContextPhrase] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [corrections, setCorrections] = useState<MedicalTermCorrection[]>([]);
  const [showExisting, setShowExisting] = useState(false);
  const { toast } = useToast();

  const loadUserCorrections = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error } = await supabase
        .from('medical_term_corrections')
        .select('*')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCorrections(data || []);
    } catch (error) {
      console.error('Error loading corrections:', error);
      toast({
        title: "Error",
        description: "Failed to load your corrections",
        variant: "destructive",
      });
    }
  };

  const handleSaveCorrection = async () => {
    if (!incorrectTerm.trim() || !correctTerm.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both the incorrect term and correct term",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const success = await medicalTermCorrector.addCorrection(
        incorrectTerm.trim(),
        correctTerm.trim(),
        contextPhrase.trim() || undefined
      );

      if (success) {
        toast({
          title: "Correction Added",
          description: `"${incorrectTerm}" will now be corrected to "${correctTerm}"`,
        });

        // Clear form
        setIncorrectTerm("");
        setCorrectTerm("");
        setContextPhrase("");

        // Refresh corrections list
        await loadUserCorrections();

        // Refresh the corrector
        const { data: user } = await supabase.auth.getUser();
        if (user.user) {
          await medicalTermCorrector.refreshCorrections(user.user.id);
        }

        onCorrectionAdded?.();
        setIsOpen(false);
      } else {
        toast({
          title: "Error",
          description: "Failed to add correction. It may already exist.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error saving correction:', error);
      toast({
        title: "Error",
        description: "Failed to save correction",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCorrection = async (incorrectTerm: string) => {
    try {
      const success = await medicalTermCorrector.deleteCorrection(incorrectTerm);
      if (success) {
        toast({
          title: "Correction Deleted",
          description: `Removed correction for "${incorrectTerm}"`,
        });
        await loadUserCorrections();

        // Refresh the corrector
        const { data: user } = await supabase.auth.getUser();
        if (user.user) {
          await medicalTermCorrector.refreshCorrections(user.user.id);
        }

        onCorrectionAdded?.();
      }
    } catch (error) {
      console.error('Error deleting correction:', error);
      toast({
        title: "Error",
        description: "Failed to delete correction",
        variant: "destructive",
      });
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      if (selectedText) {
        setIncorrectTerm(selectedText);
      }
      loadUserCorrections();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Medical Terms</span>
          <span className="sm:hidden">Terms</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Medical Term Corrections
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add New Correction Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add New Correction
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="incorrect-term">Incorrect Term (as heard)</Label>
                  <Input
                    id="incorrect-term"
                    placeholder="e.g., cof, ars, pcn"
                    value={incorrectTerm}
                    onChange={(e) => setIncorrectTerm(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="correct-term">Correct Term</Label>
                  <Input
                    id="correct-term"
                    placeholder="e.g., QOF, ARRS, PCN"
                    value={correctTerm}
                    onChange={(e) => setCorrectTerm(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="context-phrase">Context Phrase (optional)</Label>
                <Textarea
                  id="context-phrase"
                  placeholder="Add context about when this correction applies..."
                  value={contextPhrase}
                  onChange={(e) => setContextPhrase(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIncorrectTerm("");
                    setCorrectTerm("");
                    setContextPhrase("");
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Clear
                </Button>
                <Button
                  onClick={handleSaveCorrection}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {isLoading ? "Saving..." : "Save Correction"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Existing Corrections */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit3 className="h-4 w-4" />
                  Your Corrections ({corrections.length})
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowExisting(!showExisting)}
                >
                  {showExisting ? "Hide" : "Show"}
                </Button>
              </CardTitle>
            </CardHeader>

            {showExisting && (
              <CardContent>
                {corrections.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No corrections added yet. Add your first correction above!
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {corrections.map((correction) => (
                      <div
                        key={correction.id}
                        className="flex items-center justify-between p-3 bg-accent/20 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {correction.incorrect_term}
                            </Badge>
                            <span className="text-sm text-muted-foreground">→</span>
                            <Badge variant="default" className="text-xs">
                              {correction.correct_term}
                            </Badge>
                            {correction.usage_count > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                Used {correction.usage_count}x
                              </Badge>
                            )}
                          </div>
                          {correction.context_phrase && (
                            <p className="text-xs text-muted-foreground">
                              Context: {correction.context_phrase}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCorrection(correction.incorrect_term)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          <div className="text-xs text-muted-foreground bg-accent/20 p-3 rounded-lg">
            <p className="font-medium mb-2">💡 Tips:</p>
            <ul className="space-y-1 ml-4">
              <li>• Corrections are applied automatically to all future transcripts</li>
              <li>• Use exact terms as they appear in transcripts for best results</li>
              <li>• Common medical abbreviations like QOF, ARRS, PCN are supported</li>
              <li>• Your corrections are private to your account</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
