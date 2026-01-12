import { ProgrammePlan } from "@/types/sdaProgrammePlan";

export const sdaProgrammePlan: ProgrammePlan = {
  title: "Same Day Access Innovator - Programme Plan",
  company: "Rural South & East",
  projectStart: "03/11/2025",
  phases: [
    {
      id: "discovery-setup",
      name: "Discovery & Set-Up",
      tasks: [
        {
          id: "establish-governance",
          name: "Establish governance",
          assignedTo: "Maureen Green",
          progress: 100,
          startDate: "01/11/25",
          endDate: "15/11/25"
        },
        {
          id: "terms-of-reference",
          name: "Terms of Reference",
          assignedTo: "Maureen Green",
          progress: 100,
          startDate: "16/11/25",
          endDate: "09/12/25"
        },
        {
          id: "establish-programme-board",
          name: "Establish Programme Board (PB)",
          assignedTo: "Maureen Green",
          progress: 100,
          startDate: "24/11/25",
          endDate: "24/11/25"
        },
        {
          id: "set-baseline-measure",
          name: "Set baseline measure",
          assignedTo: "Programme Board",
          progress: 20,
          startDate: "01/11/25",
          endDate: "30/03/26"
        },
        {
          id: "creating-relationships",
          name: "Creating Relationships",
          assignedTo: "Programme Board",
          progress: 20,
          startDate: "01/11/25",
          endDate: "30/03/26"
        },
        {
          id: "set-recurring-meetings",
          name: "Set Virtual + Face-to-face recurring PB meeting",
          assignedTo: "Maureen Green",
          progress: 100,
          startDate: "15/11/25",
          endDate: "09/12/25"
        }
      ],
      sections: [
        {
          id: "estates-digital",
          name: "1. Estates & Digital",
          tasks: [
            {
              id: "estates-feasibility",
              name: "Estates Feasibility Analysis",
              assignedTo: "Malcolm Railson",
              progress: 0,
              startDate: "23/12/25",
              endDate: "15/01/26"
            },
            {
              id: "digital-feasibility",
              name: "Digital Feasibility Analysis",
              assignedTo: "Malcolm Railson",
              progress: 100,
              startDate: "01/11/25",
              endDate: "22/12/25"
            },
            {
              id: "create-estates-digital-report",
              name: "Create SDA Estates & Digital Solution Report",
              assignedTo: "Malcolm Railson",
              progress: 0,
              startDate: "16/01/26",
              endDate: "30/01/26"
            },
            {
              id: "estates-digital-review",
              name: "Review & Approval from Programme Board",
              assignedTo: "Programme Board",
              progress: 0,
              startDate: "31/01/26",
              endDate: "14/02/26"
            }
          ]
        },
        {
          id: "appointments",
          name: "2. Appointments",
          tasks: [
            {
              id: "create-appointment-model",
              name: "Create Appointment & Delivery Model",
              assignedTo: "Simon Ellis / Muhammad Chishti",
              progress: 0,
              startDate: "01/12/25",
              endDate: "31/12/25"
            },
            {
              id: "appointments-review",
              name: "Review & Approval from Programme Board",
              assignedTo: "Programme Board",
              progress: 0,
              startDate: "01/01/26",
              endDate: "15/01/26"
            }
          ]
        },
        {
          id: "recruitment",
          name: "3. Recruitment",
          tasks: [
            {
              id: "job-description",
              name: "Job description Finalisation",
              assignedTo: "Simon Ellis / Mark Gray",
              progress: 100,
              startDate: "01/11/25",
              endDate: "30/11/25"
            },
            {
              id: "personal-specification",
              name: "Personal Specification Creation",
              assignedTo: "Simon Ellis / Mark Gray",
              progress: 0,
              startDate: "01/12/25",
              endDate: "15/12/25"
            },
            {
              id: "geography-analysis",
              name: "Geography analysis",
              assignedTo: "Simon Ellis / Mark Gray",
              progress: 0,
              startDate: "01/12/25",
              endDate: "31/12/25"
            },
            {
              id: "salary-finalisation",
              name: "Salary Finalisation",
              assignedTo: "Simon Ellis / Mark Gray",
              progress: 0,
              startDate: "01/01/26",
              endDate: "15/01/26"
            },
            {
              id: "recruitment-agent",
              name: "Recruitment Agent (PML/Practice level)",
              assignedTo: "HR Team",
              progress: 0,
              startDate: "16/01/26",
              endDate: "28/02/26"
            },
            {
              id: "hr-processes",
              name: "HR Processes & On-boarding",
              assignedTo: "HR Team",
              progress: 0,
              startDate: "01/03/26",
              endDate: "30/03/26"
            },
            {
              id: "recruitment-review",
              name: "Review & Approval from Programme Board",
              assignedTo: "Programme Board",
              progress: 0,
              startDate: "16/01/26",
              endDate: "31/01/26"
            }
          ]
        },
        {
          id: "financial-governance",
          name: "4. Financial Governance",
          tasks: [
            {
              id: "create-30k-plan",
              name: "Create plan for £30,000 Expenditure until 1st April 2026",
              assignedTo: "Maureen Green",
              progress: 0,
              startDate: "01/11/25",
              endDate: "30/11/25"
            },
            {
              id: "create-phase-plan",
              name: "Create Phase approach plan for £2.34 millions expenditure post 1st April 2026",
              assignedTo: "Maureen Green",
              progress: 0,
              startDate: "01/12/25",
              endDate: "31/01/26"
            },
            {
              id: "financial-review",
              name: "Review & Approval from Programme Board",
              assignedTo: "Programme Board",
              progress: 0,
              startDate: "01/02/26",
              endDate: "28/02/26"
            }
          ]
        },
        {
          id: "contract-variation",
          name: "5. Discussions on Contract Variation Updates",
          tasks: [
            {
              id: "contract-discussions",
              name: "Contract Variation Discussions",
              assignedTo: "Mark Gray",
              progress: 0,
              startDate: "01/12/25",
              endDate: "28/02/26"
            }
          ]
        },
        {
          id: "risk-governance",
          name: "6. Risk Governance",
          tasks: [
            {
              id: "create-risk-register",
              name: "Creation of Risk Register with high level programme risk",
              assignedTo: "Maureen Green",
              progress: 0,
              startDate: "01/11/25",
              endDate: "30/11/25"
            },
            {
              id: "update-risk-register",
              name: "Updating Existing Risk Register",
              assignedTo: "Programme Board",
              progress: 0,
              startDate: "01/12/25",
              endDate: "30/03/26"
            }
          ]
        },
        {
          id: "communication",
          name: "7. Communication",
          tasks: [
            {
              id: "create-comm-strategies",
              name: "Creation of communication strategies",
              assignedTo: "Maureen Green",
              progress: 0,
              startDate: "01/11/25",
              endDate: "30/11/25"
            },
            {
              id: "comm-approval",
              name: "Approval & Feedback",
              assignedTo: "Programme Board",
              progress: 0,
              startDate: "01/12/25",
              endDate: "15/12/25"
            },
            {
              id: "agree-comm-strands",
              name: "Agree the strands of communication",
              assignedTo: "Programme Board",
              progress: 0,
              startDate: "16/12/25",
              endDate: "31/12/25"
            },
            {
              id: "implement-comm",
              name: "Implementation of the communication strategies",
              assignedTo: "Maureen Green",
              progress: 0,
              startDate: "01/01/26",
              endDate: "30/03/26"
            }
          ]
        },
        {
          id: "innovation",
          name: "8. Innovation",
          tasks: [
            {
              id: "innovation-initiatives",
              name: "Innovation Initiatives",
              assignedTo: "Programme Board",
              progress: 0,
              startDate: "01/01/26",
              endDate: "30/03/26"
            }
          ]
        }
      ]
    }
  ]
};
