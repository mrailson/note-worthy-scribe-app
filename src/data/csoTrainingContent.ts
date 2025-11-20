export interface TrainingModule {
  id: string;
  title: string;
  duration: number; // minutes
  sections: TrainingSection[];
  icon: string;
}

export interface TrainingSection {
  title: string;
  content: string;
  keyPoints?: string[];
}

export const csoTrainingModules: TrainingModule[] = [
  {
    id: "introduction",
    title: "Introduction to Clinical Safety",
    duration: 15,
    icon: "BookOpen",
    sections: [
      {
        title: "Welcome to CSO Training",
        content: `Welcome to the Clinical Safety Officer Level 1 Training Programme. This comprehensive course will equip you with the essential knowledge and skills to manage clinical safety in healthcare IT systems.

Clinical safety is paramount in modern healthcare, where digital systems play an increasingly critical role in patient care. As a Clinical Safety Officer, you'll be responsible for ensuring that health IT systems are safe, effective, and compliant with NHS Digital standards.`,
        keyPoints: [
          "Understand the critical importance of clinical safety",
          "Learn your responsibilities as a Clinical Safety Officer",
          "Master NHS Digital clinical safety standards"
        ]
      },
      {
        title: "Role of the Clinical Safety Officer",
        content: `The Clinical Safety Officer (CSO) is a qualified healthcare professional responsible for ensuring the safety of health IT systems throughout their lifecycle.

**Key Responsibilities:**
- **Risk Management**: Identifying, assessing, and mitigating clinical risks
- **Documentation**: Maintaining comprehensive clinical safety documentation
- **Governance**: Ensuring compliance with DCB0129 and DCB0160 standards
- **Stakeholder Engagement**: Working with clinical, technical, and management teams
- **Incident Management**: Investigating and learning from safety incidents
- **Continuous Improvement**: Monitoring and enhancing safety practices`,
        keyPoints: [
          "CSOs must be qualified healthcare professionals",
          "Responsibility spans the entire system lifecycle",
          "Role requires both clinical and technical understanding"
        ]
      },
      {
        title: "Importance of Clinical Safety in Healthcare IT",
        content: `Healthcare IT systems directly impact patient safety. A single error in a digital system can have catastrophic consequences for patient care.

**Why Clinical Safety Matters:**
- **Patient Safety**: Protecting patients from harm caused by IT system failures
- **Clinical Effectiveness**: Ensuring systems support rather than hinder clinical decision-making
- **Legal Compliance**: Meeting statutory and regulatory requirements
- **Professional Standards**: Upholding the highest standards of professional practice
- **Public Trust**: Maintaining confidence in digital healthcare systems

**Real-World Impact:**
Consider prescription systems that could display incorrect dosages, patient record systems that could mix up patient identities, or diagnostic tools that could provide misleading results. Each represents a potential clinical hazard that must be systematically managed.`,
        keyPoints: [
          "Digital systems can directly harm patients if unsafe",
          "Clinical safety is both a legal and professional duty",
          "Systematic risk management is essential"
        ]
      },
      {
        title: "Legal and Professional Responsibilities",
        content: `As a Clinical Safety Officer, you have both legal and professional obligations:

**Legal Framework:**
- **Health and Safety at Work Act 1974**: General duty of care
- **Data Protection Act 2018**: Protection of patient information
- **Medical Devices Regulations 2002**: Where applicable to software
- **NHS Digital Standards**: DCB0129 and DCB0160 compliance

**Professional Responsibilities:**
- Maintain professional registration and competence
- Act in the best interests of patients
- Exercise professional judgement independently
- Report serious safety concerns appropriately
- Maintain confidentiality while ensuring safety

**Accountability:**
You may be held accountable for safety failures if you have not exercised due diligence in your role as CSO.`,
        keyPoints: [
          "Legal duties stem from multiple pieces of legislation",
          "Professional standards must be maintained",
          "Personal accountability for safety oversight"
        ]
      },
      {
        title: "Overview of NHS Digital Clinical Safety Standards",
        content: `NHS Digital has published two key clinical safety standards:

**DCB0129** - Clinical Risk Management: Health IT Systems
- Applies to health organisations deploying or operating health IT
- Specifies requirements for managing clinical risk
- Mandates specific deliverables and processes

**DCB0160** - Clinical Risk Management: Manufacturers
- Applies to manufacturers of health IT systems
- Specifies requirements for development and maintenance
- Ensures safety is built into products from the start

These standards work together to create a comprehensive safety framework across the health IT ecosystem.`,
        keyPoints: [
          "DCB0129 is for healthcare organisations",
          "DCB0160 is for manufacturers",
          "Both standards are mandatory for NHS systems"
        ]
      }
    ]
  },
  {
    id: "dcb0129",
    title: "DCB0129 - Clinical Risk Management",
    duration: 25,
    icon: "Shield",
    sections: [
      {
        title: "What is DCB0129?",
        content: `DCB0129 'Clinical Risk Management: its Application in the Deployment and Use of Health IT Systems' is an information standard published by NHS Digital.

**Purpose:**
To ensure that health organisations deploying and using health IT systems have effective processes in place to manage clinical risks.

**Scope:**
DCB0129 applies to:
- NHS organisations
- Private healthcare providers serving NHS patients
- Social care organisations with integrated NHS systems
- Any organisation deploying health IT that could impact patient safety

**Mandatory Compliance:**
Compliance with DCB0129 is mandatory for all relevant organisations under the Health and Social Care Act 2012.`,
        keyPoints: [
          "DCB0129 is a mandatory NHS Digital standard",
          "Applies to organisations deploying/using health IT",
          "Focuses on clinical risk management processes"
        ]
      },
      {
        title: "Clinical Risk Management Lifecycle",
        content: `DCB0129 defines a complete lifecycle for managing clinical risks:

**1. Planning and Preparation**
- Appoint qualified Clinical Safety Officer
- Establish clinical risk management processes
- Define scope and boundaries of the system

**2. System Development/Deployment**
- Conduct hazard identification workshops
- Perform clinical risk assessments
- Implement risk control measures
- Document safety activities

**3. Implementation and Go-Live**
- Final safety review before deployment
- Training and awareness programmes
- Incident reporting mechanisms
- Monitoring arrangements

**4. Ongoing Use and Monitoring**
- Post-deployment surveillance
- Incident investigation and learning
- Periodic safety reviews
- Change management

**5. Decommissioning**
- Safe system retirement
- Data migration safety
- Closure documentation`,
        keyPoints: [
          "Risk management is continuous, not one-time",
          "Each lifecycle stage has specific safety activities",
          "Documentation must be maintained throughout"
        ]
      },
      {
        title: "Key Deliverables Under DCB0129",
        content: `DCB0129 mandates several key deliverables:

**1. Clinical Safety Case Report**
A comprehensive document demonstrating that:
- All clinical hazards have been identified
- Risks have been assessed and managed
- Residual risks are acceptable
- The system is safe for deployment/use

**2. Hazard Log**
A living document tracking:
- All identified hazards
- Risk assessments (initial and residual)
- Control measures implemented
- Current status of each hazard

**3. Clinical Safety Plan**
Describes how clinical safety will be managed, including:
- Roles and responsibilities
- Risk management processes
- Documentation standards
- Review and approval procedures

**4. Clinical Risk Management File**
A complete archive containing:
- All safety documentation
- Evidence of safety activities
- Audit trail of decisions
- Supporting materials and references`,
        keyPoints: [
          "Four main deliverables are required",
          "Documentation must be comprehensive and current",
          "Evidence of safety activities is essential"
        ]
      },
      {
        title: "Clinical Safety Officer Responsibilities Under DCB0129",
        content: `As CSO under DCB0129, you are responsible for:

**Strategic Responsibilities:**
- Ensuring organisational compliance with DCB0129
- Establishing and maintaining risk management processes
- Advising senior management on clinical safety matters
- Representing clinical safety in governance structures

**Operational Responsibilities:**
- Leading hazard identification activities
- Overseeing risk assessments
- Reviewing and approving safety documentation
- Investigating clinical safety incidents
- Monitoring ongoing system safety

**Documentation Responsibilities:**
- Maintaining the Hazard Log
- Approving Clinical Safety Case Reports
- Ensuring completeness of Risk Management File
- Signing off safety before deployment

**Communication Responsibilities:**
- Engaging with clinical users and stakeholders
- Reporting safety concerns to appropriate bodies
- Providing safety training and awareness`,
        keyPoints: [
          "CSO role is both strategic and operational",
          "Personal accountability for key safety decisions",
          "Must balance clinical and organisational needs"
        ]
      },
      {
        title: "Risk Assessment Methodology",
        content: `DCB0129 requires systematic risk assessment using established methodologies:

**Risk Assessment Matrix:**

**Severity Categories:**
- **Catastrophic (5)**: Death or permanent severe disability
- **Major (4)**: Long-term incapacity or major injuries
- **Moderate (3)**: Medical treatment required, temporary disability
- **Minor (2)**: First aid treatment, minor injuries
- **Negligible (1)**: No injury or health effect

**Likelihood Categories:**
- **Very High (5)**: Certain or almost certain to occur
- **High (4)**: Probable, likely to occur
- **Medium (3)**: Possible, could occur
- **Low (2)**: Unlikely, not expected to occur
- **Very Low (1)**: Rare, will probably never occur

**Risk Score = Severity × Likelihood**

Risk ratings:
- 15-25: Unacceptable risk (red)
- 8-12: Undesirable risk (amber)
- 4-6: Acceptable risk (yellow)
- 1-3: Acceptable risk (green)`,
        keyPoints: [
          "Use standardised severity and likelihood scales",
          "Risk score determines acceptability",
          "High risks require immediate mitigation"
        ]
      },
      {
        title: "Clinical Risk Acceptability and ALARP",
        content: `Not all risks can be eliminated. DCB0129 requires risks to be reduced to a level that is ALARP - As Low As Reasonably Practicable.

**ALARP Principle:**
Risks must be reduced unless:
- The cost (in time, money, effort) is grossly disproportionate to the safety benefit, OR
- Further risk reduction is technically impossible

**Acceptability Criteria:**
- **Unacceptable (Red)**: Cannot deploy until mitigated
- **Undesirable (Amber)**: Requires senior management sign-off
- **Acceptable (Yellow/Green)**: Can proceed with monitoring

**Demonstrating ALARP:**
You must document:
- What control measures were considered
- Which measures were implemented and why
- Why rejected measures were not reasonably practicable
- Evidence that residual risk is acceptable

**Management Sign-Off:**
Senior clinical and executive leaders must formally accept residual risks before system deployment.`,
        keyPoints: [
          "ALARP means reducing risk as far as reasonably possible",
          "Not all risks can be eliminated",
          "Senior management must accept residual risks"
        ]
      },
      {
        title: "Documentation Requirements and Standards",
        content: `DCB0129 sets high standards for documentation:

**Essential Characteristics:**
- **Complete**: All safety activities documented
- **Current**: Reflects the latest system state
- **Accurate**: Truthful and verifiable
- **Accessible**: Available to authorised personnel
- **Traceable**: Clear audit trail of decisions
- **Version Controlled**: Managed changes with history

**Document Management:**
- Use standardised templates where available
- Maintain document registers and indices
- Implement formal review and approval processes
- Archive superseded versions appropriately
- Ensure availability during audits and inspections

**Quality Standards:**
- Clear, unambiguous language
- Professional presentation
- Comprehensive but concise
- Cross-referenced to supporting evidence
- Signed and dated by appropriate authorities`,
        keyPoints: [
          "Documentation must be comprehensive and current",
          "Formal document management is required",
          "Quality and accessibility are essential"
        ]
      },
      {
        title: "Practical Examples and Case Studies",
        content: `**Example 1: Electronic Prescribing System**

*Hazard Identified:* System could display incorrect medication dosage if unit conversion fails
*Initial Risk:* Severity = Catastrophic (5), Likelihood = Medium (3), Score = 15 (Red)
*Controls Implemented:*
- Mandatory dose range checking
- Clinical decision support alerts
- User confirmation for unusual doses
- Audit trail of all prescriptions
*Residual Risk:* Severity = Catastrophic (5), Likelihood = Very Low (1), Score = 5 (Yellow)
*Outcome:* Accepted with ongoing monitoring

**Example 2: Patient Record System**

*Hazard Identified:* Wrong patient record could be opened if search algorithm prioritises incorrectly
*Initial Risk:* Severity = Major (4), Likelihood = High (4), Score = 16 (Red)
*Controls Implemented:*
- Three-point patient identity verification
- Prominent display of patient photo and demographics
- Colour-coded allergy warnings
- User training on safe searching
*Residual Risk:* Severity = Major (4), Likelihood = Low (2), Score = 8 (Amber)
*Outcome:* Required executive sign-off, accepted with enhanced training

These examples demonstrate the systematic approach required by DCB0129.`,
        keyPoints: [
          "Real-world hazards require systematic analysis",
          "Multiple control measures often needed",
          "Documentation shows the reasoning process"
        ]
      }
    ]
  },
  {
    id: "dcb0160",
    title: "DCB0160 - Manufacturers' Standards",
    duration: 20,
    icon: "Factory",
    sections: [
      {
        title: "DCB0160 Overview and Scope",
        content: `DCB0160 'Clinical Risk Management: its Application in the Manufacture of Health IT Systems' applies to manufacturers and developers of health IT software.

**Purpose:**
To ensure clinical safety is built into health IT products from design through to ongoing maintenance.

**Who Must Comply:**
- Software developers creating health IT systems
- Commercial vendors of health IT products
- In-house development teams
- System integrators
- Third-party module providers

**Key Principle:**
Safety by design - clinical safety must be an integral part of the development process, not an afterthought.`,
        keyPoints: [
          "DCB0160 applies to manufacturers/developers",
          "Ensures safety is built-in from the start",
          "Mandatory for NHS-deployed systems"
        ]
      },
      {
        title: "Differences Between DCB0129 and DCB0160",
        content: `While both standards address clinical safety, they have different focuses:

**DCB0129 (Deployers/Users):**
- Focus: Safe deployment and use of systems
- Applies to: Healthcare organisations
- Key Activity: Assessing safety in local context
- Deliverable: Clinical Safety Case Report for deployment
- Scope: System as configured and used

**DCB0160 (Manufacturers):**
- Focus: Safe design and development
- Applies to: Software developers/vendors
- Key Activity: Building safety into the product
- Deliverable: Clinical Safety Case for the product
- Scope: System as manufactured/released

**Relationship:**
DCB0160 compliance by the manufacturer supports DCB0129 compliance by the deployer. The manufacturer's safety documentation feeds into the deployer's risk assessment.`,
        keyPoints: [
          "Different standards for different stakeholders",
          "Both work together in the safety ecosystem",
          "Manufacturer safety work supports deployer activities"
        ]
      },
      {
        title: "Manufacturer Responsibilities Under DCB0160",
        content: `Manufacturers must establish and maintain comprehensive clinical risk management processes:

**Development Phase:**
- Appoint qualified Clinical Safety Officer
- Conduct hazard analysis during design
- Implement safety requirements in code
- Perform safety testing and validation
- Document all safety activities

**Release Management:**
- Produce Clinical Safety Case documentation
- Declare known residual risks
- Provide safety information to customers
- Support customer risk assessments

**Post-Market:**
- Monitor product safety in real-world use
- Investigate safety incidents
- Issue safety notices when required
- Manage changes safely
- Maintain safety documentation

**Ongoing:**
- Keep safety documentation current
- Conduct periodic safety reviews
- Respond to emerging risks
- Support customer safety activities`,
        keyPoints: [
          "Safety responsibility throughout product lifecycle",
          "Must support customer organisations",
          "Post-market surveillance is essential"
        ]
      },
      {
        title: "Clinical Safety Case Development",
        content: `The Clinical Safety Case is the manufacturer's key safety deliverable:

**Contents of a Clinical Safety Case:**

**1. System Description**
- Functionality and features
- Intended use and users
- System architecture
- Integration points
- Deployment models

**2. Scope and Boundaries**
- What is included/excluded
- Clinical and technical scope
- Assumptions and dependencies

**3. Hazard Analysis**
- Systematic identification of hazards
- Consideration of failure modes
- User error scenarios
- Integration risks

**4. Risk Assessment**
- Assessment of each hazard
- Initial and residual risk ratings
- Risk acceptability determination

**5. Risk Controls**
- Technical safety features
- User interface design for safety
- Warnings and alerts
- Training requirements
- Operating procedures

**6. Safety Evidence**
- Testing and validation results
- Clinical evaluations
- Post-market data
- Standards compliance

**7. Residual Risk Statement**
- Declaration of known remaining risks
- Information for deployers
- Safety recommendations`,
        keyPoints: [
          "Comprehensive safety argument required",
          "Must cover entire product scope",
          "Evidence-based demonstration of safety"
        ]
      },
      {
        title: "Integration with Quality Management Systems",
        content: `DCB0160 should integrate with established quality management frameworks:

**ISO 13485 (Medical Devices):**
For software classified as a medical device, DCB0160 complements ISO 13485 requirements for risk management.

**ISO 14971 (Risk Management):**
DCB0160 clinical risk management can align with ISO 14971 processes, with specific focus on clinical rather than purely technical risks.

**ISO 9001 (Quality Management):**
General quality management principles support DCB0160 compliance through:
- Document control
- Process management
- Continual improvement
- Management review

**Practical Integration:**
- Embed clinical safety in development lifecycle
- Include safety in design reviews
- Integrate safety testing with quality testing
- Align documentation systems
- Unified audit and compliance processes

**Benefits:**
- Reduces duplication
- Improves efficiency
- Strengthens overall quality
- Supports regulatory compliance`,
        keyPoints: [
          "DCB0160 works alongside quality standards",
          "Integration improves efficiency",
          "Safety is part of overall quality"
        ]
      },
      {
        title: "Change Management Processes",
        content: `All changes to health IT systems must be managed safely:

**Change Categories:**

**Major Changes (High Risk):**
- New clinical functionality
- Changes to clinical algorithms
- Database structure modifications
- Integration with new systems
- Requires full safety assessment

**Minor Changes (Lower Risk):**
- Bug fixes (non-safety related)
- Performance improvements
- Cosmetic UI changes
- May require streamlined assessment

**Safety Assessment of Changes:**
1. **Impact Analysis**: What could this change affect?
2. **Hazard Review**: Could it introduce new hazards?
3. **Risk Assessment**: Assess changed/new risks
4. **Control Measures**: Implement necessary controls
5. **Testing**: Validate safety of the change
6. **Documentation**: Update safety documentation
7. **Release**: Controlled deployment with monitoring

**Version Control:**
- Maintain clear version history
- Link safety documentation to versions
- Provide version-specific safety information
- Manage upgrade paths safely

**Emergency Changes:**
Even urgent bug fixes require safety consideration to ensure the fix doesn't introduce new risks.`,
        keyPoints: [
          "All changes require safety consideration",
          "Change risk determines assessment level",
          "Safety documentation must stay current"
        ]
      },
      {
        title: "Post-Deployment Monitoring",
        content: `Manufacturers must actively monitor product safety after release:

**Vigilance Activities:**

**1. Incident Monitoring**
- Establish incident reporting channels
- Triage and investigate reported issues
- Identify safety-critical incidents
- Take corrective action promptly

**2. Feedback Collection**
- User feedback mechanisms
- Customer satisfaction surveys
- Usability monitoring
- Safety complaint handling

**3. Performance Monitoring**
- System reliability metrics
- Error logs and alerts
- User behaviour analytics
- Integration health checks

**4. Hazard Surveillance**
- Emerging risk identification
- Industry safety alerts
- Regulatory notifications
- Security vulnerability tracking

**5. Trend Analysis**
- Pattern identification in incidents
- Frequency analysis
- Root cause themes
- Proactive risk mitigation

**Reporting Obligations:**
Manufacturers must report serious safety incidents to:
- MHRA (Medicines and Healthcare products Regulatory Agency)
- Customers (deploying organisations)
- NHS Digital (where applicable)

**Continuous Improvement:**
Use post-market data to:
- Refine safety features
- Improve user experience
- Update safety documentation
- Inform future development`,
        keyPoints: [
          "Active monitoring is mandatory",
          "Multiple data sources required",
          "Must report serious incidents",
          "Learning drives improvement"
        ]
      }
    ]
  },
  {
    id: "hazard_identification",
    title: "Hazard Identification",
    duration: 25,
    icon: "AlertTriangle",
    sections: [
      {
        title: "What is a Clinical Hazard?",
        content: `A clinical hazard is a potential source of harm to patients arising from the use (or misuse) of a health IT system.

**Formal Definition (from DCB0129):**
"A circumstance, agent or action with the potential to cause harm to patients through the use or failure of health IT."

**Key Concepts:**

**Potential vs Actual:**
- A hazard is potential harm, not an incident that has occurred
- Hazards exist even if they've never caused actual harm
- Proactive identification prevents harm

**Direct and Indirect:**
- **Direct hazards**: System directly harms patient (e.g., incorrect medication dose displayed)
- **Indirect hazards**: System indirectly contributes to harm (e.g., delays treatment by being unavailable)

**Clinical Focus:**
Not all system failures are clinical hazards:
- ✓ Wrong patient record displayed → Clinical hazard
- ✗ Logo doesn't display correctly → Not a clinical hazard
- ✓ Slow loading delays urgent access → Clinical hazard
- ✗ Menu item in wrong order → Usually not a clinical hazard`,
        keyPoints: [
          "Hazards are potential harm, not actual incidents",
          "Clinical impact determines if it's a clinical hazard",
          "Both direct and indirect harm count"
        ]
      },
      {
        title: "Sources of Clinical Hazards",
        content: `Clinical hazards can arise from multiple sources:

**1. System Failures**
- Software bugs and defects
- Hardware failures
- Network and connectivity issues
- System crashes or freezes
- Data corruption
- Performance degradation

*Example: Prescription system crashes during busy clinic, preventing medication orders*

**2. User Errors**
- Incorrect data entry
- Misinterpreting information
- Skipping safety checks
- Using workarounds
- Inadequate training
- Fatigue and distractions

*Example: Clinician selects wrong patient from search results due to similar names*

**3. Data Integrity Issues**
- Incomplete data
- Inaccurate data
- Inconsistent data across systems
- Data migration errors
- Synchronisation failures
- Data loss

*Example: Allergy information doesn't transfer during system integration*

**4. Integration Problems**
- Interface failures
- Data mapping errors
- Timing and sequencing issues
- Incompatible systems
- Update conflicts
- Message loss or corruption

*Example: Lab results don't appear in GP system due to failed interface*

**5. Security Vulnerabilities**
- Unauthorised access
- Data breaches
- Malware and ransomware
- Denial of service attacks
- Insider threats
- Privacy violations

*Example: Cyber attack makes patient records inaccessible during emergency*

**6. Design and Usability Issues**
- Confusing interfaces
- Similar-looking options
- Inadequate warnings
- Missing safety features
- Poor workflow support
- Accessibility barriers

*Example: Delete button placed next to Save button, causing accidental data loss*`,
        keyPoints: [
          "Multiple potential sources of hazards",
          "Technical and human factors both matter",
          "Consider the whole system ecosystem"
        ]
      },
      {
        title: "Hazard Identification Techniques",
        content: `Systematic methods for identifying clinical hazards:

**1. Brainstorming Sessions**
- Multidisciplinary team workshops
- Clinical and technical staff together
- Structured "what if?" discussions
- Build on each other's ideas
- Record all suggestions

*Best for: Initial hazard identification, engaging stakeholders*

**2. Use Case Analysis**
- Walk through clinical scenarios step-by-step
- Identify what could go wrong at each step
- Consider both typical and edge cases
- Include error scenarios
- Think about different user types

*Best for: Identifying workflow-related hazards*

**3. Failure Mode and Effects Analysis (FMEA)**
- Systematic breakdown of system components
- Identify potential failure modes
- Assess effects of each failure
- Prioritise based on risk
- Structured documentation

*Best for: Technical systems, comprehensive analysis*

**4. Historical Incident Review**
- Review incidents from similar systems
- Learn from industry safety alerts
- Analyse near-misses
- Study regulatory warnings
- Research published case studies

*Best for: Learning from experience, validating completeness*

**5. User Observation and Feedback**
- Watch how people actually use the system
- Identify unintended uses and workarounds
- Collect user concerns and complaints
- Conduct usability testing
- Regular user feedback sessions

*Best for: Real-world usage patterns, usability hazards*

**6. Expert Review**
- Clinical expert assessment
- Safety expert evaluation
- Independent review
- Structured checklists
- Peer review

*Best for: Validation, specialist clinical insights*`,
        keyPoints: [
          "Use multiple techniques for comprehensive coverage",
          "Involve diverse stakeholders",
          "Systematic approaches are most effective"
        ]
      },
      {
        title: "Documenting Hazards in the Hazard Log",
        content: `Every identified hazard must be documented in the Hazard Log:

**Essential Information for Each Hazard:**

**1. Hazard Identification**
- Unique hazard identifier (e.g., HAZ-001)
- Descriptive title
- Date identified
- Identified by (person/method)

**2. Hazard Description**
- Detailed description of the hazard
- Clinical scenario(s) where it could occur
- Affected system components/functions
- Potential clinical consequences

**3. Cause Analysis**
- What could trigger this hazard?
- Contributing factors
- Preconditions required

**4. Effect Analysis**
- Who could be harmed?
- What harm could occur?
- Under what circumstances?

**5. Initial Risk Assessment**
- Severity rating
- Likelihood rating
- Initial risk score
- Risk classification

**6. Risk Controls**
- Planned/implemented control measures
- Type of control (technical/procedural/training)
- Responsibility for implementation
- Implementation date

**7. Residual Risk Assessment**
- Severity rating after controls
- Likelihood rating after controls
- Residual risk score
- Acceptability determination

**8. Status Tracking**
- Current status (Open/In Progress/Closed)
- Review dates
- Sign-off approvals
- Change history

**Best Practices:**
- Use clear, unambiguous language
- Be specific about clinical scenarios
- Include examples where helpful
- Keep entries current
- Version control the Hazard Log`,
        keyPoints: [
          "Comprehensive documentation is required",
          "Hazard Log is a living document",
          "Track from identification to closure"
        ]
      },
      {
        title: "Hazard Log Management Throughout Lifecycle",
        content: `The Hazard Log must be actively managed throughout the system lifecycle:

**Development Phase:**
- Identify hazards during design
- Assess risks early
- Plan control measures
- Track implementation

**Testing Phase:**
- Validate that controls work
- Identify new hazards from testing
- Assess residual risks
- Prepare for deployment

**Deployment:**
- Final hazard review
- Confirm all critical hazards mitigated
- Declare residual risks
- Obtain sign-offs

**Operational Use:**
- Monitor for new hazards
- Track incident-related hazards
- Review existing hazards periodically
- Update based on real-world experience

**Changes and Updates:**
- Assess impact on existing hazards
- Identify new hazards from changes
- Re-assess affected risks
- Update documentation

**Decommissioning:**
- Identify hazards from system removal
- Manage transition safely
- Archive Hazard Log appropriately

**Governance:**
- Regular review meetings
- Management oversight
- Audit compliance
- Continuous improvement`,
        keyPoints: [
          "Hazard Log spans entire lifecycle",
          "Regular reviews are essential",
          "Changes trigger hazard reassessment"
        ]
      },
      {
        title: "Practical Examples from NHS Systems",
        content: `Real-world examples of clinical hazards in NHS systems:

**Example 1: Electronic Prescribing**

*Hazard:* Drug-drug interaction checker fails to alert
*Cause:* Incomplete drug interaction database
*Effect:* Patient prescribed contraindicated medication combination
*Initial Risk:* Severity = Catastrophic (5), Likelihood = Medium (3), Score = 15
*Controls:* 
- Regular database updates
- Manual review of high-risk combinations
- User training on limitations
- Warning if interaction data unavailable
*Residual Risk:* Severity = Major (4), Likelihood = Low (2), Score = 8

**Example 2: Patient Portal**

*Hazard:* Patient sees another patient's test results
*Cause:* Session management flaw allows access to wrong record
*Effect:* Confidentiality breach, potential inappropriate self-treatment
*Initial Risk:* Severity = Major (4), Likelihood = Medium (3), Score = 12
*Controls:*
- Strict session isolation
- Two-factor authentication
- Automatic session timeout
- Audit logging
- Regular security testing
*Residual Risk:* Severity = Major (4), Likelihood = Very Low (1), Score = 4

**Example 3: Appointment Booking System**

*Hazard:* Urgent appointment coded as routine
*Cause:* Unclear urgency categories, user error
*Effect:* Delayed treatment for urgent condition
*Initial Risk:* Severity = Major (4), Likelihood = High (4), Score = 16
*Controls:*
- Clear colour-coded urgency levels
- Mandatory urgency selection
- Confirmation dialogue for urgent cases
- Clinical decision support
- Staff training
*Residual Risk:* Severity = Major (4), Likelihood = Low (2), Score = 8

**Example 4: Mobile Clinical App**

*Hazard:* App displays outdated patient data when offline
*Cause:* Synchronisation delay not visible to user
*Effect:* Clinical decisions based on out-of-date information
*Initial Risk:* Severity = Catastrophic (5), Likelihood = High (4), Score = 20
*Controls:*
- Prominent "last updated" timestamp
- Automatic refresh prompts
- Warning banner when data stale
- Network status indicator
- Mandatory refresh for critical data
*Residual Risk:* Severity = Major (4), Likelihood = Low (2), Score = 8`,
        keyPoints: [
          "Real hazards require systematic analysis",
          "Multiple controls often needed to reduce risk",
          "Documentation shows the thought process"
        ]
      },
      {
        title: "Interactive Hazard Identification Exercise",
        content: `Let's practice hazard identification with a scenario:

**Scenario: GP Clinical System with New Feature**

Your practice is implementing a new "red flag symptoms" alert feature in the clinical system. When a patient reports certain symptoms during a consultation, the system will display a pop-up alert suggesting immediate investigations or referrals.

**Consider these aspects:**
1. What could go wrong with this feature?
2. What hazards might it introduce?
3. How could it fail to work as intended?
4. What are the clinical consequences?

**Potential Hazards to Consider:**

**Alert Fatigue**
- Too many alerts reduce attention to genuine red flags
- Clinicians may start dismissing alerts without reading
- Critical alerts missed among routine ones

**False Negatives (Missed Red Flags)**
- System doesn't recognise atypical presentations
- Alert doesn't trigger when it should
- Delayed diagnosis of serious condition

**False Positives (Unnecessary Alerts)**
- Alert triggers inappropriately
- Causes anxiety and unnecessary investigations
- Wastes resources and time

**Technical Failures**
- Alert system fails silently
- No fallback mechanism
- Clinicians assume system is working when it isn't

**User Interface Issues**
- Alert easily dismissed by accident
- Unclear action recommendations
- Poor visibility of alert

**Over-Reliance**
- Clinicians depend on system instead of clinical judgement
- Reduction in thorough clinical assessment
- Gaps in system knowledge not recognised

**Think about:**
- What controls would you implement?
- How would you assess the risks?
- What would make this feature safe?

This exercise demonstrates the systematic thinking required for effective hazard identification.`,
        keyPoints: [
          "Consider multiple failure modes",
          "Think about both technical and human factors",
          "Systematic analysis reveals non-obvious hazards"
        ]
      }
    ]
  },
  {
    id: "risk_assessment",
    title: "Clinical Risk Assessment",
    duration: 20,
    icon: "TrendingUp",
    sections: [
      {
        title: "Severity Classification",
        content: `Severity measures the worst credible clinical consequence if a hazard causes harm:

**Catastrophic (5) - Death or Permanent Severe Harm**
- Death of patient
- Permanent severe disability
- Life-threatening condition
- Permanent loss of major bodily function

*Examples:*
- Wrong patient receives major surgery
- Fatal medication administered
- Critical diagnosis completely missed
- Life-support system fails catastrophically

**Major (4) - Long-term Harm or Major Injury**
- Long-term incapacity (> 28 days)
- Permanent moderate disability
- Significant psychological trauma
- Major injuries requiring extensive treatment

*Examples:*
- Incorrect cancer treatment pathway
- Major medication error requiring hospitalisation
- Missed fracture leading to permanent disability
- Delayed treatment of stroke

**Moderate (3) - Short-term Harm Requiring Treatment**
- Medical treatment required
- Semi-permanent harm (< 28 days)
- Temporary disability
- Moderate psychological impact

*Examples:*
- Medication error requiring monitoring
- Delayed diagnosis of treatable condition
- Incorrect test ordered, requiring repeat
- Minor surgical complication

**Minor (2) - First Aid Treatment**
- First aid treatment sufficient
- Minor injuries
- Low psychological impact
- Quick recovery expected

*Examples:*
- Missed routine health check
- Incorrect lifestyle advice given
- Brief delay in non-urgent appointment
- Minor administrative error

**Negligible (1) - No Injury or Health Effect**
- No treatment required
- No lasting effects
- Minimal inconvenience
- Negligible clinical impact

*Examples:*
- Appointment reminder sent to wrong address (patient still attends)
- Printing error on non-clinical document
- Cosmetic issue with no clinical impact

**Key Principles:**
- Rate the WORST CREDIBLE outcome, not the most likely
- Consider vulnerable patient populations
- Include psychological as well as physical harm
- Think about cascading effects`,
        keyPoints: [
          "Five severity levels from Negligible to Catastrophic",
          "Rate worst credible outcome, not average",
          "Consider all types of harm"
        ]
      },
      {
        title: "Likelihood Estimation",
        content: `Likelihood estimates how frequently a hazard might lead to harm:

**Very High (5) - Certain or Almost Certain**
- Expected to occur repeatedly
- Will probably occur multiple times
- Frequency: May occur several times per year
- Probability: > 50% chance

*Indicators:*
- Common user error patterns
- Known frequent system issues
- No effective controls in place
- Widespread similar incidents reported

**High (4) - Probable, Likely to Occur**
- Will probably occur
- Can be expected to occur
- Frequency: Likely to occur at least once per year
- Probability: 10-50% chance

*Indicators:*
- Regular opportunity for error
- Partial controls only
- Some incidents recorded
- Complex user interactions required

**Medium (3) - Possible, Could Occur**
- Might occur
- Could happen at some point
- Frequency: Might occur once in 1-5 years
- Probability: 1-10% chance

*Indicators:*
- Could happen under certain circumstances
- Moderate controls in place
- Few incidents but theoretically possible
- Requires specific circumstances

**Low (2) - Unlikely, Not Expected**
- Probably won't occur
- Unlikely but possible
- Frequency: Might occur once in 5-25 years
- Probability: 0.1-1% chance

*Indicators:*
- Would require unusual circumstances
- Good controls in place
- Very rare in practice
- Multiple barriers to occurrence

**Very Low (1) - Rare, Will Probably Never Occur**
- Highly unlikely to ever occur
- Only in exceptional circumstances
- Frequency: May occur less than once in 25 years
- Probability: < 0.1% chance

*Indicators:*
- Theoretical possibility only
- Excellent controls in place
- Never occurred in similar systems
- Multiple robust safeguards

**Estimation Considerations:**
- Use available data (incidents, near-misses)
- Consider similar systems' experience
- Account for control measure effectiveness
- Be realistic, not optimistic
- Document estimation basis
- Review as experience grows`,
        keyPoints: [
          "Five likelihood levels from Very Low to Very High",
          "Base estimates on evidence where possible",
          "Consider effectiveness of controls"
        ]
      },
      {
        title: "Risk Rating Matrix and Scoring",
        content: `The Risk Rating Matrix combines Severity and Likelihood to determine overall risk:

**Risk Score = Severity × Likelihood**

**Risk Rating Matrix:**

\`\`\`
Likelihood │ Severity
          │  1    2    3    4    5
────────────┼─────────────────────────
    5     │  5   10   15   20   25
    4     │  4    8   12   16   20
    3     │  3    6    9   12   15
    2     │  2    4    6    8   10
    1     │  1    2    3    4    5
\`\`\`

**Risk Classifications:**

**🔴 UNACCEPTABLE RISK (15-25)**
- Immediate action required
- Cannot deploy/continue use
- Senior management escalation
- May require system redesign
- Intensive mitigation measures

**🟡 UNDESIRABLE RISK (8-12)**
- Significant risk requiring controls
- Senior management sign-off needed
- Document acceptance rationale
- Enhanced monitoring required
- Plan for further reduction

**🟢 ACCEPTABLE RISK (4-6)**
- Risk acceptable with current controls
- Routine monitoring
- Document in Hazard Log
- No additional controls required initially
- Review periodically

**⚪ ACCEPTABLE RISK (1-3)**
- Very low risk
- Standard monitoring
- Minimal documentation
- Routine review

**Application Examples:**

*Example 1:*
Hazard: Medication list doesn't display allergies prominently
Severity: Major (4) - Could cause serious allergic reaction
Likelihood: High (4) - Common oversight in busy clinics
Risk Score: 4 × 4 = 16 (UNACCEPTABLE - Red)
Action: Redesign to make allergies impossible to miss

*Example 2:*
Hazard: System runs slowly at peak times
Severity: Moderate (3) - Could delay treatment
Likelihood: High (4) - Occurs regularly
Risk Score: 3 × 4 = 12 (UNDESIRABLE - Amber)
Action: Performance upgrade, accept residual risk with monitoring

*Example 3:*
Hazard: Printed report has incorrect header
Severity: Negligible (1) - No clinical impact
Likelihood: Medium (3) - Occasional occurrence
Risk Score: 1 × 3 = 3 (ACCEPTABLE - Green)
Action: Document, fix in next routine update`,
        keyPoints: [
          "Risk score guides decision-making",
          "Higher scores require stronger action",
          "Some risk ratings need senior approval"
        ]
      },
      {
        title: "Initial Risk vs Residual Risk",
        content: `Risk assessment occurs at two stages:

**Initial Risk (Inherent Risk)**
The risk before any control measures are implemented.

**Purpose:**
- Understand the underlying hazard
- Identify what needs to be controlled
- Prioritise control efforts
- Demonstrate improvement

**Assessment:**
- Severity: What's the worst outcome if it happens?
- Likelihood: How often would it happen with NO controls?
- Documents the "raw" hazard

*Example:*
Hazard: System displays wrong patient record
Initial Severity: Catastrophic (5) - Wrong treatment
Initial Likelihood: High (4) - Easy to make selection error
Initial Risk: 5 × 4 = 20 (UNACCEPTABLE)

**Residual Risk**
The risk remaining AFTER control measures are implemented.

**Purpose:**
- Confirm controls are effective
- Demonstrate risk reduction
- Determine if acceptable
- Inform deployment decisions

**Assessment:**
- Severity: May stay the same (worst case unchanged)
- Likelihood: Reduced by controls
- Documents the "managed" hazard

*Example (continued):*
Controls implemented:
- Three-point patient verification
- Photo display
- Colour-coded alerts
- User training

Residual Severity: Catastrophic (5) - Worst case still serious
Residual Likelihood: Very Low (1) - Multiple barriers now in place
Residual Risk: 5 × 1 = 5 (ACCEPTABLE)

**Key Principles:**

1. **Severity Often Stays the Same**
   - The worst possible outcome usually doesn't change
   - Controls typically reduce likelihood, not severity
   - Exception: Controls that limit the extent of harm

2. **Likelihood Should Decrease**
   - Effective controls reduce probability
   - Good design makes errors less likely
   - Training and procedures reduce human error

3. **Document Both Risks**
   - Shows the value of controls
   - Demonstrates due diligence
   - Supports decision-making

4. **Aim for Acceptable Residual Risk**
   - Residual risk must be ALARP
   - May need multiple control measures
   - Balance cost vs benefit`,
        keyPoints: [
          "Initial risk is before controls",
          "Residual risk is after controls",
          "Controls should significantly reduce risk"
        ]
      },
      {
        title: "Risk Acceptability Criteria and ALARP",
        content: `Not all risks can be eliminated. Risks must be reduced to ALARP - As Low As Reasonably Practicable.

**ALARP Principle:**

Risks must be reduced unless:
- The cost is grossly disproportionate to the safety benefit, OR
- Further risk reduction is technically impossible

**Acceptability Framework:**

**UNACCEPTABLE Region (Red - 15-25)**
- Risk is intolerable
- Cannot proceed
- Must reduce risk before deployment
- No amount of benefit justifies the risk

*Action: Mandatory risk reduction*

**ALARP Region (Amber - 8-12)**
- Risk is tolerable only if further reduction is impractical
- Must demonstrate ALARP
- Senior management sign-off required
- Document why further reduction not reasonably practicable

*Action: Reduce if reasonably practicable, otherwise accept with justification*

**Broadly Acceptable Region (Yellow/Green - 1-6)**
- Risk is acceptable
- Further reduction may not be necessary
- Routine monitoring sufficient
- Document and move forward

*Action: Accept and monitor*

**Demonstrating ALARP:**

To show a risk is ALARP, document:

1. **Control Measures Considered**
   - What options were evaluated?
   - Technical solutions
   - Procedural controls
   - Training approaches

2. **Controls Implemented**
   - What was actually done?
   - Why these specific controls?
   - Evidence of effectiveness

3. **Controls Rejected**
   - What options were not implemented?
   - Why not (cost, practicality, effectiveness)?
   - Was the cost grossly disproportionate?

4. **Residual Risk Justification**
   - Why is remaining risk acceptable?
   - What monitoring will be in place?
   - Who has accepted the risk?

**Grossly Disproportionate:**
The cost is grossly disproportionate if:
- It vastly exceeds the safety benefit
- It would make the system economically unviable
- It requires technology that doesn't exist
- The sacrifice is clearly unreasonable

**Example ALARP Demonstration:**

Hazard: Mobile app might display data from previous patient if network glitches during patient change

Initial Risk: Severity 5, Likelihood 3 = 15 (Red)

Controls Considered:
1. Automatic logout on every patient change ✓ Implemented
2. Require network connection for any data display ✗ Rejected - would make app unusable in poor signal areas
3. Complete data wipe on patient change ✓ Implemented
4. Biometric verification for each patient access ✗ Rejected - grossly disproportionate delay to clinical workflow
5. Large warning banner when offline ✓ Implemented

Residual Risk: Severity 5, Likelihood 1 = 5 (Green)

ALARP Justification:
- Implemented three effective controls
- Rejected controls would severely impact usability without significant additional safety benefit
- Residual risk is now acceptable
- Monitoring through incident reporting in place

Accepted by: Clinical Director and Chief Information Officer`,
        keyPoints: [
          "ALARP means as low as reasonably practicable",
          "Must document why further reduction not done",
          "Senior sign-off required for amber risks"
        ]
      },
      {
        title: "Risk Control Measures: Technical, Procedural, Training",
        content: `Control measures reduce risk through different mechanisms:

**Technical Controls**
Built into the system itself - most reliable as they don't depend on human compliance.

*Examples:*
- **Data Validation**: Prevent invalid entries (e.g., dates in the future)
- **Alerts and Warnings**: Automatic drug interaction checks
- **Access Controls**: Role-based permissions
- **Error Detection**: Checksum validation, duplicate detection
- **Fail-safes**: Safe defaults, undo functionality
- **Automation**: Reduce manual steps prone to error
- **Design Features**: Clear labelling, colour coding, confirmations

*Strengths:*
- Always active
- Consistent application
- Reduces human error

*Weaknesses:*
- Can fail if bugs exist
- May add complexity
- Can be bypassed if poorly designed

**Procedural Controls**
Defined processes and policies - depend on users following them.

*Examples:*
- **Standard Operating Procedures**: Step-by-step instructions
- **Double-Check Policies**: Second person verification
- **Escalation Procedures**: When to seek senior advice
- **Maintenance Schedules**: Regular system checks
- **Incident Reporting**: Clear reporting pathways
- **Access Management**: Password change policies
- **Backup Procedures**: Data protection processes

*Strengths:*
- Flexible and adaptable
- Can cover complex scenarios
- Relatively easy to implement

*Weaknesses:*
- Depend on compliance
- Can be forgotten or ignored
- Degrade over time

**Training and Awareness Controls**
Ensuring users have knowledge and skills - foundation for safe use.

*Examples:*
- **Initial Training**: Comprehensive system training
- **Refresher Training**: Regular updates
- **Safety Briefings**: Awareness of specific hazards
- **Competency Assessment**: Testing understanding
- **On-the-Job Support**: Super-users, helpdesk
- **Safety Communications**: Newsletters, alerts
- **Simulation Training**: Practice in safe environment

*Strengths:*
- Develops good practice habits
- Promotes safety culture
- Empowers users

*Weaknesses:*
- Training forgotten over time
- Variable effectiveness
- Requires ongoing investment

**Hierarchy of Controls**
Most effective approach uses multiple layers:

1. **Eliminate the hazard** (redesign to remove it)
2. **Engineering controls** (technical safeguards)
3. **Administrative controls** (procedures and policies)
4. **Training and PPE** (user knowledge and awareness)

**Combined Approach Example:**

Hazard: Wrong patient selected from search results

Controls:
- **Technical**: 
  - Prominent patient photo display
  - Colour-coded allergy warnings
  - Confirmation dialogue before opening record
  - Three-point verification prompt
  
- **Procedural**:
  - Mandatory verification policy
  - Incident reporting requirement
  - Regular audit of patient selection errors
  
- **Training**:
  - Safe searching techniques
  - Verification process training
  - Case studies of near-misses
  - Regular safety briefings

This layered approach provides defence in depth - if one control fails, others still protect.`,
        keyPoints: [
          "Three main types of controls",
          "Technical controls most reliable",
          "Layered approach provides best protection"
        ]
      },
      {
        title: "Case Studies: Real Risk Assessments",
        content: `**Case Study 1: Community Nursing App**

**Background:**
Mobile app for community nurses to record patient visits, access care plans, and order supplies.

**Hazard:**
App might allow updates to wrong patient record if nurse doesn't notice patient change on device.

**Initial Risk Assessment:**
- **Severity**: Catastrophic (5)
  *Rationale: Medications or treatments could be given to wrong patient*
- **Likelihood**: High (4)
  *Rationale: Nurses see many patients daily, easy to lose track of which record is open*
- **Initial Risk Score**: 5 × 4 = 20 (UNACCEPTABLE - Red)

**Control Measures Implemented:**

*Technical:*
- Large patient name banner (constant visibility)
- Patient photo on every screen
- Colour-coded patient identification
- Automatic timeout after 15 minutes
- "Confirm patient identity" prompt before any update
- GPS location check (alerts if patient location doesn't match)

*Procedural:*
- Mandatory patient verification policy
- Three-point identification check
- Patient sign-off on visit notes
- Weekly audit of visit records

*Training:*
- Safe device use training
- Patient verification emphasis
- Error scenario discussions
- Monthly safety bulletins

**Residual Risk Assessment:**
- **Severity**: Catastrophic (5)
  *Rationale: Worst case remains the same if all controls fail*
- **Likelihood**: Very Low (1)
  *Rationale: Multiple barriers make this very unlikely*
- **Residual Risk Score**: 5 × 1 = 5 (ACCEPTABLE - Green)

**ALARP Justification:**
Further controls considered but rejected:
- Biometric patient verification: Grossly disproportionate - not all patients can provide biometrics, would significantly delay care
- Lock record after each entry: Would make workflow impractical for typical visits involving multiple entries
- Mandatory QR code scanning: Many patients don't have QR codes, system dependency issue

**Sign-off**: Accepted by Director of Nursing and Medical Director

**Monitoring**: Monthly review of incident reports, quarterly system audit

---

**Case Study 2: Hospital A&E Triage System**

**Background:**
Electronic system for recording patient triage assessments in busy A&E department.

**Hazard:**
System might assign incorrect triage category if user selects wrong option or if clinical decision support fails.

**Initial Risk Assessment:**
- **Severity**: Major (4)
  *Rationale: Incorrect triage could delay treatment of seriously ill patient*
- **Likelihood**: Medium (3)
  *Rationale: High-pressure environment, complex decisions, system dependency*
- **Initial Risk Score**: 4 × 3 = 12 (UNDESIRABLE - Amber)

**Control Measures Implemented:**

*Technical:*
- Clinical decision support algorithm
- Red flag symptom alerts
- Escalation prompts for concerning combinations
- Summary review screen before finalising
- "Are you sure?" confirmation for low-priority with red flags
- Automatic senior nurse notification for category changes

*Procedural:*
- Double-check policy for category 3 and below with red flags
- Senior nurse override required for certain combinations
- Mandatory reassessment if waiting time exceeds threshold
- Daily audit of triage decisions

*Training:*
- Manchester Triage System training
- System-specific training
- Regular case review sessions
- Simulation scenarios

**Residual Risk Assessment:**
- **Severity**: Major (4)
  *Rationale: Serious harm still possible if all controls fail*
- **Likelihood**: Low (2)
  *Rationale: Controls significantly reduce likelihood but can't eliminate completely*
- **Residual Risk Score**: 4 × 2 = 8 (UNDESIRABLE - Amber)

**ALARP Justification:**
The risk remains in the UNDESIRABLE range even with controls because:
- Human judgement is inherently involved in triage
- Complete elimination of judgement errors is impossible
- Further technical controls would override clinical decision-making inappropriately
- Current controls represent best balance between safety and clinical autonomy

**Risk Acceptance:**
This residual amber risk was formally accepted by:
- Clinical Director for Emergency Medicine
- Chief Nursing Officer
- Medical Director

With conditions:
- Monthly audit of triage decisions
- Quarterly review of incidents
- Annual review of clinical decision support algorithm
- Immediate investigation of any serious incidents

**Outcome:**
System deployed with enhanced monitoring. After 6 months:
- No serious incidents related to triage errors
- 12 near-misses identified and learned from
- Clinical decision support refined based on experience
- User feedback very positive

This case demonstrates that some residual amber risks may be acceptable with proper oversight and senior sign-off.`,
        keyPoints: [
          "Real assessments show systematic approach",
          "Multiple controls typically required",
          "Senior sign-off essential for amber risks",
          "Monitoring validates risk decisions"
        ]
      }
    ]
  },
  {
    id: "safety_case",
    title: "Safety Case Reports",
    duration: 20,
    icon: "FileText",
    sections: [
      {
        title: "Purpose of Clinical Safety Case Report",
        content: `The Clinical Safety Case Report is the cornerstone document demonstrating that a health IT system is safe for deployment and use.

**Primary Purpose:**
To provide structured evidence and argument that clinical risks have been systematically managed and are acceptable.

**Key Functions:**

**1. Evidence of Due Diligence**
- Demonstrates systematic risk management
- Shows compliance with DCB0129/DCB0160
- Provides audit trail of safety activities
- Documents decision-making rationale

**2. Communication Tool**
- Informs stakeholders of safety status
- Supports deployment decisions
- Facilitates review and approval
- Enables informed risk acceptance

**3. Accountability Document**
- Records who assessed what risks
- Documents approvals and sign-offs
- Assigns responsibilities clearly
- Creates permanent safety record

**4. Living Documentation**
- Updated as system changes
- Reflects current safety status
- Tracks risk evolution
- Demonstrates continuous management

**Who Uses the Safety Case:**

**Deploying Organisation (DCB0129):**
- Senior management (for approval decisions)
- Clinical Safety Officer (for ongoing management)
- Project teams (for implementation)
- Auditors and regulators (for compliance)

**Manufacturers (DCB0160):**
- Product management (for release decisions)
- Development teams (for requirements)
- Customers (for deployment risk assessment)
- Regulatory bodies (for compliance)

**When is it Required:**

- Before initial system deployment
- Before major system changes or upgrades
- Before deployment in new clinical settings
- Periodically (annual review minimum)
- After significant safety incidents

**Legal Status:**

The Safety Case is a formal document that may be:
- Required in legal proceedings
- Requested by regulators (CQC, MHRA)
- Used in incident investigations
- Subject to Freedom of Information requests

Therefore, it must be accurate, complete, and defensible.`,
        keyPoints: [
          "Central document for demonstrating safety",
          "Used by multiple stakeholders",
          "Legal and regulatory significance",
          "Must be kept current"
        ]
      },
      {
        title: "Required Contents of Safety Case Report",
        content: `A comprehensive Clinical Safety Case Report contains the following sections:

**1. EXECUTIVE SUMMARY**
- High-level overview of the system
- Summary of key hazards and risks
- Overall safety conclusion
- Critical recommendations
- Readership: Senior management, non-technical stakeholders

**2. SYSTEM DESCRIPTION**
- System name and version
- Intended purpose and clinical use
- Key functionality
- User groups and roles
- Clinical and technical architecture
- Integration with other systems
- Deployment context

**3. SCOPE AND BOUNDARIES**
- What is included in the safety assessment
- What is excluded and why
- Clinical scope (which clinical processes)
- Technical scope (which system components)
- Organisational scope (which departments, sites)
- Assumptions and dependencies
- Limitations of the assessment

**4. CLINICAL SAFETY MANAGEMENT PROCESS**
- Overview of how safety was managed
- Roles and responsibilities
- Reference to Clinical Safety Plan
- Standards and methodologies used
- Quality assurance processes

**5. HAZARD ANALYSIS**
- Methods used for hazard identification
- Summary of identified hazards
- Reference to Hazard Log
- Categorisation of hazards
- Completeness argument (why we believe we found them all)

**6. RISK ASSESSMENT RESULTS**
- Risk assessment methodology
- Summary of risk ratings
- Initial vs residual risk comparison
- Risk distribution (how many in each category)
- Highest rated risks highlighted

**7. RISK CONTROLS AND MITIGATION**
- Control measures by category:
  - Technical controls
  - Procedural controls
  - Training and awareness
- Effectiveness evidence for controls
- Implementation status
- Responsibility assignments

**8. RESIDUAL RISK EVALUATION**
- Summary of all residual risks
- ALARP demonstration
- Acceptability determination
- Outstanding actions
- Risk acceptance decisions

**9. SAFETY RECOMMENDATIONS**
- Specific recommendations for:
  - Deployment (what conditions must be met)
  - Operation (how to maintain safety)
  - Monitoring (what to watch for)
  - Users (training and awareness needs)
  - Management (governance requirements)

**10. CONCLUSIONS**
- Overall safety determination
- Deployment readiness assessment
- Key caveats and conditions
- Future safety work planned

**11. APPENDICES**
- Hazard Log (full or summary)
- Risk assessment details
- Control measure specifications
- Safety test results
- Stakeholder consultation records
- References and supporting documents
- Glossary and abbreviations

**12. DOCUMENT CONTROL**
- Document version and date
- Author(s) and contributors
- Reviewers and approvers
- Distribution list
- Change history
- Next review date`,
        keyPoints: [
          "Structured format ensures completeness",
          "Technical and non-technical sections",
          "Evidence-based throughout",
          "Formal document control required"
        ]
      },
      {
        title: "Review and Approval Process",
        content: `The Safety Case must undergo rigorous review and approval before deployment:

**Review Stages:**

**1. Self-Review (CSO)**
- Clinical Safety Officer reviews own work
- Check completeness and accuracy
- Ensure logical consistency
- Verify evidence supports conclusions
- Confirm calculations are correct

**2. Peer Review (Clinical)**
- Independent clinical expert review
- Validate clinical scenarios
- Check severity ratings are appropriate
- Confirm hazards are clinically credible
- Assess adequacy of controls from clinical perspective

**3. Technical Review**
- IT/technical expert review
- Verify technical descriptions accurate
- Assess feasibility of technical controls
- Check integration and interface risks
- Validate technical risk assessments

**4. Management Review**
- Senior management (clinical and executive)
- Understand key risks and their implications
- Review risk acceptance recommendations
- Confirm resources for controls are available
- Assess organisational readiness

**5. Independent Review (Recommended for High-Risk Systems)**
- External clinical safety expert
- Completely independent assessment
- Challenge assumptions
- Verify comprehensiveness
- Provide objective opinion

**Approval Levels:**

**LOW RISK SYSTEMS (All residual risks Green)**
- Clinical Safety Officer approval
- IT Director/Manager approval
- Clinical Lead sign-off

**MODERATE RISK SYSTEMS (Some residual risks Yellow)**
- All of the above, plus:
- Medical Director/Chief Clinical Officer approval
- Chief Information Officer approval

**HIGHER RISK SYSTEMS (Any residual risks Amber/Red)**
- All of the above, plus:
- Chief Executive or Board approval
- Independent review recommended
- May require external regulatory consultation

**Approval Documentation:**

Each approver must provide:
- Signature and date
- Job title and role
- Explicit statement of approval
- Any conditions or caveats
- Acknowledgement of residual risks

**Example Approval Statement:**

"I have reviewed the Clinical Safety Case Report for [System Name] version [X.X] and confirm that:
- The safety analysis is comprehensive and appropriate
- The risk assessments are reasonable
- The control measures are adequate
- The residual risks are acceptable and ALARP
- The system is safe for deployment subject to the recommendations in Section 9

I accept the residual risks on behalf of [Organisation Name].

Signed: [Name]
Title: Medical Director
Date: [DD/MM/YYYY]"

**Conditional Approval:**

Sometimes approval is given with conditions:
- "Approved subject to implementation of Controls HAZ-001-C1 and HAZ-003-C2"
- "Approved for pilot deployment only, full deployment requires post-pilot review"
- "Approved for [specific department], separate assessment required for other departments"

**Rejection:**

If the Safety Case is not approved:
- Document reasons for rejection
- Specify what must be addressed
- Set timescale for re-submission
- System cannot be deployed until approved

**Record Keeping:**

Maintain records of:
- All review comments
- How comments were addressed
- Approval decisions and dates
- Conditions and their completion
- Distribution of final approved version`,
        keyPoints: [
          "Multiple review stages required",
          "Approval level matches risk level",
          "Formal sign-off essential",
          "Conditions may apply"
        ]
      },
      {
        title: "Maintaining Safety Documentation Throughout Lifecycle",
        content: `Safety documentation is not "do once and forget" - it requires active maintenance:

**Continuous Maintenance Activities:**

**1. Version Control**
- Clear version numbering (e.g., v1.0, v1.1, v2.0)
- Major version for significant changes
- Minor version for updates and corrections
- Date each version
- Maintain version history

**2. Change Management**
- Every system change requires safety assessment
- Update Safety Case for significant changes
- Full re-issue for major changes
- Addendum for minor changes
- Maintain change log

**3. Incident Integration**
- Review Safety Case after any safety incident
- Update hazard log with new information
- Reassess affected risks
- Implement learning
- Document changes

**4. Periodic Reviews**
- Scheduled regular reviews (minimum annually)
- Even if no changes to system
- Check assumptions still valid
- Review effectiveness of controls
- Update based on operational experience
- Confirm risks still acceptable

**5. Regulatory Updates**
- Monitor for changes to DCB0129/DCB0160
- Update compliance demonstration
- Adopt new requirements
- Maintain alignment with standards

**When to Update Safety Case:**

**MANDATORY Updates:**
- New functionality added
- Integration with new systems
- Change to clinical processes supported
- Deployment to new departments/sites
- Major upgrades or version changes
- After serious safety incidents
- When standards change
- After annual review (even if "no change")

**Consider Updates For:**
- Cumulative minor changes
- Changes to user base
- Modified clinical context
- New evidence about risks
- Changes to control measures
- Feedback from users

**Update Process:**

**Minor Updates:**
1. Assess whether Safety Case impact
2. Update relevant sections
3. Update version (e.g., v1.2 to v1.3)
4. CSO review and approval
5. Communicate changes
6. File previous version

**Major Updates:**
1. Full review of all sections
2. Complete risk reassessment if needed
3. Update version (e.g., v1.3 to v2.0)
4. Full approval process
5. Stakeholder communication
6. Training if required
7. Archive previous version

**Living Document Practices:**

**Good Practices:**
- Regular scheduled reviews (diary entry)
- Incident review process includes Safety Case check
- Change request form prompts safety assessment
- Annual report includes Safety Case status
- Safety Case referenced in project documentation

**Avoid:**
- Letting Safety Case become outdated
- Treating it as "tick box" exercise
- Filing and forgetting
- Waiting until audit to update
- Losing track of which version is current

**Document Repository:**

Maintain organized repository:
- Current version clearly marked
- Previous versions archived
- Supporting documents linked
- Approval records attached
- Access controls appropriate
- Backup arrangements
- Retention policy followed

**Communication:**

When Safety Case is updated:
- Notify all approvers
- Inform key stakeholders
- Update any references
- Brief relevant staff
- Note in governance meeting

**Audit Readiness:**

Maintain documentation so you can demonstrate:
- Current Safety Case is up to date
- Regular reviews occur
- Changes are properly assessed
- Approvals are in place
- System is operating as assessed`,
        keyPoints: [
          "Safety Case is a living document",
          "Regular updates required",
          "Change management integration essential",
          "Version control critical"
        ]
      }
    ]
  },
  {
    id: "incident_management",
    title: "Incident Management",
    duration: 15,
    icon: "AlertCircle",
    sections: [
      {
        title: "Types of Clinical Safety Incidents",
        content: `Clinical safety incidents related to health IT systems fall into several categories:

**1. System Failure Incidents**
Incidents where the system itself fails or malfunctions.

*Examples:*
- System crashes during clinical use
- Data corruption or loss
- Integration failures causing missing information
- Network outages affecting access
- Performance issues delaying care
- Software bugs causing incorrect calculations

*Severity varies by:*
- Timing (during emergency vs routine use)
- Availability of workarounds
- Duration of outage
- Patient acuity

**2. Wrong Patient Incidents**
Patient identification errors facilitated by the system.

*Examples:*
- Wrong patient record opened
- Results or reports filed in wrong patient's record
- Treatment ordered for wrong patient
- Medication given based on wrong record
- Communication sent to wrong patient

*Always potentially serious due to:*
- Direct harm to both patients
- Privacy breach
- Difficulty detecting and correcting

**3. Medication Safety Incidents**
Errors in prescribing, dispensing, or administering medications.

*Examples:*
- Incorrect dose calculated or displayed
- Drug interaction not alerted
- Allergy information not displayed
- Medication duplication not detected
- Wrong formulation selected
- Incorrect route or frequency

*High risk because:*
- Direct pharmacological harm
- Common system function
- Multiple handoff points

**4. Diagnostic and Treatment Incidents**
Errors affecting diagnosis or treatment decisions.

*Examples:*
- Test results not displayed or filed
- Abnormal results not highlighted
- Diagnosis codes incorrectly assigned
- Treatment plans not followed due to system issues
- Decision support providing wrong advice
- Reference ranges incorrect

*Critical because:*
- Affects core clinical decision-making
- May cause significant delay in treatment
- Can lead to wrong treatment pathway

**5. Communication and Coordination Incidents**
Failures in information sharing and care coordination.

*Examples:*
- Referral not sent or received
- Discharge summary delayed or lost
- Handover information incomplete
- Care plan not shared across teams
- Alerts and notifications not delivered
- Messages lost or misdirected

*Important because:*
- Fragmented care is unsafe care
- Particularly risky at transitions
- Multiple systems involved

**6. Data Integrity Incidents**
Information quality issues affecting patient safety.

*Examples:*
- Incorrect data migrated between systems
- Data overwrites or deletions
- Synchronisation failures
- Conflicting information across systems
- Historical data inaccessible
- Audit trail failures

*Serious because:*
- Undermines trust in system
- May not be immediately apparent
- Can affect many patients

**7. Access and Security Incidents**
Unauthorised or inappropriate access to patient information.

*Examples:*
- Unauthorised viewing of records
- Data breach affecting patient care
- Ransomware preventing access
- Password sharing enabling errors
- Insufficient access delaying care
- Security measures hindering clinical use

*Significant because:*
- Privacy and confidentiality violations
- May prevent or delay necessary care
- Regulatory implications

**8. Usability and Workflow Incidents**
Design issues that contribute to errors.

*Examples:*
- Confusing interface leads to selection errors
- Required steps skipped due to workflow issues
- Similar-looking options clicked by mistake
- Critical information not visible
- Too many alerts causing alert fatigue
- Workarounds becoming routine

*Often underreported but:*
- Contribute to many other incident types
- System design issue, not just user error
- Recurrent patterns indicate design flaws

**Near Misses:**

Don't forget incidents that were caught before harm occurred:
- Just as important for learning
- Indicate system weaknesses
- May predict future actual harm
- Should be reported and investigated`,
        keyPoints: [
          "Multiple incident types to monitor",
          "Severity depends on context",
          "Near misses are valuable for learning"
        ]
      },
      {
        title: "Incident Reporting Obligations",
        content: `Clinical Safety Officers have specific responsibilities for reporting incidents:

**Internal Reporting (Within Organisation):**

**Immediate Reporting:**
All clinical safety incidents should be reported via:
- Organisation's incident reporting system
- Clinical Safety Officer notification
- Line management alert
- Clinical governance team

**Who Should Report:**
- Any staff member who identifies an incident
- Patients and carers (where mechanisms exist)
- System administrators
- Third-party contractors

**What to Report:**
- Actual harm incidents
- Near misses (no harm but potential for harm)
- System malfunctions with clinical implications
- Recurring issues or patterns
- Workarounds that bypass safety features

**External Reporting (to National Bodies):**

**NHS Digital - DCB0129 Assurance:**
Under DCB0129, organisations must report:
- Incidents that indicate non-compliance
- Serious safety incidents
- System changes affecting safety case validity

**MHRA (Medicines and Healthcare products Regulatory Agency):**
Report if the incident involves:
- Medical device software (if applicable)
- Serious adverse incidents
- Death or serious deterioration in health
- Need to take urgent corrective action

**Reporting criteria:**
- Actual or potential serious harm
- Relates to product malfunction or characteristics
- Causal or contributory relationship to incident

**CQC (Care Quality Commission):**
Report serious incidents as per CQC requirements:
- Death or serious harm
- Significant service disruption
- Safeguarding concerns

**Local Patient Safety Systems:**
Report via:
- Local risk management system
- Clinical governance reporting
- Patient Safety Incident Response Framework (PSIRF)

**Manufacturer Notification:**

If the incident relates to a commercial product:
- Notify the manufacturer/vendor
- Provide detailed incident information
- Request investigation
- Manufacturer has reporting obligations to MHRA

**Reporting Timelines:**

**Immediate (Within 24 Hours):**
- Death or serious harm
- Ongoing patient safety risk
- Need for urgent action
- System-wide failure

**Routine (Within 5-10 Working Days):**
- Less serious incidents
- Near misses
- Usability issues
- Pattern observations

**Information to Include in Reports:**

**Patient/Incident Details:**
- What happened?
- When did it happen?
- Where did it happen?
- Who was involved (roles, not usually names)?
- What was the outcome?

**System Details:**
- System name and version
- Specific function or module
- Any error messages
- Recent changes or updates
- Integration context

**Contributing Factors:**
- How did the system contribute?
- Were there user factors?
- Environmental factors?
- Training or procedural issues?

**Impact Assessment:**
- Level of harm (actual or potential)
- How many patients affected?
- How long until detected?
- What immediate actions taken?

**Confidentiality:**

Balance safety reporting with confidentiality:
- Remove patient-identifiable information when reporting externally
- Protect staff identity where appropriate
- But ensure enough detail for learning
- Follow organisation's data protection policies

**Protection for Reporters:**

Staff reporting incidents should:
- Be protected from blame or reprisal
- Receive feedback on investigations
- Be encouraged to report
- Understand it's about learning, not punishment

**Failure to Report:**

Not reporting serious incidents can:
- Be professional misconduct
- Breach regulatory requirements
- Compromise patient safety
- Expose organisation to liability

As CSO, you are responsible for:
- Ensuring reporting mechanisms exist
- Training staff on what and how to report
- Monitoring for underreporting
- Following up on reported incidents`,
        keyPoints: [
          "Multiple reporting pathways exist",
          "Serious incidents have specific reporting requirements",
          "Timely reporting is essential",
          "Protect and encourage reporters"
        ]
      },
      {
        title: "Investigation Procedures and Root Cause Analysis",
        content: `Systematic investigation is essential to understand and prevent recurrence:

**Investigation Framework:**

**1. Immediate Response**
- Ensure patient safety
- Prevent further incidents
- Preserve evidence
- Implement interim controls if needed
- Notify relevant parties

**2. Initial Triage**
- Assess severity
- Determine investigation level required
- Assign investigator(s)
- Set timescale
- Identify stakeholders

**3. Data Gathering**
- Interview involved staff
- Review system logs and audit trails
- Examine relevant documentation
- Recreate sequence of events
- Collect comparative data
- Review similar incidents

**4. Timeline Development**
- Construct detailed chronology
- Identify decision points
- Note system states
- Map user actions
- Highlight system responses

**Investigation Levels:**

**Level 1 - Minor Incident:**
- Desk-based review
- Interview key person
- Basic timeline
- Immediate cause identified
- Simple corrective action
- CSO review
- Timescale: 1-2 weeks

**Level 2 - Moderate Incident:**
- Structured investigation
- Multiple interviews
- Detailed analysis
- Contributing factors examined
- Root cause analysis
- Multi-faceted actions
- Timescale: 2-4 weeks

**Level 3 - Serious Incident:**
- Comprehensive investigation
- Multidisciplinary team
- External expertise if needed
- Full root cause analysis
- System-wide review
- Strategic recommendations
- Executive oversight
- Timescale: 4-12 weeks

**Root Cause Analysis (RCA):**

Systematic process to identify underlying causes:

**5 Whys Technique:**
Ask "why" repeatedly to get to root cause.

*Example:*
- Problem: Wrong medication prescribed
- Why? System displayed incorrect dose
- Why? Dose calculation error in system
- Why? Wrong weight unit used (kg vs lbs)
- Why? System didn't validate unit consistency
- Why? Unit validation not in original requirements
- *Root Cause: Incomplete requirements analysis*

**Fishbone (Ishikawa) Diagram:**
Categorize potential causes:
- **People**: Training, competence, workload, fatigue
- **Process**: Procedures, policies, workflows
- **Technology**: System design, failures, usability
- **Environment**: Physical space, interruptions, time pressures
- **Management**: Resources, priorities, culture

**Swiss Cheese Model:**
Multiple layers of defence can all have holes:
- System design flaws
- Poor procedures
- Inadequate training
- High workload
- Distraction
*Incident occurs when holes align*

**Key Questions in RCA:**

**Human Factors:**
- Was the task too complex?
- Was the user under time pressure?
- Were there distractions?
- Was training adequate?
- Were procedures clear?
- Was support available?

**System Factors:**
- Was the design intuitive?
- Were there adequate checks?
- Did the system provide appropriate feedback?
- Were errors easily detectable?
- Could errors be recovered from?
- Were safety features working?

**Organisational Factors:**
- Were resources sufficient?
- Was the safety culture strong?
- Were reporting mechanisms effective?
- Was maintenance adequate?
- Were change processes followed?
- Was governance effective?

**Common Root Causes:**

**Design Issues:**
- Poor usability
- Confusing layouts
- Insufficient warnings
- Inadequate feedback
- Missing safety features

**Process Failures:**
- Procedures not followed
- Inadequate checking
- Poor communication
- Role confusion
- Missing steps

**Training Gaps:**
- Insufficient initial training
- No refresher training
- Lack of awareness
- Competency not assessed
- New features not trained

**System Integration:**
- Interface failures
- Data mapping errors
- Synchronisation issues
- Incompatible assumptions
- Lack of testing

**Organisational Culture:**
- Production pressure over safety
- Underreporting of concerns
- Blame culture
- Inadequate resources
- Safety not prioritised

**Investigation Report:**

Should include:
1. Executive summary
2. Incident description
3. Investigation methodology
4. Timeline of events
5. Contributing factors
6. Root cause analysis
7. Recommendations
8. Action plan
9. Dissemination plan

**Avoid:**
- Blaming individuals
- Superficial analysis
- Stopping at first cause found
- Focusing only on policy violations
- Ignoring system factors`,
        keyPoints: [
          "Systematic investigation is essential",
          "Get to root causes, not just symptoms",
          "Consider human, system, and organisational factors",
          "Focus on learning, not blame"
        ]
      },
      {
        title: "Corrective and Preventive Actions (CAPA)",
        content: `Investigations must lead to effective actions to prevent recurrence:

**Corrective Actions**
Fix the immediate problem and prevent it happening again.

**Preventive Actions**
Address underlying issues to prevent similar problems.

**CAPA Hierarchy:**

**Level 1: Quick Fixes (Corrective)**
- Address immediate issue
- Often temporary
- Individual incident focus
- Fast to implement

*Examples:*
- Restart failed system
- Manually correct data
- Temporarily disable faulty feature
- Provide immediate additional training

**Level 2: System Improvements (Corrective)**
- Fix the system defect
- Update procedures
- Permanent solution
- Prevent exact recurrence

*Examples:*
- Fix software bug
- Improve user interface
- Add validation check
- Update workflow

**Level 3: Systematic Prevention (Preventive)**
- Address root causes
- System-wide application
- Prevent similar incidents
- Cultural/organisational change

*Examples:*
- Redesign process completely
- Implement additional safety layers
- Change development practices
- Enhance testing procedures

**Developing Effective CAPA:**

**SMART Actions:**
- **Specific**: Exactly what will be done
- **Measurable**: How will you know it's done
- **Achievable**: Realistic with available resources
- **Relevant**: Addresses the identified cause
- **Time-bound**: Clear deadline

*Good Example:*
"Update dose calculation module to include unit validation by 30 September, verified through regression testing"

*Poor Example:*
"Improve system sometime"

**Multiple Barriers:**
Don't rely on single action:

*Example CAPA Set:*
For wrong patient selection incident:
1. **Technical**: Add photo display (immediate)
2. **Technical**: Implement confirmation dialog (by month end)
3. **Procedural**: Update verification policy (this week)
4. **Training**: Brief all users (within 2 weeks)
5. **Monitoring**: Audit selection patterns (ongoing)

**Responsibility Assignment:**

Each action needs:
- Clear owner (named person)
- Defined authority
- Resources allocated
- Accountability

**Example:**
"Action: Implement patient photo display
Owner: IT Development Manager
Support: Clinical Safety Officer (requirements)
Resources: 2 developer days
Deadline: 31 August
Verification: CSO sign-off after testing"

**Common CAPA Categories:**

**Technical Actions:**
- Bug fixes
- New features
- System modifications
- Integration improvements
- Performance enhancements
- Security updates

**Procedural Actions:**
- Policy updates
- Process redesign
- Workflow changes
- Escalation procedures
- Documentation improvements
- Audit mechanisms

**Training Actions:**
- Refresher training
- Competency assessment
- Safety briefings
- Updated materials
- Simulation exercises
- Awareness campaigns

**Organisational Actions:**
- Resource allocation
- Priority changes
- Culture initiatives
- Governance updates
- Role clarifications
- Leadership engagement

**Monitoring Actions:**
- Enhanced surveillance
- Audit programmes
- Incident tracking
- Performance metrics
- User feedback
- Trend analysis

**CAPA Tracking:**

Maintain CAPA Log with:
- Action description
- Category (corrective/preventive)
- Linked incident(s)
- Owner and responsibility
- Target date
- Status (planned/in progress/complete)
- Verification evidence
- Effectiveness review date

**Verification:**

Confirm action completed:
- Evidence of implementation
- Testing performed
- Documentation updated
- Training delivered
- Sign-off obtained

**Effectiveness Review:**

After implementation, check if action worked:
- Has the incident recurred?
- Are there similar incidents?
- What's the user feedback?
- Are there unintended consequences?
- Should action be modified?

**Review Timing:**
- Immediate actions: Review after 1 month
- System changes: Review after 3 months
- Cultural changes: Review after 6-12 months

**Communication:**

Share learnings widely:
- Safety bulletins
- Team briefings
- Newsletter items
- Governance reports
- Training materials
- Industry sharing (where appropriate)

**Challenges and Solutions:**

**Challenge**: Actions not completed on time
*Solution*: Regular tracking meetings, escalation process

**Challenge**: Actions ineffective
*Solution*: Effectiveness review, alternative actions

**Challenge**: Too many actions, low priority
*Solution*: Prioritisation framework, resource allocation

**Challenge**: Blame culture inhibits reporting
*Solution*: Just culture, focus on systems not people

**Challenge**: Actions create new problems
*Solution*: Risk assessment of changes, pilot testing`,
        keyPoints: [
          "Actions must address root causes",
          "Use multiple barriers for defense",
          "Track completion and effectiveness",
          "Share learnings widely"
        ]
      },
      {
        title: "Learning from Incidents and Sharing Best Practices",
        content: `The ultimate goal of incident management is organisational and system-wide learning:

**Learning Cycle:**

**1. Capture**
- Comprehensive incident reporting
- Near miss identification
- Pattern recognition
- Trend analysis

**2. Analyse**
- Thorough investigation
- Root cause identification
- Contributing factors
- System weaknesses

**3. Act**
- Effective CAPA
- System improvements
- Process changes
- Training updates

**4. Share**
- Internal communication
- External reporting
- Industry collaboration
- Best practice dissemination

**5. Verify**
- Effectiveness checks
- Ongoing monitoring
- Continuous improvement
- Feedback loops

**Internal Learning Mechanisms:**

**Safety Briefings:**
- Regular team meetings
- Case presentations
- Lessons learned sessions
- Interactive discussions

**Safety Bulletins:**
- Written communications
- Highlight key incidents
- Summarise actions
- Remind of procedures

**Training Integration:**
- Include real incidents in training
- Use case studies
- Simulation of scenarios
- Error recovery practice

**Visual Reminders:**
- Safety posters
- Screen savers
- Login messages
- Alert banners

**Governance Reporting:**
- Regular reports to board/management
- Trends and patterns
- Action completion
- Safety performance metrics

**External Sharing:**

**MHRA Safety Alerts:**
- Monitor for relevant alerts
- Share with staff
- Implement recommendations
- Track compliance

**NHS Digital Safety Notices:**
- Register for notifications
- Assess applicability
- Action appropriately
- Report compliance

**Professional Networks:**
- Clinical Safety Officer forums
- Industry groups
- Special interest societies
- Conference presentations

**Academic Publication:**
- Case reports
- Analysis papers
- Safety research
- Educational articles

**Benefits of Sharing:**

**For Your Organisation:**
- Learn from others' mistakes
- Avoid repeating known problems
- Benchmark safety practices
- Demonstrate thought leadership

**For the NHS/Healthcare Sector:**
- Collective learning
- Faster problem identification
- Shared solutions
- Improved patient safety across all organisations

**What to Share:**

**Yes:**
- De-identified incident descriptions
- Contributing factors
- Root causes
- Effective solutions
- Lessons learned
- Safety innovations

**No/Be Cautious:**
- Patient-identifiable information
- Staff names (unless relevant and consented)
- Commercially sensitive data
- Legally privileged information
- Incomplete investigations

**Creating a Learning Culture:**

**Just Culture Principles:**
- Distinguish human error from reckless behaviour
- Focus on systems, not individuals
- Encourage reporting
- Support those involved in incidents
- Learn and improve

**Psychological Safety:**
- Safe to report mistakes
- No blame for honest errors
- Valued for speaking up
- Supported through investigations
- Recognised for improvements

**Leadership Role:**
- Model open discussion of safety
- Respond positively to concerns
- Allocate resources to safety
- Celebrate safety improvements
- Hold people accountable (for not reporting, not for errors)

**Measuring Learning:**

**Process Metrics:**
- Incident reporting rates
- Investigation completion times
- CAPA completion rates
- Training attendance

**Outcome Metrics:**
- Reduction in repeat incidents
- Improvement in safety culture scores
- Decrease in severity of incidents
- Increased near-miss reporting (indicates better awareness)

**Barriers to Learning:**

**Individual:**
- Fear of blame
- Lack of time
- Fatigue
- Lack of feedback

**Organisational:**
- Blame culture
- Lack of resources
- Competing priorities
- Inadequate systems

**System:**
- Poor reporting tools
- Delayed feedback
- Lack of analysis
- No action on reports

**Overcome Barriers:**
- Leadership commitment
- Clear processes
- Adequate resources
- Visible action on reports
- Regular feedback
- Celebration of good reporting

**Best Practices:**

1. **Act on reports**: Nothing kills reporting faster than inaction
2. **Give feedback**: Let reporters know what happened
3. **Say thank you**: Acknowledge those who report
4. **Share stories**: Make incidents relatable and memorable
5. **Close the loop**: Show that actions were effective
6. **Make it easy**: Simple reporting, minimal burden
7. **Protect reporters**: Confidentiality and just culture
8. **Senior visibility**: Leadership engagement in safety
9. **Regular rhythm**: Consistent safety communications
10. **Celebrate improvement**: Recognise safety achievements

**Case Study - Shared Learning:**

A hospital's e-prescribing system had an incident where a decimal point error occurred during chemotherapy prescribing, caught before administration.

**What They Shared:**
- System had dose range checking but threshold was too wide
- User interface didn't highlight the calculated mg/m² dose prominently
- Training had focused on system navigation, not on checking calculated doses

**Actions They Took:**
- Tightened dose range limits
- Enhanced display of calculated doses
- Added extra confirmation step for chemotherapy
- Updated training

**What Others Learned:**
- Similar systems checked their dose ranges
- Enhanced display changes adopted widely
- Training programmes updated across sector
- Prevented incidents in other organisations

This is the power of shared learning - one near-miss preventing multiple actual harms elsewhere.`,
        keyPoints: [
          "Learning is the goal, not just fixing individual incidents",
          "Share learnings internally and externally",
          "Create culture that encourages reporting and learning",
          "Measure and celebrate improvement"
        ]
      }
    ]
  },
  {
    id: "post_deployment",
    title: "Post-Deployment & Ongoing Monitoring",
    duration: 15,
    icon: "Activity",
    sections: [
      {
        title: "Post-Deployment Surveillance",
        content: `Active monitoring after system deployment is essential to identify emerging risks:

**Why Post-Deployment Surveillance Matters:**

**Systems Behave Differently in Real-World Use:**
- Real user behaviour vs. predicted behaviour
- Actual workflows vs. designed workflows
- Edge cases and exceptions
- Integration issues become apparent
- Performance under real load
- Unexpected use patterns

**Risks Emerge Over Time:**
- New hazards discovered
- Changes in clinical practice
- Integration with new systems
- Software updates and patches
- User workarounds develop
- Degradation of safety features

**Compliance Requirement:**
- DCB0129 mandates ongoing monitoring
- Part of continuous risk management
- Evidence of due diligence
- Audit requirement

**Surveillance Activities:**

**1. Incident Monitoring**
Active tracking of safety incidents:
- All reported incidents reviewed
- Near misses analysed
- Patterns identified
- Trends tracked
- Root causes investigated
- Learning implemented

*Frequency: Continuous*

**2. User Feedback Collection**
Systematic gathering of user experience:
- Structured feedback forms
- Regular user surveys
- Focus groups
- Helpdesk ticket analysis
- Direct observation sessions
- Clinical staff debriefs

*Frequency: Monthly surveys, quarterly focus groups*

**3. System Performance Monitoring**
Technical health checks:
- Uptime and availability
- Response times
- Error rates and logs
- Integration health
- Data quality metrics
- Capacity utilisation

*Frequency: Real-time monitoring, weekly reviews*

**4. Safety Metric Tracking**
Specific safety indicators:
- Wrong patient events
- Medication errors (system-related)
- Decision support overrides
- Critical alerts missed
- Data integrity issues
- Workaround frequency

*Frequency: Monthly reporting, quarterly analysis*

**5. Audit of Safety Features**
Verify controls remain effective:
- Alert systems functioning
- Validation checks working
- Access controls appropriate
- Backup systems tested
- Integration accuracy
- Data migration integrity

*Frequency: Quarterly audits*

**6. Clinical Outcome Review**
Assess clinical impact:
- Quality indicators
- Patient safety metrics
- Clinical effectiveness measures
- Efficiency and timeliness
- User satisfaction
- Patient experience

*Frequency: Quarterly reviews*

**Data Sources for Surveillance:**

**System-Generated:**
- Audit logs
- Error logs
- Performance metrics
- Usage analytics
- Alert statistics
- Transaction volumes

**User-Reported:**
- Incident reports
- Feedback forms
- Support tickets
- Complaints
- Suggestions
- Training queries

**Clinical Data:**
- Quality dashboards
- Outcome measures
- Patient safety reports
- Clinical audit results
- Governance reports
- External inspections

**Surveillance Tools:**

**Dashboards:**
Real-time visualization of:
- System health
- Incident trends
- Performance metrics
- Safety indicators
- User activity
- Alert patterns

**Automated Alerts:**
Notifications for:
- System failures
- Unusual patterns
- Threshold breaches
- Critical incidents
- Required reviews
- Action due dates

**Regular Reports:**
Scheduled production of:
- Monthly safety summary
- Quarterly trend analysis
- Annual safety review
- Board reporting
- Regulatory submissions
- Audit evidence

**Red Flags to Watch For:**

**Increasing Incidents:**
- Rising trend in error reports
- More serious severity
- Repeat similar incidents
- Increasing near misses

**Workaround Development:**
- Users bypassing safety features
- Manual processes replacing system use
- "Unofficial" procedures spreading
- Shortcuts being shared

**User Dissatisfaction:**
- Complaints increasing
- Training requests up
- Support calls rising
- Frustration expressed

**Performance Degradation:**
- Slower response times
- More system errors
- Integration failures
- Data quality issues

**Alert Fatigue:**
- High override rates
- Alerts being ignored
- Blanket dismissals
- Reduced alert effectiveness

**Response Protocols:**

**Green Status - Normal:**
- Continue routine monitoring
- No special action needed
- Document and trend

**Amber Status - Concern:**
- Enhanced monitoring
- Investigation initiated
- Interim measures if needed
- CSO informed
- Review at next governance meeting

**Red Status - Critical:**
- Immediate investigation
- Senior management alerted
- Emergency controls implemented
- Users notified
- External reporting if required
- System suspension considered

**Communication:**

Regular communication of surveillance findings:
- Monthly updates to operational teams
- Quarterly governance reporting
- Annual board presentation
- User feedback on incidents reported
- Safety bulletins on emerging issues
- External reporting as required

**Continuous Improvement:**

Use surveillance data to drive improvements:
- Identify system weaknesses
- Prioritise enhancement work
- Update training programmes
- Refine procedures
- Enhance safety features
- Update safety documentation`,
        keyPoints: [
          "Active monitoring is mandatory post-deployment",
          "Multiple data sources provide comprehensive view",
          "Early warning systems prevent serious incidents",
          "Surveillance drives continuous improvement"
        ]
      },
      {
        title: "User Feedback Collection and Analysis",
        content: `Systematic collection and analysis of user feedback is critical for identifying safety issues:

**Types of User Feedback:**

**1. Structured Feedback**

**User Satisfaction Surveys:**
- Regular (monthly/quarterly) surveys
- Standardised questions for trending
- Likert scales for quantitative analysis
- Open text for qualitative insights
- Specific safety-related questions
- Comparison with baseline

*Example Questions:*
- "How confident are you that the system helps you deliver safe care?" (1-5)
- "Have you experienced any safety concerns using the system?"
- "Do you feel adequately trained to use the system safely?"

**Usability Assessments:**
- Task completion rates
- Time to complete key tasks
- Error rates during use
- User satisfaction scores
- System Usability Scale (SUS)
- Safety-specific usability metrics

**Safety Incident Reports:**
- Structured reporting forms
- Mandatory fields ensure completeness
- Categorisation for analysis
- Severity rating
- Contributing factors
- Suggested improvements

**2. Unstructured Feedback**

**Helpdesk Tickets:**
- Support requests analysed for patterns
- Frequent issues identified
- Workarounds noted
- Confusion points highlighted
- Safety implications assessed

**Email and Communication:**
- User correspondence reviewed
- Informal reports captured
- Corridor conversations documented
- Team meeting feedback

**Social Listening:**
- Internal social media (if appropriate)
- Informal discussion forums
- Chat channels
- Team collaboration platforms

**3. Observational Feedback**

**Direct Observation:**
- Watch users in real clinical settings
- Note actual vs. intended use
- Identify workarounds
- Spot safety-critical moments
- Understand workflow integration

**Usability Testing:**
- Structured tasks with think-aloud
- Identify confusion points
- Test new features before release
- Validate training effectiveness
- Assess error recovery

**Shadowing:**
- Follow users through their day
- Understand broader context
- See integration with other systems
- Identify environmental factors
- Build empathy and understanding

**Collection Methods:**

**Embedded in System:**
- Feedback button in interface
- Quick rating after key tasks
- Pop-up surveys (used sparingly)
- Error reporting integration
- Contextual help requests

**Separate Channels:**
- Online feedback forms
- Email feedback address
- Phone hotline
- Drop-in sessions
- Focus groups
- User forums

**Proactive Outreach:**
- Scheduled user interviews
- Department visits
- Clinical area rounds
- Super-user meetings
- Safety walkabouts

**Analysis Techniques:**

**Quantitative Analysis:**

**Frequency Analysis:**
- Count of each issue type
- Trending over time
- Comparison across departments
- Identification of most common problems

**Severity Weighting:**
- Score issues by potential harm
- Prioritise based on safety impact
- Track safety-critical issues specifically

**Statistical Analysis:**
- Correlation between factors
- Regression analysis for predictions
- Control charts for trends
- Statistical significance testing

**Qualitative Analysis:**

**Thematic Analysis:**
- Identify common themes in text feedback
- Code responses into categories
- Look for patterns and connections
- Generate insights from narratives

**Sentiment Analysis:**
- Overall positive/negative sentiment
- Change in sentiment over time
- Specific feature sentiment
- User frustration indicators

**Root Cause Linking:**
- Connect feedback to underlying issues
- Identify systemic problems
- Distinguish symptoms from causes
- Group related feedback

**Prioritisation Framework:**

**High Priority (Act Immediately):**
- Safety-critical issues
- Frequent high-severity problems
- Regulatory compliance concerns
- System-wide failures
- Increasing incident trends

**Medium Priority (Plan Action):**
- Moderate frequency/severity
- Workaround sustainability concerns
- Training-addressable gaps
- Enhancement opportunities
- Efficiency improvements

**Low Priority (Monitor):**
- Rare issues
- Low severity
- Individual preferences
- Cosmetic concerns
- Future consideration

**Feedback Loop - Closing the Circle:**

**Acknowledge:**
- Confirm feedback received
- Thank the contributor
- Provide reference number
- Set expectations for response

**Investigate:**
- Review and categorise
- Assess severity and urgency
- Determine action needed
- Assign responsibility

**Act:**
- Implement fixes
- Update training
- Change procedures
- Enhance system
- Document decisions

**Communicate:**
- Tell the reporter what happened
- Share learnings widely
- Update documentation
- Inform all users if relevant
- Show that feedback matters

**Example Communication:**

"Thank you for reporting the issue with patient allergy alerts not displaying prominently. We investigated and found that the colour coding was not sufficient for colour-blind users. We have:

1. Enhanced the alert with an icon (deployed 15 May)
2. Added bold text formatting (deployed 15 May)
3. Updated training materials (completed 20 May)
4. Briefed all clinical users (week of 22 May)

We have not had any further reports of this issue. Your feedback has directly improved patient safety for everyone. Thank you."

**Metrics to Track:**

**Feedback Volume:**
- Total feedback items per month
- Trend over time
- By department/user group
- By feedback type

**Response Performance:**
- Time to acknowledge
- Time to investigate
- Time to resolve
- Feedback closure rate

**Action Effectiveness:**
- Repeat issue reduction
- User satisfaction improvement
- Incident rate decrease
- Positive feedback increase

**Engagement:**
- Participation in surveys
- Response rates
- Quality of feedback
- Diversity of contributors

**Barriers to Good Feedback:**

**User Barriers:**
- Too busy to provide feedback
- Don't know how to report
- Fear of blame or reprisal
- Think nothing will change
- Reporting too difficult

**Organisational Barriers:**
- Feedback not acted upon
- No visible follow-up
- Blame culture exists
- Inadequate resources
- Competing priorities

**System Barriers:**
- Reporting tools complex
- Feedback gets lost
- Analysis not done
- Findings not shared
- No improvement process

**Overcoming Barriers:**

**Make it Easy:**
- Simple, quick reporting
- Multiple channels
- Mobile-friendly
- Minimal fields
- Auto-save drafts

**Make it Safe:**
- Anonymous option available
- Just culture reinforced
- Focus on learning
- Protect whistleblowers
- No reprisals

**Make it Matter:**
- Visible action on feedback
- Regular communication of changes
- Thank and recognise contributors
- Show impact of feedback
- Celebrate improvements

**Make it Routine:**
- Regular feedback requests
- Scheduled surveys
- Standing agenda items
- Normalise feedback-giving
- Build into workflow

**Best Practices:**

1. **Multiple channels**: Different users prefer different methods
2. **Regular rhythm**: Consistent schedule builds habit
3. **Rapid response**: Quick acknowledgement encourages more feedback
4. **Close the loop**: Always tell people what happened
5. **Analyse trends**: Look for patterns, not just individual reports
6. **Act visibly**: Make changes obvious and publicise them
7. **Say thanks**: Recognise and value contributions
8. **Be transparent**: Share both good and bad feedback
9. **Link to safety**: Explicitly connect feedback to patient safety
10. **Continuous improvement**: Use feedback to drive ongoing enhancement`,
        keyPoints: [
          "Multiple feedback channels needed",
          "Both quantitative and qualitative analysis valuable",
          "Closing the feedback loop is critical",
          "Make reporting easy, safe, and impactful"
        ]
      },
      {
        title: "Monitoring for Emerging Hazards",
        content: `Proactive hazard surveillance identifies new risks before they cause harm:

**Sources of Emerging Hazards:**

**1. System Changes and Updates**

Software and hardware updates can introduce new hazards:
- New features with unforeseen risks
- Bug fixes that create new bugs
- Changes to algorithms or calculations
- User interface modifications
- Performance "improvements" with side effects
- Security patches affecting functionality

*Monitoring Approach:*
- Formal change management process
- Safety impact assessment for all changes
- Enhanced monitoring post-update
- Rapid feedback mechanism
- Roll-back planning

**2. Integration with New Systems**

New integrations create new hazard opportunities:
- Data mapping errors
- Timing and sequencing issues
- Conflicting business rules
- Duplicate or missing data
- Synchronisation failures
- Cascading failures

*Monitoring Approach:*
- Integration testing in production-like environment
- Phased rollout with close monitoring
- Data validation at interface points
- Regular reconciliation
- Alert mechanisms for failures

**3. Changes in Clinical Practice**

Healthcare evolves, creating new use cases:
- New treatments and protocols
- Different patient populations
- Changed care pathways
- New regulatory requirements
- Emerging evidence
- Pandemic or emergency responses

*Monitoring Approach:*
- Regular clinical review meetings
- Practice change notifications
- Gap analysis between system and practice
- Proactive hazard workshops for new uses
- Updated safety case as needed

**4. Evolving Technology Landscape**

The technology environment changes:
- New cyber security threats
- Cloud migration considerations
- Mobile and remote access expansion
- Artificial intelligence integration
- Internet of Medical Things
- Legacy system retirement

*Monitoring Approach:*
- Technology horizon scanning
- Security vulnerability monitoring
- Architecture reviews
- Risk assessments for new tech
- Pilot and evaluate before scaling

**5. Degradation and Wear**

Systems and processes degrade over time:
- Database performance reduction
- Accumulated data affecting speed
- Outdated clinical knowledge bases
- User knowledge decay
- Procedural drift
- Documentation staleness

*Monitoring Approach:*
- Regular performance monitoring
- Knowledge base update schedules
- Refresher training programmes
- Procedure reviews and updates
- Documentation audits

**6. External Factors**

Events outside the organisation affect risk:
- Regulatory changes
- Industry safety alerts
- Published incidents elsewhere
- New research evidence
- Supply chain issues
- Staffing and resource changes

*Monitoring Approach:*
- Subscribe to safety alerts
- Professional network engagement
- Literature monitoring
- Regulatory compliance tracking
- Horizon scanning

**Proactive Hazard Identification:**

**Periodic Hazard Workshops:**
- Scheduled (e.g., annually) comprehensive review
- Multidisciplinary team
- Structured brainstorming
- Review of Hazard Log
- Consideration of new scenarios
- Update of safety case

**What-If Analysis:**
- "What if we deployed this to a different department?"
- "What if we had 10x more users?"
- "What if the network failed during this process?"
- "What if a less experienced user tried this?"
- "What if two things went wrong simultaneously?"

**Trend Analysis:**
Review patterns over time:
- Incident frequency trends
- Error pattern evolution
- Workaround proliferation
- Performance degradation
- User satisfaction decline
- Training request themes

**Comparative Analysis:**
Learn from others:
- Industry incident reports
- Safety alerts from MHRA/NHS Digital
- Published case studies
- Conference presentations
- Professional network discussions
- Vendor bulletins

**User Input:**
Frontline users often spot emerging issues first:
- Regular user forums
- Safety suggestion schemes
- Frontline staff surveys
- Super-user networks
- Clinical champion engagement
- Patient and carer feedback

**Early Warning Signs:**

**System-Level Indicators:**
- Increasing error rates
- Performance degradation
- More frequent crashes
- Integration failures
- Data quality issues
- Security incidents

**User-Level Indicators:**
- Rising support calls
- More workarounds
- Training requests increasing
- Expressed frustrations
- Declining usage
- Seeking alternatives

**Organisational Indicators:**
- Higher incident reporting
- More complaints
- Governance escalations
- Audit findings
- Inspector concerns
- Media interest

**Clinical Indicators:**
- Quality metrics declining
- Patient safety incidents
- Delays in care
- Errors or near misses
- Clinical staff concerns
- Patient complaints

**Response to Emerging Hazards:**

**1. Rapid Assessment**
- Is this a real hazard or false alarm?
- What's the potential severity?
- How likely is harm?
- How widespread is the issue?
- Do we need immediate action?

**2. Immediate Controls (If Needed)**
- User alerts and warnings
- Temporary procedure changes
- Enhanced monitoring
- Feature disable if necessary
- Direct supervision
- Incident escalation

**3. Thorough Investigation**
- Root cause analysis
- Extent of issue
- Contributing factors
- Similar potential hazards
- Comprehensive risk assessment

**4. Permanent Mitigation**
- System changes
- Process improvements
- Training updates
- Documentation revisions
- Monitoring enhancement

**5. Learning and Sharing**
- Update Hazard Log
- Revise Safety Case if significant
- Inform users
- Share with manufacturers/vendors
- Report externally if required
- Update future projects

**Monitoring Dashboards:**

Create visual dashboards showing:
- Key safety metrics trends
- Incident frequency by type
- New hazards identified
- CAPA completion status
- System performance indicators
- User feedback sentiment
- Regulatory compliance status

**Regular Review Cycles:**

**Weekly:**
- Incident review
- Immediate actions
- Urgent issues

**Monthly:**
- Safety metrics review
- Trend analysis
- New hazard assessment
- CAPA progress

**Quarterly:**
- Comprehensive safety review
- Hazard Log update
- Governance reporting
- Strategic planning

**Annually:**
- Full Safety Case review
- Comprehensive hazard workshop
- External benchmarking
- Strategic risk assessment
- Board reporting

**Documentation:**

Keep comprehensive records of:
- Monitoring activities performed
- Findings and trends identified
- New hazards discovered
- Actions taken
- Effectiveness reviews
- Lessons learned

This creates an audit trail and evidence of ongoing diligence.`,
        keyPoints: [
          "Hazards emerge from many sources",
          "Proactive monitoring prevents harm",
          "Early warning signs should trigger action",
          "Regular review cycles essential"
        ]
      },
      {
        title: "Change Management Process",
        content: `All changes to deployed systems must be managed through a clinical safety lens:

**Why Change Management Matters:**

Changes can introduce new hazards:
- Bug fixes sometimes create new bugs
- "Improvements" can worsen safety
- Unintended consequences common
- Integration effects unpredictable
- User behaviour may shift unexpectedly

**Change Control Principles:**

**1. No Unauthorised Changes**
- All changes must be approved
- Emergency changes still need expedited approval
- Temporary changes must be formalised
- Shadow IT and workarounds are changes too

**2. Safety Assessment Required**
- Every change assessed for safety impact
- Level of assessment matches change risk
- CSO involvement appropriate to risk
- Documentation updated as needed

**3. Controlled Deployment**
- Phased rollout where appropriate
- Rollback capability maintained
- Monitoring during deployment
- User communication before change

**4. Verification of Safety**
- Testing includes safety scenarios
- Validation that controls still work
- Check for unintended effects
- User acceptance includes safety check

**Change Categories:**

**Category 1 - High Risk Changes**
Major changes with significant safety implications.

*Examples:*
- New clinical functionality
- Changes to clinical algorithms or calculations
- New integrations with clinical systems
- Major user interface redesign
- Database schema changes affecting clinical data
- Changes to safety-critical features

*Safety Assessment Required:*
- Full hazard identification workshop
- Complete risk assessment
- Updated Safety Case section
- Hazard Log updates
- CSO formal approval
- Senior management sign-off
- Comprehensive testing
- Phased deployment
- Enhanced post-deployment monitoring

*Timeline: 4-12 weeks depending on scale*

**Category 2 - Medium Risk Changes**
Moderate changes with potential safety implications.

*Examples:*
- Bug fixes in clinical areas
- Report or output format changes
- Minor workflow modifications
- Performance improvements
- Routine system updates
- Security patches

*Safety Assessment Required:*
- Impact analysis
- Targeted risk assessment
- Test safety scenarios
- Update relevant Hazard Log entries
- CSO review and approval
- User notification
- Standard testing
- Normal deployment
- Routine monitoring

*Timeline: 1-4 weeks*

**Category 3 - Low Risk Changes**
Minor changes with negligible safety impact.

*Examples:*
- Cosmetic UI changes (non-clinical)
- Administrative functionality
- Reporting changes (non-clinical)
- Documentation updates
- Minor performance tweaks

*Safety Assessment Required:*
- Brief impact check
- CSO notification
- Quick review
- Standard testing
- Normal deployment

*Timeline: Days to 1 week*

**Change Management Process:**

**Step 1: Change Request**
- Describe proposed change
- Rationale and benefits
- Initial risk categorisation
- Requested by (name/role)
- Target implementation date

**Step 2: Initial Triage**
- Verify category
- Assign to change assessor
- Identify stakeholders
- Set timescales
- Allocate resources

**Step 3: Safety Impact Assessment**

For each change, document:
- **What's changing?** Detailed description
- **Why?** Justification and benefits
- **Clinical impact?** Who/what affected
- **New hazards?** Could this introduce new risks
- **Affected existing hazards?** Impact on current Hazard Log
- **Controls affected?** Are current mitigations still effective
- **Testing required?** What specifically to test
- **Training needed?** Do users need to know
- **Documentation updates?** What needs changing

**Step 4: Risk Assessment**

For new or modified hazards:
- Identify clinical scenarios
- Assess severity
- Estimate likelihood
- Determine risk score
- Plan control measures
- Assess residual risk
- Determine acceptability
- Seek approval if needed

**Step 5: Planning**

Develop implementation plan:
- Development work required
- Testing approach and scenarios
- Deployment method (phased/full)
- Rollback procedure
- Communication plan
- Training plan if needed
- Monitoring approach
- Success criteria

**Step 6: Approval**

Obtain appropriate approvals:
- CSO sign-off (always)
- IT Manager/CIO (for technical changes)
- Clinical Lead (for clinical changes)
- Senior Management (for high-risk)
- Change Advisory Board (if exists)

**Step 7: Implementation**

Execute the change:
- Perform development work
- Complete testing (including safety tests)
- Update documentation
- Brief/train users
- Deploy in controlled manner
- Monitor closely

**Step 8: Verification**

Confirm change successful and safe:
- Functional testing passed
- Safety scenarios tested
- No unintended effects detected
- User feedback positive
- Performance acceptable
- Monitoring shows normal operation

**Step 9: Post-Implementation Review**

After suitable period (1-3 months):
- Review incident data
- Check user feedback
- Verify controls effective
- Assess achievement of benefits
- Identify any lessons learned
- Update documentation if needed

**Emergency Changes:**

Sometimes urgent changes are needed:

**Criteria for Emergency:**
- Serious safety risk if not done immediately
- System failure affecting patient care
- Critical security vulnerability
- Regulatory compliance urgency

**Emergency Process:**
- Document emergency justification
- Expedited safety assessment
- Senior approval (phone/email acceptable)
- Implement with close monitoring
- Formal retrospective review within 48 hours
- Full documentation within 1 week

**Important:** "Urgent business need" is not same as "emergency". True emergencies are rare.

**Testing Requirements:**

**Functional Testing:**
- Does the change work as intended?
- Are existing functions unaffected?

**Safety Testing:**
- Do safety features still work?
- Are new hazards controlled?
- Can system recover from errors?
- Are alerts and warnings functioning?
- Is critical data protected?

**Regression Testing:**
- Do existing safety scenarios still pass?
- Are existing controls still effective?
- Have other areas been affected?

**User Acceptance Testing:**
- Do users understand the change?
- Can they use it safely?
- Any confusion or misunderstanding?
- Does it fit their workflow?

**Communication:**

**Before Change:**
- Notify all affected users
- Explain what's changing and why
- Highlight any actions they need to take
- Provide training if needed
- Set go-live date clearly

**During Change:**
- Keep users updated on progress
- Alert if delays or issues
- Provide support contacts
- Remind of key points

**After Change:**
- Confirm change completed
- Provide quick reference guides
- Solicit feedback
- Monitor and respond to issues
- Thank users for cooperation

**Documentation Updates:**

Changes may require updates to:
- Clinical Safety Case (for significant changes)
- Hazard Log (for new/changed hazards)
- Operating procedures
- User guides and training materials
- Technical documentation
- Disaster recovery plans
- Business continuity plans

**Change Register:**

Maintain log of all changes:
- Change ID
- Description
- Category
- Date requested
- Requested by
- Safety assessment reference
- Approval date and by whom
- Implementation date
- Current status
- Post-implementation review date

**Metrics to Monitor:**

- Number of changes by category
- Time to assess and implement
- Percentage requiring safety rework
- Incidents related to recent changes
- User feedback post-change
- Rollback frequency

**Common Pitfalls:**

**Avoiding Safety Assessment:**
- "It's just a small change" - still needs checking
- "It's not clinical" - may have indirect effects
- "We're in a hurry" - shortcuts create risk
- "It's just config" - configuration changes are changes

**Inadequate Testing:**
- Only testing happy path
- Not testing safety scenarios
- Insufficient regression testing
- Skipping user acceptance
- No rollback testing

**Poor Communication:**
- Users surprised by changes
- Insufficient notice given
- Training not provided
- Support not available
- Feedback not sought

**Documentation Lag:**
- Safety Case not updated
- Hazard Log out of date
- Procedures not revised
- Training materials stale`,
        keyPoints: [
          "All changes must be assessed for safety",
          "Assessment depth matches change risk",
          "Testing must include safety scenarios",
          "Communication before, during, and after change"
        ]
      },
      {
        title: "Continuous Improvement and Annual Reviews",
        content: `Ongoing enhancement of clinical safety is essential:

**Continuous Improvement Culture:**

**Philosophy:**
Safety is never "done" - there's always room for improvement.

**Key Principles:**

**1. Learning Mindset**
- Every incident is a learning opportunity
- Near misses are valuable
- User feedback drives improvement
- Best practices are shared
- Innovation is encouraged

**2. Systematic Approach**
- Regular review cycles
- Structured improvement processes
- Metrics-driven decisions
- Evidence-based changes
- Documented learning

**3. Inclusive Participation**
- Everyone can contribute
- Frontline staff empowered
- Patient and carer input valued
- Multi-disciplinary collaboration
- Leadership engagement

**4. Balanced Perspective**
- Safety balanced with usability
- Risk vs. benefit considered
- Practicality acknowledged
- Resource constraints recognised
- Sustainability important

**Improvement Sources:**

**From Incidents:**
- Root cause analysis findings
- Pattern identification
- Contributing factor analysis
- CAPA effectiveness reviews
- Shared learning from others

**From Monitoring:**
- Performance metrics trends
- User satisfaction data
- Quality indicators
- Benchmark comparisons
- Audit findings

**From Users:**
- Suggestions and ideas
- Observed workarounds
- Efficiency opportunities
- Usability enhancements
- Training feedback

**From Technology:**
- New capabilities available
- Better solutions emerging
- Vendor enhancements
- Industry innovations
- Research findings

**From Regulation:**
- New standards released
- Updated guidance
- Best practice publications
- Inspection feedback
- Professional development

**Improvement Process:**

**1. Identify**
- What could be better?
- What problems exist?
- What opportunities?
- What do users want?
- What does data show?

**2. Analyse**
- Why is the problem occurring?
- What's the root cause?
- How big is the impact?
- Who is affected?
- What's the benefit of improving?

**3. Plan**
- What are possible solutions?
- Which is most effective?
- What resources needed?
- What's the implementation approach?
- How will we measure success?

**4. Implement**
- Execute the improvement
- Pilot if appropriate
- Communicate changes
- Train if needed
- Monitor closely

**5. Evaluate**
- Did it work?
- What was the impact?
- Any unintended effects?
- What did we learn?
- What's next?

**6. Standardise**
- Embed if successful
- Update documentation
- Share learning
- Replicate elsewhere
- Make it business as usual

**Annual Safety Review:**

**Purpose of Annual Review:**
- Comprehensive health check
- Regulatory compliance
- Strategic planning
- Stakeholder assurance
- Continuous authorization

**Required by DCB0129:**
Even if no system changes, annual review mandated.

**Timing:**
- Anniversary of initial deployment
- Or financial year end
- Or at defined governance cycle
- Consistent scheduling important

**Scope of Annual Review:**

**1. Documentation Review**
- Is Clinical Safety Case current?
- Is Hazard Log up to date?
- Are procedures being followed?
- Is training material accurate?
- Are roles and responsibilities clear?

**2. Hazard Log Review**
- Are all hazards still relevant?
- Have new hazards emerged?
- Are risk ratings still accurate?
- Are controls still effective?
- Any hazards to close or update?

**3. Risk Reassessment**
- Review likelihood estimates with actual data
- Confirm severity ratings still appropriate
- Check control effectiveness
- Reassess residual risks
- Verify acceptability

**4. Incident Analysis**
- Review all incidents in period
- Identify patterns and trends
- Assess CAPA effectiveness
- Learn from near misses
- Compare to previous year

**5. Performance Review**
- System reliability and uptime
- User satisfaction scores
- Clinical quality metrics
- Safety incident rates
- Compliance with procedures

**6. Change Review**
- All changes in the year
- Cumulative safety impact
- Lessons from change management
- Outstanding changes
- Planned changes

**7. User Feedback Analysis**
- Summary of all feedback
- Key themes identified
- Actions taken
- Outstanding issues
- Satisfaction trends

**8. Compliance Check**
- DCB0129/0160 compliance status
- Other regulatory requirements
- Internal policy compliance
- Professional standards
- Best practice alignment

**9. Training and Competence**
- Training completion rates
- Competency assessment results
- Knowledge gaps identified
- Training effectiveness
- Future training needs

**10. External Factors**
- New regulations or guidance
- Industry developments
- Technology changes
- Clinical practice evolution
- Organisational changes

**Annual Review Report:**

**Executive Summary**
- Overall safety status
- Key achievements
- Main concerns
- Critical recommendations
- Go/no-go decision

**System Overview**
- Current version and configuration
- Usage statistics
- User base
- Integration status
- Recent changes

**Safety Performance**
- Incident summary and trends
- Near miss analysis
- User feedback themes
- Quality metrics
- Benchmark comparison

**Risk Status**
- Open hazards summary
- Risk distribution
- Changes to risk profile
- New hazards identified
- Closed hazards

**Compliance Status**
- DCB0129/0160 compliance
- Outstanding actions
- Regulatory changes
- Audit findings
- Certification status

**Improvements Delivered**
- CAPA completed
- Enhancements implemented
- Training delivered
- Processes improved
- Benefits realised

**Outstanding Issues**
- Known problems
- Planned improvements
- Resource needs
- Timescales
- Priorities

**Forward Look**
- Planned changes
- Anticipated risks
- Improvement roadmap
- Resource requirements
- Strategic direction

**Recommendations**
- Continue use (yes/no)
- Required actions
- Enhancements recommended
- Investment needed
- Review date

**Review Process:**

**Preparation (1-2 months before):**
- Gather all data and metrics
- Compile incident reports
- Collect user feedback
- Review documentation
- Draft report sections

**Stakeholder Engagement:**
- Clinical users consulted
- IT teams involved
- Management briefed
- Patient representatives (where appropriate)

**CSO Assessment:**
- Detailed analysis
- Professional judgment
- Risk evaluation
- Recommendations developed

**Draft Report:**
- Comprehensive documentation
- Evidence-based conclusions
- Clear recommendations
- Executive-friendly summary

**Review and Approval:**
- Clinical lead review
- IT director review
- Management presentation
- Formal approval
- Sign-off obtained

**Communication:**
- Users informed of findings
- Key messages shared
- Actions communicated
- Reassurance provided
- Feedback welcomed

**Action Planning:**
- Priority actions identified
- Resources allocated
- Responsibilities assigned
- Timescales set
- Monitoring arranged

**Follow-up:**
- Action tracking
- Progress reporting
- Issue escalation
- Adaptation as needed

**Decision Points:**

Annual review leads to one of:

**Green Light - Continue**
- System safe for continued use
- No significant changes needed
- Routine monitoring continues
- Next annual review scheduled

**Amber Light - Conditions**
- Continue with specified actions
- Enhanced monitoring required
- Improvements to be delivered
- Review in 6 months

**Red Light - Pause**
- Safety concerns require resolution
- Use suspended or restricted
- Urgent action required
- Resume only after clearance

**Improvement Planning:**

Use annual review to plan:
- Next year's enhancement roadmap
- Training programme updates
- Process improvements
- Technology upgrades
- Risk reduction priorities

**Governance Integration:**

Annual review should feed into:
- Board assurance reporting
- Quality governance
- Risk management framework
- Strategic planning
- Budget setting

**Best Practices:**

1. **Start early**: Don't leave it to last minute
2. **Be thorough**: Comprehensive is better than quick
3. **Involve users**: Their input is invaluable
4. **Be honest**: Acknowledge issues openly
5. **Be evidence-based**: Use data, not opinion
6. **Be forward-looking**: Plan for improvement
7. **Get sign-off**: Formal approval matters
8. **Communicate widely**: Share key messages
9. **Track actions**: Ensure follow-through
10. **Learn and improve**: Make each review better

**Documentation:**

Maintain records of:
- Annual review reports
- Approval decisions
- Actions arising
- Follow-up progress
- Trends over years

This creates a clear audit trail and demonstrates ongoing clinical safety management.`,
        keyPoints: [
          "Continuous improvement is essential",
          "Annual review is mandatory",
          "Comprehensive assessment required",
          "Use findings to drive improvement"
        ]
      }
    ]
  }
];

export const getModuleById = (moduleId: string): TrainingModule | undefined => {
  return csoTrainingModules.find(m => m.id === moduleId);
};

export const getTotalDuration = (): number => {
  return csoTrainingModules.reduce((total, module) => total + module.duration, 0);
};

export const getModuleProgress = (completedModuleIds: string[]): number => {
  const totalModules = csoTrainingModules.length;
  const completedCount = completedModuleIds.length;
  return totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
};
