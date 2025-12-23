import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Lightbulb, Truck, Heart, FileText, AlertCircle, Briefcase, Download } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Button } from "@/components/ui/button";

// Proposed job adverts for Programme Board approval
const proposedJobAdverts = [
  {
    reference: "NRES-BMC-GP-2526",
    title: "General Practitioner for New Models of Care",
    location: "Brackley Medical Centre",
    salary: "£11,000 per session",
    band: null,
    closingDate: "9 January 2026",
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
    closingDate: "9 January 2026",
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
    closingDate: "9 January 2026",
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
    closingDate: "9 January 2026",
    type: "ANP",
    keyRequirements: ["NMC registration (Adult Nursing)", "Independent Non-Medical Prescriber (V300)", "MSc in Advanced Clinical Practice"],
    documentUrl: "/documents/NRES_ANP_Parks_Job_Advert.docx",
  },
  {
    reference: "NRES-PARKS-Paeds_ANP-2526",
    title: "Paediatric Advanced Nurse Practitioner",
    location: "The Parks Medical Practice",
    salary: "£55,690 - £62,682 per annum",
    band: "Band 8a",
    closingDate: "9 January 2026",
    type: "Paeds ANP",
    keyRequirements: ["NMC registration (Children's Nurse)", "MSc in Advanced Clinical Practice", "Independent Prescriber (V300)"],
    documentUrl: "/documents/NRES_Paeds_ANP_Parks_Job_Advert.docx",
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
    case "Paeds ANP":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
};

export const SDAWorkforceInnovation = () => {
  return (
    <div className="space-y-6">
      {/* Proposed Job Adverts for Board Approval */}
      <CollapsibleCard
        title="Proposed Job Adverts for Programme Board Approval"
        icon={<Briefcase className="w-5 h-5" />}
        badge={<Badge className="bg-amber-500">{proposedJobAdverts.length} Adverts</Badge>}
      >
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-800">PB 23/12/2025 Decision Made</p>
              <p className="text-sm text-green-700 mt-1">
                Decision made to recruit via practice or neighbourhood (TBC). Malcolm asked to create NHS Job Adverts and online as at 18:30 23rd December 2025.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <a 
                  href="https://www.jobs.nhs.uk/candidate/jobadvert/A2001-25-0007" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm bg-white px-3 py-1.5 rounded border border-green-300 text-green-700 hover:bg-green-100 transition-colors"
                >
                  GP Job Advert
                </a>
                <a 
                  href="https://www.jobs.nhs.uk/candidate/jobadvert/A2001-25-0008" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm bg-white px-3 py-1.5 rounded border border-green-300 text-green-700 hover:bg-green-100 transition-colors"
                >
                  ANP Job Advert
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
            <p className="text-sm text-purple-600">Paediatric ANP</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workforce Requirements */}
        <CollapsibleCard
          title="Workforce Requirements"
          icon={<Users className="w-5 h-5" />}
          badge={<Badge className="bg-[#005EB8]">WTE</Badge>}
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-4xl font-bold text-[#005EB8]">8.5</p>
                <p className="font-semibold text-slate-900 mt-1">GP WTE Sessions</p>
                <p className="text-sm text-slate-500">Assumes 26 appointments per day per session.</p>
              </div>
              <div className="bg-cyan-50 rounded-xl p-4 text-center">
                <p className="text-4xl font-bold text-cyan-600">6.9</p>
                <p className="font-semibold text-slate-900 mt-1">ACP WTE Sessions</p>
                <p className="text-sm text-slate-500">Advanced Clinical Practitioners (Prescribing).</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-4">
              <div className="w-10 h-10 rounded-full bg-[#005EB8] flex items-center justify-center">
                <span className="text-white font-bold">AP</span>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Anshal Pratyush</p>
                <p className="text-sm text-slate-500">Recruitment Strategy Lead</p>
              </div>
            </div>
          </div>
        </CollapsibleCard>

        {/* Innovation Component */}
        <CollapsibleCard
          title="Innovation Component (£306k Budget)"
          icon={<Lightbulb className="w-5 h-5 text-amber-500" />}
        >
          <div className="space-y-4">
            <div className="border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 mb-3">"Hot Clinics" Programme</h4>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#005EB8]"></span>
                  Paediatric Sprains (10-14 yrs)
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#005EB8]"></span>
                  COPD Remote Monitoring
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#005EB8]"></span>
                  Frailty GPwSI Strategy
                </li>
              </ul>
            </div>

            <div className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4 text-[#005EB8]" />
                <h4 className="font-semibold text-slate-900">Mobile Outreach Van</h4>
              </div>
              <p className="text-sm text-slate-600 italic">
                "Following the University of Huddersfield model, a mobile clinic van will support hard-to-reach rural residents in South Northants."
              </p>
            </div>
          </div>
        </CollapsibleCard>
      </div>

      {/* VCSE Partners */}
      <CollapsibleCard
        title="VCSE Infrastructure Partners"
        icon={<Heart className="w-5 h-5 text-pink-500" />}
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            "Aspire Northants",
            "Black Communities Together",
            "Social Action West Northants",
            "Age Well Asset Groups"
          ].map((partner, index) => (
            <Badge key={index} variant="outline" className="bg-pink-50 text-pink-700 border-pink-200 px-3 py-1">
              {partner}
            </Badge>
          ))}
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Mapping complete for patient engagement, LTC support, and connecting residents to local community health champions.
        </p>

        {/* Task & Finish Meeting 22 Dec 2025 */}
        <div className="border-t border-slate-200 pt-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Task & Finish Meeting: 22 Dec 2025
            </Badge>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-green-900 mb-2">Meeting Summary</h4>
            <p className="text-sm text-green-800">
              Discussed integration of voluntary sector into South Rural innovation site and SDA project. Primary focus on collaboration to improve patient outcomes in long-term and complex care, whilst ensuring financial viability.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 text-sm mb-2">Key Outcomes</h4>
              <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
                <li>VCSE representation on Programme Board agreed</li>
                <li>Helen & Russ to act as conduit to wider sector</li>
                <li>Innovation Fund available for practice pilots</li>
                <li>Two-year pilot to demonstrate ROI to ICB</li>
              </ul>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 text-sm mb-2">Target Cohorts (Feb 2026)</h4>
              <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
                <li>Frailty</li>
                <li>Children&apos;s mental health in schools</li>
                <li>Diabetes/Hypertension</li>
                <li>Long-term complex conditions</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-4">
            <h4 className="font-semibold text-blue-900 text-sm mb-2">Priority Actions</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">High</Badge>
                <span className="text-slate-700">Helen & Russ: Confirm Board representation by 05/01</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">High</Badge>
                <span className="text-slate-700">Helen: Attend Programme Board 23 Dec at BMC</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Med</Badge>
                <span className="text-slate-700">Maureen: Send background presentations by 05/01</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">High</Badge>
                <span className="text-slate-700">TBC: Establish KPIs with ICB/Neighbourhoods (Feb)</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Attendees: Mark Graham (PML), Amanda Taylor, Maureen Green (PML), Ellie, Russ, Helen
          </p>
        </div>
      </CollapsibleCard>
    </div>
  );
};
