import React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNRESPeople } from "@/contexts/NRESPeopleContext";
import { getPersonByNameOrInitials, getPersonLabel, getGroupByAbbreviation, getGroupLabel, parseGroupValue, toGroupValue } from "@/data/nresPeopleDirectory";

interface PersonSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const PersonSelect: React.FC<PersonSelectProps> = ({ value, onChange, placeholder = "Select person" }) => {
  const { people, groups } = useNRESPeople();
  const activePeople = people.filter((p) => p.isActive);
  const activeGroups = groups.filter((g) => g.isActive);

  // Resolve current value
  const groupAbbr = parseGroupValue(value);
  let resolvedValue = value || "";
  if (groupAbbr) {
    const group = getGroupByAbbreviation(groups, groupAbbr);
    resolvedValue = group ? toGroupValue(group.abbreviation) : value;
  } else {
    const matched = getPersonByNameOrInitials(people, value);
    resolvedValue = matched?.initials || value || "";
  }

  return (
    <Select value={resolvedValue} onValueChange={onChange}>
      <SelectTrigger className="bg-white">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel className="text-xs font-semibold text-muted-foreground">Individuals</SelectLabel>
          {activePeople.map((person) => (
            <SelectItem key={person.id} value={person.initials}>
              {getPersonLabel(person)}
            </SelectItem>
          ))}
        </SelectGroup>
        {activeGroups.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs font-semibold text-muted-foreground">Groups</SelectLabel>
            {activeGroups.map((group) => (
              <SelectItem key={group.id} value={toGroupValue(group.abbreviation)}>
                {getGroupLabel(group)}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
};
