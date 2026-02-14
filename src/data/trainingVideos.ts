export interface TrainingVideo {
  id: string;
  title: string;
  description: string;
  loomUrl: string;
  category: string;
  duration: string;
}

export const CATEGORIES = [
  'Getting Started',
  'Ask AI',
  'Translation',
  'Meetings',
  'Complaints',
] as const;

export const trainingVideos: TrainingVideo[] = [
  // Getting Started
  {
    id: 'gs-1',
    title: 'Welcome to Notewell AI',
    description: 'A quick overview of the platform and how to navigate the main features.',
    loomUrl: '/training',
    category: 'Getting Started',
    duration: '3 min',
  },
  {
    id: 'gs-2',
    title: 'Setting Up Your Profile and Managing Your Team',
    description: 'How to configure your user profile and preferences for the best experience.',
    loomUrl: 'https://www.loom.com/share/6fc9dc243f4e4046934900202f2a66e9',
    category: 'Getting Started',
    duration: '2 min',
  },
  // Ask AI
  {
    id: 'ai-1',
    title: 'Using Ask AI',
    description: 'Learn how to ask clinical and practice management questions using the AI assistant.',
    loomUrl: 'https://www.loom.com/share/6116d985133e4341a7361045f6917586',
    category: 'Ask AI',
    duration: '4 min',
  },
  // Translation
  {
    id: 'tr-1',
    title: 'How to Use the Translation Service',
    description: 'Step-by-step guide to translating patient conversations in real time.',
    loomUrl: 'https://www.loom.com/share/58536667bf1a4abf837f94e507f24c76',
    category: 'Translation',
    duration: '3 min',
  },
  // Meetings
  {
    id: 'mt-1',
    title: 'Recording a Meeting',
    description: 'How to start, pause, and finish recording a meeting with automatic transcription.',
    loomUrl: 'https://www.loom.com/share/7ec10c79d10f4b738aa990806c4413e7',
    category: 'Meetings',
    duration: '4 min',
  },
  // Complaints
  {
    id: 'cp-1',
    title: 'Logging a New Complaint',
    description: 'Walk through the process of creating and categorising a new complaint.',
    loomUrl: 'https://www.loom.com/share/example-complaint',
    category: 'Complaints',
    duration: '5 min',
  },
];
