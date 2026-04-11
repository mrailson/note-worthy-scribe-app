import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { Stethoscope, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGPSummaryEmail } from "@/hooks/useGPSummaryEmail";
import { useRef } from "react";

const GP_AGENT_ID = "agent_01jwry2fzme7xsb2mwzatxseyt";

interface MessageEntry {
  role: "assistant" | "user";
  text: string;
  timestamp: Date;
}

const GPAgentInner = () => {
  const { sendGPSummaryEmail } = useGPSummaryEmail();
  const messagesRef = useRef<MessageEntry[]>([]);
  const sessionStartRef = useRef<Date | null>(null);

  const conversation = useConversation({
    onMessage: (payload) => {
      console.log("📝 GP onMessage:", payload.source, payload.message?.substring(0, 50));
      messagesRef.current.push({
        role: payload.source === "ai" ? "assistant" : "user",
        text: payload.message,
        timestamp: new Date(),
      });
    },
    onDisconnect: () => {
      console.log("📤 GP session disconnected, messages:", messagesRef.current.length);
      const startTime = sessionStartRef.current || new Date();
      const endTime = new Date();
      const messages = [...messagesRef.current];

      if (messages.length > 0) {
        const durationMinutes = Math.round(
          (endTime.getTime() - startTime.getTime()) / 60000
        );

        const transcription = messages.map((m) => ({
          speaker: m.role === "assistant" ? "GP Assistant" : "Clinician",
          timestamp: m.timestamp.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          text: m.text,
        }));

        sendGPSummaryEmail({
          sessionId: crypto.randomUUID(),
          practiceName: "GP Practice",
          sessionType: "General",
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
        agentId: GP_AGENT_ID,
        connectionType: "websocket",
      });
    } catch (error) {
      console.error("Failed to start GP assistant:", error);
    }
  };

  return (
    <div className="mt-3">
      {isConnected ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500" />
              </span>
              <span className="text-xs font-medium text-indigo-700">
                {conversation.isSpeaking ? "Speaking…" : "Listening…"}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => conversation.endSession()}
              className="h-7 gap-1.5 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-100"
            >
              <X className="h-3 w-3" />
              End Session
            </Button>
          </div>
          <p className="text-[10px] text-slate-500 text-center">
            Ask about guidelines, prescribing, or clinical queries
          </p>
        </div>
      ) : (
        <Button
          onClick={handleStart}
          disabled={isConnecting}
          className="w-full gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold shadow-md hover:shadow-lg hover:from-indigo-700 hover:to-violet-700 transition-all"
        >
          {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
          {isConnecting ? "Connecting…" : "🩺 Let's Talk GP Stuff — Press to Chat"}
        </Button>
      )}
    </div>
  );
};

export const NRESGPAgent = () => (
  <ConversationProvider>
    <GPAgentInner />
  </ConversationProvider>
);
