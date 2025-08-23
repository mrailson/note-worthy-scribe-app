import React, { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Clock, Trash2, X, Search } from 'lucide-react';
import { SearchHistory, Message } from '@/types/ai4gp';
import { ModelSelector } from '@/components/ai4gp/ModelSelector';
import { useAIModelPreference } from '@/hooks/useAIModelPreference';

interface SearchHistorySidebarProps {
  searchHistory: SearchHistory[];
  onLoadSearch: (search: SearchHistory) => void;
  onDeleteSearch: (searchId: string) => void;
  onClearAllHistory: () => void;
  onClose: () => void;
}

export const SearchHistorySidebar: React.FC<SearchHistorySidebarProps> = ({
  searchHistory,
  onLoadSearch,
  onDeleteSearch,
  onClearAllHistory,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { selectedModel, setSelectedModel } = useAIModelPreference();

  const getSearchOverview = (search: SearchHistory) => {
    if (search.brief_overview) {
      return search.brief_overview;
    }
    
    // Skip common generic starting messages
    const skipPhrases = [
      'you are an expert uk nhs',
      'please specify the nice guideline',
      'to proceed with your request',
      'i need more information',
      'could you please provide',
      'what specific information'
    ];
    
    // Find meaningful user messages by skipping generic ones
    const meaningfulMessages = search.messages.filter(msg => {
      if (msg.role !== 'user') return false;
      const content = msg.content.toLowerCase().trim();
      return !skipPhrases.some(phrase => content.startsWith(phrase)) && content.length > 10;
    });
    
    // If we have meaningful messages, use the most descriptive one
    if (meaningfulMessages.length > 0) {
      // Try the last meaningful message first (often more specific)
      let bestMessage = meaningfulMessages[meaningfulMessages.length - 1];
      
      // Or find the longest meaningful message (likely most descriptive)
      const longestMessage = meaningfulMessages.reduce((prev, current) => 
        current.content.length > prev.content.length ? current : prev
      );
      
      if (longestMessage.content.length > bestMessage.content.length + 20) {
        bestMessage = longestMessage;
      }
      
      const content = bestMessage.content.trim();
      if (content.length > 85) {
        return content.substring(0, 85) + '...';
      }
      return content;
    }
    
    // Analyze assistant responses for context if no good user messages
    const assistantMessages = search.messages.filter(msg => msg.role === 'assistant');
    if (assistantMessages.length > 0) {
      const content = assistantMessages[0].content.toLowerCase();
      
      // Extract key topics from AI responses
      if (content.includes('referral')) return 'Referral letter assistance';
      if (content.includes('prescription') || content.includes('medication')) return 'Medication guidance';
      if (content.includes('guideline') || content.includes('nice')) return 'Clinical guidelines';
      if (content.includes('diagnosis')) return 'Diagnostic support';
      if (content.includes('patient') && content.includes('care')) return 'Patient care advice';
    }
    
    return 'General consultation';
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return searchHistory;
    
    const query = searchQuery.toLowerCase();
    return searchHistory.filter(search => 
      search.title.toLowerCase().includes(query) ||
      search.brief_overview?.toLowerCase().includes(query) ||
      search.messages.some(message => 
        message.content.toLowerCase().includes(query)
      )
    );
  }, [searchHistory, searchQuery]);

  return (
    <div className="w-80 border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium flex items-center">
            <Clock className="w-4 h-4 mr-2" />
            Search History
          </h3>
          <div className="flex items-center gap-1">
            {searchHistory.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear All History</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all your search history. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onClearAllHistory}>
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
        
        {searchHistory.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
        )}
        
        {/* AI Model Selector */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium">AI Model</p>
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {searchHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">
              No search history yet. Start a conversation to see it here.
            </p>
          ) : filteredHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">
              No conversations match your search.
            </p>
          ) : (
            filteredHistory.map((search) => (
              <div key={search.id} className="group relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-auto p-3 text-left justify-start flex-col items-start space-y-1"
                  onClick={() => onLoadSearch(search)}
                >
                  <div className="font-medium text-sm truncate w-full">
                    {search.title}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2 w-full">
                    {getSearchOverview(search)}
                  </div>
                  <div className="text-xs text-muted-foreground/80 flex items-center gap-2">
                    <span>{formatDateTime(search.created_at)}</span>
                    <span>•</span>
                    <span>{search.messages.length} message{search.messages.length !== 1 ? 's' : ''}</span>
                  </div>
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSearch(search.id);
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};