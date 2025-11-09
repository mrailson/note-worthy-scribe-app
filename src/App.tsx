import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { SecurityWrapper } from '@/components/SecurityWrapper';
import { useSessionActivity } from '@/hooks/useSessionActivity';
import { useEffect } from 'react';
import { getSafeDOMObserver, installHasAttributeSafeguard } from '@/utils/domSafetyPolyfill';
import Index from "./pages/Index";
import AI4GP from "./pages/AI4GP";
import GPScribe from "./pages/GPScribe";
import GPScribeSettings from "./pages/GPScribeSettings";
import MeetingHistory from "./pages/MeetingHistory";
import MeetingSummary from "./pages/MeetingSummary";
import ConsultationSummary from "./pages/ConsultationSummary";
import Settings from "./pages/Settings";
import SystemAdmin from "./pages/SystemAdmin";
import PracticeAdmin from "./pages/PracticeAdmin";
import PracticeAdminFridges from "./pages/PracticeAdminFridges";
import { FridgeTemperatureEntry } from "./components/FridgeTemperatureEntry";
import ComplaintsSystem from "./pages/ComplaintsSystem";
import ComplaintDetails from "./pages/ComplaintDetails";
import ComplaintResponse from "./pages/ComplaintResponse";
import ComplaintsPresentationMode from "./pages/ComplaintsPresentationMode";
import StaffFeedback from "./pages/StaffFeedback";
import SharedDrive from "./pages/SharedDrive";
import Auth from "./pages/Auth";
import AI4PMService from "./pages/AI4PMService";
import CQCCompliance from "./pages/CQCCompliance";
import ComplianceDocumentation from "./pages/ComplianceDocumentation";
import SecurityCompliance from "./pages/SecurityCompliance";
import TranslationTool from "./pages/TranslationTool";
import MobileTranslation from "./pages/MobileTranslation";
import PatientLanguageSelection from "./pages/PatientLanguageSelection";
import GPGenie from "./pages/GPGenie";
import NewRecorder from "./pages/NewRecorder";
import CSOReport from "./pages/CSOReport";
import Attendees from "./pages/Attendees";
import PracticeManagerFeedback from "./pages/PracticeManagerFeedback";
import FeedbackResults from "./pages/FeedbackResults";
import { NetworkDiagnosticsPage } from "./pages/NetworkDiagnosticsPage";
import { AdminConsolidate } from "./pages/AdminConsolidate";
import NotFound from "./pages/NotFound";
import VoiceTest from "./pages/VoiceTest";
import { ResetPassword } from "./components/ResetPassword";
import { ProtectedRoute } from "./components/ProtectedRoute";
import GPSoapUI from "./components/GPSoapUI";
import Turkey2025 from "./pages/Turkey2025";
import EnhancedAccess from "./pages/EnhancedAccess";
import ExecutiveOverview from "./pages/ExecutiveOverview";

const App = () => {
  useSessionActivity();

  useEffect(() => {
    installHasAttributeSafeguard();
    const observer = getSafeDOMObserver();
    observer.start();
    return () => observer.destroy();
  }, []);

  return (
    <HelmetProvider>
      <SecurityWrapper>
        <TooltipProvider>
          <div className="mobile-keyboard-adjust">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/executive-overview" element={<ExecutiveOverview />} />
              <Route path="/ai4gp" element={<AI4GP />} />
              <Route path="/gp-scribe" element={<GPScribe />} />
              <Route path="/gp-scribe/settings" element={<GPScribeSettings />} />
              <Route path="/meetings" element={<MeetingHistory />} />
              <Route path="/meeting-history" element={<MeetingHistory />} />
              <Route path="/meeting-summary" element={<MeetingSummary />} />
              <Route path="/meeting-summary/:meetingId" element={<MeetingSummary />} />
              <Route path="/consultation-summary" element={<GPSoapUI />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={<SystemAdmin />} />
              <Route path="/practice-admin" element={<PracticeAdmin />} />
              <Route path="/practice-admin/fridges" element={<PracticeAdminFridges />} />
              <Route path="/attendees" element={<Attendees />} />
              <Route path="/fridge-temp/:id" element={<FridgeTemperatureEntry />} />
              <Route path="/public/fridge-temp/:id" element={<FridgeTemperatureEntry />} />
              <Route path="/complaints" element={<ComplaintsSystem />} />
              <Route path="/complaints/:id" element={<ComplaintDetails />} />
              <Route path="/complaints-guide" element={<ComplaintsPresentationMode />} />
              <Route path="/complaint-response/:token" element={<ComplaintResponse />} />
              <Route path="/complaint-response" element={<ComplaintResponse />} />
              <Route path="/staff-feedback" element={<StaffFeedback />} />
              <Route path="/shared-drive" element={
                <ProtectedRoute>
                  <SharedDrive />
                </ProtectedRoute>
              } />
              <Route path="/translation-tool" element={<TranslationTool />} />
              <Route path="/mobile-translate" element={<MobileTranslation />} />
              <Route path="/patient-language" element={<PatientLanguageSelection />} />
              <Route path="/gp-genie" element={<GPGenie />} />
              <Route path="/new-recorder" element={<NewRecorder />} />
              <Route path="/ai4pm" element={
                <ProtectedRoute requiredModule="enhanced_access">
                  <AI4PMService />
                </ProtectedRoute>
              } />
              <Route path="/enhanced-access" element={
                <ProtectedRoute requiredModule="enhanced_access">
                  <EnhancedAccess />
                </ProtectedRoute>
              } />
              <Route path="/cqc-compliance" element={
                <ProtectedRoute requiredModule="enhanced_access">
                  <CQCCompliance />
                </ProtectedRoute>
              } />
              <Route path="/compliance/documentation" element={
                <ProtectedRoute requiredModule="enhanced_access">
                  <ComplianceDocumentation />
                </ProtectedRoute>
              } />
              <Route path="/compliance/security" element={
                <ProtectedRoute requiredModule="enhanced_access">
                  <SecurityCompliance />
                </ProtectedRoute>
              } />
              <Route path="/cso-report" element={
                <ProtectedRoute requiredModule="enhanced_access">
                  <CSOReport />
                </ProtectedRoute>
              } />
              <Route path="/feedback" element={<PracticeManagerFeedback />} />
              <Route path="/feedback/results" element={<FeedbackResults />} />
              <Route path="/network-diagnostics" element={<NetworkDiagnosticsPage />} />
              <Route path="/admin/consolidate" element={<AdminConsolidate />} />
              <Route path="/turkey2025" element={<Turkey2025 />} />
              <Route path="/voice-test" element={<VoiceTest />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </TooltipProvider>
      </SecurityWrapper>
    </HelmetProvider>
  );
};

export default App;
