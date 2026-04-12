import { useConversation } from "@11labs/react";
import { supabase } from "@/integrations/supabase/client";
import { Globe, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const TRANSLATE_AGENT_ID = "agent_2601knsxn311f9evq5zs0rrese7s";

const TranslateInner = () => {
  const conversation = useConversation();
  const isConnected = conversation.status === "connected";
  const isConnecting = conversation.status === "connecting";

  const generateSignedUrl = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-agent-url", {
        body: { agentId: TRANSLATE_AGENT_ID },
      });
      if (error) throw error;
      return data.signed_url;
    } catch (err) {
      console.error("Signed URL failed:", err);
      return null;
    }
  };

  const handleStart = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const signedUrl = await generateSignedUrl();
      if (!signedUrl) {
        console.error("Could not get signed URL");
        return;
      }
      await conversation.startSession({
        agentId: TRANSLATE_AGENT_ID,
        signedUrl,
      });
    } catch (error) {
      console.error("Failed to start:", error);
    }
  };

  return (
    <div className="mt-3">
      {isConnected ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-700">
                {conversation.isSpeaking ? "Translating…" : "Listening…"}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => conversation.endSession()}
              className="h-7 gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-100"
            >
              <X className="h-3 w-3" />
              End Translation
            </Button>
          </div>
          <p className="text-[10px] text-slate-500 text-center">
            Speak naturally — one person at a time
          </p>
        </div>
      ) : (
        <Button
          onClick={handleStart}
          disabled={isConnecting}
          className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-md hover:shadow-lg hover:from-emerald-600 hover:to-teal-700 transition-all"
        >
          {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
          {isConnecting ? "Connecting…" : "Start Interpreting"}
        </Button>
      )}
    </div>
  );
};

export const NRESTranslateAgent = () => <TranslateInner />;
