import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Settings2 } from "lucide-react";
import { useBoardMembers } from "@/hooks/useBoardMembers";
import { BoardMemberManagement } from "./BoardMemberManagement";

interface BoardMemberSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export const BoardMemberSelect = ({ value, onChange }: BoardMemberSelectProps) => {
  const [managementOpen, setManagementOpen] = useState(false);
  const { activeMembers, groupedMembers, isLoading } = useBoardMembers();

  if (isLoading) {
    return <Input placeholder="Loading..." disabled />;
  }

  if (activeMembers.length === 0) {
    return (
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter name or add members"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setManagementOpen(true)}
          title="Manage Members"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
        <BoardMemberManagement open={managementOpen} onOpenChange={setManagementOpen} />
      </div>
    );
  }

  const groups = Object.keys(groupedMembers).sort();

  return (
    <div className="flex gap-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Select responsible person" />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) => (
            <SelectGroup key={group}>
              <SelectLabel className="text-xs text-muted-foreground">{group}</SelectLabel>
              {groupedMembers[group].map((member) => (
                <SelectItem key={member.id} value={member.name}>
                  <span>{member.name}</span>
                  {member.role && (
                    <span className="text-muted-foreground ml-2 text-xs">({member.role})</span>
                  )}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setManagementOpen(true)}
        title="Manage Members"
      >
        <Settings2 className="h-4 w-4" />
      </Button>
      <BoardMemberManagement open={managementOpen} onOpenChange={setManagementOpen} />
    </div>
  );
};
