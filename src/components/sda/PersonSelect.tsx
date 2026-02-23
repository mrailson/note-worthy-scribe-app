import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNRESPeople } from "@/contexts/NRESPeopleContext";
import { getPersonByNameOrInitials, getPersonLabel } from "@/data/nresPeopleDirectory";

interface PersonSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const PersonSelect: React.FC<PersonSelectProps> = ({ value, onChange, placeholder = "Select person" }) => {
  const { people } = useNRESPeople();
  const activePeople = people.filter((p) => p.isActive);

  // Resolve current value to initials for the select
  const matched = getPersonByNameOrInitials(people, value);
  const resolvedValue = matched?.initials || value || "";

  return (
    <Select value={resolvedValue} onValueChange={onChange}>
      <SelectTrigger className="bg-white">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {activePeople.map((person) => (
          <SelectItem key={person.id} value={person.initials}>
            {getPersonLabel(person)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
