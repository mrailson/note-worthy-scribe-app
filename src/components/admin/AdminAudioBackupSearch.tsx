import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, Download, ChevronDown, Loader2, FileAudio, HardDrive, Clock, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface BackupResult {
  id: string;
  meeting_id: string;
  user_id: string;
  file_path: string;
  file_size: number;
  duration_seconds: number;
  backup_reason: string;
  created_at: string;
  meeting_title: string | null;
  user_name: string | null;
  user_email: string | null;
}

interface ChunkFile {
  source: 'backup' | 'audio_chunk';
  path: string;
  bucket: string;
  size: number;
  chunkNumber: number;
  durationMs?: number;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds: number): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function AdminAudioBackupSearch() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minSize, setMinSize] = useState('');
  const [userName, setUserName] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'size' | 'duration'>('date');
  const [results, setResults] = useState<BackupResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);
  const [meetingChunks, setMeetingChunks] = useState<Record<string, ChunkFile[]>>({});
  const [loadingChunks, setLoadingChunks] = useState<string | null>(null);
  const [downloadingMeeting, setDownloadingMeeting] = useState<string | null>(null);
  const [emailingMeeting, setEmailingMeeting] = useState<string | null>(null);

  const searchBackups = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      let query = supabase
        .from('meeting_audio_backups')
        .select(`
          id, meeting_id, user_id, file_path, file_size, duration_seconds,
          backup_reason, created_at
        `)
        .order(
          sortBy === 'size' ? 'file_size' : sortBy === 'duration' ? 'duration_seconds' : 'created_at',
          { ascending: false }
        )
        .limit(100);

      if (dateFrom) query = query.gte('created_at', new Date(dateFrom).toISOString());
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        query = query.lte('created_at', to.toISOString());
      }
      if (minSize) query = query.gte('file_size', parseInt(minSize) * 1024);

      const { data, error } = await query;
      if (error) throw error;

      // Enrich with meeting titles and user names
      const meetingIds = [...new Set((data || []).map(d => d.meeting_id).filter(Boolean))];
      const userIds = [...new Set((data || []).map(d => d.user_id).filter(Boolean))];

      const [meetingsRes, profilesRes] = await Promise.all([
        meetingIds.length > 0
          ? supabase.from('meetings').select('id, title').in('id', meetingIds)
          : { data: [] },
        userIds.length > 0
          ? supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds)
          : { data: [] },
      ]);

      const meetingMap = new Map((meetingsRes.data || []).map(m => [m.id, m.title]));
      const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));

      let enriched: BackupResult[] = (data || []).map(row => {
        const profile = profileMap.get(row.user_id);
        return {
          ...row,
          meeting_title: meetingMap.get(row.meeting_id) || null,
          user_name: profile?.full_name || null,
          user_email: profile?.email || null,
        };
      });

      // Client-side user name filter
      if (userName.trim()) {
        const term = userName.trim().toLowerCase();
        enriched = enriched.filter(r =>
          (r.user_name?.toLowerCase().includes(term)) ||
          (r.user_email?.toLowerCase().includes(term)) ||
          (r.meeting_title?.toLowerCase().includes(term))
        );
      }

      setResults(enriched);
    } catch (err: any) {
      toast.error('Search failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, minSize, userName, sortBy]);

  const loadChunksForMeeting = useCallback(async (meetingId: string, userId: string, filePath: string) => {
    if (expandedMeeting === meetingId) {
      setExpandedMeeting(null);
      return;
    }

    setExpandedMeeting(meetingId);
    if (meetingChunks[meetingId]) return;

    setLoadingChunks(meetingId);
    try {
      const chunks: ChunkFile[] = [];

      // 1. List files in meeting-audio-backups bucket under user/meeting path
      const folderPath = `${userId}/${meetingId}`;
      const { data: backupFiles } = await supabase.storage
        .from('meeting-audio-backups')
        .list(folderPath, { limit: 100, sortBy: { column: 'name', order: 'asc' } });

      if (backupFiles && backupFiles.length > 0) {
        for (let i = 0; i < backupFiles.length; i++) {
          const f = backupFiles[i];
          if (f.name && !f.id?.startsWith('.')) {
            chunks.push({
              source: 'backup',
              path: `${folderPath}/${f.name}`,
              bucket: 'meeting-audio-backups',
              size: (f.metadata as any)?.size || 0,
              chunkNumber: i,
            });
          }
        }
      }

      // 2. Check audio_chunks table for this meeting
      const { data: dbChunks } = await supabase
        .from('audio_chunks')
        .select('audio_blob_path, chunk_number, file_size, chunk_duration_ms')
        .eq('meeting_id', meetingId)
        .not('audio_blob_path', 'is', null)
        .order('chunk_number', { ascending: true });

      if (dbChunks && dbChunks.length > 0) {
        for (const ch of dbChunks) {
          // Avoid duplicates if backup files already cover these
          const alreadyListed = chunks.some(c => c.path.includes(`chunk_${String(ch.chunk_number).padStart(3, '0')}`));
          if (!alreadyListed && ch.audio_blob_path) {
            chunks.push({
              source: 'audio_chunk',
              path: ch.audio_blob_path,
              bucket: 'audio-chunks',
              size: ch.file_size || 0,
              chunkNumber: ch.chunk_number,
              durationMs: ch.chunk_duration_ms || undefined,
            });
          }
        }
      }

      // If no chunks found from storage listing, add at least the main file_path
      if (chunks.length === 0 && filePath) {
        chunks.push({
          source: 'backup',
          path: filePath,
          bucket: 'meeting-audio-backups',
          size: 0,
          chunkNumber: 0,
        });
      }

      setMeetingChunks(prev => ({ ...prev, [meetingId]: chunks }));
    } catch (err: any) {
      toast.error('Failed to list chunks: ' + (err.message || 'Unknown'));
    } finally {
      setLoadingChunks(null);
    }
  }, [expandedMeeting, meetingChunks]);

  const downloadSingleChunk = useCallback(async (chunk: ChunkFile, meetingTitle: string) => {
    try {
      const { data, error } = await supabase.storage
        .from(chunk.bucket)
        .download(chunk.path);

      if (error || !data) throw error || new Error('Download returned empty');

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      const ext = chunk.path.split('.').pop() || 'webm';
      const safeName = (meetingTitle || 'recording').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
      a.href = url;
      a.download = `${safeName}_part${chunk.chunkNumber + 1}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Download failed: ' + (err.message || 'Unknown'));
    }
  }, []);

  const downloadAllChunks = useCallback(async (meetingId: string, meetingTitle: string) => {
    const chunks = meetingChunks[meetingId];
    if (!chunks || chunks.length === 0) {
      toast.error('No chunks found to download');
      return;
    }

    setDownloadingMeeting(meetingId);
    try {
      for (let i = 0; i < chunks.length; i++) {
        toast.info(`Downloading part ${i + 1} of ${chunks.length}...`);
        await downloadSingleChunk(chunks[i], meetingTitle);
        // Small delay between downloads to avoid browser blocking
        if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 800));
      }
      toast.success(`All ${chunks.length} parts downloaded`);
    } catch (err: any) {
      toast.error('Download all failed: ' + (err.message || 'Unknown'));
    } finally {
      setDownloadingMeeting(null);
    }
  }, [meetingChunks, downloadSingleChunk]);

  const emailAllChunks = useCallback(async (meetingId: string, meetingTitle: string, result: BackupResult) => {
    const chunks = meetingChunks[meetingId];
    if (!chunks || chunks.length === 0) {
      toast.error('No chunks found to email');
      return;
    }

    setEmailingMeeting(meetingId);
    try {
      // Get admin's email
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No admin email found');

      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', user.id)
        .single();

      const adminEmail = profile?.email || user.email;

      // Download all chunks and convert to base64
      const attachments: { content: string; filename: string; type: string }[] = [];
      const MAX_RAW_PER_EMAIL = 10.9 * 1024 * 1024;

      const allChunkData: { base64: string; rawSize: number; filename: string; type: string }[] = [];

      for (let i = 0; i < chunks.length; i++) {
        toast.info(`Preparing chunk ${i + 1} of ${chunks.length}...`);
        const { data, error } = await supabase.storage
          .from(chunks[i].bucket)
          .download(chunks[i].path);

        if (error || !data) continue;

        const buf = await data.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);

        const ext = chunks[i].path.split('.').pop() || 'webm';
        const safeName = (meetingTitle || 'recording').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);

        allChunkData.push({
          base64: btoa(binary),
          rawSize: buf.byteLength,
          filename: `${safeName}_part${chunks[i].chunkNumber + 1}.${ext}`,
          type: ext === 'm4a' ? 'audio/mp4' : ext === 'ogg' ? 'audio/ogg' : 'audio/webm',
        });
      }

      // Batch into emails under 15MB
      const batches: typeof allChunkData[] = [];
      let currentBatch: typeof allChunkData = [];
      let currentSize = 0;
      for (const ch of allChunkData) {
        if (currentSize + ch.rawSize > MAX_RAW_PER_EMAIL && currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [];
          currentSize = 0;
        }
        currentBatch.push(ch);
        currentSize += ch.rawSize;
      }
      if (currentBatch.length > 0) batches.push(currentBatch);

      const title = meetingTitle || 'Recording';
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const partLabel = batches.length > 1 ? ` — Email ${i + 1} of ${batches.length}` : '';
        toast.info(`Sending email ${i + 1} of ${batches.length}...`);

        const extraAttachments = batch.map(ch => ({
          content: ch.base64,
          filename: ch.filename,
          type: ch.type,
        }));

        const htmlContent = `
          <div style="font-family:sans-serif;padding:20px;max-width:600px;margin:0 auto">
            <h2 style="color:#1565c0;margin-bottom:12px">🔧 Admin Recovery — ${title}${partLabel}</h2>
            <p style="color:#334155;font-size:14px;line-height:1.6">
              Attached ${batch.length === 1 ? 'is 1 audio file' : `are ${batch.length} audio files`}
              for meeting <strong>"${title}"</strong>.
            </p>
            <p style="color:#64748b;font-size:13px">
              User: ${result.user_name || 'Unknown'} · Recorded: ${new Date(result.created_at).toLocaleDateString('en-GB')}
              · Duration: ${formatDuration(result.duration_seconds)} · Size: ${formatBytes(result.file_size)}
            </p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0"/>
            <p style="color:#94a3b8;font-size:11px">Sent from Notewell AI Admin Recovery</p>
          </div>
        `;

        const { data, error } = await supabase.functions.invoke('send-meeting-email-resend', {
          body: {
            to_email: adminEmail,
            subject: `Admin Recovery: ${title}${partLabel}`,
            html_content: htmlContent,
            from_name: 'Notewell AI Admin',
            extra_attachments: extraAttachments,
          },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Email failed');
      }

      toast.success(batches.length > 1 ? `Audio sent across ${batches.length} emails` : 'Audio emailed successfully');
    } catch (err: any) {
      toast.error('Email failed: ' + (err.message || 'Unknown'));
    } finally {
      setEmailingMeeting(null);
    }
  }, [meetingChunks]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Audio Backup Search
        </CardTitle>
        <CardDescription>
          Search all audio backups by date, size, user or duration. Download all chunks for any meeting.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">From Date</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To Date</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Min Size (KB)</Label>
            <Input type="number" placeholder="e.g. 500" value={minSize} onChange={e => setMinSize(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">User / Title</Label>
            <Input placeholder="Name or title..." value={userName} onChange={e => setUserName(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Sort By</Label>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date (newest)</SelectItem>
                <SelectItem value="size">Size (largest)</SelectItem>
                <SelectItem value="duration">Duration (longest)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={searchBackups} disabled={loading} className="w-full sm:w-auto">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
          Search Backups
        </Button>

        {/* Results */}
        {searched && !loading && results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <FileAudio className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No backups found matching your criteria.</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{results.length} backup{results.length !== 1 ? 's' : ''} found</p>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Meeting / User</TableHead>
                    <TableHead className="w-24">Size</TableHead>
                    <TableHead className="w-24">Duration</TableHead>
                    <TableHead className="w-32">Date</TableHead>
                    <TableHead className="w-28">Reason</TableHead>
                    <TableHead className="w-20">Files</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => (
                    <Collapsible key={r.id} open={expandedMeeting === r.meeting_id} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => loadChunksForMeeting(r.meeting_id, r.user_id, r.file_path)}
                          >
                            <TableCell>
                              <div className="font-medium text-sm truncate max-w-[280px]">
                                {r.meeting_title || 'Untitled meeting'}
                              </div>
                              <div className="text-xs text-muted-foreground">{r.user_name || 'Unknown user'}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <HardDrive className="h-3 w-3 text-muted-foreground" />
                                {formatBytes(r.file_size)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                {formatDuration(r.duration_seconds)}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              <div className="text-xs text-muted-foreground">
                                {new Date(r.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={r.backup_reason === 'success_backup' ? 'default' : 'secondary'} className="text-xs">
                                {r.backup_reason?.replace(/_/g, ' ') || 'unknown'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <ChevronDown className={`h-4 w-4 transition-transform ${expandedMeeting === r.meeting_id ? 'rotate-180' : ''}`} />
                            </TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted/30 p-4">
                              {loadingChunks === r.meeting_id ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin" /> Scanning storage for all chunks...
                                </div>
                              ) : meetingChunks[r.meeting_id] ? (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium">
                                      {meetingChunks[r.meeting_id].length} file{meetingChunks[r.meeting_id].length !== 1 ? 's' : ''} found
                                    </p>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => { e.stopPropagation(); emailAllChunks(r.meeting_id, r.meeting_title || 'Recording', r); }}
                                        disabled={emailingMeeting === r.meeting_id}
                                      >
                                        {emailingMeeting === r.meeting_id
                                          ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Emailing...</>
                                          : <><Mail className="h-3 w-3 mr-1" /> Email All</>}
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={(e) => { e.stopPropagation(); downloadAllChunks(r.meeting_id, r.meeting_title || 'Recording'); }}
                                        disabled={downloadingMeeting === r.meeting_id}
                                      >
                                        {downloadingMeeting === r.meeting_id
                                          ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Downloading...</>
                                          : <><Download className="h-3 w-3 mr-1" /> Download All</>}
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    {meetingChunks[r.meeting_id].map((chunk, idx) => (
                                      <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded bg-background border text-sm">
                                        <div className="flex items-center gap-2">
                                          <FileAudio className="h-3.5 w-3.5 text-muted-foreground" />
                                          <span className="font-mono text-xs">Part {chunk.chunkNumber + 1}</span>
                                          <Badge variant="outline" className="text-xs">{chunk.source === 'backup' ? 'Backup' : 'Chunk'}</Badge>
                                          {chunk.size > 0 && <span className="text-xs text-muted-foreground">{formatBytes(chunk.size)}</span>}
                                          {chunk.durationMs && <span className="text-xs text-muted-foreground">{formatDuration(chunk.durationMs / 1000)}</span>}
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-2"
                                          onClick={(e) => { e.stopPropagation(); downloadSingleChunk(chunk, r.meeting_title || 'Recording'); }}
                                        >
                                          <Download className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
