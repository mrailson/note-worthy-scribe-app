import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import GPScribe from "./pages/GPScribe";
import GPScribeSettings from "./pages/GPScribeSettings";
import MeetingHistory from "./pages/MeetingHistory";
import MeetingSummary from "./pages/MeetingSummary";
import Settings from "./pages/Settings";
import SystemAdmin from "./pages/SystemAdmin";
import ComplaintsSystem from "./pages/ComplaintsSystem";
import ReplyWellAI from "./pages/ReplyWellAI";
import AI4PMService from "./pages/AI4PMService";
import NotFound from "./pages/NotFound";
import { ResetPassword } from "./components/ResetPassword";
import { RecorderV2Test } from "./pages/RecorderV2Test";

const App = () => (
  <TooltipProvider>
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/gp-scribe" element={<GPScribe />} />
      <Route path="/gp-scribe/settings" element={<GPScribeSettings />} />
      <Route path="/meetings" element={<MeetingHistory />} />
      <Route path="/meeting-summary" element={<MeetingSummary />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/admin" element={<SystemAdmin />} />
      <Route path="/complaints" element={<ComplaintsSystem />} />
      <Route path="/replywell-ai" element={<ReplyWellAI />} />
      <Route path="/ai-4-pm" element={<AI4PMService />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/recorder-v2-test" element={<RecorderV2Test />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </TooltipProvider>
);

export default App;