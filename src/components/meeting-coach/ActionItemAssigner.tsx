import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { User, Crown, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ActionItemAssignment {
  id: string;
  originalText: string;
  assignee: string | null;
  assigneeId: string | null;
  assigneeType: 'me' | 'chair' | 'attendee' | 'meeting-participant' | 'custom';
  timestamp: number;
}

export interface Attendee {
  id: string;
  name: string;
  email?: string;
  title?: string;
  organization?: string;
  role?: string;
}

interface ActionItemAssignerProps {
  actionItem: string;
  actionItemId: string;
  currentAssignment: ActionItemAssignment | null;
  currentUserName: string;
  chairName?: string;
  meetingParticipants: string[];
  availableAttendees: Attendee[];
  recentlyUsed: string[];
  onAssign: (assignment: ActionItemAssignment) => void;
  onRemove: (actionItemId: string) => void;
}

export function ActionItemAssigner({
  actionItem,
  actionItemId,
  currentAssignment,
  currentUserName,
  chairName,
  meetingParticipants,
  availableAttendees,
  recentlyUsed,
  onAssign,
  onRemove,
}: ActionItemAssignerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleAssign = (
    assignee: string,
    assigneeType: ActionItemAssignment['assigneeType'],
    assigneeId: string | null = null
  ) => {
    const assignment: ActionItemAssignment = {
      id: actionItemId,
      originalText: actionItem,
      assignee,
      assigneeId,
      assigneeType,
      timestamp: Date.now(),
    };
    onAssign(assignment);
    setOpen(false);
    setSearchQuery('');
  };

  const handleRemove = () => {
    onRemove(actionItemId);
  };

  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return null;

    const query = searchQuery.toLowerCase();
    
    // Filter meeting participants
    const matchingParticipants = meetingParticipants.filter(p => 
      p.toLowerCase().includes(query)
    );

    // Filter attendees from database
    const matchingAttendees = availableAttendees.filter(a =>
      a.name.toLowerCase().includes(query) ||
      a.role?.toLowerCase().includes(query) ||
      a.organization?.toLowerCase().includes(query)
    );

    return {
      participants: matchingParticipants.slice(0, 5),
      attendees: matchingAttendees.slice(0, 8),
    };
  }, [searchQuery, meetingParticipants, availableAttendees]);

  const displayResults = searchQuery.trim() ? filteredResults : {
    participants: meetingParticipants.slice(0, 5),
    attendees: [],
  };

  const getAssigneeIcon = () => {
    if (!currentAssignment) return null;
    switch (currentAssignment.assigneeType) {
      case 'me':
        return <User className="h-3 w-3" />;
      case 'chair':
        return <Crown className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  if (currentAssignment) {
    return (
      <div className="flex items-center gap-2 mt-1">
        <Badge 
          variant="secondary" 
          className="flex items-center gap-1 pl-1.5 pr-1 py-0.5 text-xs"
        >
          {getAssigneeIcon()}
          <span className="max-w-[120px] truncate">{currentAssignment.assignee}</span>
          <button
            onClick={handleRemove}
            className="ml-1 hover:bg-muted rounded-sm p-0.5 transition-colors"
            aria-label="Remove assignment"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Change
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <Command>
              <CommandInput 
                placeholder="Search attendees..." 
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                <CommandEmpty>No attendees found.</CommandEmpty>
                
                <CommandGroup heading="Quick Picks">
                  <CommandItem
                    onSelect={() => handleAssign(currentUserName, 'me')}
                    className="flex items-center gap-2"
                  >
                    <User className="h-4 w-4" />
                    <span>ME - {currentUserName}</span>
                  </CommandItem>
                  {chairName && (
                    <CommandItem
                      onSelect={() => handleAssign(chairName, 'chair')}
                      className="flex items-center gap-2"
                    >
                      <Crown className="h-4 w-4" />
                      <span>Chair - {chairName}</span>
                    </CommandItem>
                  )}
                  {recentlyUsed.filter(name => name !== currentUserName && name !== chairName).slice(0, 3).map((name) => (
                    <CommandItem
                      key={name}
                      onSelect={() => handleAssign(name, 'custom')}
                      className="flex items-center gap-2"
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>

                {displayResults && displayResults.participants.length > 0 && (
                  <CommandGroup heading="From this meeting">
                    {displayResults.participants.map((participant) => (
                      <CommandItem
                        key={participant}
                        onSelect={() => handleAssign(participant, 'meeting-participant')}
                      >
                        {participant}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {displayResults && displayResults.attendees.length > 0 && (
                  <CommandGroup heading="Other attendees">
                    {displayResults.attendees.map((attendee) => (
                      <CommandItem
                        key={attendee.id}
                        onSelect={() => handleAssign(attendee.name, 'attendee', attendee.id)}
                      >
                        <div className="flex flex-col">
                          <span>{attendee.name}</span>
                          {(attendee.role || attendee.organization) && (
                            <span className="text-xs text-muted-foreground">
                              {[attendee.role, attendee.organization].filter(Boolean).join(', ')}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 mt-1 px-2 text-xs"
        >
          Assign to
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search attendees..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>No attendees found.</CommandEmpty>
            
            <CommandGroup heading="Quick Picks">
              <CommandItem
                onSelect={() => handleAssign(currentUserName, 'me')}
                className="flex items-center gap-2"
              >
                <User className="h-4 w-4" />
                <span>ME - {currentUserName}</span>
              </CommandItem>
              {chairName && (
                <CommandItem
                  onSelect={() => handleAssign(chairName, 'chair')}
                  className="flex items-center gap-2"
                >
                  <Crown className="h-4 w-4" />
                  <span>Chair - {chairName}</span>
                </CommandItem>
              )}
              {recentlyUsed.filter(name => name !== currentUserName && name !== chairName).slice(0, 3).map((name) => (
                <CommandItem
                  key={name}
                  onSelect={() => handleAssign(name, 'custom')}
                  className="flex items-center gap-2"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{name}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            {displayResults && displayResults.participants.length > 0 && (
              <CommandGroup heading="From this meeting">
                {displayResults.participants.map((participant) => (
                  <CommandItem
                    key={participant}
                    onSelect={() => handleAssign(participant, 'meeting-participant')}
                  >
                    {participant}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {displayResults && displayResults.attendees.length > 0 && (
              <CommandGroup heading="Other attendees">
                {displayResults.attendees.map((attendee) => (
                  <CommandItem
                    key={attendee.id}
                    onSelect={() => handleAssign(attendee.name, 'attendee', attendee.id)}
                  >
                    <div className="flex flex-col">
                      <span>{attendee.name}</span>
                      {(attendee.role || attendee.organization) && (
                        <span className="text-xs text-muted-foreground">
                          {[attendee.role, attendee.organization].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
