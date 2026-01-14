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
  waveformData: number[];
  testStatus: 'idle' | 'connecting' | 'testing' | 'success' | 'error';
  errorMessage: string | null;
  permissionStatus: 'unknown' | 'granted' | 'denied' | 'prompt';
}

const STORAGE_KEY = 'gpscribe_microphone_device_id';
const WAVEFORM_BARS = 32;

export const useMicrophoneSettings = () => {
  const [state, setState] = useState<MicrophoneSettingsState>({
    availableDevices: [],
    selectedDeviceId: null,
    isTestingMic: false,
    testVolume: 0,
    waveformData: new Array(WAVEFORM_BARS).fill(0),
    testStatus: 'idle',
    errorMessage: null,
    permissionStatus: 'unknown',
  });

  const testStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const testTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTestingRef = useRef<boolean>(false);
  const maxVolumeRef = useRef<number>(0);

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
        .map((device, index) => {
          // Clean up the label by removing technical codes in brackets like (0c76:0063)
          let label = device.label || `Microphone ${index + 1}`;
          // Remove USB vendor:product IDs like (0c76:0063) or (1bcf:2cc9)
          label = label.replace(/\s*\([0-9a-fA-F]{4}:[0-9a-fA-F]{4}\)\s*/g, '').trim();
          
          return {
            deviceId: device.deviceId,
            label,
            isDefault: device.deviceId === 'default' || index === 0,
          };
        });

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
    isTestingRef.current = false;
    
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
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  // Start microphone test
  const startMicTest = useCallback(async () => {
    cleanupTest();
    maxVolumeRef.current = 0;
    isTestingRef.current = true;
    
    setState(prev => ({
      ...prev,
      isTestingMic: true,
      testStatus: 'connecting',
      testVolume: 0,
      waveformData: new Array(WAVEFORM_BARS).fill(0),
      errorMessage: null,
    }));

    try {
      // Get selected device ID from current state
      const deviceId = state.selectedDeviceId;
      
      const constraints: MediaStreamConstraints = {
        audio: deviceId
          ? { deviceId: { exact: deviceId } }
          : true,
      };

      console.log('Starting mic test with constraints:', constraints);
      testStreamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Got media stream:', testStreamRef.current.getAudioTracks());
      
      // Create audio context and analyser
      audioContextRef.current = new AudioContext();
      
      // Resume audio context if suspended (required by some browsers)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.3;
      
      const source = audioContextRef.current.createMediaStreamSource(testStreamRef.current);
      source.connect(analyserRef.current);

      console.log('Audio context state:', audioContextRef.current.state);
      setState(prev => ({ ...prev, testStatus: 'testing' }));

      // Monitor volume levels using frequency data for waveform
      const frequencyData = new Uint8Array(analyserRef.current.frequencyBinCount);
      const timeDomainData = new Uint8Array(analyserRef.current.frequencyBinCount);

      const updateVolume = () => {
        if (!isTestingRef.current || !analyserRef.current) {
          console.log('Stopping volume update - not testing anymore');
          return;
        }

        // Get frequency data for waveform visualisation
        analyserRef.current.getByteFrequencyData(frequencyData);
        analyserRef.current.getByteTimeDomainData(timeDomainData);
        
        // Calculate RMS volume from time domain data
        let sum = 0;
        for (let i = 0; i < timeDomainData.length; i++) {
          const normalized = (timeDomainData[i] - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / timeDomainData.length);
        const volumePercent = Math.min(100, Math.round(rms * 400)); // Scale for visibility
        
        maxVolumeRef.current = Math.max(maxVolumeRef.current, volumePercent);

        // Create waveform data from frequency bins
        const waveform: number[] = [];
        const binsPerBar = Math.floor(frequencyData.length / WAVEFORM_BARS);
        for (let i = 0; i < WAVEFORM_BARS; i++) {
          let barSum = 0;
          for (let j = 0; j < binsPerBar; j++) {
            barSum += frequencyData[i * binsPerBar + j];
          }
          const barAvg = barSum / binsPerBar;
          waveform.push(Math.round((barAvg / 255) * 100));
        }

        setState(prev => ({
          ...prev,
          testVolume: volumePercent,
          waveformData: waveform,
        }));

        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      animationFrameRef.current = requestAnimationFrame(updateVolume);

      // Auto-stop after 5 seconds
      testTimeoutRef.current = setTimeout(() => {
        const maxVolume = maxVolumeRef.current;
        console.log('Test complete, max volume detected:', maxVolume);
        cleanupTest();
        setState(prev => ({
          ...prev,
          isTestingMic: false,
          testStatus: maxVolume > 3 ? 'success' : 'error',
          testVolume: 0,
          waveformData: new Array(WAVEFORM_BARS).fill(0),
          errorMessage: maxVolume <= 3 
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
      waveformData: new Array(WAVEFORM_BARS).fill(0),
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
