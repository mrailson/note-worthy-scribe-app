import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Mic, AlertTriangle } from 'lucide-react';

interface TranscriptionResult {
  text: string;
  confidence: number;
  filtered?: boolean;
  reason?: string;
  metrics?: {
    avgNoSpeechProb: number;
    avgLogProb: number;
  };
}

interface TranscriptionTickerProps {
  latestTranscription?: TranscriptionResult;
  isRecording: boolean;
}

export const TranscriptionTicker: React.FC<TranscriptionTickerProps> = ({
  latestTranscription,
  isRecording
}) => {
  const [displayText, setDisplayText] = useState('');
  const [tickerClass, setTickerClass] = useState('');

  useEffect(() => {
    if (latestTranscription) {
      if (latestTranscription.filtered) {
        setDisplayText(`[FILTERED: ${latestTranscription.reason || 'Unknown'}]`);
        setTickerClass('text-muted-foreground');
      } else if (latestTranscription.text) {
        setDisplayText(latestTranscription.text);
        setTickerClass('text-foreground');
      } else {
        setDisplayText('[No speech detected]');
        setTickerClass('text-muted-foreground');
      }
    } else if (isRecording) {
      setDisplayText('Listening...');
      setTickerClass('text-muted-foreground animate-pulse');
    } else {
      setDisplayText('Click record to start transcription');
      setTickerClass('text-muted-foreground');
    }
  }, [latestTranscription, isRecording]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getQualityIndicator = () => {
    if (!latestTranscription) return null;

    if (latestTranscription.filtered) {
      return (
        <Badge variant="destructive" className="ml-2 text-xs">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Filtered
        </Badge>
      );
    }

    if (latestTranscription.confidence !== undefined) {
      const confidencePercent = Math.round(latestTranscription.confidence * 100);
      return (
        <Badge variant="outline" className="ml-2 text-xs">
          <div className={`w-2 h-2 rounded-full mr-1 ${getConfidenceColor(latestTranscription.confidence)}`} />
          {confidencePercent}%
        </Badge>
      );
    }

    return null;
  };

  const getMetricsDisplay = () => {
    if (!latestTranscription?.metrics) return null;

    const { avgNoSpeechProb, avgLogProb } = latestTranscription.metrics;
    
    return (
      <div className="text-xs text-muted-foreground ml-2 flex gap-2">
        <span>Speech: {Math.round((1 - avgNoSpeechProb) * 100)}%</span>
        <span>Quality: {Math.round(Math.max(0, (1 + avgLogProb / 2)) * 100)}%</span>
      </div>
    );
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg z-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center flex-1 min-w-0">
          {isRecording && (
            <Mic className="w-4 h-4 text-red-500 mr-2 animate-pulse" />
          )}
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-medium truncate ${tickerClass}`}>
              {displayText}
            </div>
            {latestTranscription && !latestTranscription.filtered && latestTranscription.text && (
              <div className="text-xs text-muted-foreground mt-1">
                Last captured: {new Date().toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center ml-4">
          {getQualityIndicator()}
          {getMetricsDisplay()}
        </div>
      </div>
      
      {/* Progress bar for confidence */}
      {latestTranscription && !latestTranscription.filtered && latestTranscription.confidence !== undefined && (
        <div className="mt-2">
          <div className="w-full bg-muted rounded-full h-1">
            <div 
              className={`h-1 rounded-full transition-all duration-300 ${getConfidenceColor(latestTranscription.confidence)}`}
              style={{ width: `${latestTranscription.confidence * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};