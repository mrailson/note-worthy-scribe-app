import type { ProgrammePerson, ProgrammeGroup } from './nresPeopleDirectory';

export const defaultENNPeople: ProgrammePerson[] = [
  { id: "enn-1", initials: "RG", name: "Rebecca Gane", role: "Transformation Manager", organisation: "3Sixty Care Partnership", email: "Rebecca.Gane@nhft.nhs.uk", isActive: true },
  { id: "enn-2", initials: "ICB", name: "ICB Representative", role: "Commissioner", organisation: "NHS Northamptonshire ICB", email: "", isActive: true },
  { id: "enn-3", initials: "HFS", name: "Harborough Fields Surgery", role: "Practice", organisation: "Harborough Fields Surgery", email: "", isActive: true },
  { id: "enn-4", initials: "OMP", name: "Oundle Medical Practice", role: "Practice", organisation: "Oundle Medical Practice", email: "", isActive: true },
  { id: "enn-5", initials: "RMC", name: "Rushden Medical Centre", role: "Practice", organisation: "Rushden Medical Centre", email: "", isActive: true },
  { id: "enn-6", initials: "SBM", name: "Spinney Brook Medical Centre", role: "Practice", organisation: "Spinney Brook Medical Centre", email: "", isActive: true },
  { id: "enn-7", initials: "WS", name: "Woodford Surgery", role: "Practice (Branch)", organisation: "Woodford Surgery (Spinney Branch)", email: "", isActive: true },
  { id: "enn-8", initials: "TCM", name: "The Cottons Medical Centre", role: "Practice", organisation: "The Cottons Medical Centre", email: "", isActive: true },
  { id: "enn-9", initials: "PS", name: "Parklands Surgery", role: "Practice", organisation: "Parklands Surgery", email: "", isActive: true },
  { id: "enn-10", initials: "NVS", name: "Nene Valley Surgery", role: "Practice", organisation: "Nene Valley Surgery", email: "", isActive: true },
  { id: "enn-11", initials: "MRS", name: "Marshalls Road Surgery", role: "Practice", organisation: "Marshalls Road Surgery", email: "", isActive: true },
  { id: "enn-12", initials: "HF", name: "Higham Ferrers Surgery", role: "Practice", organisation: "Higham Ferrers Surgery", email: "", isActive: true },
  { id: "enn-13", initials: "TMS", name: "The Meadows Surgery", role: "Practice", organisation: "The Meadows Surgery", email: "", isActive: true },
];

export const defaultENNGroups: ProgrammeGroup[] = [
  {
    id: "enn-g1",
    name: "Programme Management",
    abbreviation: "PM",
    email: "programme.management@enn.nhs.uk",
    description: "Programme management team responsible for delivery oversight",
    memberIds: ["enn-1"],
    isActive: true,
  },
  {
    id: "enn-g2",
    name: "ENN Practices",
    abbreviation: "Practices",
    email: "practices@enn.nhs.uk",
    description: "All 10 ENN practices",
    memberIds: ["enn-3", "enn-4", "enn-5", "enn-6", "enn-7", "enn-8", "enn-9", "enn-10", "enn-11", "enn-12", "enn-13"],
    isActive: true,
  },
  {
    id: "enn-g3",
    name: "ICB & Commissioners",
    abbreviation: "ICB",
    email: "icb@enn.nhs.uk",
    description: "ICB and commissioning representatives",
    memberIds: ["enn-2"],
    isActive: true,
  },
];
