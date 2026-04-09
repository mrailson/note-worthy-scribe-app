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
      <div className="flex items-center gap-3">
        {isConnected ? (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  isSpeaking ? "bg-primary animate-pulse" : "bg-muted-foreground/60"
                )}
              />
              <span>{isSpeaking ? "Speaking…" : "Listening…"}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={endSession}
              className="h-7 gap-1.5 text-xs"
            >
              <MicOff className="h-3 w-3" />
              End
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={() => startSession()}
            disabled={isConnecting}
            className="h-7 gap-1.5 text-xs"
          >
            <Mic className="h-3 w-3" />
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
