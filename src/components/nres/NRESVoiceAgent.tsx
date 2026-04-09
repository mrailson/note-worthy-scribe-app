import { useConversation } from "@elevenlabs/react";
import { useState, useCallback } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AGENT_ID = "agent_01jwry2fzme7xsb2mwzatxseyt";

export const NRESVoiceAgent = () => {
  const [isConnecting, setIsConnecting] = useState(false);

  const conversation = useConversation({
    onConnect: () => console.log("Connected to Notewell AI agent"),
    onDisconnect: () => console.log("Disconnected from agent"),
    onError: (error) => console.error("Voice agent error:", error),
  });

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({
        agentId: AGENT_ID,
        connectionType: "webrtc",
      });
    } catch (error) {
      console.error("Failed to start conversation:", error);
    } finally {
      setIsConnecting(false);
    }
  }, [conversation]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const isConnected = conversation.status === "connected";

  return (
    <div className="flex items-center gap-3">
      {isConnected ? (
        <>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <div className={cn(
              "w-2 h-2 rounded-full",
              conversation.isSpeaking ? "bg-green-500 animate-pulse" : "bg-blue-500"
            )} />
            <span>{conversation.isSpeaking ? "Speaking…" : "Listening…"}</span>
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={stopConversation}
            className="h-7 text-xs gap-1.5"
          >
            <MicOff className="w-3 h-3" />
            End
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          onClick={startConversation}
          disabled={isConnecting}
          className="h-7 text-xs gap-1.5 bg-[#005EB8] hover:bg-[#003087]"
        >
          {isConnecting ? (
            <>Connecting…</>
          ) : (
            <>
              <Mic className="w-3 h-3" />
              Talk to Notewell AI
            </>
          )}
        </Button>
      )}
    </div>
  );
};
