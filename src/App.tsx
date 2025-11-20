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
import ComplaintAIReport from "./pages/ComplaintAIReport";
import ComplaintResponse from "./pages/ComplaintResponse";
import ComplaintsPresentationMode from "./pages/ComplaintsPresentationMode";
import FederationPresentationMode from "./pages/FederationPresentationMode";
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
import DPIA from "./pages/DPIA";
import DTACAssessment from "./pages/DTACAssessment";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import HazardLog from "./pages/HazardLog";
import SafetyCase from "./pages/SafetyCase";
import SecurityPostureOverview from "./pages/SecurityPostureOverview";
import IncidentResponsePolicy from "./pages/IncidentResponsePolicy";
import DataFlowArchitecture from "./pages/DataFlowArchitecture";
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
import { AdminVideoUpload } from "./components/admin/AdminVideoUpload";
import AdminChunkRepair from "./pages/AdminChunkRepair";
import ExecutiveOverview from "./pages/ExecutiveOverview";
import LoadDemoTeamData from "./pages/LoadDemoTeamData";
import DemoVideosPage from "./pages/DemoVideosPage";
import NRESDashboard from "./pages/NRESDashboard";
import ProactiveComplexCareDashboard from "./pages/ProactiveComplexCareDashboard";
import CommsStrategyDashboard from "./pages/CommsStrategyDashboard";
import SecurityReport from "./pages/SecurityReport";
import SecurityAudit20251119 from "./pages/SecurityAudit20251119";
import NHSQuest from "./pages/NHSQuest";
import DCB0129 from "./pages/DCB0129";
import CSOTrainingRegister from "./pages/CSOTrainingRegister";
import CSOTrainingDashboard from "./pages/CSOTrainingDashboard";
import CSOTrainingModule from "./pages/CSOTrainingModule";
import CSOTrainingAssessment from "./pages/CSOTrainingAssessment";
import CSOTrainingResults from "./pages/CSOTrainingResults";
import CSOCertificate from "./pages/CSOCertificate";

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
              <Route path="/demos" element={<DemoVideosPage />} />
              <Route path="/nres" element={<NRESDashboard />} />
              <Route path="/nres/complex-care" element={<ProactiveComplexCareDashboard />} />
              <Route path="/nres/comms-strategy" element={<CommsStrategyDashboard />} />
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
              <Route path="/admin/demo-video" element={<AdminVideoUpload />} />
              <Route path="/admin/chunk-repair" element={<AdminChunkRepair />} />
              <Route path="/practice-admin" element={<PracticeAdmin />} />
              <Route path="/practice-admin/fridges" element={<PracticeAdminFridges />} />
              <Route path="/attendees" element={<Attendees />} />
              <Route path="/fridge-temp/:id" element={<FridgeTemperatureEntry />} />
              <Route path="/public/fridge-temp/:id" element={<FridgeTemperatureEntry />} />
              <Route path="/complaints" element={<ComplaintsSystem />} />
              <Route path="/complaints/:id" element={<ComplaintDetails />} />
              <Route path="/complaints/:id/ai-report" element={<ComplaintAIReport />} />
              <Route path="/complaints-guide" element={<ComplaintsPresentationMode />} />
              <Route path="/federation-presentation" element={<FederationPresentationMode />} />
              <Route path="/complaint-response/:token" element={<ComplaintResponse />} />
              <Route path="/complaint-response" element={<ComplaintResponse />} />
              <Route path="/load-demo-team" element={<LoadDemoTeamData />} />
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
                <ProtectedRoute requiredModule="cso_governance_access">
                  <CSOReport />
                </ProtectedRoute>
              } />
              <Route path="/data-flow-architecture" element={
                <ProtectedRoute requiredModule="cso_governance_access">
                  <DataFlowArchitecture />
                </ProtectedRoute>
              } />
              <Route path="/dpia" element={
                <ProtectedRoute requiredModule="cso_governance_access">
                  <DPIA />
                </ProtectedRoute>
              } />
              <Route path="/dtac" element={
                <ProtectedRoute requiredModule="cso_governance_access">
                  <DTACAssessment />
                </ProtectedRoute>
              } />
              <Route path="/privacy-policy" element={
                <ProtectedRoute requiredModule="cso_governance_access">
                  <PrivacyPolicy />
                </ProtectedRoute>
              } />
              <Route path="/hazard-log" element={
                <ProtectedRoute requiredModule="cso_governance_access">
                  <HazardLog />
                </ProtectedRoute>
              } />
              <Route path="/safety-case" element={
                <ProtectedRoute requiredModule="cso_governance_access">
                  <SafetyCase />
                </ProtectedRoute>
              } />
              <Route path="/dcb0129" element={
                <ProtectedRoute requiredModule="cso_governance_access">
                  <DCB0129 />
                </ProtectedRoute>
              } />
              <Route path="/cso-training-register" element={<CSOTrainingRegister />} />
              <Route path="/cso-training-dashboard" element={<CSOTrainingDashboard />} />
              <Route path="/cso-training-module/:moduleId" element={<CSOTrainingModule />} />
              <Route path="/cso-training-assessment" element={<CSOTrainingAssessment />} />
              <Route path="/cso-training-results/:assessmentId" element={<CSOTrainingResults />} />
              <Route path="/cso-certificate/:assessmentId" element={<CSOCertificate />} />
              <Route path="/security-posture" element={
                <ProtectedRoute requiredModule="cso_governance_access">
                  <SecurityPostureOverview />
                </ProtectedRoute>
              } />
              <Route path="/incident-response" element={
                <ProtectedRoute requiredModule="cso_governance_access">
                  <IncidentResponsePolicy />
                </ProtectedRoute>
              } />
              <Route path="/feedback" element={<PracticeManagerFeedback />} />
              <Route path="/feedback/results" element={<FeedbackResults />} />
              <Route path="/network-diagnostics" element={<NetworkDiagnosticsPage />} />
              <Route path="/admin/consolidate" element={<AdminConsolidate />} />
              <Route path="/turkey2025" element={<Turkey2025 />} />
              <Route path="/voice-test" element={<VoiceTest />} />
              <Route path="/security-report" element={<SecurityReport />} />
              <Route path="/compliance/security-audit-2025-11-19" element={<SecurityAudit20251119 />} />
              <Route path="/nhs-quest" element={<NHSQuest />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </TooltipProvider>
      </SecurityWrapper>
    </HelmetProvider>
  );
};

export default App;
