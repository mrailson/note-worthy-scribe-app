// Early DOM safety init for third-party MutationObserver safety
// Ensures hasAttribute exists on all Nodes and is safe for non-Element nodes
(() => {
  try {
    if (typeof window === 'undefined' || !(window as any).Node) return;

    const originalElHasAttr = Element.prototype.hasAttribute;

    // Provide safe hasAttribute on Node.prototype (covers Text, Comment, etc.)
    const nodeProto: any = (Node as any).prototype;
    if (typeof nodeProto.hasAttribute !== 'function') {
      Object.defineProperty(nodeProto, 'hasAttribute', {
        value: function(this: any, name: string) {
          // Only Elements can have attributes; everything else returns false
          return this && this.nodeType === 1 && typeof originalElHasAttr === 'function'
            ? originalElHasAttr.call(this, String(name))
            : false;
        },
        configurable: true,
        writable: true,
      });
    }

    // Harden Element.prototype.hasAttribute to never throw
    if (typeof originalElHasAttr === 'function') {
      Element.prototype.hasAttribute = function(this: any, name: string) {
        try {
          if (!this || this.nodeType !== 1) return false;
          return originalElHasAttr.call(this, String(name));
        } catch {
          return false;
        }
      } as any;
    }

    // Optional: wrap MutationObserver to filter node lists to Elements only
    const MO: any = (window as any).MutationObserver;
    if (MO && !MO.__safeWrapped) {
      const OriginalMO = MO;
      (window as any).MutationObserver = class SafeMO extends OriginalMO {
        constructor(callback: any) {
          super((mutations: MutationRecord[], observer: MutationObserver) => {
            try {
              const asElements = (nodes: any) => Array.from(nodes || []).filter((n: any): n is Element => n && n.nodeType === 1);
              const safeMutations = mutations.map(m => ({
                ...m,
                addedNodes: asElements(m.addedNodes),
                removedNodes: asElements(m.removedNodes),
              }));
              callback(safeMutations, observer);
            } catch {
              // Swallow errors from third-party observers
            }
          });
        }
      } as any;
      (window as any).MutationObserver.__safeWrapped = true;
    }

    // Lightweight debug
    console.debug('Early DOM safety init applied');
  } catch {
    // Silent fail; this is a defensive shim only
  }
})();
