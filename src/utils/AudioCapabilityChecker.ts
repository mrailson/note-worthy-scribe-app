export interface AudioCapabilities {
  canCaptureSystemAudio: boolean;
  canUseDisplayMedia: boolean;
  canUseWASAPI: boolean;
  hasVirtualAudioDevice: boolean;
  isLikelyLockedDown: boolean;
  recommendedMode: 'full' | 'mic-only' | 'phone-recommended';
  diagnosisMessage: string;
  testResults: {
    displayMediaTest: { success: boolean; error?: string };
    deviceEnumeration: { success: boolean; devices: string[] };
    corporateDetection: { isNHS: boolean; isCorporate: boolean };
  };
}

const NHS_INDICATORS = [
  'nhs.net',
  'nhs.uk',
  'nhsmail',
  'england.nhs',
  'pcnhs',
];

const CORPORATE_INDICATORS = [
  'intune',
  'azuread',
  'managedpc',
  'corporate',
  'enterprise',
];

/**
 * Comprehensive audio capability checker for NHS/corporate laptops
 * Tests system audio capture, virtual devices, and policy restrictions
 */
export async function checkAudioCapabilities(): Promise<AudioCapabilities> {
  console.log('🔍 Starting audio capability check...');
  
  const capabilities: AudioCapabilities = {
    canCaptureSystemAudio: false,
    canUseDisplayMedia: false,
    canUseWASAPI: false,
    hasVirtualAudioDevice: false,
    isLikelyLockedDown: false,
    recommendedMode: 'full',
    diagnosisMessage: '',
    testResults: {
      displayMediaTest: { success: false },
      deviceEnumeration: { success: false, devices: [] },
      corporateDetection: { isNHS: false, isCorporate: false },
    },
  };

  // 1. Test getDisplayMedia availability
  try {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      capabilities.testResults.displayMediaTest = {
        success: false,
        error: 'getDisplayMedia not available',
      };
      console.log('❌ getDisplayMedia API not available');
    } else {
      // Try to initiate (will be cancelled by user or policy)
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: false,
          audio: true,
        });
        
        // If we get here, it worked!
        capabilities.canUseDisplayMedia = true;
        capabilities.canCaptureSystemAudio = true;
        capabilities.testResults.displayMediaTest = { success: true };
        
        // Stop the test stream immediately
        stream.getTracks().forEach(track => track.stop());
        console.log('✅ getDisplayMedia works - system audio capture available');
      } catch (error: any) {
        capabilities.testResults.displayMediaTest = {
          success: false,
          error: error.message || 'Permission denied',
        };
        
        // User cancelled or policy blocked
        if (error.name === 'NotAllowedError') {
          console.log('⚠️ getDisplayMedia blocked by policy or user cancelled');
        } else if (error.name === 'NotSupportedError') {
          console.log('⚠️ getDisplayMedia not supported by browser');
        } else {
          console.log('⚠️ getDisplayMedia failed:', error.message);
        }
      }
    }
  } catch (error) {
    console.error('Error testing getDisplayMedia:', error);
  }

  // 2. Enumerate audio devices to look for virtual audio cables
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');
    
    capabilities.testResults.deviceEnumeration = {
      success: true,
      devices: audioInputs.map(d => d.label || d.deviceId),
    };

    // Check for virtual audio devices
    const virtualDeviceNames = [
      'VB-Cable',
      'VoiceMeeter',
      'Stereo Mix',
      'Wave Link',
      'Virtual Audio Cable',
      'WASAPI',
      'Loopback',
    ];

    capabilities.hasVirtualAudioDevice = audioInputs.some(device => {
      const label = device.label.toLowerCase();
      return virtualDeviceNames.some(vd => label.includes(vd.toLowerCase()));
    });

    if (capabilities.hasVirtualAudioDevice) {
      console.log('✅ Virtual audio device detected');
      capabilities.canCaptureSystemAudio = true;
    } else {
      console.log('❌ No virtual audio devices found');
    }
  } catch (error) {
    console.error('Error enumerating devices:', error);
  }

  // 3. Detect NHS/Corporate environment
  try {
    const hostname = window.location.hostname.toLowerCase();
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Check for NHS indicators
    capabilities.testResults.corporateDetection.isNHS = NHS_INDICATORS.some(
      indicator => hostname.includes(indicator) || userAgent.includes(indicator)
    );
    
    // Check for corporate indicators
    capabilities.testResults.corporateDetection.isCorporate = CORPORATE_INDICATORS.some(
      indicator => userAgent.includes(indicator)
    );

    if (capabilities.testResults.corporateDetection.isNHS) {
      console.log('🏥 NHS environment detected');
    }
    
    if (capabilities.testResults.corporateDetection.isCorporate) {
      console.log('🏢 Corporate/managed environment detected');
    }
  } catch (error) {
    console.error('Error detecting corporate environment:', error);
  }

  // 4. Determine if likely locked down
  capabilities.isLikelyLockedDown = 
    !capabilities.canCaptureSystemAudio && 
    (capabilities.testResults.corporateDetection.isNHS || 
     capabilities.testResults.corporateDetection.isCorporate);

  // 5. Determine recommended mode
  if (capabilities.canCaptureSystemAudio) {
    capabilities.recommendedMode = 'full';
    capabilities.diagnosisMessage = 'System audio capture is available. You can record both your microphone and meeting participants.';
  } else if (capabilities.isLikelyLockedDown) {
    capabilities.recommendedMode = 'phone-recommended';
    capabilities.diagnosisMessage = 'Your device appears to be locked down (NHS/corporate). We recommend using your phone for best results, or trying the browser Teams option.';
  } else {
    capabilities.recommendedMode = 'mic-only';
    capabilities.diagnosisMessage = 'Only microphone capture is available. Consider using your phone or joining Teams via browser to capture all participants.';
  }

  console.log('✅ Audio capability check complete:', capabilities);
  
  return capabilities;
}

/**
 * Quick capability check using cached results (valid for 24 hours)
 */
export async function quickCapabilityCheck(): Promise<AudioCapabilities> {
  const CACHE_KEY = 'notewell_audio_capabilities';
  const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { timestamp, capabilities } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      
      if (age < CACHE_DURATION) {
        console.log('📦 Using cached audio capabilities (age: ' + Math.round(age / 1000 / 60) + ' minutes)');
        return capabilities;
      }
    }
  } catch (error) {
    console.error('Error reading cached capabilities:', error);
  }

  // Run full check and cache
  const capabilities = await checkAudioCapabilities();
  
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      capabilities,
    }));
  } catch (error) {
    console.error('Error caching capabilities:', error);
  }

  return capabilities;
}

/**
 * Clear cached capabilities (useful after system changes)
 */
export function clearCapabilityCache(): void {
  localStorage.removeItem('notewell_audio_capabilities');
  console.log('🗑️ Cleared audio capability cache');
}
