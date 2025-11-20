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
  dueDate: string | null;
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
  onUpdateDueDate: (actionItemId: string, dueDate: string) => void;
  onRemoveAction: (actionItemId: string) => void;
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
  onUpdateDueDate,
  onRemoveAction,
}: ActionItemAssignerProps) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const dueDateOptions = [
    'TBC',
    'End of Week',
    'End of Month',
    'By Next Meeting',
    'ASAP'
  ];

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
      dueDate: currentAssignment?.dueDate || null,
      timestamp: Date.now(),
    };
    onAssign(assignment);
    setAssignOpen(false);
    setSearchQuery('');
  };

  const handleDueDateSelect = (dueDate: string) => {
    onUpdateDueDate(actionItemId, dueDate);
    setDueDateOpen(false);
  };

  const handleRemove = () => {
    onRemove(actionItemId);
  };

  const handleRemoveAction = () => {
    onRemoveAction(actionItemId);
    setAssignOpen(false);
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
      <div className="flex items-center gap-1.5 mt-1 text-xs">
        <Popover open={assignOpen} onOpenChange={setAssignOpen}>
          <PopoverTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground underline decoration-dotted hover:decoration-solid transition-all">
              {currentAssignment.assignee}
            </button>
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

                <CommandGroup>
                  <CommandItem
                    onSelect={handleRemoveAction}
                    className="text-destructive"
                  >
                    Remove Action
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <span className="text-muted-foreground">|</span>
        <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
          <PopoverTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground underline decoration-dotted hover:decoration-solid transition-all">
              {currentAssignment.dueDate || 'Set due date'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="start">
            <Command>
              <CommandList>
                <CommandGroup>
                  {dueDateOptions.map((option) => (
                    <CommandItem
                      key={option}
                      onSelect={() => handleDueDateSelect(option)}
                    >
                      {option}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <button
          onClick={handleRemove}
          className="text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Remove assignment"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 mt-1 text-xs">
      <Popover open={assignOpen} onOpenChange={setAssignOpen}>
        <PopoverTrigger asChild>
          <button className="text-muted-foreground hover:text-foreground underline decoration-dotted hover:decoration-solid transition-all">
            Assign to
          </button>
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

            <CommandGroup>
              <CommandItem
                onSelect={handleRemoveAction}
                className="text-destructive"
              >
                Remove Action
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    <span className="text-muted-foreground">|</span>
    <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
      <PopoverTrigger asChild>
        <button className="text-muted-foreground hover:text-foreground underline decoration-dotted hover:decoration-solid transition-all">
          Action by
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {dueDateOptions.map((option) => (
                <CommandItem
                  key={option}
                  onSelect={() => {
                    // Create assignment if it doesn't exist
                    if (!currentAssignment) {
                      const newAssignment: ActionItemAssignment = {
                        id: actionItemId,
                        originalText: actionItem,
                        assignee: null,
                        assigneeId: null,
                        assigneeType: 'custom',
                        dueDate: option,
                        timestamp: Date.now(),
                      };
                      onAssign(newAssignment);
                    } else {
                      handleDueDateSelect(option);
                    }
                    setDueDateOpen(false);
                  }}
                >
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>
  );
}
