import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNRESSummaryEmail } from "@/hooks/useNRESSummaryEmail";
import { useRef } from "react";

const AGENT_ID = "agent_01jwry2fzme7xsb2mwzatxseyt";

interface MessageEntry {
  role: "assistant" | "user";
  text: string;
  timestamp: Date;
}

const NRESVoiceAgentInner = () => {
  const { sendSummaryEmail } = useNRESSummaryEmail();
  const messagesRef = useRef<MessageEntry[]>([]);
  const sessionStartRef = useRef<Date | null>(null);

  const conversation = useConversation({
    onMessage: (payload) => {
      console.log("📝 NRES onMessage:", payload.source, payload.message?.substring(0, 50));
      messagesRef.current.push({
        role: payload.source === "ai" ? "assistant" : "user",
        text: payload.message,
        timestamp: new Date(),
      });
    },
    onDisconnect: () => {
      console.log("📤 NRES session disconnected, messages:", messagesRef.current.length);
      const startTime = sessionStartRef.current || new Date();
      const endTime = new Date();
      const messages = [...messagesRef.current];

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
    },
  });

  const isConnected = conversation.status === "connected";
  const isConnecting = conversation.status === "connecting";

  const handleStart = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      messagesRef.current = [];
      sessionStartRef.current = new Date();
      conversation.startSession({
        agentId: AGENT_ID,
      });
    } catch (error) {
      console.error("Failed to start conversation:", error);
    }
  };

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
            onClick={() => conversation.endSession()}
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
