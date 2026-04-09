import { useEffect, useRef } from "react";

export const NRESWidgetEmbed = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const el = document.createElement("elevenlabs-convai");
    el.setAttribute("agent-id", "agent_01jwry2fzme7xsb2mwzatxseyt");
    containerRef.current.appendChild(el);

    const existing = document.querySelector('script[src*="convai-widget-embed"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
      script.async = true;
      document.body.appendChild(script);
    }

    return () => {
      if (containerRef.current && el.parentNode === containerRef.current) {
        containerRef.current.removeChild(el);
      }
    };
  }, []);

  return <div ref={containerRef} />;
};
