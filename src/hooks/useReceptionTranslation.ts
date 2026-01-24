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

interface UseReceptionTranslationOptions {
  sessionToken: string;
  patientLanguage: string;
  isStaff: boolean;
}

export const useReceptionTranslation = ({
  sessionToken,
  patientLanguage,
  isStaff
}: UseReceptionTranslationOptions) => {
  const [messages, setMessages] = useState<TranslationMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientConnected, setPatientConnected] = useState(false);
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
      .on('broadcast', { event: 'session_ended' }, () => {
        setIsConnected(false);
        setPatientConnected(false);
        setError('Session ended by staff');
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
  ): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          text,
          targetLanguage,
          sourceLanguage
        }
      });

      if (error) throw error;
      return data.translatedText || text;
    } catch (err) {
      console.error('Translation error:', err);
      return text; // Return original if translation fails
    }
  }, []);

  // Send a message (staff speaks English, patient speaks their language)
  const sendMessage = useCallback(async (text: string) => {
    if (!channelRef.current || !text.trim()) return;

    setIsTranslating(true);

    try {
      const sourceLanguage = isStaff ? 'en' : patientLanguage;
      const targetLanguage = isStaff ? patientLanguage : 'en';

      const translatedText = await translateText(text, sourceLanguage, targetLanguage);

      const message: TranslationMessage = {
        id: crypto.randomUUID(),
        speaker: isStaff ? 'staff' : 'patient',
        originalText: text,
        translatedText,
        originalLanguage: sourceLanguage,
        targetLanguage,
        timestamp: new Date()
      };

      await channelRef.current.send({
        type: 'broadcast',
        event: 'translation',
        payload: message
      });
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    } finally {
      setIsTranslating(false);
    }
  }, [isStaff, patientLanguage, translateText]);

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

  return {
    messages,
    isConnected,
    isTranslating,
    error,
    patientConnected,
    sendMessage,
    endSession,
    clearMessages,
    deleteMessage
  };
};
