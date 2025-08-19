import React, { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Clock, Trash2, X, Search } from 'lucide-react';
import { SearchHistory, Message } from '@/types/ai4gp';

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

  const getSearchOverview = (search: SearchHistory) => {
    if (search.brief_overview) {
      return search.brief_overview;
    }
    
    // Analyze multiple messages to create a better overview
    const userMessages = search.messages.filter(msg => msg.role === 'user');
    const assistantMessages = search.messages.filter(msg => msg.role === 'assistant');
    
    if (userMessages.length === 0) {
      return 'No messages available';
    }
    
    // Try to find key topics from user messages
    const allUserContent = userMessages.map(msg => msg.content).join(' ').toLowerCase();
    
    // Look for key medical/healthcare terms and topics
    const topics = [];
    if (allUserContent.includes('patient') || allUserContent.includes('diagnosis')) topics.push('Patient Care');
    if (allUserContent.includes('prescription') || allUserContent.includes('medication')) topics.push('Medication');
    if (allUserContent.includes('referral') || allUserContent.includes('specialist')) topics.push('Referral');
    if (allUserContent.includes('letter') || allUserContent.includes('report')) topics.push('Documentation');
    if (allUserContent.includes('guideline') || allUserContent.includes('protocol')) topics.push('Guidelines');
    if (allUserContent.includes('symptom') || allUserContent.includes('condition')) topics.push('Clinical');
    
    // If we found topics, use them
    if (topics.length > 0) {
      const topicSummary = topics.slice(0, 2).join(' & ');
      const lastMessage = userMessages[userMessages.length - 1]?.content || '';
      const preview = lastMessage.length > 60 ? lastMessage.substring(0, 60) + '...' : lastMessage;
      return `${topicSummary}: ${preview}`;
    }
    
    // Fall back to showing the most recent user message for context
    const lastUserMessage = userMessages[userMessages.length - 1];
    if (lastUserMessage) {
      const content = lastUserMessage.content.trim();
      if (content.length > 80) {
        return content.substring(0, 80) + '...';
      }
      return content;
    }
    
    return 'Conversation available';
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
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(search.created_at)}
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