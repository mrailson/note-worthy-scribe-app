export interface ReportDetail {
  id: string;
  title: string;
  level: 'Practice' | 'PCN' | 'Neighbourhoods' | 'ICB';
  heroMetric: {
    value: string;
    label: string;
    trend?: 'up' | 'down' | 'stable';
    trendValue?: string;
  };
  keyInsight: string;
  reportPeriod: string;
  generatedDate: string;
  sections: {
    title: string;
    content: string[];
  }[];
  chartData?: {
    type: 'bar' | 'line' | 'pie';
    data: any[];
  };
}

export const mockReportData: Record<string, ReportDetail> = {
  // Neighbourhoods Level Reports
  'neighbourhood-dashboard': {
    id: 'neighbourhood-dashboard',
    title: 'Neighbourhood Dashboard',
    level: 'Neighbourhoods',
    heroMetric: {
      value: '18 PCNs',
      label: 'Primary Care Networks',
      trend: 'stable',
    },
    keyInsight: '94 practices serving 88,938 patients across Rural East & South Northamptonshire',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Network Overview',
        content: [
          '18 Primary Care Networks actively participating',
          '94 GP practices providing services',
          '88,938 total patient population',
          '7 practices in Rural East & South neighbourhood',
        ],
      },
      {
        title: 'Geographic Distribution',
        content: [
          'Denton Village Surgery: 6,277 patients (7.1%)',
          'Bugbrooke Surgery: 10,773 patients (12.1%)',
          'Towcester Medical Centre: 11,439 patients (12.9%)',
          'Brook Health Centre: 8,983 patients (10.1%)',
          'Springfield Surgery: 12,649 patients (14.2%)',
          'Brackley Medical Centre: 16,128 patients (18.1%)',
          'The Parks Medical Practice: 22,689 patients (25.5%)',
        ],
      },
    ],
    chartData: {
      type: 'bar',
      data: [
        { name: 'Denton Village', value: 6277 },
        { name: 'Bugbrooke', value: 10773 },
        { name: 'Towcester', value: 11439 },
        { name: 'Brook Health', value: 8983 },
        { name: 'Springfield', value: 12649 },
        { name: 'Brackley', value: 16128 },
        { name: 'The Parks', value: 22689 },
      ],
    },
  },
  'cross-pcn-themes': {
    id: 'cross-pcn-themes',
    title: 'Cross-PCN Themes',
    level: 'Neighbourhoods',
    heroMetric: {
      value: '14 of 18',
      label: 'PCNs with prescription delivery issues',
      trend: 'up',
      trendValue: '+3 from Q2',
    },
    keyInsight: 'Prescription delivery is the most common cross-network theme affecting 78% of PCNs',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Common Themes Across Networks',
        content: [
          'Prescription delivery delays: 14 PCNs (78%)',
          'Appointment availability: 11 PCNs (61%)',
          'Communication issues: 9 PCNs (50%)',
          'Test result delays: 7 PCNs (39%)',
        ],
      },
      {
        title: 'Collaboration Opportunities',
        content: [
          'Shared prescription courier service across 6 PCNs',
          'Joint appointment booking system under development',
          'Unified communication platform pilot in 4 PCNs',
        ],
      },
    ],
  },
  'population-health': {
    id: 'population-health',
    title: 'Population Health Insights',
    level: 'Neighbourhoods',
    heroMetric: {
      value: '34%',
      label: 'Complaints from over-75s',
      trend: 'up',
      trendValue: '+5% from Q2',
    },
    keyInsight: 'Over-75 population accounts for 34% of complaints despite being 18% of patient base',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Age Demographics',
        content: [
          'Over-75s: 34% of complaints (18% of population)',
          'Working age (25-64): 42% of complaints (52% of population)',
          'Young families (0-24): 24% of complaints (30% of population)',
        ],
      },
      {
        title: 'Health Conditions',
        content: [
          'Chronic disease management: 45% of complaints',
          'Mental health services: 28% of complaints',
          'Urgent care access: 27% of complaints',
        ],
      },
    ],
    chartData: {
      type: 'pie',
      data: [
        { name: 'Over-75s', value: 34 },
        { name: 'Working Age', value: 42 },
        { name: 'Young Families', value: 24 },
      ],
    },
  },
  'service-gap-analysis': {
    id: 'service-gap-analysis',
    title: 'Service Gap Analysis',
    level: 'Neighbourhoods',
    heroMetric: {
      value: '89',
      label: 'Evening appointment complaints',
      trend: 'up',
      trendValue: '+12 from Q2',
    },
    keyInsight: 'Significant unmet demand for evening and weekend appointments across all PCNs',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Access Gaps',
        content: [
          'Evening appointments (5-8pm): 89 complaints',
          'Weekend services: 67 complaints',
          'Same-day urgent care: 54 complaints',
          'Home visits for elderly: 43 complaints',
        ],
      },
      {
        title: 'Demand vs Supply',
        content: [
          'Requested evening slots: 234 per week',
          'Available evening slots: 98 per week',
          'Gap: 136 appointments per week (58% unmet demand)',
        ],
      },
    ],
  },
  'quality-patterns': {
    id: 'quality-patterns',
    title: 'Quality Patterns',
    level: 'Neighbourhoods',
    heroMetric: {
      value: '92%',
      label: 'Clinical quality satisfaction',
      trend: 'stable',
    },
    keyInsight: 'Clinical quality remains high; process and access issues drive most complaints',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Quality Indicators',
        content: [
          'Clinical care satisfaction: 92%',
          'Process efficiency: 76%',
          'Communication quality: 81%',
          'Access and availability: 68%',
        ],
      },
    ],
  },
  'resource-allocation': {
    id: 'resource-allocation',
    title: 'Resource Allocation',
    level: 'Neighbourhoods',
    heroMetric: {
      value: '£287K',
      label: 'Estimated cost of complaint handling',
      trend: 'up',
      trendValue: '+8% from Q2',
    },
    keyInsight: 'Complaint handling costs increasing; investment in prevention could reduce by 40%',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Resource Impact',
        content: [
          'Staff time on complaints: 1,240 hours/quarter',
          'Average cost per complaint: £342',
          'Total quarterly cost: £287,000',
        ],
      },
    ],
  },

  // Practice Level Reports
  'complaints-overview': {
    id: 'complaints-overview',
    title: 'Complaints Overview',
    level: 'Practice',
    heroMetric: {
      value: '47',
      label: 'Total complaints this quarter',
      trend: 'down',
      trendValue: '-8 from Q2',
    },
    keyInsight: '15% reduction in complaints following process improvements',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Complaint Breakdown',
        content: [
          'Appointment access: 18 complaints (38%)',
          'Communication: 12 complaints (26%)',
          'Clinical care: 9 complaints (19%)',
          'Prescription services: 8 complaints (17%)',
        ],
      },
    ],
  },
  'response-times': {
    id: 'response-times',
    title: 'Response Times',
    level: 'Practice',
    heroMetric: {
      value: '4.2 days',
      label: 'Average response time',
      trend: 'down',
      trendValue: '-1.3 days from Q2',
    },
    keyInsight: 'Response times improved by 24% through streamlined processes',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Response Performance',
        content: [
          'Within 3 days: 65% of complaints',
          'Within 7 days: 92% of complaints',
          'Over 7 days: 8% of complaints',
        ],
      },
    ],
  },
  'satisfaction-scores': {
    id: 'satisfaction-scores',
    title: 'Satisfaction Scores',
    level: 'Practice',
    heroMetric: {
      value: '4.3/5',
      label: 'Overall satisfaction',
      trend: 'up',
      trendValue: '+0.4 from Q2',
    },
    keyInsight: 'Patient satisfaction at highest level in 2 years',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Satisfaction Metrics',
        content: [
          'Staff courtesy: 4.7/5',
          'Communication: 4.2/5',
          'Access to services: 3.9/5',
          'Overall experience: 4.3/5',
        ],
      },
    ],
  },
  'trends-analysis': {
    id: 'trends-analysis',
    title: 'Trends Analysis',
    level: 'Practice',
    heroMetric: {
      value: '-15%',
      label: 'Complaint reduction YoY',
      trend: 'down',
      trendValue: 'Year on year improvement',
    },
    keyInsight: 'Sustained improvement trend over 12 months',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Quarterly Trends',
        content: [
          'Q4 2023: 55 complaints',
          'Q1 2024: 52 complaints',
          'Q2 2024: 55 complaints',
          'Q3 2024: 47 complaints',
        ],
      },
    ],
  },
  'staff-training': {
    id: 'staff-training',
    title: 'Staff Training Needs',
    level: 'Practice',
    heroMetric: {
      value: '3',
      label: 'Priority training areas identified',
      trend: 'stable',
    },
    keyInsight: 'Communication and de-escalation training recommended for front desk staff',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Training Priorities',
        content: [
          'Communication skills: 8 staff members',
          'Complaint handling: 12 staff members',
          'De-escalation techniques: 6 staff members',
        ],
      },
    ],
  },
  'patient-feedback': {
    id: 'patient-feedback',
    title: 'Patient Feedback Summary',
    level: 'Practice',
    heroMetric: {
      value: '87%',
      label: 'Would recommend practice',
      trend: 'up',
      trendValue: '+5% from Q2',
    },
    keyInsight: 'Recommendation rate at 3-year high despite access challenges',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Feedback Themes',
        content: [
          'Positive: Caring staff, thorough consultations',
          'Needs improvement: Appointment availability, phone access',
        ],
      },
    ],
  },

  // PCN Level Reports
  'pcn-complaints': {
    id: 'pcn-complaints',
    title: 'PCN Complaints Summary',
    level: 'PCN',
    heroMetric: {
      value: '342',
      label: 'Total PCN complaints',
      trend: 'down',
      trendValue: '-6% from Q2',
    },
    keyInsight: 'Network-wide improvement following shared learning initiative',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'PCN-Wide Issues',
        content: [
          'Shared prescription service: 78 complaints',
          'Extended access hub: 54 complaints',
          'Digital services: 43 complaints',
        ],
      },
    ],
  },
  'shared-services': {
    id: 'shared-services',
    title: 'Shared Services Performance',
    level: 'PCN',
    heroMetric: {
      value: '81%',
      label: 'Shared service satisfaction',
      trend: 'up',
      trendValue: '+7% from Q2',
    },
    keyInsight: 'PCN shared services showing strong improvement after initial rollout challenges',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Service Performance',
        content: [
          'Extended access appointments: 85% satisfaction',
          'Shared pharmacy service: 79% satisfaction',
          'Digital consultation platform: 78% satisfaction',
        ],
      },
    ],
  },
  'collaboration-metrics': {
    id: 'collaboration-metrics',
    title: 'Collaboration Metrics',
    level: 'PCN',
    heroMetric: {
      value: '12',
      label: 'Active collaborative projects',
      trend: 'up',
      trendValue: '+3 from Q2',
    },
    keyInsight: 'Cross-practice collaboration increasing, driving shared learning',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Collaborative Initiatives',
        content: [
          'Shared complaint handling protocols: 8 practices',
          'Joint quality improvement projects: 6 practices',
          'Cross-practice training: 10 practices',
        ],
      },
    ],
  },
  'cross-practice': {
    id: 'cross-practice',
    title: 'Cross-Practice Comparisons',
    level: 'PCN',
    heroMetric: {
      value: '3.8',
      label: 'Average complaints per 1000 patients',
      trend: 'down',
      trendValue: '-0.4 from Q2',
    },
    keyInsight: 'Practice variation decreasing as best practices are shared',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Practice Benchmarking',
        content: [
          'Best performing: 2.1 complaints per 1000',
          'PCN average: 3.8 complaints per 1000',
          'Highest rate: 6.2 complaints per 1000',
        ],
      },
    ],
  },
  'resource-sharing': {
    id: 'resource-sharing',
    title: 'Resource Sharing',
    level: 'PCN',
    heroMetric: {
      value: '£124K',
      label: 'Savings from shared resources',
      trend: 'up',
      trendValue: '+£32K from Q2',
    },
    keyInsight: 'Resource pooling delivering significant cost savings',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Shared Resources',
        content: [
          'Complaint management system: £45K savings',
          'Training programs: £38K savings',
          'Quality improvement tools: £41K savings',
        ],
      },
    ],
  },
  'quality-improvement': {
    id: 'quality-improvement',
    title: 'Quality Improvement',
    level: 'PCN',
    heroMetric: {
      value: '8',
      label: 'Active QI projects',
      trend: 'up',
      trendValue: '+2 from Q2',
    },
    keyInsight: 'Quality improvement culture strengthening across PCN',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'QI Initiatives',
        content: [
          'Appointment access improvement: 3 practices',
          'Communication enhancement: 4 practices',
          'Digital transformation: 5 practices',
        ],
      },
    ],
  },

  // ICB Level Reports
  'icb-overview': {
    id: 'icb-overview',
    title: 'ICB Complaints Overview',
    level: 'ICB',
    heroMetric: {
      value: '2,847',
      label: 'Total ICB complaints',
      trend: 'down',
      trendValue: '-4% from Q2',
    },
    keyInsight: 'System-wide complaint reduction following strategic interventions',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'ICB-Wide Themes',
        content: [
          'Access to services: 38% of all complaints',
          'Communication: 27% of all complaints',
          'Clinical care: 21% of all complaints',
          'Administration: 14% of all complaints',
        ],
      },
    ],
  },
  'system-performance': {
    id: 'system-performance',
    title: 'System Performance',
    level: 'ICB',
    heroMetric: {
      value: '84%',
      label: 'System-wide satisfaction',
      trend: 'up',
      trendValue: '+3% from Q2',
    },
    keyInsight: 'Patient satisfaction improving across all care settings',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Performance Indicators',
        content: [
          'Primary care satisfaction: 84%',
          'Community services: 82%',
          'Mental health services: 79%',
          'Urgent care: 76%',
        ],
      },
    ],
  },
  'strategic-priorities': {
    id: 'strategic-priorities',
    title: 'Strategic Priorities',
    level: 'ICB',
    heroMetric: {
      value: '5',
      label: 'Strategic priority areas',
      trend: 'stable',
    },
    keyInsight: 'Focus on access, digital transformation, and workforce development',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Priority Areas',
        content: [
          'Improving access to primary care',
          'Digital service transformation',
          'Workforce recruitment and retention',
          'Integration of care pathways',
          'Patient experience enhancement',
        ],
      },
    ],
  },
  'regional-comparisons': {
    id: 'regional-comparisons',
    title: 'Regional Comparisons',
    level: 'ICB',
    heroMetric: {
      value: '2nd',
      label: 'Regional ranking for complaint resolution',
      trend: 'up',
      trendValue: 'Up from 4th in Q2',
    },
    keyInsight: 'Strong improvement in regional performance rankings',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Regional Benchmarking',
        content: [
          'Complaint rate: 3.2 per 1000 (regional avg: 4.1)',
          'Resolution time: 5.8 days (regional avg: 8.2)',
          'Satisfaction: 84% (regional avg: 78%)',
        ],
      },
    ],
  },
  'policy-impact': {
    id: 'policy-impact',
    title: 'Policy Impact Analysis',
    level: 'ICB',
    heroMetric: {
      value: '73%',
      label: 'Policy compliance rate',
      trend: 'up',
      trendValue: '+12% from Q2',
    },
    keyInsight: 'New complaint handling policies showing strong adoption',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Policy Implementation',
        content: [
          'Complaint handling framework: 87% adoption',
          'Response time standards: 73% compliance',
          'Quality assurance process: 68% implementation',
        ],
      },
    ],
  },
  'financial-analysis': {
    id: 'financial-analysis',
    title: 'Financial Analysis',
    level: 'ICB',
    heroMetric: {
      value: '£1.2M',
      label: 'Annual complaint handling cost',
      trend: 'down',
      trendValue: '-8% from 2023',
    },
    keyInsight: 'Prevention and early resolution reducing overall system costs',
    reportPeriod: 'Q3 2024',
    generatedDate: new Date().toLocaleDateString('en-GB'),
    sections: [
      {
        title: 'Cost Analysis',
        content: [
          'Direct handling costs: £687K',
          'Clinical time: £342K',
          'Administrative support: £171K',
        ],
      },
    ],
  },
};
