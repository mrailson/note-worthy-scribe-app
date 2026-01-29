import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { SecurityWrapper } from '@/components/SecurityWrapper';
import { SessionActivityTracker } from '@/components/SessionActivityTracker';
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
import Surveys from "./pages/Surveys";
import SurveyBuilder from "./pages/SurveyBuilder";
import SurveyResults from "./pages/SurveyResults";
import PublicSurvey from "./pages/PublicSurvey";
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
import TrainingVideoPage from "./pages/TrainingVideoPage";
import NRESDashboard from "./pages/NRESDashboard";
import SDADashboard from "./pages/SDADashboard";
import ProactiveComplexCareDashboard from "./pages/ProactiveComplexCareDashboard";
import CommsStrategyDashboard from "./pages/CommsStrategyDashboard";
import SecurityReport from "./pages/SecurityReport";
import SecurityAudit20251119 from "./pages/SecurityAudit20251119";
import NHSQuest from "./pages/NHSQuest";
import DCB0129 from "./pages/DCB0129";
import NRESPresentationPage from "./pages/NRESPresentationPage";
import CSOTrainingRegister from "./pages/CSOTrainingRegister";
import CSOTrainingDashboard from "./pages/CSOTrainingDashboard";
import CSOTrainingModule from "./pages/CSOTrainingModule";
import CSOTrainingAssessment from "./pages/CSOTrainingAssessment";
import CSOTrainingResults from "./pages/CSOTrainingResults";
import CSOCertificate from "./pages/CSOCertificate";
import CSOTestCertificate from "./pages/CSOTestCertificate";
import CSOTrainingContentExport from "./pages/CSOTrainingContentExport";
import UsingAiNhs from "./pages/UsingAiNhs";
import NotebookStudio from "./pages/NotebookStudio";
import AIShowcasePage from "./pages/AIShowcasePage";
import LGCaptureLanding from "./pages/LGCaptureLanding";
import LGCaptureStart from "./pages/LGCaptureStart";
import LGCaptureCamera from "./pages/LGCaptureCamera";
import LGCaptureUpload from "./pages/LGCaptureUpload";
import LGCaptureResults from "./pages/LGCaptureResults";
import LGCapturePatients from "./pages/LGCapturePatients";
import LGCaptureDemoService from "./pages/LGCaptureDemoService";
import LGCaptureFileView from "./pages/LGCaptureFileView";
import LGCaptureMyStats from "./pages/LGCaptureMyStats";
import LGCaptureBulk from "./pages/LGCaptureBulk";
import BPCalculator from "./pages/BPCalculator";
import PublicBPCalculator from "./pages/PublicBPCalculator";
import QuickRecord from "./pages/QuickRecord";
import GPTranslationService from "./pages/GPTranslationService";
import AuthConfirm from "./pages/AuthConfirm";
import Scribe from "./pages/Scribe";
import AI4GPPromptGuide from "./pages/AI4GPPromptGuide";
import ReceptionPatientView from "./pages/ReceptionPatientView";
import DocumentCapture from "./pages/DocumentCapture";
import { LGUploadQueueProvider } from "./contexts/LGUploadQueueContext";
import PolicyService from "./pages/PolicyService";
import PolicyServiceCreate from "./pages/PolicyServiceCreate";
import PolicyServiceUpdate from "./pages/PolicyServiceUpdate";
import PolicyServiceChecklist from "./pages/PolicyServiceChecklist";
import PolicyServiceMyPolicies from "./pages/PolicyServiceMyPolicies";
import PolicyServiceProfile from "./pages/PolicyServiceProfile";
import AIChatCapture from "./pages/AIChatCapture";

const App = () => {
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
          <SessionActivityTracker />
          <div className="mobile-keyboard-adjust">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/quick-record" element={<QuickRecord />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth-confirm" element={<AuthConfirm />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/executive-overview" element={<ExecutiveOverview />} />
              <Route path="/demos" element={<DemoVideosPage />} />
              <Route path="/training" element={<TrainingVideoPage />} />
              <Route path="/ai-showcase" element={<AIShowcasePage />} />
              <Route path="/nres" element={
                <ProtectedRoute requiredService="nres">
                  <NRESDashboard />
                </ProtectedRoute>
              } />
              <Route path="/NRESDashboard" element={
                <ProtectedRoute requiredService="nres">
                  <SDADashboard />
                </ProtectedRoute>
              } />
              <Route path="/nres-presentation" element={
                <ProtectedRoute requiredService="nres">
                  <NRESPresentationPage />
                </ProtectedRoute>
              } />
              <Route path="/nres/complex-care" element={
                <ProtectedRoute requiredService="nres">
                  <ProactiveComplexCareDashboard />
                </ProtectedRoute>
              } />
              <Route path="/nres/comms-strategy" element={
                <ProtectedRoute requiredService="nres">
                  <CommsStrategyDashboard />
                </ProtectedRoute>
              } />
              <Route path="/ai4gp" element={<AI4GP />} />
              <Route path="/gp-scribe" element={<Navigate to="/scribe" replace />} />
              <Route path="/gp-scribe/settings" element={<Navigate to="/scribe" replace />} />
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
              <Route path="/gp-translation" element={<GPTranslationService />} />
              <Route path="/translation-tool" element={<Navigate to="/gp-translation" replace />} />
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
          <Route path="/cso-test-certificate" element={<CSOTestCertificate />} />
          <Route path="/CSO_TRAINING_CONTENT_EXPORT.md" element={<CSOTrainingContentExport />} />
              <Route path="/usingai_nhs" element={<UsingAiNhs />} />
              <Route path="/notebook-studio" element={<NotebookStudio />} />
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
              <Route path="/lg-capture" element={<LGUploadQueueProvider><LGCaptureLanding /></LGUploadQueueProvider>} />
              <Route path="/lg-capture/file-view" element={<LGUploadQueueProvider><LGCaptureFileView /></LGUploadQueueProvider>} />
              <Route path="/lg-capture/start" element={<LGUploadQueueProvider><LGCaptureStart /></LGUploadQueueProvider>} />
              <Route path="/lg-capture/upload" element={<LGUploadQueueProvider><LGCaptureUpload /></LGUploadQueueProvider>} />
              <Route path="/lg-capture/capture/:id" element={<LGUploadQueueProvider><LGCaptureCamera /></LGUploadQueueProvider>} />
              <Route path="/lg-capture/demo/:id" element={<LGUploadQueueProvider><LGCaptureDemoService /></LGUploadQueueProvider>} />
              <Route path="/lg-capture/results/:id" element={<LGUploadQueueProvider><LGCaptureResults /></LGUploadQueueProvider>} />
              <Route path="/lg-capture/patients" element={<LGUploadQueueProvider><LGCapturePatients /></LGUploadQueueProvider>} />
              <Route path="/lg-capture/my-stats" element={<LGUploadQueueProvider><LGCaptureMyStats /></LGUploadQueueProvider>} />
              <Route path="/lg-capture/bulk" element={<LGUploadQueueProvider><LGCaptureBulk /></LGUploadQueueProvider>} />
              <Route path="/bp-calculator" element={<BPCalculator />} />
              <Route path="/public/bp-calculator" element={<PublicBPCalculator />} />
              <Route path="/scribe" element={<Scribe />} />
              <Route path="/ai4gp-prompts" element={<AI4GPPromptGuide />} />
              <Route path="/reception-translate" element={<ReceptionPatientView />} />
              <Route path="/doc-capture/:sessionToken" element={<DocumentCapture />} />
              <Route path="/ai-capture/:sessionToken" element={<AIChatCapture />} />
              
              {/* Survey Routes */}
              <Route path="/surveys" element={
                <ProtectedRoute requiredModule="survey_manager_access">
                  <Surveys />
                </ProtectedRoute>
              } />
              <Route path="/surveys/create" element={
                <ProtectedRoute requiredModule="survey_manager_access">
                  <SurveyBuilder />
                </ProtectedRoute>
              } />
              <Route path="/surveys/:id/edit" element={
                <ProtectedRoute requiredModule="survey_manager_access">
                  <SurveyBuilder />
                </ProtectedRoute>
              } />
              <Route path="/surveys/:id/results" element={
                <ProtectedRoute requiredModule="survey_manager_access">
                  <SurveyResults />
                </ProtectedRoute>
              } />
              <Route path="/survey/:token" element={<PublicSurvey />} />
              <Route path="/s/:token" element={<PublicSurvey />} />
              
              {/* Policy Service Routes */}
              <Route path="/policy-service" element={
                <ProtectedRoute>
                  <PolicyService />
                </ProtectedRoute>
              } />
              <Route path="/policy-service/create" element={
                <ProtectedRoute>
                  <PolicyServiceCreate />
                </ProtectedRoute>
              } />
              <Route path="/policy-service/update" element={
                <ProtectedRoute>
                  <PolicyServiceUpdate />
                </ProtectedRoute>
              } />
              <Route path="/policy-service/checklist" element={
                <ProtectedRoute>
                  <PolicyServiceChecklist />
                </ProtectedRoute>
              } />
              <Route path="/policy-service/my-policies" element={
                <ProtectedRoute>
                  <PolicyServiceMyPolicies />
                </ProtectedRoute>
              } />
              <Route path="/policy-service/profile" element={
                <ProtectedRoute>
                  <PolicyServiceProfile />
                </ProtectedRoute>
              } />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </TooltipProvider>
      </SecurityWrapper>
    </HelmetProvider>
  );
};

export default App;
