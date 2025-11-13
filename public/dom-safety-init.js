// Early DOM safety polyfill for hasAttribute on all Node types
// Ensures third-party MutationObservers (rrweb/heidi.js) don't crash on non-Element nodes
(function() {
  try {
    if (typeof window === 'undefined' || !window.Node) return;
    
    const originalElHasAttr = Element.prototype.hasAttribute;
    
    // Provide safe hasAttribute on Node.prototype (covers Text, Comment, etc.)
    const nodeProto = Node.prototype;
    if (typeof nodeProto.hasAttribute !== 'function') {
      Object.defineProperty(nodeProto, 'hasAttribute', {
        value: function(name) {
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
      Element.prototype.hasAttribute = function(name) {
        try {
          if (!this || this.nodeType !== 1) return false;
          return originalElHasAttr.call(this, String(name));
        } catch {
          return false;
        }
      };
    }
    
    console.debug('✅ Early DOM safety init applied (external)');
  } catch (err) {
    console.error('❌ DOM safety init failed:', err);
  }
})();
