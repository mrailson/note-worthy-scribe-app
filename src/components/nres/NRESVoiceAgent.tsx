import { useEffect } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "elevenlabs-convai": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { "agent-id": string };
    }
  }
}

export const NRESVoiceAgent = () => {
  useEffect(() => {
    const existing = document.querySelector('script[src*="convai-widget-embed"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  return <elevenlabs-convai agent-id="agent_01jwry2fzme7xsb2mwzatxseyt"></elevenlabs-convai>;
};
