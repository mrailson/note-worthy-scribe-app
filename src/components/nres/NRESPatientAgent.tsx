import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { HeartPulse, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const PATIENT_AGENT_ID = "agent_3501knsz3wj8f0frkttr1yd90k72";

const PatientInner = () => {
  const conversation = useConversation();
  const isConnected = conversation.status === "connected";
  const isConnecting = conversation.status === "connecting";

  const handleStart = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({
        agentId: PATIENT_AGENT_ID,
        connectionType: "websocket",
      });
    } catch (error) {
      console.error("Failed to start patient assistant:", error);
    }
  };

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
              onClick={() => conversation.endSession()}
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
