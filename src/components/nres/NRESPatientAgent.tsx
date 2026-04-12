import { useEffect, useRef } from "react";

const PATIENT_AGENT_ID = "agent_3501knsz3wj8f0frkttr1yd90k72";

function useElevenLabsScript() {
  useEffect(() => {
    if (document.querySelector('script[src*="convai-widget-embed"]')) return;
    const s = document.createElement("script");
    s.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
    s.async = true;
    document.body.appendChild(s);
  }, []);
}

export const NRESPatientAgent = () => {
  useElevenLabsScript();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const el = document.createElement("elevenlabs-convai");
    el.setAttribute("agent-id", PATIENT_AGENT_ID);
    ref.current.appendChild(el);
    return () => {
      if (ref.current) ref.current.innerHTML = "";
    };
  }, []);

  return <div ref={ref} className="mt-3" style={{ minHeight: 60 }} />;
};
