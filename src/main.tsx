import "./shims/postmessage-dev-guard";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import { RecordingProvider } from "./contexts/RecordingContext";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import App from "./App.tsx";
import "./index.css";

// DOM safety is now handled by src/polyfills/dom-safety-init.ts (loaded early in index.html)

// Prevent browser navigation when dropping files outside designated zones
(() => {
  try {
    if (typeof window !== 'undefined') {
      const guard = (e: any) => {
        // Determine element under pointer for reliable detection
        const doc = window.document;
        const el = (e.clientX != null && e.clientY != null)
          ? doc.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
          : (e.target as HTMLElement | null);
        const isAllowed = el && el.closest?.('[data-allow-file-drop]');
        if (!isAllowed) {
          e.preventDefault?.();
          e.stopPropagation?.();
        }
      };
      window.addEventListener('dragover', guard);
      window.addEventListener('drop', guard);
    }
  } catch (_) {}
})();

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <RecordingProvider>
            <Toaster />
            <SonnerToaster 
              position="top-right"
              icons={{
                success: <img src="/favicon-option1.png" alt="" className="w-5 h-5" />,
                error: <img src="/favicon-option1.png" alt="" className="w-5 h-5" />,
                warning: <img src="/favicon-option1.png" alt="" className="w-5 h-5" />,
                info: <img src="/favicon-option1.png" alt="" className="w-5 h-5" />,
              }}
            />
            <App />
          </RecordingProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
