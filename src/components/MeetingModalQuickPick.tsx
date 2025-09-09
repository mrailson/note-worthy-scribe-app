import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Wand2, 
  Sparkles,
  Mic,
  Loader2,
  Stethoscope,
  FileText,
  Users,
  AlertTriangle,
  Target,
  CheckCircle,
  Brain
} from "lucide-react";
import { SpeechToText } from "@/components/SpeechToText";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MeetingModalQuickPickProps {
  content: string;
  onContentChange: (content: string) => void;
  meetingId?: string;
}

export function MeetingModalQuickPick({ 
  content, 
  onContentChange,
  meetingId
}: MeetingModalQuickPickProps) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const gpClinicalEnhanceOptions = [
    { 
      id: 'enhance-clinical-discussions', 
      label: 'Clinical Focus', 
      description: 'Highlight clinical discussions and decisions',
      icon: Stethoscope
    },
    { 
      id: 'add-action-analysis', 
      label: 'Action Analysis', 
      description: 'Extract and organize action items',
      icon: Target
    },
    { 
      id: 'improve-professional-tone', 
      label: 'Professional Tone', 
      description: 'Enhance language for professional standards',
      icon: FileText
    },
    { 
      id: 'add-risk-assessment', 
      label: 'Risk Assessment', 
      description: 'Identify and highlight clinical risks',
      icon: AlertTriangle
    },
    { 
      id: 'follow-up-recommendations', 
      label: 'Follow-up Plans', 
      description: 'Generate follow-up recommendations',
      icon: CheckCircle
    },
    { 
      id: 'patient-safety-focus', 
      label: 'Patient Safety', 
      description: 'Emphasize patient safety elements',
      icon: Users
    }
  ];

  const handleAIEnhance = async (enhanceType: string) => {
    if (!content.trim()) {
      toast.error("No content to enhance");
      return;
    }

    setIsProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('enhance-meeting-minutes', {
        body: {
          originalContent: content,
          enhancementType: 'custom',
          specificRequest: getEnhancementPrompt(enhanceType),
          context: `Meeting ID: ${meetingId}`
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      onContentChange(data.enhancedContent);
      toast.success(`Applied ${enhanceType.replace('-', ' ')} enhancement`);
    } catch (error) {
      console.error('Enhancement error:', error);
      toast.error(error instanceof Error ? error.message : 'Enhancement failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const getEnhancementPrompt = (enhanceType: string): string => {
    const prompts = {
      'enhance-clinical-discussions': 'Focus on and enhance all clinical discussions, medical decisions, and patient care elements. Emphasize diagnostic considerations, treatment plans, and clinical reasoning.',
      'add-action-analysis': 'Extract and organize all action items, decisions, and follow-up tasks. Create a structured analysis of responsibilities, timelines, and outcomes.',
      'improve-professional-tone': 'Enhance the language to meet professional healthcare standards. Use appropriate medical terminology and formal business language.',
      'add-risk-assessment': 'Identify and highlight all clinical and operational risks mentioned. Add risk assessment context and mitigation considerations.',
      'follow-up-recommendations': 'Generate comprehensive follow-up recommendations based on the discussions. Include timelines, responsible parties, and success metrics.',
      'patient-safety-focus': 'Emphasize all patient safety elements, quality improvement discussions, and safeguarding considerations. Highlight safety protocols and outcomes.'
    };
    
    return prompts[enhanceType as keyof typeof prompts] || enhanceType;
  };

  const handleCustomAI = async () => {
    if (!content.trim() || !customPrompt.trim()) {
      toast.error("Please provide content and a custom prompt");
      return;
    }

    setIsProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('enhance-meeting-minutes', {
        body: {
          originalContent: content,
          enhancementType: 'custom',
          specificRequest: customPrompt,
          context: `Meeting ID: ${meetingId}`
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      onContentChange(data.enhancedContent);
      toast.success("Applied custom AI enhancement");
      setCustomPrompt("");
    } catch (error) {
      console.error('Custom enhancement error:', error);
      toast.error(error instanceof Error ? error.message : 'Custom enhancement failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSpeechInput = (text: string) => {
    setCustomPrompt(prev => prev ? `${prev} ${text}` : text);
    toast.success("Speech added to custom prompt");
  };

  return (
    <div className="space-y-4">
      {/* GP/PCN Specific AI Enhancements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5" />
            Clinical AI Enhancement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {gpClinicalEnhanceOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Button
                  key={option.id}
                  variant="outline"
                  className="h-auto p-3 flex flex-col items-start gap-2"
                  onClick={() => handleAIEnhance(option.id)}
                  disabled={!content.trim() || isProcessing}
                >
                  <div className="flex items-center gap-2 w-full">
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    <span className="font-medium text-sm">{option.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground text-left">
                    {option.description}
                  </p>
                </Button>
              );
            })}
          </div>

          {/* Custom AI Prompt */}
          <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label htmlFor="custom-ai-prompt">Custom AI Request</Label>
              <SpeechToText 
                onTranscription={handleSpeechInput}
                size="sm"
                className="h-8"
              />
            </div>
            <div className="flex gap-2">
              <Textarea
                id="custom-ai-prompt"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe how you want to enhance the meeting notes..."
                className="flex-1 min-h-[80px]"
              />
            </div>
            <Button
              onClick={handleCustomAI}
              disabled={!content.trim() || !customPrompt.trim() || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Apply Custom Enhancement
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}