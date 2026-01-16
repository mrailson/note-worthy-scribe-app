import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, FolderOpen, File, Download, Play, RefreshCw, Search, ChevronDown, ChevronRight, HardDrive, Clock, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  updated_at: string;
  metadata: {
    size: number;
    mimetype: string;
  } | null;
}

interface MeetingBackupGroup {
  meetingId: string;
  userId: string;
  files: StorageFile[];
  totalSize: number;
  oldestFile: string;
  newestFile: string;
}

export const StorageBackupBrowser = () => {
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [groupedBackups, setGroupedBackups] = useState<MeetingBackupGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMeetings, setExpandedMeetings] = useState<Set<string>>(new Set());
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalSize: 0,
    totalMeetings: 0,
    orphanedFiles: 0
  });

  useEffect(() => {
    fetchStorageFiles();
  }, []);

  const fetchStorageFiles = async () => {
    setLoading(true);
    try {
      // List all files in the meeting-audio-backups bucket
      const { data: folders, error: folderError } = await supabase.storage
        .from('meeting-audio-backups')
        .list('', { limit: 1000 });

      if (folderError) throw folderError;

      const allFiles: StorageFile[] = [];

      // For each user folder, list the files
      for (const folder of folders || []) {
        if (folder.id === null) continue; // Skip if it's just a placeholder

        const { data: userFiles, error: filesError } = await supabase.storage
          .from('meeting-audio-backups')
          .list(folder.name, { limit: 1000 });

        if (filesError) {
          console.error(`Error listing files in ${folder.name}:`, filesError);
          continue;
        }

        for (const file of userFiles || []) {
          if (file.id) {
            allFiles.push({
              ...file,
              name: `${folder.name}/${file.name}`,
              metadata: file.metadata as { size: number; mimetype: string } | null
            });
          }
        }
      }

      setFiles(allFiles);
      groupFilesByMeeting(allFiles);
      calculateStats(allFiles);

    } catch (error) {
      console.error('Error fetching storage files:', error);
      toast.error('Failed to load storage files');
    } finally {
      setLoading(false);
    }
  };

  const groupFilesByMeeting = (files: StorageFile[]) => {
    const groups = new Map<string, MeetingBackupGroup>();

    for (const file of files) {
      // Parse filename: userId/meetingId_chunkNumber_timestamp.webm or userId/meetingId_backup.webm
      const parts = file.name.split('/');
      if (parts.length < 2) continue;

      const userId = parts[0];
      const fileName = parts[1];
      
      // Extract meeting ID from filename
      const meetingIdMatch = fileName.match(/^([a-f0-9-]+)_/);
      if (!meetingIdMatch) continue;

      const meetingId = meetingIdMatch[1];
      const key = `${userId}/${meetingId}`;

      if (!groups.has(key)) {
        groups.set(key, {
          meetingId,
          userId,
          files: [],
          totalSize: 0,
          oldestFile: file.created_at,
          newestFile: file.created_at
        });
      }

      const group = groups.get(key)!;
      group.files.push(file);
      group.totalSize += file.metadata?.size || 0;

      if (file.created_at < group.oldestFile) {
        group.oldestFile = file.created_at;
      }
      if (file.created_at > group.newestFile) {
        group.newestFile = file.created_at;
      }
    }

    // Sort groups by newest file first
    const sortedGroups = Array.from(groups.values()).sort(
      (a, b) => new Date(b.newestFile).getTime() - new Date(a.newestFile).getTime()
    );

    setGroupedBackups(sortedGroups);
  };

  const calculateStats = (files: StorageFile[]) => {
    const meetingIds = new Set<string>();
    let totalSize = 0;

    for (const file of files) {
      totalSize += file.metadata?.size || 0;
      const meetingIdMatch = file.name.match(/([a-f0-9-]+)_/);
      if (meetingIdMatch) {
        meetingIds.add(meetingIdMatch[1]);
      }
    }

    setStats({
      totalFiles: files.length,
      totalSize,
      totalMeetings: meetingIds.size,
      orphanedFiles: 0 // TODO: Check against meetings table
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const downloadFile = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('meeting-audio-backups')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filePath.split('/').pop() || 'audio_backup.webm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('File downloaded');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  const playFile = async (filePath: string) => {
    try {
      // Stop current audio if playing
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }

      if (playingAudio === filePath) {
        setPlayingAudio(null);
        return;
      }

      const { data, error } = await supabase.storage
        .from('meeting-audio-backups')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const audio = new Audio(url);
      audio.onended = () => {
        setPlayingAudio(null);
        URL.revokeObjectURL(url);
      };
      audio.play();
      setAudioElement(audio);
      setPlayingAudio(filePath);
    } catch (error) {
      console.error('Error playing file:', error);
      toast.error('Failed to play audio');
    }
  };

  const toggleMeetingExpand = (key: string) => {
    const newExpanded = new Set(expandedMeetings);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedMeetings(newExpanded);
  };

  const filteredGroups = groupedBackups.filter(group => {
    if (!searchQuery) return true;
    return group.meetingId.toLowerCase().includes(searchQuery.toLowerCase()) ||
           group.userId.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading storage files...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{formatFileSize(stats.totalSize)}</p>
                <p className="text-xs text-muted-foreground">Total Storage Used</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <File className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.totalFiles}</p>
                <p className="text-xs text-muted-foreground">Total Audio Files</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.totalMeetings}</p>
                <p className="text-xs text-muted-foreground">Meetings with Backups</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{groupedBackups.length > 0 ? format(new Date(groupedBackups[0]?.newestFile), 'dd/MM HH:mm') : 'N/A'}</p>
                <p className="text-xs text-muted-foreground">Latest Backup</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by meeting ID or user ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={fetchStorageFiles}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Backups List */}
      {filteredGroups.length === 0 ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No audio backups found in storage. Backups are created during recording sessions.
          </AlertDescription>
        </Alert>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="space-y-2">
            {filteredGroups.map((group) => {
              const key = `${group.userId}/${group.meetingId}`;
              const isExpanded = expandedMeetings.has(key);

              return (
                <Collapsible key={key} open={isExpanded} onOpenChange={() => toggleMeetingExpand(key)}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <FolderOpen className="h-5 w-5 text-blue-500" />
                            <div>
                              <p className="font-mono text-sm">{group.meetingId}</p>
                              <p className="text-xs text-muted-foreground">User: {group.userId.substring(0, 8)}...</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge variant="secondary">{group.files.length} files</Badge>
                            <span className="text-sm text-muted-foreground">{formatFileSize(group.totalSize)}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(group.newestFile), 'dd/MM/yyyy HH:mm')}
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>File Name</TableHead>
                              <TableHead>Size</TableHead>
                              <TableHead>Created</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.files.map((file) => (
                              <TableRow key={file.id}>
                                <TableCell className="font-mono text-sm">
                                  {file.name.split('/').pop()}
                                </TableCell>
                                <TableCell>{formatFileSize(file.metadata?.size || 0)}</TableCell>
                                <TableCell>{format(new Date(file.created_at), 'dd/MM/yyyy HH:mm:ss')}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => playFile(file.name)}
                                    >
                                      <Play className={`h-4 w-4 ${playingAudio === file.name ? 'text-green-500' : ''}`} />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => downloadFile(file.name)}
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
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
