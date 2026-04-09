import { useEffect } from "react";

export const NRESWidgetLoader = () => {
  useEffect(() => {
    const el = document.createElement("elevenlabs-convai");
    el.setAttribute("agent-id", "agent_01jwry2fzme7xsb2mwzatxseyt");
    document.body.appendChild(el);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(el);
      document.body.removeChild(script);
    };
  }, []);

  return null;
};
