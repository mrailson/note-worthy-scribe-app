import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import MeetingHistory from "./pages/MeetingHistory";
import MeetingSummary from "./pages/MeetingSummary";
import Settings from "./pages/Settings";
import SystemAdmin from "./pages/SystemAdmin";
import NotFound from "./pages/NotFound";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/meetings" element={<MeetingHistory />} />
      <Route path="/meeting-summary" element={<MeetingSummary />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/admin" element={<SystemAdmin />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </TooltipProvider>
);

export default App;
