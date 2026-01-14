import React from 'react';
import { format } from 'date-fns';
import { 
  History, 
  MessageSquare, 
  Trash2, 
  Plus,
  ChevronRight,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AIChatSession } from '@/hooks/useAIChatHistory';

interface AIChatHistoryPanelProps {
  sessions: AIChatSession[];
  currentSessionId?: string;
  isLoading?: boolean;
  onSelectSession: (session: AIChatSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewChat: () => void;
}

export function AIChatHistoryPanel({
  sessions,
  currentSessionId,
  isLoading,
  onSelectSession,
  onDeleteSession,
  onNewChat
}: AIChatHistoryPanelProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelectSession = (session: AIChatSession) => {
    onSelectSession(session);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          title="Chat history"
        >
          <History className="h-4 w-4" />
          <span className="hidden sm:inline">History</span>
          {sessions.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {sessions.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[350px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Chat History
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <Button
            onClick={() => {
              onNewChat();
              setOpen(false);
            }}
            className="w-full gap-2"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No chat history yet</p>
              <p className="text-xs mt-1">Start a conversation to see it here</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-2 pr-4">
                {sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    isActive={session.id === currentSessionId}
                    onSelect={() => handleSelectSession(session)}
                    onDelete={() => onDeleteSession(session.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SessionCard({
  session,
  isActive,
  onSelect,
  onDelete
}: {
  session: AIChatSession;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const messageCount = session.messages.length;
  const lastMessage = session.messages[session.messages.length - 1];

  return (
    <div
      className={cn(
        'group relative p-3 rounded-lg border cursor-pointer transition-all',
        'hover:bg-muted/50 hover:border-primary/30',
        isActive && 'bg-primary/5 border-primary/50'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <h4 className="font-medium text-sm truncate">
              {session.title || 'Untitled Chat'}
            </h4>
            {isActive && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Current
              </Badge>
            )}
          </div>
          
          {lastMessage && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {lastMessage.content.substring(0, 80)}
              {lastMessage.content.length > 80 ? '...' : ''}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(session.updated_at), 'd MMM yyyy, HH:mm')}
            </span>
            <span>{messageCount} message{messageCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this conversation and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
