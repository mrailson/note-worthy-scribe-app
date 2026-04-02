import { useState } from "react";
import { Header } from "@/components/Header";
import ennPcnLogo from "@/assets/enn-pcn-logo.png";
import threeSixtyLogo from "@/assets/3sixty-logo.png";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SDAExecutiveSummary } from "@/components/sda/SDAExecutiveSummary";
import { SDAEstatesCapacity } from "@/components/sda/SDAEstatesCapacity";
import { SDADigitalIntegration } from "@/components/sda/SDADigitalIntegration";
import { SDAWorkforceInnovation } from "@/components/sda/SDAWorkforceInnovation";
import { NRESDocumentVault } from "@/components/nres/vault/NRESDocumentVault";
import { SDAFeedbackButton } from "@/components/sda/SDAFeedbackButton";
import { NRESHoursTracker } from "@/components/nres/hours-tracker/NRESHoursTracker";
import { 
  LayoutDashboard, 
  Building2, 
  Monitor, 
  Users, 
  FolderLock,
  Clock
} from "lucide-react";
import { NRESPeopleProvider } from "@/contexts/NRESPeopleContext";

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
                Projected Go-Live: <span className="text-white font-semibold">1st April 2026</span>
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
              <SDAExecutiveSummary customLogos={[
                { src: ennPcnLogo, alt: "East Northants PCN" },
                { src: threeSixtyLogo, alt: "3Sixty Care Partnership" }
              ]} />
            </TabsContent>
            <TabsContent value="estates" className="mt-0">
              <SDAEstatesCapacity />
            </TabsContent>
            <TabsContent value="digital" className="mt-0">
              <SDADigitalIntegration />
            </TabsContent>
            <TabsContent value="workforce" className="mt-0">
              <SDAWorkforceInnovation />
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
