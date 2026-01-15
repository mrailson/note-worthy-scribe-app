import { useEffect, useRef, useState } from "react";

interface AudioWaveformProps {
  deviceId?: string;
  isActive: boolean;
  barCount?: number;
  className?: string;
}

export const AudioWaveform = ({ 
  deviceId, 
  isActive, 
  barCount = 5,
  className = "" 
}: AudioWaveformProps) => {
  const [levels, setLevels] = useState<number[]>(Array(barCount).fill(0));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!isActive) {
      // Reset levels when not active
      setLevels(Array(barCount).fill(0));
      return;
    }

    const setupAudio = async () => {
      try {
        // Get audio stream
        const constraints: MediaStreamConstraints = {
          audio: deviceId 
            ? { deviceId: { exact: deviceId } }
            : true
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        // Create audio context and analyser
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 32;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        // Animation loop
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const updateLevels = () => {
          if (!analyserRef.current) return;
          
          analyserRef.current.getByteFrequencyData(dataArray);
          
          // Map frequency data to bar levels
          const newLevels: number[] = [];
          const step = Math.floor(dataArray.length / barCount);
          
          for (let i = 0; i < barCount; i++) {
            const value = dataArray[i * step] || 0;
            // Normalize to 0-1 range with some amplification
            newLevels.push(Math.min(1, (value / 255) * 1.5));
          }
          
          setLevels(newLevels);
          animationRef.current = requestAnimationFrame(updateLevels);
        };

        updateLevels();
      } catch (error) {
        console.error('Failed to setup audio waveform:', error);
      }
    };

    setupAudio();

    return () => {
      // Cleanup
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [deviceId, isActive, barCount]);

  return (
    <div className={`flex items-center justify-center gap-1 h-8 ${className}`}>
      {levels.map((level, index) => (
        <div
          key={index}
          className="w-1 bg-green-500 rounded-full transition-all duration-75"
          style={{
            height: `${Math.max(4, level * 28)}px`,
            opacity: level > 0.05 ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
};
