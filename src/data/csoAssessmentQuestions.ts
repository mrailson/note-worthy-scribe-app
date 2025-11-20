export interface AssessmentQuestion {
  id: string;
  question: string;
  options: AssessmentOption[];
  correctAnswer: string;
  category: 'dcb0129' | 'dcb0160' | 'hazard' | 'risk' | 'incident';
  explanation?: string;
}

export interface AssessmentOption {
  id: string;
  text: string;
}

export const csoAssessmentQuestions: AssessmentQuestion[] = [
  // DCB0129 Questions (6)
  {
    id: 'q001',
    category: 'dcb0129',
    question: 'What is the primary purpose of DCB0129?',
    options: [
      { id: 'a', text: 'To regulate medical device manufacturers' },
      { id: 'b', text: 'To provide clinical risk management standards for health IT systems' },
      { id: 'c', text: 'To replace GDPR requirements' },
      { id: 'd', text: 'To certify Clinical Safety Officers' }
    ],
    correctAnswer: 'b',
    explanation: 'DCB0129 provides clinical risk management standards specifically for health IT systems deployed and used by healthcare organisations.'
  },
  {
    id: 'q002',
    category: 'dcb0129',
    question: 'Which of the following is NOT a mandatory deliverable under DCB0129?',
    options: [
      { id: 'a', text: 'Hazard Log' },
      { id: 'b', text: 'Clinical Safety Case Report' },
      { id: 'c', text: 'Marketing materials' },
      { id: 'd', text: 'Clinical Risk Management File' }
    ],
    correctAnswer: 'c',
    explanation: 'Marketing materials are not part of DCB0129 requirements. The mandatory deliverables are: Hazard Log, Clinical Safety Case Report, Clinical Safety Plan, and Clinical Risk Management File.'
  },
  {
    id: 'q003',
    category: 'dcb0129',
    question: 'Who is responsible for maintaining the Hazard Log?',
    options: [
      { id: 'a', text: 'System users' },
      { id: 'b', text: 'Clinical Safety Officer' },
      { id: 'c', text: 'Data Protection Officer' },
      { id: 'd', text: 'IT Manager' }
    ],
    correctAnswer: 'b',
    explanation: 'The Clinical Safety Officer is responsible for maintaining the Hazard Log and ensuring all clinical hazards are properly documented and managed.'
  },
  {
    id: 'q004',
    category: 'dcb0129',
    question: 'How often should clinical safety documentation be reviewed?',
    options: [
      { id: 'a', text: 'Never, once is enough' },
      { id: 'b', text: 'Only when incidents occur' },
      { id: 'c', text: 'At least annually and when significant changes occur' },
      { id: 'd', text: 'Every five years' }
    ],
    correctAnswer: 'c',
    explanation: 'DCB0129 requires clinical safety documentation to be reviewed at least annually, and also when significant changes occur to the system or its use.'
  },
  {
    id: 'q005',
    category: 'dcb0129',
    question: 'What does ALARP stand for in clinical risk management?',
    options: [
      { id: 'a', text: 'All Levels Are Risk Protected' },
      { id: 'b', text: 'As Low As Reasonably Practicable' },
      { id: 'c', text: 'Advanced Level Assessment Required Protocol' },
      { id: 'd', text: 'Automated Logging And Reporting Process' }
    ],
    correctAnswer: 'b',
    explanation: 'ALARP stands for As Low As Reasonably Practicable, meaning risks should be reduced unless the cost is grossly disproportionate to the safety benefit.'
  },
  {
    id: 'q006',
    category: 'dcb0129',
    question: 'DCB0129 applies to which type of organisations?',
    options: [
      { id: 'a', text: 'Only hospitals' },
      { id: 'b', text: 'Only GP practices' },
      { id: 'c', text: 'Health organisations that deploy or operate health IT systems' },
      { id: 'd', text: 'Only pharmaceutical companies' }
    ],
    correctAnswer: 'c',
    explanation: 'DCB0129 applies to all health organisations that deploy or operate health IT systems, including hospitals, GP practices, social care organisations, and private providers serving NHS patients.'
  },
  // DCB0160 Questions (3)
  {
    id: 'q007',
    category: 'dcb0160',
    question: 'DCB0160 primarily applies to:',
    options: [
      { id: 'a', text: 'Healthcare providers' },
      { id: 'b', text: 'Manufacturers of health IT systems' },
      { id: 'c', text: 'Patients' },
      { id: 'd', text: 'Insurance companies' }
    ],
    correctAnswer: 'b',
    explanation: 'DCB0160 applies to manufacturers and developers of health IT systems, ensuring clinical safety is built into products from design through to ongoing maintenance.'
  },
  {
    id: 'q008',
    category: 'dcb0160',
    question: 'What is a key difference between DCB0129 and DCB0160?',
    options: [
      { id: 'a', text: 'DCB0129 is for manufacturers, DCB0160 is for providers' },
      { id: 'b', text: 'DCB0129 is for providers, DCB0160 is for manufacturers' },
      { id: 'c', text: 'They are identical standards' },
      { id: 'd', text: 'DCB0160 has been deprecated' }
    ],
    correctAnswer: 'b',
    explanation: 'DCB0129 applies to healthcare organisations deploying and using health IT systems, whilst DCB0160 applies to manufacturers developing health IT systems.'
  },
  {
    id: 'q009',
    category: 'dcb0160',
    question: 'Under DCB0160, when must a Clinical Safety Case be updated?',
    options: [
      { id: 'a', text: 'Never' },
      { id: 'b', text: 'Only at initial release' },
      { id: 'c', text: 'When significant changes are made to the system' },
      { id: 'd', text: 'Only if an incident occurs' }
    ],
    correctAnswer: 'c',
    explanation: 'The Clinical Safety Case must be updated whenever significant changes are made to the system to ensure it continues to reflect the current safety status.'
  },
  // Hazard Identification Questions (4)
  {
    id: 'q010',
    category: 'hazard',
    question: 'Which of the following is a clinical hazard in a patient record system?',
    options: [
      { id: 'a', text: 'Slow loading times' },
      { id: 'b', text: 'Incorrect patient information being displayed' },
      { id: 'c', text: 'Complex user interface' },
      { id: 'd', text: 'High software costs' }
    ],
    correctAnswer: 'b',
    explanation: 'Incorrect patient information being displayed is a clinical hazard as it could lead to wrong treatment decisions and patient harm.'
  },
  {
    id: 'q011',
    category: 'hazard',
    question: 'What is the first step in hazard identification?',
    options: [
      { id: 'a', text: 'Risk assessment' },
      { id: 'b', text: 'System design' },
      { id: 'c', text: 'Understanding the system and its clinical context' },
      { id: 'd', text: 'Writing the safety case' }
    ],
    correctAnswer: 'c',
    explanation: 'Before identifying hazards, you must first understand the system, its intended use, clinical context, and how it will be used in practice.'
  },
  {
    id: 'q012',
    category: 'hazard',
    question: 'A "hazard" in clinical safety terms is:',
    options: [
      { id: 'a', text: 'A guaranteed incident' },
      { id: 'b', text: 'A potential source of harm' },
      { id: 'c', text: 'A software bug' },
      { id: 'd', text: 'A user complaint' }
    ],
    correctAnswer: 'b',
    explanation: 'A hazard is a potential source of harm - it represents something that could cause harm, not something that definitely will or has caused harm.'
  },
  {
    id: 'q013',
    category: 'hazard',
    question: 'Which technique is commonly used for hazard identification?',
    options: [
      { id: 'a', text: 'Profit analysis' },
      { id: 'b', text: 'Failure Mode and Effects Analysis (FMEA)' },
      { id: 'c', text: 'Market research' },
      { id: 'd', text: 'Social media monitoring' }
    ],
    correctAnswer: 'b',
    explanation: 'FMEA (Failure Mode and Effects Analysis) is a systematic technique commonly used for identifying potential failure modes and their effects in clinical systems.'
  },
  // Risk Assessment Questions (4)
  {
    id: 'q014',
    category: 'risk',
    question: 'In clinical risk assessment, "Severity" refers to:',
    options: [
      { id: 'a', text: 'How often an incident occurs' },
      { id: 'b', text: 'The potential harm caused by a hazard' },
      { id: 'c', text: 'The cost of fixing the issue' },
      { id: 'd', text: 'The number of users affected' }
    ],
    correctAnswer: 'b',
    explanation: 'Severity measures the worst credible clinical consequence if a hazard causes harm, ranging from negligible to catastrophic.'
  },
  {
    id: 'q015',
    category: 'risk',
    question: 'A risk rated as "Catastrophic" severity and "High" likelihood would be:',
    options: [
      { id: 'a', text: 'Low risk' },
      { id: 'b', text: 'Medium risk' },
      { id: 'c', text: 'High risk' },
      { id: 'd', text: 'Acceptable risk' }
    ],
    correctAnswer: 'c',
    explanation: 'Catastrophic (5) × High (4) = 20, which is in the unacceptable (red) risk range, requiring immediate action.'
  },
  {
    id: 'q016',
    category: 'risk',
    question: 'What does "residual risk" mean?',
    options: [
      { id: 'a', text: 'Risk that has been eliminated' },
      { id: 'b', text: 'Risk remaining after control measures are applied' },
      { id: 'c', text: 'Initial risk before assessment' },
      { id: 'd', text: 'Risk from old systems' }
    ],
    correctAnswer: 'b',
    explanation: 'Residual risk is the risk that remains after control measures have been implemented. It must be assessed to ensure it is ALARP and acceptable.'
  },
  {
    id: 'q017',
    category: 'risk',
    question: 'Which is an example of a technical risk control?',
    options: [
      { id: 'a', text: 'User training' },
      { id: 'b', text: 'Written procedures' },
      { id: 'c', text: 'Data validation checks in software' },
      { id: 'd', text: 'Monthly meetings' }
    ],
    correctAnswer: 'c',
    explanation: 'Data validation checks built into software are technical controls - they are engineered into the system itself and do not rely on user behaviour.'
  },
  // Incident Management Questions (3)
  {
    id: 'q018',
    category: 'incident',
    question: 'When should a clinical safety incident be reported?',
    options: [
      { id: 'a', text: 'Only if someone is harmed' },
      { id: 'b', text: 'As soon as it is identified' },
      { id: 'c', text: 'At the end of the month' },
      { id: 'd', text: 'Only if it happens more than once' }
    ],
    correctAnswer: 'b',
    explanation: 'Clinical safety incidents should be reported as soon as they are identified, including near misses, to enable prompt investigation and prevent recurrence.'
  },
  {
    id: 'q019',
    category: 'incident',
    question: 'What is the purpose of root cause analysis?',
    options: [
      { id: 'a', text: 'To assign blame' },
      { id: 'b', text: 'To identify the underlying cause of an incident' },
      { id: 'c', text: 'To calculate financial costs' },
      { id: 'd', text: 'To satisfy regulators' }
    ],
    correctAnswer: 'b',
    explanation: 'Root cause analysis is a systematic process to identify the underlying causes of incidents so that effective preventive actions can be implemented.'
  },
  {
    id: 'q020',
    category: 'incident',
    question: 'Who should be involved in investigating clinical safety incidents?',
    options: [
      { id: 'a', text: 'Only IT staff' },
      { id: 'b', text: 'Only clinical staff' },
      { id: 'c', text: 'A multidisciplinary team including CSO, clinical and technical staff' },
      { id: 'd', text: 'Only the Clinical Safety Officer' }
    ],
    correctAnswer: 'c',
    explanation: 'Effective incident investigation requires a multidisciplinary team combining clinical, technical, and safety expertise to fully understand and address the issues.'
  }
];

export const getRandomQuestions = (count: number = 10): AssessmentQuestion[] => {
  // Fisher-Yates shuffle algorithm
  const shuffled = [...csoAssessmentQuestions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

export const calculateScore = (answers: Record<string, string>): {
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
} => {
  let correctCount = 0;
  const totalQuestions = Object.keys(answers).length;
  
  Object.entries(answers).forEach(([questionId, selectedAnswer]) => {
    const question = csoAssessmentQuestions.find(q => q.id === questionId);
    if (question && question.correctAnswer === selectedAnswer) {
      correctCount++;
    }
  });
  
  const percentage = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
  const passed = percentage >= 80; // 80% pass mark
  
  return {
    score: correctCount,
    totalQuestions,
    percentage: Math.round(percentage),
    passed
  };
};

export const getQuestionsByCategory = (category: AssessmentQuestion['category']): AssessmentQuestion[] => {
  return csoAssessmentQuestions.filter(q => q.category === category);
};
