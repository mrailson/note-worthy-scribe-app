import { useState } from "react";
import { Header } from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SDAExecutiveSummary } from "@/components/sda/SDAExecutiveSummary";
import { SDAEstatesCapacity } from "@/components/sda/SDAEstatesCapacity";
import { SDADigitalIntegration } from "@/components/sda/SDADigitalIntegration";
import { SDAWorkforceInnovation } from "@/components/sda/SDAWorkforceInnovation";
import { SDAFinanceGovernance } from "@/components/sda/SDAFinanceGovernance";
import { SDARisksMitigation } from "@/components/sda/SDARisksMitigation";
import { SDAEvidenceLibrary } from "@/components/sda/SDAEvidenceLibrary";
import { SDAFeedbackButton } from "@/components/sda/SDAFeedbackButton";
import { NRESHoursTracker } from "@/components/nres/hours-tracker/NRESHoursTracker";
import { 
  LayoutDashboard, 
  Building2, 
  Monitor, 
  Users, 
  PoundSterling, 
  AlertTriangle, 
  FolderOpen,
  Clock
} from "lucide-react";

const SDADashboard = () => {
  const [activeTab, setActiveTab] = useState("executive");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <Header />
      
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-[#005EB8] via-[#003087] to-[#002060] text-white">
        <div className="max-w-[1500px] w-full mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-blue-200 text-sm font-medium tracking-wider uppercase mb-1">
                Northamptonshire Rural East & South
              </p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Neighbourhood SDA Programme
              </h1>
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
              <span className="hidden sm:inline">IT & Digital</span>
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
              value="risks" 
              className="flex items-center gap-2 data-[state=active]:bg-[#005EB8] data-[state=active]:text-white px-4 py-2.5 rounded-lg transition-all"
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">Risks & Mitigation</span>
              <span className="sm:hidden">Risks</span>
            </TabsTrigger>
            <TabsTrigger 
              value="finance" 
              className="flex items-center gap-2 data-[state=active]:bg-[#005EB8] data-[state=active]:text-white px-4 py-2.5 rounded-lg transition-all"
            >
              <PoundSterling className="w-4 h-4" />
              <span className="hidden sm:inline">Finance & Governance</span>
              <span className="sm:hidden">Finance</span>
            </TabsTrigger>
            <TabsTrigger 
              value="evidence" 
              className="flex items-center gap-2 data-[state=active]:bg-[#005EB8] data-[state=active]:text-white px-4 py-2.5 rounded-lg transition-all"
            >
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Evidence Library</span>
              <span className="sm:hidden">Evidence</span>
            </TabsTrigger>
            <TabsTrigger 
              value="hours" 
              className="flex items-center gap-2 data-[state=active]:bg-[#005EB8] data-[state=active]:text-white px-4 py-2.5 rounded-lg transition-all"
            >
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Hours Tracker</span>
              <span className="sm:hidden">Hours</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6 pb-8">
            <TabsContent value="executive" className="mt-0">
              <SDAExecutiveSummary />
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
            <TabsContent value="risks" className="mt-0">
              <SDARisksMitigation />
            </TabsContent>
            <TabsContent value="finance" className="mt-0">
              <SDAFinanceGovernance />
            </TabsContent>
            <TabsContent value="evidence" className="mt-0">
              <SDAEvidenceLibrary />
            </TabsContent>
            <TabsContent value="hours" className="mt-0">
              <NRESHoursTracker />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default SDADashboard;
