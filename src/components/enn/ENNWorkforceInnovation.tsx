import { Badge } from "@/components/ui/badge";
import { Users, AlertCircle, FileText, ExternalLink, Download } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Button } from "@/components/ui/button";

const ENNWorkforceInnovation = () => {
  return (
    <div className="space-y-6">
      {/* GP Redundancy Liability Briefing */}
      <CollapsibleCard
        title="Salaried GP Redundancy Liability – LMC/BMA Briefing"
        icon={<AlertCircle className="w-5 h-5" />}
        badge={<Badge className="bg-red-500">Confidential</Badge>}
        defaultOpen={true}
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-800">Source: BMA / Northants LMC / ICB</p>
                <p className="text-sm text-blue-700 mt-1">
                  This briefing is prepared in response to questions posed to the Northants LMC and replies received from the LMC and the BMA's Employed Doctors team. <strong>This is not legal advice.</strong>
                </p>
                <p className="text-xs text-blue-500 mt-2">Updated: 10 February 2026</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900">Key Points for the Executive Team</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="font-semibold text-red-800 text-sm mb-1">Continuous NHS Service Applies</p>
                <p className="text-xs text-red-700">
                  Under the BMA model contract, contractual redundancy is calculated on <strong>all continuous NHS service</strong> — not just time with the employing practice.
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="font-semibold text-green-800 text-sm mb-1">ICB Redundancy Guarantee – £305,219</p>
                <p className="text-xs text-green-700">
                  NHS Northamptonshire ICB has agreed an exceptional one-time Confidential Redundancy Fund of <strong>£305,219</strong> to underwrite potential redundancy exposure for Phase 1 neighbourhood sites.
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="font-semibold text-amber-800 text-sm mb-1">GMS Practices – Legal Obligation</p>
                <p className="text-xs text-amber-700">
                  GMS practices are <strong>legally bound by statutory instrument</strong> (SI 2004/291) to offer terms no less favourable than the BMA model contract.
                </p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="font-semibold text-purple-800 text-sm mb-1">Recommended Option: BMA Model + ICB Guarantee</p>
                <p className="text-xs text-purple-700">
                  The paper recommends <strong>Option A</strong> — employing salaried GPs on the BMA model contract with continuous NHS service recognised, with redundancy liability underwritten by the ICB fund. Rated <strong>LOW risk</strong>.
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="font-semibold text-slate-800 text-sm mb-1">One-Time Provision Only</p>
                <p className="text-xs text-slate-700">
                  The ICB fund is a one-time pilot guarantee — not a precedent for future commissioning.
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="font-semibold text-blue-800 text-sm mb-1">7 Options Analysed</p>
                <p className="text-xs text-blue-700">
                  The full paper analyses 7 contract options (A–G) with risk appraisals covering legal, financial, operational and reputational dimensions.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Badge variant="outline" className="text-xs text-muted-foreground">Confidential – Programme Board Only</Badge>
          </div>
        </div>
      </CollapsibleCard>

      {/* Workforce Requirements */}
      <CollapsibleCard
        title="Workforce Requirements"
        icon={<Users className="w-5 h-5" />}
        badge={<Badge className="bg-[#005EB8]">WTE</Badge>}
        defaultOpen={false}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-4xl font-bold text-[#005EB8]">4.9</p>
              <p className="font-semibold text-slate-900 mt-1">GP WTE Sessions</p>
              <p className="text-sm text-slate-500">Based on 14 appointments per session · 15.2/1,000/wk</p>
              <a
                href="https://www.jobs.nhs.uk/candidate/search/results?distance=5&searchFormType=main&keyword=GP&location=Rushden&language=en#"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-sm text-[#005EB8] hover:underline cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                NHS Jobs
              </a>
            </div>
            <div className="bg-cyan-50 rounded-xl p-4 text-center">
              <p className="text-4xl font-bold text-cyan-600">4.9</p>
              <p className="font-semibold text-slate-900 mt-1">ACP WTE Sessions</p>
              <p className="text-sm text-slate-500">Advanced Clinical Practitioners (Prescribing) · 14 appts/session</p>
              <a
                href="https://www.jobs.nhs.uk/candidate/search/results?distance=5&searchFormType=main&keyword=GP&location=Rushden&language=en#"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-sm text-cyan-600 hover:underline cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                NHS Jobs
              </a>
            </div>
          </div>
        </div>
      </CollapsibleCard>
    </div>
  );
};

export default ENNWorkforceInnovation;
