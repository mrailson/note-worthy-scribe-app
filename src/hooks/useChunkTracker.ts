import { useState, useCallback } from 'react';

export interface ChunkStatus {
  id: string;
  timestamp: Date;
  text: string;
  confidence: number;
  wordCount: number;
  status: 'success' | 'low_confidence' | 'filtered' | 'rejected';
  reason?: string;
  speaker?: string;
  isFinal: boolean;
  mergeRejectionReason?: string;
  wasMerged?: boolean;
}

export function useChunkTracker() {
  const [chunks, setChunks] = useState<ChunkStatus[]>([]);

  const addChunk = useCallback((chunk: Omit<ChunkStatus, 'id' | 'wordCount'>) => {
    const wordCount = chunk.text.trim().split(/\s+/).filter(word => word.length > 0).length;
    
    const newChunk: ChunkStatus = {
      ...chunk,
      id: `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      wordCount,
    };

    setChunks(prev => [...prev, newChunk]);
  }, []);

  const clearChunks = useCallback(() => {
    setChunks([]);
  }, []);

  const getStats = useCallback(() => {
    const total = chunks.length;
    const successful = chunks.filter(c => c.status === 'success').length;
    const lowConfidence = chunks.filter(c => c.status === 'low_confidence').length;
    const filtered = chunks.filter(c => c.status === 'filtered').length;
    const totalWords = chunks.reduce((sum, c) => sum + c.wordCount, 0);
    const avgConfidence = chunks.length > 0 
      ? chunks.reduce((sum, c) => sum + c.confidence, 0) / chunks.length 
      : 0;

    return {
      total,
      successful,
      lowConfidence,
      filtered,
      totalWords,
      avgConfidence,
      successRate: total > 0 ? (successful / total) * 100 : 0
    };
  }, [chunks]);

  return {
    chunks,
    addChunk,
    clearChunks,
    getStats
  };
}