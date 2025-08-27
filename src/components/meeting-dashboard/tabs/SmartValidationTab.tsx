import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Brain, 
  Zap,
  BookOpen,
  TrendingUp,
  RotateCcw,
  Check,
  X
} from "lucide-react";
import { useDashboard } from "../utils/DashboardContext";
import { cn } from "@/lib/utils";
import { medicalTermCorrector, COMMON_MEDICAL_CORRECTIONS } from "@/utils/MedicalTermCorrector";

interface MeetingData {
  transcript: string;
  duration: number;
  wordCount: number;
  connectionStatus: string;
}

interface SmartValidationTabProps {
  meetingData: MeetingData;
}

interface UncertainTerm {
  id: string;
  original: string;
  suggestions: string[];
  confidence: number;
  context: string;
  position: number;
  frequency: number;
}

interface ValidationStats {
  totalTerms: number;
  correctedTerms: number;
  uncertainTerms: number;
  confidenceImprovement: number;
}

export const SmartValidationTab = ({ meetingData }: SmartValidationTabProps) => {
  const { validationCorrections, addCorrection } = useDashboard();
  const [uncertainTerms, setUncertainTerms] = useState<UncertainTerm[]>([]);
  const [validationStats, setValidationStats] = useState<ValidationStats>({
    totalTerms: 0,
    correctedTerms: 0,
    uncertainTerms: 0,
    confidenceImprovement: 0
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Map<string, string>>(new Map());

  const analyzeTranscriptForUncertainTerms = useCallback(async (transcript: string): Promise<UncertainTerm[]> => {
    if (!transcript.trim()) return [];

    const words = transcript.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    const wordFrequency = new Map<string, number>();
    const wordPositions = new Map<string, number[]>();
    
    words.forEach((word, index) => {
      wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
      if (!wordPositions.has(word)) {
        wordPositions.set(word, []);
      }
      wordPositions.get(word)?.push(index);
    });

    const uncertainTerms: UncertainTerm[] = [];
    let id = 1;

    for (const [word, frequency] of wordFrequency.entries()) {
      // Skip common words
      if (word.length < 4 || /^(the|and|for|are|but|not|you|all|can|had|her|was|one|our|out|day|get|has|him|his|how|its|may|new|now|old|see|two|way|who|boy|did|she|use|her|many|some|what|with|have|from|they|know|want|been|good|much|came|even|also|back|after|came|every|just|name|over|think|where|before|great|right|still|through|turn|three|years|work|life|never|world|down|found|might|away|would|about|people|other|there|their|which|write|more|than|first|could|order|because|does|must|should|while|these|those|said|each|different|well|large|another|little|house|again|home|still|place|around|during|follow|came|help|here|move|play|such|point|end|why|asked|went|men|read|need|land|means)$/i.test(word)) {
        continue;
      }

      let suggestions: string[] = [];
      let confidence = 1.0;
      let isUncertain = false;

      // Check if word exists in common medical corrections
      if (COMMON_MEDICAL_CORRECTIONS.has(word)) {
        suggestions = [COMMON_MEDICAL_CORRECTIONS.get(word)!];
        confidence = 0.3;
        isUncertain = true;
      } else {
        // Get suggestions from medical term corrector
        const correctorSuggestions = medicalTermCorrector.getSuggestions(word);
        if (correctorSuggestions.length > 0) {
          suggestions = correctorSuggestions.map(s => s.correct).slice(0, 3);
          confidence = 0.4;
          isUncertain = true;
        } else {
          // Check for potential misspellings using simple heuristics
          const commonMedicalPatterns = [
            /tion$/i, /sion$/i, /osis$/i, /itis$/i, /emia$/i, /uria$/i,
            /^anti/i, /^pre/i, /^post/i, /^sub/i, /^inter/i
          ];
          
          const hasTypicalMedicalEnding = commonMedicalPatterns.some(pattern => pattern.test(word));
          
          if (hasTypicalMedicalEnding || word.includes('ph') || word.includes('th') || word.includes('ch')) {
            // Generate simple spelling suggestions based on common mistakes
            suggestions = generateSpellingSuggestions(word);
            if (suggestions.length > 0) {
              confidence = 0.6;
              isUncertain = true;
            }
          }
        }
      }

      if (isUncertain && suggestions.length > 0) {
        const positions = wordPositions.get(word) || [];
        const contextStart = Math.max(0, positions[0] - 5);
        const contextEnd = Math.min(words.length, positions[0] + 6);
        const context = words.slice(contextStart, contextEnd).join(' ');

        uncertainTerms.push({
          id: id.toString(),
          original: word,
          suggestions,
          confidence,
          context: `...${context}...`,
          position: positions[0] * 6, // Approximate character position
          frequency
        });
        id++;
      }
    }

    return uncertainTerms.slice(0, 10); // Limit to 10 most relevant terms
  }, []);

  const generateSpellingSuggestions = (word: string): string[] => {
    const suggestions: string[] = [];
    
    // Common medical term corrections
    const commonReplacements = new Map([
      ['ph', 'f'], ['f', 'ph'], ['th', 't'], ['tion', 'sion'], 
      ['sion', 'tion'], ['c', 'k'], ['k', 'c']
    ]);
    
    for (const [from, to] of commonReplacements) {
      if (word.includes(from)) {
        suggestions.push(word.replace(new RegExp(from, 'g'), to));
      }
    }
    
    return suggestions.filter(s => s !== word).slice(0, 3);
  };

  // Real uncertain terms detection
  useEffect(() => {
    if (!meetingData.transcript) return;

    const analyzeTerms = async () => {
      setIsProcessing(true);
      try {
        await medicalTermCorrector.loadCorrections();
        const detectedTerms = await analyzeTranscriptForUncertainTerms(meetingData.transcript);
        setUncertainTerms(detectedTerms);
        
        // Calculate real stats
        const totalWords = meetingData.transcript.split(/\s+/).length;
        setValidationStats({
          totalTerms: totalWords,
          correctedTerms: validationCorrections.size,
          uncertainTerms: detectedTerms.length,
          confidenceImprovement: Math.round((validationCorrections.size / Math.max(detectedTerms.length, 1)) * 20)
        });
      } catch (error) {
        console.error('Error analyzing transcript:', error);
      } finally {
        setIsProcessing(false);
      }
    };

    analyzeTerms();
  }, [meetingData.transcript, validationCorrections.size, analyzeTranscriptForUncertainTerms]);

  const handleSuggestionSelect = (termId: string, suggestion: string) => {
    setSelectedSuggestions(prev => new Map(prev.set(termId, suggestion)));
  };

  const applyCorrection = (term: UncertainTerm, correction: string) => {
    addCorrection(term.original, correction);
    setUncertainTerms(prev => prev.filter(t => t.id !== term.id));
  };

  const applySuggestion = (term: UncertainTerm) => {
    const selectedSuggestion = selectedSuggestions.get(term.id);
    if (selectedSuggestion) {
      applyCorrection(term, selectedSuggestion);
      setSelectedSuggestions(prev => {
        const newMap = new Map(prev);
        newMap.delete(term.id);
        return newMap;
      });
    }
  };

  const dismissTerm = (termId: string) => {
    setUncertainTerms(prev => prev.filter(t => t.id !== termId));
  };

  const runSmartValidation = async () => {
    if (!meetingData.transcript) return;
    
    setIsProcessing(true);
    try {
      await medicalTermCorrector.refreshCorrections();
      const detectedTerms = await analyzeTranscriptForUncertainTerms(meetingData.transcript);
      setUncertainTerms(detectedTerms);
      
      const totalWords = meetingData.transcript.split(/\s+/).length;
      setValidationStats(prev => ({
        ...prev,
        uncertainTerms: detectedTerms.length,
        confidenceImprovement: Math.round((validationCorrections.size / Math.max(detectedTerms.length, 1)) * 20)
      }));
    } catch (error) {
      console.error('Error re-analyzing transcript:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const applyAllSuggestions = () => {
    uncertainTerms.forEach(term => {
      if (term.suggestions.length > 0) {
        applyCorrection(term, term.suggestions[0]);
      }
    });
    setUncertainTerms([]);
    setSelectedSuggestions(new Map());
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Processed</span>
              </div>
              <div className="text-lg font-bold">{validationStats.totalTerms}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">Corrected</span>
              </div>
              <div className="text-lg font-bold">{validationStats.correctedTerms}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-sm font-medium">Uncertain</span>
              </div>
              <div className="text-lg font-bold">{validationStats.uncertainTerms}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">Improvement</span>
              </div>
              <div className="text-lg font-bold">+{validationStats.confidenceImprovement}%</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Smart Validation Engine
            </div>
            <div className="flex items-center gap-2">
              {uncertainTerms.length > 0 && (
                <Button variant="outline" size="sm" onClick={applyAllSuggestions}>
                  <Check className="h-4 w-4 mr-2" />
                  Apply All Top Suggestions
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={runSmartValidation}
                disabled={isProcessing}
              >
                <RotateCcw className={cn("h-4 w-4 mr-2", isProcessing && "animate-spin")} />
                Re-analyze
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            AI-powered term validation with medical context awareness and self-learning capabilities
          </div>
        </CardContent>
      </Card>

      {/* Uncertain Terms */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Terms Requiring Attention ({uncertainTerms.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {uncertainTerms.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-success" />
              <p>All terms validated successfully!</p>
              <p className="text-sm">No uncertain terms detected in the transcript.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {uncertainTerms.map((term) => (
                <div key={term.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="destructive" className="text-sm">
                          {term.original}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {Math.round(term.confidence * 100)}% confidence
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Used {term.frequency}x
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Context: "{term.context}"
                      </p>
                      
                      <div className="space-y-2">
                        <div className="text-sm font-medium">AI Suggestions:</div>
                        <div className="flex flex-wrap gap-2">
                          {term.suggestions.map((suggestion, index) => (
                            <Button
                              key={suggestion}
                              variant={selectedSuggestions.get(term.id) === suggestion ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleSuggestionSelect(term.id, suggestion)}
                              className="text-xs"
                            >
                              {suggestion}
                              {index === 0 && <Badge className="ml-2 text-xs">Best</Badge>}
                            </Button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-3">
                        <Input
                          placeholder="Custom correction..."
                          className="text-sm h-8"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const value = (e.target as HTMLInputElement).value;
                              if (value.trim()) {
                                applyCorrection(term, value.trim());
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 ml-4">
                      {selectedSuggestions.has(term.id) && (
                        <Button size="sm" onClick={() => applySuggestion(term)}>
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => dismissTerm(term.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <Progress value={term.confidence * 100} className="h-2" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Learned Corrections */}
      {validationCorrections.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-success" />
              Learned Corrections ({validationCorrections.size})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Array.from(validationCorrections.entries()).map(([incorrect, correct]) => (
                <div key={incorrect} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-destructive">
                    {incorrect}
                  </Badge>
                  <span>→</span>
                  <Badge variant="outline" className="text-success">
                    {correct}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};