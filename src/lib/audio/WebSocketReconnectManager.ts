/**
 * WebSocketReconnectManager
 * 
 * Single-gatekeeper reconnection logic for Notewell AI's Deepgram streaming.
 * Prevents the zombie reconnection loop problem where onerror and onclose
 * both independently trigger new reconnection chains.
 * 
 * Key principles:
 * 1. ONE reconnection attempt can be in-flight at a time (mutex)
 * 2. isStopped is checked BEFORE attempting, not after
 * 3. onerror sets a flag; only onclose triggers reconnection
 * 4. All timeouts are tracked and cleared on stop()
 * 5. After max attempts, no new loops can spawn
 */

type WebSocketFactory = () => WebSocket;
type OnConnected = (ws: WebSocket) => void;
type OnGaveUp = (attempts: number) => void;
type OnAttempt = (attempt: number, maxAttempts: number, delayMs: number) => void;

interface ReconnectManagerConfig {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterFactor?: number; // 0-1, how much randomness to add
  createWebSocket: WebSocketFactory;
  onConnected: OnConnected;
  onGaveUp?: OnGaveUp;
  onAttempt?: OnAttempt;
  onMessage?: (event: MessageEvent) => void;
  onFinalClose?: () => void; // Called when WS closes and we won't reconnect
  label?: string; // For logging, e.g. "Deepgram"
}

export class WebSocketReconnectManager {
  private config: Required<ReconnectManagerConfig>;
  private ws: WebSocket | null = null;
  private attemptCount = 0;
  private isStopped = false;
  private isReconnecting = false; // MUTEX - only one reconnect chain at a time
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private hadError = false; // Flag set by onerror, consumed by onclose
  private isExhausted = false; // True after max attempts - prevents new chains

  constructor(config: ReconnectManagerConfig) {
    this.config = {
      maxAttempts: config.maxAttempts ?? 8,
      baseDelayMs: config.baseDelayMs ?? 1000,
      maxDelayMs: config.maxDelayMs ?? 30000,
      jitterFactor: config.jitterFactor ?? 0.3,
      createWebSocket: config.createWebSocket,
      onConnected: config.onConnected,
      onGaveUp: config.onGaveUp ?? (() => {}),
      onAttempt: config.onAttempt ?? (() => {}),
      onMessage: config.onMessage ?? (() => {}),
      onFinalClose: config.onFinalClose ?? (() => {}),
      label: config.label ?? 'WebSocket',
    };
  }

  /**
   * Initial connection. Call this to start the WebSocket.
   * Resets all state - safe to call after stop().
   */
  connect(): void {
    this.isStopped = false;
    this.isExhausted = false;
    this.attemptCount = 0;
    this.isReconnecting = false;
    this.hadError = false;
    this.clearPendingTimeout();
    this.createAndBind();
  }

  /**
   * Intentional stop. Tears everything down and prevents any further
   * reconnection attempts. Safe to call multiple times.
   */
  stop(): void {
    if (this.isStopped) return;

    this.isStopped = true;
    this.isReconnecting = false;
    this.isExhausted = true;
    this.clearPendingTimeout();

    if (this.ws) {
      // Remove handlers BEFORE closing to prevent onclose from triggering reconnect
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;

      if (this.ws.readyState === WebSocket.OPEN || 
          this.ws.readyState === WebSocket.CONNECTING) {
        try {
          this.ws.close(1000, 'Intentional stop');
        } catch {
          // Ignore - already closing
        }
      }
      this.ws = null;
    }

    this.log('Stopped - all reconnection prevented');
  }

  /**
   * Send data through the WebSocket if it's open.
   * Returns true if sent, false if not connected.
   */
  send(data: string | ArrayBuffer | Blob): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(data);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /** Current WebSocket instance (may be null or in any state) */
  get socket(): WebSocket | null {
    return this.ws;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get stopped(): boolean {
    return this.isStopped;
  }

  // ── Private ──────────────────────────────────────────────

  private createAndBind(): void {
    // Guard: if stopped between scheduling and execution
    if (this.isStopped) {
      this.log('Skipping connect - stopped');
      return;
    }

    try {
      this.ws = this.config.createWebSocket();
    } catch (err) {
      this.log(`Failed to create WebSocket: ${err}`);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      if (this.isStopped) {
        // Raced with stop() - close immediately
        this.ws?.close(1000, 'Stopped during connect');
        return;
      }

      this.log('Connected');
      this.attemptCount = 0;
      this.isReconnecting = false;
      this.isExhausted = false;
      this.hadError = false;
      this.config.onConnected(this.ws!);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      if (!this.isStopped) {
        this.config.onMessage(event);
      }
    };

    /**
     * CRITICAL: onerror does NOT trigger reconnection.
     * It only sets a flag. onclose always fires after onerror,
     * and onclose is the single reconnection trigger point.
     * This prevents the fan-out problem.
     */
    this.ws.onerror = () => {
      this.hadError = true;
      // Do NOT call scheduleReconnect here - let onclose handle it
      if (this.isStopped) {
        this.log('Error during stopped state - ignoring');
      }
    };

    /**
     * SINGLE reconnection trigger point.
     * All reconnection flows through here.
     */
    this.ws.onclose = (event: CloseEvent) => {
      if (this.isStopped) {
        this.log('Closed after intentional stop - no reconnect');
        return;
      }

      const reason = this.hadError 
        ? `error + close (code ${event.code})` 
        : `close (code ${event.code})`;
      this.log(`Disconnected: ${reason}`);
      this.hadError = false;

      // Normal closure (1000) = intentional, don't reconnect
      if (event.code === 1000) {
        this.log('Normal closure - no reconnect');
        this.config.onFinalClose();
        return;
      }

      this.scheduleReconnect();
    };
  }

  /**
   * Schedule a reconnection attempt with exponential backoff + jitter.
   * 
   * MUTEX: If a reconnection is already in-flight, this is a no-op.
   * EXHAUSTED: If max attempts were reached, this is a no-op.
   * STOPPED: If stop() was called, this is a no-op.
   */
  private scheduleReconnect(): void {
    // Triple guard - this is what prevents zombie loops
    if (this.isStopped) {
      this.log('Reconnect blocked - stopped');
      return;
    }
    if (this.isExhausted) {
      this.log('Reconnect blocked - max attempts exhausted');
      return;
    }
    if (this.isReconnecting) {
      this.log('Reconnect blocked - already reconnecting');
      return;
    }

    this.isReconnecting = true; // Acquire mutex
    this.attemptCount++;

    if (this.attemptCount > this.config.maxAttempts) {
      this.isExhausted = true;
      this.isReconnecting = false;
      this.log(`Max reconnection attempts (${this.config.maxAttempts}) reached`);
      this.config.onGaveUp(this.attemptCount - 1);
      this.config.onFinalClose();
      return;
    }

    const delay = this.calculateDelay();
    this.log(`Reconnecting in ${delay}ms (attempt ${this.attemptCount}/${this.config.maxAttempts})`);
    this.config.onAttempt(this.attemptCount, this.config.maxAttempts, delay);

    // Clear any existing timeout before setting a new one
    this.clearPendingTimeout();

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      this.isReconnecting = false; // Release mutex before connect

      // Final check before actually connecting
      if (this.isStopped || this.isExhausted) {
        this.log('Reconnect cancelled - state changed during wait');
        return;
      }

      this.createAndBind();
    }, delay);
  }

  private calculateDelay(): number {
    // Exponential backoff: baseDelay * 2^(attempt-1)
    const exponential = this.config.baseDelayMs * Math.pow(2, this.attemptCount - 1);
    const capped = Math.min(exponential, this.config.maxDelayMs);

    // Add jitter: ±jitterFactor
    const jitter = 1 + (Math.random() * 2 - 1) * this.config.jitterFactor;
    return Math.round(capped * jitter);
  }

  private clearPendingTimeout(): void {
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }

  private log(message: string): void {
    const icon = message.includes('Connected') ? '✅' :
                 message.includes('Stopped') || message.includes('blocked') ? '🔌' :
                 message.includes('Reconnecting') ? '📡' :
                 message.includes('Max') || message.includes('error') ? '❌' : '🔵';
    console.log(`${icon} ${this.config.label}: ${message}`);
  }
}