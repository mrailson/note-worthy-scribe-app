import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScribeEditStates, ScribeEditContent } from "@/types/scribe";
import { Brain, Copy, Download, Edit, Check, X, Clock, FileText, ListChecks, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface ScribeSummaryPanelProps {
  transcript: string;
  isGenerating: boolean;
  summary: string;
  actionItems: string;
  keyPoints: string;
  editStates: ScribeEditStates;
  editContent: ScribeEditContent;
  recordingDuration?: string;
  onGenerateNotes: () => void;
  onStartEdit: (field: keyof ScribeEditStates) => void;
  onCancelEdit: (field: keyof ScribeEditStates) => void;
  onSaveEdit: (field: keyof ScribeEditStates) => void;
  onEditContentChange: (field: keyof ScribeEditContent, value: string) => void;
  onExportPDF: (content: string, title: string) => void;
  onExportWord: (content: string, title: string) => void;
}

export const ScribeSummaryPanel = ({
  transcript,
  isGenerating,
  summary,
  actionItems,
  keyPoints,
  editStates,
  editContent,
  recordingDuration,
  onGenerateNotes,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditContentChange,
  onExportPDF,
  onExportWord,
}: ScribeSummaryPanelProps) => {
  const [activeSubTab, setActiveSubTab] = useState("summary");
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const renderContentSection = (
    title: string,
    content: string,
    field: keyof ScribeEditStates,
    icon: React.ReactNode
  ) => {
    const isEditing = editStates[field];
    
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
            {content && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => copyToClipboard(content)}
                  variant="outline"
                  size="sm"
                  className="touch-manipulation min-h-[44px]"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => onStartEdit(field)}
                  variant="outline"
                  size="sm"
                  disabled={isEditing}
                  className="touch-manipulation min-h-[44px]"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => onExportPDF(content, title)}
                  variant="outline"
                  size="sm"
                  className="touch-manipulation min-h-[44px]"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={editContent[field]}
                onChange={(e) => onEditContentChange(field, e.target.value)}
                className="min-h-[200px] resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => onCancelEdit(field)}
                  variant="outline"
                  size="sm"
                  className="touch-manipulation min-h-[44px]"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={() => onSaveEdit(field)}
                  size="sm"
                  className="touch-manipulation min-h-[44px]"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <Textarea
              value={content}
              readOnly
              className="min-h-[200px] resize-none"
              placeholder={`No ${title.toLowerCase()} generated yet.`}
            />
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-primary">
              {summary ? "Session Summary" : "Ready to Generate Notes"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {summary ? "AI Generated Notes" : "Record or paste transcript to generate notes"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{recordingDuration || "00:00"}</span>
            <span className="text-xs">{transcript ? transcript.split(' ').filter(w => w.trim()).length : 0} words</span>
          </div>
          {summary && (
            <Badge variant="secondary" className="bg-primary text-primary-foreground">
              Complete
            </Badge>
          )}
        </div>
      </div>

      {/* Generate Notes Button */}
      {!summary && !actionItems && !keyPoints && (
        <Card className="bg-card">
          <CardContent className="py-8">
            <div className="text-center">
              <Button
                onClick={onGenerateNotes}
                disabled={!transcript.trim() || isGenerating}
                className="bg-primary hover:bg-primary/90"
                size="lg"
              >
                <Brain className="h-4 w-4 mr-2" />
                {isGenerating ? 'Generating...' : 'Generate Notes'}
              </Button>
              <p className="text-sm text-muted-foreground mt-3">
                AI will analyse your transcript and generate comprehensive notes
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes Tabs */}
      {(summary || actionItems || keyPoints) && (
        <Card className="bg-card">
          <CardContent className="pt-6">
            <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="summary" className="text-xs">
                  <FileText className="h-4 w-4 mr-1" />
                  Summary
                </TabsTrigger>
                <TabsTrigger value="actions" className="text-xs">
                  <ListChecks className="h-4 w-4 mr-1" />
                  Action Items
                </TabsTrigger>
                <TabsTrigger value="keypoints" className="text-xs">
                  <Lightbulb className="h-4 w-4 mr-1" />
                  Key Points
                </TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                {renderContentSection("Summary", summary, "summary", <FileText className="h-4 w-4" />)}
              </TabsContent>

              <TabsContent value="actions" className="space-y-4">
                {renderContentSection("Action Items", actionItems, "actionItems", <ListChecks className="h-4 w-4" />)}
              </TabsContent>

              <TabsContent value="keypoints" className="space-y-4">
                {renderContentSection("Key Points", keyPoints, "keyPoints", <Lightbulb className="h-4 w-4" />)}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
