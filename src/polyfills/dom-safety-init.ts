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

    // DO NOT filter nodes - rrweb needs all node types (text, comment, etc.)
    // The hasAttribute polyfill above ensures safety without breaking libraries

    // Lightweight debug
    console.debug('Early DOM safety init applied');
  } catch {
    // Silent fail; this is a defensive shim only
  }
})();
