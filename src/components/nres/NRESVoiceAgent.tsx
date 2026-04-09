import {
  ConversationProvider,
  useConversationControls,
  useConversationMode,
  useConversationStatus,
} from "@elevenlabs/react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AGENT_ID = "agent_01jwry2fzme7xsb2mwzatxseyt";

const NRESVoiceAgentInner = () => {
  const { startSession, endSession } = useConversationControls();
  const { status, message } = useConversationStatus();
  const { isSpeaking } = useConversationMode();

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const hasError = status === "error" && message;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {isConnected ? (
          <>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <span className={cn("inline-block h-2 w-2 rounded-full bg-emerald-500", isSpeaking && "animate-pulse")} />
              {isSpeaking ? "Speaking…" : "Listening…"}
            </div>
            <Button variant="destructive" size="sm" onClick={() => endSession()} className="h-7 gap-1.5 text-xs">
              <MicOff className="h-3.5 w-3.5" />
              End
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => startSession()} disabled={isConnecting} className="h-7 gap-1.5 text-xs">
            <Mic className="h-3.5 w-3.5" />
            {isConnecting ? "Connecting…" : "Talk to Notewell AI"}
          </Button>
        )}
      </div>

      {hasError ? (
        <p className="text-xs text-destructive">{message}</p>
      ) : null}
    </div>
  );
};

export const NRESVoiceAgent = () => {
  return (
    <ConversationProvider agentId={AGENT_ID} connectionType="webrtc">
      <NRESVoiceAgentInner />
    </ConversationProvider>
  );
};
