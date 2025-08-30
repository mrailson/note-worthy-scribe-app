import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Wand2, 
  Type, 
  Bold, 
  Italic, 
  List, 
  Hash, 
  Table, 
  Sparkles,
  Mic,
  Loader2
} from "lucide-react";
import { SpeechToText } from "@/components/SpeechToText";
import { applyTextFormatting } from "@/utils/textFormatting";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MeetingMinutesQuickPickProps {
  content: string;
  onContentChange: (content: string) => void;
  onSave: (content: string) => Promise<void> | void;
}

export function MeetingMinutesQuickPick({ 
  content, 
  onContentChange, 
  onSave 
}: MeetingMinutesQuickPickProps) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const formatOptions = [
    { 
      id: 'format-bold-titles', 
      label: 'Bold Titles', 
      description: '**Bold All Titles**',
      icon: Bold 
    },
    { 
      id: 'format-italic-emphasis', 
      label: 'Italic Emphasis', 
      description: '*Italic Important Points*',
      icon: Italic 
    },
    { 
      id: 'format-bullet-points', 
      label: 'Bullet Points', 
      description: '• Convert to Bullets',
      icon: List 
    },
    { 
      id: 'format-numbered-list', 
      label: 'Numbered Lists', 
      description: '1. Number Items',
      icon: Hash 
    },
    { 
      id: 'format-headers', 
      label: 'Add Headers', 
      description: '### Structure Content',
      icon: Type 
    },
    { 
      id: 'format-table', 
      label: 'Convert to Table', 
      description: 'Organize as Tables',
      icon: Table 
    }
  ];

  const aiEnhanceOptions = [
    { 
      id: 'make_professional', 
      label: 'Professional', 
      description: 'Formal business language' 
    },
    { 
      id: 'make_concise', 
      label: 'Concise', 
      description: 'Brief but complete' 
    },
    { 
      id: 'add_action_items', 
      label: 'Action Items', 
      description: 'Extract tasks & decisions' 
    },
    { 
      id: 'nhs_format', 
      label: 'NHS Format', 
      description: 'NHS governance standards' 
    },
    { 
      id: 'board_ready', 
      label: 'Board Ready', 
      description: 'Executive summary format' 
    }
  ];

  const handleQuickFormat = (formatType: string) => {
    if (!content.trim()) {
      toast.error("No content to format");
      return;
    }
    
    const formatted = applyTextFormatting(content, formatType);
    onContentChange(formatted);
    toast.success(`Applied ${formatType.replace('format-', '').replace('-', ' ')} formatting`);
  };

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
          enhancementType: enhanceType
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      onContentChange(data.enhancedContent);
      toast.success(`Applied ${enhanceType.replace('_', ' ')} enhancement`);
    } catch (error) {
      console.error('Enhancement error:', error);
      toast.error(error instanceof Error ? error.message : 'Enhancement failed');
    } finally {
      setIsProcessing(false);
    }
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
          specificRequest: customPrompt
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
      {/* Quick Format Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Type className="h-5 w-5" />
            Quick Format
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {formatOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Button
                  key={option.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickFormat(option.id)}
                  className="justify-start"
                  disabled={!content.trim()}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {option.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* AI Enhancement Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5" />
            AI Enhancement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {aiEnhanceOptions.map((option) => (
              <Button
                key={option.id}
                variant="outline"
                size="sm"
                onClick={() => handleAIEnhance(option.id)}
                className="justify-start"
                disabled={!content.trim() || isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                {option.label}
              </Button>
            ))}
          </div>

          {/* Custom AI Prompt */}
          <div className="space-y-2 pt-2 border-t">
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
                placeholder="Describe how you want to enhance the content..."
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