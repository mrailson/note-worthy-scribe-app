import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Database, Trash2, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, HardDrive, FileText, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UserStorageData {
  user_id: string;
  email: string;
  full_name: string;
  ai_chats_count: number;
  ai_chats_size_bytes: number;
  transcript_chunks_count: number;
  transcript_size_bytes: number;
  meetings_count: number;
  total_size_bytes: number;
  oldest_ai_chat: string | null;
  oldest_meeting: string | null;
}

interface LargeChat {
  id: string;
  title: string;
  user_id: string;
  email: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
  is_protected: boolean;
  is_flagged: boolean;
}

interface OldChat {
  id: string;
  title: string;
  user_id: string;
  email: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
  is_protected: boolean;
}

interface UserChatDetail {
  id: string;
  title: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
  is_protected: boolean;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
};

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-GB', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

type SortField = 'email' | 'ai_chats_size_bytes' | 'transcript_size_bytes' | 'total_size_bytes' | 'ai_chats_count';
type SortDirection = 'asc' | 'desc';

export const StorageManagement: React.FC = () => {
  const [userStorage, setUserStorage] = useState<UserStorageData[]>([]);
  const [largeChats, setLargeChats] = useState<LargeChat[]>([]);
  const [oldChats, setOldChats] = useState<OldChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [largeChatsOpen, setLargeChatsOpen] = useState(true);
  const [oldChatsOpen, setOldChatsOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('total_size_bytes');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedUser, setSelectedUser] = useState<UserStorageData | null>(null);
  const [userChats, setUserChats] = useState<UserChatDetail[]>([]);
  const [loadingUserChats, setLoadingUserChats] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [userResult, largeResult, oldResult] = await Promise.all([
        supabase.rpc('get_storage_by_user'),
        supabase.rpc('get_largest_ai_chats', { limit_count: 20 }),
        supabase.rpc('get_old_ai_chats', { days_old: 90 })
      ]);

      if (userResult.data) setUserStorage(userResult.data);
      if (largeResult.data) setLargeChats(largeResult.data);
      if (oldResult.data) setOldChats(oldResult.data);
    } catch (error) {
      console.error('Error fetching storage data:', error);
      toast.error('Failed to load storage data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteChat = async (chatId: string, title: string) => {
    setDeletingId(chatId);
    try {
      const { error } = await supabase
        .from('ai_4_pm_searches')
        .delete()
        .eq('id', chatId);

      if (error) throw error;

      toast.success(`Deleted chat: ${title.substring(0, 30)}...`);
      fetchData();
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast.error('Failed to delete chat');
    } finally {
      setDeletingId(null);
    }
  };

  const fetchUserChats = async (user: UserStorageData) => {
    setSelectedUser(user);
    setLoadingUserChats(true);
    try {
      const { data, error } = await supabase
        .from('ai_4_pm_searches')
        .select('id, title, created_at, updated_at, is_protected, messages')
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate size and filter for files over 1MB
      const chatsWithSize = (data || []).map(chat => ({
        id: chat.id,
        title: chat.title,
        size_bytes: JSON.stringify(chat.messages).length,
        created_at: chat.created_at,
        updated_at: chat.updated_at,
        is_protected: chat.is_protected || false
      })).filter(chat => chat.size_bytes >= 1048576); // Only show chats over 1MB

      setUserChats(chatsWithSize);
    } catch (error) {
      console.error('Error fetching user chats:', error);
      toast.error('Failed to load user chats');
    } finally {
      setLoadingUserChats(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedUserStorage = useMemo(() => {
    return [...userStorage].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [userStorage, sortField, sortDirection]);

  const totalAIStorage = userStorage.reduce((sum, u) => sum + u.ai_chats_size_bytes, 0);
  const totalTranscriptStorage = userStorage.reduce((sum, u) => sum + u.transcript_size_bytes, 0);
  const totalStorage = totalAIStorage + totalTranscriptStorage;
  const oldChatsSize = oldChats.reduce((sum, c) => sum + c.size_bytes, 0);

  const SortableHeader: React.FC<{ field: SortField; children: React.ReactNode; className?: string }> = ({ 
    field, children, className 
  }) => (
    <TableHead 
      className={cn("cursor-pointer hover:bg-muted/50 select-none", className)}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
        )}
      </div>
    </TableHead>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Storage Management
        </h3>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Tracked</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatBytes(totalStorage)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">AI Chats</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatBytes(totalAIStorage)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Transcripts</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatBytes(totalTranscriptStorage)}</p>
          </CardContent>
        </Card>
        <Card className={oldChatsSize > 10000000 ? 'border-amber-500' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className={cn("h-4 w-4", oldChatsSize > 10000000 ? "text-amber-500" : "text-muted-foreground")} />
              <span className="text-sm text-muted-foreground">Old Chats (&gt;90d)</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatBytes(oldChatsSize)}</p>
            <p className="text-xs text-muted-foreground">{oldChats.length} items</p>
          </CardContent>
        </Card>
      </div>

      {/* Storage by User */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Storage by User</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader field="email">User</SortableHeader>
                  <SortableHeader field="ai_chats_count" className="text-right">AI Chats</SortableHeader>
                  <SortableHeader field="ai_chats_size_bytes" className="text-right">Chat Size</SortableHeader>
                  <SortableHeader field="transcript_size_bytes" className="text-right">Transcripts</SortableHeader>
                  <SortableHeader field="total_size_bytes" className="text-right">Total</SortableHeader>
                  <TableHead className="text-right">Oldest Chat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUserStorage.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">
                      <div className="truncate max-w-[200px]" title={user.email}>
                        {user.email || 'Unknown'}
                      </div>
                      {user.full_name && (
                        <div className="text-xs text-muted-foreground truncate">{user.full_name}</div>
                      )}
                    </TableCell>
                    <TableCell 
                      className="text-right cursor-pointer hover:bg-muted/50 underline text-primary"
                      onClick={() => fetchUserChats(user)}
                      title="Click to view large chats (>1MB)"
                    >
                      {user.ai_chats_count}
                    </TableCell>
                    <TableCell className="text-right">{formatBytes(user.ai_chats_size_bytes)}</TableCell>
                    <TableCell className="text-right">
                      {user.transcript_chunks_count} ({formatBytes(user.transcript_size_bytes)})
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatBytes(user.total_size_bytes)}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {formatDate(user.oldest_ai_chat)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* User Chats Modal */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              AI Chats for {selectedUser?.email || 'User'}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                (Files over 1MB only)
              </span>
            </DialogTitle>
          </DialogHeader>
          
          {loadingUserChats ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : userChats.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No chats over 1MB found for this user.
            </p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userChats.map((chat) => (
                    <TableRow key={chat.id}>
                      <TableCell>
                        <div className="truncate max-w-[250px]" title={chat.title}>
                          {chat.title}
                        </div>
                        {chat.is_protected && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded mt-1 inline-block">
                            Protected
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatBytes(chat.size_bytes)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDateTime(chat.created_at)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDateTime(chat.updated_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive hover:text-destructive"
                              disabled={chat.is_protected || deletingId === chat.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete AI Chat?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete "{chat.title.substring(0, 50)}..." 
                                ({formatBytes(chat.size_bytes)}).
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={async () => {
                                  await handleDeleteChat(chat.id, chat.title);
                                  if (selectedUser) fetchUserChats(selectedUser);
                                }}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Largest AI Chats */}
      <Collapsible open={largeChatsOpen} onOpenChange={setLargeChatsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Largest AI Chats (Top 20)</span>
                {largeChatsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Size</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {largeChats.map((chat) => (
                      <TableRow key={chat.id}>
                        <TableCell className="font-mono font-medium">
                          {formatBytes(chat.size_bytes)}
                        </TableCell>
                        <TableCell>
                          <div className="truncate max-w-[250px]" title={chat.title}>
                            {chat.title}
                          </div>
                          {(chat.is_protected || chat.is_flagged) && (
                            <div className="flex gap-1 mt-1">
                              {chat.is_protected && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Protected</span>
                              )}
                              {chat.is_flagged && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Flagged</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm truncate max-w-[150px]" title={chat.email}>
                          {chat.email || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(chat.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-destructive hover:text-destructive"
                                disabled={chat.is_protected || deletingId === chat.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete AI Chat?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete "{chat.title.substring(0, 50)}..." 
                                  ({formatBytes(chat.size_bytes)}) belonging to {chat.email}.
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteChat(chat.id, chat.title)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Old AI Chats */}
      <Collapsible open={oldChatsOpen} onOpenChange={setOldChatsOpen}>
        <Card className={oldChats.length > 0 ? 'border-amber-500/50' : ''}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  Old AI Chats (&gt;90 days) - Cleanup Candidates
                  {oldChats.length > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      {oldChats.length} items • {formatBytes(oldChatsSize)}
                    </span>
                  )}
                </span>
                {oldChatsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {oldChats.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  No old chats found. All chats are less than 90 days old.
                </p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Size</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {oldChats.slice(0, 20).map((chat) => (
                        <TableRow key={chat.id}>
                          <TableCell className="font-mono font-medium">
                            {formatBytes(chat.size_bytes)}
                          </TableCell>
                          <TableCell>
                            <div className="truncate max-w-[250px]" title={chat.title}>
                              {chat.title}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm truncate max-w-[150px]" title={chat.email}>
                            {chat.email || 'Unknown'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(chat.updated_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-destructive hover:text-destructive"
                                  disabled={deletingId === chat.id}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Old AI Chat?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete "{chat.title.substring(0, 50)}..." 
                                    ({formatBytes(chat.size_bytes)}) belonging to {chat.email}.
                                    Last updated: {formatDate(chat.updated_at)}.
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteChat(chat.id, chat.title)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
};
