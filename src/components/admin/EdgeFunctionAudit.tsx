import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { Search, Activity, Archive, CheckCircle, AlertTriangle, XCircle, Loader2, Filter, Download } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Document, Packer, Paragraph, TextRun, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, WidthType, HeadingLevel, BorderStyle, AlignmentType, ShadingType } from 'docx';
import { saveAs } from 'file-saver';

interface EdgeFunction {
  name: string;
  purpose: string;
  referencedInClient: boolean;
  referencedInOtherFunctions: boolean;
  hasConfigEntry: boolean;
  calledFrom: string;
  status: 'active' | 'archived';
  lastLogDates?: string[];
  logStatus?: 'idle' | 'loading' | 'loaded' | 'error';
}

// Pre-computed registry of all active edge functions with calling page/component
const ACTIVE_FUNCTIONS: Omit<EdgeFunction, 'status' | 'lastLogDates' | 'logStatus'>[] = [
  { name: 'admin-clear-old-chats', purpose: 'Clears old AI chat sessions for admin cleanup', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'admin-login-as-user', purpose: 'Allows admins to impersonate user sessions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'advanced-image-generation', purpose: 'Generates AI images with advanced options', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'ai-4-pm-chat', purpose: 'AI chat assistant for practice managers', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4pm (AI4PM)' },
  { name: 'ai-api-test', purpose: 'Tests AI API connectivity and responses', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'ai-consultation-assistant', purpose: 'AI assistant for GP consultations', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'ai-context-restorer', purpose: 'Restores AI conversation context from history', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'ai-investigation-assistant', purpose: 'AI assistant for complaint investigations', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'ai-line-transform', purpose: 'Transforms text lines using AI formatting', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'ai-medical-translation-review', purpose: 'Reviews medical translations for accuracy', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-translation (GPTranslation)' },
  { name: 'ai-response-clinical-verification', purpose: 'Verifies AI responses against clinical standards', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'ai4gp-image-generation', purpose: 'Generates images for AI4GP service', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'amazon-transcribe-chunk', purpose: 'Transcribes audio chunks via Amazon Transcribe', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'amazon-transcribe', purpose: 'Full audio transcription via Amazon Transcribe', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'analyse-consultation-so-far', purpose: 'Analyses ongoing consultation transcript', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'analyse-evidence-file', purpose: 'Analyses uploaded evidence files for complaints', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'analyse-policy-gaps', purpose: 'Identifies gaps in practice policies', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/policy-service (PolicyService)' },
  { name: 'analyse-referral-suggestions', purpose: 'AI analysis of referral letter suggestions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'analyze-complaint-outcome', purpose: 'Analyses complaint outcomes for patterns', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'api-testing-service', purpose: 'Service endpoint for API testing tools', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'assemblyai-realtime-token', purpose: 'Generates real-time transcription tokens for AssemblyAI', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'assemblyai-realtime', purpose: 'Handles real-time AssemblyAI transcription streams', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'assemblyai-transcription-url', purpose: 'Generates AssemblyAI transcription URLs', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'assemblyai-transcription', purpose: 'Transcribes audio via AssemblyAI', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'assign-policy-to-practices', purpose: 'Assigns policy templates to GP practices', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/policy-service (PolicyService)' },
  { name: 'audio-transcription', purpose: 'General audio transcription routing service', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'auto-cleanup-empty-meetings', purpose: 'Automatically cleans up empty meeting records', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: 'Cron / Background' },
  { name: 'auto-close-inactive-meetings', purpose: 'Closes meetings inactive for extended periods', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'auto-generate-meeting-notes', purpose: 'Auto-generates notes when meetings end', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'background-transcript-cleaner', purpose: 'Background job to clean transcript text', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'batch-consolidate-meetings', purpose: 'Batch consolidates multiple meeting transcripts', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin/consolidate (ConsolidateMeetings)' },
  { name: 'batch-translate-documents', purpose: 'Batch translates multiple documents', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-translation (GPTranslation)' },
  { name: 'bnf-comprehensive-lookup', purpose: 'Comprehensive BNF drug information lookup', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-genie (GPGenie)' },
  { name: 'bnf-updates-fetcher', purpose: 'Fetches latest BNF formulary updates', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-genie (GPGenie)' },
  { name: 'bulk-create-nres-users', purpose: 'Bulk creates NRES user accounts', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/nres (NRES Admin)' },
  { name: 'challenge-verify-service', purpose: 'Challenge-response verification for security', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/compliance/security (SecurityDashboard)' },
  { name: 'check-login-rate-limit', purpose: 'Checks and enforces login rate limiting', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: 'Login (AuthContext)' },
  { name: 'clean-transcript-chunk', purpose: 'Cleans individual transcript chunks', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'clean-transcript', purpose: 'Cleans full meeting transcripts', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'cleanup-empty-meetings', purpose: 'Removes empty/abandoned meeting records', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'clear-translation-sessions', purpose: 'Clears expired translation sessions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-translation (GPTranslation)' },
  { name: 'clinical-verification-batch-test', purpose: 'Batch tests clinical verification accuracy', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'clinical-verification', purpose: 'Verifies clinical content accuracy', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'complaint-review-agent', purpose: 'AI agent for complaint review conversations', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'comprehensive-drug-lookup', purpose: 'Comprehensive drug interaction and info lookup', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-genie (GPGenie)' },
  { name: 'consolidate-dual-transcripts', purpose: 'Merges dual-source transcripts into one', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'consolidate-meeting-chunks', purpose: 'Consolidates meeting transcript chunks', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'consolidate-single-meeting-transcript', purpose: 'Consolidates a single meeting transcript', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin/consolidate (ConsolidateMeetings)' },
  { name: 'consultation-qa-chat', purpose: 'Q&A chat for GP consultation review', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/consultation-summary (ConsultationSummary)' },
  { name: 'cqc-ai-assistant', purpose: 'AI assistant for CQC compliance queries', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/cqc-compliance (CQCCompliance)' },
  { name: 'create-user-admin', purpose: 'Admin endpoint to create new users', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'create-user-practice-manager', purpose: 'Practice manager endpoint to create users', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/practice-admin (PracticeAdmin)' },
  { name: 'deepgram-direct', purpose: 'Direct Deepgram transcription endpoint', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'deepgram-realtime', purpose: 'Real-time Deepgram streaming transcription', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'deepgram-streaming', purpose: 'Deepgram streaming audio connection', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'deepgram-token', purpose: 'Generates Deepgram API access tokens', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'deepgram-transcribe', purpose: 'Deepgram batch audio transcription', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'deepgram-tts', purpose: 'Deepgram text-to-speech synthesis', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/notebook-studio (NotebookStudio)' },
  { name: 'delete-all-audio-backups', purpose: 'Deletes all stored audio backup files', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'delete-old-audio-backups', purpose: 'Removes audio backups older than retention', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'delete-translation-session', purpose: 'Deletes a specific translation session', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-translation (GPTranslation)' },
  { name: 'delete-user-admin', purpose: 'Admin endpoint to delete user accounts', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'document-qa-chat', purpose: 'Q&A chat over uploaded documents', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/shared-drive (SharedDrive)' },
  { name: 'elevenlabs-agent-url', purpose: 'Generates ElevenLabs agent connection URLs', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'elevenlabs-conversation-verification', purpose: 'Verifies ElevenLabs conversation sessions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'elevenlabs-text-to-speech', purpose: 'Text-to-speech via ElevenLabs API', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/notebook-studio (NotebookStudio)' },
  { name: 'elevenlabs-tts', purpose: 'ElevenLabs TTS shorthand endpoint', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/notebook-studio (NotebookStudio)' },
  { name: 'email-translation-quality', purpose: 'Emails translation quality reports', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-translation (GPTranslation)' },
  { name: 'enhance-meeting-minutes', purpose: 'AI enhancement of meeting minutes', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/meeting-summary (MeetingSummary)' },
  { name: 'enhance-policy', purpose: 'AI enhancement of practice policies', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/policy-service (PolicyService)' },
  { name: 'explain-unresolved-section', purpose: 'Explains unresolved transcript sections', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'export-docx', purpose: 'Exports content as DOCX documents', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: 'Multiple pages (export utility)' },
  { name: 'extract-document-text', purpose: 'Extracts text from uploaded documents', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/shared-drive (SharedDrive)' },
  { name: 'extract-patient-context', purpose: 'Extracts patient context from text', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'extract-patient-details-complaint', purpose: 'Extracts patient details from complaint text', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'extract-policy-text', purpose: 'Extracts text from policy documents', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/policy-service (PolicyService)' },
  { name: 'fetch-gamma-themes', purpose: 'Fetches Gamma presentation themes', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'fetch-gp-news', purpose: 'Fetches latest GP practice news', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ (Home)' },
  { name: 'fetch-icb-traffic-light-drugs', purpose: 'Fetches ICB traffic-light drug formulary', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-genie (GPGenie)' },
  { name: 'force-complete-meeting', purpose: 'Force-completes a stuck meeting', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'force-stop-meeting', purpose: 'Force-stops an active meeting', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'format-admin-dictation', purpose: 'Formats admin dictation text', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/practice-admin (PracticeAdmin)' },
  { name: 'format-dictation', purpose: 'Formats dictated text for readability', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'format-transcript-paragraphs', purpose: 'Formats transcript into paragraphs', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'generate-ageing-well-cga', purpose: 'Generates Comprehensive Geriatric Assessment', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'generate-audio-overview', purpose: 'Generates audio overview scripts', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/notebook-studio (NotebookStudio)' },
  { name: 'generate-audio-review', purpose: 'Generates AI audio evidence review', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'generate-complaint-acknowledgement', purpose: 'Generates complaint acknowledgement letters', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'generate-complaint-ai-report', purpose: 'Generates AI reports for complaints', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'generate-complaint-audio-overview', purpose: 'Generates audio overviews for complaints', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'generate-complaint-outcome-letter', purpose: 'Generates complaint outcome letters', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'generate-consolidated-meeting-notes', purpose: 'Generates consolidated meeting notes', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'generate-consultation-notes', purpose: 'Generates GP consultation SOAP notes', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'generate-conversation-summary', purpose: 'Summarises AI conversation sessions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4pm (AI4PM)' },
  { name: 'generate-cqc-compliance-report', purpose: 'Generates CQC compliance reports', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/cqc-compliance (CQCCompliance)' },
  { name: 'generate-cso-certificate', purpose: 'Generates CSO training certificates', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/cso-report (CSOReport)' },
  { name: 'generate-demo-response', purpose: 'Generates demo complaint responses', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/demos (Demos)' },
  { name: 'generate-document-audio-overview', purpose: 'Generates audio overviews from documents', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/notebook-studio (NotebookStudio)' },
  { name: 'generate-example-complaint', purpose: 'Generates example complaints for demos', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'generate-gp-consultation-notes', purpose: 'Generates GP-specific consultation notes', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'generate-magic-link', purpose: 'Generates magic login links', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'generate-meeting-audio-script', purpose: 'Generates audio scripts from meetings', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/notebook-studio (NotebookStudio)' },
  { name: 'generate-meeting-notes-claude', purpose: 'Generates meeting notes using Claude AI', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'generate-meeting-notes-compare', purpose: 'Compares meeting notes across AI models', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'generate-meeting-notes-six-styles', purpose: 'Generates notes in 6 different styles', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'generate-meeting-notes-ten-styles', purpose: 'Generates notes in 10 different styles', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'generate-meeting-overview', purpose: 'Generates meeting overview summaries', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/meeting-summary (MeetingSummary)' },
  { name: 'generate-meeting-title', purpose: 'Auto-generates meeting titles from transcript', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'generate-multi-type-notes', purpose: 'Generates multiple note types at once', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'generate-notes-styles', purpose: 'Generates notes in various formatting styles', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'generate-password-reset', purpose: 'Generates password reset tokens', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'generate-patient-email', purpose: 'Generates patient communication emails', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/enhanced-access (EnhancedAccess)' },
  { name: 'generate-policy', purpose: 'AI-generates practice policy documents', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/policy-service (PolicyService)' },
  { name: 'generate-powerpoint-gamma', purpose: 'Generates PowerPoint via Gamma API', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'generate-powerpoint', purpose: 'Generates PowerPoint presentations', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'generate-pptx-with-audio', purpose: 'Generates PPTX with embedded audio narration', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/notebook-studio (NotebookStudio)' },
  { name: 'generate-presentation-scripts', purpose: 'Generates scripts for presentations', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/notebook-studio (NotebookStudio)' },
  { name: 'generate-referral-draft', purpose: 'Generates referral letter drafts', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'generate-referral-letter', purpose: 'Generates full referral letters', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'generate-reply', purpose: 'Generates AI replies for communications', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/enhanced-access (EnhancedAccess)' },
  { name: 'generate-scribe-notes', purpose: 'Generates GP Scribe clinical notes', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'generate-slide-images', purpose: 'Generates images for presentation slides', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/notebook-studio (NotebookStudio)' },
  { name: 'generate-slide-narration', purpose: 'Generates narration for presentation slides', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/notebook-studio (NotebookStudio)' },
  { name: 'generate-staff-demo-notes', purpose: 'Generates demo notes for staff training', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/demos (Demos)' },
  { name: 'generate-standard-minutes-variations', purpose: 'Generates standard meeting minute variants', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'get-client-info', purpose: 'Returns client connection information', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/network-diagnostics (NetworkDiagnostics)' },
  { name: 'google-speech-streaming', purpose: 'Google Cloud Speech streaming transcription', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'gp-consultation-guidance', purpose: 'Provides GP consultation clinical guidance', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'gp-translation-tts', purpose: 'Text-to-speech for GP translations', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-translation (GPTranslation)' },
  { name: 'gpt-clean-transcript', purpose: 'Cleans transcripts using GPT models', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'gpt5-fast-clinical', purpose: 'Fast clinical processing via GPT-5', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'graceful-end-meeting', purpose: 'Gracefully ends a meeting with cleanup', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'image-ocr-translate', purpose: 'OCR and translation of image text', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-translation (GPTranslation)' },
  { name: 'import-complaint-data', purpose: 'Imports complaint data from external sources', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'import-complete-traffic-light-medicines', purpose: 'Imports complete traffic light medicine list', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'import-icb-formulary-seed', purpose: 'Seeds initial ICB formulary data', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: 'One-off seed script' },
  { name: 'import-icn-formulary', purpose: 'Imports ICN formulary data', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'import-prior-approval-data', purpose: 'Imports prior approval drug data', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'improve-text-layout', purpose: 'AI improvement of text layout and formatting', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-translation (GPTranslation)' },
  { name: 'improve-translation-layout', purpose: 'Improves translation text layout', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-translation (GPTranslation)' },
  { name: 'ingest-transcript-chunk', purpose: 'Ingests individual transcript chunks', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'json-to-pptx', purpose: 'Converts JSON data to PowerPoint files', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'lg-ask-ai', purpose: 'AI Q&A for Lloyd George record queries', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/lg-capture (LGCapture)' },
  { name: 'lg-batch-report', purpose: 'Batch report generation for LG records', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/lg-capture (LGCapture)' },
  { name: 'lg-bulk-download', purpose: 'Bulk download of LG record files', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/lg-capture (LGCapture)' },
  { name: 'lg-compress-pdf', purpose: 'Compresses LG PDF files', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/lg-capture (LGCapture)' },
  { name: 'lg-generate-pdf', purpose: 'Generates PDF reports from LG data', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/lg-capture (LGCapture)' },
  { name: 'lg-ocr-batch', purpose: 'Batch OCR processing for LG records', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/lg-capture (LGCapture)' },
  { name: 'lg-process-patient', purpose: 'Processes patient LG record submissions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/lg-capture (LGCapture)' },
  { name: 'lg-process-summary', purpose: 'Generates LG record summaries', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/lg-capture (LGCapture)' },
  { name: 'lg-snomed-quality-gate', purpose: 'SNOMED quality validation for LG records', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/lg-capture (LGCapture)' },
  { name: 'lg-validate-upload', purpose: 'Validates LG record uploads', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/lg-capture (LGCapture)' },
  { name: 'lg-verify-service', purpose: 'Verifies LG record service status', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/lg-capture (LGCapture)' },
  { name: 'live-meeting-notes-generator', purpose: 'Generates notes during live meetings', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'load-translation-sessions', purpose: 'Loads saved translation sessions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-translation (GPTranslation)' },
  { name: 'log-security-event', purpose: 'Logs security events to audit trail', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: 'Multiple pages (security utility)' },
  { name: 'manage-demo-responses', purpose: 'Manages demo complaint responses', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/demos (Demos)' },
  { name: 'manual-translation-service', purpose: 'Manual translation service endpoint', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-translation (GPTranslation)' },
  { name: 'meeting-coach-analyze', purpose: 'AI meeting coach analysis and feedback', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'meeting-completion-processor', purpose: 'Processes meeting completion workflows', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'meeting-length-monitor', purpose: 'Monitors meeting duration limits', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'meeting-qa-chat', purpose: 'Q&A chat about meeting content', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/meeting-summary (MeetingSummary)' },
  { name: 'merge-meeting-minutes', purpose: 'Merges multiple meeting minutes', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'merge-meetings', purpose: 'Merges meeting records together', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'mhra-alerts-fetcher', purpose: 'Fetches MHRA drug safety alerts', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-genie (GPGenie)' },
  { name: 'monitoring-alerts', purpose: 'System monitoring and alerting', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'mp3-transcription', purpose: 'Transcribes MP3 audio files', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'nhs-gp-news', purpose: 'Fetches NHS GP-specific news', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ (Home)' },
  { name: 'nhs-guidance-fetcher', purpose: 'Fetches NHS clinical guidance documents', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-genie (GPGenie)' },
  { name: 'nhs-verification-service', purpose: 'Verifies NHS credentials and status', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/settings (Settings)' },
  { name: 'nice-guidance-fetcher', purpose: 'Fetches NICE clinical guidance', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-genie (GPGenie)' },
  { name: 'notify-admin-rate-limit', purpose: 'Notifies admins about rate limit events', referencedInClient: false, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: 'check-login-rate-limit (Edge Function)' },
  { name: 'notify-login-rate-limit', purpose: 'Notifies about login rate limit breaches', referencedInClient: false, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: 'check-login-rate-limit (Edge Function)' },
  { name: 'openai-realtime-session', purpose: 'Manages OpenAI real-time API sessions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'parse-bp-readings', purpose: 'Parses blood pressure readings from text', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/bp-calculator (BPCalculator)' },
  { name: 'parse-survey-questions', purpose: 'Parses survey question definitions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/surveys (Surveys)' },
  { name: 'persist-standard-minutes', purpose: 'Persists standard meeting minutes', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'plaud-webhook', purpose: 'Webhook handler for Plaud audio devices', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: 'External webhook' },
  { name: 'pm-genie-send-email', purpose: 'Sends emails via PM Genie service', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-genie (GPGenie)' },
  { name: 'process-contractor-resume', purpose: 'Processes contractor CV/resume uploads', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/nres (NRES)' },
  { name: 'process-inbound-email', purpose: 'Processes incoming email messages', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: 'External webhook' },
  { name: 'process-meeting-audio', purpose: 'Processes meeting audio recordings', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'process-review-conversation', purpose: 'Processes complaint review conversations', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'purge-old-ai-chats', purpose: 'Purges old AI chat sessions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'purge-old-transcript-chunks', purpose: 'Purges old transcript chunk data', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'purge-old-user-images', purpose: 'Purges old user-uploaded images', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 're-summarise-complaint', purpose: 'Re-summarises complaint using updated AI', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'realtime-summarizer', purpose: 'Real-time transcript summarisation', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'realtime-transcript-cleaner', purpose: 'Real-time transcript cleaning', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'realtime-transcription', purpose: 'Real-time audio transcription endpoint', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'rebuild-meeting-audio', purpose: 'Rebuilds meeting audio from chunks', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'recorder-websocket-transcription', purpose: 'WebSocket-based recorder transcription', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/new-recorder (NewRecorder)' },
  { name: 'recover-meeting', purpose: 'Recovers failed/corrupted meetings', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'regenerate-acknowledgement-letter', purpose: 'Regenerates complaint acknowledgement letters', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'regenerate-outcome-letter', purpose: 'Regenerates complaint outcome letters', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'remove-user-practice-manager', purpose: 'Removes user via practice manager', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/practice-admin (PracticeAdmin)' },
  { name: 'repair-transcript-chunks', purpose: 'Repairs damaged transcript chunks', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin/chunk-repair (ChunkRepair)' },
  { name: 'reprocess-audio-backup', purpose: 'Reprocesses audio from backup storage', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'reprocess-audio-chunks', purpose: 'Reprocesses individual audio chunks', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'reprocess-meeting-audio', purpose: 'Reprocesses full meeting audio', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'rewrite-referral-tone', purpose: 'Rewrites referral letter tone/style', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'runware-image-generation', purpose: 'Image generation via Runware API', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'save-translation-session', purpose: 'Saves translation session state', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-translation (GPTranslation)' },
  { name: 'scrape-icb-traffic-lights', purpose: 'Scrapes ICB traffic light drug data', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'security-scan', purpose: 'Runs security scan across the system', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/compliance/security (SecurityDashboard)' },
  { name: 'send-audio-email-resend', purpose: 'Sends audio via email using Resend', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/notebook-studio (NotebookStudio)' },
  { name: 'send-chat-email', purpose: 'Sends chat conversations via email', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4pm (AI4PM)' },
  { name: 'send-complaint-notifications', purpose: 'Sends complaint-related notifications', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaints (Complaints)' },
  { name: 'send-email-resend', purpose: 'Sends emails via Resend API', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: 'Multiple pages (email utility)' },
  { name: 'send-email-via-emailjs', purpose: 'Sends emails via EmailJS service', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/feedback (Feedback)' },
  { name: 'send-genie-transcript-email', purpose: 'Sends GP Genie transcript emails', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-genie (GPGenie)' },
  { name: 'send-magic-link', purpose: 'Sends magic link authentication emails', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'send-meeting-email-resend', purpose: 'Sends meeting emails via Resend', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'send-meeting-summary', purpose: 'Sends meeting summary emails', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/meeting-summary (MeetingSummary)' },
  { name: 'send-security-report', purpose: 'Sends security report emails', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/compliance/security (SecurityDashboard)' },
  { name: 'send-sms-notify', purpose: 'Sends SMS notifications', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'send-survey-digest', purpose: 'Sends survey result digest emails', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/surveys (Surveys)' },
  { name: 'send-user-welcome-email', purpose: 'Sends welcome emails to new users', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'smart-source-router', purpose: 'Routes to optimal transcription source', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'speech-to-text-chunked', purpose: 'Chunked speech-to-text processing', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'speech-to-text-consultation', purpose: 'Speech-to-text for consultations', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai4gp (AI4GP)' },
  { name: 'speech-to-text', purpose: 'General speech-to-text transcription', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'standalone-deepgram', purpose: 'Standalone Deepgram transcription', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'standalone-whisper', purpose: 'Standalone OpenAI Whisper transcription', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'summarize-transcript-chunk', purpose: 'Summarises individual transcript chunks', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'sync-meeting-action-items', purpose: 'Syncs meeting action items to database', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/meeting-summary (MeetingSummary)' },
  { name: 'system-monitoring', purpose: 'System health monitoring and metrics', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'test-mp3-transcription', purpose: 'Tests MP3 transcription pipeline', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'text-to-speech', purpose: 'General text-to-speech synthesis', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/notebook-studio (NotebookStudio)' },
  { name: 'tighten-systmone-notes', purpose: 'Tightens SystmOne clinical notes format', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'transcode-audio', purpose: 'Transcodes audio between formats', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'transcribe-audio', purpose: 'Transcribes audio file uploads', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'translate-text-simple', purpose: 'Simple text translation service', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/mobile-translate (MobileTranslate)' },
  { name: 'translate-text', purpose: 'Full-featured text translation', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true, calledFrom: '/gp-translation (GPTranslation)' },
  { name: 'translation-verification-service', purpose: 'Verifies translation accuracy', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-translation (GPTranslation)' },
  { name: 'triple-check-transcription', purpose: 'Triple-checks transcription accuracy', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/scribe (GPScribe)' },
  { name: 'update-meeting-notes', purpose: 'Updates existing meeting notes', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/meeting-summary (MeetingSummary)' },
  { name: 'update-translation-session', purpose: 'Updates translation session data', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/gp-translation (GPTranslation)' },
  { name: 'update-user-password-admin', purpose: 'Admin password reset endpoint', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/admin (SystemAdmin)' },
  { name: 'update-user-practice-manager', purpose: 'Updates user via practice manager', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/practice-admin (PracticeAdmin)' },
  { name: 'upload-ai-chat-capture', purpose: 'Uploads AI chat capture images', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai-capture (AICapturePublic)' },
  { name: 'upload-complaint-capture', purpose: 'Uploads complaint capture images', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/complaint-capture (ComplaintCapture)' },
  { name: 'upload-doc-capture', purpose: 'Uploads document capture images', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/doc-capture (DocCapture)' },
  { name: 'upload-inspection-capture', purpose: 'Uploads CQC inspection capture images', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/inspection-capture (InspectionCapture)' },
  { name: 'upload-to-text', purpose: 'Converts uploaded files to text', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: 'Multiple pages (file upload utility)' },
  { name: 'validate-ai-chat-capture-token', purpose: 'Validates AI chat capture session tokens', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/ai-capture (AICapturePublic)' },
  { name: 'validate-doc-capture-token', purpose: 'Validates document capture tokens', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/doc-capture (DocCapture)' },
  { name: 'validate-quick-record-token', purpose: 'Validates quick record session tokens', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true, calledFrom: '/quick-record (QuickRecord)' },
];

const ARCHIVED_FUNCTIONS: Omit<EdgeFunction, 'status' | 'lastLogDates' | 'logStatus'>[] = [
  { name: 'api-key-test', purpose: 'Tests API key validity (archived)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'cleanup-orphaned-versions', purpose: 'Cleaned up orphaned policy versions', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'drug-vocabulary', purpose: 'Drug vocabulary lookup (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'fix-orphaned-transcript-chunks', purpose: 'Fixed orphaned transcript chunks', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'generate-dual-consultation-summary', purpose: 'Generated dual consultation summaries', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'generate-image', purpose: 'Generic image generation (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'generate-meeting-minutes-detailed', purpose: 'Detailed meeting minutes (consolidated)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'gpt5-clinical-reviewer', purpose: 'GPT-5 clinical review (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'identify-speakers', purpose: 'Speaker identification (removed)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'import-snomed-bulk', purpose: 'Bulk SNOMED import (completed)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'import-snomed-codes', purpose: 'SNOMED code import (completed)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'medical-ocr-verification', purpose: 'Medical OCR verification (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'medical-translation-cross-check', purpose: 'Medical translation cross-check (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'meeting-completion-handler', purpose: 'Meeting completion handler (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'nhs-vaccination-guidance', purpose: 'NHS vaccination guidance (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'openai-realtime-token', purpose: 'OpenAI realtime token (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'policy-resolve', purpose: 'Policy resolution (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'process-meeting-notes-queue', purpose: 'Meeting notes queue processor (removed)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'send-password-reset-email', purpose: 'Password reset emails (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'smart-web-search', purpose: 'Smart web search (removed)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'translate-patient-document', purpose: 'Patient document translation (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
  { name: 'update-meeting-context', purpose: 'Meeting context updates (removed)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false, calledFrom: 'N/A (archived)' },
];

type FilterType = 'all' | 'referenced' | 'unreferenced' | 'no-client-ref' | 'no-function-ref';

export const EdgeFunctionAudit: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [functions, setFunctions] = useState<EdgeFunction[]>(() => [
    ...ACTIVE_FUNCTIONS.map(f => ({ ...f, status: 'active' as const, lastLogDates: undefined, logStatus: 'idle' as const })),
  ]);
  const [batchScanning, setBatchScanning] = useState(false);

  const activeFunctions = useMemo(() => {
    return functions.filter(f => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!f.name.toLowerCase().includes(q) && !f.purpose.toLowerCase().includes(q) && !f.calledFrom.toLowerCase().includes(q)) return false;
      }
      switch (filter) {
        case 'referenced': return f.referencedInClient || f.referencedInOtherFunctions;
        case 'unreferenced': return !f.referencedInClient && !f.referencedInOtherFunctions;
        case 'no-client-ref': return !f.referencedInClient;
        case 'no-function-ref': return !f.referencedInOtherFunctions;
        default: return true;
      }
    });
  }, [functions, searchQuery, filter]);

  const archivedFunctions = useMemo(() => {
    const archived = ARCHIVED_FUNCTIONS.map(f => ({ ...f, status: 'archived' as const, lastLogDates: undefined, logStatus: 'idle' as const }));
    if (!searchQuery) return archived;
    const q = searchQuery.toLowerCase();
    return archived.filter(f => f.name.toLowerCase().includes(q) || f.purpose.toLowerCase().includes(q));
  }, [searchQuery]);

  const stats = useMemo(() => {
    const total = ACTIVE_FUNCTIONS.length;
    const clientReferenced = ACTIVE_FUNCTIONS.filter(f => f.referencedInClient).length;
    const functionReferenced = ACTIVE_FUNCTIONS.filter(f => f.referencedInOtherFunctions).length;
    const unreferenced = ACTIVE_FUNCTIONS.filter(f => !f.referencedInClient && !f.referencedInOtherFunctions).length;
    return { total, clientReferenced, functionReferenced, unreferenced, archived: ARCHIVED_FUNCTIONS.length };
  }, []);

  const checkLogs = async (functionName: string) => {
    setFunctions(prev => prev.map(f =>
      f.name === functionName ? { ...f, logStatus: 'loading' as const } : f
    ));

    try {
      const { data, error } = await supabase.functions.invoke('system-monitoring', {
        body: { action: 'get-function-logs', functionName, limit: 5 }
      });

      if (error) throw error;

      const logDates = data?.logs?.map((log: any) => {
        const d = new Date(log.timestamp);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) +
          ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      }) || [];

      setFunctions(prev => prev.map(f =>
        f.name === functionName ? { ...f, lastLogDates: logDates, logStatus: 'loaded' as const } : f
      ));
    } catch (err) {
      console.error(`Error fetching logs for ${functionName}:`, err);
      setFunctions(prev => prev.map(f =>
        f.name === functionName ? { ...f, lastLogDates: [], logStatus: 'error' as const } : f
      ));
      toast.error(`Failed to fetch logs for ${functionName}`);
    }
  };

  const batchScanUnreferenced = async () => {
    const unreferenced = functions.filter(f => !f.referencedInClient && !f.referencedInOtherFunctions && f.logStatus === 'idle');
    if (unreferenced.length === 0) {
      toast.info('No unreferenced functions to scan');
      return;
    }
    setBatchScanning(true);
    const batch = unreferenced.slice(0, 20);
    for (const fn of batch) {
      await checkLogs(fn.name);
    }
    setBatchScanning(false);
    toast.success(`Scanned logs for ${batch.length} unreferenced functions`);
  };

  const getRowClass = (fn: EdgeFunction) => {
    if (!fn.referencedInClient && !fn.referencedInOtherFunctions) {
      if (fn.logStatus === 'loaded' && (!fn.lastLogDates || fn.lastLogDates.length === 0)) {
        return 'bg-red-50 dark:bg-red-950/20';
      }
      return 'bg-amber-50 dark:bg-amber-950/20';
    }
    if (fn.logStatus === 'loaded' && fn.lastLogDates && fn.lastLogDates.length > 0) {
      return 'bg-green-50 dark:bg-green-950/20';
    }
    return '';
  };

  const downloadWordReport = async () => {
    try {
      const now = new Date();
      const reportDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

      const cellBorders = {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      };

      const headerShading = { type: ShadingType.SOLID, color: '003087', fill: '003087' };

      const makeHeaderCell = (text: string, width: number) =>
        new DocxTableCell({
          width: { size: width, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          shading: headerShading,
          children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 18, font: 'Calibri' })] })],
        });

      const makeCell = (text: string, width: number, opts?: { bold?: boolean; color?: string; shading?: any }) =>
        new DocxTableCell({
          width: { size: width, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          shading: opts?.shading,
          children: [new Paragraph({ children: [new TextRun({ text, size: 18, font: 'Calibri', bold: opts?.bold, color: opts?.color })] })],
        });

      // Group functions by reference status
      const referenced = functions.filter(f => f.referencedInClient || f.referencedInOtherFunctions);
      const unreferenced = functions.filter(f => !f.referencedInClient && !f.referencedInOtherFunctions);
      const unreferencedNoLogs = unreferenced.filter(f => f.logStatus === 'loaded' && (!f.lastLogDates || f.lastLogDates.length === 0));

      const buildFunctionRows = (fns: EdgeFunction[]) =>
        fns.map((fn, i) => {
          const rowShading = i % 2 === 0 ? undefined : { type: ShadingType.SOLID, color: 'F5F5F5', fill: 'F5F5F5' };
          const logText = fn.logStatus === 'loaded'
            ? (fn.lastLogDates && fn.lastLogDates.length > 0 ? fn.lastLogDates.join(', ') : 'No recent logs')
            : 'Not checked';

          return new DocxTableRow({
            children: [
              makeCell(fn.name, 18, { shading: rowShading }),
              makeCell(fn.purpose, 22, { shading: rowShading }),
              makeCell(fn.calledFrom, 16, { shading: rowShading }),
              makeCell(fn.referencedInClient ? 'Yes' : 'No', 8, {
                shading: rowShading,
                color: fn.referencedInClient ? '16A34A' : 'DC2626',
              }),
              makeCell(fn.referencedInOtherFunctions ? 'Yes' : 'No', 8, {
                shading: rowShading,
                color: fn.referencedInOtherFunctions ? '2563EB' : '999999',
              }),
              makeCell(logText, 28, { shading: rowShading }),
            ],
          });
        });

      const buildArchivedRows = () =>
        ARCHIVED_FUNCTIONS.map((fn, i) => {
          const rowShading = i % 2 === 0 ? undefined : { type: ShadingType.SOLID, color: 'F5F5F5', fill: 'F5F5F5' };
          return new DocxTableRow({
            children: [
              makeCell(fn.name, 30, { shading: rowShading }),
              makeCell(fn.purpose, 70, { shading: rowShading }),
            ],
          });
        });

      const headerRow = new DocxTableRow({
        children: [
          makeHeaderCell('Function Name', 18),
          makeHeaderCell('Purpose', 22),
          makeHeaderCell('Called From', 16),
          makeHeaderCell('Client Ref', 8),
          makeHeaderCell('Cross-Ref', 8),
          makeHeaderCell('Last Log Dates', 28),
        ],
      });

      const archivedHeaderRow = new DocxTableRow({
        children: [
          makeHeaderCell('Function Name', 30),
          makeHeaderCell('Purpose', 70),
        ],
      });

      const doc = new Document({
        sections: [{
          properties: {
            page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } },
          },
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun({ text: 'Edge Function Audit Report', bold: true, size: 32, font: 'Calibri', color: '003087' })],
            }),
            new Paragraph({
              spacing: { after: 200 },
              children: [new TextRun({ text: `Generated: ${reportDate}`, size: 20, font: 'Calibri', color: '666666', italics: true })],
            }),

            // Summary
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 200 },
              children: [new TextRun({ text: 'Summary', bold: true, size: 26, font: 'Calibri', color: '003087' })],
            }),
            new Paragraph({ children: [new TextRun({ text: `Total Active Functions: ${stats.total}`, size: 20, font: 'Calibri' })] }),
            new Paragraph({ children: [new TextRun({ text: `Client Referenced: ${stats.clientReferenced}`, size: 20, font: 'Calibri' })] }),
            new Paragraph({ children: [new TextRun({ text: `Cross-Referenced by Other Functions: ${stats.functionReferenced}`, size: 20, font: 'Calibri' })] }),
            new Paragraph({ children: [new TextRun({ text: `Unreferenced (Cleanup Candidates): ${stats.unreferenced}`, size: 20, font: 'Calibri', color: 'D97706' })] }),
            new Paragraph({ children: [new TextRun({ text: `Archived: ${stats.archived}`, size: 20, font: 'Calibri' })] }),
            new Paragraph({
              spacing: { after: 100 },
              children: [new TextRun({ text: `Functions with logs checked and no recent activity: ${unreferencedNoLogs.length}`, size: 20, font: 'Calibri', color: 'DC2626' })],
            }),

            // Unreferenced section (most useful for planning)
            ...(unreferenced.length > 0 ? [
              new Paragraph({
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 400, after: 200 },
                children: [new TextRun({ text: `Unreferenced Functions (${unreferenced.length}) — Cleanup Candidates`, bold: true, size: 26, font: 'Calibri', color: 'D97706' })],
              }),
              new Paragraph({
                spacing: { after: 200 },
                children: [new TextRun({ text: 'These functions have no references in client code or other edge functions. They are candidates for archival or removal.', size: 20, font: 'Calibri', italics: true, color: '666666' })],
              }),
              new DocxTable({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [headerRow, ...buildFunctionRows(unreferenced)],
              }),
            ] : []),

            // All active functions
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 },
              children: [new TextRun({ text: `All Active Functions (${functions.length})`, bold: true, size: 26, font: 'Calibri', color: '003087' })],
            }),
            new DocxTable({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new DocxTableRow({
                  children: [
                    makeHeaderCell('Function Name', 18),
                    makeHeaderCell('Purpose', 22),
                    makeHeaderCell('Called From', 16),
                    makeHeaderCell('Client Ref', 8),
                    makeHeaderCell('Cross-Ref', 8),
                    makeHeaderCell('Last Log Dates', 28),
                  ],
                }),
                ...buildFunctionRows(functions),
              ],
            }),

            // Archived functions
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 },
              children: [new TextRun({ text: `Archived Functions (${ARCHIVED_FUNCTIONS.length})`, bold: true, size: 26, font: 'Calibri', color: '666666' })],
            }),
            new Paragraph({
              spacing: { after: 200 },
              children: [new TextRun({ text: 'These functions have been moved to the archive and are no longer deployed.', size: 20, font: 'Calibri', italics: true, color: '666666' })],
            }),
            new DocxTable({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [archivedHeaderRow, ...buildArchivedRows()],
            }),

            // Key
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 },
              children: [new TextRun({ text: 'Key', bold: true, size: 26, font: 'Calibri', color: '003087' })],
            }),
            new Paragraph({ children: [new TextRun({ text: 'Called From: ', bold: true, size: 20, font: 'Calibri' }), new TextRun({ text: 'The page or component that invokes this edge function', size: 20, font: 'Calibri' })] }),
            new Paragraph({ children: [new TextRun({ text: 'Client Ref: ', bold: true, size: 20, font: 'Calibri' }), new TextRun({ text: 'Whether the function is called from the web application (src/ code)', size: 20, font: 'Calibri' })] }),
            new Paragraph({ children: [new TextRun({ text: 'Cross-Ref: ', bold: true, size: 20, font: 'Calibri' }), new TextRun({ text: 'Whether the function is called by another edge function', size: 20, font: 'Calibri' })] }),
            new Paragraph({ children: [new TextRun({ text: 'Last Log Dates: ', bold: true, size: 20, font: 'Calibri' }), new TextRun({ text: 'Most recent invocation timestamps (fetched on demand via "Check Logs" button)', size: 20, font: 'Calibri' })] }),
            new Paragraph({
              spacing: { before: 200 },
              children: [new TextRun({ text: 'Recommendation: Functions marked as unreferenced with no recent logs are safe candidates for archival.', size: 20, font: 'Calibri', italics: true, color: '666666' })],
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const filename = `edge-function-audit-${now.toISOString().split('T')[0]}.docx`;
      saveAs(blob, filename);
      toast.success('Report downloaded successfully');
    } catch (err) {
      console.error('Error generating report:', err);
      toast.error('Failed to generate report');
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Active Functions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.clientReferenced}</div>
            <div className="text-xs text-muted-foreground">Client Referenced</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.functionReferenced}</div>
            <div className="text-xs text-muted-foreground">Cross-Referenced</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.unreferenced}</div>
            <div className="text-xs text-muted-foreground">Unreferenced</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-muted-foreground">{stats.archived}</div>
            <div className="text-xs text-muted-foreground">Archived</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, purpose, or calling page..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Functions</SelectItem>
            <SelectItem value="referenced">Referenced</SelectItem>
            <SelectItem value="unreferenced">Unreferenced</SelectItem>
            <SelectItem value="no-client-ref">No Client Ref</SelectItem>
            <SelectItem value="no-function-ref">No Cross-Ref</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={batchScanUnreferenced}
          disabled={batchScanning}
          className="whitespace-nowrap"
        >
          {batchScanning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Activity className="h-4 w-4 mr-2" />}
          Batch Scan Unreferenced
        </Button>
        <Button
          variant="outline"
          onClick={downloadWordReport}
          className="whitespace-nowrap"
        >
          <Download className="h-4 w-4 mr-2" />
          Download Report
        </Button>
      </div>

      {/* Active Functions Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active Functions ({activeFunctions.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[200px]">Function Name</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead className="w-[180px]">Called From</TableHead>
                  <TableHead className="w-[70px] text-center">Client</TableHead>
                  <TableHead className="w-[70px] text-center">Cross-Ref</TableHead>
                  <TableHead className="w-[220px]">Last Log Dates</TableHead>
                  <TableHead className="w-[90px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeFunctions.map((fn) => (
                  <TableRow key={fn.name} className={getRowClass(fn)}>
                    <TableCell className="font-mono text-xs">{fn.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fn.purpose}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs font-normal whitespace-nowrap">
                        {fn.calledFrom}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {fn.referencedInClient
                        ? <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                        : <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                      }
                    </TableCell>
                    <TableCell className="text-center">
                      {fn.referencedInOtherFunctions
                        ? <CheckCircle className="h-4 w-4 text-blue-600 mx-auto" />
                        : <span className="text-muted-foreground text-xs">—</span>
                      }
                    </TableCell>
                    <TableCell>
                      {fn.logStatus === 'loading' && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {fn.logStatus === 'loaded' && fn.lastLogDates && fn.lastLogDates.length > 0 && (
                        <div className="space-y-0.5">
                          {fn.lastLogDates.map((d, i) => (
                            <div key={i} className="text-xs font-mono text-muted-foreground">{d}</div>
                          ))}
                        </div>
                      )}
                      {fn.logStatus === 'loaded' && (!fn.lastLogDates || fn.lastLogDates.length === 0) && (
                        <span className="text-xs text-red-500 font-medium">No recent logs</span>
                      )}
                      {fn.logStatus === 'error' && (
                        <span className="text-xs text-red-500">Error fetching</span>
                      )}
                      {fn.logStatus === 'idle' && (
                        <span className="text-xs text-muted-foreground">Not checked</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => checkLogs(fn.name)}
                        disabled={fn.logStatus === 'loading'}
                        className="text-xs h-7"
                      >
                        {fn.logStatus === 'loading' ? 'Checking...' : 'Check Logs'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Archived Functions */}
      <CollapsibleCard
        title={`Archived Functions (${archivedFunctions.length})`}
        icon={<Archive className="h-5 w-5" />}
        defaultOpen={false}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Function Name</TableHead>
              <TableHead>Purpose</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {archivedFunctions.map((fn) => (
              <TableRow key={fn.name} className="opacity-60">
                <TableCell className="font-mono text-xs">{fn.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fn.purpose}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsibleCard>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground p-3 border rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-950 border border-green-300" />
          <span>Referenced + Recent Logs</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-950 border border-amber-300" />
          <span>Unreferenced (Cleanup Candidate)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-950 border border-red-300" />
          <span>Unreferenced + No Logs (Safe to Remove)</span>
        </div>
      </div>
    </div>
  );
};
