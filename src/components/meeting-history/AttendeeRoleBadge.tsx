import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Crown, Star, User, Check } from 'lucide-react';
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
    if (updating) return;
    setUpdating(true);
    console.log('⬆️ Updating attendee role', { meetingId, attendeeId: attendee.id, newRole });
    try {
      const { error } = await supabase
        .from('meeting_attendees')
        .update({ meeting_role: newRole })
        .eq('meeting_id', meetingId)
        .eq('attendee_id', attendee.id);

      if (error) throw error;

      toast.success(`Role set to ${newRole.replace('_', ' ')}`);
      onRoleChange?.();
      console.log('✅ Role updated successfully');
    } catch (error) {
      console.error('❌ Error updating attendee role:', error);
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
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
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-56" 
        align="start" 
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Set role for {attendee.name}
        </div>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            console.log('➡️ Role option clicked', { attendee: attendee.name, newRole: 'chair' });
            updateRole('chair');
          }}
          disabled={updating}
          className="cursor-pointer"
        >
          <Crown className="h-4 w-4 mr-2" />
          Chair
          {meetingRole === 'chair' && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            console.log('➡️ Role option clicked', { attendee: attendee.name, newRole: 'key_participant' });
            updateRole('key_participant');
          }}
          disabled={updating}
          className="cursor-pointer"
        >
          <Star className="h-4 w-4 mr-2" />
          Key Participant
          {meetingRole === 'key_participant' && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            console.log('➡️ Role option clicked', { attendee: attendee.name, newRole: 'attendee' });
            updateRole('attendee');
          }}
          disabled={updating}
          className="cursor-pointer"
        >
          <User className="h-4 w-4 mr-2" />
          Attendee
          {meetingRole === 'attendee' && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
