import { useState, useEffect, useRef, useCallback } from 'react';
import { showToast } from '@/utils/toastWrapper';
import { detectDevice } from '@/utils/DeviceDetection';
import { iOSAudioAlert } from '@/utils/iOSAudioAlert';

interface WatchdogConfig {
  /** Time in ms before showing warning (default: 60000 = 1 minute) */
  warningThresholdMs?: number;
  /** Time in ms before showing critical alert (default: 120000 = 2 minutes) */
  criticalThresholdMs?: number;
  /** Whether watchdog is active (should be true when recording) */
  isActive: boolean;
  /** Callback when stall is detected */
  onStallDetected?: (stalledDurationMs: number) => void;
  /** Callback when transcription resumes after stall */
  onStallRecovered?: () => void;
  /** Callback to attempt automatic recovery (for mobile) */
  onAutoRecoveryAttempt?: () => void;
}

interface WatchdogState {
  /** Current health status */
  healthStatus: 'healthy' | 'warning' | 'critical' | 'inactive';
  /** Whether transcription appears stalled */
  isStalled: boolean;
  /** Time since last chunk in ms */
  timeSinceLastChunk: number;
  /** Total chunks processed in this session */
  totalChunks: number;
  /** Last chunk timestamp */
  lastChunkTimestamp: Date | null;
  /** Expected chunks per minute based on config */
  expectedChunksPerMinute: number;
  /** Actual chunks per minute (rolling average) */
  actualChunksPerMinute: number;
}

export function useTranscriptionWatchdog(config: WatchdogConfig) {
  const {
    warningThresholdMs = 60000, // 60 seconds - allow time for chunk processing + API latency
    criticalThresholdMs = 90000, // 90 seconds - show modal only after significant delay
    isActive,
    onStallDetected,
    onStallRecovered,
    onAutoRecoveryAttempt
  } = config;

  const device = detectDevice();
  const isMobile = device.isMobile;

  const [state, setState] = useState<WatchdogState>({
    healthStatus: 'inactive',
    isStalled: false,
    timeSinceLastChunk: 0,
    totalChunks: 0,
    lastChunkTimestamp: null,
    expectedChunksPerMinute: 20, // ~3 seconds per chunk = 20 per minute
    actualChunksPerMinute: 0
  });

  const lastChunkTimeRef = useRef<number | null>(null);
  const totalChunksRef = useRef<number>(0);
  const chunkTimestampsRef = useRef<number[]>([]);
  const warningShownRef = useRef<boolean>(false);
  const criticalShownRef = useRef<boolean>(false);
  const wasStalled = useRef<boolean>(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);

  // Reset state when recording starts/stops
  useEffect(() => {
    if (isActive) {
      console.log('🐕 Transcription watchdog activated');
      lastChunkTimeRef.current = Date.now();
      sessionStartTimeRef.current = Date.now();
      totalChunksRef.current = 0;
      chunkTimestampsRef.current = [];
      warningShownRef.current = false;
      criticalShownRef.current = false;
      wasStalled.current = false;
      
      setState(prev => ({
        ...prev,
        healthStatus: 'healthy',
        isStalled: false,
        timeSinceLastChunk: 0,
        totalChunks: 0,
        lastChunkTimestamp: new Date()
      }));
    } else {
      console.log('🐕 Transcription watchdog deactivated');
      setState(prev => ({
        ...prev,
        healthStatus: 'inactive',
        isStalled: false
      }));
    }
  }, [isActive]);

  // Check health every 5 seconds
  useEffect(() => {
    if (!isActive) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    const checkHealth = () => {
      const now = Date.now();
      const lastChunkTime = lastChunkTimeRef.current || now;
      const timeSinceLastChunk = now - lastChunkTime;

      // Calculate rolling chunks per minute (last 5 minutes of data)
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      const recentChunks = chunkTimestampsRef.current.filter(t => t > fiveMinutesAgo);
      const timeWindowMs = Math.min(now - (sessionStartTimeRef.current || now), 5 * 60 * 1000);
      const actualChunksPerMinute = timeWindowMs > 0 
        ? (recentChunks.length / (timeWindowMs / 60000)) 
        : 0;

      // Determine health status
      let healthStatus: WatchdogState['healthStatus'] = 'healthy';
      let isStalled = false;

      if (timeSinceLastChunk >= criticalThresholdMs) {
        healthStatus = 'critical';
        isStalled = true;
      } else if (timeSinceLastChunk >= warningThresholdMs) {
        healthStatus = 'warning';
        isStalled = true;
      }

      // Show warnings/alerts (only once per stall)
      if (isStalled && !wasStalled.current) {
        wasStalled.current = true;
        console.error(`🚨 TRANSCRIPTION STALLED! No chunk for ${Math.round(timeSinceLastChunk / 1000)}s`);
        
        onStallDetected?.(timeSinceLastChunk);

        if (healthStatus === 'critical' && !criticalShownRef.current) {
          criticalShownRef.current = true;
          
          // Play critical audio alert on iOS (works even with screen locked)
          if (isMobile) {
            iOSAudioAlert.playCriticalAlert();
            // Auto-trigger recovery attempt on mobile
            console.log('📱 Auto-triggering recovery attempt on mobile...');
            onAutoRecoveryAttempt?.();
          }
          
          showToast.error(
            'Transcription appears to have stopped. Check your recording.',
            {
              section: 'meeting_manager',
              duration: Infinity,
              description: isMobile 
                ? 'Attempting automatic recovery...' 
                : 'No transcription activity for over 2 minutes'
            }
          );
        } else if (healthStatus === 'warning' && !warningShownRef.current) {
          warningShownRef.current = true;
          
          // Play warning beep on iOS
          if (isMobile) {
            iOSAudioAlert.playWarningBeep();
          }
          
          showToast.warning(
            isMobile 
              ? 'Transcription may be paused - keep app in foreground'
              : 'Transcription may be stalled - checking...',
            {
              section: 'meeting_manager',
              duration: 10000,
              description: `No new text for ${Math.round(timeSinceLastChunk / 1000)}s`
            }
          );
        }
      } else if (!isStalled && wasStalled.current) {
        // Recovered from stall
        wasStalled.current = false;
        warningShownRef.current = false;
        criticalShownRef.current = false;
        console.log('✅ Transcription recovered from stall');
        onStallRecovered?.();
        
        // Play recovery chime on iOS
        if (isMobile) {
          iOSAudioAlert.playRecoveryChime();
        }
        
        showToast.success('Transcription resumed', { section: 'meeting_manager', duration: 3000 });
      }

      setState({
        healthStatus,
        isStalled,
        timeSinceLastChunk,
        totalChunks: totalChunksRef.current,
        lastChunkTimestamp: lastChunkTimeRef.current ? new Date(lastChunkTimeRef.current) : null,
        expectedChunksPerMinute: 20,
        actualChunksPerMinute: Math.round(actualChunksPerMinute * 10) / 10
      });
    };

    checkIntervalRef.current = setInterval(checkHealth, 5000);
    
    // Initial check
    checkHealth();

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [isActive, warningThresholdMs, criticalThresholdMs, onStallDetected, onStallRecovered, onAutoRecoveryAttempt, isMobile]);

  /**
   * Call this whenever a chunk is successfully processed
   */
  const reportChunkProcessed = useCallback(() => {
    const now = Date.now();
    lastChunkTimeRef.current = now;
    totalChunksRef.current += 1;
    chunkTimestampsRef.current.push(now);
    
    // Keep only last 5 minutes of timestamps to prevent memory growth
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    chunkTimestampsRef.current = chunkTimestampsRef.current.filter(t => t > fiveMinutesAgo);

    // Reset warning flags on successful chunk
    warningShownRef.current = false;
    criticalShownRef.current = false;

    console.log(`🐕 Watchdog: Chunk ${totalChunksRef.current} processed`);
  }, []);

  /**
   * Call when a chunk is processed but filtered out (not a stall, just low quality/hallucination)
   * This resets the stall timer without incrementing the chunk count
   */
  const reportChunkFiltered = useCallback(() => {
    // Reset last chunk time to prevent false stalls
    lastChunkTimeRef.current = Date.now();
    
    // Don't increment totalChunksRef - filtered chunks don't count as "processed"
    // But they DO prove the system is still working, so reset stall detection
    
    console.log(`🐕 Watchdog: Chunk filtered (quality/hallucination check) - stall timer reset`);
  }, []);

  /**
   * Call this when visibility changes to check if we need to alert
   */
  const checkOnVisibilityRestore = useCallback(() => {
    if (!isActive || !lastChunkTimeRef.current) return;

    const timeSinceLastChunk = Date.now() - lastChunkTimeRef.current;
    
    if (timeSinceLastChunk > warningThresholdMs) {
      console.warn(`🐕 Tab restored after ${Math.round(timeSinceLastChunk / 1000)}s - transcription may have stalled`);
      
      showToast.warning(
        'Checking transcription status...',
        {
          section: 'meeting_manager',
          duration: 5000,
          description: `Tab was in background for ${Math.round(timeSinceLastChunk / 1000)}s`
        }
      );
      
      return true; // Indicates possible stall
    }
    
    return false;
  }, [isActive, warningThresholdMs]);

  /**
   * Reset the watchdog (e.g., when starting a new recording)
   */
  const reset = useCallback(() => {
    lastChunkTimeRef.current = Date.now();
    totalChunksRef.current = 0;
    chunkTimestampsRef.current = [];
    sessionStartTimeRef.current = Date.now();
    warningShownRef.current = false;
    criticalShownRef.current = false;
    wasStalled.current = false;
    
    setState({
      healthStatus: isActive ? 'healthy' : 'inactive',
      isStalled: false,
      timeSinceLastChunk: 0,
      totalChunks: 0,
      lastChunkTimestamp: new Date(),
      expectedChunksPerMinute: 20,
      actualChunksPerMinute: 0
    });
  }, [isActive]);

  return {
    ...state,
    reportChunkProcessed,
    reportChunkFiltered,
    checkOnVisibilityRestore,
    reset
  };
}
