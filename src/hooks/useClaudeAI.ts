import { useState, useEffect } from "react";
import { MeetingData } from "@/types/meetingTypes";
import { supabase } from "@/integrations/supabase/client";
import { showToast } from "@/utils/toastWrapper";

export const useClaudeAI = (meetingData: MeetingData | null) => {
  const [claudeDetailLevel, setClaudeDetailLevel] = useState("standard");
  const [claudeNotes, setClaudeNotes] = useState("");
  const [isClaudeEditing, setIsClaudeEditing] = useState(false);
  const [isClaudeGenerating, setIsClaudeGenerating] = useState(false);
  const [isClaudeMinutesOpen, setIsClaudeMinutesOpen] = useState(true);
  const [isClaudeFullScreen, setIsClaudeFullScreen] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");
  const [showCustomInstruction, setShowCustomInstruction] = useState(false);

  // Auto-load existing notes when meetingData changes
  useEffect(() => {
    const loadExistingNotes = async () => {
      if (meetingData?.id && !claudeNotes) {
        try {
          const { data: summaryData } = await supabase
            .from('meeting_summaries')
            .select('summary')
            .eq('meeting_id', meetingData.id)
            .maybeSingle();
          
          if (summaryData?.summary) {
            setClaudeNotes(summaryData.summary);
          }
        } catch (error) {
          console.error('Error loading existing notes:', error);
        }
      }
    };

    loadExistingNotes();
  }, [meetingData?.id]);

  const generateClaudeMeetingNotes = async (forceRegenerate = false, enhancedContext = null) => {
    if (!meetingData?.transcript || (!forceRegenerate && claudeNotes && claudeNotes.length > 0)) {
      if (claudeNotes && claudeNotes.length > 0) {
        showToast.info("Meeting notes already generated", { section: 'meeting_manager' });
        return;
      }
      showToast.error("No transcript available", { section: 'meeting_manager' });
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
          customPrompt: customInstruction || undefined
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
        
        showToast.success("Enhanced meeting notes generated successfully!", { section: 'meeting_manager' });
      } else {
        throw new Error("No meeting notes returned from API");
      }
    } catch (error) {
      console.error('Error generating Claude notes:', error);
      showToast.error("Failed to generate meeting notes", { section: 'meeting_manager' });
    } finally {
      setIsClaudeGenerating(false);
    }
  };

  const saveSummaryToDatabase = async (meetingId: string, content: string) => {
    if (!meetingId) return;
    
    try {
      // Enhance content with Meeting Coach assignments before saving
      const { enhanceMeetingNotesWithAssignments } = await import('@/utils/meetingCoachIntegration');
      const enhancedContent = enhanceMeetingNotesWithAssignments(content, meetingId);
      
      // Save to meeting_summaries table (correct location)
      const { error } = await supabase
        .from('meeting_summaries')
        .upsert({
          meeting_id: meetingId,
          summary: enhancedContent,
          ai_generated: true,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      // Also update meeting description for quick preview
      await supabase
        .from('meetings')
        .update({ 
          description: enhancedContent.substring(0, 1000)
        })
        .eq('id', meetingId);
        
    } catch (error) {
      console.error('Error saving summary:', error);
      throw error;
    }
  };

  const handleCustomInstructionSubmit = async () => {
    if (!customInstruction.trim() || !meetingData?.transcript) {
      showToast.error("Please enter custom instructions", { section: 'meeting_manager' });
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
        showToast.success("Meeting notes enhanced with custom instructions!", { section: 'meeting_manager' });
      }
    } catch (error) {
      console.error('Error applying custom instructions:', error);
      showToast.error("Failed to apply custom instructions", { section: 'meeting_manager' });
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