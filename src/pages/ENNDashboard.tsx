import { useState, lazy, Suspense } from "react";
import { ennProgrammePlan } from "@/data/ennProgrammePlanData";
import { ennGuideItems } from "@/data/ennGuideItems";
import { ENNHeader } from "@/components/enn/ENNHeader";
import ennPcnLogo from "@/assets/enn-pcn-logo.png";
import threeSixtyLogo from "@/assets/3sixty-logo.png";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SDAExecutiveSummary } from "@/components/sda/SDAExecutiveSummary";
import { ENNEstatesCapacity } from "@/components/enn/ENNEstatesCapacity";
import { SDADigitalIntegration as ENNDigitalIntegration } from "@/components/enn/ENNDigitalIntegration";
const ENNWorkforceInnovation = lazy(() => import("@/components/enn/ENNWorkforceInnovation"));
import { ENNDocumentVaultV2 } from '@/components/enn/vault/ENNDocumentVaultV2';
import { NRESHoursTracker } from "@/components/nres/hours-tracker/NRESHoursTracker";

const ENNNeighbourhoodMap = lazy(() => import("@/components/enn/ENNNeighbourhoodMap").then(m => ({ default: m.ENNNeighbourhoodMap })));
const ENNReportingRequirements = lazy(() => import("@/components/enn/ENNReportingRequirements"));
const ENNCUCCAttendance = lazy(() => import("@/components/enn/ENNCUCCAttendance"));
import {
  LayoutDashboard,
  Building2,
  Monitor,
  Users,
  FolderLock,
  Clock,
  Hospital,
} from "lucide-react";
import { ENNPeopleProvider } from "@/contexts/ENNPeopleContext";

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

const tabs = [
  { value: "executive", label: "Executive Summary", shortLabel: "Summary", icon: LayoutDashboard },
  { value: "estates", label: "Estates & Capacity", shortLabel: "Estates", icon: Building2 },
  { value: "digital", label: "IT & Reporting", shortLabel: "Digital", icon: Monitor },
  { value: "workforce", label: "Workforce", shortLabel: "Workforce", icon: Users },
  { value: "hours", label: "Claims & Oversight", shortLabel: "Claims", icon: Clock },
  { value: "document-vault", label: "ENN Document Vault Home", shortLabel: "Vault", icon: FolderLock },
];

const ENNDashboard = () => {
  const [activeTab, setActiveTab] = useState("executive");

  return (
    <ENNPeopleProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
        {/* Band 1: Combined app bar + programme context */}
        <ENNHeader activeTab={activeTab} />

        {/* Band 2: Tab navigation */}
        <div className="bg-white border-b border-slate-200 sticky top-12 z-40 shadow-sm">
          <div className="max-w-[1500px] mx-auto px-4">
            <nav className="flex items-center gap-0 overflow-x-auto no-scrollbar" role="tablist">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.value)}
                    className={`
                      flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 shrink-0
                      ${isActive
                        ? 'border-[#00A499] text-[#005EB8]'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                      }
                    `}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.shortLabel}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Page content */}
        <div className="max-w-[1500px] w-full mx-auto px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="mt-4 pb-8">
              <TabsContent value="executive" className="mt-0">
                <SDAExecutiveSummary
                  customLogos={[
                    { src: ennPcnLogo, alt: "East Northants PCN" },
                    { src: threeSixtyLogo, alt: "3Sixty Care Partnership" },
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
                  CustomBuybackExplainer={ENNNeighbourhoodMap}
                  customBuybackLabel={{
                    title: "Neighbourhood Map & Drive Times",
                    subtitle: "Interactive hub, spoke & drive time explorer",
                    badge: "INTERACTIVE",
                    date: "04 April 2026",
                  }}
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
                <ENNDigitalIntegration />
              </TabsContent>
              <TabsContent value="workforce" className="mt-0">
                <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                  <ENNWorkforceInnovation />
                </Suspense>
              </TabsContent>
              <TabsContent value="hours" className="mt-0">
                <NRESHoursTracker
                  neighbourhoodName="ENN"
                  hideEvidenceLibrary
                  hideBoardLeadership
                  interactiveInsurance
                />
              </TabsContent>
              <TabsContent value="document-vault" className="mt-0">
                <ENNDocumentVaultV2 />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </ENNPeopleProvider>
  );
};

export default ENNDashboard;
