export interface ProgrammeTask {
  id: string;
  name: string;
  assignedTo?: string;
  progress: number; // 0-100
  startDate?: string; // DD/MM/YY format
  endDate?: string;
  notes?: string;
}

export interface ProgrammeSection {
  id: string;
  name: string;
  tasks: ProgrammeTask[];
}

export interface ProgrammePhase {
  id: string;
  name: string;
  sections?: ProgrammeSection[];
  tasks?: ProgrammeTask[];
}

export interface ProgrammePlan {
  title: string;
  company: string;
  projectStart: string;
  phases: ProgrammePhase[];
}
