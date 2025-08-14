import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Clock, Trash2, Eye, X } from 'lucide-react';
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
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="w-80 border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b">
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
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {searchHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">
              No search history yet. Start a conversation to see it here.
            </p>
          ) : (
            searchHistory.map((search) => (
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
                  {search.brief_overview && (
                    <div className="text-xs text-muted-foreground line-clamp-2 w-full">
                      {search.brief_overview}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {formatDate(search.created_at)}
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