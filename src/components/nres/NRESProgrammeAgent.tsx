import { useConversation } from "@11labs/react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef } from "react";
import { MessageSquare, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const NRES_AGENT_ID = "agent_7801knyxsxcxehsr8kynxgxz6xyr";

const NRESInner = ({ neighbourhoodName }: { neighbourhoodName: string }) => {
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log("✅ NRES agent connected");
    },
    onError: (error) => {
      console.error("❌ NRES agent error:", error);
    },
    onMessage: (message) => {
      console.log("📝 NRES onMessage:", message);
    },
    onDisconnect: () => {
      console.log("🔌 NRES agent disconnected");
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
    },
  });

  // Keep-alive: send activity pings every 1.5s while connected to prevent silence timeout
  useEffect(() => {
    if (conversation.status === "connected") {
      keepAliveRef.current = setInterval(() => {
        try {
          conversation.sendUserActivity();
        } catch (e) {
          console.warn("Keep-alive ping failed:", e);
        }
      }, 1500);
    } else {
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
    }
    return () => {
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
    };
  }, [conversation.status, conversation]);

  const isConnected = conversation.status === "connected";
  const isConnecting = conversation.status === "connecting";

  const generateSignedUrl = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-agent-url', {
        body: { agentId: NRES_AGENT_ID }
      });
      if (error) throw error;
      return data.signed_url;
    } catch (err) {
      console.error('Signed URL failed:', err);
      return null;
    }
  };

  const handleStart = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const signedUrl = await generateSignedUrl();
      if (!signedUrl) {
        console.error('Could not get signed URL');
        return;
      }
      await (conversation as any).startSession({
        agentId: NRES_AGENT_ID,
        signedUrl,
      });
    } catch (error) {
      console.error("Failed to start NRES assistant:", error);
    }
  };

  return (
    <div className="mt-3">
      {isConnected ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
              </span>
              <span className="text-xs font-medium text-blue-700">
                {conversation.isSpeaking ? "Speaking…" : "Listening…"}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => conversation.endSession()}
              className="h-7 gap-1.5 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              <X className="h-3 w-3" />
              End Session
            </Button>
          </div>
          <p className="text-[10px] text-slate-500 text-center">
            Ask me anything about the {neighbourhoodName} programme
          </p>
        </div>
      ) : (
        <Button
          onClick={handleStart}
          disabled={isConnecting}
          className="w-full gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-md hover:shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-all"
        >
          {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
          {isConnecting ? "Connecting…" : `💬 Let's Talk ${neighbourhoodName} — Press to Chat`}
        </Button>
      )}
    </div>
  );
};

export const NRESProgrammeAgent = ({ neighbourhoodName }: { neighbourhoodName: string }) => <NRESInner neighbourhoodName={neighbourhoodName} />;
