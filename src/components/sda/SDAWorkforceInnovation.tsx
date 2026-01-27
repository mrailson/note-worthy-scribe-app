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
              <p className="font-semibold text-amber-800">Update - 27 Jan 2026</p>
              <Badge className="bg-amber-500 text-white text-xs">Today</Badge>
            </div>
            <p className="text-sm text-amber-700 mt-1">
              <strong>Application deadline:</strong> Close of business today (27th Jan).
            </p>
            <p className="text-sm text-amber-700 mt-1">
              <strong>Expected by Friday:</strong> 5 further applications for GP and 5 for ACP to be loaded.
            </p>
          </div>
        </div>
      </div>

      {/* PRIORITY SECTION: Candidate Assessments */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-8 w-1.5 bg-gradient-to-b from-blue-500 to-teal-500 rounded-full" />
          <h2 className="text-lg font-semibold text-slate-800">Candidate Assessments - Action Required</h2>
        </div>
        
        {/* GP Recruitment - Candidate Assessment */}
        <CollapsibleCard
          title="GP Recruitment - Candidate Assessment"
          icon={<UserCheck className="w-5 h-5" />}
          badge={<Badge className="bg-blue-500">7 Applicants</Badge>}
          defaultOpen={false}
        >
          <GPRecruitmentPanel />
        </CollapsibleCard>

        {/* ACP Recruitment - Candidate Assessment */}
        <CollapsibleCard
          title="ACP Recruitment - Candidate Assessment"
          icon={<ClipboardCheck className="w-5 h-5" />}
          badge={<Badge className="bg-teal-500">9 Applicants</Badge>}
          defaultOpen={false}
        >
          <ACPRecruitmentPanel />
        </CollapsibleCard>
      </div>

      {/* Divider */}
      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-4 text-sm text-muted-foreground">Supporting Resources</span>
        </div>
      </div>

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
