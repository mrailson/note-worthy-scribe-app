import { useEffect, useRef } from "react";

const PM_AGENT_ID = "agent_4901kp1a5we7eacrq7c3g4kme1m8";

function useElevenLabsScript() {
  useEffect(() => {
    if (document.querySelector('script[src*="convai-widget-embed"]')) return;
    const s = document.createElement("script");
    s.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
    s.async = true;
    document.body.appendChild(s);
  }, []);
}

export const NRESPMAgent = () => {
  useElevenLabsScript();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const el = document.createElement("elevenlabs-convai");
    el.setAttribute("agent-id", PM_AGENT_ID);
    ref.current.appendChild(el);
    return () => {
      if (ref.current) ref.current.innerHTML = "";
    };
  }, []);

  return <div ref={ref} className="mt-3" style={{ minHeight: 60 }} />;
};
