import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import GPScribe from "./pages/GPScribe";
import GPScribeSettings from "./pages/GPScribeSettings";
import MeetingHistory from "./pages/MeetingHistory";
import MeetingSummary from "./pages/MeetingSummary";
import ConsultationSummary from "./pages/ConsultationSummary";
import Settings from "./pages/Settings";
import SystemAdmin from "./pages/SystemAdmin";
import ComplaintsSystem from "./pages/ComplaintsSystem";
import ComplaintDetails from "./pages/ComplaintDetails";
import ComplaintResponse from "./pages/ComplaintResponse";
import SharedDrive from "./pages/SharedDrive";

import AI4PMService from "./pages/AI4PMService";
import EnhancedAccess from "./pages/EnhancedAccess";
import CQCCompliance from "./pages/CQCCompliance";
import ContractorFinder from "./pages/ContractorFinder";

import NotFound from "./pages/NotFound";
import { ResetPassword } from "./components/ResetPassword";


const App = () => (
  <TooltipProvider>
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/gp-scribe" element={<GPScribe />} />
      <Route path="/gp-scribe/settings" element={<GPScribeSettings />} />
      <Route path="/meetings" element={<MeetingHistory />} />
      <Route path="/meeting-history" element={<MeetingHistory />} />
      <Route path="/meeting-summary" element={<MeetingSummary />} />
      <Route path="/consultation-summary" element={<ConsultationSummary />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/admin" element={<SystemAdmin />} />
      <Route path="/complaints" element={<ComplaintsSystem />} />
      <Route path="/complaints/:complaintId" element={<ComplaintDetails />} />
      <Route path="/complaint-response/:accessToken" element={<ComplaintResponse />} />
      <Route path="/shared-drive" element={<SharedDrive />} />
      
      
      <Route path="/ai-4-pm" element={<AI4PMService />} />
      <Route path="/enhanced-access" element={<EnhancedAccess />} />
      <Route path="/cqc-compliance" element={<CQCCompliance />} />
      <Route path="/contractor-finder" element={<ContractorFinder />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </TooltipProvider>
);

export default App;