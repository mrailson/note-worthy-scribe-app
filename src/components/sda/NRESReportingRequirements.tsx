import React, { useState } from 'react';
import { ChevronRight, ChevronDown, FileText, BarChart3, Shield, Users, Pill, Activity, Clock, AlertTriangle, CheckCircle2, Info, Calendar, Building2, TrendingUp, Heart, Stethoscope, BookOpen, Scale, Banknote, GraduationCap, Ambulance, ClipboardCheck, Target, AlertCircle, FileWarning, Eye, Lock, Megaphone, Settings, PieChart, LineChart, Table, Layers, ArrowRight, ExternalLink, CircleDot, CheckSquare, XSquare, MinusSquare, HelpCircle } from 'lucide-react';

const NRESReportingComprehensive = () => {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [activeSubSection, setActiveSubSection] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [expandedRequirements, setExpandedRequirements] = useState<Record<string, boolean>>({});
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const toggleCard = (cardId: string) => {
    setExpandedCards(prev => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  const toggleRequirement = (reqId: string) => {
    setExpandedRequirements(prev => ({ ...prev, [reqId]: !prev[reqId] }));
  };

  // ==================== ICB REQUIREMENTS DATABASE ====================
  const icbRequirements = {
    // Activity & Performance
    'utilisation': {
      title: 'Utilisation Rates',
      section: '2.2.1 Reporting',
      status: 'mandatory',
      quote: '"Activity data to include: Utilisation rates (including breakdown to practice level)"',
      context: 'The ICB requires monthly visibility of how effectively NAS capacity is being used across each practice to ensure equitable distribution and identify underperforming areas.',
      frequency: 'Monthly',
      owner: 'SNO Programme Manager'
    },
    'unmet-demand': {
      title: 'Unmet Demand Tracking',
      section: '2.2.1 Reporting',
      status: 'mandatory',
      quote: '"Activity data to include: Unmet demand (patients unable to book)"',
      context: 'Critical metric for measuring access failures. If patients cannot book appointments, this undermines the core purpose of the NAS.',
      frequency: 'Monthly',
      owner: 'SNO Programme Manager'
    },
    'repeat-attendance': {
      title: 'Repeat Attendance Analysis',
      section: '2.2.1 Reporting',
      status: 'mandatory',
      quote: '"Activity data to include: Repeat attendances"',
      context: 'High repeat attendees (4+ in 4 weeks) must be reviewed for unresolved clinical need, continuity pathway suitability, or Part B referral.',
      frequency: 'Monthly',
      owner: 'Clinical Lead'
    },
    'activity-targets': {
      title: 'Activity Targets',
      section: '2.1.1 Service Specification',
      status: 'mandatory',
      quote: '"The capacity of a Neighbourhood Access Service is set at 15.2 appointments per 1,000 weighted population per week (standard) and 18.2 per 1,000 during winter surge (13 weeks)"',
      context: 'These targets are derived from ICB modelling assumptions and form the basis of contract value calculations.',
      frequency: 'Weekly monitoring, Monthly reporting',
      owner: 'SNO Programme Manager'
    },
    'equity-index': {
      title: 'Equity of Utilisation',
      section: '2.2 Outcomes',
      status: 'mandatory',
      quote: '"The programme board will ensure equity of utilisation"',
      context: 'Usage should be proportional to practice list sizes. Significant deviations trigger Programme Board review.',
      frequency: 'Monthly',
      owner: 'Programme Board'
    },
    'under5-f2f': {
      title: 'Under-5s Face-to-Face',
      section: '2.1.1 Service Specification',
      status: 'mandatory',
      quote: '"All appointments for patients aged under 5 must be provided face-to-face"',
      context: 'Non-negotiable requirement. 100% compliance expected.',
      frequency: 'Ongoing',
      owner: 'Clinical Lead'
    },

    // Quality & Safety
    'complaints': {
      title: 'Complaints Tracking',
      section: '2.2.1 Reporting',
      status: 'mandatory',
      quote: '"Quality data to include: complaints"',
      context: 'Volume, themes, resolution status, and learning actions must be tracked. Feeds into mandatory narrative.',
      frequency: 'Monthly',
      owner: 'Quality Lead'
    },
    'safeguarding': {
      title: 'Safeguarding Referrals',
      section: 'GMS Contract / CQC',
      status: 'mandatory',
      quote: '"Practices must maintain safeguarding policies and procedures"',
      context: 'All safeguarding referrals raised from NAS must be tracked by type (child protection, adult, domestic abuse, self-neglect).',
      frequency: 'Monthly',
      owner: 'Safeguarding Lead'
    },
    'incidents': {
      title: 'Incident Reporting (LFPSE)',
      section: '2.1.3 Patient Safety',
      status: 'mandatory',
      quote: '"Sign up to LFPSE requirements of sharing information with ICB"',
      context: 'Learn from Patient Safety Events framework compliance. All safety events must be reported and learning shared.',
      frequency: 'As required + Monthly summary',
      owner: 'Clinical Governance Lead'
    },
    'ipc': {
      title: 'IPC Compliance',
      section: '2.1.3 Clinical Governance',
      status: 'mandatory',
      quote: '"Clinical governance policies to include prevention of healthcare associated infections"',
      context: 'Hub sites must maintain IPC standards with regular inspection and compliance tracking.',
      frequency: 'Monthly',
      owner: 'IPC Lead'
    },
    'fft': {
      title: 'Friends and Family Test',
      section: 'NHS Standard Contract',
      status: 'mandatory',
      quote: '"Each patient must be offered the opportunity to provide feedback"',
      context: 'FFT results and themes must be reported. Target: ≥90% positive rate.',
      frequency: 'Monthly',
      owner: 'Quality Lead'
    },
    'mandatory-narrative': {
      title: 'Mandatory Narrative',
      section: '2.2.1 Reporting',
      status: 'mandatory',
      quote: '"Reports must include narrative to explain: performance against metrics and reasons for variance; actions taken where metrics have not been met; evidence of acting on patient feedback; evidence of learning from incidents and complaints"',
      context: 'This is explicitly required and non-negotiable. Every monthly and quarterly report must include explanatory narrative.',
      frequency: 'Monthly + Quarterly',
      owner: 'Programme Manager'
    },

    // Referrals & Diagnostics
    'onward-referrals': {
      title: 'Onward Referrals',
      section: '2.2.1 Reporting',
      status: 'mandatory',
      quote: '"Activity data to include: Onward referrals"',
      context: 'Track where NAS referrals are sent. Informs pathway development and identifies integration opportunities.',
      frequency: 'Monthly',
      owner: 'Clinical Lead'
    },
    'direct-referral': {
      title: 'Direct Referral Requirement',
      section: '2.1.2 Referrals',
      status: 'mandatory',
      quote: '"Referrals must be made directly from NAS clinicians and should NOT be passed back to host practices to administrate"',
      context: 'Target: ≥94% of referrals made directly. This includes specialist care, diagnostics, and phlebotomy follow-ups.',
      frequency: 'Ongoing',
      owner: 'Clinical Lead'
    },
    'diagnostics': {
      title: 'Diagnostics Ordered',
      section: '2.2.1 Reporting',
      status: 'mandatory',
      quote: '"Activity data to include: Diagnostics ordered"',
      context: 'Track pathology, imaging, and investigations ordered from NAS with review compliance.',
      frequency: 'Monthly',
      owner: 'Clinical Lead'
    },
    'pathology-review': {
      title: 'Pathology Results Review',
      section: '2.1.2 Pathology',
      status: 'mandatory',
      quote: '"Any requested tests must be reviewed in line with national requirements within an agreed SOP"',
      context: 'Results must be reviewed within national timeframes. Clear accountability for follow-up.',
      frequency: 'Ongoing',
      owner: 'Clinical Lead'
    },
    'emas-integration': {
      title: 'EMAS Integration',
      section: '2.1.2 EMAS',
      status: 'suggested',
      quote: '"Direct booking into NAS where GP appointment is more appropriate than hospital conveyance"',
      context: 'A conversation between EMAS and the patient\'s registered practice is expected to ensure appropriateness.',
      frequency: 'As required',
      owner: 'Operations Manager'
    },

    // Prescribing
    'formulary': {
      title: 'Formulary Compliance',
      section: '2.1.4 Medicines',
      status: 'mandatory',
      quote: '"Local guidance for prescribing and medicines optimisation, local formulary and traffic light classifications"',
      context: 'All prescribing must follow local formulary. Target: ≥95% compliance.',
      frequency: 'Monthly',
      owner: 'Pharmacy Lead'
    },
    'paf': {
      title: 'Prescribing Achievement Framework',
      section: '2.1.4 Medicines',
      status: 'mandatory',
      quote: '"Neighbourhood approach for achieving and monitoring PAF indicators discussed during design phase"',
      context: 'PAF indicators must be tracked quarterly with action plans for underperformance.',
      frequency: 'Quarterly',
      owner: 'Pharmacy Lead'
    },
    'prescribing-budget': {
      title: 'Prescribing Budget',
      section: '2.1.4 Medicines',
      status: 'mandatory',
      quote: '"The prescribing budget for NAS forms part of the primary care prescribing budget and will be calculated for 2026/27 onwards with regular monitoring"',
      context: 'Budget will be set and monitored by ICB with regular review of financial assumptions.',
      frequency: 'Monthly monitoring',
      owner: 'Finance Lead'
    },

    // Workforce
    'staff-satisfaction': {
      title: 'Staff Satisfaction Survey',
      section: '2.2 Outcomes',
      status: 'mandatory',
      quote: '"Increased staff satisfaction, recruitment and retention is a defined ICB outcome"',
      context: 'Quarterly survey measuring satisfaction, work-life balance, support, training, and cross-practice working.',
      frequency: 'Quarterly',
      owner: 'HR Lead'
    },
    'clinical-backfill': {
      title: 'Clinical Backfill',
      section: '2.1.5 Workforce',
      status: 'mandatory',
      quote: '"Clinical resource used from GP Practices to support NAS must be backfilled to protect capacity for complex care"',
      context: 'Essential to protect practice capacity for Part B delivery.',
      frequency: 'Ongoing',
      owner: 'Operations Manager'
    },
    'training-placements': {
      title: 'Training Placements',
      section: '2.1.5 Workforce',
      status: 'suggested',
      quote: '"Work with local universities and Training Hub to offer structured placements with supervision and feedback"',
      context: 'GP registrars, FY doctors, nursing students. Student feedback included in service improvement.',
      frequency: 'Quarterly',
      owner: 'Training Lead'
    },
    'named-reporting-leads': {
      title: 'Named Reporting Leads',
      section: '2.2.1 Reporting',
      status: 'mandatory',
      quote: '"Each practice must nominate a named reporting lead responsible for timely and accurate data submission"',
      context: 'Non-negotiable. Each of the 7 practices must have a confirmed lead.',
      frequency: 'Ongoing',
      owner: 'Programme Manager'
    },

    // Part B
    'partb-duration': {
      title: 'Appointment Duration Monitoring',
      section: '2.1.1 Part B Specification',
      status: 'mandatory',
      quote: '"Activity data to include: Appointment lengths (actual vs planned)"',
      context: 'Part B appointments should be 30+ minutes. Track actual vs planned to ensure adequate time for complex consultations.',
      frequency: 'Monthly',
      owner: 'Clinical Lead'
    },
    'priority-cohorts': {
      title: 'ICB Priority Cohorts',
      section: '2.1.1 Part B Specification',
      status: 'mandatory',
      quote: '"COPD/Asthma and RESPECT plans are ICB Priority cohorts requiring specific attention"',
      context: 'These cohorts must be specifically addressed and reported. Other cohorts (diabetes, frailty, EoL, MH, etc.) are also tracked.',
      frequency: 'Monthly',
      owner: 'Clinical Lead'
    },
    'respect-plans': {
      title: 'RESPECT Plans',
      section: '2.1.1 Part B Specification',
      status: 'mandatory',
      quote: '"Not limited to EoL — provides opportunity to confirm or initiate RESPECT conversations when patients can voice their wishes"',
      context: 'ICB Priority. Discussions can span multiple appointments but form must be completed in one sitting.',
      frequency: 'Monthly + Quarterly',
      owner: 'Clinical Lead'
    },
    'partb-coding': {
      title: 'Part B Clinical Coding',
      section: '2.1.1 Part B Specification',
      status: 'mandatory',
      quote: '"Appointments clearly coded for Part B activity, allocated to patients in PNG groups 8-11, tracked for continuity"',
      context: 'Essential for demonstrating protected capacity is used appropriately. Rotas must NOT be used for reactive care.',
      frequency: 'Ongoing',
      owner: 'Clinical Lead'
    },
    'partab-linkage': {
      title: 'Part A / Part B Linkage',
      section: '2.2 Governance',
      status: 'mandatory',
      quote: '"Continued access to Part A \'held funds\' is conditional on demonstrable delivery of Part B commitments"',
      context: 'CRITICAL: Practices failing minimum thresholds may face performance plans, reallocation, or contract termination.',
      frequency: 'Quarterly Review',
      owner: 'Programme Board'
    },

    // Financial
    'open-book': {
      title: 'Open Book Approach',
      section: '2.2 Governance',
      status: 'mandatory',
      quote: '"The SNO is required to undertake an Open Book approach to sharing information with the ICB, showing activity, performance, financial and workforce breakdowns"',
      context: 'Full transparency required. Any information critical to future commissioning must be shared.',
      frequency: 'Quarterly + Annual',
      owner: 'Finance Lead'
    },
    'quarterly-publish': {
      title: 'Quarterly Published Reports',
      section: '2.2 Governance',
      status: 'mandatory',
      quote: '"Publish quarterly financial and activity reports at practice level, shared with all practices and the ICB"',
      context: 'Must include: appointment contribution, utilisation rates, financial allocation, patient feedback themes.',
      frequency: 'Quarterly',
      owner: 'Programme Manager'
    },
    'benefits-realisation': {
      title: 'Benefits Realisation Programme',
      section: '2.2 Outcomes',
      status: 'mandatory',
      quote: '"Generate and participate in a Benefits Realisation Programme to ensure the programme delivers anticipated value"',
      context: 'Track cashable savings, non-cashable benefits, strategic goal progress, risk mitigation outcomes.',
      frequency: 'Quarterly',
      owner: 'Programme Manager'
    },

    // Innovator Site
    'innovator-learning': {
      title: 'Shared Learning',
      section: '2.3 Innovator Sites',
      status: 'mandatory',
      quote: '"Innovator sites will receive Innovator status and are required to share learning to support other Neighbourhoods"',
      context: 'Test model design, validate assumptions, share findings at local/regional/national level.',
      frequency: 'Ongoing + Annual Report',
      owner: 'Programme Manager'
    },
    'model-testing': {
      title: 'Model Testing',
      section: '2.3 Innovator Sites',
      status: 'mandatory',
      quote: '"Test the model of care design to establish suitability for future Innovator sites"',
      context: 'Includes: patient triage, referral processes, pathology at scale, pooled medicines budget, activity/financial modelling.',
      frequency: 'Ongoing',
      owner: 'Programme Manager'
    },
    'icb-presentations': {
      title: 'ICB Presentations Support',
      section: '2.3 Innovator Sites',
      status: 'mandatory',
      quote: '"Support ICB presentations at local, regional and national level"',
      context: 'Virtual meetings, face-to-face, training events, conferences as required.',
      frequency: 'As required',
      owner: 'Programme Manager'
    },

    // Governance
    'foi': {
      title: 'FOI Responses',
      section: 'Appendix 1',
      status: 'mandatory',
      quote: '"Respond to FOI requests within 20 working days in line with Freedom of Information Act 2000"',
      context: 'Legal requirement applying to GP Practices and/or SNO.',
      frequency: 'As required',
      owner: 'Information Governance Lead'
    },
    'dspt': {
      title: 'Data Security & Protection Toolkit',
      section: 'Appendix 1',
      status: 'mandatory',
      quote: '"Complete DSPT — Standards Met; Registered with ICO; Named SIRO, Caldicott Guardian, and IG Lead"',
      context: 'Annual DSPT submission required. Multiple data protection requirements apply.',
      frequency: 'Annual',
      owner: 'Information Governance Lead'
    },
    'insurance': {
      title: 'Insurance Requirements',
      section: 'Appendix 1',
      status: 'mandatory',
      quote: '"Minimum cover: Employer\'s Liability £5M, Public Liability £10M, Professional Negligence £5M, Clinical Negligence £10M"',
      context: 'Annual verification of appropriate insurance coverage.',
      frequency: 'Annual',
      owner: 'Finance Lead'
    },
    'business-continuity': {
      title: 'Business Continuity',
      section: 'Appendix 1',
      status: 'mandatory',
      quote: '"Business continuity processes in place to ensure service sustainability as a result of unexpected interruptions"',
      context: 'Must cover: workforce, estate, IT systems, other events. Contingency plan required.',
      frequency: 'Annual Review',
      owner: 'Operations Manager'
    },
    'escalation': {
      title: 'Non-Compliance Escalation',
      section: '2.2 Governance',
      status: 'mandatory',
      quote: '"Practices and neighbourhoods will be subject to performance review if: incomplete data submission, activity requirements not met, forecast outcomes not achieved"',
      context: 'Escalating actions: data interrogation → remodelling → frequent submissions → quality reviews → termination/clawback.',
      frequency: 'As triggered',
      owner: 'ICB Contract Lead'
    }
  };

  // ==================== ICB REQUIREMENT TOOLTIP COMPONENT ====================
  const ICBRequirementTooltip = ({ requirementId, children, position = 'bottom' }: { requirementId: string; children: React.ReactNode; position?: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const req = icbRequirements[requirementId];
    
    if (!req) return <>{children}</>;

    const statusColors = {
      mandatory: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', label: 'MANDATORY' },
      suggested: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', label: 'SUGGESTED' },
      'nice-to-have': { bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-700', label: 'NICE TO HAVE' }
    };
    const status = statusColors[req.status] || statusColors.suggested;

    return (
      <div 
        className="relative inline-flex items-center"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        {children}
        <button
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          className="ml-1.5 p-0.5 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-300"
        >
          <Info className="w-4 h-4 text-amber-500 hover:text-amber-600" />
        </button>
        
        {isOpen && (
          <>
            {/* Backdrop to help with z-index stacking */}
            <div className="fixed inset-0 z-40" style={{ pointerEvents: 'none' }} />
            
            {/* Tooltip - fixed positioning for reliable display */}
            <div 
              className={`fixed z-50 w-80 ${status.bg} ${status.border} border rounded-lg shadow-2xl`}
              style={{ 
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                maxWidth: '90vw',
                maxHeight: '80vh',
                overflow: 'auto'
              }}
            >
              {/* Close button */}
              <button 
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-200 transition-colors z-10"
              >
                <span className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</span>
              </button>
              
              {/* Header */}
              <div className="p-3 border-b border-gray-200 bg-white rounded-t-lg">
                <div className="flex items-center justify-between mb-1 pr-6">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${status.badge}`}>
                    {status.label}
                  </span>
                  <span className="text-xs text-gray-500">{req.section}</span>
                </div>
                <h4 className="font-semibold text-gray-800 text-sm">{req.title}</h4>
              </div>
              
              {/* Quote */}
              <div className="p-3 border-b border-gray-100">
                <div className="flex gap-2">
                  <span className="text-amber-500 text-lg leading-none">"</span>
                  <p className="text-xs text-gray-700 italic flex-1">{req.quote}</p>
                  <span className="text-amber-500 text-lg leading-none self-end">"</span>
                </div>
              </div>
              
              {/* Context */}
              <div className="p-3 border-b border-gray-100">
                <p className="text-xs text-gray-600">{req.context}</p>
              </div>
              
              {/* Footer */}
              <div className="p-3 bg-white rounded-b-lg">
                <div className="flex justify-between text-xs">
                  <div>
                    <span className="text-gray-500">Frequency:</span>
                    <span className="ml-1 font-medium text-gray-700">{req.frequency}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Owner:</span>
                    <span className="ml-1 font-medium text-gray-700">{req.owner}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // Navigation structure
  const sections = [
    { id: 'overview', label: 'Programme Overview', icon: FileText, subSections: ['context', 'governance', 'timeline', 'consequences'] },
    { id: 'activity', label: 'Activity & Performance', icon: BarChart3, subSections: ['targets', 'utilisation', 'access', 'equity'] },
    { id: 'quality', label: 'Quality & Safety', icon: Shield, subSections: ['complaints', 'safeguarding', 'incidents', 'ipc', 'effectiveness'] },
    { id: 'referrals', label: 'Referrals & Diagnostics', icon: Stethoscope, subSections: ['onward', 'diagnostics', 'pathology', 'emas'] },
    { id: 'prescribing', label: 'Prescribing & Medicines', icon: Pill, subSections: ['formulary', 'paf', 'costs', 'audit'] },
    { id: 'workforce', label: 'Workforce & Training', icon: Users, subSections: ['establishment', 'satisfaction', 'retention', 'training'] },
    { id: 'partb', label: 'Part B: Complex Care', icon: Heart, subSections: ['cohorts', 'continuity', 'duration', 'respect'] },
    { id: 'financial', label: 'Financial Reporting', icon: Banknote, subSections: ['openbook', 'spend', 'benefits', 'quarterly'] },
    { id: 'innovator', label: 'Innovator Site Duties', icon: Target, subSections: ['learning', 'presentations', 'testing', 'evaluation'] },
    { id: 'governance', label: 'Governance & Compliance', icon: Scale, subSections: ['board', 'foi', 'data', 'insurance'] },
  ];

  const practices = [
    { name: 'The Parks Medical Centre', patients: 25500, share: '28.5%', lead: 'TBC', status: 'pending' },
    { name: 'Brackley Medical Centre', patients: 16200, share: '18.1%', lead: 'Amanda Palin', status: 'confirmed' },
    { name: 'Springfield Surgery', patients: 12600, share: '14.1%', lead: 'TBC', status: 'pending' },
    { name: 'Towcester Medical Centre', patients: 11700, share: '13.1%', lead: 'TBC', status: 'pending' },
    { name: 'Bugbrooke Surgery', patients: 10800, share: '12.0%', lead: 'TBC', status: 'pending' },
    { name: 'Brook Health Centre', patients: 9000, share: '10.1%', lead: 'TBC', status: 'pending' },
    { name: 'Denton Village Practice', patients: 3784, share: '4.2%', lead: 'TBC', status: 'pending' },
  ];

  // ==================== REUSABLE COMPONENTS ====================

  const MetricCard = ({ title, value, subtitle, color = 'gray', trend, icon: Icon, size = 'normal', requirementId }: { title: string; value: string; subtitle: string; color?: string; trend?: number; icon?: any; size?: string; requirementId?: string }) => (
    <div className={`bg-white rounded-lg border border-gray-100 shadow-sm ${size === 'large' ? 'p-6' : 'p-4'} relative`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center">
          <span className="text-xs text-gray-500 uppercase tracking-wide">{title}</span>
          {requirementId && <ICBRequirementTooltip requirementId={requirementId} position="bottom"><span /></ICBRequirementTooltip>}
        </div>
        {Icon && <Icon className="w-4 h-4 text-gray-400" />}
      </div>
      <div className={`font-bold ${size === 'large' ? 'text-3xl' : 'text-2xl'} ${
        color === 'green' ? 'text-emerald-500' : 
        color === 'amber' ? 'text-amber-500' : 
        color === 'red' ? 'text-red-500' : 
        color === 'blue' ? 'text-blue-500' :
        color === 'purple' ? 'text-purple-500' :
        'text-gray-800'
      }`}>
        {value}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-gray-500">{subtitle}</span>
        {trend && (
          <span className={`text-xs font-medium ${trend > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  );

  const RequirementBlock = ({ id, title, reference, frequency, mandatory, children, status = 'required', requirementId }: { id: string; title: string; reference?: string; frequency: string; mandatory?: boolean; children: React.ReactNode; status?: string; requirementId?: string }) => (
    <div className={`border rounded-lg overflow-hidden mb-4 ${
      mandatory ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 bg-white'
    }`}>
      <button
        onClick={() => toggleRequirement(id)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${
            status === 'required' ? 'bg-amber-500' :
            status === 'complete' ? 'bg-emerald-500' :
            'bg-gray-300'
          }`} />
          {mandatory && (
            <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded font-medium">
              MANDATORY
            </span>
          )}
          <span className="font-medium text-gray-800">{title}</span>
          {requirementId && <ICBRequirementTooltip requirementId={requirementId} position="right"><span /></ICBRequirementTooltip>}
        </div>
        <div className="flex items-center gap-3">
          {reference && (
            <span className="text-xs text-gray-400">{reference}</span>
          )}
          <span className={`text-xs px-2 py-1 rounded ${
            frequency === 'Monthly' ? 'bg-blue-100 text-blue-700' :
            frequency === 'Quarterly' ? 'bg-purple-100 text-purple-700' :
            frequency === 'Annual' ? 'bg-emerald-100 text-emerald-700' :
            frequency === 'Ad-hoc' ? 'bg-gray-100 text-gray-700' :
            'bg-gray-100 text-gray-600'
          }`}>{frequency}</span>
          {expandedRequirements[id] ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>
      {expandedRequirements[id] && (
        <div className="px-4 pb-4 border-t border-gray-100 bg-white">
          {children}
        </div>
      )}
    </div>
  );

  const DataFieldTable = ({ fields }: { fields: Array<{ name: string; description: string; required: boolean; format: string }> }) => (
    <div className="mt-4 bg-gray-50 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left p-3 font-medium text-gray-700">Field Name</th>
            <th className="text-left p-3 font-medium text-gray-700">Description</th>
            <th className="text-center p-3 font-medium text-gray-700">Required</th>
            <th className="text-left p-3 font-medium text-gray-700">Format</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, i) => (
            <tr key={i} className="border-t border-gray-200">
              <td className="p-3 font-mono text-xs text-blue-600">{field.name}</td>
              <td className="p-3 text-gray-600">{field.description}</td>
              <td className="p-3 text-center">
                {field.required ? (
                  <CheckSquare className="w-4 h-4 text-emerald-500 mx-auto" />
                ) : (
                  <MinusSquare className="w-4 h-4 text-gray-300 mx-auto" />
                )}
              </td>
              <td className="p-3 text-xs text-gray-500">{field.format}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const ExplainerBox = ({ title, children, type = 'info', requirementId }: { title?: string; children: React.ReactNode; type?: string; requirementId?: string }) => (
    <div className={`rounded-lg mb-4 ${
      type === 'info' ? 'bg-blue-50 border border-blue-100' :
      type === 'warning' ? 'bg-amber-50 border border-amber-100' :
      type === 'danger' ? 'bg-red-50 border border-red-100' :
      type === 'success' ? 'bg-emerald-50 border border-emerald-100' :
      type === 'icb' ? 'bg-purple-50 border border-purple-100' :
      'bg-gray-50 border border-gray-100'
    }`}>
      <div className="p-4 flex items-start gap-3">
        {type === 'info' && <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />}
        {type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />}
        {type === 'danger' && <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />}
        {type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />}
        {type === 'icb' && <Building2 className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />}
        <div className="flex-1">
          {title && (
            <div className="flex items-center gap-2 mb-1">
              <p className={`font-semibold text-sm ${
                type === 'info' ? 'text-blue-800' :
                type === 'warning' ? 'text-amber-800' :
                type === 'danger' ? 'text-red-800' :
                type === 'success' ? 'text-emerald-800' :
                type === 'icb' ? 'text-purple-800' :
                'text-gray-800'
              }`}>{title}</p>
              {requirementId && <ICBRequirementTooltip requirementId={requirementId} position="right"><span /></ICBRequirementTooltip>}
            </div>
          )}
          <div className="text-sm text-gray-700">{children}</div>
        </div>
      </div>
    </div>
  );

  const ProgressBar = ({ label, value, max = 100, target, color = 'amber', showValue = true, requirementId }: { label: string; value: number; max?: number; target?: number; color?: string; showValue?: boolean; requirementId?: string }) => (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <div className="flex items-center">
          <span className="text-gray-600">{label}</span>
          {requirementId && <ICBRequirementTooltip requirementId={requirementId} position="right"><span /></ICBRequirementTooltip>}
        </div>
        <div className="flex items-center gap-2">
          {target && (
            <span className="text-xs text-gray-400">Target: {target}%</span>
          )}
          {showValue && (
            <span className={`font-medium ${
              color === 'green' ? 'text-emerald-600' :
              color === 'amber' ? 'text-amber-600' :
              color === 'red' ? 'text-red-600' :
              'text-gray-600'
            }`}>{value}%</span>
          )}
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative">
        <div 
          className={`h-full rounded-full ${
            color === 'green' ? 'bg-emerald-400' :
            color === 'amber' ? 'bg-amber-400' :
            color === 'red' ? 'bg-red-400' :
            'bg-gray-400'
          }`}
          style={{ width: `${Math.min(value, max)}%` }}
        />
        {target && (
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-gray-600"
            style={{ left: `${target}%` }}
          />
        )}
      </div>
    </div>
  );

  const StatusBadge = ({ status }: { status: string }) => {
    const configs = {
      green: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'GREEN' },
      amber: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'AMBER' },
      red: { bg: 'bg-red-100', text: 'text-red-700', label: 'RED' },
      pending: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'PENDING' },
      confirmed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'CONFIRMED' },
    };
    const config = configs[status] || configs.pending;
    return (
      <span className={`${config.bg} ${config.text} text-xs px-2 py-0.5 rounded font-medium`}>
        {config.label}
      </span>
    );
  };

  const SectionHeader = ({ title, subtitle, icon: Icon }: { title: string; subtitle?: string; icon?: any }) => (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        {Icon && <Icon className="w-6 h-6 text-amber-500" />}
        <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
      </div>
      {subtitle && <p className="text-gray-500">{subtitle}</p>}
    </div>
  );

  const SubSectionNav = ({ items, active, onSelect }: { items: Array<{ id: string; label: string }>; active: string | null; onSelect: (id: string) => void }) => (
    <div className="flex gap-2 mb-6 flex-wrap">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            active === item.id
              ? 'bg-amber-100 text-amber-700 border border-amber-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );



  // ==================== SECTION RENDERERS ====================

  const renderOverview = () => (
    <div className="space-y-6">
      <SectionHeader 
        title="Programme Overview" 
        subtitle="Understanding the NRES SDA contract structure, governance, and reporting framework"
        icon={FileText}
      />



      <SubSectionNav 
        items={[
          { id: 'context', label: 'Programme Context' },
          { id: 'governance', label: 'Governance Structure' },
          { id: 'timeline', label: 'Reporting Timeline' },
          { id: 'consequences', label: 'Non-Compliance' },
        ]}
        active={activeSubSection || 'context'}
        onSelect={setActiveSubSection}
      />

      {/* Key Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard title="Neighbourhood" value="NRES" subtitle="Rural East & South" color="purple" icon={Building2} />
        <MetricCard title="Practices" value="7" subtitle="GP practices" icon={Building2} />
        <MetricCard title="Population" value="89,584" subtitle="Registered patients" icon={Users} />
        <MetricCard title="Contract Value" value="£2.36M" subtitle="£26.33 per patient" color="green" icon={Banknote} />
        <MetricCard title="Contract Term" value="2 Years" subtitle="Min. from April 2026" icon={Calendar} />
      </div>

      {(!activeSubSection || activeSubSection === 'context') && (
        <>
          <ExplainerBox title="What is the New Models Programme?" type="icb">
            <p className="mb-3">The New Models Programme is the ICB's response to delivering <strong>Integrated Neighbourhood Health Services</strong> as outlined in three key national policy documents:</p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                <span><strong>Fuller Stocktake Report (May 2022)</strong> — Vision for modern general practice and neighbourhood teams</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                <span><strong>Darzi Report (2024)</strong> — Independent investigation of NHS in England</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                <span><strong>NHS Neighbourhood Guidelines (January 2025)</strong> — Operational framework for neighbourhood health</span>
              </li>
            </ul>
          </ExplainerBox>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-500" />
              The 50/50 Ambition
              <ICBRequirementTooltip requirementId="partab-linkage" position="right"><span /></ICBRequirementTooltip>
            </h3>
            <p className="text-gray-600 mb-4">At the heart of the programme is protecting <strong>50% of GP time</strong> for enhanced complex care and long-term condition management. Currently, GPs spend up to 90% of their time on reactive care.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <h4 className="font-medium text-blue-800 mb-3">Part A: Neighbourhood Access Service</h4>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5" />
                    <span>22% additionality from direct funding</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5" />
                    <span>18% from innovation and efficiencies</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5" />
                    <span>= 40% additional reactive capacity</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5" />
                    <span>Low complexity, less continuity needed</span>
                  </li>
                </ul>
              </div>
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
                <h4 className="font-medium text-emerald-800 mb-3">Part B: Complex Care Service</h4>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li className="flex items-start gap-2">
                    <Heart className="w-4 h-4 text-emerald-500 mt-0.5" />
                    <span>Protected time from Part A capacity</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Heart className="w-4 h-4 text-emerald-500 mt-0.5" />
                    <span>High complexity, continuity paramount</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Heart className="w-4 h-4 text-emerald-500 mt-0.5" />
                    <span>Longer appointment lengths (30+ mins)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Heart className="w-4 h-4 text-emerald-500 mt-0.5" />
                    <span>Named GP for specific cohorts</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              NRES Neighbourhood Practices
              <ICBRequirementTooltip requirementId="named-reporting-leads" position="right"><span /></ICBRequirementTooltip>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 font-medium">Practice</th>
                    <th className="text-right p-3 font-medium">List Size</th>
                    <th className="text-right p-3 font-medium">% Share</th>
                    <th className="text-right p-3 font-medium">Weekly Target</th>
                    <th className="text-left p-3 font-medium">Reporting Lead</th>
                    <th className="text-center p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {practices.map((p, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="p-3 font-medium">{p.name}</td>
                      <td className="p-3 text-right">{p.patients.toLocaleString()}</td>
                      <td className="p-3 text-right">{p.share}</td>
                      <td className="p-3 text-right text-blue-600">{Math.round(p.patients * 15.2 / 1000)}</td>
                      <td className="p-3">{p.lead}</td>
                      <td className="p-3 text-center">
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-medium">
                    <td className="p-3">TOTAL</td>
                    <td className="p-3 text-right">89,584</td>
                    <td className="p-3 text-right">100%</td>
                    <td className="p-3 text-right text-blue-600">1,362</td>
                    <td className="p-3" colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ExplainerBox title="Named Reporting Leads Required" type="warning" requirementId="named-reporting-leads">
              <p>Each practice <strong>MUST</strong> nominate a named reporting lead responsible for timely and accurate data submission (ICB Section 2.2.1). Only Brackley MC has confirmed their lead — all other practices need to nominate urgently.</p>
            </ExplainerBox>
          </div>
        </>
      )}

      {activeSubSection === 'governance' && (
        <>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-500" />
              Single Nominated Organisation (SNO) Requirements
              <ICBRequirementTooltip requirementId="open-book" position="right"><span /></ICBRequirementTooltip>
            </h3>
            <p className="text-gray-600 mb-4">PCN Services Ltd acts as the Single Nominated Organisation, responsible for:</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Banknote className="w-5 h-5 text-emerald-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Financial Management</p>
                    <p className="text-xs text-gray-500">Managing 'held funds' for all practices — funds cannot be disaggregated back to practices for GMS/DES/LES services</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Programme Board</p>
                    <p className="text-xs text-gray-500">Establishing governance with representation from each practice — ICB relationship is with Board, not individual practices</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Target className="w-5 h-5 text-purple-500 mt-0.5" />
                  <div className="flex items-start gap-1">
                    <div>
                      <p className="font-medium text-sm">Benefits Realisation</p>
                      <p className="text-xs text-gray-500">Generating and participating in programme to ensure anticipated value is delivered</p>
                    </div>
                    <ICBRequirementTooltip requirementId="benefits-realisation" position="left"><span /></ICBRequirementTooltip>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Eye className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div className="flex items-start gap-1">
                    <div>
                      <p className="font-medium text-sm">Open Book Approach</p>
                      <p className="text-xs text-gray-500">Sharing activity, performance, financial and workforce breakdowns with ICB</p>
                    </div>
                    <ICBRequirementTooltip requirementId="open-book" position="left"><span /></ICBRequirementTooltip>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Risk Escalation</p>
                    <p className="text-xs text-gray-500">Immediately informing ICB of major risks that could derail the programme</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <FileText className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div className="flex items-start gap-1">
                    <div>
                      <p className="font-medium text-sm">Quarterly Publishing</p>
                      <p className="text-xs text-gray-500">Financial and activity reports at practice level, shared with all practices and ICB</p>
                    </div>
                    <ICBRequirementTooltip requirementId="quarterly-publish" position="left"><span /></ICBRequirementTooltip>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeSubSection === 'timeline' && (
        <>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              Complete Reporting Schedule
            </h3>
            
            <div className="space-y-6">
              {/* Monthly */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <h4 className="font-medium text-blue-800">Monthly Submissions</h4>
                  <span className="text-xs text-gray-500">Due by 10th of following month</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 ml-5">
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <p className="font-medium text-sm flex items-center gap-1">
                      Activity & Performance
                      <ICBRequirementTooltip requirementId="utilisation" position="bottom"><span /></ICBRequirementTooltip>
                    </p>
                    <ul className="text-xs text-gray-600 mt-2 space-y-1">
                      <li>• Utilisation rates (by practice)</li>
                      <li>• Outcomes</li>
                      <li>• Onward referrals</li>
                      <li>• Diagnostics ordered</li>
                      <li>• Access times</li>
                      <li>• Repeat attendances</li>
                      <li>• Unmet demand</li>
                    </ul>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <p className="font-medium text-sm flex items-center gap-1">
                      Quality
                      <ICBRequirementTooltip requirementId="complaints" position="bottom"><span /></ICBRequirementTooltip>
                    </p>
                    <ul className="text-xs text-gray-600 mt-2 space-y-1">
                      <li>• Complaints (volume, themes)</li>
                      <li>• Incidents</li>
                      <li>• Safeguarding referrals</li>
                      <li>• IPC compliance</li>
                      <li>• Patient experience (FFT)</li>
                      <li>• Effectiveness metrics</li>
                      <li>• Training/workforce updates</li>
                    </ul>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <p className="font-medium text-sm flex items-center gap-1">
                      Mandatory Narrative
                      <ICBRequirementTooltip requirementId="mandatory-narrative" position="bottom"><span /></ICBRequirementTooltip>
                    </p>
                    <ul className="text-xs text-gray-600 mt-2 space-y-1">
                      <li>• Performance variances</li>
                      <li>• Actions for underperformance</li>
                      <li>• Patient feedback evidence</li>
                      <li>• Incident learning</li>
                      <li>• Staff feedback implementation</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Quarterly */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <h4 className="font-medium text-purple-800">Quarterly Submissions</h4>
                  <span className="text-xs text-gray-500">Due within 15 working days of quarter end</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 ml-5">
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                    <p className="font-medium text-sm flex items-center gap-1">
                      Financial Reports
                      <ICBRequirementTooltip requirementId="open-book" position="bottom"><span /></ICBRequirementTooltip>
                    </p>
                    <ul className="text-xs text-gray-600 mt-2 space-y-1">
                      <li>• Detailed spend breakdown</li>
                      <li>• Practice-level allocation</li>
                      <li>• Prescribing costs</li>
                      <li>• Variance analysis</li>
                    </ul>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                    <p className="font-medium text-sm flex items-center gap-1">
                      Staff Satisfaction
                      <ICBRequirementTooltip requirementId="staff-satisfaction" position="bottom"><span /></ICBRequirementTooltip>
                    </p>
                    <ul className="text-xs text-gray-600 mt-2 space-y-1">
                      <li>• Survey results</li>
                      <li>• Recruitment pipeline</li>
                      <li>• Retention rates</li>
                      <li>• Training completion</li>
                    </ul>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                    <p className="font-medium text-sm flex items-center gap-1">
                      Benefits Realisation
                      <ICBRequirementTooltip requirementId="benefits-realisation" position="bottom"><span /></ICBRequirementTooltip>
                    </p>
                    <ul className="text-xs text-gray-600 mt-2 space-y-1">
                      <li>• Cashable savings</li>
                      <li>• Non-cashable benefits</li>
                      <li>• Strategic goal progress</li>
                      <li>• Risk mitigation outcomes</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Annual */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <h4 className="font-medium text-emerald-800">Annual Submissions</h4>
                  <span className="text-xs text-gray-500">Due by 31 March</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 ml-5">
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                    <p className="font-medium text-sm">Neighbourhood Plan</p>
                    <ul className="text-xs text-gray-600 mt-2 space-y-1">
                      <li>• Complex care outcomes</li>
                      <li>• LTC management strategy</li>
                      <li>• Integration roadmap</li>
                    </ul>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                    <p className="font-medium text-sm">Open Book Financials</p>
                    <ul className="text-xs text-gray-600 mt-2 space-y-1">
                      <li>• Full activity breakdown</li>
                      <li>• Workforce costs</li>
                      <li>• Model assumptions review</li>
                    </ul>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                    <p className="font-medium text-sm flex items-center gap-1">
                      Innovator Learnings
                      <ICBRequirementTooltip requirementId="innovator-learning" position="bottom"><span /></ICBRequirementTooltip>
                    </p>
                    <ul className="text-xs text-gray-600 mt-2 space-y-1">
                      <li>• Model evaluation</li>
                      <li>• Innovation outcomes</li>
                      <li>• Shared learning report</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeSubSection === 'consequences' && (
        <>
          <ExplainerBox title="Performance Review Triggers" type="danger" requirementId="escalation">
            <p className="mb-3">Practices and neighbourhoods will be subject to performance review by the Programme Board if:</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <XSquare className="w-4 h-4 text-red-500 mt-0.5" />
                <span>Incomplete data submission within agreed timeframe</span>
              </li>
              <li className="flex items-start gap-2">
                <XSquare className="w-4 h-4 text-red-500 mt-0.5" />
                <span>Activity requirements not met</span>
              </li>
              <li className="flex items-start gap-2">
                <XSquare className="w-4 h-4 text-red-500 mt-0.5" />
                <span>Forecast outcomes not achieved</span>
              </li>
            </ul>
          </ExplainerBox>

          <div className="bg-white rounded-lg border border-red-200 p-6">
            <h3 className="font-semibold text-red-800 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Escalating Actions for Non-Compliance
            </h3>
            <div className="space-y-3">
              {[
                { level: 1, action: 'Further interrogation of data', desc: 'ICB requests detailed breakdown and explanation' },
                { level: 2, action: 'Remodelling capacity and activity', desc: 'Review of allocation and targets' },
                { level: 3, action: 'More frequent data submissions', desc: 'Weekly instead of monthly reporting' },
                { level: 4, action: 'Quality reviews', desc: 'On-site assessment and audit' },
                { level: 5, action: 'Contract termination and/or clawback', desc: 'Ultimate sanction — funds recovered' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-red-50 rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    item.level <= 2 ? 'bg-amber-500' : item.level <= 4 ? 'bg-orange-500' : 'bg-red-600'
                  }`}>
                    {item.level}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{item.action}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-amber-200 p-6">
            <h3 className="font-semibold text-amber-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Part A ↔ Part B Linkage Enforcement
              <ICBRequirementTooltip requirementId="partab-linkage" position="right"><span /></ICBRequirementTooltip>
            </h3>
            <p className="text-gray-600 mb-4">Continued access to Part A 'held funds' is <strong>conditional</strong> on demonstrable delivery of Part B commitments.</p>
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="font-medium text-amber-800 mb-2">Practices failing minimum thresholds for proactive care delivery may face:</p>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-amber-600" />
                  Performance improvement plans
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-amber-600" />
                  Reallocation of appointments in the Neighbourhood Access Service
                </li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderActivity = () => (
    <div className="space-y-6">
      <SectionHeader 
        title="Activity & Performance" 
        subtitle="Tracking NAS capacity, utilisation, access times, and equity across the neighbourhood"
        icon={BarChart3}
      />



      <SubSectionNav 
        items={[
          { id: 'targets', label: 'Activity Targets' },
          { id: 'utilisation', label: 'Utilisation Reporting' },
          { id: 'access', label: 'Access & Demand' },
          { id: 'equity', label: 'Equity Monitoring' },
        ]}
        active={activeSubSection || 'targets'}
        onSelect={setActiveSubSection}
      />

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <MetricCard title="Weekly Standard" value="1,362" subtitle="15.2 per 1,000" color="blue" requirementId="activity-targets" />
        <MetricCard title="Winter Surge" value="1,630" subtitle="18.2 per 1,000" color="amber" requirementId="activity-targets" />
        <MetricCard title="GP Sessions" value="50%" subtitle="Of total capacity" />
        <MetricCard title="ANP/ACP" value="50%" subtitle="Of total capacity" />
        <MetricCard title="Virtual Max" value="50%" subtitle="Remote appointments" />
        <MetricCard title="Appt Length" value="15 min" subtitle="Standard slot" />
      </div>

      {(!activeSubSection || activeSubSection === 'targets') && (
        <>
          <ExplainerBox title="How the 15.2 appointments/week/1,000 is calculated" type="info" requirementId="activity-targets">
            <p>The ICB has modelled activity based on workforce mix (50% GP, 50% ANP/ACP), session productivity (15 GP appointments per session, 24 ANP/ACP per day), and 15-minute standard appointments. Winter surge adds 20% capacity for 13 weeks.</p>
          </ExplainerBox>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Practice-Level Activity Targets</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 font-medium">Practice</th>
                    <th className="text-right p-3 font-medium">List Size</th>
                    <th className="text-right p-3 font-medium">Weekly (Std)</th>
                    <th className="text-right p-3 font-medium">Weekly (Surge)</th>
                    <th className="text-right p-3 font-medium">Annual Target</th>
                    <th className="text-right p-3 font-medium">Contract Value</th>
                  </tr>
                </thead>
                <tbody>
                  {practices.map((p, i) => {
                    const weeklyStd = Math.round(p.patients * 15.2 / 1000);
                    const weeklySurge = Math.round(p.patients * 18.2 / 1000);
                    const annual = Math.round((weeklyStd * 39) + (weeklySurge * 13));
                    const value = Math.round(p.patients * 26.33);
                    return (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="p-3 font-medium">{p.name}</td>
                        <td className="p-3 text-right">{p.patients.toLocaleString()}</td>
                        <td className="p-3 text-right text-blue-600">{weeklyStd}</td>
                        <td className="p-3 text-right text-amber-600">{weeklySurge}</td>
                        <td className="p-3 text-right font-medium">{annual.toLocaleString()}</td>
                        <td className="p-3 text-right text-emerald-600">£{value.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50 font-bold">
                    <td className="p-3">TOTAL</td>
                    <td className="p-3 text-right">89,584</td>
                    <td className="p-3 text-right text-blue-600">1,362</td>
                    <td className="p-3 text-right text-amber-600">1,630</td>
                    <td className="p-3 text-right">74,316</td>
                    <td className="p-3 text-right text-emerald-600">£2,359,177</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeSubSection === 'utilisation' && (
        <RequirementBlock
          id="util-practice"
          title="Utilisation Rates by Practice"
          reference="ICB 2.2.1"
          frequency="Monthly"
          mandatory
          requirementId="utilisation"
        >
          <p className="text-sm text-gray-600 mt-3 mb-4">Report the percentage of available NAS slots that were filled, broken down by practice. ICB monitors for equity of utilisation.</p>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-medium mb-3">Example Dashboard View</h4>
            {practices.map((p, i) => {
              const util = [94.2, 91.8, 88.5, 92.1, 87.3, 89.6, 78.4][i];
              return (
                <ProgressBar 
                  key={i} 
                  label={p.name} 
                  value={util} 
                  target={85}
                  color={util >= 85 ? 'green' : util >= 75 ? 'amber' : 'red'}
                />
              );
            })}
          </div>

          <DataFieldTable fields={[
            { name: 'practice_code', description: 'ODS code of the practice', required: true, format: 'String' },
            { name: 'reporting_period', description: 'Month/year of report', required: true, format: 'YYYY-MM' },
            { name: 'slots_available', description: 'Total NAS slots for practice', required: true, format: 'Integer' },
            { name: 'slots_booked', description: 'Slots that were filled', required: true, format: 'Integer' },
            { name: 'slots_dna', description: 'Did not attend', required: true, format: 'Integer' },
            { name: 'utilisation_rate', description: 'Calculated percentage', required: true, format: 'Decimal' },
          ]} />
        </RequirementBlock>
      )}

      {activeSubSection === 'access' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard title="Unmet Demand" value="23" subtitle="Unable to book" color="red" icon={AlertTriangle} requirementId="unmet-demand" />
            <MetricCard title="Repeat Attenders" value="142" subtitle="2+ visits in 4 weeks" color="amber" requirementId="repeat-attendance" />
            <MetricCard title="Under-5 F2F" value="100%" subtitle="Compliance" color="green" icon={CheckCircle2} requirementId="under5-f2f" />
            <MetricCard title="EMAS Bookings" value="18" subtitle="Ambulance referrals" color="blue" icon={Ambulance} requirementId="emas-integration" />
          </div>

          <RequirementBlock
            id="unmet-demand"
            title="Unmet Demand — Patients Unable to Book"
            reference="ICB 2.2.1"
            frequency="Monthly"
            mandatory
            requirementId="unmet-demand"
          >
            <p className="text-sm text-gray-600 mt-3 mb-4">Track patients who tried to book a NAS appointment but couldn't get one due to lack of availability. This is a <strong>key ICB metric</strong> for measuring access failures.</p>
            
            <div className="bg-red-50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-4">
                <AlertTriangle className="w-10 h-10 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-700">23 patients</p>
                  <p className="text-sm text-gray-600">Unable to book this month</p>
                </div>
              </div>
            </div>

            <DataFieldTable fields={[
              { name: 'date', description: 'Date of unmet demand', required: true, format: 'YYYY-MM-DD' },
              { name: 'practice_code', description: 'Patient registered practice', required: true, format: 'String' },
              { name: 'reason', description: 'Reason unable to book', required: true, format: 'Enum' },
              { name: 'outcome', description: 'What happened instead', required: true, format: 'Enum' },
            ]} />
          </RequirementBlock>
        </>
      )}

      {activeSubSection === 'equity' && (
        <RequirementBlock
          id="equity-practice"
          title="Practice Equity Breakdown"
          reference="ICB Equity Framework"
          frequency="Monthly"
          mandatory
          requirementId="equity-index"
        >
          <p className="text-sm text-gray-600 mt-3 mb-4">Compare each practice's share of NAS usage against their share of the registered population. Equity Index of 1.0 = perfect equity.</p>
          
          <div className="bg-emerald-50 rounded-lg p-6 text-center mb-4">
            <p className="text-sm text-gray-600 mb-2">Current Equity Index</p>
            <p className="text-5xl font-bold text-emerald-600">0.94</p>
            <p className="text-sm text-gray-500 mt-2">Target: 0.9 - 1.0</p>
          </div>
        </RequirementBlock>
      )}
    </div>
  );

  const renderQuality = () => (
    <div className="space-y-6">
      <SectionHeader 
        title="Quality & Safety" 
        subtitle="Complaints, safeguarding, incidents, IPC, and patient experience monitoring"
        icon={Shield}
      />



      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard title="Complaints (MTD)" value="3" subtitle="0 unresolved" color="amber" icon={FileWarning} requirementId="complaints" />
        <MetricCard title="Safeguarding" value="7" subtitle="Referrals this quarter" icon={Shield} requirementId="safeguarding" />
        <MetricCard title="IPC Compliance" value="98%" subtitle="Hub inspections" color="green" icon={CheckCircle2} requirementId="ipc" />
        <MetricCard title="Safety Events" value="0" subtitle="No incidents" color="green" requirementId="incidents" />
        <MetricCard title="FFT Positive" value="91.2%" subtitle="Target: ≥90%" color="green" requirementId="fft" />
      </div>

      <RequirementBlock
        id="mandatory-narrative"
        title="Mandatory Narrative Section"
        reference="ICB 2.2.1"
        frequency="Monthly + Quarterly"
        mandatory
        requirementId="mandatory-narrative"
      >
        <p className="text-sm text-gray-600 mt-3 mb-4">Every monthly and quarterly report <strong>MUST</strong> include narrative covering the following areas. This is a non-negotiable ICB requirement.</p>
        
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-medium text-amber-800 mb-3">📝 Required Narrative Content</h4>
          <div className="space-y-3">
            {[
              { title: 'Performance Variances', desc: 'Explain any deviation from targets — why did it happen?' },
              { title: 'Actions Taken', desc: 'What remedial actions were implemented for underperformance?' },
              { title: 'Patient Feedback Implementation', desc: 'Evidence of changes made based on FFT and complaints' },
              { title: 'Incident Learning', desc: 'What was learned from incidents (even if none occurred, state this)' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckSquare className="w-4 h-4 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-xs text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </RequirementBlock>
    </div>
  );

  const renderReferrals = () => (
    <div className="space-y-6">
      <SectionHeader 
        title="Referrals & Diagnostics" 
        subtitle="Onward referrals, diagnostic ordering, pathology, and EMAS integration"
        icon={Stethoscope}
      />



      <ExplainerBox title="Direct Referral Requirement" type="icb" requirementId="direct-referral">
        <p>Referrals must be made <strong>directly from NAS clinicians</strong> and should <strong>NOT be passed back to host practices</strong> to administrate. Target: ≥94% direct referrals.</p>
      </ExplainerBox>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard title="Onward Referrals" value="187" subtitle="From NAS this month" icon={ArrowRight} requirementId="onward-referrals" />
        <MetricCard title="Diagnostics" value="312" subtitle="Pathology + imaging" icon={Activity} requirementId="diagnostics" />
        <MetricCard title="Direct from NAS" value="94.1%" subtitle="Not passed to practice" color="green" icon={CheckCircle2} requirementId="direct-referral" />
        <MetricCard title="2WW Referrals" value="12" subtitle="Urgent cancer" color="red" icon={AlertTriangle} />
        <MetricCard title="Pathology Review" value="<24hrs" subtitle="Avg review time" color="green" requirementId="pathology-review" />
      </div>
    </div>
  );

  const renderPrescribing = () => (
    <div className="space-y-6">
      <SectionHeader 
        title="Prescribing & Medicines Management" 
        subtitle="Formulary compliance, PAF framework, and cost monitoring"
        icon={Pill}
      />



      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Formulary Comp." value="96.2%" subtitle="Target: ≥95%" color="green" icon={CheckCircle2} requirementId="formulary" />
        <MetricCard title="PAF Score" value="78/100" subtitle="Target: ≥75" color="green" icon={Target} requirementId="paf" />
        <MetricCard title="Antibiotic Rate" value="8.2%" subtitle="Of consultations" color="green" />
        <MetricCard title="Prescribing Cost" value="£38.4K" subtitle="Monthly NAS spend" color="blue" icon={Banknote} requirementId="prescribing-budget" />
      </div>

      <RequirementBlock
        id="paf"
        title="Prescribing Achievement Framework (PAF)"
        reference="ICB Medicines Optimisation"
        frequency="Quarterly"
        mandatory
        requirementId="paf"
      >
        <p className="text-sm text-gray-600 mt-3 mb-4">Neighbourhood approach for achieving and monitoring PAF indicators. Discussed during design phase with the neighbourhood and ICB.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-3">
            <ProgressBar label="Antibiotic prescribing rate" value={85} target={80} color="green" />
            <ProgressBar label="Broad-spectrum antibiotics %" value={72} target={75} color="amber" />
            <ProgressBar label="Repeat prescribing review" value={90} target={85} color="green" />
          </div>
          <div className="space-y-3">
            <ProgressBar label="Polypharmacy reviews completed" value={68} target={75} color="amber" />
            <ProgressBar label="Formulary adherence" value={96} target={95} color="green" requirementId="formulary" />
            <ProgressBar label="Cost per STAR-PU" value={80} target={85} color="green" />
          </div>
        </div>
      </RequirementBlock>
    </div>
  );

  const renderWorkforce = () => (
    <div className="space-y-6">
      <SectionHeader 
        title="Workforce & Training" 
        subtitle="Staffing establishment, satisfaction, retention, and student placements"
        icon={Users}
      />



      <ExplainerBox title="ICB Workforce Outcome" type="icb" requirementId="staff-satisfaction">
        <p><strong>Increased staff satisfaction, recruitment and retention</strong> is a defined ICB outcome (Section 2.2). The NAS must demonstrate that it creates an attractive, sustainable workforce environment.</p>
      </ExplainerBox>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Staff Satisfaction" value="4.1/5.0" subtitle="Quarterly survey" color="green" icon={Users} requirementId="staff-satisfaction" />
        <MetricCard title="Retention Rate" value="94.6%" subtitle="12-month rolling" color="green" icon={TrendingUp} />
        <MetricCard title="Training Places" value="8" subtitle="Student placements" color="green" icon={GraduationCap} requirementId="training-placements" />
        <MetricCard title="Backfill Comp." value="100%" subtitle="Clinical backfill" color="green" requirementId="clinical-backfill" />
      </div>
    </div>
  );

  const renderPartB = () => (
    <div className="space-y-6">
      <SectionHeader 
        title="Part B: Complex Care & Long-Term Conditions" 
        subtitle="Proactive care, continuity, ICB priority cohorts, and RESPECT plans"
        icon={Heart}
      />



      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Part B Avg Length" value="28.4 min" subtitle="Target: 30 min" color="green" icon={Clock} requirementId="partb-duration" />
        <MetricCard title="RESPECT Plans" value="847" subtitle="Completed (quarter)" color="green" icon={Heart} requirementId="respect-plans" />
        <MetricCard title="Named GP Coverage" value="89%" subtitle="Complex patients" color="green" />
        <MetricCard title="PNG 8-11 Patients" value="4,832" subtitle="Complex cohort" icon={Users} requirementId="priority-cohorts" />
      </div>

      <RequirementBlock
        id="priority-cohorts"
        title="ICB Priority Cohorts"
        reference="ICB Part B Specification"
        frequency="Monthly"
        mandatory
        requirementId="priority-cohorts"
      >
        <p className="text-sm text-gray-600 mt-3 mb-4">Specific patient groups requiring continuity of care. <span className="text-red-600 font-medium">ICB Priority</span> cohorts must be specifically addressed and reported.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {[
            { cohort: 'COPD / Asthma', priority: true, desc: 'Management plans, post-admission reviews, standby medication' },
            { cohort: 'RESPECT Plans', priority: true, desc: 'Not limited to EoL — all appropriate patients' },
            { cohort: 'Diabetes', priority: false, desc: 'Newly diagnosed support, poorly controlled optimisation' },
            { cohort: 'Frailty / Dementia', priority: false, desc: 'Including carers, named GP assignment' },
            { cohort: 'End of Life', priority: false, desc: 'Named GP, telephone check-ins' },
            { cohort: 'Mental Health', priority: false, desc: 'Low level MH, reduce escalations' },
          ].map((item, i) => (
            <div key={i} className={`p-3 rounded-lg ${item.priority ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                {item.priority && (
                  <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded font-medium">ICB Priority</span>
                )}
                <span className="font-medium text-sm">{item.cohort}</span>
              </div>
              <p className="text-xs text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </RequirementBlock>

      <ExplainerBox title="Part A / Part B Compliance Linkage" type="danger" requirementId="partab-linkage">
        <p className="mb-2">Continued access to Part A 'held funds' is <strong>CONDITIONAL</strong> on demonstrable delivery of Part B commitments.</p>
        <p>Practices failing minimum thresholds may face: performance improvement plans, reallocation of NAS appointments, or contract termination/clawback.</p>
      </ExplainerBox>
    </div>
  );

  const renderFinancial = () => (
    <div className="space-y-6">
      <SectionHeader 
        title="Financial Reporting" 
        subtitle="Open book approach, spend breakdown, benefits realisation"
        icon={Banknote}
      />



      <ExplainerBox title="Open Book Approach" type="icb" requirementId="open-book">
        <p>The SNO is required to undertake an <strong>Open Book approach</strong> to sharing information with the ICB, showing activity, performance, financial and workforce breakdowns, plus any other information critical to the future success of commissioning this service.</p>
      </ExplainerBox>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Contract Value" value="£2.36M" subtitle="Annual" color="green" size="large" icon={Banknote} />
        <MetricCard title="Per Patient" value="£26.33" subtitle="Annual rate" color="blue" />
        <MetricCard title="Quarterly Publish" value="Required" subtitle="Practice-level" color="amber" requirementId="quarterly-publish" />
        <MetricCard title="Benefits Tracking" value="Quarterly" subtitle="Realisation prog." color="purple" requirementId="benefits-realisation" />
      </div>
    </div>
  );

  const renderInnovator = () => (
    <div className="space-y-6">
      <SectionHeader 
        title="Innovator Site Duties" 
        subtitle="Learning sharing, presentations, model testing, and programme evolution"
        icon={Target}
      />



      <ExplainerBox title="Innovator Status" type="icb" requirementId="innovator-learning">
        <p>As an Innovator site, NRES has additional obligations beyond standard service delivery. These are designed to support the ICB in extending the programme to other neighbourhoods.</p>
      </ExplainerBox>

      <RequirementBlock
        id="innovator-learning"
        title="Shared Learning Requirements"
        reference="ICB Innovator Section"
        frequency="Ongoing"
        mandatory
        requirementId="innovator-learning"
      >
        <div className="space-y-3 mt-4">
          {[
            'Test the model of care design to establish suitability for future Innovator sites',
            'Test new ways of working for "at scale" delivery',
            'Review activity and financial modelling assumptions',
            'Share learning with ICB and other Neighbourhoods',
            'Support ICB presentations at local, regional and national level',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
              <Target className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{item}</span>
            </div>
          ))}
        </div>
      </RequirementBlock>
    </div>
  );

  const renderGovernance = () => (
    <div className="space-y-6">
      <SectionHeader 
        title="Governance & Compliance" 
        subtitle="FOI, data protection, insurance, and regulatory requirements"
        icon={Scale}
      />



      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="FOI Response" value="20 days" subtitle="Legal requirement" requirementId="foi" />
        <MetricCard title="DSPT Status" value="Standards Met" subtitle="Annual submission" color="green" requirementId="dspt" />
        <MetricCard title="Insurance" value="Compliant" subtitle="All minimums met" color="green" requirementId="insurance" />
        <MetricCard title="BCP" value="In Place" subtitle="Tested annually" color="green" requirementId="business-continuity" />
      </div>

      <RequirementBlock
        id="escalation"
        title="Non-Compliance Escalation Pathway"
        reference="ICB Governance"
        frequency="As triggered"
        mandatory
        requirementId="escalation"
      >
        <div className="space-y-3 mt-4">
          {[
            { level: 1, action: 'Further interrogation of data', owner: 'Programme Manager' },
            { level: 2, action: 'Remodelling capacity and activity', owner: 'Programme Board' },
            { level: 3, action: 'More frequent data submissions', owner: 'ICB Contract Lead' },
            { level: 4, action: 'Quality reviews', owner: 'ICB Quality Team' },
            { level: 5, action: 'Contract termination / clawback', owner: 'ICB Director' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                item.level <= 2 ? 'bg-amber-500' : item.level <= 4 ? 'bg-orange-500' : 'bg-red-600'
              }`}>
                {item.level}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-800">{item.action}</p>
                <p className="text-xs text-gray-500">Owner: {item.owner}</p>
              </div>
            </div>
          ))}
        </div>
      </RequirementBlock>
    </div>
  );

  // Main render
  const renderSection = () => {
    switch (activeSection) {
      case 'overview': return renderOverview();
      case 'activity': return renderActivity();
      case 'quality': return renderQuality();
      case 'referrals': return renderReferrals();
      case 'prescribing': return renderPrescribing();
      case 'workforce': return renderWorkforce();
      case 'partb': return renderPartB();
      case 'financial': return renderFinancial();
      case 'innovator': return renderInnovator();
      case 'governance': return renderGovernance();
      default: return renderOverview();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-gray-800">Notewell AI</span>
                <span className="text-amber-500">✦</span>
              </div>
              <span className="text-gray-300">|</span>
              <span className="text-gray-600 font-medium">ICB Reporting Requirements Guide</span>
              <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded font-medium">GOVERNANCE ESSENTIAL</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">7 Practices</span>
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">89,584 Patients</span>
              <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium">£2.36M</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 p-2 sticky top-20">
              <p className="text-xs text-gray-500 uppercase tracking-wide px-3 py-2 font-medium">Reporting Domains</p>
              {sections.map(section => (
                <button
                  key={section.id}
                  onClick={() => {
                    setActiveSection(section.id);
                    setActiveSubSection(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors mb-1 ${
                    activeSection === section.id
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <section.icon className={`w-4 h-4 ${activeSection === section.id ? 'text-amber-500' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium">{section.label}</span>
                </button>
              ))}
            </div>

            {/* Tooltip Legend */}
            <div className="bg-amber-50 rounded-lg border border-amber-200 p-3 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-medium text-amber-800">Info Icons</span>
              </div>
              <p className="text-xs text-gray-600">
                Hover over <Info className="w-3 h-3 text-amber-500 inline" /> icons throughout this guide to see full ICB requirement details including quotes, section references, and compliance status.
              </p>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {renderSection()}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              NRES ICB Reporting Requirements Guide v1.7 — Based on ICB New Models Programme Specification
            </p>
            <p className="text-xs text-gray-400">
              February 2026 — Northamptonshire ICB
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NRESReportingComprehensive;
