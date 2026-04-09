import { useEffect, useRef } from "react";

export const NRESWidgetEmbed = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const el = document.createElement("elevenlabs-convai");
    el.setAttribute("agent-id", "agent_01jwry2fzme7xsb2mwzatxseyt");
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
  }, []);

  return <div ref={containerRef} />;
};
