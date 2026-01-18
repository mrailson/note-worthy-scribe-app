import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SOAPNote, HeidiNote } from "@/types/scribe";
import { Heart, Copy, Check, Eye, EyeOff, Pencil, X, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  transformToAgeingWell, 
  getAgeingWellText, 
  AGEING_WELL_SECTIONS,
  AgeingWellNote 
} from "@/utils/ageingWellFormatter";

interface AgeingWellViewProps {
  soapNote?: SOAPNote | null;
  heidiNote?: HeidiNote | null;
  showNotMentioned?: boolean;
  onShowNotMentionedChange?: (show: boolean) => void;
  editable?: boolean;
  onSectionChange?: (sectionKey: string, newContent: string) => void;
  consultationId?: string;
}

export const AgeingWellView = ({
  soapNote,
  heidiNote,
  showNotMentioned = false,
  onShowNotMentionedChange,
  editable = false,
  onSectionChange,
  consultationId
}: AgeingWellViewProps) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [localOverrides, setLocalOverrides] = useState<Partial<AgeingWellNote>>({});

  // Transform notes to Ageing Well format
  const baseNote = useMemo(() => 
    transformToAgeingWell(soapNote || null, heidiNote, { showNotMentioned }),
    [soapNote, heidiNote, showNotMentioned]
  );

  // Apply local overrides
  const ageingWellNote = useMemo(() => ({
    ...baseNote,
    ...localOverrides
  }), [baseNote, localOverrides]);

  const copySection = useCallback((sectionKey: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedSection(sectionKey);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedSection(null), 2000);
  }, []);

  const copyAll = useCallback(() => {
    const fullText = getAgeingWellText(ageingWellNote);
    navigator.clipboard.writeText(fullText);
    toast.success("Full note copied to clipboard");
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
      const noContentPatterns = /^(none|n\/a|not applicable|not discussed|nil|-)$/i;
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
                Ageing Well – MDT Review (GP)
                <Badge variant="secondary" className="text-xs font-normal">
                  SystmOne
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Multidisciplinary team review format
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
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
      </CardContent>
    </Card>
  );
};
