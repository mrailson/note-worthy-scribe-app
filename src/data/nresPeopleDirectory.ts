export interface ProgrammePerson {
  id: string;
  initials: string;
  name: string;
  role: string;
  organisation: string;
  isActive: boolean;
}

export const defaultPeople: ProgrammePerson[] = [
  { id: "1", initials: "MJG", name: "Maureen Green", role: "Programme Director", organisation: "PML", isActive: true },
  { id: "2", initials: "MR", name: "Malcolm Railson", role: "Digital & Estates Lead", organisation: "NRES", isActive: true },
  { id: "3", initials: "AT", name: "Amanda Taylor", role: "Managerial Lead", organisation: "NRES", isActive: true },
  { id: "4", initials: "LH", name: "Lucy Hibberd", role: "Supporting Managerial Lead", organisation: "NRES - Bugbrooke", isActive: true },
  { id: "5", initials: "AW", name: "Alex Whitehead", role: "Supporting Digital & Estates Lead", organisation: "NRES - The Parks", isActive: true },
  { id: "6", initials: "DMG", name: "Dr Mark Gray", role: "SRO / Chair", organisation: "PML", isActive: true },
  { id: "7", initials: "DSE", name: "Dr Simon Ellis", role: "Clinical Lead", organisation: "Towcester Medical Centre", isActive: true },
  { id: "8", initials: "DMC", name: "Dr Muhammed Chisti", role: "Supporting Clinical Lead", organisation: "The Parks", isActive: true },
];

export const getPersonByInitials = (people: ProgrammePerson[], initials: string): ProgrammePerson | undefined =>
  people.find((p) => p.initials === initials);

export const getPersonByNameOrInitials = (people: ProgrammePerson[], value: string): ProgrammePerson | undefined =>
  people.find((p) => p.initials === value || p.name === value);

export const getPersonLabel = (person: ProgrammePerson): string =>
  `${person.initials} - ${person.name}`;
