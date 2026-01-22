export interface ActionLogItem {
  actionId: string;
  dateRaised: string;
  description: string;
  owner: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Open' | 'Closed';
  notes: string;
}

export const actionLogData: ActionLogItem[] = [
  {
    actionId: "001",
    dateRaised: "23/12/2025",
    description: "Review Risk Register with MR and AT",
    owner: "MJG",
    dueDate: "10/01/2026",
    priority: "High",
    status: "Closed",
    notes: "Completed"
  },
  {
    actionId: "002",
    dateRaised: "23/12/2025",
    description: "Provide update on £30k grant funding at January F2F meeting",
    owner: "MJG",
    dueDate: "31/01/2026",
    priority: "Medium",
    status: "Closed",
    notes: "Completed - Funds confirmed with PML"
  },
  {
    actionId: "003",
    dateRaised: "23/12/2025",
    description: "Review and action feedback on job adverts",
    owner: "MR",
    dueDate: "31/12/2025",
    priority: "High",
    status: "Closed",
    notes: "Completed"
  },
  {
    actionId: "004",
    dateRaised: "23/12/2025",
    description: "Advertise GP roles on Indeed",
    owner: "MR",
    dueDate: "24/12/2025",
    priority: "High",
    status: "Closed",
    notes: "Completed 23/12/2025 - GP, ANP & ACP adverts on NHS Jobs and Indeed"
  },
  {
    actionId: "005",
    dateRaised: "23/12/2025",
    description: "Advertise ANP roles",
    owner: "MR",
    dueDate: "31/01/2026",
    priority: "High",
    status: "Closed",
    notes: "Completed - Included in NHS Jobs and Indeed adverts"
  },
  {
    actionId: "006",
    dateRaised: "23/12/2025",
    description: "Confirm Hub locations (The Parks & Brackley Medical Centre)",
    owner: "MR",
    dueDate: "15/01/2026",
    priority: "High",
    status: "Closed",
    notes: "15/01/2026 - Brook have been unable to speak with NHFT by the agreed date so have withdrawn from being a HUB at this time but may request in the future"
  },
  {
    actionId: "007",
    dateRaised: "23/12/2025",
    description: "Establish PPG participation process and arrange Teams meeting",
    owner: "TBC",
    dueDate: "31/01/2026",
    priority: "Medium",
    status: "Open",
    notes: "Patient Participation Group engagement"
  },
  {
    actionId: "008",
    dateRaised: "23/12/2025",
    description: "Investigate insurance options with Practice Managers",
    owner: "AT",
    dueDate: "31/01/2026",
    priority: "Medium",
    status: "Closed",
    notes: "Completed - All member practices confirmed (12/01/2026)"
  }
];

export const actionLogMetadata = {
  sourceMeeting: "Programme Board Meeting - 23rd December 2025",
  nextMeeting: "Virtual - 13th January 2026, 13:00-14:00",
  lastUpdated: "22/01/2026 16:55"
};
