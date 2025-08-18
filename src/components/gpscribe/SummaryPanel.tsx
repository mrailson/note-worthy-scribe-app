import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { EditStates, EditContent, ExpandDialog } from "@/types/gpscribe";
import { Brain, Copy, Download, Edit, Check, X, Maximize2, Mail, FileText, Clock, MessageSquare, UserCheck, AlertTriangle, ChevronUp, ChevronDown, Mic, Send, Loader2, Bold, Italic, Underline } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { supabase } from "@/integrations/supabase/client";

interface SummaryPanelProps {
  transcript: string;
  isGenerating: boolean;
  gpSummary: string;
  gpShorthand: string;
  standardDetail: string;
  fullNote: string;
  patientCopy: string;
  traineeFeedback: string;
  referralLetter: string;
  editStates: EditStates;
  editContent: EditContent;
  expandDialog: ExpandDialog;
  onGenerateSummary: () => void;
  onGenerateReferralLetter: () => void;
  onStartEdit: (field: keyof EditStates) => void;
  onCancelEdit: (field: keyof EditStates) => void;
  onSaveEdit: (field: keyof EditStates) => void;
  onEditContentChange: (field: keyof EditContent, value: string) => void;
  onExportPDF: (content: string, title: string) => void;
  onExportWord: (content: string, title: string) => void;
  onExpandContent: (title: string, content: string) => void;
  onCloseExpandDialog: () => void;
  onUpdateMainSummary?: (content: string, isStandardDetail: boolean) => void;
  onGeneratePatientEmail?: () => void;
}

export const SummaryPanel = ({
  transcript,
  isGenerating,
  gpSummary,
  gpShorthand,
  standardDetail,
  fullNote,
  patientCopy,
  traineeFeedback,
  referralLetter,
  editStates,
  editContent,
  expandDialog,
  onGenerateSummary,
  onGenerateReferralLetter,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditContentChange,
  onExportPDF,
  onExportWord,
  onExpandContent,
  onCloseExpandDialog,
  onUpdateMainSummary
}: SummaryPanelProps) => {
  const [activeSubTab, setActiveSubTab] = useState("summary");
  const [showTranscript, setShowTranscript] = useState(false);
  const [isStandardDetail, setIsStandardDetail] = useState(false);
  
  // Main summary editing state
  const [isEditingMainSummary, setIsEditingMainSummary] = useState(false);
  const [editedSummaryContent, setEditedSummaryContent] = useState("");
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null);
  
  // Patient email state
  const [patientEmail, setPatientEmail] = useState("");
  const [isGeneratingPatientEmail, setIsGeneratingPatientEmail] = useState(false);
  
  // Ask AI state
  const [isAskAIOpen, setIsAskAIOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAILoading, setIsAILoading] = useState(false);
  
  // Voice recording
  const { isRecording, toggleRecording } = useVoiceRecording();
  
  const handleAskAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Please enter a question or request");
      return;
    }
    
    setIsAILoading(true);
    try {
      // Here you would call your AI service
      // For now, just show a success message
      toast.success("AI request submitted");
      setAiPrompt("");
      setIsAskAIOpen(false);
    } catch (error) {
      toast.error("Failed to process AI request");
    } finally {
      setIsAILoading(false);
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleStartMainEdit = () => {
    const currentContent = isStandardDetail ? standardDetail : gpShorthand;
    setEditedSummaryContent(currentContent);
    setIsEditingMainSummary(true);
  };

  const handleSaveMainEdit = () => {
    if (onUpdateMainSummary) {
      onUpdateMainSummary(editedSummaryContent, isStandardDetail);
    }
    toast.success("Summary updated successfully");
    setIsEditingMainSummary(false);
  };

  const handleCancelMainEdit = () => {
    setIsEditingMainSummary(false);
    setEditedSummaryContent("");
  };

  const applyFormat = (formatType: 'bold' | 'italic' | 'underline') => {
    if (!textareaRef) {
      toast.error("Please click in the text area first");
      return;
    }

    const start = textareaRef.selectionStart;
    const end = textareaRef.selectionEnd;
    const selectedText = editedSummaryContent.substring(start, end);

    if (selectedText.trim() === '') {
      toast.error("Please select some text to format");
      return;
    }

    let formattedText = '';
    switch (formatType) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'underline':
        formattedText = `<u>${selectedText}</u>`;
        break;
    }

    const newContent = 
      editedSummaryContent.substring(0, start) + 
      formattedText + 
      editedSummaryContent.substring(end);

    setEditedSummaryContent(newContent);
    
    // Restore focus and selection
    setTimeout(() => {
      textareaRef.focus();
      const newCursorPos = start + formattedText.length;
      textareaRef.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const generatePatientEmail = async () => {
    if (!transcript.trim()) {
      toast.error("No transcript available to generate patient email");
      return;
    }

    setIsGeneratingPatientEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-patient-email', {
        body: {
          transcript: transcript,
          consultationType: "General Consultation"
        }
      });

      if (error) {
        console.error('Error generating patient email:', error);
        toast.error("Failed to generate patient email");
        return;
      }

      if (data?.emailContent) {
        setPatientEmail(data.emailContent);
        toast.success("Patient email generated successfully");
      } else {
        toast.error("No email content received");
      }
    } catch (error) {
      console.error('Error calling patient email function:', error);
      toast.error("Failed to generate patient email");
    } finally {
      setIsGeneratingPatientEmail(false);
    }
  };

  const renderContentSection = (
    title: string,
    content: string,
    field: keyof EditStates,
    showEmailButton = false
  ) => {
    const isEditing = editStates[field];
    
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{title}</CardTitle>
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
                  onClick={() => onExpandContent(title, content)}
                  variant="outline"
                  size="sm"
                  className="touch-manipulation min-h-[44px]"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => onExportPDF(content, title)}
                  variant="outline"
                  size="sm"
                  className="touch-manipulation min-h-[44px]"
                >
                  <Download className="h-4 w-4" />
                </Button>
                {showEmailButton && (
                  <Button
                    onClick={() => onExportWord(content, title)}
                    variant="outline"
                    size="sm"
                    className="touch-manipulation min-h-[44px]"
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                )}
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
                  className="bg-gradient-primary hover:bg-primary-hover touch-manipulation min-h-[44px]"
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
      {/* Header with consultation type and timer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-primary">Upper Respiratory Tract Infection</h2>
            <p className="text-sm text-muted-foreground">Training Example</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>05:00</span>
            <span className="text-xs">345 words</span>
          </div>
          <Badge variant="secondary" className="bg-primary text-primary-foreground">
            Acute Illness
          </Badge>
        </div>
      </div>

      {/* Main Content Area with Tabs */}
      <Card className="bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Consultation Notes</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="summary" className="text-xs">
                <UserCheck className="h-4 w-4 mr-1" />
                Consultation Summary
              </TabsTrigger>
              <TabsTrigger value="patient" className="text-xs">
                <FileText className="h-4 w-4 mr-1" />
                Patient Copy
              </TabsTrigger>
              <TabsTrigger value="referral" className="text-xs">
                <Mail className="h-4 w-4 mr-1" />
                Referral
              </TabsTrigger>
              <TabsTrigger value="review" className="text-xs">
                <AlertTriangle className="h-4 w-4 mr-1" />
                Review & Recommendations
              </TabsTrigger>
            </TabsList>

            {/* Action buttons below tabs */}
            <div className="flex justify-end items-center mb-4">
              <div className="flex items-center gap-2">
              </div>
            </div>

            <TabsContent value="summary" className="space-y-4">
              <div className="space-y-4">
                {/* Format Toggle - Only in Summary Tab */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Label className="text-sm font-medium">Format:</Label>
                    <div className="flex items-center gap-3">
                      <Label 
                        htmlFor="summary-format" 
                        className={`text-sm transition-colors ${!isStandardDetail ? 'text-primary font-medium' : 'text-muted-foreground'}`}
                      >
                        GP Shorthand
                      </Label>
                      <Switch
                        id="summary-format"
                        checked={isStandardDetail}
                        onCheckedChange={setIsStandardDetail}
                        className="data-[state=checked]:bg-primary"
                      />
                      <Label 
                        htmlFor="summary-format" 
                        className={`text-sm transition-colors ${isStandardDetail ? 'text-primary font-medium' : 'text-muted-foreground'}`}
                      >
                        Standard Detail
                      </Label>
                    </div>
                  </div>
                </div>

                {!gpShorthand && !standardDetail ? (
                  <div className="text-center py-8">
                    <Button
                      onClick={onGenerateSummary}
                      disabled={!transcript.trim() || isGenerating}
                      className="bg-gradient-primary hover:bg-primary-hover"
                      size="lg"
                    >
                      <Brain className="h-4 w-4 mr-2" />
                      {isGenerating ? 'Generating...' : 'Generate Notes'}
                    </Button>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <div className="p-4 bg-card rounded-lg border relative group">
                      {!isEditingMainSummary && (
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <Button
                            onClick={() => copyToClipboard(isStandardDetail ? standardDetail : gpShorthand)}
                            variant="outline"
                            size="sm"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={handleStartMainEdit}
                            disabled={isEditingMainSummary}
                            variant="outline"
                            size="sm"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => onExportWord(isStandardDetail ? standardDetail : gpShorthand, "Consultation Summary")}
                            disabled={!(isStandardDetail ? standardDetail : gpShorthand)}
                            variant="outline"
                            size="sm"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => setIsAskAIOpen(!isAskAIOpen)}
                            variant="outline"
                            size="sm"
                            className={isAskAIOpen ? "bg-primary/10" : ""}
                          >
                            <Brain className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      
                      {isEditingMainSummary ? (
                        <div className="space-y-3">
                          {/* Formatting Toolbar */}
                          <div className="flex items-center gap-1 p-2 bg-muted/30 rounded-lg border">
                            <span className="text-xs text-muted-foreground mr-2">Format:</span>
                            <Button
                              onClick={() => applyFormat('bold')}
                              variant="outline"
                              size="sm"
                              className="h-8 px-2"
                            >
                              <Bold className="h-3 w-3" />
                            </Button>
                            <Button
                              onClick={() => applyFormat('italic')}
                              variant="outline"
                              size="sm"
                              className="h-8 px-2"
                            >
                              <Italic className="h-3 w-3" />
                            </Button>
                            <Button
                              onClick={() => applyFormat('underline')}
                              variant="outline"
                              size="sm"
                              className="h-8 px-2"
                            >
                              <Underline className="h-3 w-3" />
                            </Button>
                          </div>
                          <Textarea
                            ref={(ref) => setTextareaRef(ref)}
                            value={editedSummaryContent}
                            onChange={(e) => setEditedSummaryContent(e.target.value)}
                            className="min-h-[300px] resize-none text-sm"
                            placeholder="Edit your consultation summary..."
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              onClick={handleCancelMainEdit}
                              variant="outline"
                              size="sm"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                            <Button
                              onClick={handleSaveMainEdit}
                              size="sm"
                              className="bg-gradient-primary hover:bg-primary-hover"
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="text-sm leading-relaxed whitespace-pre-wrap font-sans"
                          dangerouslySetInnerHTML={{
                            __html: (isStandardDetail ? standardDetail : gpShorthand)
                              ?.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              ?.replace(/\*(.*?)\*/g, '<em>$1</em>')
                              ?.replace(/^###\s(.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2 text-primary">$1</h3>')
                              ?.replace(/^##\s(.+)$/gm, '<h2 class="text-xl font-semibold mt-4 mb-2 text-primary">$1</h2>')
                              ?.replace(/^-\s(.+)$/gm, '<li class="ml-4">$1</li>')
                              ?.replace(/(<li.*>.*<\/li>)/g, '<ul class="list-disc space-y-1">$1</ul>')
                              ?.replace(/<\/ul>\s*<ul[^>]*>/g, '')
                              || ''
                          }}
                        />
                      )}
                      
                      {/* Ask AI Panel */}
                      {isAskAIOpen && (
                        <div className="mt-4 p-4 bg-muted/30 rounded-lg border">
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                              Ask the AI to analyze your consultation, create referral letters, suggest improvements, or check for missing information.
                            </p>
                            
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <Textarea
                                  value={aiPrompt}
                                  onChange={(e) => setAiPrompt(e.target.value)}
                                  placeholder="Type your question or request..."
                                  className="min-h-[80px] resize-none"
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={toggleRecording}
                                  className={`p-2 ${isRecording ? 'bg-red-500 text-white' : ''}`}
                                >
                                  <Mic className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            
                            {isRecording && (
                              <div className="text-sm text-red-500 animate-pulse">
                                Recording... Speak now
                              </div>
                            )}
                            
                            <div className="flex gap-2 justify-end">
                              <Button variant="outline" size="sm" onClick={() => setIsAskAIOpen(false)}>
                                Cancel
                              </Button>
                              <Button 
                                size="sm" 
                                onClick={handleAskAI}
                                disabled={!aiPrompt.trim() || isAILoading}
                              >
                                {isAILoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <Send className="h-4 w-4 mr-1" />
                                )}
                                Send
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* View Original Transcript button */}
                <div className="mt-6 pt-4 border-t">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-muted-foreground"
                    onClick={() => setShowTranscript(!showTranscript)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Original Transcript
                    <span className="ml-auto text-xs">{showTranscript ? 'Hide' : 'Show'}</span>
                  </Button>
                  
                  {showTranscript && (
                    <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                      <h4 className="text-sm font-medium mb-2">Original Transcript</h4>
                      <Textarea
                        value={transcript}
                        readOnly
                        className="min-h-[200px] resize-none text-sm font-mono"
                        placeholder="No transcript available"
                      />
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="patient" className="space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="justify-start">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    SMS (50 words)
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={generatePatientEmail}
                    disabled={isGeneratingPatientEmail || !transcript.trim()}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {isGeneratingPatientEmail ? "Generating..." : "Email Format"}
                  </Button>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-primary">SMS Short Summary</h4>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => copyToClipboard(patientCopy || "Hi, thank you for your consultation. You have a common cold (viral upper respiratory tract infection). Contact us with any concerns.")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Maximum 50 words for text message</p>
                  <div className="p-3 bg-muted/50 rounded border text-sm">
                    {patientCopy || "Hi, thank you for your consultation. You have a common cold (viral upper respiratory tract infection). Contact us with any concerns."}
                  </div>
                  <p className="text-xs text-muted-foreground">Word count: 21 words</p>
                </div>

                {/* Patient Email Format */}
                {patientEmail && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-primary">Patient Email Format</h4>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => copyToClipboard(patientEmail)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => onExpandContent("Patient Email", patientEmail)}
                        >
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => onExportWord(patientEmail, "Patient Email")}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Complete email ready to send to patient</p>
                    <div className="p-4 bg-muted/30 rounded-lg border max-h-96 overflow-y-auto">
                      <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                        {patientEmail}
                      </pre>
                    </div>
                  </div>
                )}
                
                {/* View Original Transcript button */}
                <div className="mt-6 pt-4 border-t">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-muted-foreground"
                    onClick={() => setShowTranscript(!showTranscript)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Original Transcript
                    <span className="ml-auto text-xs">{showTranscript ? 'Hide' : 'Show'}</span>
                  </Button>
                  
                  {showTranscript && (
                    <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                      <h4 className="text-sm font-medium mb-2">Original Transcript</h4>
                      <Textarea
                        value={transcript}
                        readOnly
                        className="min-h-[200px] resize-none text-sm font-mono"
                        placeholder="No transcript available"
                      />
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="referral" className="space-y-4">
              <div className="text-center py-8">
                <Button
                  onClick={onGenerateReferralLetter}
                  disabled={!transcript.trim() || isGenerating}
                  className="bg-gradient-primary hover:bg-primary-hover"
                  size="lg"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Generate Referral Letter
                </Button>
                {referralLetter && (
                  <div className="mt-6 text-left">
                    <Textarea
                      value={referralLetter}
                      readOnly
                      className="min-h-[200px] resize-none"
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="review" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-medium">Review of Consultation and Recommendations</h4>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4 mr-1" />
                      Word
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                </div>
                
                <div className="prose prose-sm max-w-none space-y-4">
                  <div>
                    <h5 className="font-medium">Consultation Review and Analysis</h5>
                    <p className="text-sm text-muted-foreground mt-2">
                      The consultation regarding the patient with symptoms of an upper respiratory tract infection (URTI) was generally well-conducted. However, 
                      there are areas for improvement in history taking, examination, and management plan. Below is a comprehensive analysis of what may have 
                      been missed, areas for improvement, and recommendations.
                    </p>
                  </div>
                  
                  <div>
                    <h5 className="font-medium">1. Areas for Improvement</h5>
                  </div>
                  
                  <div>
                    <h6 className="font-medium text-sm">History Taking:</h6>
                    <p className="text-sm text-muted-foreground">
                      The patient's past medical history was not explored in detail. It would be beneficial to know if the patient has any chronic conditions (e.g.,
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Expand Dialog */}
      <Dialog open={expandDialog.isOpen} onOpenChange={onCloseExpandDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{expandDialog.title}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <Textarea
              value={expandDialog.content}
              readOnly
              className="min-h-[400px] resize-none text-sm"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};