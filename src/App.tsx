// Verifying GitHub sync after main re-point on 29 Apr 2026
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { SecurityWrapper } from '@/components/SecurityWrapper';
import { SessionActivityTracker } from '@/components/SessionActivityTracker';
import { Suspense, lazy, useEffect } from 'react';
import { getSafeDOMObserver, installHasAttributeSafeguard } from '@/utils/domSafetyPolyfill';
import { cleanupStaleStorage } from '@/utils/localStorageManager';
import { ProtectedRoute } from "./components/ProtectedRoute";
import { MockInspectionProtectedRoute } from "./components/MockInspectionProtectedRoute";
import { Loader2 } from "lucide-react";

// Lazy-load all pages to reduce initial bundle size
const RecoveryTool = lazy(() => import("./pages/RecoveryTool"));
const Index = lazy(() => import("./pages/Index"));
const AI4GP = lazy(() => import("./pages/AI4GP"));
const VoiceAgent = lazy(() => import("./pages/VoiceAgent"));
const GPScribe = lazy(() => import("./pages/GPScribe"));
const GPScribeSettings = lazy(() => import("./pages/GPScribeSettings"));
const MeetingHistory = lazy(() => import("./pages/MeetingHistory"));
const MeetingSummary = lazy(() => import("./pages/MeetingSummary"));
const ConsultationSummary = lazy(() => import("./pages/ConsultationSummary"));
const Settings = lazy(() => import("./pages/Settings"));
const SystemAdmin = lazy(() => import("./pages/SystemAdmin"));
const PracticeAdmin = lazy(() => import("./pages/PracticeAdmin"));
const PracticeAdminFridges = lazy(() => import("./pages/PracticeAdminFridges"));
const FridgeTemperatureEntry = lazy(() => import("./components/FridgeTemperatureEntry").then(m => ({ default: m.FridgeTemperatureEntry })));
const ComplaintsSystem = lazy(() => import("./pages/ComplaintsSystem"));
const LetterheadSettings = lazy(() => import("./pages/complaints/LetterheadSettings"));
const ComplaintDetails = lazy(() => import("./pages/ComplaintDetails"));
const ComplaintAIReport = lazy(() => import("./pages/ComplaintAIReport"));
const ComplaintResponse = lazy(() => import("./pages/ComplaintResponse"));
const ComplaintsPresentationMode = lazy(() => import("./pages/ComplaintsPresentationMode"));
const FederationPresentationMode = lazy(() => import("./pages/FederationPresentationMode"));
const StaffFeedback = lazy(() => import("./pages/StaffFeedback"));
const SharedDrive = lazy(() => import("./pages/SharedDrive"));
const Auth = lazy(() => import("./pages/Auth"));
const AI4PMService = lazy(() => import("./pages/AI4PMService"));
const CQCCompliance = lazy(() => import("./pages/CQCCompliance"));
const ComplianceDocumentation = lazy(() => import("./pages/ComplianceDocumentation"));
const SecurityCompliance = lazy(() => import("./pages/SecurityCompliance"));
const TranslationTool = lazy(() => import("./pages/TranslationTool"));
const MobileTranslation = lazy(() => import("./pages/MobileTranslation"));
const PatientLanguageSelection = lazy(() => import("./pages/PatientLanguageSelection"));
const GPGenie = lazy(() => import("./pages/GPGenie"));
const NewRecorder = lazy(() => import("./pages/NewRecorder"));
const PCNCalculator = lazy(() => import("./pages/PCNCalculator"));
const CSOReport = lazy(() => import("./pages/CSOReport"));
const DPIA = lazy(() => import("./pages/DPIA"));
const DTACAssessment = lazy(() => import("./pages/DTACAssessment"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const HazardLog = lazy(() => import("./pages/HazardLog"));
const SafetyCase = lazy(() => import("./pages/SafetyCase"));
const SecurityPostureOverview = lazy(() => import("./pages/SecurityPostureOverview"));
const IncidentResponsePolicy = lazy(() => import("./pages/IncidentResponsePolicy"));
const DataFlowArchitecture = lazy(() => import("./pages/DataFlowArchitecture"));
const Attendees = lazy(() => import("./pages/Attendees"));
const PracticeManagerFeedback = lazy(() => import("./pages/PracticeManagerFeedback"));
const FeedbackResults = lazy(() => import("./pages/FeedbackResults"));
const NetworkDiagnosticsPage = lazy(() => import("./pages/NetworkDiagnosticsPage").then(m => ({ default: m.NetworkDiagnosticsPage })));
const Surveys = lazy(() => import("./pages/Surveys"));
const SurveyBuilder = lazy(() => import("./pages/SurveyBuilder"));
const SurveyResults = lazy(() => import("./pages/SurveyResults"));
const PublicSurvey = lazy(() => import("./pages/PublicSurvey"));
const AdminConsolidate = lazy(() => import("./pages/AdminConsolidate").then(m => ({ default: m.AdminConsolidate })));
const PayAlignmentSurvey = lazy(() => import("./pages/PayAlignmentSurvey"));
const PayAlignmentAdmin = lazy(() => import("./pages/PayAlignmentAdmin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const VoiceTest = lazy(() => import("./pages/VoiceTest"));
const ResetPassword = lazy(() => import("./components/ResetPassword").then(m => ({ default: m.ResetPassword })));
const GPSoapUI = lazy(() => import("./components/GPSoapUI"));
const Turkey2025 = lazy(() => import("./pages/Turkey2025"));
const EnhancedAccess = lazy(() => import("./pages/EnhancedAccess"));
const AdminVideoUpload = lazy(() => import("./components/admin/AdminVideoUpload").then(m => ({ default: m.AdminVideoUpload })));
const AdminChunkRepair = lazy(() => import("./pages/AdminChunkRepair"));
const LLMDiagnostics = lazy(() => import("./pages/LLMDiagnostics"));
const PipelineTest = lazy(() => import("./pages/PipelineTest"));
const PipelineTestRunner = lazy(() => import("./pages/PipelineTestRunner"));
const PipelineCompare = lazy(() => import("./pages/PipelineCompare"));
const TranscriptionPilot = lazy(() => import("./pages/admin/TranscriptionPilot"));
const ExecutiveOverview = lazy(() => import("./pages/ExecutiveOverview"));
const LoadDemoTeamData = lazy(() => import("./pages/LoadDemoTeamData"));
const DemoVideosPage = lazy(() => import("./pages/DemoVideosPage"));
const TrainingVideoPage = lazy(() => import("./pages/TrainingVideoPage"));
const TrainingVideosHub = lazy(() => import("./pages/TrainingVideosHub"));
const NRESDashboard = lazy(() => import("./pages/NRESDashboard"));
const ENNDashboard = lazy(() => import("./pages/ENNDashboard"));
const SDADashboard = lazy(() => import("./pages/SDADashboard"));
const ProactiveComplexCareDashboard = lazy(() => import("./pages/ProactiveComplexCareDashboard"));
const CommsStrategyDashboard = lazy(() => import("./pages/CommsStrategyDashboard"));
const SecurityReport = lazy(() => import("./pages/SecurityReport"));
const SecurityAudit20251119 = lazy(() => import("./pages/SecurityAudit20251119"));
const NHSQuest = lazy(() => import("./pages/NHSQuest"));
const DCB0129 = lazy(() => import("./pages/DCB0129"));
const NRESPresentationPage = lazy(() => import("./pages/NRESPresentationPage"));
const CSOTrainingRegister = lazy(() => import("./pages/CSOTrainingRegister"));
const CSOTrainingDashboard = lazy(() => import("./pages/CSOTrainingDashboard"));
const CSOTrainingModule = lazy(() => import("./pages/CSOTrainingModule"));
const CSOTrainingAssessment = lazy(() => import("./pages/CSOTrainingAssessment"));
const CSOTrainingResults = lazy(() => import("./pages/CSOTrainingResults"));
const CSOCertificate = lazy(() => import("./pages/CSOCertificate"));
const CSOTestCertificate = lazy(() => import("./pages/CSOTestCertificate"));
const CSOTrainingContentExport = lazy(() => import("./pages/CSOTrainingContentExport"));
const UsingAiNhs = lazy(() => import("./pages/UsingAiNhs"));
const NotebookStudio = lazy(() => import("./pages/NotebookStudio"));
const AIShowcasePage = lazy(() => import("./pages/AIShowcasePage"));
const PublicPlanningStudio = lazy(() => import("./pages/PublicPlanningStudio"));
const NRESPlanningStudio = lazy(() => import("./pages/NRESPlanningStudio"));
const NRESPopulationRisk = lazy(() => import("./pages/NRESPopulationRisk"));
const NRESPopulationRiskMethodology = lazy(() => import("./pages/NRESPopulationRiskMethodology"));

const NotewellVoiceHub = lazy(() => import("./components/AskAI/NotewellVoiceHub"));
const BPCalculator = lazy(() => import("./pages/BPCalculator"));
const PublicBPCalculator = lazy(() => import("./pages/PublicBPCalculator"));
const QuickRecord = lazy(() => import("./pages/QuickRecord"));
const GPTranslationService = lazy(() => import("./pages/GPTranslationService"));
const AgewellTranslateTrain = lazy(() => import("./services/agewell/AgewellTranslateTrain"));
const PatientSupportPlan = lazy(() => import("./services/agewell/PatientSupportPlan"));
const AuthConfirm = lazy(() => import("./pages/AuthConfirm"));
const Scribe = lazy(() => import("./pages/Scribe"));
const AI4GPPromptGuide = lazy(() => import("./pages/AI4GPPromptGuide"));
const ReceptionPatientView = lazy(() => import("./pages/ReceptionPatientView"));
const DocumentCapture = lazy(() => import("./pages/DocumentCapture"));
const PolicyService = lazy(() => import("./pages/PolicyService"));
const PolicyServiceCreate = lazy(() => import("./pages/PolicyServiceCreate"));
const PolicyServiceUpdate = lazy(() => import("./pages/PolicyServiceUpdate"));
const PolicyServiceChecklist = lazy(() => import("./pages/PolicyServiceChecklist"));
const PolicyServiceMyPolicies = lazy(() => import("./pages/PolicyServiceMyPolicies"));
const PolicyServiceProfile = lazy(() => import("./pages/PolicyServiceProfile"));
const DocumentApproval = lazy(() => import("./pages/DocumentApproval"));
const PublicApproval = lazy(() => import("./pages/PublicApproval"));
const PolicyServiceViewPolicy = lazy(() => import("./pages/PolicyServiceViewPolicy"));
const AIChatCapture = lazy(() => import("./pages/AIChatCapture"));
const ComplaintCapture = lazy(() => import("./pages/ComplaintCapture"));
const ComplimentDetails = lazy(() => import("./pages/ComplimentDetails"));
const MockCQCInspection = lazy(() => import("./pages/MockCQCInspection"));
const InspectionCapture = lazy(() => import("./pages/InspectionCapture"));
const AudioUploadCapture = lazy(() => import("./pages/AudioUploadCapture"));
const BuyBackExplainer = lazy(() => import("./pages/BuyBackExplainer"));
const GPContract = lazy(() => import("./pages/GPContract"));
const KO41bReport = lazy(() => import("./pages/KO41bReport"));
const PrivacyNotice = lazy(() => import("./pages/PrivacyNotice"));
const AccessibilityStatement = lazy(() => import("./pages/AccessibilityStatement"));
const AskAIPage = lazy(() => import("./pages/AskAIPage"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const KnowledgeBaseAdmin = lazy(() => import("./pages/KnowledgeBaseAdmin"));

// Global loading fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => {
  useEffect(() => {
    installHasAttributeSafeguard();
    cleanupStaleStorage();
    const observer = getSafeDOMObserver();
    observer.start();

    // Global safety net for unhandled promise rejections to prevent white-screen crashes
    const handleRejection = (event: PromiseRejectionEvent) => {
      // Filter out extension/runtime message-channel noise
      const msg = String(event.reason?.message || event.reason || '');
      if (msg.includes('A listener indicated an asynchronous response by returning true')) {
        event.preventDefault();
        return;
      }
      console.error("Unhandled promise rejection:", event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      observer.destroy();
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return (
    <HelmetProvider>
      <SecurityWrapper>
        <TooltipProvider>
          <SessionActivityTracker />
          <div className="mobile-keyboard-adjust">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/quick-record" element={<QuickRecord />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth-confirm" element={<AuthConfirm />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/executive-overview" element={<ExecutiveOverview />} />
                <Route path="/demos" element={<DemoVideosPage />} />
                <Route path="/training" element={<TrainingVideoPage />} />
                <Route path="/training-videos" element={
                  <ProtectedRoute>
                    <TrainingVideosHub />
                  </ProtectedRoute>
                } />
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
                <Route path="/nres/nhc-planning" element={
                  <ProtectedRoute requiredService="nres">
                    <NRESPlanningStudio />
                  </ProtectedRoute>
                } />
                <Route path="/enn" element={
                  <ProtectedRoute requiredService="enn">
                    <ENNDashboard />
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
                <Route path="/nres/population-risk" element={
                  <ProtectedRoute requiredService="nres">
                    <NRESPopulationRisk />
                  </ProtectedRoute>
                } />
                <Route path="/nres/population-risk/methodology" element={
                  <ProtectedRoute requiredService="nres">
                    <NRESPopulationRiskMethodology />
                  </ProtectedRoute>
                } />
                <Route path="/nres/comms-strategy" element={
                  <ProtectedRoute requiredService="nres">
                    <CommsStrategyDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/ai4gp" element={<AI4GP />} />
                
                <Route path="/voice-agent" element={<VoiceAgent />} />
                <Route path="/voice-hub" element={<NotewellVoiceHub />} />
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
                <Route path="/admin/llm-diagnostics" element={<LLMDiagnostics />} />
                <Route path="/admin/pipeline-test" element={<PipelineTest />} />
                <Route path="/admin/pipeline-tests" element={<PipelineTestRunner />} />
                <Route path="/admin/pipeline-compare" element={<PipelineCompare />} />
                <Route path="/admin/transcription-pilot" element={<TranscriptionPilot />} />
                <Route path="/practice-admin" element={<PracticeAdmin />} />
                <Route path="/practice-admin/fridges" element={<PracticeAdminFridges />} />
                <Route path="/attendees" element={<Attendees />} />
                <Route path="/fridge-temp/:id" element={<FridgeTemperatureEntry />} />
                <Route path="/public/fridge-temp/:id" element={<FridgeTemperatureEntry />} />
                <Route path="/complaints" element={<ComplaintsSystem />} />
                <Route path="/complaints/settings/letterhead" element={
                  <ProtectedRoute>
                    <LetterheadSettings />
                  </ProtectedRoute>
                } />
                <Route path="/complaints/ko41b-report" element={<KO41bReport />} />
                <Route path="/complaints/:id" element={<ComplaintDetails />} />
                <Route path="/compliments/:id" element={<ComplimentDetails />} />
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
                <Route path="/agewell" element={
                  <ProtectedRoute requiredService="agewell">
                    <AgewellTranslateTrain />
                  </ProtectedRoute>
                } />
                <Route path="/agewell/care-notes/patient-support-plan" element={
                  <ProtectedRoute requiredService="agewell">
                    <PatientSupportPlan />
                  </ProtectedRoute>
                } />
                <Route path="/translation-tool" element={<Navigate to="/gp-translation" replace />} />
                <Route path="/mobile-translate" element={<MobileTranslation />} />
                <Route path="/patient-language" element={<PatientLanguageSelection />} />
                <Route path="/gp-genie" element={<GPGenie />} />
                <Route path="/new-recorder" element={<NewRecorder />} />
                <Route path="/pcn-calculator" element={<PCNCalculator />} />
                <Route path="/recovery-tool" element={<RecoveryTool />} />
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
                <Route path="/admin/pay-alignment" element={<PayAlignmentAdmin />} />
                <Route path="/survey/pay-alignment/:token" element={<PayAlignmentSurvey />} />
                <Route path="/turkey2025" element={<Turkey2025 />} />
                <Route path="/buyback-explainer" element={<BuyBackExplainer />} />
                <Route path="/gp-contract" element={
                  <ProtectedRoute>
                    <GPContract />
                  </ProtectedRoute>
                } />
                <Route path="/voice-test" element={<VoiceTest />} />
                <Route path="/security-report" element={<SecurityReport />} />
                <Route path="/compliance/security-audit-2025-11-19" element={<SecurityAudit20251119 />} />
                <Route path="/nhs-quest" element={<NHSQuest />} />
                <Route path="/bp-calculator" element={<BPCalculator />} />
                <Route path="/mock-cqc-inspection" element={
                  <MockInspectionProtectedRoute>
                    <MockCQCInspection />
                  </MockInspectionProtectedRoute>
                } />
                <Route path="/public/bp-calculator" element={<PublicBPCalculator />} />
                <Route path="/planning-studio" element={<PublicPlanningStudio />} />
                <Route path="/scribe" element={<Scribe />} />
                <Route path="/ai4gp-prompts" element={<AI4GPPromptGuide />} />
                <Route path="/reception-translate" element={<ReceptionPatientView />} />
                <Route path="/doc-capture/:sessionToken" element={<DocumentCapture />} />
                <Route path="/ai-capture/:sessionToken" element={<AIChatCapture />} />
                <Route path="/c/:shortCode" element={<AIChatCapture />} />
                <Route path="/complaint-capture/:shortCode" element={<ComplaintCapture />} />
                <Route path="/inspection-capture/:shortCode" element={<InspectionCapture />} />
                <Route path="/audio-upload/:token" element={<AudioUploadCapture />} />
                <Route path="/a/:shortCode" element={<AudioUploadCapture />} />
                
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
                
                {/* Document Approval Service */}
                <Route path="/document-approval" element={
                  <ProtectedRoute>
                    <DocumentApproval />
                  </ProtectedRoute>
                } />
                
                <Route path="/approve/group/:groupToken" element={<PublicApproval />} />
                <Route path="/approve/:token" element={<PublicApproval />} />
                
                {/* Public Document Pages */}
                <Route path="/privacy-notice" element={<PrivacyNotice />} />
                <Route path="/accessibility-statement" element={<AccessibilityStatement />} />
                
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
                <Route path="/policy-service/my-policies/:id" element={
                  <ProtectedRoute>
                    <PolicyServiceViewPolicy />
                  </ProtectedRoute>
                } />
                <Route path="/policy-service/profile" element={
                  <ProtectedRoute>
                    <PolicyServiceProfile />
                  </ProtectedRoute>
                } />
                
                <Route path="/ask-ai" element={
                  <ProtectedRoute>
                    <AskAIPage />
                  </ProtectedRoute>
                } />
                <Route path="/knowledge-base" element={
                  <ProtectedRoute>
                    <KnowledgeBase />
                  </ProtectedRoute>
                } />
                <Route path="/knowledge-base/admin" element={
                  <ProtectedRoute>
                    <KnowledgeBaseAdmin />
                  </ProtectedRoute>
                } />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </div>
        </TooltipProvider>
      </SecurityWrapper>
    </HelmetProvider>
  );
};

export default App;
