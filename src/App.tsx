import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import AI4GP from "./pages/AI4GP";
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
import ComplianceDocumentation from "./pages/ComplianceDocumentation";
import SecurityCompliance from "./pages/SecurityCompliance";

import NotFound from "./pages/NotFound";
import { ResetPassword } from "./components/ResetPassword";
import { ProtectedRoute } from "./components/ProtectedRoute";


const App = () => (
  <TooltipProvider>
    <Routes>
      <Route path="/" element={<Index />} />
          <Route path="/ai4gp" element={<AI4GP />} />
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
      <Route path="/shared-drive" element={
        <ProtectedRoute requiredModule="shared_drive_access">
          <SharedDrive />
        </ProtectedRoute>
      } />
      
      
      <Route path="/ai-4-pm" element={<AI4PMService />} />
      <Route path="/enhanced-access" element={<EnhancedAccess />} />
      <Route path="/cqc-compliance" element={
        <ProtectedRoute requiredModule="cqc_compliance">
          <CQCCompliance />
        </ProtectedRoute>
      } />
      <Route path="/compliance-docs" element={<ComplianceDocumentation />} />
      <Route path="/security-compliance" element={<SecurityCompliance />} />
      
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </TooltipProvider>
);

export default App;