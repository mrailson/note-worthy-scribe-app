import { useState, useEffect, useRef, useCallback } from 'react';
import { showToast } from '@/utils/toastWrapper';

interface ConnectionHealthConfig {
  /** Whether monitoring is active (should be true when recording) */
  isActive: boolean;
  /** Interval in ms to check connection health (default: 5000 = 5 seconds) */
  checkIntervalMs?: number;
  /** Time without heartbeat before warning (default: 10000 = 10 seconds) */
  heartbeatTimeoutMs?: number;
  /** Callback when connection appears unhealthy */
  onConnectionUnhealthy?: () => void;
  /** Callback when connection recovers */
  onConnectionRecovered?: () => void;
  /** Optional WebSocket reference to monitor */
  webSocketRef?: React.MutableRefObject<WebSocket | null>;
}

interface ConnectionHealthState {
  /** Current connection status */
  status: 'connected' | 'degraded' | 'disconnected' | 'inactive';
  /** Last successful heartbeat time */
  lastHeartbeat: Date | null;
  /** Time since last heartbeat in ms */
  timeSinceHeartbeat: number;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Whether a reconnection is in progress */
  isReconnecting: boolean;
}

export function useConnectionHealth(config: ConnectionHealthConfig) {
  const {
    isActive,
    checkIntervalMs = 5000,
    heartbeatTimeoutMs = 10000,
    onConnectionUnhealthy,
    onConnectionRecovered,
    webSocketRef
  } = config;

  const [state, setState] = useState<ConnectionHealthState>({
    status: 'inactive',
    lastHeartbeat: null,
    timeSinceHeartbeat: 0,
    reconnectAttempts: 0,
    isReconnecting: false
  });

  const lastHeartbeatRef = useRef<number | null>(null);
  const wasUnhealthyRef = useRef<boolean>(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  // Reset when monitoring starts/stops
  useEffect(() => {
    if (isActive) {
      console.log('🔌 Connection health monitor activated');
      lastHeartbeatRef.current = Date.now();
      wasUnhealthyRef.current = false;
      reconnectAttemptsRef.current = 0;
      
      setState({
        status: 'connected',
        lastHeartbeat: new Date(),
        timeSinceHeartbeat: 0,
        reconnectAttempts: 0,
        isReconnecting: false
      });
    } else {
      console.log('🔌 Connection health monitor deactivated');
      setState(prev => ({
        ...prev,
        status: 'inactive'
      }));
    }
  }, [isActive]);

  // Periodic health check
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
      const lastHeartbeat = lastHeartbeatRef.current || now;
      const timeSinceHeartbeat = now - lastHeartbeat;

      // Check WebSocket state if available
      let wsState: number | null = null;
      if (webSocketRef?.current) {
        wsState = webSocketRef.current.readyState;
      }

      // Determine connection status
      let status: ConnectionHealthState['status'] = 'connected';
      
      if (wsState !== null) {
        if (wsState === WebSocket.CLOSED || wsState === WebSocket.CLOSING) {
          status = 'disconnected';
        } else if (wsState === WebSocket.CONNECTING) {
          status = 'degraded';
        }
      }

      if (status === 'connected' && timeSinceHeartbeat > heartbeatTimeoutMs) {
        status = 'degraded';
      }

      // Handle state transitions
      if ((status === 'disconnected' || status === 'degraded') && !wasUnhealthyRef.current) {
        wasUnhealthyRef.current = true;
        console.warn(`🔌 Connection unhealthy: ${status}, time since heartbeat: ${Math.round(timeSinceHeartbeat / 1000)}s`);
        onConnectionUnhealthy?.();
      } else if (status === 'connected' && wasUnhealthyRef.current) {
        wasUnhealthyRef.current = false;
        console.log('🔌 Connection recovered');
        onConnectionRecovered?.();
        reconnectAttemptsRef.current = 0;
      }

      setState({
        status,
        lastHeartbeat: lastHeartbeatRef.current ? new Date(lastHeartbeatRef.current) : null,
        timeSinceHeartbeat,
        reconnectAttempts: reconnectAttemptsRef.current,
        isReconnecting: status === 'degraded' && reconnectAttemptsRef.current > 0
      });
    };

    checkIntervalRef.current = setInterval(checkHealth, checkIntervalMs);
    checkHealth(); // Initial check

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [isActive, checkIntervalMs, heartbeatTimeoutMs, onConnectionUnhealthy, onConnectionRecovered, webSocketRef]);

  /**
   * Call this when a successful operation occurs (e.g., chunk received)
   */
  const reportHeartbeat = useCallback(() => {
    lastHeartbeatRef.current = Date.now();
    
    // If we were unhealthy, notify recovery
    if (wasUnhealthyRef.current) {
      wasUnhealthyRef.current = false;
      onConnectionRecovered?.();
      reconnectAttemptsRef.current = 0;
      
      setState(prev => ({
        ...prev,
        status: 'connected',
        lastHeartbeat: new Date(),
        timeSinceHeartbeat: 0,
        reconnectAttempts: 0,
        isReconnecting: false
      }));
    }
  }, [onConnectionRecovered]);

  /**
   * Call this when attempting a reconnection
   */
  const reportReconnectAttempt = useCallback(() => {
    reconnectAttemptsRef.current += 1;
    console.log(`🔌 Reconnection attempt ${reconnectAttemptsRef.current}`);
    
    setState(prev => ({
      ...prev,
      reconnectAttempts: reconnectAttemptsRef.current,
      isReconnecting: true
    }));
  }, []);

  /**
   * Reset health monitoring state
   */
  const reset = useCallback(() => {
    lastHeartbeatRef.current = Date.now();
    wasUnhealthyRef.current = false;
    reconnectAttemptsRef.current = 0;
    
    setState({
      status: isActive ? 'connected' : 'inactive',
      lastHeartbeat: new Date(),
      timeSinceHeartbeat: 0,
      reconnectAttempts: 0,
      isReconnecting: false
    });
  }, [isActive]);

  return {
    ...state,
    reportHeartbeat,
    reportReconnectAttempt,
    reset
  };
}
