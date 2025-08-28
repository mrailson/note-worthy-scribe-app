import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { SecurityWrapper } from '@/components/SecurityWrapper';
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
import ComplaintsSystem from "./pages/ComplaintsSystem";
import ComplaintDetails from "./pages/ComplaintDetails";
import ComplaintResponse from "./pages/ComplaintResponse";
import SharedDrive from "./pages/SharedDrive";
import Auth from "./pages/Auth";

import AI4PMService from "./pages/AI4PMService";
import EnhancedAccess from "./pages/EnhancedAccess";
import CQCCompliance from "./pages/CQCCompliance";
import ComplianceDocumentation from "./pages/ComplianceDocumentation";
import SecurityCompliance from "./pages/SecurityCompliance";
import AIAnimationPreview from "./pages/AIAnimationPreview";
import LoadingAnimationDemo from "./pages/LoadingAnimationDemo";
import APITesting from "./pages/APITesting";
import ImageCreate from "./pages/ImageCreate";
import PracticeImageMaker from "./pages/PracticeImageMaker";
import MultiServiceMicTest from "./pages/MultiServiceMicTest";
import DeepgramTest from "./pages/DeepgramTest";
import BrowserRecorder from "./pages/BrowserRecorder";
import NHSMeetingNotes from "./pages/NHSMeetingNotes";

import TestTranscripts from "./pages/TestTranscripts";
import AssemblyAITest from "./pages/AssemblyAITest";

import NotFound from "./pages/NotFound";
import { ResetPassword } from "./components/ResetPassword";
import { ProtectedRoute } from "./components/ProtectedRoute";
import GPSoapUI from "./components/GPSoapUI";


const App = () => (
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
            <Route path="/consultation/summary" element={<GPSoapUI />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<SystemAdmin />} />
            <Route path="/practice-admin" element={<PracticeAdmin />} />
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
            <Route path="/ai-animation-preview" element={<AIAnimationPreview />} />
            <Route path="/loading-animation-demo" element={<LoadingAnimationDemo />} />
            <Route path="/api-testing" element={<APITesting />} />
            <Route path="/image-create" element={<ImageCreate />} />
            <Route path="/practice-image-maker" element={<PracticeImageMaker />} />
            <Route path="/deepgram-test" element={<DeepgramTest />} />
            <Route path="/multi-service-mic-test" element={<MultiServiceMicTest />} />
            <Route path="/browser-recorder" element={<BrowserRecorder />} />
            <Route path="/nhs-meeting-notes" element={<NHSMeetingNotes />} />
            <Route path="/test-transcripts" element={<TestTranscripts />} />
            <Route path="/assemblyai-test" element={<AssemblyAITest />} />
            
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </TooltipProvider>
    </SecurityWrapper>
  </HelmetProvider>
);

export default App;