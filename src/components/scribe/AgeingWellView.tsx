import { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SOAPNote, HeidiNote } from "@/types/scribe";
import { Heart, Copy, Check, Eye, EyeOff, Pencil, X, Save, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  transformToAgeingWell, 
  getAgeingWellText, 
  AGEING_WELL_SECTIONS,
  AgeingWellNote 
} from "@/utils/ageingWellFormatter";
import { supabase } from "@/integrations/supabase/client";

interface AgeingWellViewProps {
  soapNote?: SOAPNote | null;
  heidiNote?: HeidiNote | null;
  showNotMentioned?: boolean;
  onShowNotMentionedChange?: (show: boolean) => void;
  editable?: boolean;
  onSectionChange?: (sectionKey: string, newContent: string) => void;
  consultationId?: string;
  transcript?: string;
  patientContext?: {
    name?: string;
    age?: string;
    nhsNumber?: string;
  };
}

export const AgeingWellView = ({
  soapNote,
  heidiNote,
  showNotMentioned = false,
  onShowNotMentionedChange,
  editable = false,
  onSectionChange,
  consultationId,
  transcript,
  patientContext
}: AgeingWellViewProps) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [localOverrides, setLocalOverrides] = useState<Partial<AgeingWellNote>>({});
  const [isGeneratingCGA, setIsGeneratingCGA] = useState(false);
  const [cgaNote, setCgaNote] = useState<AgeingWellNote | null>(null);
  const [hasGeneratedCGA, setHasGeneratedCGA] = useState(false);

  // Transform notes to Ageing Well format (fallback)
  const baseNote = useMemo(() => 
    transformToAgeingWell(soapNote || null, heidiNote, { showNotMentioned }),
    [soapNote, heidiNote, showNotMentioned]
  );

  // Use CGA note if available, otherwise fall back to transformation
  const effectiveNote = cgaNote || baseNote;

  // Apply local overrides
  const ageingWellNote = useMemo(() => ({
    ...effectiveNote,
    ...localOverrides
  }), [effectiveNote, localOverrides]);

  // Generate CGA using AI when transcript is available
  const generateCGA = useCallback(async () => {
    if (!transcript || transcript.length < 100) {
      toast.error("Transcript too short for CGA generation");
      return;
    }

    setIsGeneratingCGA(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ageing-well-cga', {
        body: { transcript, patientContext }
      });

      if (error) {
        console.error('CGA generation error:', error);
        toast.error(error.message || 'Failed to generate CGA');
        return;
      }

      if (data?.cgaNote) {
        setCgaNote(data.cgaNote);
        setHasGeneratedCGA(true);
        setLocalOverrides({});
        toast.success("Comprehensive Geriatric Assessment generated");
      }
    } catch (err) {
      console.error('CGA generation error:', err);
      toast.error('Failed to generate CGA');
    } finally {
      setIsGeneratingCGA(false);
    }
  }, [transcript, patientContext]);

  const copySection = useCallback((sectionKey: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedSection(sectionKey);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedSection(null), 2000);
  }, []);

  const copyAll = useCallback(() => {
    const fullText = getAgeingWellText(ageingWellNote);
    navigator.clipboard.writeText(fullText);
    toast.success("Full CGA note copied to clipboard");
  }, [ageingWellNote]);

  const startEditing = useCallback((sectionKey: string, content: string) => {
    setEditingSection(sectionKey);
    setEditContent(content);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingSection(null);
    setEditContent("");
  }, []);

  const saveEditing = useCallback((sectionKey: string) => {
    setLocalOverrides(prev => ({
      ...prev,
      [sectionKey]: editContent
    }));
    
    if (onSectionChange) {
      onSectionChange(sectionKey, editContent);
    }
    
    setEditingSection(null);
    setEditContent("");
    toast.success("Section updated");
  }, [editContent, onSectionChange]);

  // Check if section has content worth showing
  const hasContent = useCallback((content: string): boolean => {
    if (!content) return false;
    const trimmed = content.trim();
    if (!trimmed) return false;
    if (!showNotMentioned) {
      const noContentPatterns = /^(none|n\/a|not applicable|not discussed|nil|-|to be documented\.?)$/i;
      return !noContentPatterns.test(trimmed);
    }
    return true;
  }, [showNotMentioned]);

  // Get sections with content
  const visibleSections = useMemo(() => {
    if (showNotMentioned) return AGEING_WELL_SECTIONS;
    return AGEING_WELL_SECTIONS.filter(section => 
      hasContent(ageingWellNote[section.key as keyof AgeingWellNote] || '')
    );
  }, [ageingWellNote, showNotMentioned, hasContent]);

  return (
    <Card className="border-rose-200 dark:border-rose-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-rose-100 dark:bg-rose-900/30">
              <Heart className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Complex Ageing Well Review – CGA
                <Badge variant="secondary" className="text-xs font-normal">
                  SystmOne / EMIS
                </Badge>
                {hasGeneratedCGA && (
                  <Badge variant="default" className="text-xs font-normal bg-green-600">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Generated
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Comprehensive Geriatric Assessment – 17 Sections
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            {/* Generate CGA Button */}
            {transcript && transcript.length >= 100 && (
              <Button
                variant="outline"
                size="sm"
                onClick={generateCGA}
                disabled={isGeneratingCGA}
                className="gap-1.5"
              >
                {isGeneratingCGA ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating...
                  </>
                ) : hasGeneratedCGA ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerate CGA
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Generate CGA
                  </>
                )}
              </Button>
            )}

            {/* Show/Hide Toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="show-not-mentioned-ageing"
                checked={showNotMentioned}
                onCheckedChange={onShowNotMentionedChange}
              />
              <Label htmlFor="show-not-mentioned-ageing" className="text-xs flex items-center gap-1">
                {showNotMentioned ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {showNotMentioned ? "Showing all" : "Hiding empty"}
              </Label>
            </div>
            
            {/* Copy All Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={copyAll}
              className="gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy All
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isGeneratingCGA ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
            <p className="text-sm text-muted-foreground">
              Generating Comprehensive Geriatric Assessment...
            </p>
            <p className="text-xs text-muted-foreground">
              This may take up to 30 seconds for complex consultations
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(100vh-350px)]">
            <div className="space-y-4 pr-4">
              {visibleSections.map((section) => {
                const content = ageingWellNote[section.key as keyof AgeingWellNote] || '';
                const isEditing = editingSection === section.key;
                const isCopied = copiedSection === section.key;
                
                return (
                  <div
                    key={section.key}
                    className={cn(
                      "rounded-lg border p-4 transition-all",
                      section.borderClass
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-1 rounded text-xs font-semibold",
                          section.colorClass
                        )}>
                          {section.title}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEditing}
                              className="h-7 px-2"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => saveEditing(section.key)}
                              className="h-7 px-2 text-green-600"
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            {editable && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditing(section.key, content)}
                                className="h-7 px-2"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copySection(section.key, content)}
                              className="h-7 px-2"
                            >
                              {isCopied ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {isEditing ? (
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[100px] text-sm"
                        placeholder={section.description}
                      />
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                        {content || (
                          <span className="text-muted-foreground italic">
                            {section.description}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
