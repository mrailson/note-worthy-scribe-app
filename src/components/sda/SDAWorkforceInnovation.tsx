import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, FileText, AlertCircle, Briefcase, Download, ExternalLink, ClipboardCheck, UserCheck, Calendar, Presentation, Bell } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Button } from "@/components/ui/button";
import { ACPRecruitmentPanel } from "./recruitment/ACPRecruitmentPanel";
import { GPRecruitmentPanel } from "./recruitment/GPRecruitmentPanel";
import { LantumOptionsSlideshow, LantumOptionsThumbnail } from "./LantumOptionsSlideshow";

// Proposed job adverts for Programme Board approval
const proposedJobAdverts = [
  {
    reference: "NRES-BMC-GP-2526",
    title: "General Practitioner for New Models of Care",
    location: "Brackley Medical Centre",
    salary: "£11,000 per session",
    band: null,
    closingDate: "20 January 2026",
    type: "GP",
    keyRequirements: ["CCT qualification", "On Northamptonshire Performers list", "Clinical experience in primary care"],
    documentUrl: "/documents/NRES_GP_BMC_Job_Advert.docx",
  },
  {
    reference: "NRES-PARKS-GP-2526",
    title: "General Practitioner for New Models of Care",
    location: "The Parks Medical Practice",
    salary: "£11,000 per session",
    band: null,
    closingDate: "20 January 2026",
    type: "GP",
    keyRequirements: ["CCT qualification", "On Northamptonshire Performers list", "Clinical experience in primary care"],
    documentUrl: "/documents/NRES_GP_Parks_Job_Advert.docx",
  },
  {
    reference: "NRES-BMC-ANP-2526",
    title: "Advanced Nurse Practitioner",
    location: "Brackley Medical Centre",
    salary: "£55,690 - £62,682 per annum",
    band: "Band 8a",
    closingDate: "20 January 2026",
    type: "ANP",
    keyRequirements: ["NMC registration (Adult Nursing)", "Independent Non-Medical Prescriber (V300)", "MSc in Advanced Clinical Practice"],
    documentUrl: "/documents/NRES_ANP_BMC_Job_Advert.docx",
  },
  {
    reference: "NRES-PARKS-ANP-2526",
    title: "Advanced Nurse Practitioner",
    location: "The Parks Medical Practice",
    salary: "£55,690 - £62,682 per annum",
    band: "Band 8a",
    closingDate: "20 January 2026",
    type: "ANP",
    keyRequirements: ["NMC registration (Adult Nursing)", "Independent Non-Medical Prescriber (V300)", "MSc in Advanced Clinical Practice"],
    documentUrl: "/documents/NRES_ANP_Parks_Job_Advert.docx",
  },
  {
    reference: "NRES-ACP-2526",
    title: "Advanced Clinical Practitioner (ACP)",
    location: "Multiple locations across NRES Neighbourhood",
    salary: "£55,690 - £62,682 per annum",
    band: "Band 8a",
    closingDate: "20 January 2026",
    type: "ACP",
    keyRequirements: ["NMC/HCPC registration", "MSc in Advanced Clinical Practice", "Independent Prescriber (V300)"],
    documentUrl: "/documents/NRES_ACP_Indeed_Advert_v1.docx",
  },
];

// Job description templates available
const jobDescriptionTemplates = [
  { name: "GP Job Description - Brackley Medical Centre", type: "GP", status: "Ready", documentUrl: "/documents/NRES_GP_Job_Description_Brackley_Medical_Centre.docx" },
  { name: "GP Job Description - Neighbourhood Template", type: "GP", status: "Ready", documentUrl: "/documents/GP_DESCRIPTION_for_Neighbourhood.docx" },
  { name: "ANP Job Description - Neighbourhood Template", type: "ANP", status: "Ready", documentUrl: "/documents/ANP_JOB_DESCRIPTION_for_Neighbourhood.docx" },
];

const getTypeColor = (type: string) => {
  switch (type) {
    case "GP":
      return "bg-blue-100 text-blue-800";
    case "ANP":
      return "bg-green-100 text-green-800";
    case "ACP":
      return "bg-teal-100 text-teal-800";
    case "Paeds ANP":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
};

export const SDAWorkforceInnovation = () => {
  const [isLantumSlideshowOpen, setIsLantumSlideshowOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Update Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Bell className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-amber-800">Update – 10 February 2026</p>
              <Badge className="bg-amber-500 text-white text-xs">Today</Badge>
            </div>
            <p className="text-sm text-amber-700 mt-1">
              Salaried GP Redundancy Liability briefing added — based on LMC/BMA guidance. See below for key points and full document download.
            </p>
          </div>
        </div>
      </div>

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
                  This briefing is prepared in response to questions posed to the Northants LMC and replies received from the LMC and the BMA's Employed Doctors team. <strong>This is not legal advice.</strong> PML have committed to bring more detailed updates and options to the Programme Board for consideration in due course.
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
                  Under the BMA model contract, contractual redundancy is calculated on <strong>all continuous NHS service</strong> — not just time with the employing practice. A GP with 10 years' prior NHS service employed for 2 years attracts 12 years' redundancy liability.
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="font-semibold text-green-800 text-sm mb-1">ICB Redundancy Guarantee – £305,219</p>
                <p className="text-xs text-green-700">
                  NHS Northamptonshire ICB has agreed an exceptional one-time Confidential Redundancy Fund of <strong>£305,219</strong> to underwrite potential redundancy exposure for Phase 1 neighbourhood sites, significantly de-risking participation.
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="font-semibold text-amber-800 text-sm mb-1">GMS Practices – Legal Obligation</p>
                <p className="text-xs text-amber-700">
                  GMS practices are <strong>legally bound by statutory instrument</strong> (SI 2004/291) to offer terms no less favourable than the BMA model contract. Non-compliance risks breach notices and potential contract withdrawal.
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
                  The ICB fund is a one-time pilot guarantee — not a precedent for future commissioning. The Board should consider structural options for longer-term sustainability beyond Phase 1.
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="font-semibold text-blue-800 text-sm mb-1">7 Options Analysed</p>
                <p className="text-xs text-blue-700">
                  The full paper analyses 7 contract options (A–G) with risk appraisals covering legal, financial, operational and reputational dimensions. The full document is available for download below.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <a href="/documents/NRES_GP_Redundancy_Briefing_1.docx" download>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Download Full Briefing Paper (Word)
              </Button>
            </a>
            <Badge variant="outline" className="text-xs text-muted-foreground">Confidential – Programme Board Only</Badge>
          </div>
        </div>
      </CollapsibleCard>


      {/* Job Description Templates */}
      <CollapsibleCard
        title="Job Description Templates"
        icon={<FileText className="w-5 h-5" />}
        defaultOpen={false}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {jobDescriptionTemplates.map((template, index) => (
            <div key={index} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <Badge className={getTypeColor(template.type)}>{template.type}</Badge>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {template.status}
                </Badge>
              </div>
              <p className="text-sm font-medium text-slate-900 mb-3">{template.name}</p>
              <a href={template.documentUrl} download>
                <Button size="sm" variant="outline" className="w-full gap-1">
                  <Download className="w-3 h-3" />
                  Download DOCX
                </Button>
              </a>
            </div>
          ))}
        </div>
      </CollapsibleCard>

      {/* Job Adverts for Board Approval */}
      <div id="job-adverts-section">
      <CollapsibleCard
        title="Job Adverts - Board Approved 23rd December 2025"
        icon={<Briefcase className="w-5 h-5" />}
        badge={<Badge className="bg-amber-500">{proposedJobAdverts.length} Adverts</Badge>}
        defaultOpen={false}
      >
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-800">PB 23/12/2025 Decision Made</p>
              <p className="text-sm text-green-700 mt-1">
                Decision made to recruit via practice or neighbourhood (TBC). Malcolm asked to create NHS Job Adverts and Indeed adverts - online as at 18:30 23rd December 2025.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <a 
                  href="https://www.jobs.nhs.uk/candidate/jobadvert/A2001-25-0007" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm bg-white px-3 py-1.5 rounded border border-green-300 text-green-700 hover:bg-green-100 transition-colors"
                >
                  NHS Jobs: GP Advert (Live)
                </a>
                <a 
                  href="https://www.jobs.nhs.uk/candidate/jobadvert/A2001-25-0008" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm bg-white px-3 py-1.5 rounded border border-green-300 text-green-700 hover:bg-green-100 transition-colors"
                >
                  NHS Jobs: ANP Advert (Live)
                </a>
                <a 
                  href="https://uk.indeed.com/viewjob?jk=7d63610dde290c3f&from=shareddesktop_copy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm bg-white px-3 py-1.5 rounded border border-green-300 text-green-700 hover:bg-green-100 transition-colors"
                >
                  Indeed: GP Advert (Live)
                </a>
                <a 
                  href="https://uk.indeed.com/viewjob?jk=7f87a870922d846f&from=shareddesktop_copy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm bg-white px-3 py-1.5 rounded border border-green-300 text-green-700 hover:bg-green-100 transition-colors"
                >
                  Indeed: ANP Advert (Live)
                </a>
                <a 
                  href="https://uk.indeed.com/viewjob?jk=975074cba816dd04&from=shareddesktop_copy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm bg-white px-3 py-1.5 rounded border border-green-300 text-green-700 hover:bg-green-100 transition-colors"
                >
                  Indeed: ACP Advert (Live)
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold">Reference</TableHead>
                <TableHead className="font-semibold">Role</TableHead>
                <TableHead className="font-semibold">Hub Location</TableHead>
                <TableHead className="font-semibold">Salary/Band</TableHead>
                <TableHead className="font-semibold">Closing Date</TableHead>
                <TableHead className="font-semibold">Key Requirements</TableHead>
                <TableHead className="font-semibold text-center">Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposedJobAdverts.map((advert) => (
                <TableRow key={advert.reference} className="hover:bg-slate-50">
                  <TableCell className="font-mono text-xs">{advert.reference}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-sm">{advert.title}</span>
                      <Badge className={`w-fit ${getTypeColor(advert.type)}`}>{advert.type}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{advert.location}</TableCell>
                  <TableCell className="text-sm">
                    {advert.band && <div className="font-semibold text-[#005EB8]">{advert.band}</div>}
                    <div>{advert.salary}</div>
                  </TableCell>
                  <TableCell className="text-sm">{advert.closingDate}</TableCell>
                  <TableCell>
                    <ul className="text-xs text-slate-600 space-y-0.5">
                      {advert.keyRequirements.map((req, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="text-slate-400">•</span>
                          {req}
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                  <TableCell className="text-center">
                    <a href={advert.documentUrl} download>
                      <Button size="sm" variant="outline" className="gap-1">
                        <Download className="w-3 h-3" />
                        <span className="text-xs">DOCX</span>
                      </Button>
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
            <p className="text-2xl font-bold text-blue-700">2</p>
            <p className="text-sm text-blue-600">GP Positions</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
            <p className="text-2xl font-bold text-green-700">2</p>
            <p className="text-sm text-green-600">ANP Positions</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
            <p className="text-2xl font-bold text-purple-700">1</p>
            <p className="text-sm text-purple-600">ACP Role Type</p>
          </div>
        </div>
      </CollapsibleCard>
      </div>

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
              <p className="text-4xl font-bold text-[#005EB8]">8.5</p>
              <p className="font-semibold text-slate-900 mt-1">GP WTE Sessions</p>
              <p className="text-sm text-slate-500">Assumes 12 appointments per session.</p>
              <a 
                href="https://www.jobs.nhs.uk/candidate/search/results?keyword=GP&location=Brackley&distance=5"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-sm text-[#005EB8] hover:underline cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                NHS Jobs
              </a>
            </div>
            <div className="bg-cyan-50 rounded-xl p-4 text-center">
              <p className="text-4xl font-bold text-cyan-600">6.9</p>
              <p className="font-semibold text-slate-900 mt-1">ACP WTE Sessions</p>
              <p className="text-sm text-slate-500">Advanced Clinical Practitioners (Prescribing).</p>
              <a 
                href="https://www.jobs.nhs.uk/candidate/search/results?keyword=Advanced%20Clinical%20Practitioner&location=Brackley&distance=5"
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

      {/* Lantum Meeting Section - 12th January 2026 */}
      <CollapsibleCard
        title="Lantum Meeting - 12th January 2026"
        icon={<Calendar className="w-5 h-5" />}
        badge={<Badge className="bg-purple-500">Options Analysis</Badge>}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Presentation className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-purple-800">Workforce Contingency Planning Presentation</p>
                <p className="text-sm text-purple-700 mt-1">
                  Board presentation exploring Lantum as a potential contingency option for workforce resilience during the SDA Pilot mobilisation phase.
                </p>
              </div>
            </div>
          </div>
          
          <div className="max-w-xs mx-auto">
            <LantumOptionsThumbnail onClick={() => setIsLantumSlideshowOpen(true)} />
            <p className="text-center text-sm text-muted-foreground mt-2">
              Click to view the full options analysis presentation
            </p>
          </div>
        </div>
      </CollapsibleCard>


      <LantumOptionsSlideshow 
        isOpen={isLantumSlideshowOpen} 
        onClose={() => setIsLantumSlideshowOpen(false)} 
      />
    </div>
  );
};
