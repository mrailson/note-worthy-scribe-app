// Development guard to prevent postMessage origin mismatch errors
// This shim intercepts postMessage calls and uses dynamic origins

const originalPostMessage = window.postMessage;

window.postMessage = function(message: any, targetOrigin?: string, transfer?: Transferable[]) {
  try {
    // Use dynamic origin in development to prevent mismatch errors
    const safeOrigin = targetOrigin === "*" ? "*" : location.origin;
    return originalPostMessage.call(this, message, safeOrigin, transfer);
  } catch (e) {
    console.warn("postMessage intercepted: origin mismatch prevented", { 
      targetOrigin, 
      currentOrigin: location.origin 
    });
  }
};