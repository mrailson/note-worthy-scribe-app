import { useEffect, useRef } from "react";

const NRES_AGENT_ID = "agent_7801knyxsxcxehsr8kynxgxz6xyr";
const ENN_AGENT_ID = "agent_6801kp1qmxn1f24b42407nn2gq57";

function useElevenLabsScript() {
  useEffect(() => {
    if (document.querySelector('script[src*="convai-widget-embed"]')) return;
    const s = document.createElement("script");
    s.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
    s.async = true;
    document.body.appendChild(s);
  }, []);
}

export const NRESProgrammeAgent = ({ neighbourhoodName }: { neighbourhoodName: string }) => {
  useElevenLabsScript();
  const ref = useRef<HTMLDivElement>(null);
  const agentId = neighbourhoodName === 'ENN' ? ENN_AGENT_ID : NRES_AGENT_ID;

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const el = document.createElement("elevenlabs-convai");
    el.setAttribute("agent-id", agentId);
    ref.current.appendChild(el);
    return () => {
      if (ref.current) ref.current.innerHTML = "";
    };
  }, [agentId]);

  return <div ref={ref} className="mt-3" style={{ minHeight: 60 }} />;
};
