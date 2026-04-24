import { useState } from "react";
import { NRESHeader } from "@/components/nres/NRESHeader";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SDAExecutiveSummary } from "@/components/sda/SDAExecutiveSummary";
import { SDAEstatesCapacity } from "@/components/sda/SDAEstatesCapacity";
import { SDADigitalIntegration } from "@/components/sda/SDADigitalIntegration";
import { NRESDocumentVault } from "@/components/nres/vault/NRESDocumentVault";
import { NRESHoursTracker } from "@/components/nres/hours-tracker/NRESHoursTracker";
import { 
  LayoutDashboard, 
  Building2, 
  Monitor, 
  FolderLock,
  Clock,
} from "lucide-react";
import { NRESPeopleProvider } from "@/contexts/NRESPeopleContext";



const tabs = [
  { value: "executive", label: "Executive Summary", shortLabel: "Summary", icon: LayoutDashboard },
  { value: "estates", label: "Estates & Capacity", shortLabel: "Estates", icon: Building2 },
  { value: "digital", label: "IT & Reporting", shortLabel: "Digital", icon: Monitor },
  { value: "hours", label: "SDA Claims", shortLabel: "Claims", icon: Clock },
  { value: "document-vault", label: "NRES Document Vault Home", shortLabel: "Vault", icon: FolderLock },
];

const SDADashboard = () => {
  const [activeTab, setActiveTab] = useState("executive");

  return (
    <NRESPeopleProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
        {/* Band 1: Combined app bar + programme context */}
        <NRESHeader activeTab={activeTab} />

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
                <SDAExecutiveSummary />
              </TabsContent>
              <TabsContent value="estates" className="mt-0">
                <SDAEstatesCapacity />
              </TabsContent>
              <TabsContent value="digital" className="mt-0">
                <SDADigitalIntegration />
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

export default SDADashboard;
