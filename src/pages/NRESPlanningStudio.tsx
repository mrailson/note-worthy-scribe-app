import { NRESHeader } from "@/components/nres/NRESHeader";
import NHCPlanningStudio from "@/components/nres/nhc/NHCPlanningStudio";
import { NRESPeopleProvider } from "@/contexts/NRESPeopleContext";

const NRESPlanningStudio = () => {
  return (
    <NRESPeopleProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
        <NRESHeader />
        <div className="max-w-[1500px] w-full mx-auto px-4 pt-4 pb-8">
          <NHCPlanningStudio />
        </div>
      </div>
    </NRESPeopleProvider>
  );
};

export default NRESPlanningStudio;
