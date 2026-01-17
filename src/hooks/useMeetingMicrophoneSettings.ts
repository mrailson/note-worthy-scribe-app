import { useState, useEffect, useCallback, useRef } from 'react';

export interface MicrophoneDevice {
  deviceId: string;
  label: string;
  isDefault: boolean;
}

export type AudioSourceMode = 'microphone' | 'microphone_and_system' | 'system_only';

export interface MeetingMicrophoneSettingsState {
  availableDevices: MicrophoneDevice[];
  selectedDeviceId: string | null;
  audioSourceMode: AudioSourceMode;
  isTestingMic: boolean;
  testVolume: number;
  waveformData: number[];
  testStatus: 'idle' | 'connecting' | 'testing' | 'success' | 'error';
  errorMessage: string | null;
  permissionStatus: 'unknown' | 'granted' | 'denied' | 'prompt';
  recordedAudioUrl: string | null;
  isPlayingBack: boolean;
}

const STORAGE_KEY = 'meeting_recorder_microphone_id';
const AUDIO_SOURCE_STORAGE_KEY = 'meeting_recorder_audio_source';
const WAVEFORM_BARS = 32;

export const useMeetingMicrophoneSettings = () => {
  const [state, setState] = useState<MeetingMicrophoneSettingsState>({
    availableDevices: [],
    selectedDeviceId: null,
    audioSourceMode: 'microphone',
    isTestingMic: false,
    testVolume: 0,
    waveformData: new Array(WAVEFORM_BARS).fill(0),
    testStatus: 'idle',
    errorMessage: null,
    permissionStatus: 'unknown',
    recordedAudioUrl: null,
    isPlayingBack: false,
  });

  const testStreamRef = useRef<MediaStream | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const testTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTestingRef = useRef<boolean>(false);
  const maxVolumeRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Load saved device ID and audio source mode from localStorage
  useEffect(() => {
    try {
      const savedDeviceId = localStorage.getItem(STORAGE_KEY);
      const savedAudioSource = localStorage.getItem(AUDIO_SOURCE_STORAGE_KEY) as AudioSourceMode | null;
      
      setState(prev => ({
        ...prev,
        selectedDeviceId: savedDeviceId || prev.selectedDeviceId,
        audioSourceMode: savedAudioSource || 'microphone',
      }));
    } catch (e) {
      console.warn('Could not load saved microphone settings:', e);
    }
  }, []);

  // Check permission status
  const checkPermission = useCallback(async () => {
    try {
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setState(prev => ({ ...prev, permissionStatus: result.state as MeetingMicrophoneSettingsState['permissionStatus'] }));
        
        result.addEventListener('change', () => {
          setState(prev => ({ ...prev, permissionStatus: result.state as MeetingMicrophoneSettingsState['permissionStatus'] }));
        });
      }
    } catch (e) {
      console.log('Permissions API not available');
    }
  }, []);

  // Enumerate available audio input devices WITHOUT triggering permission prompt
  // Only enumerate - labels may be blank until permission is granted
  const enumerateDevices = useCallback(async (forcePermission: boolean = false) => {
    try {
      // Only call getUserMedia if explicitly forced (e.g., user clicked "Enable Microphone")
      if (forcePermission) {
        console.log('🎤 Force requesting microphone permission...');
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempStream.getTracks().forEach(track => track.stop());
        setState(prev => ({ ...prev, permissionStatus: 'granted' }));
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map((device, index) => {
          // Labels may be blank if permission not yet granted - that's OK
          let label = device.label || `Microphone ${index + 1}`;
          label = label.replace(/\s*\([0-9a-fA-F]{4}:[0-9a-fA-F]{4}\)\s*/g, '').trim();
          
          return {
            deviceId: device.deviceId,
            label,
            isDefault: device.deviceId === 'default' || index === 0,
          };
        });

      setState(prev => {
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

  // Force permission request (call this when user explicitly wants to enable mic)
  const requestMicrophonePermission = useCallback(async () => {
    return enumerateDevices(true);
  }, [enumerateDevices]);

  // Select a device
  const selectDevice = useCallback((deviceId: string) => {
    setState(prev => ({ ...prev, selectedDeviceId: deviceId }));
    try {
      localStorage.setItem(STORAGE_KEY, deviceId);
    } catch (e) {
      console.warn('Could not save microphone setting:', e);
    }
  }, []);

  // Select audio source mode
  const selectAudioSource = useCallback((mode: AudioSourceMode) => {
    setState(prev => ({ ...prev, audioSourceMode: mode }));
    try {
      localStorage.setItem(AUDIO_SOURCE_STORAGE_KEY, mode);
    } catch (e) {
      console.warn('Could not save audio source setting:', e);
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach(track => track.stop());
      testStreamRef.current = null;
    }
    if (systemStreamRef.current) {
      systemStreamRef.current.getTracks().forEach(track => track.stop());
      systemStreamRef.current = null;
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
    audioChunksRef.current = [];
    
    if (state.recordedAudioUrl) {
      URL.revokeObjectURL(state.recordedAudioUrl);
    }
    
    setState(prev => ({
      ...prev,
      isTestingMic: true,
      testStatus: 'connecting',
      testVolume: 0,
      waveformData: new Array(WAVEFORM_BARS).fill(0),
      errorMessage: null,
      recordedAudioUrl: null,
      isPlayingBack: false,
    }));

    try {
      const deviceId = state.selectedDeviceId;
      const mode = state.audioSourceMode;
      let finalStream: MediaStream;

      // Get microphone stream if needed
      if (mode === 'microphone' || mode === 'microphone_and_system') {
        const constraints: MediaStreamConstraints = {
          audio: deviceId
            ? { deviceId: { exact: deviceId } }
            : true,
        };
        console.log('Starting mic test with constraints:', constraints);
        testStreamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
      }

      // Get system audio stream if needed (requires screen share)
      if (mode === 'microphone_and_system' || mode === 'system_only') {
        console.log('Requesting system audio via screen share...');
        try {
          systemStreamRef.current = await navigator.mediaDevices.getDisplayMedia({
            video: true, // Required, but we'll ignore it
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            } as any,
          });
          
          // Stop the video track immediately - we only want audio
          systemStreamRef.current.getVideoTracks().forEach(track => track.stop());
          
          const audioTracks = systemStreamRef.current.getAudioTracks();
          if (audioTracks.length === 0) {
            throw new Error('No system audio available. Make sure to select "Share audio" in the screen share dialog.');
          }
          console.log('✅ System audio captured:', audioTracks[0].label);
        } catch (e: any) {
          console.error('Failed to get system audio:', e);
          if (mode === 'system_only') {
            throw new Error('System audio capture cancelled or not available. Make sure to check "Share audio" in the dialog.');
          }
          // For mixed mode, continue with just microphone
          console.log('Continuing with microphone only');
        }
      }

      // Create the final stream based on what we captured
      audioContextRef.current = new AudioContext();
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.3;

      const destination = audioContextRef.current.createMediaStreamDestination();

      // Connect microphone if available
      if (testStreamRef.current) {
        const micSource = audioContextRef.current.createMediaStreamSource(testStreamRef.current);
        micSource.connect(analyserRef.current);
        micSource.connect(destination);
      }

      // Connect system audio if available
      if (systemStreamRef.current && systemStreamRef.current.getAudioTracks().length > 0) {
        const systemSource = audioContextRef.current.createMediaStreamSource(systemStreamRef.current);
        // Apply gain to make system audio more audible
        const gainNode = audioContextRef.current.createGain();
        gainNode.gain.value = 1.5; // Boost system audio slightly
        systemSource.connect(gainNode);
        gainNode.connect(analyserRef.current);
        gainNode.connect(destination);
      }

      // Use the mixed stream for recording
      finalStream = destination.stream;
      
      mediaRecorderRef.current = new MediaRecorder(finalStream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.start();
      
      setState(prev => ({ ...prev, testStatus: 'testing' }));

      const frequencyData = new Uint8Array(analyserRef.current.frequencyBinCount);
      const timeDomainData = new Uint8Array(analyserRef.current.frequencyBinCount);

      const updateVolume = () => {
        if (!isTestingRef.current || !analyserRef.current) {
          return;
        }

        analyserRef.current.getByteFrequencyData(frequencyData);
        analyserRef.current.getByteTimeDomainData(timeDomainData);
        
        let sum = 0;
        for (let i = 0; i < timeDomainData.length; i++) {
          const normalized = (timeDomainData[i] - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / timeDomainData.length);
        const volumePercent = Math.min(100, Math.round(rms * 400));
        
        maxVolumeRef.current = Math.max(maxVolumeRef.current, volumePercent);

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
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { 
              type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
            });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            setState(prev => ({
              ...prev,
              recordedAudioUrl: audioUrl,
            }));
          };
          mediaRecorderRef.current.stop();
        }
        
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
      console.error('Failed to start audio test:', error);
      cleanupTest();
      
      let errorMessage = 'Could not access audio';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Audio access denied or screen share cancelled';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Selected microphone not found. It may have been disconnected.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Selected microphone is not available';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setState(prev => ({
        ...prev,
        isTestingMic: false,
        testStatus: 'error',
        errorMessage,
      }));
    }
  }, [state.selectedDeviceId, state.audioSourceMode, state.recordedAudioUrl, cleanupTest]);

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

  // Play recorded audio
  const playRecordedAudio = useCallback(() => {
    if (!state.recordedAudioUrl) return;
    
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    
    audioElementRef.current = new Audio(state.recordedAudioUrl);
    audioElementRef.current.onplay = () => {
      setState(prev => ({ ...prev, isPlayingBack: true }));
    };
    audioElementRef.current.onended = () => {
      setState(prev => ({ ...prev, isPlayingBack: false }));
    };
    audioElementRef.current.onpause = () => {
      setState(prev => ({ ...prev, isPlayingBack: false }));
    };
    audioElementRef.current.play();
  }, [state.recordedAudioUrl]);

  // Stop playback
  const stopPlayback = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    setState(prev => ({ ...prev, isPlayingBack: false }));
  }, []);

  // Listen for device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      console.log('Audio devices changed, re-enumerating...');
      enumerateDevices(false); // Don't force permission on device change
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    // Check permission status without prompting
    checkPermission();
    
    // Enumerate devices WITHOUT forcing permission prompt
    // Labels may be blank - that's OK, they'll populate after user grants permission
    enumerateDevices(false);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      cleanupTest();
    };
  }, [enumerateDevices, checkPermission, cleanupTest]);

  return {
    ...state,
    enumerateDevices,
    requestMicrophonePermission,
    selectDevice,
    selectAudioSource,
    startMicTest,
    stopMicTest,
    playRecordedAudio,
    stopPlayback,
  };
};
