import { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SOAPNote, HeidiNote } from "@/types/scribe";
import { Heart, Copy, Eye, EyeOff, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  transformToAgeingWell, 
  getAgeingWellText, 
  AGEING_WELL_SECTIONS,
  AgeingWellNote 
} from "@/utils/ageingWellFormatter";
import { supabase } from "@/integrations/supabase/client";
import AgeingWellSectionEditor, { ClinicalAIAction } from "./AgeingWellSectionEditor";

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
  const [localOverrides, setLocalOverrides] = useState<Partial<AgeingWellNote>>({});
  const [isGeneratingCGA, setIsGeneratingCGA] = useState(false);
  const [cgaNote, setCgaNote] = useState<AgeingWellNote | null>(null);
  const [hasGeneratedCGA, setHasGeneratedCGA] = useState(false);

  // Load CGA notes from database on mount
  useEffect(() => {
    const loadCGANotes = async () => {
      if (!consultationId) return;
      
      try {
        const { data, error } = await supabase
          .from('gp_consultation_notes')
          .select('cga_notes')
          .eq('consultation_id', consultationId)
          .maybeSingle();
        
        if (error) {
          console.error('Error loading CGA notes:', error);
          return;
        }
        
        if (data?.cga_notes) {
          console.log('Loaded CGA notes from database');
          setCgaNote(data.cga_notes as unknown as AgeingWellNote);
          setHasGeneratedCGA(true);
        }
      } catch (err) {
        console.error('Error loading CGA notes:', err);
      }
    };
    
    loadCGANotes();
  }, [consultationId]);

  // Save CGA notes to database
  const saveCGANotes = useCallback(async (notes: AgeingWellNote) => {
    if (!consultationId) {
      console.warn('No consultationId, cannot save CGA notes');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('gp_consultation_notes')
        .update({ cga_notes: JSON.parse(JSON.stringify(notes)) })
        .eq('consultation_id', consultationId);
      
      if (error) {
        console.error('Error saving CGA notes:', error);
      } else {
        console.log('CGA notes saved to database');
      }
    } catch (err) {
      console.error('Error saving CGA notes:', err);
    }
  }, [consultationId]);

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
        
        // Save to database
        await saveCGANotes(data.cgaNote);
        
        toast.success("Comprehensive Geriatric Assessment generated");
      }
    } catch (err) {
      console.error('CGA generation error:', err);
      toast.error('Failed to generate CGA');
    } finally {
      setIsGeneratingCGA(false);
    }
  }, [transcript, patientContext, saveCGANotes]);

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

  // Handle AI action for a section
  const handleSectionAIAction = useCallback(async (
    sectionKey: string, 
    action: ClinicalAIAction
  ): Promise<string> => {
    const content = ageingWellNote[sectionKey as keyof AgeingWellNote] || '';
    
    // Build context from adjacent sections for better AI understanding
    const sectionIndex = AGEING_WELL_SECTIONS.findIndex(s => s.key === sectionKey);
    const contextSections = AGEING_WELL_SECTIONS
      .filter((_, idx) => Math.abs(idx - sectionIndex) <= 2 && idx !== sectionIndex)
      .slice(0, 3)
      .map(s => {
        const sectionContent = ageingWellNote[s.key as keyof AgeingWellNote] || '';
        return sectionContent ? `${s.title}: ${sectionContent}` : '';
      })
      .filter(Boolean)
      .join('\n\n');
    
    const { data, error } = await supabase.functions.invoke('ai-line-transform', {
      body: {
        consultationId,
        lineContent: content,
        action,
        context: contextSections,
        contextType: 'clinical',
      },
    });
    
    if (error) throw error;
    
    const transformedContent = data?.transformedContent || data?.transformedText || '';
    
    // Update local state with the new content
    if (transformedContent) {
      setLocalOverrides(prev => ({
        ...prev,
        [sectionKey]: transformedContent
      }));
      
      if (onSectionChange) {
        onSectionChange(sectionKey, transformedContent);
      }
    }
    
    return transformedContent;
  }, [ageingWellNote, consultationId, onSectionChange]);

  // Handle section update (manual edit)
  const handleSectionUpdate = useCallback((sectionKey: string, newContent: string) => {
    const updatedNote = {
      ...ageingWellNote,
      [sectionKey]: newContent
    };
    
    setLocalOverrides(prev => ({
      ...prev,
      [sectionKey]: newContent
    }));
    
    // Persist to database
    saveCGANotes(updatedNote);
    
    if (onSectionChange) {
      onSectionChange(sectionKey, newContent);
    }
    
    toast.success("Section updated");
  }, [ageingWellNote, saveCGANotes, onSectionChange]);

  // Handle section delete (clear content)
  const handleSectionDelete = useCallback((sectionKey: string) => {
    setLocalOverrides(prev => ({
      ...prev,
      [sectionKey]: ''
    }));
    
    if (onSectionChange) {
      onSectionChange(sectionKey, '');
    }
  }, [onSectionChange]);

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
          <div className="space-y-4">
              {visibleSections.map((section) => {
                const content = ageingWellNote[section.key as keyof AgeingWellNote] || '';
                const isCopied = copiedSection === section.key;
                
                return (
                  <AgeingWellSectionEditor
                    key={section.key}
                    sectionKey={section.key}
                    sectionTitle={section.title}
                    content={content}
                    colorClass={section.colorClass}
                    borderClass={section.borderClass}
                    description={section.description}
                    editable={editable}
                    onUpdate={(newContent) => handleSectionUpdate(section.key, newContent)}
                    onDelete={() => handleSectionDelete(section.key)}
                    onAIAction={(action) => handleSectionAIAction(section.key, action)}
                    onCopy={() => copySection(section.key, content)}
                    isCopied={isCopied}
                  />
                );
              })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
