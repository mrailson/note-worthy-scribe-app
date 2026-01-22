/**
 * Device Detection Utilities
 * 
 * Centralized device detection logic for consistent routing
 * across different recording components.
 */

export interface DeviceInfo {
  isIOS: boolean;
  isIPhone: boolean;
  isSafari: boolean;
  isChromium: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  isAndroid: boolean;
  isSamsungBrowser: boolean;
  androidBrowser: 'chrome' | 'samsung' | 'firefox' | 'other';
  useChromiumMicPipeline: boolean;
  deviceType: 'ios' | 'iphone' | 'android' | 'safari_desktop' | 'chromium_desktop' | 'other_desktop';
  hasNotch: boolean;
  supportsViewportUnits: boolean;
  needsKeyboardWorkaround: boolean;
}

export function detectDevice(): DeviceInfo {
  const userAgent = navigator.userAgent;
  
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isIPhone = /iPhone/.test(userAgent) || (isIOS && window.innerWidth <= 768);
  const isSafari = /Safari/.test(userAgent) && !/Chrome|Edg/.test(userAgent);
  const isChromium = /Chrome|Edg/.test(userAgent);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isDesktop = !isMobile;
  
  // Android-specific detection
  const isAndroid = /Android/.test(userAgent);
  const isSamsungBrowser = /SamsungBrowser/.test(userAgent);
  
  let androidBrowser: 'chrome' | 'samsung' | 'firefox' | 'other' = 'other';
  if (isAndroid) {
    if (isSamsungBrowser) androidBrowser = 'samsung';
    else if (/Chrome/.test(userAgent)) androidBrowser = 'chrome';
    else if (/Firefox/.test(userAgent)) androidBrowser = 'firefox';
  }
  
  // Feature flag for Chromium mic pipeline (default: false)
  const useChromiumMicPipeline = 
    isChromium && 
    isDesktop && 
    import.meta.env.VITE_USE_CHROMIUM_MIC_PIPELINE === 'true';

  // Detect iPhone with notch (iPhone X and later)
  const hasNotch = isIOS && (
    window.screen.height >= 812 || // iPhone X+ portrait
    window.screen.width >= 812     // iPhone X+ landscape
  );

  // Check viewport unit support
  const supportsViewportUnits = CSS.supports('height', '100dvh') || 
                               CSS.supports('height', '100vh');

  // iOS Safari needs keyboard workarounds
  const needsKeyboardWorkaround = isIOS && isSafari;

  let deviceType: DeviceInfo['deviceType'];
  if (isIPhone) {
    deviceType = 'iphone';
  } else if (isIOS) {
    deviceType = 'ios';
  } else if (isMobile) {
    deviceType = 'android';
  } else if (isSafari && isDesktop) {
    deviceType = 'safari_desktop';
  } else if (isChromium && isDesktop) {
    deviceType = 'chromium_desktop';
  } else {
    deviceType = 'other_desktop';
  }

  return {
    isIOS,
    isIPhone,
    isSafari,
    isChromium,
    isMobile,
    isDesktop,
    isAndroid,
    isSamsungBrowser,
    androidBrowser,
    useChromiumMicPipeline,
    deviceType,
    hasNotch,
    supportsViewportUnits,
    needsKeyboardWorkaround
  };
}

export function logDeviceInfo(context: string = 'general'): void {
  const device = detectDevice();
  console.log(`🎯 Device detection [${context}]:`, {
    ...device,
    userAgent: navigator.userAgent.substring(0, 100),
    featureFlag: import.meta.env.VITE_USE_CHROMIUM_MIC_PIPELINE
  });
}

/**
 * Get recommended transcriber for the current device
 */
export function getRecommendedTranscriber(): string {
  const device = detectDevice();
  
  if (device.isIPhone) {
    return 'iPhoneWhisperTranscriber';
  } else if (device.isIOS) {
    return 'iPhoneWhisperTranscriber';
  } else if (device.isAndroid) {
    return 'AndroidWhisperTranscriber'; // NEW: Dedicated Android path
  } else if (device.useChromiumMicPipeline) {
    return 'ChromiumMicTranscriber';
  } else {
    return 'DesktopWhisperTranscriber';
  }
}