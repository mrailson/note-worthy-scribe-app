import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Crown, Star, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AttendeeRoleBadgeProps {
  attendee: {
    id: string;
    name: string;
    title?: string;
    email?: string;
  };
  meetingId: string;
  meetingRole: 'chair' | 'key_participant' | 'attendee';
  isCurrentUser?: boolean;
  onRoleChange?: () => void;
}

export const AttendeeRoleBadge: React.FC<AttendeeRoleBadgeProps> = ({
  attendee,
  meetingId,
  meetingRole,
  isCurrentUser,
  onRoleChange
}) => {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const getRoleIcon = () => {
    switch (meetingRole) {
      case 'chair':
        return <Crown className="h-3 w-3 text-amber-500" />;
      case 'key_participant':
        return <Star className="h-3 w-3 text-blue-500" />;
      default:
        return null;
    }
  };

  const updateRole = async (newRole: 'chair' | 'key_participant' | 'attendee') => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('meeting_attendees')
        .update({ meeting_role: newRole })
        .eq('meeting_id', meetingId)
        .eq('attendee_id', attendee.id);

      if (error) throw error;

      setOpen(false);
      onRoleChange?.();
    } catch (error) {
      console.error('Error updating attendee role:', error);
      toast.error('Failed to update attendee role');
    } finally {
      setUpdating(false);
    }
  };

  const getBadgeVariant = () => {
    if (meetingRole === 'chair') return 'default';
    if (meetingRole === 'key_participant') return 'secondary';
    return 'outline';
  };

  return (
    <Popover open={open} onOpenChange={(newOpen) => {
      console.log('Popover state changing:', { from: open, to: newOpen, attendee: attendee.name });
      setOpen(newOpen);
    }}>
      <PopoverTrigger asChild>
        <Badge
          variant={getBadgeVariant()}
          className="text-xs cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
          onClick={(e) => {
            console.log('Badge clicked:', attendee.name);
            e.stopPropagation();
          }}
        >
          {getRoleIcon()}
          {attendee.title && `${attendee.title} `}
          {attendee.name}
          {isCurrentUser && ' (You)'}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 z-50" align="start" sideOffset={5} onClick={(e) => e.stopPropagation()}>
        <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Set role for {attendee.name}
          </p>
          <Button
            variant={meetingRole === 'chair' ? 'default' : 'ghost'}
            size="sm"
            className="w-full justify-start"
            onClick={(e) => {
              e.stopPropagation();
              updateRole('chair');
            }}
            disabled={updating}
          >
            <Crown className="h-4 w-4 mr-2" />
            Chair
          </Button>
          <Button
            variant={meetingRole === 'key_participant' ? 'default' : 'ghost'}
            size="sm"
            className="w-full justify-start"
            onClick={(e) => {
              e.stopPropagation();
              updateRole('key_participant');
            }}
            disabled={updating}
          >
            <Star className="h-4 w-4 mr-2" />
            Key Participant
          </Button>
          <Button
            variant={meetingRole === 'attendee' ? 'default' : 'ghost'}
            size="sm"
            className="w-full justify-start"
            onClick={(e) => {
              e.stopPropagation();
              updateRole('attendee');
            }}
            disabled={updating}
          >
            <User className="h-4 w-4 mr-2" />
            Attendee
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
