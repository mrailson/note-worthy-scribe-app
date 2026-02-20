import { Card, CardContent } from "@/components/ui/card";
import { 
  Info, 
  Building2, 
  Users, 
  Calendar, 
  PoundSterling, 
  MapPin, 
  Clock, 
  FileCheck, 
  Stethoscope,
  Target,
  HeartPulse,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Scale,
  Network,
  Monitor,
  BookOpen,
  TrendingUp,
  Shield
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface GuideItem {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: "overview" | "requirements" | "benefits" | "operations";
}

const guideItems: GuideItem[] = [
  {
    number: 1,
    title: "What is the SDA Neighbourhood Pilot?",
    description: "A 2-year NHS innovation pilot testing new models of primary care delivery across the NRES neighbourhood. It's a Local Enhanced Service (LES) commissioned by the ICB to improve access, reduce workload, and share resources across 7 practices serving 89,584 patients.",
    icon: <Info className="w-5 h-5" />,
    category: "overview"
  },
  {
    number: 2,
    title: "Your Practice is Part of NRES",
    description: "NRES (Northamptonshire Rural East & South) is a GP neighbourhood comprising The Parks MC, Brackley MC, Springfield Surgery, Towcester MC, Bugbrooke Surgery, Brook Health Centre, and Denton Village Surgery. Together we're piloting neighbourhood-level service delivery.",
    icon: <Network className="w-5 h-5" />,
    category: "overview"
  },
  {
    number: 3,
    title: "This is a Local Enhanced Service (LES)",
    description: "The SDA is commissioned as a LES contract with the ICB. This sits alongside your core GMS/PMS contract. Participation requires your practice to sign up to the service specification and data sharing agreement.",
    icon: <FileCheck className="w-5 h-5" />,
    category: "requirements"
  },
  {
    number: 4,
    title: "Contract Value: £2,358,746.72 Per Year",
    description: "The total contract value is £2,358,746.72 per year across a 2-year pilot. Funding flows through the lead provider (DocMed/PML) and is distributed based on agreed activity and population metrics.",
    icon: <PoundSterling className="w-5 h-5" />,
    category: "benefits"
  },
  {
    number: 5,
    title: "Hub and Spoke Model",
    description: "Face-to-face appointments are split between a central Hub (30%) and Spoke locations at member practices (20%). This means some patients will travel to the hub, whilst others receive care at their registered practice as a spoke site.",
    icon: <Building2 className="w-5 h-5" />,
    category: "operations"
  },
  {
    number: 6,
    title: "50% Remote Consultations",
    description: "Half of all SDA appointments are delivered remotely via telephone or video. This is a mandatory requirement to maximise efficiency and enable clinicians to work from any location across the neighbourhood.",
    icon: <Monitor className="w-5 h-5" />,
    category: "operations"
  },
  {
    number: 7,
    title: "74,301 Additional Appointments Per Year",
    description: "The SDA will deliver approximately 74,301 additional clinical appointments annually across the neighbourhood. This capacity supplements your existing practice appointments and is shared across all member practices.",
    icon: <Calendar className="w-5 h-5" />,
    category: "benefits"
  },
  {
    number: 8,
    title: "Shared Workforce Model",
    description: "Clinical staff (GPs, ANPs, Pharmacists, HCAs) work across the neighbourhood, not just at their home practice. This enables skill-sharing, resilience, and more efficient use of workforce capacity.",
    icon: <Users className="w-5 h-5" />,
    category: "operations"
  },
  {
    number: 9,
    title: "Data Sharing Agreement Required",
    description: "A formal Data Sharing Agreement (DSA) governs how patient information flows between practices for SDA care. Your practice must be a signatory. The DSA has been developed with IG leads and complies with NHS data protection requirements.",
    icon: <Shield className="w-5 h-5" />,
    category: "requirements"
  },
  {
    number: 10,
    title: "Shared Clinical System Access",
    description: "Clinicians delivering SDA services require appropriate access to view and document in patient records across practices. EMIS cross-organisational working and record access arrangements are being established.",
    icon: <Stethoscope className="w-5 h-5" />,
    category: "requirements"
  },
  {
    number: 11,
    title: "Governance via Programme Board",
    description: "The SDA has a formal governance structure with a Programme Board meeting monthly. Each practice should have partner-level representation. Key decisions, risks, and progress are managed through this board.",
    icon: <Scale className="w-5 h-5" />,
    category: "operations"
  },
  {
    number: 12,
    title: "Go-Live Target: 1st April 2026",
    description: "The pilot is scheduled to commence on 1st April 2026. Between now and then, estates, workforce, IT systems, and governance arrangements need to be in place. Your practice should be preparing for operational changes.",
    icon: <Target className="w-5 h-5" />,
    category: "overview"
  },
  {
    number: 13,
    title: "Estates Requirements",
    description: "Your practice may need to provide clinical rooms for spoke appointments, or staff may work from the central hub. Room availability, equipment, and booking systems need to be coordinated across the neighbourhood.",
    icon: <MapPin className="w-5 h-5" />,
    category: "requirements"
  },
  {
    number: 14,
    title: "Impact on Practice Workload",
    description: "The SDA aims to reduce core practice pressure by handling same-day access demand at neighbourhood level. Your practice's direct patient contact for urgent requests should reduce, freeing capacity for continuity and complex care.",
    icon: <TrendingUp className="w-5 h-5" />,
    category: "benefits"
  },
  {
    number: 15,
    title: "Patient Communication",
    description: "Patients will need to understand they may be seen by a different clinician or at a different location for SDA appointments. Practice teams should be prepared to explain the new model and its benefits.",
    icon: <HeartPulse className="w-5 h-5" />,
    category: "operations"
  },
  {
    number: 16,
    title: "Quality & Outcome Measures",
    description: "The pilot includes specific KPIs around access times, patient satisfaction, clinical outcomes, and workforce sustainability. Data will be collected and reported to the ICB as part of the evaluation framework.",
    icon: <CheckCircle2 className="w-5 h-5" />,
    category: "requirements"
  },
  {
    number: 17,
    title: "Innovation & Learning",
    description: "As an Innovator Site, NRES is expected to test new approaches, share learning with other neighbourhoods, and contribute to system-wide transformation. Your feedback and ideas are actively encouraged.",
    icon: <Lightbulb className="w-5 h-5" />,
    category: "overview"
  },
  {
    number: 18,
    title: "Financial Distribution Model",
    description: "Practice payments are based on weighted capitation (list size) plus activity-based components. The exact distribution model is agreed through the Programme Board with transparency on how funds are allocated.",
    icon: <PoundSterling className="w-5 h-5" />,
    category: "benefits"
  },
  {
    number: 19,
    title: "Risk & Liability",
    description: "Clinical governance, indemnity, and vicarious liability arrangements are documented in the service specification. Clinicians remain accountable for their clinical decisions; organisational liability rests with the employing body.",
    icon: <AlertCircle className="w-5 h-5" />,
    category: "requirements"
  },
  {
    number: 20,
    title: "What You Need To Do",
    description: "Ensure partner-level engagement with the Programme Board, sign the Data Sharing Agreement, prepare your team for operational changes, identify room capacity for spoke appointments, and communicate with patients about the new model.",
    icon: <BookOpen className="w-5 h-5" />,
    category: "requirements"
  }
];

const categoryColors = {
  overview: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: "text-blue-600" },
  requirements: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: "text-amber-600" },
  benefits: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: "text-green-600" },
  operations: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", icon: "text-purple-600" }
};

const categoryLabels = {
  overview: "Overview",
  requirements: "Requirements",
  benefits: "Benefits",
  operations: "Operations"
};

export const SDAPartnerQuickGuide = () => {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <div className="w-2 h-2 rounded-full bg-blue-600 mr-2" />
          Overview
        </Badge>
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          <div className="w-2 h-2 rounded-full bg-amber-600 mr-2" />
          Requirements
        </Badge>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <div className="w-2 h-2 rounded-full bg-green-600 mr-2" />
          Benefits
        </Badge>
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
          <div className="w-2 h-2 rounded-full bg-purple-600 mr-2" />
          Operations
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {guideItems.map((item) => {
          const colors = categoryColors[item.category];
          return (
            <Card 
              key={item.number} 
              className={`${colors.bg} border ${colors.border} hover:shadow-md transition-shadow`}
            >
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-white flex items-center justify-center ${colors.icon} font-bold text-sm shadow-sm`}>
                    {item.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className={`font-semibold text-sm ${colors.text} leading-tight`}>
                        {item.title}
                      </h4>
                      <div className={`flex-shrink-0 ${colors.icon}`}>
                        {item.icon}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 p-4 bg-slate-100 rounded-lg border border-slate-200">
        <p className="text-xs text-slate-600 text-center">
          <strong>Questions?</strong> Contact your Practice Manager or the NRES Programme Lead for more information about the SDA Neighbourhood Pilot.
        </p>
      </div>
    </div>
  );
};
