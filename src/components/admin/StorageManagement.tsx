import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database, Trash2, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, HardDrive, FileText, MessageSquare, Mic, Presentation, Calendar } from 'lucide-react';
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

interface Ai4GpSearch {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  title: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
  is_protected: boolean;
  is_flagged: boolean;
  has_audio: boolean;
  has_presentation: boolean;
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
  const [ai4gpSearches, setAi4gpSearches] = useState<Ai4GpSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [largeChatsOpen, setLargeChatsOpen] = useState(true);
  const [oldChatsOpen, setOldChatsOpen] = useState(false);
  const [ai4gpSearchesOpen, setAi4gpSearchesOpen] = useState(true);
  const [ai4gpSizeFilter, setAi4gpSizeFilter] = useState<string>('1');
  const [sortField, setSortField] = useState<SortField>('total_size_bytes');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedUser, setSelectedUser] = useState<UserStorageData | null>(null);
  const [userChats, setUserChats] = useState<UserChatDetail[]>([]);
  const [loadingUserChats, setLoadingUserChats] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isDeletingAllAi4gp, setIsDeletingAllAi4gp] = useState(false);
  const [clearingUserOldChats, setClearingUserOldChats] = useState<string | null>(null);
  const [isPurgingOldChats, setIsPurgingOldChats] = useState(false);
  const [purgePreview, setPurgePreview] = useState<{ wouldDelete: number; affectedUsers: number } | null>(null);
  const [showPurgeDialog, setShowPurgeDialog] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [userResult, largeResult, oldResult, ai4gpResult] = await Promise.all([
        supabase.rpc('get_storage_by_user'),
        supabase.rpc('get_largest_ai_chats', { limit_count: 20 }),
        supabase.rpc('get_old_ai_chats', { days_old: 90 }),
        supabase.rpc('get_large_ai4gp_searches', { min_size_mb: parseFloat(ai4gpSizeFilter) })
      ]);

      if (userResult.data) setUserStorage(userResult.data);
      if (largeResult.data) setLargeChats(largeResult.data);
      if (oldResult.data) setOldChats(oldResult.data);
      if (ai4gpResult.data) setAi4gpSearches(ai4gpResult.data);
    } catch (error) {
      console.error('Error fetching storage data:', error);
      toast.error('Failed to load storage data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAi4gpSearches = async (minSizeMb: string) => {
    try {
      const { data, error } = await supabase.rpc('get_large_ai4gp_searches', { min_size_mb: parseFloat(minSizeMb) });
      if (error) throw error;
      if (data) setAi4gpSearches(data);
    } catch (error) {
      console.error('Error fetching AI4GP searches:', error);
      toast.error('Failed to load AI4GP searches');
    }
  };

  const handleAi4gpSizeFilterChange = (value: string) => {
    setAi4gpSizeFilter(value);
    fetchAi4gpSearches(value);
  };

  const handleDeleteAllLargeAi4gpSearches = async () => {
    const unprotectedSearches = ai4gpSearches.filter(s => !s.is_protected);
    if (unprotectedSearches.length === 0) {
      toast.error('No unprotected searches to delete');
      return;
    }
    
    setIsDeletingAllAi4gp(true);
    try {
      const ids = unprotectedSearches.map(s => s.id);
      const { error } = await supabase
        .from('ai_4_pm_searches')
        .delete()
        .in('id', ids);

      if (error) throw error;

      const totalSize = unprotectedSearches.reduce((sum, s) => sum + s.size_bytes, 0);
      toast.success(`Deleted ${unprotectedSearches.length} large AI4GP searches (${formatBytes(totalSize)} freed)`);
      fetchData();
    } catch (error) {
      console.error('Error deleting AI4GP searches:', error);
      toast.error('Failed to delete AI4GP searches');
    } finally {
      setIsDeletingAllAi4gp(false);
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

  const handleDeleteAllOldChats = async () => {
    setIsDeletingAll(true);
    try {
      const chatIds = oldChats.map(c => c.id);
      const { error } = await supabase
        .from('ai_4_pm_searches')
        .delete()
        .in('id', chatIds);

      if (error) throw error;

      toast.success(`Deleted ${oldChats.length} old chats (${formatBytes(oldChatsSize)} freed)`);
      fetchData();
    } catch (error) {
      console.error('Error deleting old chats:', error);
      toast.error('Failed to delete old chats');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handlePurgePreview = async () => {
    setIsPurgingOldChats(true);
    try {
      const { data, error } = await supabase.functions.invoke('purge-old-ai-chats', {
        body: { dryRun: true, daysOld: 30 }
      });

      if (error) throw error;

      if (data.success) {
        setPurgePreview({
          wouldDelete: data.wouldDelete || 0,
          affectedUsers: data.affectedUsers || 0
        });
        setShowPurgeDialog(true);
      }
    } catch (error) {
      console.error('Error checking purge preview:', error);
      toast.error('Failed to check purgeable chats');
    } finally {
      setIsPurgingOldChats(false);
    }
  };

  const handlePurgeOldChats = async () => {
    setIsPurgingOldChats(true);
    try {
      const { data, error } = await supabase.functions.invoke('purge-old-ai-chats', {
        body: { daysOld: 30 }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message || `Deleted ${data.deletedCount} old AI chats`);
        setShowPurgeDialog(false);
        setPurgePreview(null);
        fetchData();
      } else {
        throw new Error(data.error || 'Purge failed');
      }
    } catch (error: any) {
      console.error('Error purging old chats:', error);
      toast.error(error.message || 'Failed to purge old chats');
    } finally {
      setIsPurgingOldChats(false);
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
      const allChats = (data || []).map(chat => ({
        id: chat.id,
        title: chat.title,
        size_bytes: typeof chat.messages === 'string' 
          ? chat.messages.length 
          : JSON.stringify(chat.messages || {}).length,
        created_at: chat.created_at,
        updated_at: chat.updated_at,
        is_protected: chat.is_protected || false
      }));
      
      // Filter for files over 1MB and sort by size descending
      const largeChats = allChats
        .filter(chat => chat.size_bytes >= 1048576)
        .sort((a, b) => b.size_bytes - a.size_bytes);
      
      console.log('User chats analysis:', {
        email: user.email,
        totalChats: allChats.length,
        largeChats: largeChats.length,
        allSizes: allChats.map(c => ({ title: c.title.substring(0, 30), size: c.size_bytes }))
      });

      setUserChats(largeChats);
    } catch (error) {
      console.error('Error fetching user chats:', error);
      toast.error('Failed to load user chats');
    } finally {
      setLoadingUserChats(false);
    }
  };

  const handleClearUserOldChats = async (user: UserStorageData) => {
    setClearingUserOldChats(user.user_id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await fetch(
        `https://dphcnbricafkbtizkoal.supabase.co/functions/v1/admin-clear-old-chats`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({
            userId: user.user_id,
            daysOld: 7
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to clear old chats');
      }

      if (result.deletedCount === 0) {
        toast.info(`No unprotected chats older than 7 days for ${user.email}`);
      } else {
        toast.success(`Deleted ${result.deletedCount} old chats for ${user.email}`);
        fetchData();
      }
    } catch (error) {
      console.error('Error clearing user old chats:', error);
      toast.error('Failed to clear old chats');
    } finally {
      setClearingUserOldChats(null);
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
  const ai4gpSearchesSize = ai4gpSearches.reduce((sum, s) => sum + s.size_bytes, 0);
  const unprotectedAi4gpCount = ai4gpSearches.filter(s => !s.is_protected).length;

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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Storage Management
        </h3>
        <div className="flex items-center gap-2">
          <AlertDialog open={showPurgeDialog} onOpenChange={setShowPurgeDialog}>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handlePurgePreview}
                disabled={isPurgingOldChats}
              >
                <Calendar className={cn("h-4 w-4 mr-2", isPurgingOldChats && "animate-spin")} />
                Purge &gt;30d Chats
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Purge Old AI Chats</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2">
                    <p>This will permanently delete all unprotected AI chat history older than 30 days across all users.</p>
                    {purgePreview && (
                      <div className="bg-muted p-3 rounded-md mt-2">
                        <p className="font-medium">Preview:</p>
                        <p>• {purgePreview.wouldDelete} chats will be deleted</p>
                        <p>• {purgePreview.affectedUsers} users affected</p>
                      </div>
                    )}
                    <p className="text-amber-600 font-medium">Protected (Super Saved) chats will NOT be deleted.</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handlePurgeOldChats}
                  disabled={isPurgingOldChats || !purgePreview || purgePreview.wouldDelete === 0}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isPurgingOldChats ? 'Purging...' : `Delete ${purgePreview?.wouldDelete || 0} Chats`}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
        <Card className={ai4gpSearchesSize > 50000000 ? 'border-destructive' : ai4gpSearchesSize > 20000000 ? 'border-amber-500' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Mic className={cn("h-4 w-4", ai4gpSearchesSize > 50000000 ? "text-destructive" : ai4gpSearchesSize > 20000000 ? "text-amber-500" : "text-purple-500")} />
              <span className="text-sm text-muted-foreground">Large AI4GP</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatBytes(ai4gpSearchesSize)}</p>
            <p className="text-xs text-muted-foreground">{ai4gpSearches.length} items (&gt;{ai4gpSizeFilter}MB)</p>
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
                  <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="text-xs text-destructive hover:underline disabled:opacity-50"
                            disabled={clearingUserOldChats === user.user_id}
                          >
                            {clearingUserOldChats === user.user_id ? 'Clearing...' : 'Clear >7d'}
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Clear old chats for {user.email}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete all unprotected AI chats older than 7 days for this user. Protected chats will not be deleted.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleClearUserOldChats(user)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete Old Chats
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

      {/* Large AI4GP Searches */}
      <Collapsible open={ai4gpSearchesOpen} onOpenChange={setAi4gpSearchesOpen}>
        <Card className={ai4gpSearchesSize > 50000000 ? 'border-destructive/50' : ai4gpSearchesSize > 20000000 ? 'border-amber-500/50' : ''}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  Large AI4GP Searches (Audio/Presentations)
                  {ai4gpSearches.length > 0 && (
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      ai4gpSearchesSize > 50000000 ? "bg-destructive/10 text-destructive" : "bg-purple-100 text-purple-700"
                    )}>
                      {ai4gpSearches.length} items • {formatBytes(ai4gpSearchesSize)}
                    </span>
                  )}
                </span>
                {ai4gpSearchesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {ai4gpSearches.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  No large AI4GP searches found above {ai4gpSizeFilter}MB threshold.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Filter and Delete All */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Show records &gt;</span>
                      <Select value={ai4gpSizeFilter} onValueChange={handleAi4gpSizeFilterChange}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 MB</SelectItem>
                          <SelectItem value="2">2 MB</SelectItem>
                          <SelectItem value="5">5 MB</SelectItem>
                          <SelectItem value="10">10 MB</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          disabled={isDeletingAllAi4gp || unprotectedAi4gpCount === 0}
                        >
                          {isDeletingAllAi4gp ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          Delete All Unprotected ({unprotectedAi4gpCount})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete All Large AI4GP Searches?</AlertDialogTitle>
                          <AlertDialogDescription className="space-y-2">
                            <p>
                              This will permanently delete <strong>{unprotectedAi4gpCount} unprotected searches</strong> totalling <strong>{formatBytes(ai4gpSearches.filter(s => !s.is_protected).reduce((sum, s) => sum + s.size_bytes, 0))}</strong>.
                            </p>
                            <p>
                              These records contain embedded audio or presentation content that consumes significant database storage.
                            </p>
                            <p className="text-destructive font-medium">
                              This action cannot be undone!
                            </p>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleDeleteAllLargeAi4gpSearches}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete All {unprotectedAi4gpCount} Searches
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  {/* Table */}
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Size</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Content</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ai4gpSearches.slice(0, 30).map((search) => (
                          <TableRow key={search.id}>
                            <TableCell className="font-mono font-medium">
                              {formatBytes(search.size_bytes)}
                            </TableCell>
                            <TableCell>
                              <div className="truncate max-w-[200px]" title={search.title}>
                                {search.title}
                              </div>
                              {(search.is_protected || search.is_flagged) && (
                                <div className="flex gap-1 mt-1">
                                  {search.is_protected && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Protected</span>
                                  )}
                                  {search.is_flagged && (
                                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Flagged</span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {search.has_audio && (
                                  <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded" title="Contains audio content">
                                    <Mic className="h-3 w-3" />
                                    Audio
                                  </span>
                                )}
                                {search.has_presentation && (
                                  <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded" title="Contains presentation content">
                                    <Presentation className="h-3 w-3" />
                                    PPT
                                  </span>
                                )}
                                {!search.has_audio && !search.has_presentation && (
                                  <span className="text-xs text-muted-foreground">Files/Images</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm truncate max-w-[120px]" title={search.email}>
                              {search.email || 'Unknown'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(search.created_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-destructive hover:text-destructive"
                                    disabled={search.is_protected || deletingId === search.id}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete AI4GP Search?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete "{search.title.substring(0, 50)}..." 
                                      ({formatBytes(search.size_bytes)}) belonging to {search.email}.
                                      {search.has_audio && ' Contains embedded audio content.'}
                                      {search.has_presentation && ' Contains embedded presentation content.'}
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteChat(search.id, search.title)}
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
                  {ai4gpSearches.length > 30 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Showing 30 of {ai4gpSearches.length} large searches. Lower the size threshold to see fewer.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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
                <div className="space-y-4">
                  {/* Delete All Button */}
                  <div className="flex justify-end">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          disabled={isDeletingAll}
                        >
                          {isDeletingAll ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          Delete All ({oldChats.length} items)
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete All Old AI Chats?</AlertDialogTitle>
                          <AlertDialogDescription className="space-y-2">
                            <p>
                              This will permanently delete <strong>{oldChats.length} old chats</strong> totalling <strong>{formatBytes(oldChatsSize)}</strong>.
                            </p>
                            <p className="text-destructive font-medium">
                              This action cannot be undone!
                            </p>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleDeleteAllOldChats}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete All {oldChats.length} Chats
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  {/* Table */}
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
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
};
