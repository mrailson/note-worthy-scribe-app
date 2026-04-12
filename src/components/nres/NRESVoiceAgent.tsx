import { useEffect, useRef } from "react";

const AGENT_ID = "agent_01jwry2fzme7xsb2mwzatxseyt";

function useElevenLabsScript() {
  useEffect(() => {
    if (document.querySelector('script[src*="convai-widget-embed"]')) return;
    const s = document.createElement("script");
    s.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
    s.async = true;
    document.body.appendChild(s);
  }, []);
}

export const NRESVoiceAgent = () => {
  useElevenLabsScript();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const el = document.createElement("elevenlabs-convai");
    el.setAttribute("agent-id", AGENT_ID);
    ref.current.appendChild(el);
    return () => {
      if (ref.current) ref.current.innerHTML = "";
    };
  }, []);

  return <div ref={ref} className="mt-3 pt-3 border-t border-slate-200" style={{ minHeight: 60 }} />;
};
