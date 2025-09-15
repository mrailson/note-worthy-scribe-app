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
        // Safely process added nodes
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          this.processNodesSafely(Array.from(mutation.addedNodes), processedNodes, 'added');
        }

        // Safely process removed nodes
        if (mutation.removedNodes && mutation.removedNodes.length > 0) {
          this.processNodesSafely(Array.from(mutation.removedNodes), processedNodes, 'removed');
        }
      } catch (error) {
        console.error('🚨 DOM Safety: Mutation processing error:', error);
        continue; // Skip this mutation, process next
      }
    }

    // Call registered callbacks
    this.callbacks.forEach(callback => {
      try {
        callback(mutations);
      } catch (error) {
        console.error('🚨 DOM Safety: Callback error:', error);
      }
    });
  }

  private processNodesSafely(nodes: Node[], processedNodes: WeakSet<Node>, type: 'added' | 'removed') {
    for (const node of nodes) {
      try {
        // Skip if already processed
        if (processedNodes.has(node)) continue;
        processedNodes.add(node);

        // CRITICAL: Only process Element nodes (nodeType === 1)
        if (node && node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          
          // Safe to call hasAttribute now
          if (element.hasAttribute && typeof element.hasAttribute === 'function') {
            this.processElementSafely(element, type);
          }
        }

        // Recursively process child nodes if they exist
        if (node.childNodes && node.childNodes.length > 0) {
          this.processNodesSafely(Array.from(node.childNodes), processedNodes, type);
        }
      } catch (error) {
        console.error('🚨 DOM Safety: Node processing error:', error);
        continue; // Skip this node, process next
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