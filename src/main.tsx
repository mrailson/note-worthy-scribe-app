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

// Enhanced DOM safety polyfill for rrweb/heidi.js compatibility
// Prevents TypeError when hasAttribute is called on non-Element nodes
(() => {
  try {
    if (typeof window !== "undefined" && (window as any).Node) {
      // Store original methods before any modifications
      const originalElementHasAttribute = Element.prototype.hasAttribute;
      
      // Enhanced safe hasAttribute function with comprehensive checks
      const createSafeHasAttribute = (originalMethod: Function) => {
        return function(this: any, name: string) {
          // Return false immediately for non-object types
          if (!this || typeof this !== 'object') return false;
          
          // Check if this is actually an Element (nodeType 1)
          if (!this.nodeType || this.nodeType !== 1) return false;
          
          // Verify this has Element-like properties
          if (typeof this.getAttribute !== 'function') return false;
          
          // Additional safety: check if name is a valid string
          if (typeof name !== 'string') return false;
          
          try {
            return originalMethod.call(this, name);
          } catch (e) {
            return false;
          }
        };
      };
      
      // Apply safe wrapper to Element.prototype.hasAttribute
      if (originalElementHasAttribute) {
        Element.prototype.hasAttribute = createSafeHasAttribute(originalElementHasAttribute);
      }
      
      // Add hasAttribute to Node prototype for comprehensive coverage
      const nodeProto: any = (Node as any).prototype;
      if (!nodeProto.hasAttribute) {
        Object.defineProperty(nodeProto, "hasAttribute", {
          value: function(this: any, name: string) {
            // Only return true for Elements, false for all other node types
            if (this && this.nodeType === 1 && typeof this.getAttribute === 'function') {
              try {
                return originalElementHasAttribute ? originalElementHasAttribute.call(this, name) : false;
              } catch (e) {
                return false;
              }
            }
            return false;
          },
          writable: true,
          configurable: true,
        });
      }
      
      // Enhanced global fallback for direct function calls
      (window as any).hasAttributeSafe = function(node: any, name: string) {
        if (!node || typeof node !== 'object') return false;
        if (!node.nodeType || node.nodeType !== 1) return false;
        if (typeof node.getAttribute !== 'function') return false;
        if (typeof name !== 'string') return false;
        
        try {
          return node.hasAttribute(name);
        } catch (e) {
          return false;
        }
      };
      
      // Additional protection: patch common problematic scenarios
      const originalQuerySelectorAll = Document.prototype.querySelectorAll;
      const originalGetElementsByTagName = Document.prototype.getElementsByTagName;
      
      // Ensure NodeList iteration safety
      if (typeof NodeList !== 'undefined' && NodeList.prototype) {
        const originalForEach = NodeList.prototype.forEach;
        if (originalForEach) {
          NodeList.prototype.forEach = function(callback: Function, thisArg?: any) {
            for (let i = 0; i < this.length; i++) {
              const node = this[i];
              if (node && typeof node === 'object') {
                callback.call(thisArg, node, i, this);
              }
            }
          };
        }
      }
      
      // Console logging for debugging (can be removed in production)
      console.debug('Enhanced DOM safety polyfill applied for rrweb compatibility');
      
    }
  } catch (e) {
    // Silent fail - safety shim only
    console.debug('DOM safety polyfill failed to apply:', e);
  }
})();

// Additional global DOM safety guards for stubborn third-party observers
(() => {
  try {
    // 1) Fallback: provide a non-enumerable, safe hasAttribute on Object.prototype
    const desc = Object.getOwnPropertyDescriptor(Object.prototype, 'hasAttribute');
    if (!desc) {
      Object.defineProperty(Object.prototype, 'hasAttribute', {
        value: function() { return false; },
        configurable: true,
        writable: true,
        enumerable: false,
      });
    }

    // 2) Enhanced helper to safely filter nodes to elements only
    (window as any).asElements = (nodes: NodeList | Node[] = []) => 
      Array.from(nodes).filter((n): n is Element => n?.nodeType === 1);

    // 3) Wrap MutationObserver callbacks to avoid crash loops from third-party libs
    if (typeof window !== 'undefined' && (window as any).MutationObserver) {
      const OriginalMO = (window as any).MutationObserver as any;
      (window as any).MutationObserver = class SafeMutationObserver extends OriginalMO {
        constructor(callback: any) {
          const safeCallback = (mutations: MutationRecord[], observer: MutationObserver) => {
            try {
              // Enhanced mutation processing with node type safety
              const safeMutations = mutations.map(mut => ({
                ...mut,
                addedNodes: (window as any).asElements(mut.addedNodes),
                removedNodes: (window as any).asElements(mut.removedNodes)
              }));
              callback(safeMutations, observer);
            } catch (e) {
              console.debug('DOM safety: swallowed MutationObserver callback error', e);
            }
          };
          super(safeCallback);
        }
      };

      // 4) Additional safety for existing observers that use descendants
      const originalObserve = OriginalMO.prototype.observe;
      OriginalMO.prototype.observe = function(target: Node, options?: MutationObserverInit) {
        try {
          // Ensure target is an element before observing
          if (target && target.nodeType === 1) {
            return originalObserve.call(this, target, options);
          } else {
            console.warn('DOM Safety: Blocking observe() on non-element node');
          }
        } catch (e) {
          console.warn('DOM Safety: observe() failed safely:', e);
        }
      };
    }

    console.debug('Enhanced DOM safety polyfill with node filtering applied');
  } catch (_) {
    console.debug('DOM safety polyfill failed to apply (non-critical)');
  }
})();

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
        <Toaster />
        <SonnerToaster position="top-right" />
        <AuthProvider>
          <RecordingProvider>
            <App />
          </RecordingProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
