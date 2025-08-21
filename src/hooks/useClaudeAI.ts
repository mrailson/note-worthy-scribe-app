import { useState } from "react";
import { MeetingData } from "@/types/meetingTypes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useClaudeAI = (meetingData: MeetingData | null) => {
  const [claudeDetailLevel, setClaudeDetailLevel] = useState("standard");
  const [claudeNotes, setClaudeNotes] = useState("");
  const [isClaudeEditing, setIsClaudeEditing] = useState(false);
  const [isClaudeGenerating, setIsClaudeGenerating] = useState(false);
  const [isClaudeMinutesOpen, setIsClaudeMinutesOpen] = useState(true);
  const [isClaudeFullScreen, setIsClaudeFullScreen] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");
  const [showCustomInstruction, setShowCustomInstruction] = useState(false);

  const generateClaudeMeetingNotes = async (forceRegenerate = false, enhancedContext = null) => {
    if (!meetingData?.transcript || (!forceRegenerate && claudeNotes && claudeNotes.length > 0)) {
      if (claudeNotes && claudeNotes.length > 0) {
        toast.info("Meeting notes already generated");
        return;
      }
      toast.error("No transcript available");
      return;
    }

    setIsClaudeGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-meeting-notes-claude', {
        body: {
          transcript: meetingData.transcript,
          meetingTitle: meetingData.title || 'Meeting Notes',
          meetingDate: new Date(meetingData.startTime).toLocaleDateString(),
          meetingTime: new Date(meetingData.startTime).toLocaleTimeString(),
          detailLevel: claudeDetailLevel,
          meetingContext: enhancedContext || {
            participants: meetingData.participants || [],
            agenda: meetingData.agenda || '',
            meetingFormat: meetingData.meetingFormat || '',
            meetingLocation: meetingData.meetingLocation || ''
          },
          customInstruction: customInstruction || undefined
        }
      });

      if (error) throw error;

      if (data?.generatedNotes) {
        setClaudeNotes(data.generatedNotes);
        await saveSummaryToDatabase(meetingData.id, data.generatedNotes);
        
        // Update meeting with enhanced context if provided
        if (enhancedContext && meetingData.id) {
          await supabase.from('meetings').update({
            participants: enhancedContext.participants,
            agenda: enhancedContext.agenda,
            meeting_format: enhancedContext.meetingFormat,
            meeting_location: enhancedContext.meetingLocation,
            meeting_context: { 
              enhancement_level: 'enhanced', 
              ai_generated: true,
              enhanced_at: new Date().toISOString()
            }
          }).eq('id', meetingData.id);
        }
        
        toast.success("Enhanced meeting notes generated successfully!");
      } else {
        throw new Error("No meeting notes returned from API");
      }
    } catch (error) {
      console.error('Error generating Claude notes:', error);
      toast.error("Failed to generate meeting notes");
    } finally {
      setIsClaudeGenerating(false);
    }
  };

  const saveSummaryToDatabase = async (meetingId: string, content: string) => {
    if (!meetingId) return;
    
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ 
          generated_notes: content, // Store in generated_notes field
          description: content.substring(0, 1000) // Also store truncated version in description
        })
        .eq('id', meetingId);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving summary:', error);
    }
  };

  const handleCustomInstructionSubmit = async () => {
    if (!customInstruction.trim() || !meetingData?.transcript) {
      toast.error("Please enter custom instructions");
      return;
    }

    setIsClaudeGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('enhance-meeting-minutes', {
        body: {
          originalContent: claudeNotes || meetingData.transcript,
          enhancementType: 'custom',
          customRequest: customInstruction,
          additionalContext: ''
        }
      });

      if (error) throw error;

      if (data?.enhancedContent) {
        setClaudeNotes(data.enhancedContent);
        if (meetingData?.id) {
          await saveSummaryToDatabase(meetingData.id, data.enhancedContent);
        }
        setCustomInstruction("");
        setShowCustomInstruction(false);
        toast.success("Meeting notes enhanced with custom instructions!");
      }
    } catch (error) {
      console.error('Error applying custom instructions:', error);
      toast.error("Failed to apply custom instructions");
    } finally {
      setIsClaudeGenerating(false);
    }
  };

  return {
    claudeDetailLevel,
    setClaudeDetailLevel,
    claudeNotes,
    setClaudeNotes,
    isClaudeEditing,
    setIsClaudeEditing,
    isClaudeGenerating,
    isClaudeMinutesOpen,
    setIsClaudeMinutesOpen,
    isClaudeFullScreen,
    setIsClaudeFullScreen,
    customInstruction,
    setCustomInstruction,
    showCustomInstruction,
    setShowCustomInstruction,
    generateClaudeMeetingNotes,
    saveSummaryToDatabase,
    handleCustomInstructionSubmit
  };
};