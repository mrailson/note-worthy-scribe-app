import { useEffect, useRef } from "react";

const NRES_AGENT_ID = "agent_7801knyxsxcxehsr8kynxgxz6xyr";
const ENN_AGENT_ID = "agent_6801kp1qmxn1f24b42407nn2gq57";

export const NRESWidgetEmbed = ({ neighbourhoodName = 'NRES' }: { neighbourhoodName?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const agentId = neighbourhoodName === 'ENN' ? ENN_AGENT_ID : NRES_AGENT_ID;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const el = document.createElement("elevenlabs-convai");
    el.setAttribute("agent-id", agentId);
    container.appendChild(el);

    const existing = document.querySelector('script[src*="convai-widget-embed"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
      script.async = true;
      document.body.appendChild(script);
    }

    return () => {
      if (container && el.parentNode === container) {
        container.removeChild(el);
      }
    };
  }, [agentId]);

  return <div ref={containerRef} />;
};
