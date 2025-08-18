/**
 * Device Detection Utilities
 * 
 * Centralized device detection logic for consistent routing
 * across different recording components.
 */

export interface DeviceInfo {
  isIOS: boolean;
  isSafari: boolean;
  isChromium: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  useChromiumMicPipeline: boolean;
  deviceType: 'ios' | 'android' | 'safari_desktop' | 'chromium_desktop' | 'other_desktop';
}

export function detectDevice(): DeviceInfo {
  const userAgent = navigator.userAgent;
  
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isSafari = /Safari/.test(userAgent) && !/Chrome|Edg/.test(userAgent);
  const isChromium = /Chrome|Edg/.test(userAgent);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isDesktop = !isMobile;
  
  // Feature flag for Chromium mic pipeline (default: false)
  const useChromiumMicPipeline = 
    isChromium && 
    isDesktop && 
    import.meta.env.VITE_USE_CHROMIUM_MIC_PIPELINE === 'true';

  let deviceType: DeviceInfo['deviceType'];
  if (isIOS) {
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
    isSafari,
    isChromium,
    isMobile,
    isDesktop,
    useChromiumMicPipeline,
    deviceType
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
  
  if (device.isIOS) {
    return 'iPhoneWhisperTranscriber';
  } else if (device.useChromiumMicPipeline) {
    return 'ChromiumMicTranscriber';
  } else if (device.isMobile) {
    return 'DesktopWhisperTranscriber'; // Android uses desktop transcriber
  } else {
    return 'DesktopWhisperTranscriber';
  }
}