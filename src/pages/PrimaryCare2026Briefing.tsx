import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";

const PrimaryCare2026Briefing = () => {
  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <SEO
        title="Primary Care Contracts 2026/27 — PCN & Practice Briefing | NoteWell AI"
        description="Plain-English May 2026 briefing covering the updated PCN Network Contract DES and the GMS Amendment Directions 2026."
      />
      <Header />
      <iframe
        src="/gms-2026.html"
        title="Primary Care Contracts 2026/27 Briefing"
        className="flex-1 w-full border-0"
      />
    </div>
  );
};

export default PrimaryCare2026Briefing;
