/**
 * DOM Safety Polyfill - Prevents MutationObserver crashes
 * Fixes: TypeError: c.hasAttribute is not a function
 */

export class SafeDOMObserver {
  private observer: MutationObserver | null = null;
  private callbacks: Array<(mutations: MutationRecord[]) => void> = [];
  private isRunning = false;

  constructor() {
    this.setupObserver();
  }

  private setupObserver() {
    this.observer = new MutationObserver((mutations) => {
      try {
        // Process mutations safely with debouncing
        this.processMutationsSafely(mutations);
      } catch (error) {
        console.error('🚨 DOM Safety: MutationObserver error caught:', error);
        // Continue processing to prevent crash loops
      }
    });
  }

  private processMutationsSafely(mutations: MutationRecord[]) {
    const processedNodes = new WeakSet();
    
    for (const mutation of mutations) {
      try {
        // Safely process added nodes using type-safe helpers
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          this.processNodesSafely(this.asElements(mutation.addedNodes), processedNodes, 'added');
        }

        // Safely process removed nodes using type-safe helpers  
        if (mutation.removedNodes && mutation.removedNodes.length > 0) {
          this.processNodesSafely(this.asElements(mutation.removedNodes), processedNodes, 'removed');
        }
      } catch (error) {
        console.error('🚨 DOM Safety: Mutation processing error:', error);
        continue; // Skip this mutation, process next
      }
    }

    // Call registered callbacks with safe mutations
    this.callbacks.forEach(callback => {
      try {
        callback(mutations);
      } catch (error) {
        console.error('🚨 DOM Safety: Callback error:', error);
      }
    });
  }

  /**
   * Type-safe helper to filter nodes to Elements only
   * Prevents hasAttribute crashes on Text, Comment, or DocumentFragment nodes
   */
  private asElements(nodes: NodeList | Node[]): Element[] {
    return Array.from(nodes).filter((n): n is Element => 
      !!n && n.nodeType === Node.ELEMENT_NODE
    );
  }

  private processNodesSafely(elements: Element[], processedNodes: WeakSet<Node>, type: 'added' | 'removed') {
    for (const element of elements) {
      try {
        // Skip if already processed
        if (processedNodes.has(element)) continue;
        processedNodes.add(element);

        // Safe to call hasAttribute - we know it's an Element
        if (element.hasAttribute && typeof element.hasAttribute === 'function') {
          this.processElementSafely(element, type);
        }

        // Process descendants safely using querySelectorAll (Elements only)
        try {
          const descendants = element.querySelectorAll('*');
          for (const descendant of Array.from(descendants)) {
            if (!processedNodes.has(descendant)) {
              processedNodes.add(descendant);
              this.processElementSafely(descendant, type);
            }
          }
        } catch (descendantError) {
          console.error('🚨 DOM Safety: Descendant processing error:', descendantError);
        }
      } catch (error) {
        console.error('🚨 DOM Safety: Element processing error:', error);
        continue; // Skip this element, process next
      }
    }
  }

  private processElementSafely(element: Element, type: 'added' | 'removed') {
    try {
      // Check for translation-related attributes
      if (element.hasAttribute('data-translation')) {
        console.log(`🔍 DOM Safety: Translation element ${type}:`, element.tagName);
      }

      // Check for conversation-related attributes
      if (element.hasAttribute('data-conversation')) {
        console.log(`🔍 DOM Safety: Conversation element ${type}:`, element.tagName);
      }

      // Additional safety checks can be added here
    } catch (error) {
      console.error('🚨 DOM Safety: Element processing error:', error);
    }
  }

  /**
   * Register a callback for mutation events
   */
  public onMutation(callback: (mutations: MutationRecord[]) => void) {
    this.callbacks.push(callback);
  }

  /**
   * Start observing DOM changes
   */
  public start(target: Node = document.body, options?: MutationObserverInit) {
    if (!this.observer || this.isRunning) return;

    const defaultOptions: MutationObserverInit = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      characterData: false,
      ...options
    };

    try {
      this.observer.observe(target, defaultOptions);
      this.isRunning = true;
      console.log('✅ DOM Safety: Observer started successfully');
    } catch (error) {
      console.error('🚨 DOM Safety: Failed to start observer:', error);
    }
  }

  /**
   * Stop observing DOM changes
   */
  public stop() {
    if (this.observer && this.isRunning) {
      try {
        this.observer.disconnect();
        this.isRunning = false;
        console.log('✅ DOM Safety: Observer stopped successfully');
      } catch (error) {
        console.error('🚨 DOM Safety: Failed to stop observer:', error);
      }
    }
  }

  /**
   * Clean up resources
   */
  public destroy() {
    this.stop();
    this.callbacks = [];
    this.observer = null;
  }
}

// Singleton instance for global use
let safeDOMObserverInstance: SafeDOMObserver | null = null;

export const getSafeDOMObserver = (): SafeDOMObserver => {
  if (!safeDOMObserverInstance) {
    safeDOMObserverInstance = new SafeDOMObserver();
  }
  return safeDOMObserverInstance;
};

/**
 * Install a global safeguard so Node subclasses (e.g. Text, Comment) safely respond to hasAttribute()
 * Prevents third-party MutationObserver handlers from throwing when they call node.hasAttribute on non-Elements
 */
export const installHasAttributeSafeguard = () => {
  if (typeof window === 'undefined') return;
  try {
    const NodeProto: any = (window as any).Node?.prototype;
    if (NodeProto && typeof NodeProto.hasAttribute !== 'function') {
      Object.defineProperty(NodeProto, 'hasAttribute', {
        value: function (_name: string) {
          // Non-Element nodes never have attributes
          return false;
        },
        writable: false,
        configurable: true,
        enumerable: false,
      });
      console.log('✅ DOM Safety: Installed Node.prototype.hasAttribute safeguard');
    }
  } catch (e) {
    console.error('🚨 DOM Safety: Failed to install hasAttribute safeguard', e);
  }
};

/**
 * Utility function to safely check if a node is an Element
 */
export const isElement = (node: Node | null | undefined): node is Element => {
  return node !== null && node !== undefined && node.nodeType === Node.ELEMENT_NODE;
};

/**
 * Utility function to safely get element attributes
 */
export const safeGetAttribute = (element: Node | null | undefined, attributeName: string): string | null => {
  if (isElement(element) && element.hasAttribute && typeof element.hasAttribute === 'function') {
    return element.hasAttribute(attributeName) ? element.getAttribute(attributeName) : null;
  }
  return null;
};

/**
 * Debounced DOM processing utility
 */
export class DOMProcessingDebouncer {
  private timeoutId: number | null = null;
  private pendingMutations: MutationRecord[] = [];

  constructor(private delay: number = 16) {} // 16ms = ~60fps

  public debounce(mutations: MutationRecord[], callback: (mutations: MutationRecord[]) => void) {
    // Add to pending mutations
    this.pendingMutations.push(...mutations);

    // Clear existing timeout
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
    }

    // Set new timeout
    this.timeoutId = window.setTimeout(() => {
      const mutationsToProcess = [...this.pendingMutations];
      this.pendingMutations = [];
      this.timeoutId = null;

      try {
        callback(mutationsToProcess);
      } catch (error) {
        console.error('🚨 DOM Safety: Debounced callback error:', error);
      }
    }, this.delay);
  }

  public destroy() {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.pendingMutations = [];
  }
}