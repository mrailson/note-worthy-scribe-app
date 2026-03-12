export interface TrainingScenario {
  id: string;
  category: string;
  categoryIcon: string;
  categoryColour: string;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export const TRAINING_SCENARIOS: TrainingScenario[] = [
  {
    id: 'appointment_booking',
    category: 'Routine Reception',
    categoryIcon: '📅',
    categoryColour: '#005EB8',
    title: 'Appointment Booking',
    description: 'Patient wants to book a routine appointment for ongoing knee pain.',
    difficulty: 'Easy',
  },
  {
    id: 'new_patient_registration',
    category: 'Routine Reception',
    categoryIcon: '📋',
    categoryColour: '#005EB8',
    title: 'New Patient Registration',
    description: 'Recently arrived patient needs to register — confused about how the NHS works.',
    difficulty: 'Easy',
  },
  {
    id: 'urgent_chest_pain',
    category: 'Urgent Triage',
    categoryIcon: '🚨',
    categoryColour: '#DA291C',
    title: 'Urgent: Chest Pain',
    description: 'Distressed patient with chest tightness and shortness of breath.',
    difficulty: 'Hard',
  },
  {
    id: 'child_fever',
    category: 'Urgent Triage',
    categoryIcon: '🌡️',
    categoryColour: '#DA291C',
    title: 'Worried Parent: Child with Fever',
    description: "Emotional parent with a feverish child who hasn't eaten for 2 days.",
    difficulty: 'Medium',
  },
  {
    id: 'prescription_collection',
    category: 'Admin & Paperwork',
    categoryIcon: '💊',
    categoryColour: '#7C3AED',
    title: 'Prescription Collection Problem',
    description: "Patient's repeat prescription hasn't been processed — running out today.",
    difficulty: 'Medium',
  },
  {
    id: 'test_results',
    category: 'Admin & Paperwork',
    categoryIcon: '🔬',
    categoryColour: '#7C3AED',
    title: 'Chasing Test Results',
    description: "Anxious patient wants blood test results — receptionist can't share them.",
    difficulty: 'Medium',
  },
  {
    id: 'sicknote_request',
    category: 'Admin & Paperwork',
    categoryIcon: '📝',
    categoryColour: '#7C3AED',
    title: 'Fit Note / Sick Note Request',
    description: "Patient needs a fit note for their employer — doesn't understand the process.",
    difficulty: 'Easy',
  },
  {
    id: 'medication_from_abroad',
    category: 'Admin & Paperwork',
    categoryIcon: '📦',
    categoryColour: '#7C3AED',
    title: 'Medication from Abroad',
    description: "Patient takes medication prescribed overseas — doesn't know the UK brand name.",
    difficulty: 'Hard',
  },
];
