export interface ProgrammePerson {
  id: string;
  initials: string;
  name: string;
  role: string;
  organisation: string;
  email?: string;
  isActive: boolean;
}

export interface ProgrammeGroup {
  id: string;
  name: string;
  abbreviation: string;
  email: string;
  description: string;
  memberIds: string[];
  isActive: boolean;
}

export const defaultPeople: ProgrammePerson[] = [
  { id: "1", initials: "MJG", name: "Maureen Green", role: "Programme Director", organisation: "PML", email: "maureen.green@pml.nhs.uk", isActive: true },
  { id: "2", initials: "MR", name: "Malcolm Railson", role: "Digital & Estates Lead", organisation: "NRES", email: "malcolm.railson@nres.nhs.uk", isActive: true },
  { id: "3", initials: "AT", name: "Amanda Taylor", role: "Managerial Lead", organisation: "NRES", email: "amanda.taylor@nres.nhs.uk", isActive: true },
  { id: "4", initials: "LH", name: "Lucy Hibberd", role: "Supporting Managerial Lead", organisation: "NRES - Bugbrooke", email: "lucy.hibberd@nres.nhs.uk", isActive: true },
  { id: "5", initials: "AW", name: "Alex Whitehead", role: "Supporting Digital & Estates Lead", organisation: "NRES - The Parks", email: "alex.whitehead@nres.nhs.uk", isActive: true },
  { id: "6", initials: "DMG", name: "Dr Mark Gray", role: "SRO / Chair", organisation: "PML", email: "mark.gray@pml.nhs.uk", isActive: true },
  { id: "7", initials: "DSE", name: "Dr Simon Ellis", role: "Clinical Lead", organisation: "Towcester Medical Centre", email: "simon.ellis@towcestermc.nhs.uk", isActive: true },
  { id: "8", initials: "DMC", name: "Dr Muhammed Chisti", role: "Supporting Clinical Lead", organisation: "The Parks", email: "muhammed.chisti@theparks.nhs.uk", isActive: true },
];

export const defaultGroups: ProgrammeGroup[] = [
  {
    id: "g1",
    name: "Programme Managers",
    abbreviation: "PMs",
    email: "programme.managers@nres.nhs.uk",
    description: "Programme management team responsible for delivery oversight",
    memberIds: ["1", "3", "4"],
    isActive: true,
  },
  {
    id: "g2",
    name: "Clinical Leads",
    abbreviation: "CLs",
    email: "clinical.leads@nres.nhs.uk",
    description: "Clinical leadership providing medical oversight and governance",
    memberIds: ["7", "8"],
    isActive: true,
  },
  {
    id: "g3",
    name: "Digital & Estates",
    abbreviation: "D&E",
    email: "digital.estates@nres.nhs.uk",
    description: "Digital transformation and estates management team",
    memberIds: ["2", "5"],
    isActive: true,
  },
];

export const getPersonByInitials = (people: ProgrammePerson[], initials: string): ProgrammePerson | undefined =>
  people.find((p) => p.initials === initials);

export const getPersonByNameOrInitials = (people: ProgrammePerson[], value: string): ProgrammePerson | undefined =>
  people.find((p) => p.initials === value || p.name === value);

export const getPersonLabel = (person: ProgrammePerson): string =>
  `${person.initials} - ${person.name}`;

export const getGroupByAbbreviation = (groups: ProgrammeGroup[], abbreviation: string): ProgrammeGroup | undefined =>
  groups.find((g) => g.abbreviation === abbreviation);

export const getGroupLabel = (group: ProgrammeGroup): string =>
  `${group.abbreviation} - ${group.name}`;

/** Extract abbreviation from a group: prefixed value */
export const parseGroupValue = (value: string): string | null =>
  value.startsWith("group:") ? value.slice(6) : null;

/** Create a group: prefixed value */
export const toGroupValue = (abbreviation: string): string =>
  `group:${abbreviation}`;
