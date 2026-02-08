import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { Search, Activity, Archive, CheckCircle, AlertTriangle, XCircle, Loader2, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EdgeFunction {
  name: string;
  purpose: string;
  referencedInClient: boolean;
  referencedInOtherFunctions: boolean;
  hasConfigEntry: boolean;
  status: 'active' | 'archived';
  lastLogDates?: string[];
  logStatus?: 'idle' | 'loading' | 'loaded' | 'error';
}

// Pre-computed registry of all active edge functions
const ACTIVE_FUNCTIONS: Omit<EdgeFunction, 'status' | 'lastLogDates' | 'logStatus'>[] = [
  { name: 'admin-clear-old-chats', purpose: 'Clears old AI chat sessions for admin cleanup', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'admin-login-as-user', purpose: 'Allows admins to impersonate user sessions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'advanced-image-generation', purpose: 'Generates AI images with advanced options', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'ai-4-pm-chat', purpose: 'AI chat assistant for practice managers', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'ai-api-test', purpose: 'Tests AI API connectivity and responses', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'ai-consultation-assistant', purpose: 'AI assistant for GP consultations', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'ai-context-restorer', purpose: 'Restores AI conversation context from history', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'ai-investigation-assistant', purpose: 'AI assistant for complaint investigations', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'ai-line-transform', purpose: 'Transforms text lines using AI formatting', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'ai-medical-translation-review', purpose: 'Reviews medical translations for accuracy', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'ai-response-clinical-verification', purpose: 'Verifies AI responses against clinical standards', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'ai4gp-image-generation', purpose: 'Generates images for AI4GP service', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'amazon-transcribe-chunk', purpose: 'Transcribes audio chunks via Amazon Transcribe', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'amazon-transcribe', purpose: 'Full audio transcription via Amazon Transcribe', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'analyse-consultation-so-far', purpose: 'Analyses ongoing consultation transcript', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'analyse-evidence-file', purpose: 'Analyses uploaded evidence files for complaints', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'analyse-policy-gaps', purpose: 'Identifies gaps in practice policies', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'analyse-referral-suggestions', purpose: 'AI analysis of referral letter suggestions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'analyze-complaint-outcome', purpose: 'Analyses complaint outcomes for patterns', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'api-testing-service', purpose: 'Service endpoint for API testing tools', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'assemblyai-realtime-token', purpose: 'Generates real-time transcription tokens for AssemblyAI', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'assemblyai-realtime', purpose: 'Handles real-time AssemblyAI transcription streams', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'assemblyai-transcription-url', purpose: 'Generates AssemblyAI transcription URLs', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'assemblyai-transcription', purpose: 'Transcribes audio via AssemblyAI', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'assign-policy-to-practices', purpose: 'Assigns policy templates to GP practices', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'audio-transcription', purpose: 'General audio transcription routing service', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'auto-cleanup-empty-meetings', purpose: 'Automatically cleans up empty meeting records', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'auto-close-inactive-meetings', purpose: 'Closes meetings inactive for extended periods', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'auto-generate-meeting-notes', purpose: 'Auto-generates notes when meetings end', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'background-transcript-cleaner', purpose: 'Background job to clean transcript text', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'batch-consolidate-meetings', purpose: 'Batch consolidates multiple meeting transcripts', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'batch-translate-documents', purpose: 'Batch translates multiple documents', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'bnf-comprehensive-lookup', purpose: 'Comprehensive BNF drug information lookup', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'bnf-updates-fetcher', purpose: 'Fetches latest BNF formulary updates', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'bulk-create-nres-users', purpose: 'Bulk creates NRES user accounts', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'challenge-verify-service', purpose: 'Challenge-response verification for security', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'check-login-rate-limit', purpose: 'Checks and enforces login rate limiting', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'clean-transcript-chunk', purpose: 'Cleans individual transcript chunks', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'clean-transcript', purpose: 'Cleans full meeting transcripts', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'cleanup-empty-meetings', purpose: 'Removes empty/abandoned meeting records', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'clear-translation-sessions', purpose: 'Clears expired translation sessions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'clinical-verification-batch-test', purpose: 'Batch tests clinical verification accuracy', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'clinical-verification', purpose: 'Verifies clinical content accuracy', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'complaint-review-agent', purpose: 'AI agent for complaint review conversations', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'comprehensive-drug-lookup', purpose: 'Comprehensive drug interaction and info lookup', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'consolidate-dual-transcripts', purpose: 'Merges dual-source transcripts into one', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'consolidate-meeting-chunks', purpose: 'Consolidates meeting transcript chunks', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'consolidate-single-meeting-transcript', purpose: 'Consolidates a single meeting transcript', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'consultation-qa-chat', purpose: 'Q&A chat for GP consultation review', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'cqc-ai-assistant', purpose: 'AI assistant for CQC compliance queries', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'create-user-admin', purpose: 'Admin endpoint to create new users', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'create-user-practice-manager', purpose: 'Practice manager endpoint to create users', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'deepgram-direct', purpose: 'Direct Deepgram transcription endpoint', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'deepgram-realtime', purpose: 'Real-time Deepgram streaming transcription', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'deepgram-streaming', purpose: 'Deepgram streaming audio connection', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'deepgram-token', purpose: 'Generates Deepgram API access tokens', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'deepgram-transcribe', purpose: 'Deepgram batch audio transcription', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'deepgram-tts', purpose: 'Deepgram text-to-speech synthesis', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'delete-all-audio-backups', purpose: 'Deletes all stored audio backup files', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'delete-old-audio-backups', purpose: 'Removes audio backups older than retention', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'delete-translation-session', purpose: 'Deletes a specific translation session', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'delete-user-admin', purpose: 'Admin endpoint to delete user accounts', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'document-qa-chat', purpose: 'Q&A chat over uploaded documents', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'elevenlabs-agent-url', purpose: 'Generates ElevenLabs agent connection URLs', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'elevenlabs-conversation-verification', purpose: 'Verifies ElevenLabs conversation sessions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'elevenlabs-text-to-speech', purpose: 'Text-to-speech via ElevenLabs API', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'elevenlabs-tts', purpose: 'ElevenLabs TTS shorthand endpoint', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'email-translation-quality', purpose: 'Emails translation quality reports', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'enhance-meeting-minutes', purpose: 'AI enhancement of meeting minutes', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'enhance-policy', purpose: 'AI enhancement of practice policies', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'explain-unresolved-section', purpose: 'Explains unresolved transcript sections', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'export-docx', purpose: 'Exports content as DOCX documents', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'extract-document-text', purpose: 'Extracts text from uploaded documents', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'extract-patient-context', purpose: 'Extracts patient context from text', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'extract-patient-details-complaint', purpose: 'Extracts patient details from complaint text', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'extract-policy-text', purpose: 'Extracts text from policy documents', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'fetch-gamma-themes', purpose: 'Fetches Gamma presentation themes', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'fetch-gp-news', purpose: 'Fetches latest GP practice news', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'fetch-icb-traffic-light-drugs', purpose: 'Fetches ICB traffic-light drug formulary', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'force-complete-meeting', purpose: 'Force-completes a stuck meeting', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'force-stop-meeting', purpose: 'Force-stops an active meeting', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'format-admin-dictation', purpose: 'Formats admin dictation text', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'format-dictation', purpose: 'Formats dictated text for readability', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'format-transcript-paragraphs', purpose: 'Formats transcript into paragraphs', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-ageing-well-cga', purpose: 'Generates Comprehensive Geriatric Assessment', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-audio-overview', purpose: 'Generates audio overview scripts', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-audio-review', purpose: 'Generates AI audio evidence review', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-complaint-acknowledgement', purpose: 'Generates complaint acknowledgement letters', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-complaint-ai-report', purpose: 'Generates AI reports for complaints', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-complaint-audio-overview', purpose: 'Generates audio overviews for complaints', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-complaint-outcome-letter', purpose: 'Generates complaint outcome letters', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-consolidated-meeting-notes', purpose: 'Generates consolidated meeting notes', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'generate-consultation-notes', purpose: 'Generates GP consultation SOAP notes', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-conversation-summary', purpose: 'Summarises AI conversation sessions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-cqc-compliance-report', purpose: 'Generates CQC compliance reports', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-cso-certificate', purpose: 'Generates CSO training certificates', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-demo-response', purpose: 'Generates demo complaint responses', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-document-audio-overview', purpose: 'Generates audio overviews from documents', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-example-complaint', purpose: 'Generates example complaints for demos', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-gp-consultation-notes', purpose: 'Generates GP-specific consultation notes', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-magic-link', purpose: 'Generates magic login links', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-meeting-audio-script', purpose: 'Generates audio scripts from meetings', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-meeting-notes-claude', purpose: 'Generates meeting notes using Claude AI', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-meeting-notes-compare', purpose: 'Compares meeting notes across AI models', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-meeting-notes-six-styles', purpose: 'Generates notes in 6 different styles', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-meeting-notes-ten-styles', purpose: 'Generates notes in 10 different styles', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-meeting-overview', purpose: 'Generates meeting overview summaries', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-meeting-title', purpose: 'Auto-generates meeting titles from transcript', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'generate-multi-type-notes', purpose: 'Generates multiple note types at once', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-notes-styles', purpose: 'Generates notes in various formatting styles', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-password-reset', purpose: 'Generates password reset tokens', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-patient-email', purpose: 'Generates patient communication emails', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-policy', purpose: 'AI-generates practice policy documents', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-powerpoint-gamma', purpose: 'Generates PowerPoint via Gamma API', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-powerpoint', purpose: 'Generates PowerPoint presentations', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-pptx-with-audio', purpose: 'Generates PPTX with embedded audio narration', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-presentation-scripts', purpose: 'Generates scripts for presentations', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-referral-draft', purpose: 'Generates referral letter drafts', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-referral-letter', purpose: 'Generates full referral letters', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'generate-reply', purpose: 'Generates AI replies for communications', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-scribe-notes', purpose: 'Generates GP Scribe clinical notes', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-slide-images', purpose: 'Generates images for presentation slides', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-slide-narration', purpose: 'Generates narration for presentation slides', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-staff-demo-notes', purpose: 'Generates demo notes for staff training', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'generate-standard-minutes-variations', purpose: 'Generates standard meeting minute variants', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'get-client-info', purpose: 'Returns client connection information', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'google-speech-streaming', purpose: 'Google Cloud Speech streaming transcription', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'gp-consultation-guidance', purpose: 'Provides GP consultation clinical guidance', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'gp-translation-tts', purpose: 'Text-to-speech for GP translations', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'gpt-clean-transcript', purpose: 'Cleans transcripts using GPT models', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'gpt5-fast-clinical', purpose: 'Fast clinical processing via GPT-5', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'graceful-end-meeting', purpose: 'Gracefully ends a meeting with cleanup', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'image-ocr-translate', purpose: 'OCR and translation of image text', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'import-complaint-data', purpose: 'Imports complaint data from external sources', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'import-complete-traffic-light-medicines', purpose: 'Imports complete traffic light medicine list', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'import-icb-formulary-seed', purpose: 'Seeds initial ICB formulary data', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'import-icn-formulary', purpose: 'Imports ICN formulary data', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'import-prior-approval-data', purpose: 'Imports prior approval drug data', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'improve-text-layout', purpose: 'AI improvement of text layout and formatting', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'improve-translation-layout', purpose: 'Improves translation text layout', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'ingest-transcript-chunk', purpose: 'Ingests individual transcript chunks', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'json-to-pptx', purpose: 'Converts JSON data to PowerPoint files', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'lg-ask-ai', purpose: 'AI Q&A for Lloyd George record queries', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'lg-batch-report', purpose: 'Batch report generation for LG records', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'lg-bulk-download', purpose: 'Bulk download of LG record files', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'lg-compress-pdf', purpose: 'Compresses LG PDF files', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'lg-generate-pdf', purpose: 'Generates PDF reports from LG data', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'lg-ocr-batch', purpose: 'Batch OCR processing for LG records', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'lg-process-patient', purpose: 'Processes patient LG record submissions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'lg-process-summary', purpose: 'Generates LG record summaries', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'lg-snomed-quality-gate', purpose: 'SNOMED quality validation for LG records', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'lg-validate-upload', purpose: 'Validates LG record uploads', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'lg-verify-service', purpose: 'Verifies LG record service status', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'live-meeting-notes-generator', purpose: 'Generates notes during live meetings', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'load-translation-sessions', purpose: 'Loads saved translation sessions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'log-security-event', purpose: 'Logs security events to audit trail', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'manage-demo-responses', purpose: 'Manages demo complaint responses', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'manual-translation-service', purpose: 'Manual translation service endpoint', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'meeting-coach-analyze', purpose: 'AI meeting coach analysis and feedback', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'meeting-completion-processor', purpose: 'Processes meeting completion workflows', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'meeting-length-monitor', purpose: 'Monitors meeting duration limits', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'meeting-qa-chat', purpose: 'Q&A chat about meeting content', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'merge-meeting-minutes', purpose: 'Merges multiple meeting minutes', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'merge-meetings', purpose: 'Merges meeting records together', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'mhra-alerts-fetcher', purpose: 'Fetches MHRA drug safety alerts', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'monitoring-alerts', purpose: 'System monitoring and alerting', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'mp3-transcription', purpose: 'Transcribes MP3 audio files', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'nhs-gp-news', purpose: 'Fetches NHS GP-specific news', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'nhs-guidance-fetcher', purpose: 'Fetches NHS clinical guidance documents', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'nhs-verification-service', purpose: 'Verifies NHS credentials and status', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'nice-guidance-fetcher', purpose: 'Fetches NICE clinical guidance', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'notify-admin-rate-limit', purpose: 'Notifies admins about rate limit events', referencedInClient: false, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'notify-login-rate-limit', purpose: 'Notifies about login rate limit breaches', referencedInClient: false, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'openai-realtime-session', purpose: 'Manages OpenAI real-time API sessions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'parse-bp-readings', purpose: 'Parses blood pressure readings from text', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'parse-survey-questions', purpose: 'Parses survey question definitions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'persist-standard-minutes', purpose: 'Persists standard meeting minutes', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'plaud-webhook', purpose: 'Webhook handler for Plaud audio devices', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'pm-genie-send-email', purpose: 'Sends emails via PM Genie service', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'process-contractor-resume', purpose: 'Processes contractor CV/resume uploads', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'process-inbound-email', purpose: 'Processes incoming email messages', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'process-meeting-audio', purpose: 'Processes meeting audio recordings', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'process-review-conversation', purpose: 'Processes complaint review conversations', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'purge-old-ai-chats', purpose: 'Purges old AI chat sessions', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'purge-old-transcript-chunks', purpose: 'Purges old transcript chunk data', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'purge-old-user-images', purpose: 'Purges old user-uploaded images', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 're-summarise-complaint', purpose: 'Re-summarises complaint using updated AI', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'realtime-summarizer', purpose: 'Real-time transcript summarisation', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'realtime-transcript-cleaner', purpose: 'Real-time transcript cleaning', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'realtime-transcription', purpose: 'Real-time audio transcription endpoint', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'rebuild-meeting-audio', purpose: 'Rebuilds meeting audio from chunks', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'recorder-websocket-transcription', purpose: 'WebSocket-based recorder transcription', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'recover-meeting', purpose: 'Recovers failed/corrupted meetings', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'regenerate-acknowledgement-letter', purpose: 'Regenerates complaint acknowledgement letters', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'regenerate-outcome-letter', purpose: 'Regenerates complaint outcome letters', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'remove-user-practice-manager', purpose: 'Removes user via practice manager', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'repair-transcript-chunks', purpose: 'Repairs damaged transcript chunks', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'reprocess-audio-backup', purpose: 'Reprocesses audio from backup storage', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'reprocess-audio-chunks', purpose: 'Reprocesses individual audio chunks', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'reprocess-meeting-audio', purpose: 'Reprocesses full meeting audio', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'rewrite-referral-tone', purpose: 'Rewrites referral letter tone/style', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'runware-image-generation', purpose: 'Image generation via Runware API', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'save-translation-session', purpose: 'Saves translation session state', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'scrape-icb-traffic-lights', purpose: 'Scrapes ICB traffic light drug data', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'security-scan', purpose: 'Runs security scan across the system', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'send-audio-email-resend', purpose: 'Sends audio via email using Resend', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'send-chat-email', purpose: 'Sends chat conversations via email', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'send-complaint-notifications', purpose: 'Sends complaint-related notifications', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'send-email-resend', purpose: 'Sends emails via Resend API', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'send-email-via-emailjs', purpose: 'Sends emails via EmailJS service', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'send-genie-transcript-email', purpose: 'Sends GP Genie transcript emails', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'send-magic-link', purpose: 'Sends magic link authentication emails', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'send-meeting-email-resend', purpose: 'Sends meeting emails via Resend', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'send-meeting-summary', purpose: 'Sends meeting summary emails', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'send-security-report', purpose: 'Sends security report emails', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'send-sms-notify', purpose: 'Sends SMS notifications', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'send-survey-digest', purpose: 'Sends survey result digest emails', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'send-user-welcome-email', purpose: 'Sends welcome emails to new users', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'smart-source-router', purpose: 'Routes to optimal transcription source', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'speech-to-text-chunked', purpose: 'Chunked speech-to-text processing', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'speech-to-text-consultation', purpose: 'Speech-to-text for consultations', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'speech-to-text', purpose: 'General speech-to-text transcription', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'standalone-deepgram', purpose: 'Standalone Deepgram transcription', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'standalone-whisper', purpose: 'Standalone OpenAI Whisper transcription', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'summarize-transcript-chunk', purpose: 'Summarises individual transcript chunks', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'sync-meeting-action-items', purpose: 'Syncs meeting action items to database', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'system-monitoring', purpose: 'System health monitoring and metrics', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'test-mp3-transcription', purpose: 'Tests MP3 transcription pipeline', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'text-to-speech', purpose: 'General text-to-speech synthesis', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'tighten-systmone-notes', purpose: 'Tightens SystmOne clinical notes format', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'transcode-audio', purpose: 'Transcodes audio between formats', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'transcribe-audio', purpose: 'Transcribes audio file uploads', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'translate-text-simple', purpose: 'Simple text translation service', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'translate-text', purpose: 'Full-featured text translation', referencedInClient: true, referencedInOtherFunctions: true, hasConfigEntry: true },
  { name: 'translation-verification-service', purpose: 'Verifies translation accuracy', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'triple-check-transcription', purpose: 'Triple-checks transcription accuracy', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'update-meeting-notes', purpose: 'Updates existing meeting notes', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'update-translation-session', purpose: 'Updates translation session data', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'update-user-password-admin', purpose: 'Admin password reset endpoint', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'update-user-practice-manager', purpose: 'Updates user via practice manager', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'upload-ai-chat-capture', purpose: 'Uploads AI chat capture images', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'upload-complaint-capture', purpose: 'Uploads complaint capture images', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'upload-doc-capture', purpose: 'Uploads document capture images', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'upload-inspection-capture', purpose: 'Uploads CQC inspection capture images', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'upload-to-text', purpose: 'Converts uploaded files to text', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'validate-ai-chat-capture-token', purpose: 'Validates AI chat capture session tokens', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'validate-doc-capture-token', purpose: 'Validates document capture tokens', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
  { name: 'validate-quick-record-token', purpose: 'Validates quick record session tokens', referencedInClient: true, referencedInOtherFunctions: false, hasConfigEntry: true },
];

const ARCHIVED_FUNCTIONS: Omit<EdgeFunction, 'status' | 'lastLogDates' | 'logStatus'>[] = [
  { name: 'api-key-test', purpose: 'Tests API key validity (archived)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'cleanup-orphaned-versions', purpose: 'Cleaned up orphaned policy versions', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'drug-vocabulary', purpose: 'Drug vocabulary lookup (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'fix-orphaned-transcript-chunks', purpose: 'Fixed orphaned transcript chunks', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'generate-dual-consultation-summary', purpose: 'Generated dual consultation summaries', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'generate-image', purpose: 'Generic image generation (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'generate-meeting-minutes-detailed', purpose: 'Detailed meeting minutes (consolidated)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'gpt5-clinical-reviewer', purpose: 'GPT-5 clinical review (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'identify-speakers', purpose: 'Speaker identification (removed)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'import-snomed-bulk', purpose: 'Bulk SNOMED import (completed)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'import-snomed-codes', purpose: 'SNOMED code import (completed)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'medical-ocr-verification', purpose: 'Medical OCR verification (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'medical-translation-cross-check', purpose: 'Medical translation cross-check (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'meeting-completion-handler', purpose: 'Meeting completion handler (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'nhs-vaccination-guidance', purpose: 'NHS vaccination guidance (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'openai-realtime-token', purpose: 'OpenAI realtime token (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'policy-resolve', purpose: 'Policy resolution (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'process-meeting-notes-queue', purpose: 'Meeting notes queue processor (removed)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'send-password-reset-email', purpose: 'Password reset emails (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'smart-web-search', purpose: 'Smart web search (removed)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'translate-patient-document', purpose: 'Patient document translation (replaced)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
  { name: 'update-meeting-context', purpose: 'Meeting context updates (removed)', referencedInClient: false, referencedInOtherFunctions: false, hasConfigEntry: false },
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
        if (!f.name.toLowerCase().includes(q) && !f.purpose.toLowerCase().includes(q)) return false;
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
            placeholder="Search functions by name or purpose..."
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
                  <TableHead className="w-[220px]">Function Name</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead className="w-[80px] text-center">Client</TableHead>
                  <TableHead className="w-[80px] text-center">Cross-Ref</TableHead>
                  <TableHead className="w-[240px]">Last Log Dates</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeFunctions.map((fn) => (
                  <TableRow key={fn.name} className={getRowClass(fn)}>
                    <TableCell className="font-mono text-xs">{fn.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fn.purpose}</TableCell>
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
