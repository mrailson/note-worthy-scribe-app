import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNRESSummaryEmail } from "@/hooks/useNRESSummaryEmail";
import { useRef, useCallback } from "react";

const AGENT_ID = "agent_01jwry2fzme7xsb2mwzatxseyt";

interface MessageEntry {
  role: "assistant" | "user";
  text: string;
  timestamp: Date;
}

const NRESVoiceAgentInner = () => {
  const conversation = useConversation();
  const { sendSummaryEmail } = useNRESSummaryEmail();
  const messagesRef = useRef<MessageEntry[]>([]);
  const sessionStartRef = useRef<Date | null>(null);

  const isConnected = conversation.status === "connected";
  const isConnecting = conversation.status === "connecting";

  const handleStart = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      messagesRef.current = [];
      sessionStartRef.current = new Date();
      await conversation.startSession({
        agentId: AGENT_ID,
        connectionType: "websocket",
        onMessage: (msg: { source: string; message: string }) => {
          messagesRef.current.push({
            role: msg.source === "ai" ? "assistant" : "user",
            text: msg.message,
            timestamp: new Date(),
          });
        },
      });
    } catch (error) {
      console.error("Failed to start conversation:", error);
    }
  };

  const handleEnd = useCallback(async () => {
    const startTime = sessionStartRef.current || new Date();
    const endTime = new Date();
    const messages = [...messagesRef.current];

    await conversation.endSession();

    // Fire-and-forget summary email
    if (messages.length > 0) {
      const durationMinutes = Math.round(
        (endTime.getTime() - startTime.getTime()) / 60000
      );

      const transcription = messages.map((m) => ({
        speaker: m.role === "assistant" ? "NRES Agent" : "Clinician",
        timestamp: m.timestamp.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        text: m.text,
      }));

      sendSummaryEmail({
        sessionId: crypto.randomUUID(),
        practiceName: "NRES Practice",
        sessionType: "GP Notewell Consultation",
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMinutes,
        transcription,
      });
    }
  }, [conversation, sendSummaryEmail]);

  return (
    <div className="mt-3 pt-3 border-t border-slate-200">
      {isConnected ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">
            <Mic className="h-3 w-3 animate-pulse" />
            {conversation.isSpeaking ? "Speaking…" : "Listening…"}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleEnd}
            className="h-7 gap-1.5 text-xs"
          >
            <MicOff className="h-3 w-3" />
            End
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={handleStart} disabled={isConnecting} className="h-7 gap-1.5 text-xs">
          {isConnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mic className="h-3 w-3" />}
          {isConnecting ? "Connecting…" : "Talk to GP Notewell"}
        </Button>
      )}
    </div>
  );
};

export const NRESVoiceAgent = () => (
  <ConversationProvider>
    <NRESVoiceAgentInner />
  </ConversationProvider>
);
