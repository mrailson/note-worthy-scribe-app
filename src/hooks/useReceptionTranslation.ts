import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface TranslationMessage {
  id: string;
  speaker: 'staff' | 'patient';
  originalText: string;
  translatedText: string;
  originalLanguage: string;
  targetLanguage: string;
  timestamp: Date;
}

export interface ContentWarning {
  reason: string;
  flaggedTerms: string[];
}

export interface TranslationResult {
  translatedText: string;
  contentWarning?: ContentWarning;
  blocked?: boolean;
  reason?: string;
  flaggedTerms?: string[];
}

interface UseReceptionTranslationOptions {
  sessionToken: string;
  sessionId?: string;
  patientLanguage: string;
  isStaff: boolean;
}

export const useReceptionTranslation = ({
  sessionToken,
  sessionId,
  patientLanguage,
  isStaff
}: UseReceptionTranslationOptions) => {
  const [messages, setMessages] = useState<TranslationMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientConnected, setPatientConnected] = useState(false);
  const [contentWarning, setContentWarning] = useState<ContentWarning | null>(null);
  const [blockedContent, setBlockedContent] = useState<{ reason: string; flaggedTerms: string[] } | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Connect to the realtime channel
  useEffect(() => {
    if (!sessionToken) return;

    const channelName = `reception-translate:${sessionToken}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true }
      }
    });

    channel
      .on('broadcast', { event: 'translation' }, (payload) => {
        const message = payload.payload as TranslationMessage;
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, { ...message, timestamp: new Date(message.timestamp) }];
        });
      })
      .on('broadcast', { event: 'delete_message' }, (payload) => {
        const { messageId } = payload.payload as { messageId: string };
        setMessages(prev => prev.filter(m => m.id !== messageId));
      })
      .on('broadcast', { event: 'update_message' }, (payload) => {
        const updated = payload.payload as TranslationMessage;
        setMessages(prev => prev.map(m => 
          m.id === updated.id ? { ...updated, timestamp: new Date(updated.timestamp) } : m
        ));
      })
      .on('broadcast', { event: 'session_ended' }, () => {
        setIsConnected(false);
        setPatientConnected(false);
        setError('Session ended by GP Practice');
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const patients = Object.values(state).flat().filter(
          (p: any) => p.role === 'patient'
        );
        setPatientConnected(patients.length > 0);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const patientJoined = newPresences.some((p: any) => p.role === 'patient');
        if (patientJoined) {
          setPatientConnected(true);
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const patientLeft = leftPresences.some((p: any) => p.role === 'patient');
        if (patientLeft) {
          const state = channel.presenceState();
          const remaining = Object.values(state).flat().filter(
            (p: any) => p.role === 'patient'
          );
          setPatientConnected(remaining.length > 0);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
          // Track this user's presence
          await channel.track({
            role: isStaff ? 'staff' : 'patient',
            online_at: new Date().toISOString()
          });
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setPatientConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [sessionToken]);

  // Translate text using the existing translate-text edge function
  const translateText = useCallback(async (
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<TranslationResult> => {
    try {
      // Use fetch directly to get access to response body on error
      const response = await fetch(
        `https://dphcnbricafkbtizkoal.supabase.co/functions/v1/translate-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs'}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs'
          },
          body: JSON.stringify({
            text,
            targetLanguage,
            sourceLanguage
          })
        }
      );

      const data = await response.json();

      // Check if content was blocked (400 response with blocked flag)
      if (!response.ok) {
        if (data?.blocked) {
          return {
            translatedText: text,
            blocked: true,
            reason: data.reason,
            flaggedTerms: data.flaggedTerms
          };
        }
        throw new Error(data?.error || 'Translation failed');
      }

      // Check if data indicates blocked content (in case status was 200 with blocked flag)
      if (data?.blocked) {
        return {
          translatedText: text,
          blocked: true,
          reason: data.reason,
          flaggedTerms: data.flaggedTerms
        };
      }

      return {
        translatedText: data.translatedText || text,
        contentWarning: data.contentWarning || null
      };
    } catch (err) {
      console.error('Translation error:', err);
      return { translatedText: text }; // Return original if translation fails
    }
  }, []);

  // Clear content warning/blocked states
  const clearContentWarning = useCallback(() => {
    setContentWarning(null);
  }, []);

  const clearBlockedContent = useCallback(() => {
    setBlockedContent(null);
  }, []);

  // Send a message (staff speaks English, patient speaks their language)
  // speaker parameter allows overriding when using same-device mode
  // Returns: { success: boolean, blocked?: boolean, warning?: ContentWarning }
  const sendMessage = useCallback(async (
    text: string, 
    speaker?: 'staff' | 'patient'
  ): Promise<{ success: boolean; blocked?: boolean; warning?: ContentWarning }> => {
    if (!channelRef.current || !text.trim()) return { success: false };

    setIsTranslating(true);
    // Clear previous warnings
    setContentWarning(null);
    setBlockedContent(null);

    try {
      // Use provided speaker or determine from isStaff
      const actualSpeaker = speaker ?? (isStaff ? 'staff' : 'patient');
      const sourceLanguage = actualSpeaker === 'staff' ? 'en' : patientLanguage;
      const targetLanguage = actualSpeaker === 'staff' ? patientLanguage : 'en';

      const result = await translateText(text, sourceLanguage, targetLanguage);

      // Handle blocked content
      if (result.blocked) {
        setBlockedContent({
          reason: result.reason || 'Content contains inappropriate language',
          flaggedTerms: result.flaggedTerms || []
        });
        return { success: false, blocked: true };
      }

      // Handle content warning (proceed but notify)
      if (result.contentWarning) {
        setContentWarning(result.contentWarning);
      }

      const message: TranslationMessage = {
        id: crypto.randomUUID(),
        speaker: actualSpeaker,
        originalText: text,
        translatedText: result.translatedText,
        originalLanguage: sourceLanguage,
        targetLanguage,
        timestamp: new Date()
      };

      // Broadcast the message
      await channelRef.current.send({
        type: 'broadcast',
        event: 'translation',
        payload: message
      });

      // Save to database for history (staff only saves to avoid duplicates)
      if (isStaff && sessionId) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          await supabase.from('reception_translation_messages').insert({
            session_id: sessionId,
            user_id: userData.user.id,
            speaker: message.speaker,
            original_text: message.originalText,
            translated_text: message.translatedText,
            source_language: sourceLanguage,
            target_language: targetLanguage
          });
        }
      }
      
      return { success: true, warning: result.contentWarning };
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      return { success: false };
    } finally {
      setIsTranslating(false);
    }
  }, [isStaff, sessionId, patientLanguage, translateText]);

  // End the session (staff only)
  const endSession = useCallback(async (sessionId: string) => {
    if (!channelRef.current) return;

    // Broadcast session end
    await channelRef.current.send({
      type: 'broadcast',
      event: 'session_ended',
      payload: {}
    });

    // Update database
    await supabase
      .from('reception_translation_sessions')
      .update({ is_active: false })
      .eq('id', sessionId);

    setIsConnected(false);
  }, []);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Delete a single message (staff only, broadcasts to patient view)
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!channelRef.current) return;

    // Remove locally
    setMessages(prev => prev.filter(m => m.id !== messageId));

    // Broadcast deletion to sync with patient view
    await channelRef.current.send({
      type: 'broadcast',
      event: 'delete_message',
      payload: { messageId }
    });
  }, []);

  // Update a message (staff only, re-translates and broadcasts)
  const updateMessage = useCallback(async (messageId: string, newText: string): Promise<boolean> => {
    if (!channelRef.current || !newText.trim()) return false;

    try {
      // Find the original message to get language info
      const originalMessage = messages.find(m => m.id === messageId);
      if (!originalMessage) return false;

      // Re-translate the edited text
      const result = await translateText(
        newText,
        originalMessage.originalLanguage,
        originalMessage.targetLanguage
      );

      // If blocked, don't update
      if (result.blocked) {
        setBlockedContent({
          reason: result.reason || 'Content contains inappropriate language',
          flaggedTerms: result.flaggedTerms || []
        });
        return false;
      }

      // Handle content warning
      if (result.contentWarning) {
        setContentWarning(result.contentWarning);
      }

      const updatedMessage: TranslationMessage = {
        ...originalMessage,
        originalText: newText,
        translatedText: result.translatedText,
        timestamp: new Date()
      };

      // Update locally
      setMessages(prev => prev.map(m => 
        m.id === messageId ? updatedMessage : m
      ));

      // Broadcast update to sync with patient view
      await channelRef.current.send({
        type: 'broadcast',
        event: 'update_message',
        payload: updatedMessage
      });

      return true;
    } catch (err) {
      console.error('Error updating message:', err);
      return false;
    }
  }, [messages, translateText]);

  return {
    messages,
    isConnected,
    isTranslating,
    error,
    patientConnected,
    contentWarning,
    blockedContent,
    sendMessage,
    endSession,
    clearMessages,
    deleteMessage,
    updateMessage,
    clearContentWarning,
    clearBlockedContent
  };
};
