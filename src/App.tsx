import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { SecurityWrapper } from '@/components/SecurityWrapper';
import { useSessionActivity } from '@/hooks/useSessionActivity';
import { useEffect } from 'react';
import { getSafeDOMObserver, installHasAttributeSafeguardPolyfill } from '@/utils/domSafety Polyfill';
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
import ComplaintsUserGuide from "./pages/ComplaintsUserGuide";
import StaffFeedback from "./pages/StaffFeedback";
import SharedDrive from "./pages/SharedDrive";
import Auth from "./pages/Auth";
import AI4PMService from "./pages/AI4PMService";
import CQCompliance from "./pages/CQCompliance";
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
import NotFound from "./pages/NotFound";
import { ResetPassword } from "./components/ResetPassword";
import { ProtectedRoute } from "./components/ProtectedRoute";
import GPSoapUI from "./pages/GPSoapUI";
import Turkey2025 from "./pages/Turkey2025";

const App = () => {
  useSessionActivity();

  useEffect(() => {
    installHasAttributeSafeguard();
    const observer = getSafeDOMObserver();
    observer.start();
    return () => observer.disconnect();
  }, []);

  return (
    <HelmetProvider>
      <SecurityWrapper>
        <TooltipProvider>
          <div className="mobile-keyboard-adjust">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
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
              <Route path="/complaints" element={<ComplaintsSystem />} />
              <Route path="/complaints/:id" element={<ComplaintDetails />} />
              <Route path="/complaints-guide" element={<ComplaintsUserGuide />} />
              <Route path="/complaint-response/:token" element={<ComplaintResponse />} />
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
              <Route path="/feedback" element={<PracticeManagerFeedback />} />
              <Route path="/feedback/results" element={<FeedbackResults />} />
              <Route path="/network-diagnostics" element={<NetworkDiagnosticsPage />} />
              <Route path="/turkey2025" element={<Turkey2025 />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </TooltipProvider>
      </SecurityWrapper>
    </HelmetProvider>
  );
};

export default App;
