import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { HeartPulse, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePatientSummaryEmail } from "@/hooks/usePatientSummaryEmail";
import { useRef, useCallback } from "react";

const PATIENT_AGENT_ID = "agent_3501knsz3wj8f0frkttr1yd90k72";

interface MessageEntry {
  role: "assistant" | "user";
  text: string;
  timestamp: Date;
}

const PatientInner = () => {
  const conversation = useConversation();
  const { sendPatientSummaryEmail } = usePatientSummaryEmail();
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
        agentId: PATIENT_AGENT_ID,
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
      console.error("Failed to start patient assistant:", error);
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
        speaker: m.role === "assistant" ? "Assistant" : "Patient",
        timestamp: m.timestamp.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        text: m.text,
      }));

      sendPatientSummaryEmail({
        sessionId: crypto.randomUUID(),
        practiceName: "GP Practice",
        sessionType: "General",
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMinutes,
        languageUsed: "English",
        transcription,
      });
    }
  }, [conversation, sendPatientSummaryEmail]);

  return (
    <div className="mt-3">
      {isConnected ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
              </span>
              <span className="text-xs font-medium text-rose-700">
                {conversation.isSpeaking ? "Speaking…" : "Listening…"}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnd}
              className="h-7 gap-1.5 text-xs border-rose-300 text-rose-700 hover:bg-rose-100"
            >
              <X className="h-3 w-3" />
              End Session
            </Button>
          </div>
          <p className="text-[10px] text-slate-500 text-center">
            Speak naturally — I'll guide you through
          </p>
        </div>
      ) : (
        <Button
          onClick={handleStart}
          disabled={isConnecting}
          className="w-full gap-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold shadow-md hover:shadow-lg hover:from-rose-600 hover:to-pink-700 transition-all"
        >
          {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartPulse className="h-4 w-4" />}
          {isConnecting ? "Connecting…" : "Talk to Your GP Assistant"}
        </Button>
      )}
    </div>
  );
};

export const NRESPatientAgent = () => (
  <ConversationProvider>
    <PatientInner />
  </ConversationProvider>
);
