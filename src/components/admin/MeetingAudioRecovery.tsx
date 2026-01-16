import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Loader2, Search, Play, Download, RotateCcw, AlertTriangle, CheckCircle, XCircle, Combine, FileAudio } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface AudioChunk {
  name: string;
  path: string;
  size: number;
  chunkNumber: number;
  createdAt: string;
}

interface MeetingInfo {
  id: string;
  title: string;
  status: string;
  transcriptWordCount: number;
  expectedWordCount: number;
  durationSeconds: number;
  createdAt: string;
}

interface GapAnalysis {
  totalChunks: number;
  expectedChunks: number;
  missingChunks: number[];
  gapDuration: number;
  coveragePercent: number;
}

export const MeetingAudioRecovery = () => {
  const [meetingId, setMeetingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo | null>(null);
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([]);
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessProgress, setReprocessProgress] = useState(0);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const searchMeeting = async () => {
    if (!meetingId.trim()) {
      toast.error('Please enter a meeting ID');
      return;
    }

    setLoading(true);
    setMeetingInfo(null);
    setAudioChunks([]);
    setGapAnalysis(null);

    try {
      // Fetch meeting info
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('id, title, status, word_count, recording_duration, created_at, user_id')
        .eq('id', meetingId.trim())
        .single();

      if (meetingError) {
        if (meetingError.code === 'PGRST116') {
          toast.error('Meeting not found');
        } else {
          throw meetingError;
        }
        setLoading(false);
        return;
      }

      // Calculate expected word count (5000 words per hour)
      const durationSeconds = parseDuration(meeting.recording_duration);
      const expectedWords = Math.floor((durationSeconds / 3600) * 5000);

      setMeetingInfo({
        id: meeting.id,
        title: meeting.title || 'Untitled',
        status: meeting.status,
        transcriptWordCount: meeting.word_count || 0,
        expectedWordCount: expectedWords,
        durationSeconds,
        createdAt: meeting.created_at
      });

      // Search for audio files in storage
      await searchAudioFiles(meeting.id, meeting.user_id);

    } catch (error) {
      console.error('Error searching meeting:', error);
      toast.error('Failed to search meeting');
    } finally {
      setLoading(false);
    }
  };

  const searchAudioFiles = async (meetingId: string, userId?: string) => {
    try {
      // First, get list of all user folders
      const { data: folders, error: folderError } = await supabase.storage
        .from('meeting-audio-backups')
        .list('', { limit: 1000 });

      if (folderError) throw folderError;

      const chunks: AudioChunk[] = [];

      // Search through each user folder for files matching this meeting ID
      for (const folder of folders || []) {
        if (!folder.id) continue;

        const { data: files, error: filesError } = await supabase.storage
          .from('meeting-audio-backups')
          .list(folder.name, { limit: 1000 });

        if (filesError) continue;

        for (const file of files || []) {
          if (file.name.includes(meetingId)) {
            // Extract chunk number from filename
            const chunkMatch = file.name.match(/_chunk(\d+)_/);
            const chunkNumber = chunkMatch ? parseInt(chunkMatch[1], 10) : 0;

            chunks.push({
              name: file.name,
              path: `${folder.name}/${file.name}`,
              size: (file.metadata as { size?: number })?.size || 0,
              chunkNumber,
              createdAt: file.created_at
            });
          }
        }
      }

      // Sort by chunk number
      chunks.sort((a, b) => a.chunkNumber - b.chunkNumber);
      setAudioChunks(chunks);

      // Analyse gaps
      analyseGaps(chunks);

    } catch (error) {
      console.error('Error searching audio files:', error);
    }
  };

  const parseDuration = (duration: string | null): number => {
    if (!duration) return 0;
    const parts = duration.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return 0;
  };

  const analyseGaps = (chunks: AudioChunk[]) => {
    if (chunks.length === 0) {
      setGapAnalysis({
        totalChunks: 0,
        expectedChunks: 0,
        missingChunks: [],
        gapDuration: 0,
        coveragePercent: 0
      });
      return;
    }

    const chunkNumbers = chunks.map(c => c.chunkNumber);
    const maxChunk = Math.max(...chunkNumbers);
    const expectedChunks = maxChunk;
    
    const missingChunks: number[] = [];
    for (let i = 1; i <= maxChunk; i++) {
      if (!chunkNumbers.includes(i)) {
        missingChunks.push(i);
      }
    }

    // Each chunk is approximately 5 seconds
    const gapDuration = missingChunks.length * 5;
    const coveragePercent = expectedChunks > 0 
      ? Math.round(((expectedChunks - missingChunks.length) / expectedChunks) * 100) 
      : 0;

    setGapAnalysis({
      totalChunks: chunks.length,
      expectedChunks,
      missingChunks,
      gapDuration,
      coveragePercent
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const playChunk = async (path: string) => {
    try {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }

      if (playingAudio === path) {
        setPlayingAudio(null);
        return;
      }

      const { data, error } = await supabase.storage
        .from('meeting-audio-backups')
        .download(path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const audio = new Audio(url);
      audio.onended = () => {
        setPlayingAudio(null);
        URL.revokeObjectURL(url);
      };
      audio.play();
      setAudioElement(audio);
      setPlayingAudio(path);
    } catch (error) {
      console.error('Error playing chunk:', error);
      toast.error('Failed to play audio');
    }
  };

  const downloadChunk = async (path: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('meeting-audio-backups')
        .download(path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading chunk:', error);
      toast.error('Failed to download');
    }
  };

  const reprocessMeeting = async () => {
    if (!meetingInfo || audioChunks.length === 0) {
      toast.error('No audio chunks to reprocess');
      return;
    }

    setReprocessing(true);
    setReprocessProgress(0);

    try {
      toast.info('Starting audio reprocessing...', { duration: 5000 });

      // Call the reprocess edge function
      const { data, error } = await supabase.functions.invoke('reprocess-audio-chunks', {
        body: {
          meetingId: meetingInfo.id,
          audioFilePath: audioChunks[0]?.path // Pass first chunk as reference
        }
      });

      if (error) throw error;

      setReprocessProgress(100);
      toast.success('Audio reprocessed successfully! Refresh the meeting to see updated transcript.');

      // Refresh meeting info
      await searchMeeting();

    } catch (error) {
      console.error('Error reprocessing:', error);
      toast.error('Failed to reprocess audio');
    } finally {
      setReprocessing(false);
    }
  };

  const getQualityStatus = () => {
    if (!meetingInfo) return null;
    
    const ratio = meetingInfo.transcriptWordCount / meetingInfo.expectedWordCount;
    
    if (ratio >= 0.8) {
      return { status: 'good', label: 'Good', color: 'bg-green-500' };
    } else if (ratio >= 0.5) {
      return { status: 'fair', label: 'Fair', color: 'bg-yellow-500' };
    } else {
      return { status: 'poor', label: 'Poor', color: 'bg-red-500' };
    }
  };

  const qualityStatus = getQualityStatus();

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Meeting Audio Recovery
          </CardTitle>
          <CardDescription>
            Enter a meeting ID to find audio backups and recover missing transcription
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="meeting-id">Meeting ID</Label>
              <Input
                id="meeting-id"
                placeholder="e.g., a1b2c3d4-e5f6-7890-abcd-ef1234567890"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchMeeting()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={searchMeeting} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meeting Info */}
      {meetingInfo && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{meetingInfo.title}</CardTitle>
                <CardDescription>
                  Created: {format(new Date(meetingInfo.createdAt), 'dd/MM/yyyy HH:mm')}
                </CardDescription>
              </div>
              <Badge variant={meetingInfo.status === 'completed' ? 'default' : 'secondary'}>
                {meetingInfo.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Transcript Words</p>
                <p className="text-2xl font-bold">{meetingInfo.transcriptWordCount.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Expected Words</p>
                <p className="text-2xl font-bold">{meetingInfo.expectedWordCount.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-2xl font-bold">
                  {Math.floor(meetingInfo.durationSeconds / 60)}:{String(meetingInfo.durationSeconds % 60).padStart(2, '0')}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Quality</p>
                <div className="flex items-center gap-2">
                  {qualityStatus && (
                    <>
                      <div className={`w-3 h-3 rounded-full ${qualityStatus.color}`} />
                      <span className="text-lg font-bold">{qualityStatus.label}</span>
                      <span className="text-sm text-muted-foreground">
                        ({Math.round((meetingInfo.transcriptWordCount / meetingInfo.expectedWordCount) * 100)}%)
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gap Analysis */}
      {gapAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileAudio className="h-5 w-5" />
              Audio Chunk Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Found Chunks</p>
                <p className="text-2xl font-bold">{gapAnalysis.totalChunks}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Missing Chunks</p>
                <p className="text-2xl font-bold text-red-500">{gapAnalysis.missingChunks.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Gap Duration</p>
                <p className="text-2xl font-bold">~{gapAnalysis.gapDuration}s</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Coverage</p>
                <p className="text-2xl font-bold">{gapAnalysis.coveragePercent}%</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Audio Coverage</p>
              <Progress value={gapAnalysis.coveragePercent} className="h-3" />
            </div>

            {gapAnalysis.missingChunks.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Missing Chunks Detected</AlertTitle>
                <AlertDescription>
                  Chunks {gapAnalysis.missingChunks.slice(0, 10).join(', ')}
                  {gapAnalysis.missingChunks.length > 10 && ` and ${gapAnalysis.missingChunks.length - 10} more`} are missing.
                  This represents approximately {gapAnalysis.gapDuration} seconds of lost audio.
                </AlertDescription>
              </Alert>
            )}

            {gapAnalysis.coveragePercent >= 80 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Good Coverage</AlertTitle>
                <AlertDescription>
                  Audio coverage is good. You can attempt to reprocess the available chunks to recover the transcript.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Audio Chunks Table */}
      {audioChunks.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Audio Chunks ({audioChunks.length})</CardTitle>
              <Button 
                onClick={reprocessMeeting} 
                disabled={reprocessing}
              >
                {reprocessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Reprocessing...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reprocess All Chunks
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {reprocessing && (
              <div className="mb-4">
                <Progress value={reprocessProgress} className="h-2" />
                <p className="text-sm text-muted-foreground mt-1">Processing audio chunks...</p>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chunk #</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audioChunks.map((chunk) => (
                  <TableRow key={chunk.path}>
                    <TableCell>
                      <Badge variant="outline">{chunk.chunkNumber || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{chunk.name}</TableCell>
                    <TableCell>{formatFileSize(chunk.size)}</TableCell>
                    <TableCell>{format(new Date(chunk.createdAt), 'HH:mm:ss')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => playChunk(chunk.path)}
                        >
                          <Play className={`h-4 w-4 ${playingAudio === chunk.path ? 'text-green-500' : ''}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadChunk(chunk.path, chunk.name)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* No Chunks Found */}
      {meetingInfo && audioChunks.length === 0 && !loading && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>No Audio Backups Found</AlertTitle>
          <AlertDescription>
            No audio backup files were found for this meeting. Audio backups may not have been enabled during recording,
            or the files may have been deleted. Recovery is not possible without audio data.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
