import "./shims/postmessage-dev-guard";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import { RecordingProvider } from "./contexts/RecordingContext";
import { Toaster } from "@/components/ui/toaster";
import App from "./App.tsx";
import "./index.css";

// DOM safety polyfill: some third-party scripts (e.g., analytics/helpers)
// call hasAttribute on nodes that are not Elements (Text/Comment) in production.
// Ensure non-Element Nodes have a no-op hasAttribute to prevent runtime errors.
(() => {
  try {
    if (typeof window !== "undefined" && (window as any).Node) {
      const proto: any = (Node as any).prototype;
      if (typeof proto.hasAttribute !== "function") {
        Object.defineProperty(proto, "hasAttribute", {
          value: function (_name: string) { return false; },
          writable: true,
          configurable: true,
        });
      }
    }
  } catch (e) {
    // Silent fail - safety shim only
  }
})();

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster />
        <AuthProvider>
          <RecordingProvider>
            <App />
          </RecordingProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
