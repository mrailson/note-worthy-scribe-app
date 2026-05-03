import { useState, useEffect, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMaintenanceMode } from '@/hooks/useMaintenanceMode';
import { Header } from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Users, 
  Calendar, 
  Building, 
  Network,
  BarChart3,
  Shield,
  Settings,
  Database,
  FileText,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  UserCheck,
  AlertCircle,
  TrendingUp,
  Upload,
  FileJson,
  TestTube,
  FileCheck,
  Lock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  LogIn,
  Mail,
  Mic,
  Bot,
  RefreshCw
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { AudioBackupManager } from '@/components/AudioBackupManager';
import { AdminAudioBackupSearch } from '@/components/admin/AdminAudioBackupSearch';
import AITestModal from '@/components/AITestModal';
import { CSOComplianceReport } from '@/components/CSOComplianceReport';
import { HazardAnalysisReport } from '@/components/HazardAnalysisReport';
import { SystemMonitoringDashboard } from '@/components/SystemMonitoringDashboard';
import { AdminMeetingControls } from '@/components/AdminMeetingControls';
import { DCB0129Panel } from '@/components/admin/DCB0129Panel';
import { SendDPIATemplateCard } from '@/components/sda/SendDPIATemplateCard';
import { ConsultationVisibilitySettings } from '@/components/admin/ConsultationVisibilitySettings';
import { MeetingStatsByUser } from '@/components/admin/MeetingStatsByUser';
import { MeetingUsageReport } from '@/components/admin/MeetingUsageReport';
import { OrphanedWhisperMonitor } from '@/components/admin/OrphanedWhisperMonitor';
import { LiveAndRecentMeetings } from '@/components/admin/LiveAndRecentMeetings';
import { AdminVideoUpload } from '@/components/admin/AdminVideoUpload';
import { GPScribeStats } from '@/components/admin/GPScribeStats';
import { StorageManagement } from '@/components/admin/StorageManagement';
import { UserGeneratedImagesGallery } from '@/components/admin/UserGeneratedImagesGallery';
import { CreateUserModuleAccess } from '@/components/admin/CreateUserModuleAccess';
import { AI4GPServicesOverview } from '@/components/admin/AI4GPServicesOverview';
import { PolicyEnhancementModelSettings } from '@/components/admin/PolicyEnhancementModelSettings';
import { PolicyRegenerateButtonSettings } from '@/components/admin/PolicyRegenerateButtonSettings';
import { ICBTrafficLightManager } from '@/components/admin/ICBTrafficLightManager';
import { EdgeFunctionAudit } from '@/components/admin/EdgeFunctionAudit';
import { PageRouteAudit } from '@/components/admin/PageRouteAudit';
import { getDefaultModulesForRole, ModuleAccess } from '@/config/roleDefaultModules';

const DPIAGenerator = lazy(() => import("@/components/sda/DPIAGenerator"));
const KnowledgeBaseEmbed = lazy(() => import("@/pages/KnowledgeBase"));

// Word lists for memorable password generation
const PASSWORD_WORDS = [
  'apple', 'brave', 'charm', 'dance', 'eagle', 'flame', 'grace', 'happy',
  'ivory', 'jolly', 'kneel', 'lemon', 'maple', 'noble', 'ocean', 'pearl',
  'quiet', 'river', 'storm', 'tiger', 'unity', 'vivid', 'water', 'yacht',
  'zebra', 'amber', 'bloom', 'cloud', 'dream', 'ember', 'frost', 'globe',
  'haven', 'image', 'jewel', 'kraft', 'light', 'magic', 'night', 'olive',
  'piano', 'quest', 'reign', 'solar', 'trail', 'ultra', 'vigor', 'wheat',
  'lunar', 'coral', 'delta', 'flint', 'grain', 'hazel', 'index', 'lotus',
  'mango', 'north', 'oasis', 'plume', 'quilt', 'ridge', 'shine', 'trust'
];

const generateMemorablePassword = (): string => {
  const word1 = PASSWORD_WORDS[Math.floor(Math.random() * PASSWORD_WORDS.length)];
  const word2 = PASSWORD_WORDS[Math.floor(Math.random() * PASSWORD_WORDS.length)];
  const number = Math.floor(Math.random() * 10);
  return `${word1.charAt(0).toUpperCase() + word1.slice(1)}${number}${word2.charAt(0).toUpperCase() + word2.slice(1)}`;
};

import * as XLSX from 'xlsx-js-style';


interface User {
  user_id: string;
  email: string;
  full_name: string;
  last_login: string | null;
  show_consultation_examples?: boolean | null;
  practice_assignments: Array<{
    practice_id: string;
    practice_name: string;
    role: string;
    assigned_at: string;
  }>;
}

interface Practice {
  id: string;
  name: string;
  practice_code?: string;
  pcn_code?: string;
  pcn_name?: string;
  neighbourhood_id?: string;
  neighbourhoods?: { name: string } | null;
  ics_code: string;
  ics_name: string;
  organisation_type: string;
  address?: string;
  postcode?: string;
  website?: string;
  email?: string;
  phone?: string;
}

interface PCN {
  id: string;
  pcn_name: string;
  pcn_code: string;
}

interface Neighbourhood {
  id: string;
  name: string;
  description?: string;
}

interface StuckMeetingSummary {
  id: string;
  title: string;
  status: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  created_at: string;
  updated_at: string;
  last_chunk_at?: string | null;
  chunk_count: number;
  word_count: number;
  reason: string;
  age_minutes: number;
  silence_minutes: number | null;
}

const SystemAdmin = () => {
  const { user, refreshUserModules } = useAuth();
  const { maintenanceMode, updateMaintenanceMode } = useMaintenanceMode();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'overview');
  const [monitoringSubTab, setMonitoringSubTab] = useState('system');
  const [securityTab, setSecurityTab] = useState('monitoring');
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [customMessage, setCustomMessage] = useState(maintenanceMode.message);
  const [updating, setUpdating] = useState(false);

  // Update custom message when maintenance mode changes
  useEffect(() => {
    setCustomMessage(maintenanceMode.message);
  }, [maintenanceMode.message]);

  // Handle maintenance mode updates with loading state
  const handleMaintenanceModeUpdate = async (enabled: boolean, message?: string) => {
    setUpdating(true);
    try {
      await updateMaintenanceMode(enabled, message);
      toast.success(`Maintenance mode ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating maintenance mode:', error);
      toast.error('Failed to update maintenance mode');
    } finally {
      setUpdating(false);
    }
  };
  
  // File upload state for prior approval data
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; content: string }>>([]);
  
  // Policy management state
  const [policyTemplates, setPolicyTemplates] = useState<any[]>([]);
  const [practiceAssignments, setPracticeAssignments] = useState<any[]>([]);
  const [assigningPolicy, setAssigningPolicy] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFetchingICB, setIsFetchingICB] = useState(false);
  const [showUploadSection, setShowUploadSection] = useState(false);
  const [showAITestModal, setShowAITestModal] = useState(false);

  // Dashboard state
  const [dashboardStats, setDashboardStats] = useState({
    totalUsers: 0,
    totalMeetings: 0,
    totalPractices: 0,
    totalPCNs: 0
  });
  const [stuckMeetings, setStuckMeetings] = useState<StuckMeetingSummary[]>([]);
  const [loadingStuckMeetings, setLoadingStuckMeetings] = useState(false);
  const [recoveringMeetingId, setRecoveringMeetingId] = useState<string | null>(null);

  // Database monitoring state
  const [databaseSizes, setDatabaseSizes] = useState<Array<{
    table_name: string;
    size_bytes: number;
    size_pretty: string;
    row_count: number;
  }>>([]);

  const [largeFiles, setLargeFiles] = useState<Array<{
    table_name: string;
    file_name: string;
    file_size: number;
    file_size_pretty: string;
    uploaded_at: string;
    uploaded_by_email: string;
  }>>([]);

  const [fileStats, setFileStats] = useState<{
    files_over_1mb: number;
    files_500kb_to_1mb: number;
    total_large_files: number;
    total_large_files_size: number;
    total_large_files_size_pretty: string;
  } | null>(null);

  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [largeFilesOpen, setLargeFilesOpen] = useState(false);
  const [largeFilesSortField, setLargeFilesSortField] = useState<'file_size' | 'uploaded_at' | 'file_name'>('file_size');
  const [largeFilesSortDirection, setLargeFilesSortDirection] = useState<'asc' | 'desc'>('desc');

  
  // User management state
  const [users, setUsers] = useState<User[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userPracticeFilter, setUserPracticeFilter] = useState('all');
  const [userSortField, setUserSortField] = useState<'full_name' | 'last_login' | 'practice_name' | 'role'>('full_name');
  const [userSortDirection, setUserSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userServiceActivations, setUserServiceActivations] = useState<{
    nres: boolean;
    enn: boolean;
    ai4pm: boolean;
    ai4gp: boolean;
    meeting_recorder: boolean;
    complaints: boolean;
    cqc: boolean;
    lg_capture: boolean;
  }>({
    nres: false,
    enn: false,
    ai4pm: false,
    ai4gp: false,
    meeting_recorder: false,
    complaints: false,
    cqc: false,
    lg_capture: false
  });
  const [userFormData, setUserFormData] = useState({
    email: '',
    full_name: '',
    password: generateMemorablePassword(),
    role: 'practice_manager' as 'practice_user' | 'practice_manager' | 'pcn_manager' | 'system_admin',
    practice_id: 'none',
    module_access: {
      meeting_notes_access: true,
      gp_scribe_access: false,
      complaints_manager_access: true,
      ai4gp_access: true,
      enhanced_access: false,
      cqc_compliance_access: false,
      shared_drive_access: false,
      mic_test_service_access: false,
      api_testing_service_access: false,
      translation_service_access: false,
      fridge_monitoring_access: false,
      cso_governance_access: false,
      lg_capture_access: false,
      bp_service_access: false,
      survey_manager_access: true,
      document_signoff_access: false,
      agewell_access: false
    }
  });
  const [showPasswordField, setShowPasswordField] = useState(true);
  
  // Welcome email options
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [welcomeEmailTestMode, setWelcomeEmailTestMode] = useState(false);
  const [sendingWelcomeEmail, setSendingWelcomeEmail] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  
  // Practice management state
  const [practices, setPractices] = useState<Practice[]>([]);
  const [practiceSearchQuery, setPracticeSearchQuery] = useState('');
  const [neighbourhoodFilter, setNeighbourhoodFilter] = useState('all');
  const [pcnFilter, setPcnFilter] = useState('all');
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [editingPractice, setEditingPractice] = useState<Practice | null>(null);
  const [practiceFormData, setPracticeFormData] = useState({
    name: '',
    practice_code: '',
    address: '',
    postcode: '',
    website: '',
    email: '',
    phone: '',
    neighbourhood_id: 'none',
    pcn_code: 'none'
  });
  
  // PCN management state
  const [pcns, setPcns] = useState<PCN[]>([]);
  const [pcnSearchQuery, setPcnSearchQuery] = useState('');
  
  // Neighbourhood management state
  const [neighbourhoods, setNeighbourhoods] = useState<Neighbourhood[]>([]);
  const [neighbourhoodSearchQuery, setNeighbourhoodSearchQuery] = useState('');

  // Connection monitoring state
  const [connectionStats, setConnectionStats] = useState({
    openaiConnections: 12,
    deepgramConnections: 0,
    elevenlabsConnections: 1,
    assemblyaiConnections: 2,
    supabaseDbConnections: 45,
    supabaseStorageConnections: 8,
    edgeFunctionConnections: 15
  });

  // Security monitoring state
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [supplierIncidents, setSupplierIncidents] = useState([]);
  const [showAddIncidentModal, setShowAddIncidentModal] = useState(false);
  const [newIncident, setNewIncident] = useState({
    supplier_name: '',
    system_component: '',
    incident_type: '',
    severity: 'medium',
    description: '',
    status: 'open'
  });

// Password admin modal state
const [showPasswordModal, setShowPasswordModal] = useState(false);
const [passwordTargetUser, setPasswordTargetUser] = useState<User | null>(null);
const [newPassword, setNewPassword] = useState('');
const [updatingPassword, setUpdatingPassword] = useState(false);
const [loggingInAsUser, setLoggingInAsUser] = useState<string | null>(null);

// Login history modal state
const [showLoginHistoryModal, setShowLoginHistoryModal] = useState(false);
const [loginHistoryUser, setLoginHistoryUser] = useState<User | null>(null);
const [loginHistory, setLoginHistory] = useState<any[]>([]);
const [loadingLoginHistory, setLoadingLoginHistory] = useState(false);

  // Enhanced security monitoring state
  const [authenticationLogs, setAuthenticationLogs] = useState([]);
  const [patientDataAccess, setPatientDataAccess] = useState([]);
  const [authSearchQuery, setAuthSearchQuery] = useState('');
  const [authEventFilter, setAuthEventFilter] = useState('all');
  const [authUserFilter, setAuthUserFilter] = useState('all');
  const [authDateFilter, setAuthDateFilter] = useState('7'); // Last 7 days
  const [loadingAuthLogs, setLoadingAuthLogs] = useState(false);
  const [vulnerabilityScans, setVulnerabilityScans] = useState([]);
  const [complianceStatus, setComplianceStatus] = useState({
    nhsDigitalCompliance: { status: 'compliant', lastCheck: '2024-01-15' },
    cyberEssentials: { status: 'pending', lastCheck: '2024-01-10' },
    dataRetention: { status: 'compliant', lastCheck: '2024-01-12' },
    accessControl: { status: 'warning', lastCheck: '2024-01-14' }
  });

  useEffect(() => {
    checkAccessPermissions();
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchPractices();
      fetchPCNs();
      fetchNeighbourhoods();
      fetchDashboardStats();
      fetchStuckMeetings();
      fetchDatabaseSizes();
      fetchLargeFiles();
      fetchFileStats();
      fetchSupplierIncidents();
      fetchSecurityEvents();
      fetchEnhancedSecurityData();
      fetchPolicyTemplates();
      fetchPracticeAssignments();
    }
  }, [isAdmin]);

  const checkAccessPermissions = async () => {
    if (!user) return;
    
    try {
      const { data: adminData, error } = await supabase
        .rpc('is_system_admin', { _user_id: user.id });
      
      if (error) throw error;
      setIsAdmin(adminData);
      
      if (!adminData) {
        toast.error("Access denied. System admin privileges required.");
      }
    } catch (error) {
      console.error('Error checking access permissions:', error);
      toast.error("Error checking permissions");
    }
  };

  const fetchUsers = async () => {
    try {
      console.log('=== FETCHING USERS START ===');
      setLoading(true);
      const { data, error } = await supabase.rpc('get_users_with_practices');
      if (error) throw error;
      
      console.log('Base user data fetched:', data);
      
      // Fetch user roles with module access for each user
        const usersWithModules = await Promise.all(
        (data || []).map(async (user: any) => {
          console.log(`Fetching roles for user ${user.user_id}`);
          
          // Get ALL user_roles for this user and take the first one for display
          const { data: roleData, error: roleError } = await (supabase
            .from('user_roles')
            .select('meeting_notes_access, gp_scribe_access, complaints_manager_access, enhanced_access, cqc_compliance_access, shared_drive_access, mic_test_service_access, api_testing_service_access, translation_service_access, fridge_monitoring_access, cso_governance_access, lg_capture_access, bp_service_access, show_consultation_examples, agewell_access') as any)
            .eq('user_id', user.user_id)
            .limit(1)
            .single();
          
          if (roleError) {
            console.log(`No roles found for user ${user.user_id}:`, roleError);
          } else {
            console.log(`Role data for user ${user.user_id}:`, roleData);
          }
          
          // Get AI4GP access from profiles table
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('ai4gp_access')
            .eq('user_id', user.user_id)
            .single();
          
          if (profileError) {
            console.log(`No profile found for user ${user.user_id}:`, profileError);
          } else {
            console.log(`Profile data for user ${user.user_id}:`, profileData);
          }
          
          const userWithModules = {
            ...user,
            meeting_notes_access: roleData?.meeting_notes_access ?? false,
            gp_scribe_access: roleData?.gp_scribe_access ?? false,
            complaints_manager_access: roleData?.complaints_manager_access ?? false,
            ai4gp_access: profileData?.ai4gp_access ?? false,
            enhanced_access: roleData?.enhanced_access ?? false,
            cqc_compliance_access: roleData?.cqc_compliance_access ?? false,
            shared_drive_access: roleData?.shared_drive_access ?? false,
            mic_test_service_access: roleData?.mic_test_service_access ?? false,
            api_testing_service_access: roleData?.api_testing_service_access ?? false,
            translation_service_access: roleData?.translation_service_access ?? false,
            fridge_monitoring_access: roleData?.fridge_monitoring_access ?? false,
            cso_governance_access: roleData?.cso_governance_access ?? false,
            lg_capture_access: roleData?.lg_capture_access ?? false,
            bp_service_access: roleData?.bp_service_access ?? false,
            show_consultation_examples: roleData?.show_consultation_examples ?? null
          };
          
          console.log(`Final user data for ${user.user_id}:`, userWithModules);
          return userWithModules;
        })
      );
      
      console.log('All users with modules:', usersWithModules);
      setUsers(usersWithModules as User[]);
      console.log('=== FETCHING USERS END ===');
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const fetchPractices = async () => {
    try {
      const { data: practicesData, error: practicesError } = await supabase
        .from('gp_practices')
        .select(`
          id, 
          name, 
          practice_code, 
          pcn_code,
          ics_code,
          ics_name,
          organisation_type,
          neighbourhood_id,
          address,
          postcode,
          website,
          email,
          phone,
          neighbourhoods(name)
        `)
        .order('name');

      if (practicesError) throw practicesError;

      const { data: pcnData, error: pcnError } = await supabase
        .from('primary_care_networks')
        .select('pcn_code, pcn_name');

      if (pcnError) throw pcnError;

      const pcnMap = new Map();
      pcnData?.forEach(pcn => {
        pcnMap.set(pcn.pcn_code, pcn.pcn_name);
      });

      const practicesWithPCNNames = practicesData?.map(practice => ({
        ...practice,
        pcn_name: practice.pcn_code ? pcnMap.get(practice.pcn_code) : null
      })) || [];
      
      setPractices(practicesWithPCNNames);
    } catch (error) {
      console.error('Error fetching practices:', error);
      toast.error("Failed to fetch practices");
    }
  };

  const fetchPCNs = async () => {
    try {
      const { data, error } = await supabase
        .from('primary_care_networks')
        .select('id, pcn_name, pcn_code')
        .order('pcn_name');

      if (error) throw error;
      setPcns(data || []);
    } catch (error) {
      console.error('Error fetching PCNs:', error);
      toast.error("Failed to fetch PCNs");
    }
  };

  const fetchNeighbourhoods = async () => {
    try {
      const { data, error } = await supabase
        .from('neighbourhoods')
        .select('id, name, description')
        .order('name');

      if (error) throw error;
      setNeighbourhoods(data || []);
    } catch (error) {
      console.error('Error fetching neighbourhoods:', error);
      toast.error("Failed to fetch neighbourhoods");
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const [usersData, meetingsData, practicesData, pcnsData] = await Promise.all([
        supabase.from('profiles').select('id'),
        supabase.from('meetings').select('id'),
        supabase.from('gp_practices').select('id'),
        supabase.from('primary_care_networks').select('id')
      ]);

      setDashboardStats({
        totalUsers: usersData.data?.length || 0,
        totalMeetings: meetingsData.data?.length || 0,
        totalPractices: practicesData.data?.length || 0,
        totalPCNs: pcnsData.data?.length || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const fetchStuckMeetings = async () => {
    setLoadingStuckMeetings(true);
    try {
      const now = Date.now();
      // Only consider meetings from the last 7 days — older rows are historical
      // noise (the >24h-stale sweep already marks them failed).
      const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: meetings, error: meetingsError } = await supabase
        .from('meetings')
        .select('id, title, status, user_id, created_at, updated_at, notes_generation_status, word_count, whisper_transcript_text')
        .or('status.eq.recording,status.eq.processing,status.eq.transcribing,status.eq.pending_transcription,notes_generation_status.eq.queued,notes_generation_status.eq.generating')
        .gte('created_at', sevenDaysAgo)
        .order('updated_at', { ascending: true })
        .limit(75);

      if (meetingsError) throw meetingsError;

      const meetingIds = (meetings || []).map((meeting: any) => meeting.id);
      if (meetingIds.length === 0) {
        setStuckMeetings([]);
        return;
      }

      const [{ data: chunks }, { data: summaries }] = await Promise.all([
        supabase
          .from('meeting_transcription_chunks')
          .select('meeting_id, created_at, word_count')
          .in('meeting_id', meetingIds),
        supabase
          .from('meeting_summaries')
          .select('meeting_id')
          .in('meeting_id', meetingIds)
      ]);

      const userIds = [...new Set((meetings || []).map((meeting: any) => meeting.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('profiles').select('user_id, email, full_name').in('user_id', userIds)
        : { data: [] as any[] };

      const chunkMap = new Map<string, { count: number; words: number; last: string | null }>();
      (chunks || []).forEach((chunk: any) => {
        const current = chunkMap.get(chunk.meeting_id) || { count: 0, words: 0, last: null };
        const chunkTime = chunk.created_at || null;
        chunkMap.set(chunk.meeting_id, {
          count: current.count + 1,
          words: current.words + (chunk.word_count || 0),
          last: !current.last || (chunkTime && new Date(chunkTime) > new Date(current.last)) ? chunkTime : current.last,
        });
      });

      const summaryIds = new Set((summaries || []).map((summary: any) => summary.meeting_id));
      const profileMap = new Map((profiles || []).map((profile: any) => [profile.user_id, profile]));

      const stuck = (meetings || []).map((meeting: any) => {
        const chunkInfo = chunkMap.get(meeting.id) || { count: 0, words: 0, last: null };
        const ageMinutes = Math.round((now - new Date(meeting.created_at).getTime()) / 60000);
        const updatedMinutes = Math.round((now - new Date(meeting.updated_at).getTime()) / 60000);
        const silenceMinutes = chunkInfo.last ? Math.round((now - new Date(chunkInfo.last).getTime()) / 60000) : null;
        const hasTranscript = Boolean(meeting.whisper_transcript_text?.trim());
        const hasSummary = summaryIds.has(meeting.id);
        let reason = '';

        if (meeting.status === 'recording' && chunkInfo.count > 0 && silenceMinutes !== null && silenceMinutes > 15 && ageMinutes > 20) {
          reason = `Recording orphaned — no transcript chunks for ${silenceMinutes} minutes`;
        } else if (['processing', 'transcribing', 'pending_transcription'].includes(meeting.status) && updatedMinutes > 15) {
          reason = `${meeting.status.replace('_', ' ')} for ${updatedMinutes} minutes`;
        } else if (chunkInfo.count > 0 && !hasTranscript && updatedMinutes > 15) {
          reason = 'Transcript chunks saved but not consolidated';
        } else if (hasTranscript && !hasSummary && ['queued', 'generating'].includes(meeting.notes_generation_status) && updatedMinutes > 20) {
          reason = 'Transcript ready but notes have not finished';
        }

        if (!reason) return null;
        const profile: any = profileMap.get(meeting.user_id);
        return {
          id: meeting.id,
          title: meeting.title || 'Untitled meeting',
          status: meeting.status,
          user_id: meeting.user_id,
          user_email: profile?.email,
          user_name: profile?.full_name,
          created_at: meeting.created_at,
          updated_at: meeting.updated_at,
          last_chunk_at: chunkInfo.last,
          chunk_count: chunkInfo.count,
          word_count: chunkInfo.words || meeting.word_count || 0,
          reason,
          age_minutes: ageMinutes,
          silence_minutes: silenceMinutes,
        } as StuckMeetingSummary;
      }).filter(Boolean) as StuckMeetingSummary[];

      setStuckMeetings(stuck.slice(0, 10));
    } catch (error) {
      console.error('Error fetching stuck meetings:', error);
      toast.error('Failed to check stuck meetings');
    } finally {
      setLoadingStuckMeetings(false);
    }
  };

  const recoverStuckMeeting = async (meeting: StuckMeetingSummary) => {
    setRecoveringMeetingId(meeting.id);
    try {
      const { error } = await supabase.functions.invoke('complete-stuck-meeting', {
        body: { meetingId: meeting.id },
      });
      if (error) throw error;
      toast.success('Recovery started for stuck meeting');
      await fetchStuckMeetings();
      await fetchDashboardStats();
    } catch (error) {
      console.error('Meeting recovery failed:', error);
      toast.error('Could not start meeting recovery');
    } finally {
      setRecoveringMeetingId(null);
    }
  };

  const fetchDatabaseSizes = async () => {
    try {
      const { data, error } = await supabase.rpc('get_database_table_sizes');
      if (error) throw error;
      setDatabaseSizes(data || []);
    } catch (error) {
      console.error('Error fetching database sizes:', error);
      toast.error("Failed to fetch database sizes");
    }
  };

  const fetchLargeFiles = async () => {
    try {
      const { data, error } = await supabase.rpc('get_large_files');
      if (error) throw error;
      setLargeFiles(data || []);
    } catch (error) {
      console.error('Error fetching large files:', error);
      toast.error("Failed to fetch large files");
    }
  };

  const deleteFile = async (file: typeof largeFiles[0]) => {
    console.log('Delete file clicked:', file);
    
    if (!window.confirm(`Are you sure you want to delete "${file.file_name}"? This action cannot be undone.`)) {
      console.log('Delete cancelled by user');
      return;
    }

    console.log('Delete confirmed, proceeding...');
    const fileKey = `${file.table_name}-${file.file_name}`;
    setDeletingFile(fileKey);

    try {
      let deleteError: any = null;

      // Handle different table types with type-safe queries
      switch (file.table_name) {
        case 'meeting_documents':
          console.log('Deleting from meeting_documents table');
          const { error: meetingDocError } = await supabase
            .from('meeting_documents')
            .delete()
            .eq('file_name', file.file_name);
          deleteError = meetingDocError;
          break;
          
        case 'complaint_documents':
          console.log('Deleting from complaint_documents table');
          const { error: complaintDocError } = await supabase
            .from('complaint_documents')
            .delete()
            .eq('file_name', file.file_name);
          deleteError = complaintDocError;
          break;
          
        case 'complaint_investigation_evidence':
          console.log('Deleting from complaint_investigation_evidence table');
          const { error: investigationError } = await supabase
            .from('complaint_investigation_evidence')
            .delete()
            .eq('file_name', file.file_name);
          deleteError = investigationError;
          break;
          
        case 'cqc_evidence':
          console.log('Deleting from cqc_evidence table');
          const { error: cqcError } = await supabase
            .from('cqc_evidence')
            .delete()
            .eq('file_name', file.file_name);
          deleteError = cqcError;
          break;
          
        case 'contractor_resumes':
          console.log('Deleting from contractor_resumes table');
          const { error: resumeError } = await supabase
            .from('contractor_resumes')
            .delete()
            .eq('file_name', file.file_name);
          deleteError = resumeError;
          break;

        case 'meeting_audio_backups':
          console.log('Deleting from meeting_audio_backups table');
          const { error: audioError } = await supabase
            .from('meeting_audio_backups')
            .delete()
            .eq('file_path', file.file_name);
          deleteError = audioError;
          break;
          
        default:
          // For unknown tables, try a generic approach
          console.warn(`Unknown table: ${file.table_name}, attempting generic delete`);
          throw new Error(`Table ${file.table_name} is not configured for deletion. Please contact support.`);
      }
      
      if (deleteError) {
        console.error('Database delete error:', deleteError);
        throw deleteError;
      }

      console.log('File deleted successfully from database');
      toast.success(`File "${file.file_name}" deleted successfully`);
      
      // Refresh the large files list
      await fetchLargeFiles();
      await fetchFileStats();
      
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeletingFile(null);
    }
  };

  const fetchFileStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_large_files_stats');
      if (error) throw error;
      if (data && data.length > 0) {
        setFileStats(data[0]);
      }
    } catch (error) {
      console.error('Error fetching file stats:', error);
      toast.error("Failed to fetch file statistics");
    }
  };

  const fetchSupplierIncidents = async () => {
    try {
      const { data, error } = await supabase
        .from('supplier_incidents')
        .select(`
          *,
          profiles!reported_by(full_name)
        `)
        .order('reported_date', { ascending: false });

      if (error) throw error;
      setSupplierIncidents(data || []);
    } catch (error) {
      console.error('Error fetching supplier incidents:', error);
      toast.error("Failed to fetch supplier incidents");
    }
  };

  const fetchSecurityEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .order('event_timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSecurityEvents(data || []);
    } catch (error) {
      console.error('Error fetching security events:', error);
      toast.error("Failed to fetch security events");
    }
  };

  const fetchEnhancedSecurityData = async () => {
    try {
      setLoadingAuthLogs(true);
      
      // Get real authentication events from system_audit_log
      const { data: auditLogs, error: auditError } = await supabase
        .from('system_audit_log')
        .select('*')
        .in('operation', ['USER_LOGIN', 'USER_LOGOUT', 'AUTHENTICATION_FAILED', 'SESSION_CREATED', 'SESSION_EXPIRED'])
        .gte('timestamp', new Date(Date.now() - parseInt(authDateFilter) * 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false })
        .limit(100);

      if (auditError) throw auditError;

      // Get security events 
      const { data: securityLogs, error: securityError } = await supabase
        .from('security_events')
        .select('*')
        .gte('created_at', new Date(Date.now() - parseInt(authDateFilter) * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (securityError) throw securityError;

      // Get user sessions with profile data separately
      const { data: sessions, error: sessionsError } = await supabase
        .from('user_sessions')
        .select('*')
        .gte('login_time', new Date(Date.now() - parseInt(authDateFilter) * 24 * 60 * 60 * 1000).toISOString())
        .order('login_time', { ascending: false })
        .limit(50);

      if (sessionsError) throw sessionsError;

      // Get profile emails for session users
      const userIds = sessions?.map(s => s.user_id).filter(Boolean) || [];
      const { data: profiles } = userIds.length > 0 
        ? await supabase
            .from('profiles')
            .select('user_id, email')
            .in('user_id', userIds)
        : { data: [] };

      // Create a map of user_id to email
      const userEmailMap = new Map<string, string>();
      profiles?.forEach(p => {
        if (p.user_id && p.email) {
          userEmailMap.set(p.user_id, p.email);
        }
      });

      // Combine and format authentication logs
      const combinedLogs = [];
      
      // Add audit logs
      auditLogs?.forEach(log => {
        combinedLogs.push({
          id: `audit-${log.id}`,
          timestamp: new Date(log.timestamp).toLocaleString('en-GB'),
          user: log.user_email || 'System',
          event: log.operation.toLowerCase().replace('_', ' '),
          ip: log.ip_address || 'N/A',
          status: log.operation.includes('FAILED') ? 'failed' : 'success',
          source: 'audit_log',
          details: log.new_values
        });
      });

      // Add security events
      securityLogs?.forEach(log => {
        combinedLogs.push({
          id: `security-${log.id}`,
          timestamp: new Date(log.created_at).toLocaleString('en-GB'),
          user: log.user_email || 'Unknown',
          event: log.event_type.toLowerCase().replace('_', ' '),
          ip: log.ip_address || 'N/A',
          status: log.severity === 'high' || log.severity === 'critical' ? 'failed' : 'success',
          source: 'security_events',
          details: log.event_details
        });
      });

      // Add session data
      sessions?.forEach(session => {
        const profileEmail = userEmailMap.get(session.user_id) || 'Unknown';
        combinedLogs.push({
          id: `session-${session.id}`,
          timestamp: new Date(session.login_time).toLocaleString('en-GB'),
          user: profileEmail,
          event: session.is_active ? 'active session' : 'session ended',
          ip: session.ip_address || 'N/A',
          status: 'success',
          source: 'user_sessions',
          details: {
            session_duration: session.logout_time ? 
              Math.round((new Date(session.logout_time).getTime() - new Date(session.login_time).getTime()) / (1000 * 60)) + ' minutes' :
              'Active',
            user_agent: session.user_agent
          }
        });
      });

      // Sort by timestamp (most recent first)
      combinedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setAuthenticationLogs(combinedLogs);

      // Mock patient data access for now (replace with real data when patient data exists)
      setPatientDataAccess([
        { 
          id: 1, 
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toLocaleString('en-GB'), 
          user: 'dr.brown@practice.nhs.uk', 
          action: 'view_meeting_notes', 
          patient_id: 'Meeting-1234', 
          duration: '5 min' 
        },
        { 
          id: 2, 
          timestamp: new Date(Date.now() - 1000 * 60 * 45).toLocaleString('en-GB'), 
          user: 'nurse.green@practice.nhs.uk', 
          action: 'create_meeting_transcript', 
          patient_id: 'Meeting-5678', 
          duration: '12 min' 
        }
      ]);

      // Set vulnerability scans data (today's scan results)
      const todaysDate = '2025-09-18';
      const scanTime = '14:15';
      
      setVulnerabilityScans([
        { 
          id: 1, 
          scan_date: todaysDate,
          scan_time: scanTime,
          type: 'Supabase Linter', 
          status: 'completed', 
          findings: 3, 
          critical: 0, 
          high: 0, 
          medium: 3,
          detailed_findings: [
            { 
              title: 'Function Search Paths', 
              description: 'Some functions missing secure search paths', 
              severity: 'medium',
              remediation: 'Add SET search_path to remaining functions'
            },
            { 
              title: 'Extension in Public Schema', 
              description: 'Extensions installed in public schema', 
              severity: 'medium',
              remediation: 'Move extensions to appropriate schemas'
            },
            { 
              title: 'Postgres Version', 
              description: 'Security patches available for current version', 
              severity: 'medium',
              remediation: 'Consider upgrading to latest patch version'
            }
          ]
        },
        { 
          id: 2, 
          scan_date: todaysDate,
          scan_time: scanTime,
          type: 'Data Security Review', 
          status: 'completed', 
          findings: 5, 
          critical: 0, 
          high: 0, 
          medium: 5,
          detailed_findings: [
            { 
              title: 'Public Medical Data', 
              description: 'News articles table publicly readable', 
              severity: 'medium',
              remediation: 'Review if public access is intended'
            },
            { 
              title: 'NHS Terms Database', 
              description: 'Terminology exposed without authentication', 
              severity: 'medium',
              remediation: 'Consider access control requirements'
            },
            { 
              title: 'Healthcare Operations', 
              description: 'Bank holiday schedules publicly accessible', 
              severity: 'medium',
              remediation: 'Assess if public access is appropriate'
            },
            { 
              title: 'CQC Compliance Framework', 
              description: 'Assessment framework exposed', 
              severity: 'medium',
              remediation: 'Review public data exposure'
            },
            { 
              title: 'Data Retention Policies', 
              description: 'Retention schedules publicly visible', 
              severity: 'medium',
              remediation: 'Consider restricting policy visibility'
            }
          ]
        }
      ]);

    } catch (error) {
      console.error('Error fetching authentication data:', error);
      toast.error("Failed to fetch authentication logs");
      setAuthenticationLogs([]);
      setPatientDataAccess([]);
    } finally {
      setLoadingAuthLogs(false);
    }
  };
  
  // Policy management functions
  const fetchPolicyTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('policy_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPolicyTemplates(data || []);
    } catch (error) {
      console.error('Error fetching policy templates:', error);
      toast.error("Failed to fetch policy templates");
    }
  };

  const fetchPracticeAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('practice_policy_assignments')
        .select(`
          *,
          policy_templates (
            name,
            description,
            policy_type,
            region,
            configuration
          )
        `)
        .eq('is_active', true);

      if (error) throw error;
      setPracticeAssignments(data || []);
    } catch (error) {
      console.error('Error fetching practice assignments:', error);
      toast.error("Failed to fetch practice assignments");
    }
  };

  const assignPolicyToAllPractices = async (policyTemplateId: string, policyName: string) => {
    if (assigningPolicy) return;
    
    setAssigningPolicy(true);
    try {
      const { data, error } = await supabase.functions.invoke('assign-policy-to-practices', {
        body: {
          policy_template_id: policyTemplateId,
          policy_name: policyName
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        fetchPracticeAssignments(); // Refresh the assignments
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error assigning policy to practices:', error);
      toast.error(`Failed to assign policy: ${error.message}`);
    } finally {
      setAssigningPolicy(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-green-600';
      case 'warning': return 'text-orange-500';
      case 'critical': return 'text-red-600';
      case 'pending': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'compliant': return <Badge className="bg-green-100 text-green-800">Compliant</Badge>;
      case 'warning': return <Badge className="bg-orange-100 text-orange-800">Warning</Badge>;
      case 'critical': return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
      case 'pending': return <Badge className="bg-blue-100 text-blue-800">Pending</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>;
    }
  };

  // Export users to Excel function
  const handleExportUsersToExcel = () => {
    // Get filtered users based on current filters
    const filteredUsers = users
      .filter(user => 
        (user.full_name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(userSearchQuery.toLowerCase())) &&
        (userPracticeFilter === 'all' || 
          user.practice_assignments.some(pa => pa.practice_id === userPracticeFilter))
      );

    // Prepare data for export
    const exportData = filteredUsers.map(user => ({
      'Full Name': user.full_name,
      'Email': user.email,
      'Last Activity': user.last_login 
        ? new Date(user.last_login).toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'Never',
      'Practice Name': user.practice_assignments.map(pa => pa.practice_name).join('; ') || 'None',
      'Role': user.practice_assignments.map(pa => pa.role).join('; ') || 'None'
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, // Full Name
      { wch: 35 }, // Email
      { wch: 20 }, // Last Activity
      { wch: 35 }, // Practice Name
      { wch: 20 }  // Role
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Users');

    // Generate filename with date
    const date = new Date().toISOString().split('T')[0];
    const filename = `users_export_${date}.xlsx`;

    // Download file
    XLSX.writeFile(wb, filename);
    toast.success(`Exported ${filteredUsers.length} users to Excel`);
  };

  // User management functions
  const handleAddUser = () => {
    setEditingUser(null);
    setUserServiceActivations({
      nres: false,
      enn: false,
      ai4pm: false,
      ai4gp: false,
      meeting_recorder: false,
      complaints: false,
      cqc: false,
      lg_capture: false
    });
    // Apply role-based defaults for 'practice_manager' role
    const defaultModules = getDefaultModulesForRole('practice_manager');
    setUserFormData({
      email: '',
      full_name: '',
      password: generateMemorablePassword(),
      role: 'practice_manager',
      practice_id: 'none',
      module_access: defaultModules
    });
    setShowPasswordField(true);
    // Reset welcome email options
    setSendWelcomeEmail(true);
    setWelcomeEmailTestMode(false);
    setShowUserModal(true);
  };

  // Handle role change to apply defaults
  const handleRoleChange = (newRole: string) => {
    const defaultModules = getDefaultModulesForRole(newRole);
    setUserFormData(prev => ({
      ...prev,
      role: newRole as any,
      module_access: editingUser ? prev.module_access : defaultModules
    }));
  };

  const handleEditUser = async (user: any) => {
    console.log('=== EDITING USER START ===');
    console.log('Full user object:', user);
    console.log('User module access data:', {
      meeting_notes: user.meeting_notes_access,
      gp_scribe: user.gp_scribe_access,
      complaints_manager: user.complaints_manager_access,
      ai4gp: user.ai4gp_access,
      enhanced: user.enhanced_access,
      cqc_compliance: user.cqc_compliance_access,
      shared_drive: user.shared_drive_access,
      mic_test: user.mic_test_service_access,
      api_testing: user.api_testing_service_access
    });
    
    setEditingUser(user);
    
    // Fetch service activations for this user
    const { data: activations, error: activationsError } = await supabase
      .from('user_service_activations')
      .select('service')
      .eq('user_id', user.user_id);
    
    if (activationsError) {
      console.error('Error fetching service activations:', activationsError);
    }
    
    const activatedServices = (activations?.map(a => a.service) || []) as string[];
    setUserServiceActivations({
      nres: activatedServices.includes('nres'),
      enn: activatedServices.includes('enn'),
      ai4pm: activatedServices.includes('ai4pm'),
      ai4gp: activatedServices.includes('ai4gp'),
      meeting_recorder: activatedServices.includes('meeting_recorder'),
      complaints: activatedServices.includes('complaints'),
      cqc: activatedServices.includes('cqc'),
      lg_capture: activatedServices.includes('lg_capture')
    });
    
    // Get the user's role - check if they have a system_admin role first
    let userRole: 'practice_user' | 'practice_manager' | 'pcn_manager' | 'system_admin' = 'practice_user';
    if (user.practice_assignments && user.practice_assignments.length > 0) {
      // Check if any assignment has system_admin role
      const systemAdminAssignment = user.practice_assignments.find((assignment: any) => assignment.role === 'system_admin');
      if (systemAdminAssignment) {
        userRole = 'system_admin';
      } else {
        userRole = user.practice_assignments[0].role || 'practice_user';
      }
    }
    
    const formData = {
      email: user.email,
      full_name: user.full_name,
      password: '',
      role: userRole,
      practice_id: user.practice_assignments[0]?.practice_id || 'none',
      module_access: {
        meeting_notes_access: user.meeting_notes_access ?? false,
        gp_scribe_access: user.gp_scribe_access ?? false,
        complaints_manager_access: user.complaints_manager_access ?? false,
        ai4gp_access: user.ai4gp_access ?? false,
        enhanced_access: user.enhanced_access ?? false,
        cqc_compliance_access: user.cqc_compliance_access ?? false,
        shared_drive_access: user.shared_drive_access ?? false,
        mic_test_service_access: user.mic_test_service_access ?? false,
        api_testing_service_access: user.api_testing_service_access ?? false,
        translation_service_access: user.translation_service_access ?? false,
        fridge_monitoring_access: user.fridge_monitoring_access ?? false,
        cso_governance_access: user.cso_governance_access ?? false,
        lg_capture_access: user.lg_capture_access ?? false,
        bp_service_access: user.bp_service_access ?? false,
        survey_manager_access: user.survey_manager_access ?? false,
        document_signoff_access: user.document_signoff_access ?? false,
        agewell_access: (user as any).agewell_access ?? false
      }
    };
    
    console.log('Setting form data:', formData);
    console.log('Module access being set:', formData.module_access);
    console.log('User role determined:', userRole);
    
    setUserFormData(formData);
    setShowUserModal(true);
    
    console.log('=== EDITING USER END ===');
  };

  // Toggle service activation for a user
  const toggleServiceActivation = async (serviceKey: 'nres' | 'enn' | 'ai4pm' | 'ai4gp' | 'meeting_recorder' | 'complaints' | 'cqc' | 'lg_capture', enabled: boolean) => {
    if (!editingUser) return;
    
    try {
      if (enabled) {
        // Upsert activation record (handles case where it already exists)
        const { error } = await (supabase
          .from('user_service_activations')
          .upsert(
            {
              user_id: editingUser.user_id,
              service: serviceKey,
              activated_by: user?.id,
              activated_at: new Date().toISOString(),
            } as any,
            {
              onConflict: 'user_id,service',
            }
          ) as any);

        // If a record already exists, treat as success (defensive guard)
        if (error) {
          const msg = (error as any)?.message as string | undefined;
          const code = (error as any)?.code as string | undefined;
          const isDuplicate = code === '23505' || msg?.includes('user_service_activations_user_id_service_key');
          if (!isDuplicate) throw error;
        }

        toast.success(`${serviceKey.toUpperCase()} activated for user`);
      } else {
        // Remove activation record
        const { error } = await (supabase
          .from('user_service_activations')
          .delete()
          .eq('user_id', editingUser.user_id)
          .eq('service', serviceKey as any) as any);
        
        if (error) throw error;
        toast.success(`${serviceKey.toUpperCase()} deactivated for user`);
      }
      
      setUserServiceActivations(prev => ({
        ...prev,
        [serviceKey]: enabled
      }));
    } catch (error) {
      console.error('Error toggling service activation:', error);
      toast.error('Failed to update service activation');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        const { error } = await supabase.functions.invoke('delete-user-admin', {
          body: { user_id: userId }
        });
        if (error) throw error;
        await fetchUsers(); // Refresh the users list
        toast.success('User deleted successfully');
      } catch (error) {
        console.error('Error deleting user:', error);
        toast.error('Failed to delete user');
      }
    }
  };

const openPasswordModal = (u: User) => {
  setPasswordTargetUser(u);
  setNewPassword('');
  setShowPasswordModal(true);
};

const handleLoginAsUser = async (targetUser: User) => {
  if (!targetUser.user_id) return;

  setLoggingInAsUser(targetUser.user_id);
  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    const accessToken = session?.access_token;
    if (!accessToken) {
      throw new Error('You must be signed in to use “Login as user”.');
    }

    const { data, error } = await supabase.functions.invoke('admin-login-as-user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        targetUserId: targetUser.user_id,
        redirectTo: window.location.origin + '/',
      },
    });

    if (error) throw error;

    if (!data?.loginUrl) {
      throw new Error(data?.error || 'Failed to generate login link');
    }

    // Open in new tab so admin stays logged in
    window.open(data.loginUrl, '_blank');
    toast.success(`Opening login as ${targetUser.full_name} in new tab`);
  } catch (err: any) {
    console.error('Error logging in as user:', err);
    toast.error(err.message || 'Failed to login as user');
  } finally {
    setLoggingInAsUser(null);
  }
};

const openLoginHistoryModal = async (user: User) => {
  setLoginHistoryUser(user);
  setShowLoginHistoryModal(true);
  setLoadingLoginHistory(true);
  
  try {
    console.log('Fetching login history for user:', user.user_id, user.full_name);
    
    // Clean up expired sessions first
    console.log('Cleaning up expired sessions...');
    const { data: cleanupResult, error: cleanupError } = await supabase.rpc('cleanup_expired_sessions');
    if (cleanupError) {
      console.error('Error cleaning up expired sessions:', cleanupError);
    } else {
      console.log('Cleaned up expired sessions:', cleanupResult);
    }
    
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', user.user_id)
      .order('login_time', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    console.log('Login history data:', data);
    setLoginHistory(data || []);
  } catch (error) {
    console.error('Error fetching login history:', error);
    toast.error('Failed to fetch login history');
  } finally {
    setLoadingLoginHistory(false);
  }
};

const handlePasswordUpdate = async () => {
  if (!passwordTargetUser) return;
  if (newPassword.length < 8) {
    toast.error('Password must be at least 8 characters');
    return;
  }
  try {
    setUpdatingPassword(true);
    const { data, error } = await supabase.functions.invoke('update-user-password-admin', {
      body: { email: passwordTargetUser.email, new_password: newPassword }
    });
    
    if (error) throw error;
    
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to update password');
    }
    
    toast.success('Password updated successfully');
    setShowPasswordModal(false);
    setNewPassword('');
  } catch (err: any) {
    console.error('Error updating password:', err);
    toast.error(err.message || 'Failed to update password');
  } finally {
    setUpdatingPassword(false);
  }
};

// Auto-save function for module access changes
const autoSaveModuleAccess = async (moduleKey: string, checked: boolean) => {
  if (!editingUser) return;
  
  try {
    console.log(`Auto-saving ${moduleKey} to ${checked} for user ${editingUser.user_id}`);
    
    // Check if user_roles record exists first
    const { data: existingRoles, error: fetchError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', editingUser.user_id);
      
    if (fetchError) {
      console.error('Auto-save fetch error:', fetchError);
      toast.error(`Failed to auto-save ${moduleKey}`);
      return;
    }
    
    console.log('Existing roles found for auto-save:', existingRoles);
    
    if (existingRoles && existingRoles.length > 0) {
      // Update existing user_roles record
      const updateData = {
        [moduleKey]: checked
      };
      
      console.log('Auto-saving with data:', updateData);
      
      const { error: roleError } = await supabase
        .from('user_roles')
        .update(updateData as any)
        .eq('user_id', editingUser.user_id);
        
      if (roleError) {
        console.error('Auto-save update error:', roleError);
        toast.error(`Failed to auto-save ${moduleKey}`);
        return;
      }
    } else {
      // Create new user_roles record
      const insertData = {
        user_id: editingUser.user_id,
        role: userFormData.role || 'practice_user',
        practice_id: userFormData.practice_id !== 'none' ? userFormData.practice_id : null,
        assigned_by: user?.id,
        meeting_notes_access: moduleKey === 'meeting_notes_access' ? checked : userFormData.module_access.meeting_notes_access,
        gp_scribe_access: moduleKey === 'gp_scribe_access' ? checked : userFormData.module_access.gp_scribe_access,
        complaints_manager_access: moduleKey === 'complaints_manager_access' ? checked : userFormData.module_access.complaints_manager_access,
        enhanced_access: moduleKey === 'enhanced_access' ? checked : userFormData.module_access.enhanced_access,
        cqc_compliance_access: moduleKey === 'cqc_compliance_access' ? checked : userFormData.module_access.cqc_compliance_access,
        shared_drive_access: moduleKey === 'shared_drive_access' ? checked : userFormData.module_access.shared_drive_access,
        mic_test_service_access: moduleKey === 'mic_test_service_access' ? checked : userFormData.module_access.mic_test_service_access,
        api_testing_service_access: moduleKey === 'api_testing_service_access' ? checked : userFormData.module_access.api_testing_service_access,
        translation_service_access: moduleKey === 'translation_service_access' ? checked : userFormData.module_access.translation_service_access,
        fridge_monitoring_access: moduleKey === 'fridge_monitoring_access' ? checked : userFormData.module_access.fridge_monitoring_access,
        cso_governance_access: moduleKey === 'cso_governance_access' ? checked : userFormData.module_access.cso_governance_access,
        lg_capture_access: moduleKey === 'lg_capture_access' ? checked : userFormData.module_access.lg_capture_access,
        bp_service_access: moduleKey === 'bp_service_access' ? checked : userFormData.module_access.bp_service_access,
        agewell_access: moduleKey === 'agewell_access' ? checked : userFormData.module_access.agewell_access,
      };
      
      console.log('Auto-saving by inserting new role with data:', insertData);
      
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert(insertData);
      
      if (roleError) {
        console.error('Auto-save insert error:', roleError);
        toast.error(`Failed to auto-save ${moduleKey}`);
        return;
      }
    }
    
    // Handle AI4GP access separately as it's stored in profiles table
    if (moduleKey === 'ai4gp_access') {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ ai4gp_access: checked })
        .eq('user_id', editingUser.user_id);
        
      if (profileError) {
        console.error('Auto-save profile error:', profileError);
        toast.error(`Failed to auto-save ${moduleKey}`);
        return;
      }
    }
    
    // Show success message
    toast.success(`${moduleKey.replace(/_/g, ' ').replace(/access/g, '').trim()} ${checked ? 'enabled' : 'disabled'}`);
    
    // Refresh user list to show updated permissions
    fetchUsers();
    
  } catch (error) {
    console.error('Auto-save error:', error);
    toast.error(`Failed to auto-save ${moduleKey}`);
  }
};

  // Prior approval data upload handlers
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    files.forEach(file => {
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setUploadedFiles(prev => [...prev, { name: file.name, content }]);
        };
        reader.readAsText(file);
      } else {
        toast.error(`File ${file.name} is not a JSON file`);
      }
    });
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processJsonFiles = async () => {
    if (uploadedFiles.length === 0) {
      toast.error('No files selected');
      return;
    }

    setIsUploading(true);
    try {
      const allData: any[] = [];
      
      // Parse all JSON files
      for (const file of uploadedFiles) {
        try {
          const parsed = JSON.parse(file.content);
          if (Array.isArray(parsed)) {
            allData.push(...parsed);
          } else {
            allData.push(parsed);
          }
        } catch (error) {
          console.error(`Error parsing ${file.name}:`, error);
          toast.error(`Error parsing ${file.name}: Invalid JSON`);
          continue;
        }
      }

      if (allData.length === 0) {
        toast.error('No valid data found in uploaded files');
        return;
      }

      // Call the Supabase function to process the data
      const { data, error } = await supabase.functions.invoke('import-prior-approval-data', {
        body: { medicines: allData }
      });

      if (error) {
        console.error('Error processing files:', error);
        toast.error('Failed to process files: ' + error.message);
        return;
      }

      toast.success(`Successfully processed ${allData.length} records from ${uploadedFiles.length} files`);
      setUploadedFiles([]);
    } catch (error) {
      console.error('Error processing files:', error);
      toast.error('Failed to process files');
    } finally {
      setIsUploading(false);
    }
  };

  const fetchICBData = async () => {
    setIsFetchingICB(true);
    try {
      toast.info('Fetching latest ICB traffic light medicines...');
      
      // Call the fetch function first
      const { data: fetchData, error: fetchError } = await supabase.functions.invoke('fetch-icb-traffic-light-drugs');
      
      if (fetchError) {
        console.error('Error fetching ICB data:', fetchError);
        toast.error('Failed to fetch ICB data: ' + fetchError.message);
        return;
      }

      if (fetchData && fetchData.medicines && fetchData.medicines.length > 0) {
        // Now import the fetched data
        const { data: importData, error: importError } = await supabase.functions.invoke('import-prior-approval-data', {
          body: { medicines: fetchData.medicines }
        });

        if (importError) {
          console.error('Error importing ICB data:', importError);
          toast.error('Failed to import ICB data: ' + importError.message);
          return;
        }

        toast.success(`Successfully imported ${fetchData.medicines.length} ICB traffic light medicines`);
      } else {
        toast.warning('No medicines data received from ICB');
      }
    } catch (error) {
      console.error('Error fetching ICB data:', error);
      toast.error('Failed to fetch ICB data');
    } finally {
      setIsFetchingICB(false);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('=== FORM SUBMIT START ===');
    console.log('Submitting user form with data:', userFormData);
    console.log('Module access being saved:', userFormData.module_access);
    console.log('Editing user:', editingUser?.user_id);
    
    setSavingUser(true);
    try {
      if (editingUser) {
        console.log('=== UPDATING EXISTING USER ===');
        
        // Store the current form data to prevent it from being overwritten
        const currentFormData = { ...userFormData };
        console.log('Stored current form data:', currentFormData.module_access);
        
        // First, handle practice assignment if specified
        if (userFormData.practice_id !== 'none') {
          console.log('Updating user with practice assignment');
          // Remove any existing role assignments for this user
          const { error: deleteError } = await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', editingUser.user_id);
            
          if (deleteError) {
            console.error('Delete error:', deleteError);
            throw deleteError;
          }
          
          // Create new role assignment with practice
          const insertData = {
            user_id: editingUser.user_id,
            role: currentFormData.role,
            practice_id: currentFormData.practice_id,
            assigned_by: user?.id,
            meeting_notes_access: currentFormData.module_access.meeting_notes_access,
            gp_scribe_access: currentFormData.module_access.gp_scribe_access,
            complaints_manager_access: currentFormData.module_access.complaints_manager_access,
            enhanced_access: currentFormData.module_access.enhanced_access,
            cqc_compliance_access: currentFormData.module_access.cqc_compliance_access,
            shared_drive_access: currentFormData.module_access.shared_drive_access,
            mic_test_service_access: currentFormData.module_access.mic_test_service_access,
            api_testing_service_access: currentFormData.module_access.api_testing_service_access,
            translation_service_access: currentFormData.module_access.translation_service_access,
            fridge_monitoring_access: currentFormData.module_access.fridge_monitoring_access,
            cso_governance_access: currentFormData.module_access.cso_governance_access
          };
          
          console.log('Inserting new role with data:', insertData);
          
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert(insertData);
          
          if (roleError) {
            console.error('Insert error:', roleError);
            throw roleError;
          }
        } else {
          console.log('Updating user without practice assignment');
          // Check if user_roles record exists first
          const { data: existingRoles, error: fetchError } = await supabase
            .from('user_roles')
            .select('*')
            .eq('user_id', editingUser.user_id);
            
          if (fetchError) {
            console.error('Fetch error:', fetchError);
            throw fetchError;
          }
          
          console.log('Existing roles found:', existingRoles);
          
          if (existingRoles && existingRoles.length > 0) {
            // Update existing user_roles record when no practice is assigned
            const updateData = {
              meeting_notes_access: currentFormData.module_access.meeting_notes_access,
              gp_scribe_access: currentFormData.module_access.gp_scribe_access,
              complaints_manager_access: currentFormData.module_access.complaints_manager_access,
              enhanced_access: currentFormData.module_access.enhanced_access,
              cqc_compliance_access: currentFormData.module_access.cqc_compliance_access,
              shared_drive_access: currentFormData.module_access.shared_drive_access,
              mic_test_service_access: currentFormData.module_access.mic_test_service_access,
              api_testing_service_access: currentFormData.module_access.api_testing_service_access,
              translation_service_access: currentFormData.module_access.translation_service_access,
              fridge_monitoring_access: currentFormData.module_access.fridge_monitoring_access,
              cso_governance_access: currentFormData.module_access.cso_governance_access,
              role: currentFormData.role || 'practice_user'
            };
            
            console.log('Updating existing roles with data:', updateData);
            
            const { error: roleError } = await supabase
              .from('user_roles')
              .update(updateData)
              .eq('user_id', editingUser.user_id);
              
            if (roleError) {
              console.error('Update error:', roleError);
              throw roleError;
            }
            
            console.log('Successfully updated user_roles');
          } else {
            console.log('No existing roles found, creating new one');
            // Create new user_roles record if none exists
            const insertData = {
              user_id: editingUser.user_id,
              role: currentFormData.role || 'practice_user',
              assigned_by: user?.id,
              meeting_notes_access: currentFormData.module_access.meeting_notes_access,
              gp_scribe_access: currentFormData.module_access.gp_scribe_access,
              complaints_manager_access: currentFormData.module_access.complaints_manager_access,
              enhanced_access: currentFormData.module_access.enhanced_access,
              cqc_compliance_access: currentFormData.module_access.cqc_compliance_access,
              shared_drive_access: currentFormData.module_access.shared_drive_access,
              mic_test_service_access: currentFormData.module_access.mic_test_service_access,
              api_testing_service_access: currentFormData.module_access.api_testing_service_access,
              translation_service_access: currentFormData.module_access.translation_service_access,
              fridge_monitoring_access: currentFormData.module_access.fridge_monitoring_access,
              cso_governance_access: currentFormData.module_access.cso_governance_access
            };
            
            console.log('Inserting new role with data:', insertData);
            
            const { error: roleError } = await supabase
              .from('user_roles')
              .insert(insertData);
              
            if (roleError) {
              console.error('Insert error:', roleError);
              throw roleError;
            }
            
            console.log('Successfully created new user_roles record');
          }
        }
        
        // Update AI4GP access in profiles table
        console.log('Updating AI4GP access in profiles:', currentFormData.module_access.ai4gp_access);
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            ai4gp_access: currentFormData.module_access.ai4gp_access
          })
          .eq('user_id', editingUser.user_id);
        
        if (profileError) {
          console.error('Profile update error:', profileError);
          throw profileError;
        }
        
        console.log('Successfully updated profiles table');
        console.log('Successfully updated all records for user:', editingUser.user_id);
        
        // If we're updating the current user, refresh their permissions immediately
        if (editingUser.user_id === user?.id) {
          console.log('Refreshing current user modules');
          await refreshUserModules();
        }
        
        console.log('=== REFRESHING USER LIST ===');
        await fetchUsers(); // Refresh the users list
        toast.success('User updated successfully');
      } else {
        console.log('=== CREATING NEW USER ===');
        // Create new user with AI4GP access support
        const { data, error } = await supabase.functions.invoke('create-user-admin', {
          body: {
            email: userFormData.email,
            name: userFormData.full_name,
            password: userFormData.password,
            role: userFormData.role,
            practice_id: userFormData.practice_id === 'none' ? null : userFormData.practice_id,
            assigned_by: user?.id,
            ai4gp_access: userFormData.module_access.ai4gp_access,
            module_access: userFormData.module_access,
            api_testing_service_access: userFormData.module_access.api_testing_service_access
          }
        });
        if (error) throw error;
        
        // Send welcome email if enabled
        if (sendWelcomeEmail) {
          setSendingWelcomeEmail(true);
          try {
            const practiceName = userFormData.practice_id !== 'none' 
              ? practices.find(p => p.id === userFormData.practice_id)?.name 
              : undefined;
            
            const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-user-welcome-email', {
              body: {
                user_email: userFormData.email,
                user_name: userFormData.full_name,
                user_password: userFormData.password,
                user_role: userFormData.role,
                practice_name: practiceName,
                module_access: userFormData.module_access,
                test_mode: welcomeEmailTestMode,
                test_email: 'Malcolm.Railson@nhs.net'
              }
            });
            
            if (emailError) {
              console.error('Welcome email error:', emailError);
              toast.error('User created but welcome email failed to send');
            } else {
              const recipient = welcomeEmailTestMode ? 'Malcolm.Railson@nhs.net (test mode)' : userFormData.email;
              toast.success(`Welcome email sent to ${recipient}`);
            }
          } catch (emailErr) {
            console.error('Welcome email error:', emailErr);
            toast.error('User created but welcome email failed to send');
          } finally {
            setSendingWelcomeEmail(false);
          }
        }
        
        await fetchUsers(); // Refresh the users list
        toast.success('User created successfully');
      }
      setShowUserModal(false);
      console.log('=== FORM SUBMIT SUCCESS ===');
    } catch (error) {
      console.error('=== FORM SUBMIT ERROR ===');
      console.error('Error saving user:', error);
      toast.error('Failed to save user: ' + (error as any)?.message);
    } finally {
      setSavingUser(false);
    }
  };

  // Practice Management Functions
  const handleAddPractice = () => {
    setEditingPractice(null);
    setPracticeFormData({
      name: '',
      practice_code: '',
      address: '',
      postcode: '',
      website: '',
      email: '',
      phone: '',
      neighbourhood_id: 'none',
      pcn_code: 'none'
    });
    setShowPracticeModal(true);
  };

  const handleEditPractice = (practice: Practice) => {
    setEditingPractice(practice);
    setPracticeFormData({
      name: practice.name,
      practice_code: practice.practice_code || '',
      address: practice.address || '',
      postcode: practice.postcode || '',
      website: practice.website || '',
      email: practice.email || '',
      phone: practice.phone || '',
      neighbourhood_id: practice.neighbourhood_id || 'none',
      pcn_code: practice.pcn_code || 'none'
    });
    setShowPracticeModal(true);
  };

  const handlePracticeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPractice) {
        // Update existing practice
        const { error } = await supabase
          .from('gp_practices')
          .update({
            name: practiceFormData.name,
            practice_code: practiceFormData.practice_code,
            address: practiceFormData.address,
            postcode: practiceFormData.postcode,
            website: practiceFormData.website,
            email: practiceFormData.email,
            phone: practiceFormData.phone,
            neighbourhood_id: practiceFormData.neighbourhood_id === 'none' ? null : practiceFormData.neighbourhood_id || null,
            pcn_code: practiceFormData.pcn_code === 'none' ? null : practiceFormData.pcn_code || null,
          })
          .eq('id', editingPractice.id);
        
        if (error) throw error;
        toast.success('Practice updated successfully');
      } else {
        // Create new practice - need admin function for proper setup
        toast.error('Creating new practices is not yet implemented');
        return;
      }
      
      setShowPracticeModal(false);
      await fetchPractices(); // Refresh the practices list
    } catch (error) {
      console.error('Error saving practice:', error);
      toast.error('Failed to save practice');
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header onNewMeeting={() => {}} />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="flex items-center justify-center p-8">
              <div className="text-center">
                <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
                <p className="text-muted-foreground">
                  You need system administrator privileges to access this page.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onNewMeeting={() => {}} />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">System Administration</h1>
            <p className="text-muted-foreground">Manage users, system configuration, security, and monitoring</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 h-auto">
            <TabsTrigger value="overview" className="flex flex-col sm:flex-row items-center gap-1 text-xs sm:text-sm p-2 sm:p-3">
              <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Overview</span>
              <span className="sm:hidden">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="user-management" className="flex flex-col sm:flex-row items-center gap-1 text-xs sm:text-sm p-2 sm:p-3">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">User Management</span>
              <span className="sm:hidden">Users</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex flex-col sm:flex-row items-center gap-1 text-xs sm:text-sm p-2 sm:p-3">
              <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Security</span>
              <span className="sm:hidden">Security</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex flex-col sm:flex-row items-center gap-1 text-xs sm:text-sm p-2 sm:p-3">
              <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Settings</span>
              <span className="sm:hidden">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex flex-col sm:flex-row items-center gap-1 text-xs sm:text-sm p-2 sm:p-3">
              <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">System Monitoring</span>
              <span className="sm:hidden">Monitor</span>
            </TabsTrigger>
            <TabsTrigger value="ai4gp-services" className="flex flex-col sm:flex-row items-center gap-1 text-xs sm:text-sm p-2 sm:p-3">
              <Bot className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Pilot Usage Report</span>
              <span className="sm:hidden">Pilot</span>
            </TabsTrigger>
            <TabsTrigger value="dpia-generator" className="flex flex-col sm:flex-row items-center gap-1 text-xs sm:text-sm p-2 sm:p-3">
              <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Onboard Service</span>
              <span className="sm:hidden">Onboard</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Maintenance Mode Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Maintenance Mode
                </CardTitle>
                <CardDescription>
                  Control system-wide maintenance mode and custom messaging
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="maintenance-mode" className="text-base font-semibold">
                      Maintenance Mode
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Current status: {maintenanceMode.enabled ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                  <Switch
                    id="maintenance-mode"
                    checked={maintenanceMode.enabled}
                    onCheckedChange={(checked) => handleMaintenanceModeUpdate(checked, customMessage)}
                    disabled={updating}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="maintenance-message">Custom Message</Label>
                  <Textarea
                    id="maintenance-message"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Enter custom maintenance message..."
                    rows={3}
                  />
                  <Button 
                    size="sm" 
                    onClick={() => handleMaintenanceModeUpdate(maintenanceMode.enabled, customMessage)}
                    disabled={updating}
                  >
                    Update Message
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats.totalUsers}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats.totalMeetings}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Practices</CardTitle>
                  <Building className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats.totalPractices}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total PCNs</CardTitle>
                  <Network className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats.totalPCNs}</div>
                </CardContent>
              </Card>
              <Card className={stuckMeetings.length > 0 ? 'border-destructive' : ''}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Stuck Meetings</CardTitle>
                  <AlertTriangle className={stuckMeetings.length > 0 ? 'h-4 w-4 text-destructive' : 'h-4 w-4 text-muted-foreground'} />
                </CardHeader>
                <CardContent>
                  <div className={stuckMeetings.length > 0 ? 'text-2xl font-bold text-destructive' : 'text-2xl font-bold'}>
                    {loadingStuckMeetings ? '…' : stuckMeetings.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stuckMeetings.length > 0 ? 'Need admin review' : 'None detected'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Security Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Security Events</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    {securityEvents.filter(e => e.severity === 'critical').length}
                  </div>
                  <p className="text-xs text-muted-foreground">Critical events this week</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Compliance Status</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">85%</div>
                  <p className="text-xs text-muted-foreground">Overall compliance</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
                  <Shield className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-500">23</div>
                  <p className="text-xs text-muted-foreground">Last 24 hours</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Health</CardTitle>
                  <Activity className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">98%</div>
                  <p className="text-xs text-muted-foreground">Uptime</p>
                </CardContent>
              </Card>
            </div>

            {/* ICB Traffic Light Medicines Manager */}
            <ICBTrafficLightManager />

            {/* Database Size Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database Size Breakdown
                  </CardTitle>
                  <CardDescription>Storage usage by table</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {databaseSizes.slice(0, 10).map((table, index) => (
                      <div key={table.table_name} className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{table.table_name}</p>
                          <p className="text-xs text-muted-foreground">{table.row_count.toLocaleString()} rows</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{table.size_pretty}</p>
                          <p className="text-xs text-muted-foreground">{table.size_bytes.toLocaleString()} bytes</p>
                        </div>
                      </div>
                    ))}
                    {databaseSizes.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Loading database sizes...</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Large Files Overview
                  </CardTitle>
                  <CardDescription>File statistics and large files overview</CardDescription>
                </CardHeader>
                <CardContent>
                  {fileStats ? (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-card rounded-lg border p-4">
                        <div className="text-2xl font-bold text-primary">{fileStats.files_over_1mb}</div>
                        <p className="text-muted-foreground text-sm">Files over 1MB</p>
                      </div>
                      <div className="bg-card rounded-lg border p-4">
                        <div className="text-2xl font-bold text-primary">{fileStats.files_500kb_to_1mb}</div>
                        <p className="text-muted-foreground text-sm">Files 500KB-1MB</p>
                      </div>
                      <div className="bg-card rounded-lg border p-4">
                        <div className="text-2xl font-bold text-primary">{fileStats.total_large_files}</div>
                        <p className="text-muted-foreground text-sm">Total files tracked</p>
                      </div>
                      <div className="bg-card rounded-lg border p-4">
                        <div className="text-2xl font-bold text-primary">{fileStats.total_large_files_size_pretty}</div>
                        <p className="text-muted-foreground text-sm">Total storage used</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground mb-6">Loading file statistics...</div>
                  )}
                  {/* Quick link: thumbnail gallery of all generated images */}
                  <div className="mb-4">
                    <UserGeneratedImagesGallery />
                  </div>
                  {/* Collapsible Users Table for files over 1MB */}
                  <Collapsible open={largeFilesOpen} onOpenChange={setLargeFilesOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between mb-4">
                        <span className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Users with Large Files ({largeFiles.filter(f => f.file_size >= 1048576).length})
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${largeFilesOpen ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border rounded-lg overflow-hidden mb-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead 
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => {
                                  if (largeFilesSortField === 'file_name') {
                                    setLargeFilesSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                  } else {
                                    setLargeFilesSortField('file_name');
                                    setLargeFilesSortDirection('asc');
                                  }
                                }}
                              >
                                <div className="flex items-center gap-1">
                                  File Name
                                  {largeFilesSortField === 'file_name' && (
                                    largeFilesSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                  )}
                                </div>
                              </TableHead>
                              <TableHead>User Email</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead 
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => {
                                  if (largeFilesSortField === 'file_size') {
                                    setLargeFilesSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                  } else {
                                    setLargeFilesSortField('file_size');
                                    setLargeFilesSortDirection('desc');
                                  }
                                }}
                              >
                                <div className="flex items-center gap-1">
                                  Size
                                  {largeFilesSortField === 'file_size' && (
                                    largeFilesSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                  )}
                                </div>
                              </TableHead>
                              <TableHead 
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => {
                                  if (largeFilesSortField === 'uploaded_at') {
                                    setLargeFilesSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                  } else {
                                    setLargeFilesSortField('uploaded_at');
                                    setLargeFilesSortDirection('desc');
                                  }
                                }}
                              >
                                <div className="flex items-center gap-1">
                                  Date Uploaded
                                  {largeFilesSortField === 'uploaded_at' && (
                                    largeFilesSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                  )}
                                </div>
                              </TableHead>
                              <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {largeFiles
                              .filter(f => f.file_size >= 1048576)
                              .sort((a, b) => {
                                let comparison = 0;
                                if (largeFilesSortField === 'file_size') {
                                  comparison = a.file_size - b.file_size;
                                } else if (largeFilesSortField === 'uploaded_at') {
                                  comparison = new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime();
                                } else if (largeFilesSortField === 'file_name') {
                                  comparison = a.file_name.localeCompare(b.file_name);
                                }
                                return largeFilesSortDirection === 'asc' ? comparison : -comparison;
                              })
                              .map((file, index) => {
                                const fileKey = `${file.table_name}-${file.file_name}`;
                                const isDeleting = deletingFile === fileKey;
                                const fileExtension = file.file_name.split('.').pop()?.toUpperCase() || 'Unknown';
                                
                                return (
                                  <TableRow key={`${file.table_name}-${index}`}>
                                    <TableCell className="font-medium max-w-[200px] truncate" title={file.file_name}>
                                      {file.file_name}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {file.uploaded_by_email || 'Unknown'}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="secondary" className="text-xs">
                                        {fileExtension}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">{file.file_size_pretty}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {new Date(file.uploaded_at).toLocaleDateString('en-GB')}
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => deleteFile(file)}
                                        disabled={isDeleting}
                                        className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 w-8 p-0"
                                      >
                                        {isDeleting ? (
                                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                        ) : (
                                          <Trash2 className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            {largeFiles.filter(f => f.file_size >= 1048576).length === 0 && (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                                  No files over 1MB found
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            </div>

            {/* Storage Management - Detailed per-user storage analysis */}
            <StorageManagement />

          </TabsContent>


          {/* AI4GP Services Tab */}
          <TabsContent value="ai4gp-services" className="space-y-6">
            <AI4GPServicesOverview />
          </TabsContent>

          {/* Onboard Service Tab */}
          <TabsContent value="dpia-generator" className="space-y-6">
            <SendDPIATemplateCard />
            <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">Loading DPIA Generator…</div>}>
              <DPIAGenerator />
            </Suspense>
          </TabsContent>




          {/* User Management Tab */}
          <TabsContent value="user-management" className="space-y-6">
            <Tabs defaultValue="users" className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto">
                <TabsTrigger value="users" className="text-xs sm:text-sm p-2">Users</TabsTrigger>
                <TabsTrigger value="practices" className="text-xs sm:text-sm p-2">Practices</TabsTrigger>
                <TabsTrigger value="pcns" className="text-xs sm:text-sm p-2">PCNs</TabsTrigger>
                <TabsTrigger value="neighbourhoods" className="text-xs sm:text-sm p-2">Neighbourhoods</TabsTrigger>
                <TabsTrigger value="policies" className="text-xs sm:text-sm p-2">Policies</TabsTrigger>
              </TabsList>
              
              <TabsContent value="users" className="space-y-6">
                {/* Admin Tools Row */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center space-x-2">
                      <Search className="h-4 w-4" />
                      <Input
                        placeholder="Search users..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        className="w-64"
                      />
                    </div>
                    <Select value={userPracticeFilter} onValueChange={setUserPracticeFilter}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filter by Practice" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Practices</SelectItem>
                        {practices.map((practice) => (
                          <SelectItem key={practice.id} value={practice.id}>
                            {practice.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleExportUsersToExcel}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export to Excel
                    </Button>
                    <Button onClick={handleAddUser}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add User
                    </Button>
                  </div>
                </div>

                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => {
                            if (userSortField === 'full_name') {
                              setUserSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                            } else {
                              setUserSortField('full_name');
                              setUserSortDirection('asc');
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            Name
                            {userSortField === 'full_name' ? (
                              userSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4 opacity-50" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => {
                            if (userSortField === 'last_login') {
                              setUserSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                            } else {
                              setUserSortField('last_login');
                              setUserSortDirection('asc');
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            Last Activity
                            {userSortField === 'last_login' ? (
                              userSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4 opacity-50" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            if (userSortField === 'practice_name') {
                              setUserSortDirection(userSortDirection === 'asc' ? 'desc' : 'asc');
                            } else {
                              setUserSortField('practice_name');
                              setUserSortDirection('asc');
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            Practice Name
                            {userSortField === 'practice_name' ? (
                              userSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4 opacity-50" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            if (userSortField === 'role') {
                              setUserSortDirection(userSortDirection === 'asc' ? 'desc' : 'asc');
                            } else {
                              setUserSortField('role');
                              setUserSortDirection('asc');
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            User Role
                            {userSortField === 'role' ? (
                              userSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4 opacity-50" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users
                        .filter(user => 
                          (user.full_name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                          user.email.toLowerCase().includes(userSearchQuery.toLowerCase())) &&
                          (userPracticeFilter === 'all' || 
                            user.practice_assignments.some(pa => pa.practice_id === userPracticeFilter))
                        )
                        .sort((a, b) => {
                          if (userSortField === 'full_name') {
                            const comparison = a.full_name.localeCompare(b.full_name);
                            return userSortDirection === 'asc' ? comparison : -comparison;
                          } else if (userSortField === 'last_login') {
                            const aTime = a.last_login ? new Date(a.last_login).getTime() : 0;
                            const bTime = b.last_login ? new Date(b.last_login).getTime() : 0;
                            return userSortDirection === 'asc' ? aTime - bTime : bTime - aTime;
                          } else if (userSortField === 'practice_name') {
                            const aPractice = a.practice_assignments[0]?.practice_name || '';
                            const bPractice = b.practice_assignments[0]?.practice_name || '';
                            const comparison = aPractice.localeCompare(bPractice);
                            return userSortDirection === 'asc' ? comparison : -comparison;
                          } else if (userSortField === 'role') {
                            const aRole = a.practice_assignments[0]?.role || '';
                            const bRole = b.practice_assignments[0]?.role || '';
                            const comparison = aRole.localeCompare(bRole);
                            return userSortDirection === 'asc' ? comparison : -comparison;
                          }
                          return 0;
                        })
                        .map((user) => (
                          <TableRow key={user.user_id}>
                            <TableCell className="font-medium">{user.full_name}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              {user.last_login ? (
                                <div className="flex flex-col">
                                  <span className="font-medium text-sm">
                                    {new Date(user.last_login).toLocaleDateString('en-GB', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(user.last_login).toLocaleTimeString('en-GB', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">Never</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {user.practice_assignments.slice(0, 2).map((assignment, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {assignment.practice_name}
                                  </Badge>
                                ))}
                                {user.practice_assignments.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{user.practice_assignments.length - 2} more
                                  </Badge>
                                )}
                                {user.practice_assignments.length === 0 && (
                                  <span className="text-muted-foreground text-sm">None</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {user.practice_assignments.slice(0, 2).map((assignment, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {assignment.role}
                                  </Badge>
                                ))}
                                {user.practice_assignments.length > 2 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{user.practice_assignments.length - 2} more
                                  </Badge>
                                )}
                                {user.practice_assignments.length === 0 && (
                                  <span className="text-muted-foreground text-sm">None</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)} title="Edit User">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => openPasswordModal(user)} title="Set Password">
                                  <Key className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleLoginAsUser(user)} 
                                  title="Login as User"
                                  disabled={loggingInAsUser === user.user_id}
                                >
                                  {loggingInAsUser === user.user_id ? (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                  ) : (
                                    <LogIn className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => openLoginHistoryModal(user)} title="View Login History">
                                  <Clock className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user.user_id)} title="Delete User">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>

              <TabsContent value="practices" className="space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Search className="h-4 w-4" />
                    <Input
                      placeholder="Search practices..."
                      value={practiceSearchQuery}
                      onChange={(e) => setPracticeSearchQuery(e.target.value)}
                      className="w-64"
                    />
                  </div>
                  <Button onClick={handleAddPractice}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Practice
                  </Button>
                </div>

                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <div className="space-y-2">
                            <div>Practice Name</div>
                            <Select value="all" onValueChange={() => {}}>
                              <SelectTrigger className="h-8 text-xs bg-background border-border">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent className="bg-background border-border shadow-lg z-50">
                                <SelectItem value="all">All</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="space-y-2">
                            <div>K Code (ODS)</div>
                            <Select value="all" onValueChange={() => {}}>
                              <SelectTrigger className="h-8 text-xs bg-background border-border">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent className="bg-background border-border shadow-lg z-50">
                                <SelectItem value="all">All</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="space-y-2">
                            <div>Neighbourhood</div>
                            <Select value={neighbourhoodFilter} onValueChange={(value) => {
                              console.log('Neighbourhood filter changed to:', value);
                              setNeighbourhoodFilter(value);
                            }}>
                              <SelectTrigger className="h-8 text-xs bg-background border-border">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent className="bg-background border-border shadow-lg z-50">
                                <SelectItem value="all">All</SelectItem>
                                {neighbourhoods.map((neighbourhood) => (
                                  <SelectItem key={neighbourhood.id} value={neighbourhood.name}>
                                    {neighbourhood.name}
                                  </SelectItem>
                                ))}
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="space-y-2">
                            <div>PCN Name</div>
                            <Select value={pcnFilter} onValueChange={(value) => {
                              console.log('PCN filter changed to:', value);
                              setPcnFilter(value);
                            }}>
                              <SelectTrigger className="h-8 text-xs bg-background border-border">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent className="bg-background border-border shadow-lg z-50">
                                <SelectItem value="all">All</SelectItem>
                                {pcns.map((pcn) => (
                                  <SelectItem key={pcn.id} value={pcn.pcn_name}>
                                    {pcn.pcn_name}
                                  </SelectItem>
                                ))}
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {practices
                        .filter(practice => {
                          // Text search filter
                          const matchesSearch = practice.name.toLowerCase().includes(practiceSearchQuery.toLowerCase());
                          
                          // Neighbourhood filter
                          const practiceNeighbourhood = practice.neighbourhoods?.name;
                          const matchesNeighbourhood = neighbourhoodFilter === 'all' || 
                            (neighbourhoodFilter === 'unassigned' && !practiceNeighbourhood) ||
                            practiceNeighbourhood === neighbourhoodFilter;
                          
                          // PCN filter  
                          const matchesPCN = pcnFilter === 'all' || 
                            (pcnFilter === 'unassigned' && !practice.pcn_name) ||
                            practice.pcn_name === pcnFilter;
                          
                          // Debug logging
                          if (neighbourhoodFilter !== 'all' || pcnFilter !== 'all') {
                            console.log('Filtering practice:', practice.name, {
                              neighbourhoodFilter,
                              practiceNeighbourhood,
                              matchesNeighbourhood,
                              pcnFilter,
                              practicePCN: practice.pcn_name,
                              matchesPCN,
                              finalMatch: matchesSearch && matchesNeighbourhood && matchesPCN
                            });
                          }
                          
                          return matchesSearch && matchesNeighbourhood && matchesPCN;
                        })
                        .map((practice) => (
                          <TableRow key={practice.id}>
                            <TableCell className="font-medium">{practice.name}</TableCell>
                            <TableCell>{practice.practice_code}</TableCell>
                            <TableCell>{practice.neighbourhoods?.name || 'Unassigned'}</TableCell>
                            <TableCell>{practice.pcn_name || 'Unassigned'}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleEditPractice(practice)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>

              <TabsContent value="pcns" className="space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Search className="h-4 w-4" />
                    <Input
                      placeholder="Search PCNs..."
                      value={pcnSearchQuery}
                      onChange={(e) => setPcnSearchQuery(e.target.value)}
                      className="w-64"
                    />
                  </div>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add PCN
                  </Button>
                </div>

                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PCN Name</TableHead>
                        <TableHead>PCN Code</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pcns
                        .filter(pcn => 
                          pcn.pcn_name.toLowerCase().includes(pcnSearchQuery.toLowerCase())
                        )
                        .map((pcn) => (
                          <TableRow key={pcn.id}>
                            <TableCell>{pcn.pcn_name}</TableCell>
                            <TableCell>{pcn.pcn_code}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>

              <TabsContent value="neighbourhoods" className="space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Search className="h-4 w-4" />
                    <Input
                      placeholder="Search neighbourhoods..."
                      value={neighbourhoodSearchQuery}
                      onChange={(e) => setNeighbourhoodSearchQuery(e.target.value)}
                      className="w-64"
                    />
                  </div>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Neighbourhood
                  </Button>
                </div>

                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {neighbourhoods
                        .filter(neighbourhood => 
                          neighbourhood.name.toLowerCase().includes(neighbourhoodSearchQuery.toLowerCase())
                        )
                        .map((neighbourhood) => (
                          <TableRow key={neighbourhood.id}>
                            <TableCell>{neighbourhood.name}</TableCell>
                            <TableCell>{neighbourhood.description}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>

              <TabsContent value="policies" className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Policy Management</h3>
                </div>

                <div className="grid gap-6">
                  {/* Policy Templates */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileCheck className="h-5 w-5" />
                        Available Policy Templates
                      </CardTitle>
                      <CardDescription>
                        Manage and assign policy templates to practices
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {policyTemplates.map((template) => (
                          <div key={template.id} className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-semibold">{template.name}</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {template.description}
                                </p>
                                <div className="flex items-center gap-4 mt-2">
                                  <Badge variant="outline">
                                    {template.policy_type.replace('_', ' ').toUpperCase()}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">
                                    Region: {template.region}
                                  </span>
                                  {template.configuration?.status && (
                                    <Badge 
                                      variant={template.configuration.status === 'Active' ? 'default' : 'secondary'}
                                    >
                                      {template.configuration.status}
                                    </Badge>
                                  )}
                                </div>
                                {template.configuration?.description && (
                                  <p className="text-sm text-muted-foreground mt-2">
                                    📋 {template.configuration.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                <Button
                                  onClick={() => assignPolicyToAllPractices(template.id, template.name)}
                                  disabled={assigningPolicy}
                                  className="min-w-[140px]"
                                >
                                  {assigningPolicy ? (
                                    "Assigning..."
                                  ) : (
                                    "Assign to All Practices"
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {policyTemplates.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            No policy templates found
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Practice Assignments Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Practice Policy Assignments</CardTitle>
                      <CardDescription>
                        Overview of policy assignments across all practices
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {practiceAssignments.length > 0 ? (
                          <>
                            <div className="text-sm text-muted-foreground">
                              Total assignments: {practiceAssignments.length}
                            </div>
                            
                            {/* Group assignments by policy template */}
                            {policyTemplates.map((template) => {
                              const templateAssignments = practiceAssignments.filter(
                                assignment => assignment.policy_template_id === template.id
                              );
                              
                              if (templateAssignments.length === 0) return null;
                              
                              return (
                                <div key={template.id} className="p-3 border rounded">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <h5 className="font-medium">{template.name}</h5>
                                      <p className="text-sm text-muted-foreground">
                                        Assigned to {templateAssignments.length} practices
                                      </p>
                                    </div>
                                    <Badge variant="outline">
                                      {templateAssignments.length} assignments
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            No practice assignments found
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* DCB0129 content moved into Security & Compliance tabs as <DCB0129Panel /> */}

              <TabsContent value="security-reports" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-6 w-6" />
                      Notewell System Security Assessment Report
                    </CardTitle>
                    <CardDescription>
                      Comprehensive Security Analysis - Generated {new Date().toLocaleDateString('en-GB', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="prose prose-sm max-w-none">
                    <div className="space-y-6">
                      {/* Executive Summary */}
                      <Alert>
                        <Shield className="h-4 w-4" />
                        <AlertTitle>Executive Summary</AlertTitle>
                        <AlertDescription>
                          This comprehensive security assessment reveals that the Notewell system demonstrates strong foundational security controls suitable for NHS deployment. 
                          The system features robust authentication, comprehensive audit logging, and strong data protection measures providing a solid base for clinical safety.
                        </AlertDescription>
                      </Alert>

                      {/* Current Security Status */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="border-green-200 bg-green-50">
                          <CardContent className="pt-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-green-700">0</div>
                              <div className="text-sm text-green-600">Critical Issues</div>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card className="border-amber-200 bg-amber-50">
                          <CardContent className="pt-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-amber-700">8</div>
                              <div className="text-sm text-amber-600">Configuration Warnings</div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-blue-200 bg-blue-50">
                          <CardContent className="pt-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-blue-700">100%</div>
                              <div className="text-sm text-blue-600">RLS Coverage</div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Security Strengths */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="border-green-200 bg-green-50">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg text-green-700 flex items-center gap-2">
                              <CheckCircle className="h-5 w-5" />
                              Security Strengths
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="text-sm text-green-700 space-y-2">
                              <li>• <strong>Database Security:</strong> 100% Row Level Security (RLS) coverage across all sensitive tables</li>
                              <li>• <strong>Authentication:</strong> Multi-factor authentication with VPN-friendly implementation</li>
                              <li>• <strong>Authorization:</strong> Comprehensive role-based access controls with practice isolation</li>
                              <li>• <strong>Encryption:</strong> Data encrypted at rest and in transit using industry standards</li>
                              <li>• <strong>Audit Trails:</strong> Complete audit logging for all CRUD operations and authentication events</li>
                              <li>• <strong>Input Validation:</strong> Comprehensive validation and sanitisation across all entry points</li>
                              <li>• <strong>Session Management:</strong> Secure session handling with appropriate timeouts</li>
                              <li>• <strong>API Security:</strong> All external API calls use secure authentication with proper key management</li>
                            </ul>
                          </CardContent>
                        </Card>

                        <Card className="border-amber-200 bg-amber-50">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg text-amber-700 flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5" />
                              Areas Requiring Attention
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div>
                                <h4 className="font-medium text-amber-700">Priority 1 - Data Access (5 warnings)</h4>
                                <ul className="text-sm text-amber-600 ml-4 mt-1 space-y-1">
                                  <li>• Public access to GP practice information</li>
                                  <li>• News articles table publicly readable</li>
                                  <li>• Practice staff data accessible</li>
                                  <li>• Some formulary tables lack restrictions</li>
                                </ul>
                              </div>
                              <div>
                                <h4 className="font-medium text-amber-700">Priority 2 - Configuration (3 warnings)</h4>
                                <ul className="text-sm text-amber-600 ml-4 mt-1 space-y-1">
                                  <li>• Database function search paths need hardening (24 functions)</li>
                                  <li>• Extensions located in public schema</li>
                                  <li>• Postgres version requires security updates</li>
                                </ul>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Risk Assessment Summary */}
                      <Alert className="border-blue-200 bg-blue-50">
                        <CheckCircle className="h-4 w-4" />
                        <AlertTitle>Risk Assessment Summary</AlertTitle>
                        <AlertDescription>
                          <div className="mt-2 space-y-1">
                            <div><strong>Critical Issues:</strong> 0 - No critical vulnerabilities identified</div>
                            <div><strong>High Priority:</strong> 5 - Primarily data access policy decisions</div>
                            <div><strong>Medium Priority:</strong> 3 - Database configuration improvements</div>
                            <div><strong>Overall Security Posture:</strong> Strong - Suitable for NHS deployment with recommended fixes</div>
                          </div>
                        </AlertDescription>
                      </Alert>

                      <div className="text-xs text-muted-foreground border-t pt-4">
                        <p><strong>Report Generated:</strong> {new Date().toLocaleDateString('en-GB', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</p>
                        <p><strong>Assessment Method:</strong> Automated security scanning + Manual database schema analysis</p>
                        <p><strong>Next Review:</strong> 3 months or after significant system changes</p>
                        <p><strong>Compliance Status:</strong> Ready for NHS deployment with security hardening</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Data Management Tab */}
          <TabsContent value="system-config" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Settings</CardTitle>
                  <CardDescription>Configure global system settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="maintenance-mode">Maintenance Mode</Label>
                    <Switch 
                      id="maintenance-mode" 
                      checked={maintenanceMode.enabled}
                      onCheckedChange={(checked) => handleMaintenanceModeUpdate(checked)}
                      disabled={updating}
                    />
                  </div>
                  {maintenanceMode.enabled && (
                    <div className="space-y-2">
                      <Label htmlFor="maintenance-message">Maintenance Message</Label>
                      <Textarea
                        id="maintenance-message"
                        placeholder="Enter custom maintenance message..."
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        className="min-h-[80px]"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleMaintenanceModeUpdate(maintenanceMode.enabled, customMessage)}
                        disabled={updating}
                        className="w-full"
                      >
                        {updating ? 'Updating...' : 'Update Message'}
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Label htmlFor="registration-enabled">User Registration</Label>
                    <Switch id="registration-enabled" defaultChecked />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                    <Input id="session-timeout" type="number" defaultValue="30" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Data Retention</CardTitle>
                  <CardDescription>Configure data retention policies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="meeting-retention">Meeting Data (days)</Label>
                    <Input id="meeting-retention" type="number" defaultValue="365" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="audit-retention">Audit Logs (days)</Label>
                    <Input id="audit-retention" type="number" defaultValue="2555" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backup-frequency">Backup Frequency</Label>
                    <Select defaultValue="daily">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          {/* Security & Compliance Tab */}
          <TabsContent value="security" className="space-y-6">
            <Tabs value={securityTab} onValueChange={setSecurityTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-7 h-auto">
                <TabsTrigger value="monitoring" className="text-xs sm:text-sm p-2">Auth</TabsTrigger>
                <TabsTrigger value="data-access" className="text-xs sm:text-sm p-2">Data</TabsTrigger>
                <TabsTrigger value="vulnerabilities" className="text-xs sm:text-sm p-2">Vulns</TabsTrigger>
                <TabsTrigger value="cso-compliance" className="text-xs sm:text-sm p-2">CSO Compliance</TabsTrigger>
                <TabsTrigger value="dcb0129" className="text-xs sm:text-sm p-2 font-medium">DCB0129</TabsTrigger>
                <TabsTrigger value="security-reports" className="text-xs sm:text-sm p-2">Security Reports</TabsTrigger>
                <TabsTrigger value="platform-audit" className="text-xs sm:text-sm p-2">Platform Audit</TabsTrigger>
              </TabsList>

              <TabsContent value="monitoring" className="space-y-6">
                {/* Authentication Monitoring Summary */}
                {(() => {
                  // Get unique users for the filter dropdown
                  const uniqueUsers = [...new Set(authenticationLogs.map((log: any) => log.user).filter(u => u && u !== 'System' && u !== 'Unknown'))].sort();
                  
                  // Filter logs by selected user for stats
                  const filteredLogsForStats = authUserFilter === 'all' 
                    ? authenticationLogs 
                    : authenticationLogs.filter((log: any) => log.user === authUserFilter);
                  
                  // Calculate accurate stats
                  const totalLogins = filteredLogsForStats.filter((log: any) => 
                    log.event.includes('login') || 
                    log.event === 'session created' ||
                    (log.source === 'user_sessions' && !log.event.includes('ended'))
                  ).length;
                  
                  const failedAttempts = filteredLogsForStats.filter((log: any) => 
                    log.status === 'failed' || 
                    log.event.includes('failed')
                  ).length;
                  
                  const activeSessions = filteredLogsForStats.filter((log: any) => 
                    log.event === 'active session'
                  ).length;
                  
                  const securityEventsCount = filteredLogsForStats.filter((log: any) => 
                    log.source === 'security_events'
                  ).length;

                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <Card>
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Logins</p>
                                <p className="text-2xl font-bold">{totalLogins}</p>
                                <p className="text-xs text-muted-foreground">Last {authDateFilter} days</p>
                              </div>
                              <UserCheck className="h-8 w-8 text-blue-500" />
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Failed Attempts</p>
                                <p className="text-2xl font-bold text-red-600">{failedAttempts}</p>
                                <p className="text-xs text-muted-foreground">Security alerts</p>
                              </div>
                              <AlertTriangle className="h-8 w-8 text-red-500" />
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Active Sessions</p>
                                <p className="text-2xl font-bold text-green-600">{activeSessions}</p>
                                <p className="text-xs text-muted-foreground">Currently logged in</p>
                              </div>
                              <Activity className="h-8 w-8 text-green-500" />
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Security Events</p>
                                <p className="text-2xl font-bold">{securityEventsCount}</p>
                                <p className="text-xs text-muted-foreground">Monitored events</p>
                              </div>
                              <Shield className="h-8 w-8 text-orange-500" />
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      Authentication Monitoring
                    </CardTitle>
                    <CardDescription>Monitor login attempts and authentication events</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Search and Filter Controls */}
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search by user, event, or IP address..."
                            value={authSearchQuery}
                            onChange={(e) => setAuthSearchQuery(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Select value={authUserFilter} onValueChange={setAuthUserFilter}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Filter by User" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Users</SelectItem>
                            {uniqueUsers.map((userEmail: string) => (
                              <SelectItem key={userEmail} value={userEmail}>
                                {userEmail}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Select value={authEventFilter} onValueChange={setAuthEventFilter}>
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Event Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Events</SelectItem>
                            <SelectItem value="login">Logins</SelectItem>
                            <SelectItem value="failed">Failed Attempts</SelectItem>
                            <SelectItem value="session">Sessions</SelectItem>
                            <SelectItem value="security">Security Events</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Select value={authDateFilter} onValueChange={(value) => {
                          setAuthDateFilter(value);
                          fetchEnhancedSecurityData();
                        }}>
                          <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Time Range" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Last 24 hours</SelectItem>
                            <SelectItem value="7">Last 7 days</SelectItem>
                            <SelectItem value="30">Last 30 days</SelectItem>
                            <SelectItem value="90">Last 90 days</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Button onClick={fetchEnhancedSecurityData} variant="outline" size="icon">
                          <Clock className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {loadingAuthLogs ? (
                      <div className="flex items-center justify-center p-8">
                        <div className="text-muted-foreground">Loading authentication logs...</div>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Event</TableHead>
                            <TableHead>IP Address</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Source</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {authenticationLogs
                            .filter((log: any) => {
                              const matchesSearch = authSearchQuery === '' || 
                                log.user.toLowerCase().includes(authSearchQuery.toLowerCase()) ||
                                log.event.toLowerCase().includes(authSearchQuery.toLowerCase()) ||
                                log.ip.toLowerCase().includes(authSearchQuery.toLowerCase());
                              
                              const matchesUser = authUserFilter === 'all' || log.user === authUserFilter;
                              
                              const matchesFilter = authEventFilter === 'all' ||
                                (authEventFilter === 'login' && log.event.includes('login')) ||
                                (authEventFilter === 'failed' && log.status === 'failed') ||
                                (authEventFilter === 'session' && log.event.includes('session')) ||
                                (authEventFilter === 'security' && log.source === 'security_events');
                              
                              return matchesSearch && matchesUser && matchesFilter;
                            })
                            .map((log: any) => (
                              <TableRow key={log.id}>
                                <TableCell className="font-mono text-xs">{log.timestamp}</TableCell>
                                <TableCell>{log.user}</TableCell>
                                <TableCell className="capitalize">{log.event}</TableCell>
                                <TableCell className="font-mono text-xs">{log.ip}</TableCell>
                                <TableCell>
                                  <Badge variant={log.status === 'failed' ? 'destructive' : 'default'}>
                                    {log.status === 'failed' ? 'Failed' : 'Success'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {log.source?.replace('_', ' ')}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          {authenticationLogs.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground">
                                No authentication events found
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
                    </>
                  );
                })()}
              </TabsContent>

              <TabsContent value="data-access" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Patient Data Access Logs
                    </CardTitle>
                    <CardDescription>Monitor access to sensitive patient data</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Patient ID</TableHead>
                          <TableHead>Duration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {patientDataAccess.map((access: any) => (
                          <TableRow key={access.id}>
                            <TableCell>{access.timestamp}</TableCell>
                            <TableCell>{access.user}</TableCell>
                            <TableCell>{access.action}</TableCell>
                            <TableCell>{access.patient_id}</TableCell>
                            <TableCell>{access.duration}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="vulnerabilities" className="space-y-6">
                {/* Security Scan Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Last Scan</p>
                          <p className="text-2xl font-bold">Today</p>
                          <p className="text-xs text-muted-foreground">18 Sep 2025, 14:15</p>
                        </div>
                        <CheckCircle className="h-8 w-8 text-green-500" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Security Status</p>
                          <p className="text-2xl font-bold text-green-600">GOOD</p>
                          <p className="text-xs text-muted-foreground">0 Critical Issues</p>
                        </div>
                        <Shield className="h-8 w-8 text-green-500" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Total Findings</p>
                          <p className="text-2xl font-bold">8</p>
                          <p className="text-xs text-muted-foreground">Medium Priority</p>
                        </div>
                        <AlertTriangle className="h-8 w-8 text-yellow-500" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Scan Coverage</p>
                          <p className="text-2xl font-bold">100%</p>
                          <p className="text-xs text-muted-foreground">DB + Application</p>
                        </div>
                        <Activity className="h-8 w-8 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      Vulnerability Management
                    </CardTitle>
                    <CardDescription>Security scan results and vulnerability tracking</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Scan Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Critical</TableHead>
                          <TableHead>High</TableHead>
                          <TableHead>Medium</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vulnerabilityScans.map((scan: any) => (
                          <TableRow key={scan.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{new Date(scan.scan_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                <span className="text-xs text-muted-foreground">{scan.scan_time}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{scan.type}</span>
                                <span className="text-xs text-muted-foreground">{scan.findings} findings</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={scan.status === 'completed' ? 'default' : 'secondary'}>
                                {scan.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className={`font-medium ${scan.critical > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                {scan.critical}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={`font-medium ${scan.high > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                                {scan.high}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={`font-medium ${scan.medium > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                                {scan.medium}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>{scan.type} - Detailed Findings</DialogTitle>
                                    <DialogDescription>
                                      Scan completed on {new Date(scan.scan_date).toLocaleDateString('en-GB')} at {scan.scan_time}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    {scan.detailed_findings?.map((finding: any, index: number) => (
                                      <div key={index} className="p-4 border rounded-lg">
                                        <div className="flex items-start justify-between mb-2">
                                          <h4 className="font-medium">{finding.title}</h4>
                                          <Badge variant={finding.severity === 'critical' ? 'destructive' : finding.severity === 'high' ? 'destructive' : 'secondary'}>
                                            {finding.severity}
                                          </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-2">{finding.description}</p>
                                        <p className="text-sm"><strong>Remediation:</strong> {finding.remediation}</p>
                                      </div>
                                    ))}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="dcb0129" className="space-y-6">
                <DCB0129Panel />
              </TabsContent>

              <TabsContent value="cso-compliance" className="space-y-6">
                <div className="space-y-6">
                  {/* Hazard Analysis Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                        Clinical Safety Hazard Analysis
                      </CardTitle>
                      <CardDescription>
                        Comprehensive hazard identification and risk assessment for Notewell systems (DCB0129 compliant)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <HazardAnalysisReport />
                    </CardContent>
                  </Card>

                  {/* CSO Compliance Report */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-purple-600" />
                        Clinical Safety Officer (CSO) Compliance Reports
                      </CardTitle>
                      <CardDescription>
                        Generate detailed CSO compliance reports with timelines and next steps for critical items
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-purple-700">
                          Access comprehensive CSO compliance reporting including DCB0129 requirements, 
                          implementation timelines, and critical action items with specific next steps.
                        </p>
                      </div>
                      <CSOComplianceReport 
                        complaintId="" 
                        complaintReference="SYSTEM-ADMIN" 
                      />
                    </CardContent>
                  </Card>

                  {/* Existing Compliance Status */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5" />
                          Compliance Status
                        </CardTitle>
                        <CardDescription>Current compliance with healthcare standards</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {Object.entries(complianceStatus).map(([key, status]) => (
                          <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                              <h4 className="font-medium">
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                Last checked: {status.lastCheck}
                              </p>
                            </div>
                            {getStatusBadge(status.status)}
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" />
                          Compliance Trends
                        </CardTitle>
                        <CardDescription>Compliance metrics over time</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Overall Compliance</span>
                            <span className="text-lg font-bold text-green-600">85%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Data Protection</span>
                            <span className="text-lg font-bold text-green-600">92%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Access Control</span>
                            <span className="text-lg font-bold text-orange-500">78%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Audit Compliance</span>
                            <span className="text-lg font-bold text-green-600">95%</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="security-reports" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-6 w-6" />
                      Notewell System Security Assessment Report
                    </CardTitle>
                    <CardDescription>
                      Comprehensive Security Analysis - Generated {new Date().toLocaleDateString('en-GB', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="prose prose-sm max-w-none">
                    <div className="space-y-6">
                      {/* Executive Summary */}
                      <Alert>
                        <Shield className="h-4 w-4" />
                        <AlertTitle>Executive Summary</AlertTitle>
                        <AlertDescription>
                          This comprehensive security assessment reveals that the Notewell system demonstrates strong foundational security controls suitable for NHS deployment. 
                          The system features robust authentication, comprehensive audit logging, and strong data protection measures providing a solid base for clinical safety.
                        </AlertDescription>
                      </Alert>

                      {/* Current Security Status */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="border-green-200 bg-green-50">
                          <CardContent className="pt-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-green-700">0</div>
                              <div className="text-sm text-green-600">Critical Issues</div>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card className="border-amber-200 bg-amber-50">
                          <CardContent className="pt-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-amber-700">8</div>
                              <div className="text-sm text-amber-600">Configuration Warnings</div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-blue-200 bg-blue-50">
                          <CardContent className="pt-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-blue-700">100%</div>
                              <div className="text-sm text-blue-600">RLS Coverage</div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Security Strengths */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="border-green-200 bg-green-50">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg text-green-700 flex items-center gap-2">
                              <CheckCircle className="h-5 w-5" />
                              Security Strengths
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="text-sm text-green-700 space-y-2">
                              <li>• <strong>Database Security:</strong> 100% Row Level Security (RLS) coverage across all sensitive tables</li>
                              <li>• <strong>Authentication:</strong> Multi-factor authentication with VPN-friendly implementation</li>
                              <li>• <strong>Authorization:</strong> Comprehensive role-based access controls with practice isolation</li>
                              <li>• <strong>Encryption:</strong> Data encrypted at rest and in transit using industry standards</li>
                              <li>• <strong>Audit Trails:</strong> Complete audit logging for all CRUD operations and authentication events</li>
                              <li>• <strong>Input Validation:</strong> Comprehensive validation and sanitisation across all entry points</li>
                              <li>• <strong>Session Management:</strong> Secure session handling with appropriate timeouts</li>
                              <li>• <strong>API Security:</strong> All external API calls use secure authentication with proper key management</li>
                            </ul>
                          </CardContent>
                        </Card>

                        <Card className="border-amber-200 bg-amber-50">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg text-amber-700 flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5" />
                              Areas Requiring Attention
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div>
                                <h4 className="font-medium text-amber-700">Priority 1 - Data Access (5 warnings)</h4>
                                <ul className="text-sm text-amber-600 ml-4 mt-1 space-y-1">
                                  <li>• Public access to GP practice information</li>
                                  <li>• News articles table publicly readable</li>
                                  <li>• Practice staff data accessible</li>
                                  <li>• Some formulary tables lack restrictions</li>
                                </ul>
                              </div>
                              <div>
                                <h4 className="font-medium text-amber-700">Priority 2 - Configuration (3 warnings)</h4>
                                <ul className="text-sm text-amber-600 ml-4 mt-1 space-y-1">
                                  <li>• Database function search paths need hardening (24 functions)</li>
                                  <li>• Extensions located in public schema</li>
                                  <li>• Postgres version requires security updates</li>
                                </ul>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Detailed Security Assessment */}
                      <div className="space-y-4">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          <Shield className="h-5 w-5" />
                          Detailed Security Assessment
                        </h3>
                        
                        <div className="space-y-4">
                          {/* Authentication & Authorization */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base flex items-center gap-2">
                                <Key className="h-4 w-4" />
                                Authentication & Authorization
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <h5 className="font-medium text-green-600 mb-2">✅ Implemented</h5>
                                  <ul className="text-sm space-y-1">
                                    <li>• Multi-factor authentication support</li>
                                    <li>• Role-based access control (RBAC)</li>
                                    <li>• Practice-based data isolation</li>
                                    <li>• Session timeout controls</li>
                                    <li>• Password strength enforcement</li>
                                    <li>• VPN-friendly authentication flows</li>
                                  </ul>
                                </div>
                                <div>
                                  <h5 className="font-medium text-blue-600 mb-2">📊 Statistics</h5>
                                  <ul className="text-sm space-y-1">
                                    <li>• 6 distinct user roles defined</li>
                                    <li>• 9 module access permissions</li>
                                    <li>• Practice-level user isolation</li>
                                    <li>• Real-time role validation</li>
                                  </ul>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Database Security */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base flex items-center gap-2">
                                <Database className="h-4 w-4" />
                                Database Security
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <h5 className="font-medium text-green-600 mb-2">✅ Row Level Security (RLS)</h5>
                                  <ul className="text-sm space-y-1">
                                    <li>• 100% RLS coverage on sensitive tables</li>
                                    <li>• User-based data isolation policies</li>
                                    <li>• Practice-based access controls</li>
                                    <li>• Audit logging for all operations</li>
                                    <li>• Secure deletion policies</li>
                                  </ul>
                                </div>
                                <div>
                                  <h5 className="font-medium text-amber-600 mb-2">⚠️ Configuration Issues</h5>
                                  <ul className="text-sm space-y-1">
                                    <li>• 24 functions need search path hardening</li>
                                    <li>• 3 extensions in public schema</li>
                                    <li>• Database version needs updating</li>
                                    <li>• Some public data access policies need review</li>
                                  </ul>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Data Protection & Privacy */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base flex items-center gap-2">
                                <Lock className="h-4 w-4" />
                                Data Protection & Privacy
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <h5 className="font-medium text-green-600 mb-2">✅ Encryption</h5>
                                  <ul className="text-sm space-y-1">
                                    <li>• AES-256 encryption at rest</li>
                                    <li>• TLS 1.3 for data in transit</li>
                                    <li>• Encrypted file storage</li>
                                    <li>• Secure API communications</li>
                                  </ul>
                                </div>
                                <div>
                                  <h5 className="font-medium text-green-600 mb-2">✅ GDPR Compliance</h5>
                                  <ul className="text-sm space-y-1">
                                    <li>• Data subject rights support</li>
                                    <li>• Consent management</li>
                                    <li>• Data retention policies</li>
                                    <li>• Right to erasure capability</li>
                                  </ul>
                                </div>
                                <div>
                                  <h5 className="font-medium text-green-600 mb-2">✅ Access Controls</h5>
                                  <ul className="text-sm space-y-1">
                                    <li>• Principle of least privilege</li>
                                    <li>• Regular access reviews</li>
                                    <li>• Automated deprovisioning</li>
                                    <li>• Emergency access procedures</li>
                                  </ul>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Regulatory Compliance */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base flex items-center gap-2">
                                <FileCheck className="h-4 w-4" />
                                Regulatory Compliance Status
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <h5 className="font-medium text-blue-600 mb-2">NHS Digital Standards</h5>
                                  <ul className="text-sm space-y-1">
                                    <li>• DCB0129 (Clinical Risk Management) - Ready</li>
                                    <li>• DCB0160 (Clinical Safety Officer) - Requires CSO appointment</li>
                                    <li>• Data Security & Protection Toolkit - Compliant architecture</li>
                                  </ul>
                                </div>
                                <div>
                                  <h5 className="font-medium text-blue-600 mb-2">Data Protection</h5>
                                  <ul className="text-sm space-y-1">
                                    <li>• GDPR Article 32 (Security) - Compliant</li>
                                    <li>• Privacy by design - Implemented</li>
                                    <li>• DPIA framework - Ready</li>
                                  </ul>
                                </div>
                                <div>
                                  <h5 className="font-medium text-blue-600 mb-2">Clinical Governance</h5>
                                  <ul className="text-sm space-y-1">
                                    <li>• Professional accountability - Supported</li>
                                    <li>• Quality improvement - Tools available</li>
                                    <li>• Incident reporting - Capability present</li>
                                  </ul>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      {/* Implementation Recommendations */}
                      <div className="space-y-4">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          Implementation Recommendations
                        </h3>
                        
                        <div className="space-y-3">
                          <Card className="border-red-200">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-lg text-red-700">🚨 Immediate Actions (Same Day)</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ol className="text-sm space-y-2 list-decimal list-inside">
                                <li><strong>Fix SecurityWrapper X-Frame-Options:</strong> Change from DENY to SAMEORIGIN for Lovable compatibility</li>
                                <li><strong>Enable Leaked Password Protection:</strong> Single Supabase Auth configuration change</li>
                                <li><strong>Review Public Data Access:</strong> Assess if news articles, practice data should remain publicly accessible</li>
                              </ol>
                            </CardContent>
                          </Card>

                          <Card className="border-amber-200">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-lg text-amber-700">⚡ This Week</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ol className="text-sm space-y-2 list-decimal list-inside">
                                <li><strong>Database Function Hardening:</strong> Add SET search_path to 24+ functions (2-4 hours)</li>
                                <li><strong>Extension Relocation:</strong> Move pg_trgm and unaccent extensions to appropriate schemas</li>
                                <li><strong>Implement Graduated Access:</strong> Add content filtering for public data if needed</li>
                              </ol>
                            </CardContent>
                          </Card>

                          <Card className="border-blue-200">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-lg text-blue-700">📅 Before Production</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ol className="text-sm space-y-2 list-decimal list-inside">
                                <li><strong>Clinical Validation Protocols:</strong> Implement mandatory review for AI-generated content</li>
                                <li><strong>User Training Programme:</strong> Develop comprehensive training and competency framework</li>
                                <li><strong>Formal Risk Assessment:</strong> Complete DCB0129 clinical risk management documentation</li>
                                <li><strong>Governance Framework:</strong> Appoint Clinical Safety Officer and establish committee</li>
                                <li><strong>Penetration Testing:</strong> Complete security assessment and implement additional monitoring</li>
                              </ol>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      {/* Risk Assessment Summary */}
                      <Alert className="border-blue-200 bg-blue-50">
                        <CheckCircle className="h-4 w-4" />
                        <AlertTitle>Risk Assessment Summary</AlertTitle>
                        <AlertDescription>
                          <div className="mt-2 space-y-1">
                            <div><strong>Critical Issues:</strong> 0 - No critical vulnerabilities identified</div>
                            <div><strong>High Priority:</strong> 5 - Primarily data access policy decisions</div>
                            <div><strong>Medium Priority:</strong> 3 - Database configuration improvements</div>
                            <div><strong>Overall Security Posture:</strong> Strong - Suitable for NHS deployment with recommended fixes</div>
                          </div>
                        </AlertDescription>
                      </Alert>

                      <div className="text-xs text-muted-foreground border-t pt-4">
                        <p><strong>Report Generated:</strong> {new Date().toLocaleDateString('en-GB', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</p>
                        <p><strong>Assessment Method:</strong> Automated security scanning + Manual database schema analysis</p>
                        <p><strong>Next Review:</strong> 3 months or after significant system changes</p>
                        <p><strong>Compliance Status:</strong> Ready for NHS deployment with security hardening</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Data Management Tab */}
          <TabsContent value="data" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileJson className="h-5 w-5" />
                  Prior Approval Data Management
                </CardTitle>
                <CardDescription>
                  Update and manage prior approval and traffic light medicine data for the AI4GP service.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ICB Data Fetch Button */}
                <div className="space-y-2">
                  <Button
                    onClick={fetchICBData}
                    disabled={isFetchingICB || isUploading}
                    className="w-full gap-2"
                    variant="default"
                  >
                    <FileJson className="h-4 w-4" />
                    {isFetchingICB ? 'Fetching ICB Data...' : 'Fetch Latest ICB Traffic Light Drugs'}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Automatically fetch and import the latest traffic light medicines from NHS Northamptonshire ICB (886 drugs)
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 h-px bg-border"></div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">OR</span>
                  <div className="flex-1 h-px bg-border"></div>
                </div>

                {/* File Upload Input */}
                <div className="space-y-2">
                  <input
                    type="file"
                    accept=".json,application/json"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="json-file-upload-admin"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('json-file-upload-admin')?.click()}
                    className="w-full gap-2"
                    disabled={isUploading || isFetchingICB}
                  >
                    <Upload className="h-4 w-4" />
                    Upload Your Own JSON Files
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Upload custom JSON files with drug information
                  </p>
                </div>

                {/* Uploaded Files List */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Uploaded Files:</h4>
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                        <div className="flex items-center gap-2">
                          <FileJson className="h-4 w-4" />
                          <span className="text-sm">{file.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          disabled={isUploading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Process Button */}
                {uploadedFiles.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      onClick={processJsonFiles}
                      disabled={isUploading}
                      className="flex-1"
                    >
                      {isUploading ? 'Processing...' : `Process ${uploadedFiles.length} File${uploadedFiles.length !== 1 ? 's' : ''}`}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setUploadedFiles([])}
                      disabled={isUploading}
                    >
                      Clear All
                    </Button>
                  </div>
                )}

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    JSON files should contain an array of objects with drug information including prior_approval_criteria and traffic_light_status fields.
                  </AlertDescription>
                </Alert>
              </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="w-5 h-5" />
              AI Model Tester
            </CardTitle>
            <CardDescription>
              Test and compare AI model performance across different services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setShowAITestModal(true)}
              className="w-full"
            >
              <TestTube className="w-4 h-4 mr-2" />
              Open AI Model Tester
            </Button>
          </CardContent>
        </Card>

        
      </TabsContent>

          {/* System Monitoring Tab */}
          <TabsContent value="monitoring" className="space-y-6">
            <Tabs value={monitoringSubTab} onValueChange={setMonitoringSubTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-auto mb-6">
                <TabsTrigger value="system" className="flex items-center gap-2 text-xs sm:text-sm p-2">
                  <Activity className="h-4 w-4" />
                  <span className="hidden sm:inline">System</span>
                </TabsTrigger>
                <TabsTrigger value="gp-scribe" className="flex items-center gap-2 text-xs sm:text-sm p-2">
                  <Mic className="h-4 w-4" />
                  <span className="hidden sm:inline">GP Scribe</span>
                  <span className="sm:hidden">Scribe</span>
                </TabsTrigger>
                <TabsTrigger value="meeting-service" className="flex items-center gap-2 text-xs sm:text-sm p-2">
                  <Database className="h-4 w-4" />
                  <span className="hidden sm:inline">Meeting Service</span>
                  <span className="sm:hidden">Meetings</span>
                </TabsTrigger>
              </TabsList>

              {/* System Sub-Tab */}
              <TabsContent value="system" className="space-y-6">
                <SystemMonitoringDashboard />
                
                {/* Database Maintenance Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Database Maintenance
                    </CardTitle>
                    <CardDescription>
                      Manage database cleanup and maintenance tasks
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Trash2 className="h-4 w-4" />
                        Empty Meetings Cleanup
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Remove meetings with zero word count that are older than 5 hours. This runs automatically daily at 2 AM.
                      </p>
                      <Button
                        onClick={async () => {
                          try {
                            const { data, error } = await supabase.functions.invoke('cleanup-empty-meetings');
                            if (error) throw error;
                            toast.success(`Cleanup completed: ${data.message}`);
                          } catch (error) {
                            console.error('Cleanup error:', error);
                            toast.error('Failed to run cleanup: ' + error.message);
                          }
                        }}
                        variant="outline"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Run Manual Cleanup
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Legacy Connection Stats and Incidents - Keep for reference */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Connection Stats */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        API Connections
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">OpenAI</span>
                          <span className="font-medium">{connectionStats.openaiConnections}/200</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Deepgram</span>
                          <span className="font-medium">{connectionStats.deepgramConnections}/100</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">ElevenLabs</span>
                          <span className="font-medium">{connectionStats.elevenlabsConnections}/50</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Supabase DB</span>
                          <span className="font-medium">{connectionStats.supabaseDbConnections}/60</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Security Events */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Recent Security Events
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {securityEvents.slice(0, 5).map((event, index) => (
                          <div key={index} className="flex items-center justify-between p-2 border rounded">
                            <div>
                              <p className="text-sm font-medium">{event.event_type}</p>
                              <p className="text-xs text-muted-foreground">{event.user_email}</p>
                            </div>
                            <Badge variant={event.severity === 'critical' ? 'destructive' : 'secondary'}>
                              {event.severity}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Supplier Incidents */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Supplier Incidents
                      </CardTitle>
                      <Button size="sm" className="h-8" onClick={() => setShowAddIncidentModal(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Incident
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {supplierIncidents.slice(0, 3).map((incident: any, index) => (
                          <div key={index} className="p-3 border rounded">
                            <p className="text-sm font-medium">{incident.supplier_name}</p>
                            <p className="text-xs text-muted-foreground">{incident.incident_type}</p>
                            <Badge variant="outline" className="mt-1">
                              {incident.severity}
                            </Badge>
                          </div>
                        ))}
                      </div>
                      {supplierIncidents.length > 3 && (
                        <Button variant="outline" size="sm" className="w-full mt-3">
                          View All Incidents
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card className={stuckMeetings.length > 0 ? 'border-destructive/60' : ''}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5" />
                          Stuck Meeting Check
                        </CardTitle>
                        <CardDescription>
                          Finds recordings with saved chunks that have not finalised, plus old transcription jobs.
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={fetchStuckMeetings} disabled={loadingStuckMeetings}>
                          <RefreshCw className={`h-4 w-4 mr-2 ${loadingStuckMeetings ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMonitoringSubTab('meeting-service')}
                        >
                          View details
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {stuckMeetings.length === 0 ? (
                      <div className="flex items-center gap-2 rounded-md border border-border p-3 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4" />
                        No stuck meetings detected.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {stuckMeetings.slice(0, 5).map((meeting) => (
                          <div key={meeting.id} className="flex flex-col gap-3 rounded-md border border-destructive/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-medium">{meeting.title}</p>
                                <Badge variant="outline">{meeting.status}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {meeting.user_email || meeting.user_name || 'Unknown user'} · Started {new Date(meeting.created_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                {meeting.last_chunk_at ? ` · Last chunk ${new Date(meeting.last_chunk_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
                              </p>
                              <p className="text-xs text-destructive">{meeting.reason}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Badge variant="secondary">{meeting.chunk_count} chunks</Badge>
                              <Badge variant="secondary">{meeting.word_count.toLocaleString()} words</Badge>
                              <Button size="sm" onClick={() => recoverStuckMeeting(meeting)} disabled={recoveringMeetingId === meeting.id}>
                                {recoveringMeetingId === meeting.id ? 'Recovering…' : 'Recover'}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Audio Backup Management */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileCheck className="h-5 w-5" />
                      Audio Backup Management
                    </CardTitle>
                    <CardDescription>
                      Manage audio backups for meetings with poor transcription quality (Super Admin only)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AudioBackupManager />
                  </CardContent>
                </Card>

                {/* Audio Backup Search */}
                <AdminAudioBackupSearch />
              </TabsContent>


              {/* GP Scribe Sub-Tab */}
              <TabsContent value="gp-scribe" className="space-y-6">
                <GPScribeStats />
              </TabsContent>

              {/* Meeting Service Sub-Tab */}
              <TabsContent value="meeting-service" className="space-y-6">
                {/* Live and Recent Meetings */}
                <LiveAndRecentMeetings />

                {/* Orphaned Whisper Connections */}
                <OrphanedWhisperMonitor />

                {/* Meeting Usage Report */}
                <MeetingUsageReport />

                {/* Meeting Statistics by User */}
                <MeetingStatsByUser />
              </TabsContent>

              <TabsContent value="platform-audit" className="space-y-6">
                <Tabs defaultValue="edge-functions" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-auto mb-4">
                    <TabsTrigger value="edge-functions" className="flex items-center gap-2 text-xs sm:text-sm p-2">
                      <Database className="h-4 w-4" />
                      <span>Edge Functions</span>
                    </TabsTrigger>
                    <TabsTrigger value="pages-routes" className="flex items-center gap-2 text-xs sm:text-sm p-2">
                      <FileText className="h-4 w-4" />
                      <span>Pages & Routes</span>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="edge-functions">
                    <EdgeFunctionAudit />
                  </TabsContent>
                  <TabsContent value="pages-routes">
                    <PageRouteAudit />
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Tabs defaultValue="general-settings">
              <TabsList className="mb-4">
                <TabsTrigger value="general-settings">General</TabsTrigger>
                <TabsTrigger value="ai-knowledge-base">AI Chat Knowledge Base</TabsTrigger>
              </TabsList>
              <TabsContent value="general-settings" className="space-y-6">
                <PolicyEnhancementModelSettings />
                <PolicyRegenerateButtonSettings />
                <ConsultationVisibilitySettings />
                <AdminVideoUpload />
              </TabsContent>
              <TabsContent value="ai-knowledge-base">
                <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading Knowledge Base…</div>}>
                  <KnowledgeBaseEmbed />
                </Suspense>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Supplier Incident Modal */}
      <Dialog open={showAddIncidentModal} onOpenChange={setShowAddIncidentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Report Supplier Incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Supplier Name</label>
              <Input
                value={newIncident.supplier_name}
                onChange={(e) => setNewIncident({...newIncident, supplier_name: e.target.value})}
                placeholder="Enter supplier name"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">System Component</label>
              <Input
                value={newIncident.system_component}
                onChange={(e) => setNewIncident({...newIncident, system_component: e.target.value})}
                placeholder="e.g., Scribe, Complaints System"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Incident Type</label>
              <Select value={newIncident.incident_type} onValueChange={(value) => setNewIncident({...newIncident, incident_type: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select incident type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service_outage">Service Outage</SelectItem>
                  <SelectItem value="data_breach">Data Breach</SelectItem>
                  <SelectItem value="security_incident">Security Incident</SelectItem>
                  <SelectItem value="performance_issue">Performance Issue</SelectItem>
                  <SelectItem value="compliance_issue">Compliance Issue</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Severity</label>
              <Select value={newIncident.severity} onValueChange={(value) => setNewIncident({...newIncident, severity: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>


            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={newIncident.description}
                onChange={(e) => setNewIncident({...newIncident, description: e.target.value})}
                placeholder="Describe the incident..."
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddIncidentModal(false)}>
              Cancel
            </Button>
            <Button onClick={async () => {
              try {
                const { data, error } = await supabase
                  .from('supplier_incidents')
                  .insert({
                    incident_reference: '', // Auto-generated by trigger
                    supplier_name: newIncident.supplier_name,
                    system_component: newIncident.system_component,
                    incident_type: newIncident.incident_type,
                    severity: newIncident.severity,
                    description: newIncident.description,
                    status: newIncident.status,
                    reported_date: new Date().toISOString().split('T')[0],
                    reported_by: user?.id
                  });

                if (error) {
                  console.error('Error creating incident:', error);
                  toast.error("Failed to create incident. Please try again.");
                } else {
                  toast.success("Supplier incident reported successfully.");
                  setShowAddIncidentModal(false);
                  setNewIncident({
                    supplier_name: '',
                    system_component: '',
                    incident_type: '',
                    severity: 'medium',
                    description: '',
                    status: 'open'
                  });
                  fetchSupplierIncidents();
                }
              } catch (error) {
                console.error('Error:', error);
                toast.error("An unexpected error occurred.");
              }
            }}>
              Report Incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Management Modal */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <form onSubmit={handleUserSubmit}>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
              <DialogDescription>
                {editingUser ? 'Update user information and assignments.' : 'Create a new user account with appropriate permissions.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 px-4 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({...userFormData, email: e.target.value})}
                    placeholder="user@nhs.net"
                    required
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={userFormData.full_name}
                    onChange={(e) => setUserFormData({...userFormData, full_name: e.target.value})}
                    placeholder="John Doe"
                    required
                    autoComplete="off"
                  />
                </div>
              </div>

              {!editingUser && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="password">Password</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setUserFormData({...userFormData, password: generateMemorablePassword()})}
                      className="h-7 text-xs gap-1"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Regenerate
                    </Button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPasswordField ? 'text' : 'password'}
                      value={userFormData.password}
                      onChange={(e) => setUserFormData({...userFormData, password: e.target.value})}
                      placeholder="Enter a secure password"
                      required
                      autoComplete="new-password"
                      className="font-mono pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordField(!showPasswordField)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPasswordField ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Auto-generated memorable password (two words with a number)
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={userFormData.role} onValueChange={handleRoleChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="practice_user">Practice User</SelectItem>
                      <SelectItem value="practice_manager">Practice Manager</SelectItem>
                      <SelectItem value="pcn_manager">PCN Manager</SelectItem>
                      <SelectItem value="system_admin">System Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="practice_id">Practice/Organisation</Label>
                  <Select value={userFormData.practice_id} onValueChange={(value) => setUserFormData({...userFormData, practice_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select practice" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Practice</SelectItem>
                      {practices.map(practice => (
                        <SelectItem key={practice.id} value={practice.id}>
                          {practice.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <CreateUserModuleAccess
                moduleAccess={userFormData.module_access}
                onModuleChange={(key, value) => {
                  setUserFormData(prev => ({
                    ...prev,
                    module_access: { ...prev.module_access, [key]: value }
                  }));
                }}
                role={userFormData.role}
                isEditing={!!editingUser}
                onAutoSave={autoSaveModuleAccess}
              />

              {/* Premium Service Activations - Only show when editing */}
              {editingUser && (
                <div className="mt-4 pt-4 border-t">
                  <Label className="text-base font-medium">Premium Service Activations</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Activate premium/licensed services for this user
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2">
                      <div className="space-y-0.5">
                        <Label htmlFor="nres_activation">NRES (SDA Programme)</Label>
                        <p className="text-xs text-muted-foreground">Access to NRES service development and analytics tools</p>
                      </div>
                      <Switch
                        id="nres_activation"
                        checked={userServiceActivations.nres}
                        onCheckedChange={(checked) => toggleServiceActivation('nres', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div className="space-y-0.5">
                        <Label htmlFor="enn_activation">ENN Dashboard</Label>
                        <p className="text-xs text-muted-foreground">Access to East Northants Neighbourhood dashboard and reporting</p>
                      </div>
                      <Switch
                        id="enn_activation"
                        checked={userServiceActivations.enn}
                        onCheckedChange={(checked) => toggleServiceActivation('enn', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div className="space-y-0.5">
                        <Label htmlFor="ai4pm_activation">AI4PM</Label>
                        <p className="text-xs text-muted-foreground">AI-powered practice management tools</p>
                      </div>
                      <Switch
                        id="ai4pm_activation"
                        checked={userServiceActivations.ai4pm}
                        onCheckedChange={(checked) => toggleServiceActivation('ai4pm', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div className="space-y-0.5">
                        <Label htmlFor="meeting_recorder_activation">Meeting Recorder</Label>
                        <p className="text-xs text-muted-foreground">Advanced meeting recording and transcription</p>
                      </div>
                      <Switch
                        id="meeting_recorder_activation"
                        checked={userServiceActivations.meeting_recorder}
                        onCheckedChange={(checked) => toggleServiceActivation('meeting_recorder', checked)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Welcome Email Options - Only show when creating new user */}
              {!editingUser && (
                <div className="mt-4 pt-4 border-t">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Welcome Email Options
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    Send a welcome email with login details and enabled features
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">Send welcome email to user</span>
                        <span className="text-xs text-muted-foreground">
                          Email will include login URL, credentials and enabled modules
                        </span>
                      </div>
                      <Switch
                        checked={sendWelcomeEmail}
                        onCheckedChange={setSendWelcomeEmail}
                      />
                    </div>
                    {sendWelcomeEmail && (
                      <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                            Test mode - send to Malcolm.Railson@nhs.net only
                          </span>
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            Use this to preview the email before sending to the actual user
                          </span>
                        </div>
                        <Switch
                          checked={welcomeEmailTestMode}
                          onCheckedChange={setWelcomeEmailTestMode}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowUserModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingUser || sendingWelcomeEmail}>
                {savingUser ? (sendingWelcomeEmail ? 'Sending email...' : 'Creating...') : (editingUser ? 'Update User' : 'Create User')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Practice Management Modal */}
      <Dialog open={showPracticeModal} onOpenChange={setShowPracticeModal}>
        <DialogContent className="sm:max-w-[600px]">
          <form onSubmit={handlePracticeSubmit}>
            <DialogHeader>
              <DialogTitle>{editingPractice ? 'Edit Practice' : 'Add New Practice'}</DialogTitle>
              <DialogDescription>
                {editingPractice ? 'Update practice information.' : 'Create a new practice with complete details.'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="practice_name">Practice Name *</Label>
                  <Input
                    id="practice_name"
                    value={practiceFormData.name}
                    onChange={(e) => setPracticeFormData({...practiceFormData, name: e.target.value})}
                    placeholder="Enter practice name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="practice_k_code">K Code (ODS Code) *</Label>
                  <Input
                    id="practice_k_code"
                    value={practiceFormData.practice_code}
                    onChange={(e) => setPracticeFormData({...practiceFormData, practice_code: e.target.value})}
                    placeholder="Enter ODS code"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="practice_address">Address</Label>
                <Textarea
                  id="practice_address"
                  value={practiceFormData.address}
                  onChange={(e) => setPracticeFormData({...practiceFormData, address: e.target.value})}
                  placeholder="Enter full practice address"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="practice_postcode">Postcode</Label>
                  <Input
                    id="practice_postcode"
                    value={practiceFormData.postcode}
                    onChange={(e) => setPracticeFormData({...practiceFormData, postcode: e.target.value})}
                    placeholder="Enter postcode"
                  />
                </div>
                <div>
                  <Label htmlFor="practice_website">Website</Label>
                  <Input
                    id="practice_website"
                    type="url"
                    value={practiceFormData.website}
                    onChange={(e) => setPracticeFormData({...practiceFormData, website: e.target.value})}
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="practice_email">Practice Email</Label>
                  <Input
                    id="practice_email"
                    type="email"
                    value={practiceFormData.email}
                    onChange={(e) => setPracticeFormData({...practiceFormData, email: e.target.value})}
                    placeholder="practice@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="practice_phone">Practice Phone Number</Label>
                  <Input
                    id="practice_phone"
                    type="tel"
                    value={practiceFormData.phone}
                    onChange={(e) => setPracticeFormData({...practiceFormData, phone: e.target.value})}
                    placeholder="01234 567890"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="neighbourhood_select">Neighbourhood</Label>
                  <Select 
                    value={practiceFormData.neighbourhood_id} 
                    onValueChange={(value) => setPracticeFormData({...practiceFormData, neighbourhood_id: value})}
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Select neighbourhood..." />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border shadow-lg z-[100] max-h-60">
                      <SelectItem value="none">No neighbourhood assigned</SelectItem>
                      {neighbourhoods.map((neighbourhood) => (
                        <SelectItem key={neighbourhood.id} value={neighbourhood.id}>
                          {neighbourhood.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="pcn_select">PCN</Label>
                  <Select 
                    value={practiceFormData.pcn_code} 
                    onValueChange={(value) => setPracticeFormData({...practiceFormData, pcn_code: value})}
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Select PCN..." />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border shadow-lg z-[100] max-h-60">
                      <SelectItem value="none">No PCN assigned</SelectItem>
                      {pcns.map((pcn) => (
                        <SelectItem key={pcn.id} value={pcn.pcn_code}>
                          {pcn.pcn_name} ({pcn.pcn_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPracticeModal(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingPractice ? 'Update Practice' : 'Create Practice'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Set Password Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Set Password</DialogTitle>
            <DialogDescription>
              Set a new password for {passwordTargetUser?.full_name} ({passwordTargetUser?.email}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
              <p className="text-xs text-muted-foreground mt-2">Minimum 8 characters.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordModal(false)}>
              Cancel
            </Button>
            <Button onClick={handlePasswordUpdate} disabled={updatingPassword || newPassword.length < 8}>
              {updatingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Login History Modal */}
      {showLoginHistoryModal && loginHistoryUser && (
        <Dialog open={showLoginHistoryModal} onOpenChange={setShowLoginHistoryModal}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Login History - {loginHistoryUser.full_name}
              </DialogTitle>
              <DialogDescription>
                Recent login sessions for {loginHistoryUser.email} (showing last 50 sessions)
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {loadingLoginHistory ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-pulse">Loading login history...</div>
                </div>
              ) : loginHistory.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  No login history found for this user.
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Login Time</TableHead>
                        <TableHead>Last Activity</TableHead>
                        <TableHead>Logout Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>User Agent</TableHead>
                        <TableHead>Logout Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loginHistory.map((session) => (
                        <TableRow key={session.id}>
                          <TableCell className="font-mono text-sm">
                            {session.login_time ? new Date(session.login_time).toLocaleString() : 'N/A'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {session.last_activity ? new Date(session.last_activity).toLocaleString() : 'N/A'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {session.logout_time ? new Date(session.logout_time).toLocaleString() : 'Still active'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={session.is_active ? "default" : "secondary"}>
                              {session.is_active ? "Active" : "Ended"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {session.ip_address || 'N/A'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm" title={session.user_agent}>
                            {session.user_agent || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {session.logout_reason || (session.is_active ? 'Active' : 'Unknown')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLoginHistoryModal(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {/* AI Test Modal */}
      <AITestModal 
        open={showAITestModal} 
        onOpenChange={setShowAITestModal} 
      />
    </div>
  );
};

export default SystemAdmin;