import { SEO } from "@/components/SEO";
import NHCPlanningStudio from "@/components/nres/nhc/NHCPlanningStudio";
import { Link } from "react-router-dom";

const PublicPlanningStudio = () => {
  return (
    <>
      <SEO
        title="NHC Planning Studio — free planning tool for NHS Neighbourhood Health Centres | Notewell AI"
        description="A free hands-on tool for NHS ICBs, regions and PCNs scoping Neighbourhood Health Centre schemes. Size service tiers to your population, compare integrated vs unintegrated models, view sample NHS England floor plans, and run a 21-question readiness self-assessment ahead of the 28 May 2026 pipeline submission deadline. Grounded in NHS England PRN02455 and PRN02463."
        canonical="https://gpnotewell.co.uk/planning-studio"
      />
      <div className="min-h-screen" style={{ backgroundColor: '#F7F4EE' }}>
        {/* Minimal top bar */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b" style={{ borderColor: '#E8E4DD', backgroundColor: '#F7F4EE' }}>
          <Link to="/" className="flex items-center gap-2">
            <img src="/android-chrome-192x192.png" alt="Notewell AI" className="w-7 h-7" />
            <span className="text-base font-semibold" style={{ color: '#1a1a1a' }}>Notewell AI</span>
          </Link>
          <Link
            to="/auth"
            className="text-sm font-medium px-4 py-1.5 rounded-md transition-colors"
            style={{ color: '#005EB8' }}
          >
            Sign in
          </Link>
        </header>

        {/* NHC Planning Studio */}
        <NHCPlanningStudio />
      </div>
    </>
  );
};

export default PublicPlanningStudio;
