import { useState, useEffect, useCallback, useRef } from 'react';

export interface MicrophoneDevice {
  deviceId: string;
  label: string;
  isDefault: boolean;
}

export interface MicrophoneSettingsState {
  availableDevices: MicrophoneDevice[];
  selectedDeviceId: string | null;
  isTestingMic: boolean;
  testVolume: number;
  testStatus: 'idle' | 'connecting' | 'testing' | 'success' | 'error';
  errorMessage: string | null;
  permissionStatus: 'unknown' | 'granted' | 'denied' | 'prompt';
}

const STORAGE_KEY = 'gpscribe_microphone_device_id';

export const useMicrophoneSettings = () => {
  const [state, setState] = useState<MicrophoneSettingsState>({
    availableDevices: [],
    selectedDeviceId: null,
    isTestingMic: false,
    testVolume: 0,
    testStatus: 'idle',
    errorMessage: null,
    permissionStatus: 'unknown',
  });

  const testStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const testTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved device ID from localStorage
  useEffect(() => {
    try {
      const savedDeviceId = localStorage.getItem(STORAGE_KEY);
      if (savedDeviceId) {
        setState(prev => ({ ...prev, selectedDeviceId: savedDeviceId }));
      }
    } catch (e) {
      console.warn('Could not load saved microphone setting:', e);
    }
  }, []);

  // Check permission status
  const checkPermission = useCallback(async () => {
    try {
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setState(prev => ({ ...prev, permissionStatus: result.state as MicrophoneSettingsState['permissionStatus'] }));
        
        result.addEventListener('change', () => {
          setState(prev => ({ ...prev, permissionStatus: result.state as MicrophoneSettingsState['permissionStatus'] }));
        });
      }
    } catch (e) {
      // Permission API not supported, we'll find out when we try to access
      console.log('Permissions API not available');
    }
  }, []);

  // Enumerate available audio input devices
  const enumerateDevices = useCallback(async () => {
    try {
      // Request permission first to get device labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach(track => track.stop());
      
      setState(prev => ({ ...prev, permissionStatus: 'granted' }));

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${index + 1}`,
          isDefault: device.deviceId === 'default' || index === 0,
        }));

      setState(prev => {
        // If no device selected yet, select the default one
        const currentSelection = prev.selectedDeviceId;
        const validSelection = audioInputs.some(d => d.deviceId === currentSelection);
        const defaultDevice = audioInputs.find(d => d.isDefault) || audioInputs[0];
        
        return {
          ...prev,
          availableDevices: audioInputs,
          selectedDeviceId: validSelection ? currentSelection : (defaultDevice?.deviceId || null),
          errorMessage: null,
        };
      });

      return audioInputs;
    } catch (error: any) {
      console.error('Failed to enumerate devices:', error);
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setState(prev => ({
          ...prev,
          permissionStatus: 'denied',
          errorMessage: 'Microphone access denied. Please allow microphone access in your browser settings.',
        }));
      } else {
        setState(prev => ({
          ...prev,
          errorMessage: `Could not access microphones: ${error.message}`,
        }));
      }
      
      return [];
    }
  }, []);

  // Select a device
  const selectDevice = useCallback((deviceId: string) => {
    setState(prev => ({ ...prev, selectedDeviceId: deviceId }));
    try {
      localStorage.setItem(STORAGE_KEY, deviceId);
    } catch (e) {
      console.warn('Could not save microphone setting:', e);
    }
  }, []);

  // Clean up test resources
  const cleanupTest = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (testTimeoutRef.current) {
      clearTimeout(testTimeoutRef.current);
      testTimeoutRef.current = null;
    }
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach(track => track.stop());
      testStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  // Start microphone test
  const startMicTest = useCallback(async () => {
    cleanupTest();
    
    setState(prev => ({
      ...prev,
      isTestingMic: true,
      testStatus: 'connecting',
      testVolume: 0,
      errorMessage: null,
    }));

    try {
      const constraints: MediaStreamConstraints = {
        audio: state.selectedDeviceId
          ? { deviceId: { exact: state.selectedDeviceId } }
          : true,
      };

      testStreamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Create audio context and analyser
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      const source = audioContextRef.current.createMediaStreamSource(testStreamRef.current);
      source.connect(analyserRef.current);

      setState(prev => ({ ...prev, testStatus: 'testing' }));

      // Monitor volume levels
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      let maxVolumeDetected = 0;

      const updateVolume = () => {
        if (!analyserRef.current || !state.isTestingMic) return;

        analyserRef.current.getByteTimeDomainData(dataArray);
        
        // Calculate RMS volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const normalized = (dataArray[i] - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const volumePercent = Math.min(100, Math.round(rms * 500)); // Scale for visibility
        
        maxVolumeDetected = Math.max(maxVolumeDetected, volumePercent);

        setState(prev => {
          if (prev.testStatus === 'testing') {
            return { ...prev, testVolume: volumePercent };
          }
          return prev;
        });

        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      animationFrameRef.current = requestAnimationFrame(updateVolume);

      // Auto-stop after 5 seconds
      testTimeoutRef.current = setTimeout(() => {
        cleanupTest();
        setState(prev => ({
          ...prev,
          isTestingMic: false,
          testStatus: maxVolumeDetected > 5 ? 'success' : 'error',
          testVolume: 0,
          errorMessage: maxVolumeDetected <= 5 
            ? 'No audio detected. Please check your microphone connection and try speaking.'
            : null,
        }));
      }, 5000);

    } catch (error: any) {
      console.error('Failed to start mic test:', error);
      cleanupTest();
      
      let errorMessage = 'Could not access microphone';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Microphone access denied';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Selected microphone not found. It may have been disconnected.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Selected microphone is not available';
      }

      setState(prev => ({
        ...prev,
        isTestingMic: false,
        testStatus: 'error',
        errorMessage,
      }));
    }
  }, [state.selectedDeviceId, cleanupTest]);

  // Stop microphone test
  const stopMicTest = useCallback(() => {
    cleanupTest();
    setState(prev => ({
      ...prev,
      isTestingMic: false,
      testStatus: 'idle',
      testVolume: 0,
    }));
  }, [cleanupTest]);

  // Listen for device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      console.log('Audio devices changed, re-enumerating...');
      enumerateDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    // Initial enumeration
    checkPermission();
    enumerateDevices();

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      cleanupTest();
    };
  }, [enumerateDevices, checkPermission, cleanupTest]);

  return {
    ...state,
    enumerateDevices,
    selectDevice,
    startMicTest,
    stopMicTest,
  };
};
