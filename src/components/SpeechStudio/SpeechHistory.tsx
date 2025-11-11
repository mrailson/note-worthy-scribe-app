import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Download, 
  Trash2, 
  Star, 
  Search, 
  Calendar,
  Volume2,
  Clock,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface SpeechHistoryItem {
  id: string;
  text_content: string;
  voice_id: string;
  audio_url: string;
  duration_seconds: number;
  character_count: number;
  audio_quality: string;
  is_favorite: boolean;
  project_name: string | null;
  created_at: string;
}

export const SpeechHistory = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'duration'>('date');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['speech-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai4pm_speech_history' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as SpeechHistoryItem[];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const item = history.find(h => h.id === id);
      if (!item) throw new Error('Item not found');

      // Extract filename from URL
      const url = new URL(item.audio_url);
      const pathParts = url.pathname.split('/');
      const filename = pathParts.slice(-2).join('/'); // user_id/uuid.mp3

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('ai4pm-speech')
        .remove([filename]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('ai4pm_speech_history' as any)
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speech-history'] });
      toast({
        title: 'Deleted',
        description: 'Speech recording deleted successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      const { error } = await supabase
        .from('ai4pm_speech_history' as any)
        .update({ is_favorite: isFavorite } as any)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speech-history'] });
    }
  });

  const handleDownload = (item: SpeechHistoryItem) => {
    const a = document.createElement('a');
    a.href = item.audio_url;
    a.download = `AI4PM-Speech-${format(new Date(item.created_at), 'yyyyMMdd-HHmmss')}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePlay = (url: string) => {
    const audio = new Audio(url);
    audio.play();
  };

  const filteredHistory = history
    .filter(item => 
      searchQuery === '' || 
      item.text_content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.project_name && item.project_name.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return (b.duration_seconds || 0) - (a.duration_seconds || 0);
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Speech History</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortBy(sortBy === 'date' ? 'duration' : 'date')}
            >
              {sortBy === 'date' ? <Calendar className="h-4 w-4 mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
              {sortBy === 'date' ? 'Date' : 'Duration'}
            </Button>
          </div>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by text or project..."
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          <div className="space-y-3">
            {filteredHistory.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <Volume2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">
                  {searchQuery ? 'No results found' : 'No speech history yet'}
                </p>
                <p className="text-xs mt-2">
                  {searchQuery ? 'Try a different search term' : 'Generated speech will appear here'}
                </p>
              </div>
            ) : (
              filteredHistory.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-1">
                        <p className="text-sm line-clamp-2">{item.text_content}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {item.voice_id === 'chris' ? 'Chris' : 'Alice'}
                          </Badge>
                          <span>{item.duration_seconds}s</span>
                          <span>{item.character_count} chars</span>
                          <span>{format(new Date(item.created_at), 'dd MMM yyyy HH:mm')}</span>
                          {item.project_name && (
                            <Badge variant="secondary" className="text-xs">
                              {item.project_name}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 ${item.is_favorite ? 'text-yellow-500' : ''}`}
                        onClick={() => toggleFavoriteMutation.mutate({ 
                          id: item.id, 
                          isFavorite: !item.is_favorite 
                        })}
                      >
                        <Star className={`h-4 w-4 ${item.is_favorite ? 'fill-current' : ''}`} />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePlay(item.audio_url)}
                        className="flex-1"
                      >
                        <Play className="h-3 w-3 mr-2" />
                        Play
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(item)}
                        className="flex-1"
                      >
                        <Download className="h-3 w-3 mr-2" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteMutation.mutate(item.id)}
                        disabled={deleteMutation.isPending}
                        className="text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
