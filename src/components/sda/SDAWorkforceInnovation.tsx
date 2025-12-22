import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Lightbulb, Truck, Heart, FileText, AlertCircle, Briefcase } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";

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
  },
];

// Job description templates available
const jobDescriptionTemplates = [
  { name: "GP Job Description - Brackley Medical Centre", type: "GP", status: "Ready" },
  { name: "GP Job Description - Neighbourhood Template", type: "GP", status: "Ready" },
  { name: "ANP Job Description - Neighbourhood Template", type: "ANP", status: "Ready" },
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
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Decisions Outstanding</p>
              <ul className="text-sm text-amber-700 mt-1 space-y-1">
                <li>• Employment route not yet decided: PML, Neighbourhood, Practice, or combination</li>
                <li>• PML overhead costs outstanding for this decision</li>
              </ul>
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
              <p className="text-sm font-medium text-slate-900">{template.name}</p>
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
        <p className="text-sm text-slate-600">
          Mapping complete for patient engagement, LTC support, and connecting residents to local community health champions.
        </p>
      </CollapsibleCard>
    </div>
  );
};
