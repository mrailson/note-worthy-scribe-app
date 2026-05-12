/**
 * GptRealtimeWhisperProvider
 *
 * Dictate-only transcription provider that uses OpenAI's Realtime API
 * (gpt-4o-transcribe / Whisper) over WebRTC. Streams microphone audio to
 * OpenAI and emits onPartial / onFinal callbacks as transcription deltas
 * and completed events arrive.
 *
 * IMPORTANT: This provider is wired exclusively to the Dictate service.
 * It must NOT be used by the Meeting transcription pipeline.
 */
import { supabase } from '@/integrations/supabase/client';

export interface GptRealtimeWhisperCallbacks {
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'recording' | 'stopped' | 'error') => void;
}

export class GptRealtimeWhisperProvider {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private mediaStream: MediaStream | null = null;
  private partialBuffer: string = '';

  constructor(private callbacks: GptRealtimeWhisperCallbacks = {}) {}

  async start(externalStream?: MediaStream): Promise<void> {
    try {
      this.callbacks.onStatusChange?.('connecting');

      // 1. Get ephemeral session token from edge function
      const { data, error } = await supabase.functions.invoke('gpt-realtime-whisper-token', {
        body: {},
      });
      if (error) throw new Error(error.message || 'Failed to get realtime token');
      const ephemeralKey: string | undefined = data?.client_secret?.value;
      if (!ephemeralKey) throw new Error('No ephemeral key returned');

      // 2. Get mic stream
      this.mediaStream =
        externalStream ??
        (await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        }));

      // 3. WebRTC peer connection
      this.pc = new RTCPeerConnection();
      this.mediaStream.getAudioTracks().forEach((track) => {
        this.pc!.addTrack(track, this.mediaStream!);
      });

      // 4. Data channel for events
      this.dc = this.pc.createDataChannel('oai-events');
      this.dc.addEventListener('open', () => {
        this.callbacks.onStatusChange?.('connected');
        // Configure session for transcription
        this.dc?.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              input_audio_transcription: { model: 'gpt-4o-transcribe' },
              turn_detection: { type: 'server_vad' },
            },
          }),
        );
        this.callbacks.onStatusChange?.('recording');
      });
      this.dc.addEventListener('message', (e) => this.handleEvent(e.data));

      // 5. SDP offer/answer
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      const sdpResponse = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
        {
          method: 'POST',
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            'Content-Type': 'application/sdp',
          },
        },
      );
      if (!sdpResponse.ok) throw new Error(`OpenAI SDP exchange failed: ${sdpResponse.status}`);
      const answerSdp = await sdpResponse.text();
      await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start GPT Realtime Whisper';
      this.callbacks.onError?.(msg);
      this.callbacks.onStatusChange?.('error');
      this.cleanup();
      throw err;
    }
  }

  private handleEvent(raw: any) {
    try {
      const evt = typeof raw === 'string' ? JSON.parse(raw) : raw;
      switch (evt.type) {
        case 'conversation.item.input_audio_transcription.delta': {
          const delta: string = evt.delta ?? '';
          this.partialBuffer += delta;
          this.callbacks.onPartial?.(this.partialBuffer);
          break;
        }
        case 'conversation.item.input_audio_transcription.completed': {
          const text: string = evt.transcript ?? this.partialBuffer;
          this.partialBuffer = '';
          if (text.trim()) this.callbacks.onFinal?.(text.trim());
          break;
        }
        case 'error': {
          const msg = evt.error?.message || 'Realtime error';
          this.callbacks.onError?.(msg);
          break;
        }
      }
    } catch {
      // ignore non-JSON messages
    }
  }

  stop(): void {
    this.cleanup();
    this.callbacks.onStatusChange?.('stopped');
  }

  private cleanup(): void {
    try {
      this.dc?.close();
    } catch {}
    try {
      this.pc?.getSenders().forEach((s) => s.track?.stop());
      this.pc?.close();
    } catch {}
    try {
      this.mediaStream?.getTracks().forEach((t) => t.stop());
    } catch {}
    this.dc = null;
    this.pc = null;
    this.mediaStream = null;
    this.partialBuffer = '';
  }
}
