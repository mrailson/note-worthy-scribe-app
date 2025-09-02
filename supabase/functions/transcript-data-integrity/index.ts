import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TranscriptSaveRequest {
  meetingId: string;
  userId: string;
  transcriptText: string;
  audioBuffer?: ArrayBuffer;
  sessionId: string;
  confidence: number;
  speakerName?: string;
  chunkNumber?: number;
  backupReason?: string;
}

// Atomic transcript saving with mandatory backup
async function saveTranscriptWithBackup(request: TranscriptSaveRequest) {
  const {
    meetingId,
    userId,
    transcriptText,
    audioBuffer,
    sessionId,
    confidence,
    speakerName = 'Speaker',
    chunkNumber = 0,
    backupReason = 'transcript_safety'
  } = request;

  console.log(`🔐 ATOMIC SAVE: Starting transcript save for meeting ${meetingId}`);

  // Begin transaction simulation using multiple operations with rollback capability
  const operations = [];
  let audioBackupId = null;

  try {
    // Step 1: Mandatory Audio Backup (if provided)
    if (audioBuffer) {
      console.log('💾 BACKUP: Saving audio backup...');
      
      const audioFileName = `meeting-${meetingId}-session-${sessionId}-${Date.now()}.webm`;
      const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
      
      const { data: audioUpload, error: audioUploadError } = await supabase.storage
        .from('meeting-audio-backups')
        .upload(audioFileName, audioBlob);
        
      if (audioUploadError) {
        throw new Error(`Audio backup failed: ${audioUploadError.message}`);
      }

      // Save audio backup metadata
      const { data: backupData, error: backupError } = await supabase
        .from('meeting_audio_backups')
        .insert({
          meeting_id: meetingId,
          user_id: userId,
          file_path: audioFileName,
          file_size: audioBuffer.byteLength,
          backup_reason: backupReason,
          duration_seconds: Math.floor(audioBuffer.byteLength / 44100 / 2), // Rough estimate
          word_count: transcriptText.split(/\s+/).filter(w => w.length > 0).length,
          expected_word_count: transcriptText.split(/\s+/).filter(w => w.length > 0).length
        })
        .select()
        .single();

      if (backupError) {
        // Rollback audio upload
        await supabase.storage.from('meeting-audio-backups').remove([audioFileName]);
        throw new Error(`Audio backup metadata failed: ${backupError.message}`);
      }

      audioBackupId = backupData.id;
      operations.push({ type: 'audio_backup', id: audioBackupId, fileName: audioFileName });
      console.log('✅ BACKUP: Audio backup saved successfully');
    }

    // Step 2: Save transcript chunk with validation
    console.log('💾 TRANSCRIPT: Saving transcript chunk...');
    
    const wordCount = transcriptText.split(/\s+/).filter(w => w.length > 0).length;
    
    if (wordCount === 0) {
      throw new Error('Cannot save empty transcript');
    }

    const { data: chunkData, error: chunkError } = await supabase
      .from('meeting_transcription_chunks')
      .insert({
        meeting_id: meetingId,
        user_id: userId,
        session_id: sessionId,
        chunk_number: chunkNumber,
        transcription_text: transcriptText,
        confidence: confidence,
        word_count: wordCount,
        transcriber_type: 'atomic_save',
        audio_backup_id: audioBackupId
      })
      .select()
      .single();

    if (chunkError) {
      throw new Error(`Transcript chunk save failed: ${chunkError.message}`);
    }

    operations.push({ type: 'transcript_chunk', id: chunkData.id });

    // Step 3: Update meeting word count atomically
    console.log('📊 MEETING: Updating meeting word count...');
    
    const { error: meetingError } = await supabase
      .from('meetings')
      .update({ 
        word_count: wordCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', meetingId)
      .eq('user_id', userId);

    if (meetingError) {
      throw new Error(`Meeting word count update failed: ${meetingError.message}`);
    }

    operations.push({ type: 'meeting_update', meetingId });

    // Step 4: Immediate Validation
    console.log('✅ VALIDATION: Verifying saved data...');
    
    const { data: validationData, error: validationError } = await supabase
      .from('meeting_transcription_chunks')
      .select('transcription_text, word_count')
      .eq('id', chunkData.id)
      .single();

    if (validationError || !validationData.transcription_text || validationData.word_count !== wordCount) {
      throw new Error('Validation failed: Transcript not properly saved');
    }

    // Step 5: Log success
    await supabase
      .from('system_audit_log')
      .insert({
        table_name: 'transcript_integrity',
        operation: 'ATOMIC_TRANSCRIPT_SAVE',
        record_id: meetingId,
        user_id: userId,
        new_values: {
          chunkId: chunkData.id,
          wordCount: wordCount,
          hasAudioBackup: !!audioBackupId,
          validationPassed: true,
          operations: operations.length
        }
      });

    console.log('🎉 SUCCESS: Atomic transcript save completed');
    
    return {
      success: true,
      chunkId: chunkData.id,
      audioBackupId,
      wordCount,
      validationPassed: true,
      operations
    };

  } catch (error) {
    console.error('❌ ROLLBACK: Atomic save failed, rolling back...', error);
    
    // Rollback operations in reverse order
    for (const op of operations.reverse()) {
      try {
        if (op.type === 'audio_backup') {
          await supabase.from('meeting_audio_backups').delete().eq('id', op.id);
          await supabase.storage.from('meeting-audio-backups').remove([op.fileName]);
        } else if (op.type === 'transcript_chunk') {
          await supabase.from('meeting_transcription_chunks').delete().eq('id', op.id);
        }
      } catch (rollbackError) {
        console.error('Rollback operation failed:', rollbackError);
      }
    }

    // Log the failure
    await supabase
      .from('system_audit_log')
      .insert({
        table_name: 'transcript_integrity',
        operation: 'ATOMIC_SAVE_FAILED',
        record_id: meetingId,
        user_id: userId,
        new_values: {
          error: error.message,
          rollbackOperations: operations.length,
          timestamp: new Date().toISOString()
        }
      });

    throw error;
  }
}

// Data integrity checker
async function checkDataIntegrity(meetingId: string, userId: string) {
  console.log(`🔍 INTEGRITY: Checking data integrity for meeting ${meetingId}`);

  const issues = [];

  // Check 1: Meeting with word count but no transcript
  const { data: meeting } = await supabase
    .from('meetings')
    .select('word_count')
    .eq('id', meetingId)
    .single();

  if (meeting?.word_count > 0) {
    const { data: chunks, count } = await supabase
      .from('meeting_transcription_chunks')
      .select('transcription_text', { count: 'exact' })
      .eq('meeting_id', meetingId);

    if (!chunks || chunks.length === 0) {
      issues.push({
        type: 'missing_chunks',
        severity: 'critical',
        description: `Meeting has ${meeting.word_count} words but no transcript chunks`
      });
    } else {
      const totalWords = chunks.reduce((sum, chunk) => {
        return sum + (chunk.transcription_text?.split(/\s+/).filter(w => w.length > 0).length || 0);
      }, 0);
      
      if (totalWords === 0) {
        issues.push({
          type: 'empty_chunks',
          severity: 'critical',
          description: `Found ${chunks.length} chunks but all contain empty text`
        });
      }
    }
  }

  // Check 2: Missing audio backups
  const { count: backupCount } = await supabase
    .from('meeting_audio_backups')
    .select('*', { count: 'exact', head: true })
    .eq('meeting_id', meetingId);

  if (backupCount === 0) {
    issues.push({
      type: 'missing_audio_backup',
      severity: 'warning',
      description: 'No audio backup found for this meeting'
    });
  }

  return {
    meetingId,
    issuesFound: issues.length,
    issues,
    status: issues.some(i => i.severity === 'critical') ? 'critical' : 
            issues.length > 0 ? 'warning' : 'healthy'
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    
    console.log(`📨 INTEGRITY SERVICE: ${action} request received`);

    switch (action) {
      case 'save_transcript':
        const saveResult = await saveTranscriptWithBackup(params);
        return new Response(JSON.stringify(saveResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'check_integrity':
        const integrityResult = await checkDataIntegrity(params.meetingId, params.userId);
        return new Response(JSON.stringify(integrityResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'emergency_recovery':
        // Implement emergency recovery logic
        const recoveryResult = { success: true, message: 'Emergency recovery not yet implemented' };
        return new Response(JSON.stringify(recoveryResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('❌ INTEGRITY SERVICE ERROR:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});