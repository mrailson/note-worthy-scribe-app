import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Globe, Lock, ShieldCheck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type RouteCategory = 'Core Service' | 'Admin' | 'CSO Governance' | 'Public' | 'Utility' | 'Meeting' | 'LG Capture' | 'Complaints' | 'Translation' | 'Policy' | 'Survey' | 'Training' | 'Unknown';

interface PageRoute {
  path: string;
  component: string;
  hasMenuLink: boolean;
  protection: string;
  description: string;
  category: RouteCategory;
}

const ROUTES: PageRoute[] = [
  // Core Services
  { path: '/', component: 'Index', hasMenuLink: true, protection: 'Public', description: 'Main landing page and dashboard', category: 'Core Service' },
  { path: '/ai4gp', component: 'AI4GP', hasMenuLink: true, protection: 'Public', description: 'AI for General Practice clinical assistant', category: 'Core Service' },
  { path: '/scribe', component: 'Scribe', hasMenuLink: true, protection: 'Public', description: 'GP Scribe consultation recording service', category: 'Core Service' },
  { path: '/gp-genie', component: 'GPGenie', hasMenuLink: true, protection: 'Public', description: 'GP Genie practice management AI assistant', category: 'Core Service' },
  { path: '/gp-translation', component: 'GPTranslationService', hasMenuLink: true, protection: 'Public', description: 'GP translation service for patient communications', category: 'Translation' },
  { path: '/mobile-translate', component: 'MobileTranslation', hasMenuLink: true, protection: 'Public', description: 'Mobile-optimised patient translation interface', category: 'Translation' },
  { path: '/enhanced-access', component: 'EnhancedAccess', hasMenuLink: true, protection: 'ProtectedRoute (enhanced_access)', description: 'Enhanced access services hub', category: 'Core Service' },
  { path: '/notebook-studio', component: 'NotebookStudio', hasMenuLink: true, protection: 'Public', description: 'Audio overview and notebook studio', category: 'Core Service' },
  { path: '/shared-drive', component: 'SharedDrive', hasMenuLink: true, protection: 'ProtectedRoute', description: 'Shared document drive for practices', category: 'Core Service' },
  { path: '/bp-calculator', component: 'BPCalculator', hasMenuLink: true, protection: 'Public', description: 'Blood pressure calculator and analysis', category: 'Core Service' },
  { path: '/surveys', component: 'Surveys', hasMenuLink: true, protection: 'ProtectedRoute (survey_manager_access)', description: 'Survey management dashboard', category: 'Survey' },
  
  // Complaints
  { path: '/complaints', component: 'ComplaintsSystem', hasMenuLink: true, protection: 'Public', description: 'Complaints management system', category: 'Complaints' },
  { path: '/complaints/:id', component: 'ComplaintDetails', hasMenuLink: false, protection: 'Public', description: 'Individual complaint detail view', category: 'Complaints' },
  { path: '/compliments/:id', component: 'ComplimentDetails', hasMenuLink: false, protection: 'Public', description: 'Individual compliment detail view', category: 'Complaints' },
  { path: '/complaints/:id/ai-report', component: 'ComplaintAIReport', hasMenuLink: false, protection: 'Public', description: 'AI-generated complaint analysis report', category: 'Complaints' },
  { path: '/complaints-guide', component: 'ComplaintsPresentationMode', hasMenuLink: false, protection: 'Public', description: 'Complaints guide presentation mode', category: 'Complaints' },
  { path: '/complaint-response/:token', component: 'ComplaintResponse', hasMenuLink: false, protection: 'Public (token)', description: 'Staff complaint response via access token', category: 'Complaints' },
  { path: '/complaint-response', component: 'ComplaintResponse', hasMenuLink: false, protection: 'Public', description: 'Complaint response form (no token)', category: 'Complaints' },
  { path: '/complaint-capture/:shortCode', component: 'ComplaintCapture', hasMenuLink: false, protection: 'Public (shortcode)', description: 'Mobile complaint evidence capture', category: 'Complaints' },

  // CQC & Compliance
  { path: '/cqc-compliance', component: 'CQCCompliance', hasMenuLink: true, protection: 'ProtectedRoute (enhanced_access)', description: 'CQC compliance management dashboard', category: 'Core Service' },
  { path: '/mock-cqc-inspection', component: 'MockCQCInspection', hasMenuLink: true, protection: 'MockInspectionProtectedRoute', description: 'Mock CQC inspection practice tool', category: 'Core Service' },
  { path: '/compliance/documentation', component: 'ComplianceDocumentation', hasMenuLink: false, protection: 'ProtectedRoute (enhanced_access)', description: 'Compliance documentation hub', category: 'CSO Governance' },
  { path: '/compliance/security', component: 'SecurityCompliance', hasMenuLink: true, protection: 'ProtectedRoute (enhanced_access)', description: 'Security compliance dashboard', category: 'CSO Governance' },
  { path: '/compliance/security-audit-2025-11-19', component: 'SecurityAudit20251119', hasMenuLink: false, protection: 'Public', description: 'Historical security audit from Nov 2025', category: 'CSO Governance' },
  { path: '/inspection-capture/:shortCode', component: 'InspectionCapture', hasMenuLink: false, protection: 'Public (shortcode)', description: 'Mobile CQC inspection evidence capture', category: 'Core Service' },

  // NRES
  { path: '/nres', component: 'NRESDashboard', hasMenuLink: true, protection: 'ProtectedRoute (nres)', description: 'NRES population health dashboard', category: 'Core Service' },
  { path: '/NRESDashboard', component: 'SDADashboard', hasMenuLink: true, protection: 'ProtectedRoute (nres)', description: 'SDA/NRES analytics dashboard', category: 'Core Service' },
  { path: '/nres/complex-care', component: 'ProactiveComplexCareDashboard', hasMenuLink: true, protection: 'ProtectedRoute (nres)', description: 'Proactive complex care dashboard', category: 'Core Service' },
  { path: '/nres/comms-strategy', component: 'CommsStrategyDashboard', hasMenuLink: true, protection: 'ProtectedRoute (nres)', description: 'Communications strategy dashboard', category: 'Core Service' },
  { path: '/nres-presentation', component: 'NRESPresentationPage', hasMenuLink: false, protection: 'ProtectedRoute (nres)', description: 'NRES presentation mode view', category: 'Core Service' },

  // Meeting / Scribe
  { path: '/meetings', component: 'MeetingHistory', hasMenuLink: false, protection: 'Public', description: 'Meeting history list (alias)', category: 'Meeting' },
  { path: '/meeting-history', component: 'MeetingHistory', hasMenuLink: false, protection: 'Public', description: 'Meeting history and recordings list', category: 'Meeting' },
  { path: '/meeting-summary', component: 'MeetingSummary', hasMenuLink: false, protection: 'Public', description: 'Meeting summary view', category: 'Meeting' },
  { path: '/meeting-summary/:meetingId', component: 'MeetingSummary', hasMenuLink: false, protection: 'Public', description: 'Specific meeting summary by ID', category: 'Meeting' },
  { path: '/consultation-summary', component: 'GPSoapUI', hasMenuLink: false, protection: 'Public', description: 'GP SOAP consultation summary view', category: 'Meeting' },
  { path: '/attendees', component: 'Attendees', hasMenuLink: false, protection: 'Public', description: 'Meeting attendees management', category: 'Meeting' },

  // Admin
  { path: '/admin', component: 'SystemAdmin', hasMenuLink: true, protection: 'Public (admin-checked internally)', description: 'System administration dashboard', category: 'Admin' },
  { path: '/admin/demo-video', component: 'AdminVideoUpload', hasMenuLink: false, protection: 'Public', description: 'Admin demo video upload page', category: 'Admin' },
  { path: '/admin/chunk-repair', component: 'AdminChunkRepair', hasMenuLink: false, protection: 'Public', description: 'Admin transcript chunk repair tool', category: 'Admin' },
  { path: '/admin/consolidate', component: 'AdminConsolidate', hasMenuLink: false, protection: 'Public', description: 'Admin meeting consolidation tool', category: 'Admin' },
  { path: '/practice-admin', component: 'PracticeAdmin', hasMenuLink: true, protection: 'Public', description: 'Practice-level admin dashboard', category: 'Admin' },
  { path: '/practice-admin/fridges', component: 'PracticeAdminFridges', hasMenuLink: true, protection: 'Public', description: 'Fridge temperature monitoring admin', category: 'Admin' },
  { path: '/settings', component: 'Settings', hasMenuLink: true, protection: 'Public', description: 'User settings and preferences', category: 'Admin' },

  // LG Capture
  { path: '/lg-capture', component: 'LGCaptureLanding', hasMenuLink: true, protection: 'Public', description: 'Lloyd George record capture landing', category: 'LG Capture' },
  { path: '/lg-capture/start', component: 'LGCaptureStart', hasMenuLink: false, protection: 'Public', description: 'Start new LG capture session', category: 'LG Capture' },
  { path: '/lg-capture/upload', component: 'LGCaptureUpload', hasMenuLink: false, protection: 'Public', description: 'Upload LG record files', category: 'LG Capture' },
  { path: '/lg-capture/capture/:id', component: 'LGCaptureCamera', hasMenuLink: false, protection: 'Public', description: 'Camera capture for LG records', category: 'LG Capture' },
  { path: '/lg-capture/demo/:id', component: 'LGCaptureDemoService', hasMenuLink: false, protection: 'Public', description: 'LG capture demo service', category: 'LG Capture' },
  { path: '/lg-capture/results/:id', component: 'LGCaptureResults', hasMenuLink: false, protection: 'Public', description: 'LG capture results and OCR output', category: 'LG Capture' },
  { path: '/lg-capture/patients', component: 'LGCapturePatients', hasMenuLink: false, protection: 'Public', description: 'LG capture patient list', category: 'LG Capture' },
  { path: '/lg-capture/my-stats', component: 'LGCaptureMyStats', hasMenuLink: false, protection: 'Public', description: 'Personal LG capture statistics', category: 'LG Capture' },
  { path: '/lg-capture/bulk', component: 'LGCaptureBulk', hasMenuLink: false, protection: 'Public', description: 'Bulk LG record processing', category: 'LG Capture' },
  { path: '/lg-capture/file-view', component: 'LGCaptureFileView', hasMenuLink: false, protection: 'Public', description: 'LG capture file viewer', category: 'LG Capture' },

  // CSO Governance
  { path: '/cso-report', component: 'CSOReport', hasMenuLink: true, protection: 'ProtectedRoute (cso_governance_access)', description: 'CSO governance annual report', category: 'CSO Governance' },
  { path: '/data-flow-architecture', component: 'DataFlowArchitecture', hasMenuLink: false, protection: 'ProtectedRoute (cso_governance_access)', description: 'Data flow architecture documentation', category: 'CSO Governance' },
  { path: '/dpia', component: 'DPIA', hasMenuLink: false, protection: 'ProtectedRoute (cso_governance_access)', description: 'Data Protection Impact Assessment', category: 'CSO Governance' },
  { path: '/dtac', component: 'DTACAssessment', hasMenuLink: false, protection: 'ProtectedRoute (cso_governance_access)', description: 'DTAC assessment documentation', category: 'CSO Governance' },
  { path: '/privacy-policy', component: 'PrivacyPolicy', hasMenuLink: false, protection: 'ProtectedRoute (cso_governance_access)', description: 'Privacy policy documentation', category: 'CSO Governance' },
  { path: '/hazard-log', component: 'HazardLog', hasMenuLink: false, protection: 'ProtectedRoute (cso_governance_access)', description: 'Clinical hazard log (DCB0129)', category: 'CSO Governance' },
  { path: '/safety-case', component: 'SafetyCase', hasMenuLink: false, protection: 'ProtectedRoute (cso_governance_access)', description: 'Clinical safety case documentation', category: 'CSO Governance' },
  { path: '/dcb0129', component: 'DCB0129', hasMenuLink: false, protection: 'ProtectedRoute (cso_governance_access)', description: 'DCB0129 clinical safety standard', category: 'CSO Governance' },
  { path: '/security-posture', component: 'SecurityPostureOverview', hasMenuLink: false, protection: 'ProtectedRoute (cso_governance_access)', description: 'Security posture overview', category: 'CSO Governance' },
  { path: '/incident-response', component: 'IncidentResponsePolicy', hasMenuLink: false, protection: 'ProtectedRoute (cso_governance_access)', description: 'Incident response policy', category: 'CSO Governance' },

  // CSO Training
  { path: '/cso-training-register', component: 'CSOTrainingRegister', hasMenuLink: false, protection: 'Public', description: 'CSO training registration', category: 'Training' },
  { path: '/cso-training-dashboard', component: 'CSOTrainingDashboard', hasMenuLink: false, protection: 'Public', description: 'CSO training progress dashboard', category: 'Training' },
  { path: '/cso-training-module/:moduleId', component: 'CSOTrainingModule', hasMenuLink: false, protection: 'Public', description: 'Individual CSO training module', category: 'Training' },
  { path: '/cso-training-assessment', component: 'CSOTrainingAssessment', hasMenuLink: false, protection: 'Public', description: 'CSO training assessment quiz', category: 'Training' },
  { path: '/cso-training-results/:assessmentId', component: 'CSOTrainingResults', hasMenuLink: false, protection: 'Public', description: 'CSO training results view', category: 'Training' },
  { path: '/cso-certificate/:assessmentId', component: 'CSOCertificate', hasMenuLink: false, protection: 'Public', description: 'CSO training certificate', category: 'Training' },
  { path: '/cso-test-certificate', component: 'CSOTestCertificate', hasMenuLink: false, protection: 'Public', description: 'Test certificate preview', category: 'Training' },
  { path: '/CSO_TRAINING_CONTENT_EXPORT.md', component: 'CSOTrainingContentExport', hasMenuLink: false, protection: 'Public', description: 'CSO training content export (markdown)', category: 'Training' },

  // Translation
  { path: '/patient-language', component: 'PatientLanguageSelection', hasMenuLink: false, protection: 'Public', description: 'Patient language selection for translation', category: 'Translation' },
  { path: '/reception-translate', component: 'ReceptionPatientView', hasMenuLink: false, protection: 'Public', description: 'Reception patient translation view', category: 'Translation' },

  // Policy Service
  { path: '/policy-service', component: 'PolicyService', hasMenuLink: true, protection: 'ProtectedRoute', description: 'Practice policy management service', category: 'Policy' },
  { path: '/policy-service/create', component: 'PolicyServiceCreate', hasMenuLink: false, protection: 'ProtectedRoute', description: 'Create new practice policy', category: 'Policy' },
  { path: '/policy-service/update', component: 'PolicyServiceUpdate', hasMenuLink: false, protection: 'ProtectedRoute', description: 'Update existing practice policy', category: 'Policy' },
  { path: '/policy-service/checklist', component: 'PolicyServiceChecklist', hasMenuLink: false, protection: 'ProtectedRoute', description: 'Policy compliance checklist', category: 'Policy' },
  { path: '/policy-service/my-policies', component: 'PolicyServiceMyPolicies', hasMenuLink: false, protection: 'ProtectedRoute', description: 'My practice policies list', category: 'Policy' },
  { path: '/policy-service/profile', component: 'PolicyServiceProfile', hasMenuLink: false, protection: 'ProtectedRoute', description: 'Policy service user profile', category: 'Policy' },

  // Survey sub-routes
  { path: '/surveys/create', component: 'SurveyBuilder', hasMenuLink: false, protection: 'ProtectedRoute (survey_manager_access)', description: 'Create new survey', category: 'Survey' },
  { path: '/surveys/:id/edit', component: 'SurveyBuilder', hasMenuLink: false, protection: 'ProtectedRoute (survey_manager_access)', description: 'Edit existing survey', category: 'Survey' },
  { path: '/surveys/:id/results', component: 'SurveyResults', hasMenuLink: false, protection: 'ProtectedRoute (survey_manager_access)', description: 'View survey results', category: 'Survey' },
  { path: '/survey/:token', component: 'PublicSurvey', hasMenuLink: false, protection: 'Public (token)', description: 'Public survey response form', category: 'Survey' },
  { path: '/s/:token', component: 'PublicSurvey', hasMenuLink: false, protection: 'Public (token)', description: 'Short URL public survey form', category: 'Survey' },

  // Utility / Misc
  { path: '/auth', component: 'Auth', hasMenuLink: false, protection: 'Public', description: 'Authentication login/signup page', category: 'Utility' },
  { path: '/auth-confirm', component: 'AuthConfirm', hasMenuLink: false, protection: 'Public', description: 'Email confirmation handler', category: 'Utility' },
  { path: '/reset-password', component: 'ResetPassword', hasMenuLink: false, protection: 'Public', description: 'Password reset form', category: 'Utility' },
  { path: '/quick-record', component: 'QuickRecord', hasMenuLink: false, protection: 'Public', description: 'Quick audio recording page', category: 'Utility' },
  { path: '/executive-overview', component: 'ExecutiveOverview', hasMenuLink: false, protection: 'Public', description: 'Executive overview presentation', category: 'Utility' },
  { path: '/demos', component: 'DemoVideosPage', hasMenuLink: false, protection: 'Public', description: 'Demo videos showcase page', category: 'Utility' },
  { path: '/training', component: 'TrainingVideoPage', hasMenuLink: false, protection: 'Public', description: 'Training video page', category: 'Utility' },
  { path: '/ai-showcase', component: 'AIShowcasePage', hasMenuLink: false, protection: 'Public', description: 'AI capabilities showcase', category: 'Utility' },
  { path: '/federation-presentation', component: 'FederationPresentationMode', hasMenuLink: false, protection: 'Public', description: 'Federation presentation mode', category: 'Utility' },
  { path: '/load-demo-team', component: 'LoadDemoTeamData', hasMenuLink: false, protection: 'Public', description: 'Loads demo team data for testing', category: 'Utility' },
  { path: '/staff-feedback', component: 'StaffFeedback', hasMenuLink: false, protection: 'Public', description: 'Staff feedback submission form', category: 'Utility' },
  { path: '/new-recorder', component: 'NewRecorder', hasMenuLink: false, protection: 'Public', description: 'New audio recorder interface', category: 'Utility' },
  { path: '/ai4pm', component: 'AI4PMService', hasMenuLink: false, protection: 'ProtectedRoute (enhanced_access)', description: 'AI for Practice Managers service', category: 'Core Service' },
  { path: '/usingai_nhs', component: 'UsingAiNhs', hasMenuLink: false, protection: 'Public', description: 'Using AI in NHS information page', category: 'Utility' },
  { path: '/feedback', component: 'PracticeManagerFeedback', hasMenuLink: false, protection: 'Public', description: 'Practice manager feedback form', category: 'Utility' },
  { path: '/feedback/results', component: 'FeedbackResults', hasMenuLink: false, protection: 'Public', description: 'Feedback results dashboard', category: 'Utility' },
  { path: '/network-diagnostics', component: 'NetworkDiagnosticsPage', hasMenuLink: false, protection: 'Public', description: 'Network connectivity diagnostics', category: 'Utility' },
  { path: '/turkey2025', component: 'Turkey2025', hasMenuLink: false, protection: 'Public', description: 'Turkey 2025 event page', category: 'Utility' },
  { path: '/voice-test', component: 'VoiceTest', hasMenuLink: false, protection: 'Public', description: 'Voice/microphone test page', category: 'Utility' },
  { path: '/security-report', component: 'SecurityReport', hasMenuLink: false, protection: 'Public', description: 'Security report viewer', category: 'CSO Governance' },
  { path: '/nhs-quest', component: 'NHSQuest', hasMenuLink: false, protection: 'Public', description: 'NHS Quest interactive page', category: 'Utility' },
  { path: '/ai4gp-prompts', component: 'AI4GPPromptGuide', hasMenuLink: false, protection: 'Public', description: 'AI4GP prompt guide documentation', category: 'Core Service' },
  { path: '/fridge-temp/:id', component: 'FridgeTemperatureEntry', hasMenuLink: false, protection: 'Public', description: 'Fridge temperature entry form', category: 'Admin' },
  { path: '/public/fridge-temp/:id', component: 'FridgeTemperatureEntry', hasMenuLink: false, protection: 'Public', description: 'Public fridge temperature entry', category: 'Admin' },
  { path: '/public/bp-calculator', component: 'PublicBPCalculator', hasMenuLink: false, protection: 'Public', description: 'Public BP calculator (no auth)', category: 'Core Service' },
  { path: '/doc-capture/:sessionToken', component: 'DocumentCapture', hasMenuLink: false, protection: 'Public (token)', description: 'Document capture via session token', category: 'Utility' },
  { path: '/ai-capture/:sessionToken', component: 'AIChatCapture', hasMenuLink: false, protection: 'Public (token)', description: 'AI chat image capture via session token', category: 'Utility' },
  { path: '/c/:shortCode', component: 'AIChatCapture', hasMenuLink: false, protection: 'Public (shortcode)', description: 'Short URL for AI chat capture', category: 'Utility' },

  // Redirects
  { path: '/gp-scribe', component: 'Navigate → /scribe', hasMenuLink: false, protection: 'Redirect', description: 'Legacy redirect to /scribe', category: 'Utility' },
  { path: '/gp-scribe/settings', component: 'Navigate → /scribe', hasMenuLink: false, protection: 'Redirect', description: 'Legacy redirect to /scribe', category: 'Utility' },
  { path: '/translation-tool', component: 'Navigate → /gp-translation', hasMenuLink: false, protection: 'Redirect', description: 'Legacy redirect to /gp-translation', category: 'Utility' },
];

type CategoryFilter = 'all' | RouteCategory;
type MenuFilter = 'all' | 'has-link' | 'no-link';
type ProtectionFilter = 'all' | 'public' | 'protected';

export const PageRouteAudit: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [menuFilter, setMenuFilter] = useState<MenuFilter>('all');
  const [protectionFilter, setProtectionFilter] = useState<ProtectionFilter>('all');

  const filtered = useMemo(() => {
    return ROUTES.filter(r => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!r.path.toLowerCase().includes(q) && !r.component.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) return false;
      }
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (menuFilter === 'has-link' && !r.hasMenuLink) return false;
      if (menuFilter === 'no-link' && r.hasMenuLink) return false;
      if (protectionFilter === 'public' && r.protection !== 'Public') return false;
      if (protectionFilter === 'protected' && r.protection === 'Public') return false;
      return true;
    });
  }, [searchQuery, categoryFilter, menuFilter, protectionFilter]);

  const stats = useMemo(() => {
    const total = ROUTES.length;
    const withMenu = ROUTES.filter(r => r.hasMenuLink).length;
    const orphaned = ROUTES.filter(r => !r.hasMenuLink && r.protection !== 'Redirect').length;
    const protectedCount = ROUTES.filter(r => r.protection.includes('ProtectedRoute')).length;
    const publicCount = ROUTES.filter(r => r.protection === 'Public').length;
    const categories = [...new Set(ROUTES.map(r => r.category))];
    return { total, withMenu, orphaned, protectedCount, publicCount, categories };
  }, []);

  const getCategoryColour = (cat: RouteCategory): string => {
    const map: Record<RouteCategory, string> = {
      'Core Service': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Admin': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'CSO Governance': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'Public': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Utility': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      'Meeting': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      'LG Capture': 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
      'Complaints': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'Translation': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
      'Policy': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      'Survey': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      'Training': 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200',
      'Unknown': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    };
    return map[cat] || map['Unknown'];
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Routes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.withMenu}</div>
            <div className="text-xs text-muted-foreground">With Menu Link</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.orphaned}</div>
            <div className="text-xs text-muted-foreground">No Menu Link</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.protectedCount}</div>
            <div className="text-xs text-muted-foreground">Protected</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-muted-foreground">{stats.publicCount}</div>
            <div className="text-xs text-muted-foreground">Public</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search routes, components, or descriptions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {stats.categories.sort().map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={menuFilter} onValueChange={(v) => setMenuFilter(v as MenuFilter)}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Menu Link" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Routes</SelectItem>
            <SelectItem value="has-link">Has Menu Link</SelectItem>
            <SelectItem value="no-link">No Menu Link</SelectItem>
          </SelectContent>
        </Select>
        <Select value={protectionFilter} onValueChange={(v) => setProtectionFilter(v as ProtectionFilter)}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Protection" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Access</SelectItem>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="protected">Protected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Routes Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[220px]">Route Path</TableHead>
                  <TableHead className="w-[180px]">Component</TableHead>
                  <TableHead className="w-[80px] text-center">Menu</TableHead>
                  <TableHead className="w-[200px]">Protection</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[120px]">Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((route) => (
                  <TableRow
                    key={route.path}
                    className={!route.hasMenuLink && route.protection !== 'Redirect' ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}
                  >
                    <TableCell className="font-mono text-xs">{route.path}</TableCell>
                    <TableCell className="text-sm">{route.component}</TableCell>
                    <TableCell className="text-center">
                      {route.hasMenuLink ? (
                        <Badge variant="default" className="text-xs bg-green-600">Yes</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {route.protection === 'Public' && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Globe className="h-3 w-3" />
                          Public
                        </Badge>
                      )}
                      {route.protection === 'Redirect' && (
                        <Badge variant="secondary" className="text-xs">Redirect</Badge>
                      )}
                      {route.protection.includes('ProtectedRoute') && (
                        <Badge variant="default" className="text-xs gap-1 bg-blue-600">
                          <Lock className="h-3 w-3" />
                          {route.protection.replace('ProtectedRoute', 'Protected').replace('(', '').replace(')', '')}
                        </Badge>
                      )}
                      {route.protection.includes('token') && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          {route.protection}
                        </Badge>
                      )}
                      {route.protection.includes('shortcode') && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          {route.protection}
                        </Badge>
                      )}
                      {route.protection.includes('MockInspection') && (
                        <Badge variant="default" className="text-xs gap-1 bg-purple-600">
                          <Lock className="h-3 w-3" />
                          Mock Inspection
                        </Badge>
                      )}
                      {route.protection.includes('admin-checked') && (
                        <Badge variant="default" className="text-xs gap-1 bg-red-600">
                          <Lock className="h-3 w-3" />
                          Admin Only
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{route.description}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColour(route.category)}`}>
                        {route.category}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground p-3 border rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-950 border border-amber-300" />
          <span>No menu link (potential cleanup candidate)</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-xs bg-green-600 h-4">Yes</Badge>
          <span>Has menu navigation link</span>
        </div>
      </div>
    </div>
  );
};
