import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const AGENT_ID = "agent_01jwry2fzme7xsb2mwzatxseyt";

const NRESVoiceAgentInner = () => {
  const conversation = useConversation();
  
  const isConnected = conversation.status === "connected";
  const isConnecting = conversation.status === "connecting";

  const handleStart = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({
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
