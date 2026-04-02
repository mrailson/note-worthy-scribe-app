import { useState, lazy } from "react";
import { ennProgrammePlan } from "@/data/ennProgrammePlanData";
import { ennGuideItems } from "@/data/ennGuideItems";
import { Header } from "@/components/Header";
import ennPcnLogo from "@/assets/enn-pcn-logo.png";
import threeSixtyLogo from "@/assets/3sixty-logo.png";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SDAExecutiveSummary } from "@/components/sda/SDAExecutiveSummary";
import { ENNEstatesCapacity } from "@/components/enn/ENNEstatesCapacity";
import { SDADigitalIntegration } from "@/components/sda/SDADigitalIntegration";
const ENNWorkforceInnovation = lazy(() => import("@/components/enn/ENNWorkforceInnovation"));
import { NRESDocumentVault } from "@/components/nres/vault/NRESDocumentVault";
import { SDAFeedbackButton } from "@/components/sda/SDAFeedbackButton";
import { NRESHoursTracker } from "@/components/nres/hours-tracker/NRESHoursTracker";

const ENNBoardPresentationExplainer = lazy(() => import("@/components/enn/ENNBoardPresentationExplainer"));
const ENNReportingRequirements = lazy(() => import("@/components/enn/ENNReportingRequirements"));
import { 
  LayoutDashboard, 
  Building2, 
  Monitor, 
  Users, 
  FolderLock,
  Clock
} from "lucide-react";
import { NRESPeopleProvider } from "@/contexts/NRESPeopleContext";

/** ENN practice population breakdown (Jan 2026 list sizes) */
const ennPopulationData = [
  { name: "Harborough Fields", value: 13991, color: "#005EB8" },
  { name: "Parklands", value: 13612, color: "#003087" },
  { name: "Spinney Brook", value: 11537, color: "#41B6E6" },
  { name: "Oundle", value: 10600, color: "#768692" },
  { name: "The Cottons", value: 9372, color: "#0072CE" },
  { name: "Rushden", value: 9143, color: "#AE2573" },
  { name: "Nene Valley", value: 6921, color: "#00A499" },
  { name: "The Meadows", value: 6340, color: "#330072" },
  { name: "Higham Ferrers", value: 5569, color: "#ED8B00" },
  { name: "Marshalls Road", value: 3156, color: "#DA291C" },
];

const ENNDashboard = () => {
  const [activeTab, setActiveTab] = useState("executive");

  return (
    <NRESPeopleProvider>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <Header />
      
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-[#005EB8] via-[#003087] to-[#002060] text-white">
        <div className="max-w-[1500px] w-full mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-blue-200 text-sm font-medium tracking-wider uppercase mb-1">
                  East Northants Neighbourhood
                </p>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                  Neighbourhood SDA Programme
                </h1>
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end gap-3">
              
              <p className="text-blue-200 text-sm">
                Projected Go-Live: <span className="text-white font-semibold">1st July 2026</span>
              </p>
              <SDAFeedbackButton currentSection={activeTab} />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-[1500px] w-full mx-auto px-4 -mt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-auto flex flex-wrap justify-start gap-1 bg-white/80 backdrop-blur-sm shadow-lg rounded-xl p-2 border border-slate-200">
            <TabsTrigger 
              value="executive" 
              className="flex items-center gap-2 data-[state=active]:bg-[#005EB8] data-[state=active]:text-white px-4 py-2.5 rounded-lg transition-all"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Executive Summary</span>
              <span className="sm:hidden">Summary</span>
            </TabsTrigger>
            <TabsTrigger 
              value="estates" 
              className="flex items-center gap-2 data-[state=active]:bg-[#005EB8] data-[state=active]:text-white px-4 py-2.5 rounded-lg transition-all"
            >
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Estates & Capacity</span>
              <span className="sm:hidden">Estates</span>
            </TabsTrigger>
            <TabsTrigger 
              value="digital" 
              className="flex items-center gap-2 data-[state=active]:bg-[#005EB8] data-[state=active]:text-white px-4 py-2.5 rounded-lg transition-all"
            >
              <Monitor className="w-4 h-4" />
              <span className="hidden sm:inline">IT & Reporting</span>
              <span className="sm:hidden">Digital</span>
            </TabsTrigger>
            <TabsTrigger 
              value="workforce" 
              className="flex items-center gap-2 data-[state=active]:bg-[#005EB8] data-[state=active]:text-white px-4 py-2.5 rounded-lg transition-all"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Workforce</span>
              <span className="sm:hidden">Workforce</span>
            </TabsTrigger>
            <TabsTrigger 
              value="hours" 
              className="flex items-center gap-2 data-[state=active]:bg-[#005EB8] data-[state=active]:text-white px-4 py-2.5 rounded-lg transition-all"
            >
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Claims &amp; Oversight</span>
              <span className="sm:hidden">Claims</span>
            </TabsTrigger>
            <TabsTrigger 
              value="document-vault" 
              className="flex items-center gap-2 data-[state=active]:bg-[#005EB8] data-[state=active]:text-white px-4 py-2.5 rounded-lg transition-all"
            >
              <FolderLock className="w-4 h-4" />
              <span className="hidden sm:inline">ENN Document Vault Home</span>
              <span className="sm:hidden">Vault</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6 pb-8">
            <TabsContent value="executive" className="mt-0">
              <SDAExecutiveSummary 
                customLogos={[
                  { src: ennPcnLogo, alt: "East Northants PCN" },
                  { src: threeSixtyLogo, alt: "3Sixty Care Partnership" }
                ]}
                patientListSize={90241}
                practiceCount={10}
                annualCapacity={74846}
                populationBreakdown={ennPopulationData}
                customMetrics={{
                  patientListSize: '90,241',
                  practiceCount: '10',
                  annualCapacity: '74,846',
                  contractValue: '£2.38m',
                  contractDetail: '£2,376,045.53 p/a · 2-year pilot',
                }}
                goLiveDate={new Date(2026, 6, 1)}
                neighbourhoodName="ENN"
                CustomReportingRequirements={ENNReportingRequirements}
                CustomBuybackExplainer={ENNBoardPresentationExplainer}
                customActionLogData={[]}
                customActionLogMetadata={{ sourceMeeting: '', nextMeeting: 'TBC', lastUpdated: '02/04/2026' }}
                customApptStats={{
                  remoteAppts: '37,423',
                  f2fAppts: '37,423',
                  hubPercent: '30%',
                  hubAppts: '22,454',
                  spokePercent: '20%',
                  spokeAppts: '14,969',
                }}
                customProgrammePlan={ennProgrammePlan}
                customMaintainedBy={{ name: 'Rebecca Gane', organisation: '3Sixty Care Partnership', email: 'Rebecca.Gane@nhft.nhs.uk' }}
                customGuideItems={ennGuideItems}
              />
            </TabsContent>
            <TabsContent value="estates" className="mt-0">
              <ENNEstatesCapacity />
            </TabsContent>
            <TabsContent value="digital" className="mt-0">
              <SDADigitalIntegration />
            </TabsContent>
            <TabsContent value="workforce" className="mt-0">
              <ENNWorkforceInnovation />
            </TabsContent>
            <TabsContent value="hours" className="mt-0">
              <NRESHoursTracker />
            </TabsContent>
            <TabsContent value="document-vault" className="mt-0">
              <NRESDocumentVault />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
    </NRESPeopleProvider>
  );
};

export default ENNDashboard;
