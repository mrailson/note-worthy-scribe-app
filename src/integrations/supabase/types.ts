export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      active_meetings_monitor: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          last_activity_at: string | null
          last_processed_chunk_number: number | null
          meeting_id: string
          total_chunks_processed: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_activity_at?: string | null
          last_processed_chunk_number?: number | null
          meeting_id: string
          total_chunks_processed?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_activity_at?: string | null
          last_processed_chunk_number?: number | null
          meeting_id?: string
          total_chunks_processed?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_meetings_monitor_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_dictations: {
        Row: {
          cleaned_content: string | null
          content: string
          created_at: string
          duration_seconds: number | null
          id: string
          is_draft: boolean | null
          template_type: string
          title: string | null
          updated_at: string
          user_id: string
          word_count: number | null
        }
        Insert: {
          cleaned_content?: string | null
          content: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_draft?: boolean | null
          template_type?: string
          title?: string | null
          updated_at?: string
          user_id: string
          word_count?: number | null
        }
        Update: {
          cleaned_content?: string | null
          content?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_draft?: boolean | null
          template_type?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          word_count?: number | null
        }
        Relationships: []
      }
      ai_4_pm_searches: {
        Row: {
          brief_overview: string | null
          created_at: string
          id: string
          is_flagged: boolean | null
          is_protected: boolean | null
          messages: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brief_overview?: string | null
          created_at?: string
          id?: string
          is_flagged?: boolean | null
          is_protected?: boolean | null
          messages?: Json
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brief_overview?: string | null
          created_at?: string
          id?: string
          is_flagged?: boolean | null
          is_protected?: boolean | null
          messages?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_chat_capture_sessions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          is_active: boolean | null
          session_token: string
          short_code: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          session_token: string
          short_code?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          session_token?: string
          short_code?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_chat_captured_images: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          processed: boolean | null
          session_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          processed?: boolean | null
          session_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          processed?: boolean | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_captured_images_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_capture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_name: string | null
          created_at: string | null
          document_id: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          signatory_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_name?: string | null
          created_at?: string | null
          document_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          signatory_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_name?: string | null
          created_at?: string | null
          document_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          signatory_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_audit_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "approval_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_audit_log_signatory_id_fkey"
            columns: ["signatory_id"]
            isOneToOne: false
            referencedRelation: "approval_signatories"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_contact_group_members: {
        Row: {
          contact_id: string
          created_at: string | null
          group_id: string
          id: string
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          group_id: string
          id?: string
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_contact_group_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "approval_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_contact_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "approval_contact_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_contact_groups: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      approval_contacts: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_favourite: boolean | null
          name: string
          organisation: string | null
          organisation_type: string | null
          role: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_favourite?: boolean | null
          name: string
          organisation?: string | null
          organisation_type?: string | null
          role?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_favourite?: boolean | null
          name?: string
          organisation?: string | null
          organisation_type?: string | null
          role?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      approval_documents: {
        Row: {
          auto_send_on_completion: boolean
          batch_id: string | null
          category: string | null
          completed_at: string | null
          created_at: string | null
          deadline: string | null
          description: string | null
          file_hash: string
          file_size_bytes: number | null
          file_url: string
          id: string
          message: string | null
          multi_doc_group_id: string | null
          original_filename: string
          practice_id: string | null
          revoked_at: string | null
          sender_email: string | null
          sender_id: string
          sender_name: string | null
          signature_placement: Json | null
          signed_file_url: string | null
          status: string | null
          title: string
        }
        Insert: {
          auto_send_on_completion?: boolean
          batch_id?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          file_hash: string
          file_size_bytes?: number | null
          file_url: string
          id?: string
          message?: string | null
          multi_doc_group_id?: string | null
          original_filename: string
          practice_id?: string | null
          revoked_at?: string | null
          sender_email?: string | null
          sender_id: string
          sender_name?: string | null
          signature_placement?: Json | null
          signed_file_url?: string | null
          status?: string | null
          title: string
        }
        Update: {
          auto_send_on_completion?: boolean
          batch_id?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          file_hash?: string
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          message?: string | null
          multi_doc_group_id?: string | null
          original_filename?: string
          practice_id?: string | null
          revoked_at?: string | null
          sender_email?: string | null
          sender_id?: string
          sender_name?: string | null
          signature_placement?: Json | null
          signed_file_url?: string | null
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      approval_signatories: {
        Row: {
          approval_token: string | null
          created_at: string | null
          decline_comment: string | null
          document_id: string
          email: string
          group_token: string | null
          id: string
          last_reminder_at: string | null
          name: string
          organisation: string | null
          organisation_type: string | null
          reminder_count: number | null
          role: string | null
          signatory_title: string | null
          signature_font: string | null
          signed_at: string | null
          signed_ip: string | null
          signed_name: string | null
          signed_organisation: string | null
          signed_role: string | null
          signed_user_agent: string | null
          sort_order: number | null
          status: string | null
          viewed_at: string | null
        }
        Insert: {
          approval_token?: string | null
          created_at?: string | null
          decline_comment?: string | null
          document_id: string
          email: string
          group_token?: string | null
          id?: string
          last_reminder_at?: string | null
          name: string
          organisation?: string | null
          organisation_type?: string | null
          reminder_count?: number | null
          role?: string | null
          signatory_title?: string | null
          signature_font?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          signed_name?: string | null
          signed_organisation?: string | null
          signed_role?: string | null
          signed_user_agent?: string | null
          sort_order?: number | null
          status?: string | null
          viewed_at?: string | null
        }
        Update: {
          approval_token?: string | null
          created_at?: string | null
          decline_comment?: string | null
          document_id?: string
          email?: string
          group_token?: string | null
          id?: string
          last_reminder_at?: string | null
          name?: string
          organisation?: string | null
          organisation_type?: string | null
          reminder_count?: number | null
          role?: string | null
          signatory_title?: string | null
          signature_font?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          signed_name?: string | null
          signed_organisation?: string | null
          signed_role?: string | null
          signed_user_agent?: string | null
          sort_order?: number | null
          status?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_signatories_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "approval_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      assembly_transcripts: {
        Row: {
          chunk_index: number
          confidence: number | null
          created_at: string
          id: string
          is_final: boolean | null
          meeting_id: string
          session_id: string
          timestamp_ms: number | null
          transcript_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chunk_index: number
          confidence?: number | null
          created_at?: string
          id?: string
          is_final?: boolean | null
          meeting_id: string
          session_id: string
          timestamp_ms?: number | null
          transcript_text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chunk_index?: number
          confidence?: number | null
          created_at?: string
          id?: string
          is_final?: boolean | null
          meeting_id?: string
          session_id?: string
          timestamp_ms?: number | null
          transcript_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assemblyai_session_diagnostics: {
        Row: {
          audio_frames_sent: number | null
          created_at: string
          details: Json | null
          event_type: string
          final_count: number | null
          id: string
          meeting_id: string | null
          partial_count: number | null
          reconnect_attempt: number | null
          session_id: string | null
          total_messages: number | null
          user_id: string | null
          ws_close_code: number | null
          ws_close_reason: string | null
        }
        Insert: {
          audio_frames_sent?: number | null
          created_at?: string
          details?: Json | null
          event_type: string
          final_count?: number | null
          id?: string
          meeting_id?: string | null
          partial_count?: number | null
          reconnect_attempt?: number | null
          session_id?: string | null
          total_messages?: number | null
          user_id?: string | null
          ws_close_code?: number | null
          ws_close_reason?: string | null
        }
        Update: {
          audio_frames_sent?: number | null
          created_at?: string
          details?: Json | null
          event_type?: string
          final_count?: number | null
          id?: string
          meeting_id?: string | null
          partial_count?: number | null
          reconnect_attempt?: number | null
          session_id?: string | null
          total_messages?: number | null
          user_id?: string | null
          ws_close_code?: number | null
          ws_close_reason?: string | null
        }
        Relationships: []
      }
      attendee_template_members: {
        Row: {
          attendee_id: string
          created_at: string | null
          id: string
          template_id: string
        }
        Insert: {
          attendee_id: string
          created_at?: string | null
          id?: string
          template_id: string
        }
        Update: {
          attendee_id?: string
          created_at?: string | null
          id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendee_template_members_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendee_template_members_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "attendee_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      attendee_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_default: boolean | null
          practice_id: string | null
          template_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          practice_id?: string | null
          template_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          practice_id?: string | null
          template_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendee_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_details"
            referencedColumns: ["id"]
          },
        ]
      }
      attendees: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_default: boolean | null
          name: string
          organization: string | null
          organization_type: string | null
          practice_id: string | null
          role: string | null
          scope: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          organization?: string | null
          organization_type?: string | null
          practice_id?: string | null
          role?: string | null
          scope?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          organization?: string | null
          organization_type?: string | null
          practice_id?: string | null
          role?: string | null
          scope?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendees_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_chunks: {
        Row: {
          audio_blob_path: string | null
          chunk_duration_ms: number | null
          chunk_number: number
          compression_ratio: number | null
          created_at: string | null
          end_time: string
          file_size: number | null
          id: string
          meeting_id: string | null
          original_file_size: number | null
          processing_status: string | null
          start_time: string
          transcoded_file_size: number | null
        }
        Insert: {
          audio_blob_path?: string | null
          chunk_duration_ms?: number | null
          chunk_number: number
          compression_ratio?: number | null
          created_at?: string | null
          end_time: string
          file_size?: number | null
          id?: string
          meeting_id?: string | null
          original_file_size?: number | null
          processing_status?: string | null
          start_time: string
          transcoded_file_size?: number | null
        }
        Update: {
          audio_blob_path?: string | null
          chunk_duration_ms?: number | null
          chunk_number?: number
          compression_ratio?: number | null
          created_at?: string | null
          end_time?: string
          file_size?: number | null
          id?: string
          meeting_id?: string | null
          original_file_size?: number | null
          processing_status?: string | null
          start_time?: string
          transcoded_file_size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_chunks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_import_sessions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          is_active: boolean | null
          session_token: string
          short_code: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          is_active?: boolean | null
          session_token?: string
          short_code: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          session_token?: string
          short_code?: string
          user_id?: string
        }
        Relationships: []
      }
      audio_import_uploads: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          session_id: string
          storage_path: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          session_id: string
          storage_path?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          session_id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_import_uploads_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "audio_import_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_overview_sessions: {
        Row: {
          audio_url: string | null
          created_at: string
          custom_directions: string | null
          duration_seconds: number | null
          edited_script: string | null
          id: string
          original_script: string
          pronunciation_rules: Json | null
          script_style: string | null
          source_documents: Json | null
          target_duration_minutes: number | null
          title: string
          updated_at: string
          user_id: string
          voice_id: string
          voice_name: string
          word_count: number
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          custom_directions?: string | null
          duration_seconds?: number | null
          edited_script?: string | null
          id?: string
          original_script: string
          pronunciation_rules?: Json | null
          script_style?: string | null
          source_documents?: Json | null
          target_duration_minutes?: number | null
          title: string
          updated_at?: string
          user_id: string
          voice_id: string
          voice_name: string
          word_count: number
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          custom_directions?: string | null
          duration_seconds?: number | null
          edited_script?: string | null
          id?: string
          original_script?: string
          pronunciation_rules?: Json | null
          script_style?: string | null
          source_documents?: Json | null
          target_duration_minutes?: number | null
          title?: string
          updated_at?: string
          user_id?: string
          voice_id?: string
          voice_name?: string
          word_count?: number
        }
        Relationships: []
      }
      audio_sessions: {
        Row: {
          created_at: string | null
          id: string
          meeting_id: string | null
          session_end: string | null
          session_start: string | null
          status: string | null
          total_chunks: number | null
          total_duration_seconds: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          meeting_id?: string | null
          session_end?: string | null
          session_start?: string | null
          status?: string | null
          total_chunks?: number | null
          total_duration_seconds?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          meeting_id?: string | null
          session_end?: string | null
          session_start?: string | null
          status?: string | null
          total_chunks?: number | null
          total_duration_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_sessions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_holidays_closed_days: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          hours_to_replace: number | null
          id: string
          is_replacement_required: boolean
          name: string
          notes: string | null
          replacement_completed: boolean
          replacement_deadline: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          hours_to_replace?: number | null
          id?: string
          is_replacement_required?: boolean
          name: string
          notes?: string | null
          replacement_completed?: boolean
          replacement_deadline?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          hours_to_replace?: number | null
          id?: string
          is_replacement_required?: boolean
          name?: string
          notes?: string | null
          replacement_completed?: boolean
          replacement_deadline?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      bp_sessions: {
        Row: {
          avg_diastolic: number | null
          avg_pulse: number | null
          avg_systolic: number | null
          created_at: string
          data_quality: Json | null
          date_range: Json | null
          diastolic_max: number | null
          diastolic_min: number | null
          excluded_count: number
          id: string
          included_count: number
          mode: string
          nhs_category: string | null
          nice_category: string | null
          nice_diastolic: number | null
          nice_systolic: number | null
          qof_relevance: Json | null
          readings: Json
          readings_count: number
          sit_stand_averages: Json | null
          source_files_count: number | null
          source_text: string | null
          systolic_max: number | null
          systolic_min: number | null
          trends: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_diastolic?: number | null
          avg_pulse?: number | null
          avg_systolic?: number | null
          created_at?: string
          data_quality?: Json | null
          date_range?: Json | null
          diastolic_max?: number | null
          diastolic_min?: number | null
          excluded_count?: number
          id?: string
          included_count?: number
          mode?: string
          nhs_category?: string | null
          nice_category?: string | null
          nice_diastolic?: number | null
          nice_systolic?: number | null
          qof_relevance?: Json | null
          readings: Json
          readings_count?: number
          sit_stand_averages?: Json | null
          source_files_count?: number | null
          source_text?: string | null
          systolic_max?: number | null
          systolic_min?: number | null
          trends?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_diastolic?: number | null
          avg_pulse?: number | null
          avg_systolic?: number | null
          created_at?: string
          data_quality?: Json | null
          date_range?: Json | null
          diastolic_max?: number | null
          diastolic_min?: number | null
          excluded_count?: number
          id?: string
          included_count?: number
          mode?: string
          nhs_category?: string | null
          nice_category?: string | null
          nice_diastolic?: number | null
          nice_systolic?: number | null
          qof_relevance?: Json | null
          readings?: Json
          readings_count?: number
          sit_stand_averages?: Json | null
          source_files_count?: number | null
          source_text?: string | null
          systolic_max?: number | null
          systolic_min?: number | null
          trends?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chunk_cleaning_stats: {
        Row: {
          active_meetings_monitored: number | null
          average_cleaning_time_ms: number | null
          background_chunks_processed: number | null
          created_at: string | null
          date: string
          failed_chunks: number | null
          id: string
          realtime_chunks_processed: number | null
          total_chunks_processed: number | null
          total_processing_time_ms: number | null
          updated_at: string | null
        }
        Insert: {
          active_meetings_monitored?: number | null
          average_cleaning_time_ms?: number | null
          background_chunks_processed?: number | null
          created_at?: string | null
          date?: string
          failed_chunks?: number | null
          id?: string
          realtime_chunks_processed?: number | null
          total_chunks_processed?: number | null
          total_processing_time_ms?: number | null
          updated_at?: string | null
        }
        Update: {
          active_meetings_monitored?: number | null
          average_cleaning_time_ms?: number | null
          background_chunks_processed?: number | null
          created_at?: string | null
          date?: string
          failed_chunks?: number | null
          id?: string
          realtime_chunks_processed?: number | null
          total_chunks_processed?: number | null
          total_processing_time_ms?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      claim_audit_log: {
        Row: {
          action: string
          claim_line_id: string
          created_at: string
          from_status: string | null
          id: string
          notes: string | null
          on_behalf_of: string | null
          performed_by: string | null
          performed_by_name: string | null
          performed_by_role: string | null
          to_status: string | null
        }
        Insert: {
          action: string
          claim_line_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          on_behalf_of?: string | null
          performed_by?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
          to_status?: string | null
        }
        Update: {
          action?: string
          claim_line_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          on_behalf_of?: string | null
          performed_by?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_audit_log_claim_line_id_fkey"
            columns: ["claim_line_id"]
            isOneToOne: false
            referencedRelation: "claim_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_evidence: {
        Row: {
          claim_line_id: string
          file_name: string
          file_path: string
          file_type: string | null
          id: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          claim_line_id: string
          file_name: string
          file_path: string
          file_type?: string | null
          id?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          claim_line_id?: string
          file_name?: string
          file_path?: string
          file_type?: string | null
          id?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_evidence_claim_line_id_fkey"
            columns: ["claim_line_id"]
            isOneToOne: false
            referencedRelation: "claim_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_lines: {
        Row: {
          allocation: string | null
          approved_at: string | null
          approved_by: string | null
          category: string
          claim_month: string
          claim_ref: string | null
          claimed_amount: number | null
          created_at: string
          declaration_text: string | null
          declared_at: string | null
          declared_by: string | null
          gl_code: string | null
          id: string
          invoice_created_at: string | null
          invoice_created_by: string | null
          max_rate: number | null
          on_behalf_of: string | null
          paid_at: string | null
          paid_by: string | null
          practice_id: string
          queried_at: string | null
          queried_by: string | null
          query_flagged_lines: Json | null
          query_note: string | null
          role: string
          scheduled_at: string | null
          scheduled_by: string | null
          staff_member: string
          start_date: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          allocation?: string | null
          approved_at?: string | null
          approved_by?: string | null
          category: string
          claim_month: string
          claim_ref?: string | null
          claimed_amount?: number | null
          created_at?: string
          declaration_text?: string | null
          declared_at?: string | null
          declared_by?: string | null
          gl_code?: string | null
          id?: string
          invoice_created_at?: string | null
          invoice_created_by?: string | null
          max_rate?: number | null
          on_behalf_of?: string | null
          paid_at?: string | null
          paid_by?: string | null
          practice_id: string
          queried_at?: string | null
          queried_by?: string | null
          query_flagged_lines?: Json | null
          query_note?: string | null
          role: string
          scheduled_at?: string | null
          scheduled_by?: string | null
          staff_member: string
          start_date?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          allocation?: string | null
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          claim_month?: string
          claim_ref?: string | null
          claimed_amount?: number | null
          created_at?: string
          declaration_text?: string | null
          declared_at?: string | null
          declared_by?: string | null
          gl_code?: string | null
          id?: string
          invoice_created_at?: string | null
          invoice_created_by?: string | null
          max_rate?: number | null
          on_behalf_of?: string | null
          paid_at?: string | null
          paid_by?: string | null
          practice_id?: string
          queried_at?: string | null
          queried_by?: string | null
          query_flagged_lines?: Json | null
          query_note?: string | null
          role?: string
          scheduled_at?: string | null
          scheduled_by?: string | null
          staff_member?: string
          start_date?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_lines_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_verification_tests: {
        Row: {
          batch_id: string
          completed_tests: number
          created_at: string
          failed_tests: number
          id: string
          test_results: Json
          total_tests: number
          updated_at: string
        }
        Insert: {
          batch_id: string
          completed_tests: number
          created_at?: string
          failed_tests: number
          id?: string
          test_results: Json
          total_tests: number
          updated_at?: string
        }
        Update: {
          batch_id?: string
          completed_tests?: number
          created_at?: string
          failed_tests?: number
          id?: string
          test_results?: Json
          total_tests?: number
          updated_at?: string
        }
        Relationships: []
      }
      communication_files: {
        Row: {
          communication_id: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          uploaded_at: string | null
        }
        Insert: {
          communication_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_at?: string | null
        }
        Update: {
          communication_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_files_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "communications"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          context_notes: string | null
          created_at: string
          data_retention_date: string | null
          draft_text: string | null
          email_text: string | null
          generated_reply: string | null
          id: string
          mode: Database["public"]["Enums"]["communication_mode"] | null
          reply_length: number | null
          response_guidance: string | null
          tone: Database["public"]["Enums"]["communication_tone"] | null
          updated_at: string
          uploaded_files: Json | null
          user_id: string
        }
        Insert: {
          context_notes?: string | null
          created_at?: string
          data_retention_date?: string | null
          draft_text?: string | null
          email_text?: string | null
          generated_reply?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["communication_mode"] | null
          reply_length?: number | null
          response_guidance?: string | null
          tone?: Database["public"]["Enums"]["communication_tone"] | null
          updated_at?: string
          uploaded_files?: Json | null
          user_id: string
        }
        Update: {
          context_notes?: string | null
          created_at?: string
          data_retention_date?: string | null
          draft_text?: string | null
          email_text?: string | null
          generated_reply?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["communication_mode"] | null
          reply_length?: number | null
          response_guidance?: string | null
          tone?: Database["public"]["Enums"]["communication_tone"] | null
          updated_at?: string
          uploaded_files?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      complaint_acknowledgements: {
        Row: {
          acknowledgement_letter: string
          complaint_id: string
          created_at: string | null
          id: string
          sent_at: string | null
          sent_by: string | null
        }
        Insert: {
          acknowledgement_letter: string
          complaint_id: string
          created_at?: string | null
          id?: string
          sent_at?: string | null
          sent_by?: string | null
        }
        Update: {
          acknowledgement_letter?: string
          complaint_id?: string
          created_at?: string | null
          id?: string
          sent_at?: string | null
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_acknowledgements_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_audio_overviews: {
        Row: {
          audio_overview_duration: number | null
          audio_overview_text: string | null
          audio_overview_url: string | null
          complaint_id: string
          created_at: string
          created_by: string | null
          id: string
          infographic_url: string | null
          powerpoint_download_url: string | null
          powerpoint_gamma_url: string | null
          powerpoint_slide_count: number | null
          powerpoint_thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          audio_overview_duration?: number | null
          audio_overview_text?: string | null
          audio_overview_url?: string | null
          complaint_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          infographic_url?: string | null
          powerpoint_download_url?: string | null
          powerpoint_gamma_url?: string | null
          powerpoint_slide_count?: number | null
          powerpoint_thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          audio_overview_duration?: number | null
          audio_overview_text?: string | null
          audio_overview_url?: string | null
          complaint_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          infographic_url?: string | null
          powerpoint_download_url?: string | null
          powerpoint_gamma_url?: string | null
          powerpoint_slide_count?: number | null
          powerpoint_thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_audio_overviews_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: true
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_audit_detailed: {
        Row: {
          action_description: string
          action_type: string
          browser_name: string | null
          browser_version: string | null
          complaint_id: string | null
          created_at: string
          device_fingerprint: string | null
          device_type: string | null
          geographic_location: string | null
          id: string
          ip_address: string | null
          language: string | null
          new_values: Json | null
          old_values: Json | null
          os_name: string | null
          os_version: string | null
          referrer: string | null
          screen_resolution: string | null
          session_id: string | null
          timezone: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action_description: string
          action_type: string
          browser_name?: string | null
          browser_version?: string | null
          complaint_id?: string | null
          created_at?: string
          device_fingerprint?: string | null
          device_type?: string | null
          geographic_location?: string | null
          id?: string
          ip_address?: string | null
          language?: string | null
          new_values?: Json | null
          old_values?: Json | null
          os_name?: string | null
          os_version?: string | null
          referrer?: string | null
          screen_resolution?: string | null
          session_id?: string | null
          timezone?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action_description?: string
          action_type?: string
          browser_name?: string | null
          browser_version?: string | null
          complaint_id?: string | null
          created_at?: string
          device_fingerprint?: string | null
          device_type?: string | null
          geographic_location?: string | null
          id?: string
          ip_address?: string | null
          language?: string | null
          new_values?: Json | null
          old_values?: Json | null
          os_name?: string | null
          os_version?: string | null
          referrer?: string | null
          screen_resolution?: string | null
          session_id?: string | null
          timezone?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_audit_detailed_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_audit_log: {
        Row: {
          action: string
          complaint_id: string | null
          details: Json | null
          id: string
          performed_at: string | null
          performed_by: string
        }
        Insert: {
          action: string
          complaint_id?: string | null
          details?: Json | null
          id?: string
          performed_at?: string | null
          performed_by?: string
        }
        Update: {
          action?: string
          complaint_id?: string | null
          details?: Json | null
          id?: string
          performed_at?: string | null
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_audit_log_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_capture_sessions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          is_active: boolean | null
          session_token: string
          short_code: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          session_token: string
          short_code?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          session_token?: string
          short_code?: string | null
          user_id?: string
        }
        Relationships: []
      }
      complaint_captured_images: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          ocr_text: string | null
          processed: boolean | null
          session_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          ocr_text?: string | null
          processed?: boolean | null
          session_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          ocr_text?: string | null
          processed?: boolean | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_captured_images_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "complaint_capture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_compliance_audit: {
        Row: {
          complaint_id: string | null
          compliance_check_id: string | null
          compliance_item: string
          created_at: string
          id: string
          new_status: boolean
          notes: string | null
          previous_status: boolean
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          complaint_id?: string | null
          compliance_check_id?: string | null
          compliance_item: string
          created_at?: string
          id?: string
          new_status: boolean
          notes?: string | null
          previous_status: boolean
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          complaint_id?: string | null
          compliance_check_id?: string | null
          compliance_item?: string
          created_at?: string
          id?: string
          new_status?: boolean
          notes?: string | null
          previous_status?: boolean
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_compliance_audit_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaint_compliance_audit_compliance_check_id_fkey"
            columns: ["compliance_check_id"]
            isOneToOne: false
            referencedRelation: "complaint_compliance_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_compliance_checks: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          complaint_id: string
          compliance_item: string
          created_at: string | null
          evidence: string | null
          id: string
          is_compliant: boolean
          notes: string | null
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          complaint_id: string
          compliance_item: string
          created_at?: string | null
          evidence?: string | null
          id?: string
          is_compliant?: boolean
          notes?: string | null
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          complaint_id?: string
          compliance_item?: string
          created_at?: string | null
          evidence?: string | null
          id?: string
          is_compliant?: boolean
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_compliance_checks_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_demo_responses: {
        Row: {
          actions_taken: string
          additional_context: string
          complaint_reference: string
          created_at: string | null
          id: string
          improvements_made: string
          key_findings: string
        }
        Insert: {
          actions_taken: string
          additional_context: string
          complaint_reference: string
          created_at?: string | null
          id?: string
          improvements_made: string
          key_findings: string
        }
        Update: {
          actions_taken?: string
          additional_context?: string
          complaint_reference?: string
          created_at?: string | null
          id?: string
          improvements_made?: string
          key_findings?: string
        }
        Relationships: []
      }
      complaint_documents: {
        Row: {
          complaint_id: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          uploaded_at: string | null
          uploaded_by: string
        }
        Insert: {
          complaint_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_at?: string | null
          uploaded_by: string
        }
        Update: {
          complaint_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_documents_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_indemnity_considerations: {
        Row: {
          complaint_id: string
          consideration_status: string
          id: string
          is_locked: boolean
          notes: string | null
          provider_name: string | null
          selected_at: string
          selected_by: string
          updated_at: string
        }
        Insert: {
          complaint_id: string
          consideration_status: string
          id?: string
          is_locked?: boolean
          notes?: string | null
          provider_name?: string | null
          selected_at?: string
          selected_by: string
          updated_at?: string
        }
        Update: {
          complaint_id?: string
          consideration_status?: string
          id?: string
          is_locked?: boolean
          notes?: string | null
          provider_name?: string | null
          selected_at?: string
          selected_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_indemnity_considerations_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: true
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_investigation_decisions: {
        Row: {
          complaint_id: string
          corrective_actions: string | null
          created_at: string
          decided_at: string
          decided_by: string
          decision_reasoning: string
          decision_type: string
          id: string
          lessons_learned: string | null
          updated_at: string
        }
        Insert: {
          complaint_id: string
          corrective_actions?: string | null
          created_at?: string
          decided_at?: string
          decided_by: string
          decision_reasoning: string
          decision_type: string
          id?: string
          lessons_learned?: string | null
          updated_at?: string
        }
        Update: {
          complaint_id?: string
          corrective_actions?: string | null
          created_at?: string
          decided_at?: string
          decided_by?: string
          decision_reasoning?: string
          decision_type?: string
          id?: string
          lessons_learned?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      complaint_investigation_evidence: {
        Row: {
          ai_summary: string | null
          complaint_id: string
          description: string | null
          evidence_type: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          ai_summary?: string | null
          complaint_id: string
          description?: string | null
          evidence_type: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          ai_summary?: string | null
          complaint_id?: string
          description?: string | null
          evidence_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_investigation_evidence_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_investigation_findings: {
        Row: {
          complaint_id: string
          created_at: string
          critical_friend_review: string | null
          critical_friend_review_generated_at: string | null
          evidence_notes: string | null
          findings_text: string
          id: string
          investigated_by: string
          investigation_date: string
          investigation_summary: string
          updated_at: string
        }
        Insert: {
          complaint_id: string
          created_at?: string
          critical_friend_review?: string | null
          critical_friend_review_generated_at?: string | null
          evidence_notes?: string | null
          findings_text: string
          id?: string
          investigated_by: string
          investigation_date?: string
          investigation_summary: string
          updated_at?: string
        }
        Update: {
          complaint_id?: string
          created_at?: string
          critical_friend_review?: string | null
          critical_friend_review_generated_at?: string | null
          evidence_notes?: string | null
          findings_text?: string
          id?: string
          investigated_by?: string
          investigation_date?: string
          investigation_summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      complaint_investigation_transcripts: {
        Row: {
          audio_duration_seconds: number | null
          audio_file_id: string | null
          complaint_id: string
          created_at: string
          id: string
          transcribed_at: string
          transcribed_by: string
          transcript_text: string
          transcription_confidence: number | null
        }
        Insert: {
          audio_duration_seconds?: number | null
          audio_file_id?: string | null
          complaint_id: string
          created_at?: string
          id?: string
          transcribed_at?: string
          transcribed_by: string
          transcript_text: string
          transcription_confidence?: number | null
        }
        Update: {
          audio_duration_seconds?: number | null
          audio_file_id?: string | null
          complaint_id?: string
          created_at?: string
          id?: string
          transcribed_at?: string
          transcribed_by?: string
          transcript_text?: string
          transcription_confidence?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_investigation_transcripts_audio_file_id_fkey"
            columns: ["audio_file_id"]
            isOneToOne: false
            referencedRelation: "complaint_investigation_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_involved_parties: {
        Row: {
          access_token: string | null
          access_token_expires_at: string
          access_token_last_used_at: string | null
          complaint_id: string
          created_at: string | null
          id: string
          response_requested_at: string | null
          response_submitted_at: string | null
          response_text: string | null
          staff_email: string
          staff_name: string
          staff_role: string | null
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string
          access_token_last_used_at?: string | null
          complaint_id: string
          created_at?: string | null
          id?: string
          response_requested_at?: string | null
          response_submitted_at?: string | null
          response_text?: string | null
          staff_email: string
          staff_name: string
          staff_role?: string | null
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string
          access_token_last_used_at?: string | null
          complaint_id?: string
          created_at?: string | null
          id?: string
          response_requested_at?: string | null
          response_submitted_at?: string | null
          response_text?: string | null
          staff_email?: string
          staff_name?: string
          staff_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_involved_parties_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_notes: {
        Row: {
          complaint_id: string
          created_at: string | null
          created_by: string
          id: string
          is_internal: boolean | null
          note: string
        }
        Insert: {
          complaint_id: string
          created_at?: string | null
          created_by: string
          id?: string
          is_internal?: boolean | null
          note: string
        }
        Update: {
          complaint_id?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_internal?: boolean | null
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_notes_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_outcome_questionnaires: {
        Row: {
          complaint_id: string
          created_at: string
          created_by: string
          id: string
          questionnaire_data: Json
          updated_at: string
        }
        Insert: {
          complaint_id: string
          created_at?: string
          created_by: string
          id?: string
          questionnaire_data?: Json
          updated_at?: string
        }
        Update: {
          complaint_id?: string
          created_at?: string
          created_by?: string
          id?: string
          questionnaire_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_outcome_questionnaires_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_outcomes: {
        Row: {
          complaint_id: string
          created_at: string | null
          decided_at: string | null
          decided_by: string | null
          id: string
          letter_style: string | null
          outcome_letter: string
          outcome_summary: string
          outcome_type: string
          sent_at: string | null
          sent_by: string | null
        }
        Insert: {
          complaint_id: string
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          letter_style?: string | null
          outcome_letter: string
          outcome_summary: string
          outcome_type: string
          sent_at?: string | null
          sent_by?: string | null
        }
        Update: {
          complaint_id?: string
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          letter_style?: string | null
          outcome_letter?: string
          outcome_summary?: string
          outcome_type?: string
          sent_at?: string | null
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_outcomes_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_responses: {
        Row: {
          complaint_id: string
          content: string
          created_at: string | null
          id: string
          is_template: boolean | null
          response_type: string
          sent_at: string | null
          sent_by: string | null
          subject: string | null
        }
        Insert: {
          complaint_id: string
          content: string
          created_at?: string | null
          id?: string
          is_template?: boolean | null
          response_type: string
          sent_at?: string | null
          sent_by?: string | null
          subject?: string | null
        }
        Update: {
          complaint_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_template?: boolean | null
          response_type?: string
          sent_at?: string | null
          sent_by?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_responses_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_review_conversations: {
        Row: {
          challenges_identified: Json | null
          complaint_id: string
          conversation_duration: number | null
          conversation_ended_at: string | null
          conversation_started_at: string | null
          conversation_summary: string | null
          conversation_transcript: string | null
          created_at: string | null
          created_by: string | null
          id: string
          recommendations: Json | null
          responses_given: Json | null
          updated_at: string | null
        }
        Insert: {
          challenges_identified?: Json | null
          complaint_id: string
          conversation_duration?: number | null
          conversation_ended_at?: string | null
          conversation_started_at?: string | null
          conversation_summary?: string | null
          conversation_transcript?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          recommendations?: Json | null
          responses_given?: Json | null
          updated_at?: string | null
        }
        Update: {
          challenges_identified?: Json | null
          complaint_id?: string
          conversation_duration?: number | null
          conversation_ended_at?: string | null
          conversation_started_at?: string | null
          conversation_summary?: string | null
          conversation_transcript?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          recommendations?: Json | null
          responses_given?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_review_conversations_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_signatures: {
        Row: {
          created_at: string
          email: string
          id: string
          is_default: boolean
          job_title: string
          name: string
          phone: string | null
          practice_id: string | null
          qualifications: string | null
          signature_image_url: string | null
          signature_text: string | null
          updated_at: string
          use_for_acknowledgements: boolean
          use_for_outcome_letters: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_default?: boolean
          job_title: string
          name: string
          phone?: string | null
          practice_id?: string | null
          qualifications?: string | null
          signature_image_url?: string | null
          signature_text?: string | null
          updated_at?: string
          use_for_acknowledgements?: boolean
          use_for_outcome_letters?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_default?: boolean
          job_title?: string
          name?: string
          phone?: string | null
          practice_id?: string | null
          qualifications?: string | null
          signature_image_url?: string | null
          signature_text?: string | null
          updated_at?: string
          use_for_acknowledgements?: boolean
          use_for_outcome_letters?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_signatures_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_details"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_team_members: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          practice_id: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          practice_id?: string | null
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          practice_id?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_team_members_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_templates: {
        Row: {
          content: string
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean | null
          name: string
          subject: string | null
          template_type: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean | null
          name: string
          subject?: string | null
          template_type: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string | null
          template_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      complaints: {
        Row: {
          acknowledged_at: string | null
          assigned_to: string | null
          category: Database["public"]["Enums"]["complaint_category"]
          closed_at: string | null
          complaint_description: string
          complaint_on_behalf: boolean | null
          complaint_source: string | null
          complaint_title: string
          consent_details: string | null
          consent_given: boolean | null
          created_at: string | null
          created_by: string
          data_retention_date: string | null
          id: string
          incident_date: string
          location_service: string | null
          patient_address: string | null
          patient_contact_email: string | null
          patient_contact_phone: string | null
          patient_dob: string | null
          patient_name: string
          practice_id: string | null
          priority: Database["public"]["Enums"]["complaint_priority"]
          reference_number: string
          response_due_date: string | null
          staff_mentioned: string[] | null
          status: Database["public"]["Enums"]["complaint_status"]
          subcategory: string | null
          submitted_at: string | null
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          assigned_to?: string | null
          category: Database["public"]["Enums"]["complaint_category"]
          closed_at?: string | null
          complaint_description: string
          complaint_on_behalf?: boolean | null
          complaint_source?: string | null
          complaint_title: string
          consent_details?: string | null
          consent_given?: boolean | null
          created_at?: string | null
          created_by: string
          data_retention_date?: string | null
          id?: string
          incident_date: string
          location_service?: string | null
          patient_address?: string | null
          patient_contact_email?: string | null
          patient_contact_phone?: string | null
          patient_dob?: string | null
          patient_name: string
          practice_id?: string | null
          priority?: Database["public"]["Enums"]["complaint_priority"]
          reference_number: string
          response_due_date?: string | null
          staff_mentioned?: string[] | null
          status?: Database["public"]["Enums"]["complaint_status"]
          subcategory?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["complaint_category"]
          closed_at?: string | null
          complaint_description?: string
          complaint_on_behalf?: boolean | null
          complaint_source?: string | null
          complaint_title?: string
          consent_details?: string | null
          consent_given?: boolean | null
          created_at?: string | null
          created_by?: string
          data_retention_date?: string | null
          id?: string
          incident_date?: string
          location_service?: string | null
          patient_address?: string | null
          patient_contact_email?: string | null
          patient_contact_phone?: string | null
          patient_dob?: string | null
          patient_name?: string
          practice_id?: string | null
          priority?: Database["public"]["Enums"]["complaint_priority"]
          reference_number?: string
          response_due_date?: string | null
          staff_mentioned?: string[] | null
          status?: Database["public"]["Enums"]["complaint_status"]
          subcategory?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_complaints_practice"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      compliments: {
        Row: {
          category: string
          compliment_date: string
          compliment_description: string
          compliment_title: string
          created_at: string
          created_by: string
          id: string
          location_service: string | null
          notes: string | null
          patient_contact_email: string | null
          patient_contact_phone: string | null
          patient_name: string
          practice_id: string | null
          reference_number: string
          shared_at: string | null
          shared_with_staff: boolean
          source: string
          staff_mentioned: string[] | null
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          compliment_date?: string
          compliment_description: string
          compliment_title: string
          created_at?: string
          created_by: string
          id?: string
          location_service?: string | null
          notes?: string | null
          patient_contact_email?: string | null
          patient_contact_phone?: string | null
          patient_name: string
          practice_id?: string | null
          reference_number?: string
          shared_at?: string | null
          shared_with_staff?: boolean
          source?: string
          staff_mentioned?: string[] | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          compliment_date?: string
          compliment_description?: string
          compliment_title?: string
          created_at?: string
          created_by?: string
          id?: string
          location_service?: string | null
          notes?: string | null
          patient_contact_email?: string | null
          patient_contact_phone?: string | null
          patient_name?: string
          practice_id?: string | null
          reference_number?: string
          shared_at?: string | null
          shared_with_staff?: boolean
          source?: string
          staff_mentioned?: string[] | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_history: {
        Row: {
          created_at: string
          date: string
          id: string
          overview: string
          start_time: string
          status: string
          template: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id: string
          overview: string
          start_time: string
          status?: string
          template: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          overview?: string
          start_time?: string
          status?: string
          template?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consultation_notes: {
        Row: {
          confidence_score: number | null
          consultation_type: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: Json
          template_id: string | null
          transcript: Json | null
          updated_at: string | null
        }
        Insert: {
          confidence_score?: number | null
          consultation_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes: Json
          template_id?: string | null
          transcript?: Json | null
          updated_at?: string | null
        }
        Update: {
          confidence_score?: number | null
          consultation_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: Json
          template_id?: string | null
          transcript?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string
          default_role: string
          email: string | null
          id: number
          initials: string
          name: string
          org: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_role?: string
          email?: string | null
          id?: number
          initials: string
          name: string
          org?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_role?: string
          email?: string | null
          id?: number
          initials?: string
          name?: string
          org?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contractor_competencies: {
        Row: {
          competency_type: string
          contractor_id: string
          expiry_date: string | null
          extracted_at: string
          id: string
          issuing_body: string | null
          level: string | null
          name: string
          verified: boolean | null
        }
        Insert: {
          competency_type: string
          contractor_id: string
          expiry_date?: string | null
          extracted_at?: string
          id?: string
          issuing_body?: string | null
          level?: string | null
          name: string
          verified?: boolean | null
        }
        Update: {
          competency_type?: string
          contractor_id?: string
          expiry_date?: string | null
          extracted_at?: string
          id?: string
          issuing_body?: string | null
          level?: string | null
          name?: string
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_competencies_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_experience: {
        Row: {
          contractor_id: string
          description: string | null
          employer: string
          end_date: string | null
          extracted_at: string
          id: string
          is_current: boolean | null
          position: string | null
          start_date: string | null
        }
        Insert: {
          contractor_id: string
          description?: string | null
          employer: string
          end_date?: string | null
          extracted_at?: string
          id?: string
          is_current?: boolean | null
          position?: string | null
          start_date?: string | null
        }
        Update: {
          contractor_id?: string
          description?: string | null
          employer?: string
          end_date?: string | null
          extracted_at?: string
          id?: string
          is_current?: boolean | null
          position?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_experience_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_notes: {
        Row: {
          content: string
          contractor_id: string
          created_at: string
          id: string
          is_internal: boolean | null
          note_type: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          content: string
          contractor_id: string
          created_at?: string
          id?: string
          is_internal?: boolean | null
          note_type?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          content?: string
          contractor_id?: string
          created_at?: string
          id?: string
          is_internal?: boolean | null
          note_type?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_notes_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_recommendations: {
        Row: {
          contractor_id: string
          created_at: string
          description: string
          id: string
          priority: string | null
          recommendation_type: string
          status: string | null
          title: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          description: string
          id?: string
          priority?: string | null
          recommendation_type: string
          status?: string | null
          title: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string | null
          recommendation_type?: string
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_recommendations_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_resumes: {
        Row: {
          contractor_id: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          parsed_content: string | null
          processing_status: string | null
          raw_extracted_data: Json | null
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          contractor_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          parsed_content?: string | null
          processing_status?: string | null
          raw_extracted_data?: Json | null
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          contractor_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          parsed_content?: string | null
          processing_status?: string | null
          raw_extracted_data?: Json | null
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_resumes_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          ai_summary: string | null
          availability_date: string | null
          availability_score: number | null
          availability_status: string | null
          certification_score: number | null
          completeness_score: number | null
          created_at: string
          email: string | null
          experience_score: number | null
          id: string
          location: string | null
          name: string
          overall_score: number | null
          phone: string | null
          red_flags: string[] | null
          status: string | null
          trade: string
          updated_at: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          ai_summary?: string | null
          availability_date?: string | null
          availability_score?: number | null
          availability_status?: string | null
          certification_score?: number | null
          completeness_score?: number | null
          created_at?: string
          email?: string | null
          experience_score?: number | null
          id?: string
          location?: string | null
          name: string
          overall_score?: number | null
          phone?: string | null
          red_flags?: string[] | null
          status?: string | null
          trade: string
          updated_at?: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          ai_summary?: string | null
          availability_date?: string | null
          availability_score?: number | null
          availability_status?: string | null
          certification_score?: number | null
          completeness_score?: number | null
          created_at?: string
          email?: string | null
          experience_score?: number | null
          id?: string
          location?: string | null
          name?: string
          overall_score?: number | null
          phone?: string | null
          red_flags?: string[] | null
          status?: string | null
          trade?: string
          updated_at?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      cqc_ai_sessions: {
        Row: {
          created_at: string | null
          exported_at: string | null
          id: string
          messages: Json
          practice_id: string | null
          session_summary: string | null
          session_title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          exported_at?: string | null
          id?: string
          messages?: Json
          practice_id?: string | null
          session_summary?: string | null
          session_title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          exported_at?: string | null
          id?: string
          messages?: Json
          practice_id?: string | null
          session_summary?: string | null
          session_title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cqc_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          created_by: string | null
          due_date: string | null
          id: string
          message: string
          practice_id: string | null
          priority: string | null
          related_evidence_id: string | null
          related_policy_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          title: string
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          message: string
          practice_id?: string | null
          priority?: string | null
          related_evidence_id?: string | null
          related_policy_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          message?: string
          practice_id?: string | null
          priority?: string | null
          related_evidence_id?: string | null
          related_policy_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      cqc_assessments: {
        Row: {
          action_description: string | null
          action_due_date: string | null
          action_required: boolean | null
          answer: string | null
          assessment_date: string | null
          completed_at: string | null
          completed_by: string | null
          compliance_status: string | null
          cqc_domain: string | null
          created_at: string | null
          evidence_ids: string[] | null
          id: string
          kloe_reference: string
          notes: string | null
          practice_id: string | null
          question: string
          updated_at: string | null
        }
        Insert: {
          action_description?: string | null
          action_due_date?: string | null
          action_required?: boolean | null
          answer?: string | null
          assessment_date?: string | null
          completed_at?: string | null
          completed_by?: string | null
          compliance_status?: string | null
          cqc_domain?: string | null
          created_at?: string | null
          evidence_ids?: string[] | null
          id?: string
          kloe_reference: string
          notes?: string | null
          practice_id?: string | null
          question: string
          updated_at?: string | null
        }
        Update: {
          action_description?: string | null
          action_due_date?: string | null
          action_required?: boolean | null
          answer?: string | null
          assessment_date?: string | null
          completed_at?: string | null
          completed_by?: string | null
          compliance_status?: string | null
          cqc_domain?: string | null
          created_at?: string | null
          evidence_ids?: string[] | null
          id?: string
          kloe_reference?: string
          notes?: string | null
          practice_id?: string | null
          question?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cqc_domains: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          weight?: number | null
        }
        Relationships: []
      }
      cqc_evidence: {
        Row: {
          cqc_domain: string | null
          created_at: string | null
          description: string | null
          evidence_type: string
          expiry_date: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          kloe_reference: string | null
          practice_id: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          cqc_domain?: string | null
          created_at?: string | null
          description?: string | null
          evidence_type: string
          expiry_date?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          kloe_reference?: string | null
          practice_id?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          cqc_domain?: string | null
          created_at?: string | null
          description?: string | null
          evidence_type?: string
          expiry_date?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          kloe_reference?: string | null
          practice_id?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      cqc_guidance_updates: {
        Row: {
          ai_summary: string | null
          content: string | null
          cqc_domain: string | null
          created_at: string | null
          id: string
          impact_level: string | null
          published_date: string | null
          requires_policy_review: boolean | null
          source_url: string | null
          summary: string | null
          tags: string[] | null
          title: string
        }
        Insert: {
          ai_summary?: string | null
          content?: string | null
          cqc_domain?: string | null
          created_at?: string | null
          id?: string
          impact_level?: string | null
          published_date?: string | null
          requires_policy_review?: boolean | null
          source_url?: string | null
          summary?: string | null
          tags?: string[] | null
          title: string
        }
        Update: {
          ai_summary?: string | null
          content?: string | null
          cqc_domain?: string | null
          created_at?: string | null
          id?: string
          impact_level?: string | null
          published_date?: string | null
          requires_policy_review?: boolean | null
          source_url?: string | null
          summary?: string | null
          tags?: string[] | null
          title?: string
        }
        Relationships: []
      }
      cqc_policies: {
        Row: {
          ai_compliance_score: number | null
          ai_feedback: Json | null
          approved_at: string | null
          approved_by: string | null
          cqc_domain: string | null
          created_at: string | null
          description: string | null
          expiry_date: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          policy_type: string
          practice_id: string | null
          review_date: string | null
          status: string | null
          title: string
          updated_at: string | null
          uploaded_by: string | null
          version: string | null
        }
        Insert: {
          ai_compliance_score?: number | null
          ai_feedback?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          cqc_domain?: string | null
          created_at?: string | null
          description?: string | null
          expiry_date?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          policy_type: string
          practice_id?: string | null
          review_date?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          uploaded_by?: string | null
          version?: string | null
        }
        Update: {
          ai_compliance_score?: number | null
          ai_feedback?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          cqc_domain?: string | null
          created_at?: string | null
          description?: string | null
          expiry_date?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          policy_type?: string
          practice_id?: string | null
          review_date?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          uploaded_by?: string | null
          version?: string | null
        }
        Relationships: []
      }
      cqc_practice_settings: {
        Row: {
          created_at: string | null
          created_by: string | null
          current_rating: string | null
          email_alerts: boolean | null
          id: string
          last_inspection_date: string | null
          next_inspection_date: string | null
          notifications_enabled: boolean | null
          practice_id: string | null
          sms_alerts: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          current_rating?: string | null
          email_alerts?: boolean | null
          id?: string
          last_inspection_date?: string | null
          next_inspection_date?: string | null
          notifications_enabled?: boolean | null
          practice_id?: string | null
          sms_alerts?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          current_rating?: string | null
          email_alerts?: boolean | null
          id?: string
          last_inspection_date?: string | null
          next_inspection_date?: string | null
          notifications_enabled?: boolean | null
          practice_id?: string | null
          sms_alerts?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cso_assessments: {
        Row: {
          attempt_number: number
          completed_at: string
          created_at: string
          id: string
          passed: boolean
          percentage: number
          questions_answered: Json
          registration_id: string
          score: number
          started_at: string
          total_questions: number
        }
        Insert: {
          attempt_number: number
          completed_at?: string
          created_at?: string
          id?: string
          passed: boolean
          percentage: number
          questions_answered: Json
          registration_id: string
          score: number
          started_at?: string
          total_questions: number
        }
        Update: {
          attempt_number?: number
          completed_at?: string
          created_at?: string
          id?: string
          passed?: boolean
          percentage?: number
          questions_answered?: Json
          registration_id?: string
          score?: number
          started_at?: string
          total_questions?: number
        }
        Relationships: [
          {
            foreignKeyName: "cso_assessments_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "cso_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      cso_certificates: {
        Row: {
          assessment_id: string
          certificate_number: string
          created_at: string
          id: string
          issued_date: string
          pdf_url: string | null
          registration_id: string
        }
        Insert: {
          assessment_id: string
          certificate_number: string
          created_at?: string
          id?: string
          issued_date?: string
          pdf_url?: string | null
          registration_id: string
        }
        Update: {
          assessment_id?: string
          certificate_number?: string
          created_at?: string
          id?: string
          issued_date?: string
          pdf_url?: string | null
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cso_certificates_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "cso_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cso_certificates_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "cso_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      cso_registrations: {
        Row: {
          access_token: string
          created_at: string
          email: string
          full_name: string
          gmc_number: string
          id: string
          phone: string | null
          practice_address: string
          practice_name: string
          practice_postcode: string
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email: string
          full_name: string
          gmc_number: string
          id?: string
          phone?: string | null
          practice_address: string
          practice_name: string
          practice_postcode: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string
          full_name?: string
          gmc_number?: string
          id?: string
          phone?: string | null
          practice_address?: string
          practice_name?: string
          practice_postcode?: string
          updated_at?: string
        }
        Relationships: []
      }
      cso_training_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          module_id: string
          registration_id: string
          time_spent_seconds: number
          updated_at: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          module_id: string
          registration_id: string
          time_spent_seconds?: number
          updated_at?: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          module_id?: string
          registration_id?: string
          time_spent_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cso_training_progress_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "cso_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      curated_news_pages: {
        Row: {
          created_at: string
          digest_date: string | null
          generated_by: string | null
          html: string
          id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          digest_date?: string | null
          generated_by?: string | null
          html: string
          id?: string
          title?: string | null
        }
        Update: {
          created_at?: string
          digest_date?: string | null
          generated_by?: string | null
          html?: string
          id?: string
          title?: string | null
        }
        Relationships: []
      }
      data_retention_policies: {
        Row: {
          created_at: string
          description: string | null
          id: string
          legal_basis: string | null
          retention_period_days: number
          table_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          legal_basis?: string | null
          retention_period_days: number
          table_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          legal_basis?: string | null
          retention_period_days?: number
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      deepgram_transcriptions: {
        Row: {
          chunk_number: number
          confidence: number | null
          created_at: string
          id: string
          is_final: boolean | null
          meeting_id: string
          session_id: string
          transcription_text: string
          updated_at: string
          user_id: string
          word_count: number | null
        }
        Insert: {
          chunk_number: number
          confidence?: number | null
          created_at?: string
          id?: string
          is_final?: boolean | null
          meeting_id: string
          session_id: string
          transcription_text: string
          updated_at?: string
          user_id: string
          word_count?: number | null
        }
        Update: {
          chunk_number?: number
          confidence?: number | null
          created_at?: string
          id?: string
          is_final?: boolean | null
          meeting_id?: string
          session_id?: string
          transcription_text?: string
          updated_at?: string
          user_id?: string
          word_count?: number | null
        }
        Relationships: []
      }
      development_costs: {
        Row: {
          amount: number
          category: string
          cost_date: string
          cost_type: string
          created_at: string
          currency: string
          description: string | null
          file_name: string | null
          file_path: string | null
          fx_rate: number | null
          fx_rate_date: string | null
          gbp_amount: number | null
          hourly_rate: number | null
          hours: number | null
          id: string
          invoice_reference: string | null
          notes: string | null
          payment_method: string | null
          updated_at: string
          user_id: string
          vat_amount: number | null
          vat_included: boolean | null
          vendor: string | null
        }
        Insert: {
          amount: number
          category: string
          cost_date: string
          cost_type: string
          created_at?: string
          currency?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          fx_rate?: number | null
          fx_rate_date?: string | null
          gbp_amount?: number | null
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          invoice_reference?: string | null
          notes?: string | null
          payment_method?: string | null
          updated_at?: string
          user_id: string
          vat_amount?: number | null
          vat_included?: boolean | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          cost_date?: string
          cost_type?: string
          created_at?: string
          currency?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          fx_rate?: number | null
          fx_rate_date?: string | null
          gbp_amount?: number | null
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          invoice_reference?: string | null
          notes?: string | null
          payment_method?: string | null
          updated_at?: string
          user_id?: string
          vat_amount?: number | null
          vat_included?: boolean | null
          vendor?: string | null
        }
        Relationships: []
      }
      development_time_entries: {
        Row: {
          category: string
          charged_rate_gbp: number
          charged_value_gbp: number | null
          created_at: string
          hours: number
          id: string
          notes: string | null
          notional_value_gbp: number | null
          period_end: string
          period_start: string
          person_id: string | null
          person_name: string
          role: string | null
          shadow_rate_gbp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          charged_rate_gbp?: number
          charged_value_gbp?: number | null
          created_at?: string
          hours: number
          id?: string
          notes?: string | null
          notional_value_gbp?: number | null
          period_end: string
          period_start: string
          person_id?: string | null
          person_name: string
          role?: string | null
          shadow_rate_gbp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          charged_rate_gbp?: number
          charged_value_gbp?: number | null
          created_at?: string
          hours?: number
          id?: string
          notes?: string | null
          notional_value_gbp?: number | null
          period_end?: string
          period_start?: string
          person_id?: string | null
          person_name?: string
          role?: string | null
          shadow_rate_gbp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dictations: {
        Row: {
          content: string
          created_at: string | null
          duration_seconds: number | null
          id: string
          is_draft: boolean | null
          template_type: string | null
          title: string | null
          updated_at: string | null
          user_id: string
          word_count: number | null
        }
        Insert: {
          content?: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          is_draft?: boolean | null
          template_type?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
          word_count?: number | null
        }
        Update: {
          content?: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          is_draft?: boolean | null
          template_type?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
          word_count?: number | null
        }
        Relationships: []
      }
      distribution_list_members: {
        Row: {
          attendee_id: string
          created_at: string | null
          id: string
          list_id: string
        }
        Insert: {
          attendee_id: string
          created_at?: string | null
          id?: string
          list_id: string
        }
        Update: {
          attendee_id?: string
          created_at?: string | null
          id?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribution_list_members_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "distribution_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_lists: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          practice_id: string | null
          scope: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          practice_id?: string | null
          scope?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          practice_id?: string | null
          scope?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribution_lists_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_details"
            referencedColumns: ["id"]
          },
        ]
      }
      document_qa_sessions: {
        Row: {
          created_at: string
          document_names: string[] | null
          id: string
          messages: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_names?: string[] | null
          id?: string
          messages?: Json
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_names?: string[] | null
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_studio_documents: {
        Row: {
          clarifying_answers_json: Json | null
          content: string | null
          created_at: string | null
          document_type: string
          id: string
          inputs_json: Json | null
          practice_id: string | null
          status: string | null
          title: string
          updated_at: string | null
          uploaded_file_refs: Json | null
          user_id: string
          version: number | null
          version_label: string | null
        }
        Insert: {
          clarifying_answers_json?: Json | null
          content?: string | null
          created_at?: string | null
          document_type: string
          id?: string
          inputs_json?: Json | null
          practice_id?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          uploaded_file_refs?: Json | null
          user_id: string
          version?: number | null
          version_label?: string | null
        }
        Update: {
          clarifying_answers_json?: Json | null
          content?: string | null
          created_at?: string | null
          document_type?: string
          id?: string
          inputs_json?: Json | null
          practice_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          uploaded_file_refs?: Json | null
          user_id?: string
          version?: number | null
          version_label?: string | null
        }
        Relationships: []
      }
      document_studio_usage: {
        Row: {
          action: string
          created_at: string | null
          document_type: string
          document_type_name: string | null
          free_form_request: string | null
          id: string
          request_summary: string | null
          title: string | null
          user_id: string
          word_count: number | null
        }
        Insert: {
          action?: string
          created_at?: string | null
          document_type?: string
          document_type_name?: string | null
          free_form_request?: string | null
          id?: string
          request_summary?: string | null
          title?: string | null
          user_id: string
          word_count?: number | null
        }
        Update: {
          action?: string
          created_at?: string | null
          document_type?: string
          document_type_name?: string | null
          free_form_request?: string | null
          id?: string
          request_summary?: string | null
          title?: string | null
          user_id?: string
          word_count?: number | null
        }
        Relationships: []
      }
      domain_dictionary: {
        Row: {
          category: string
          correct_term: string
          created_at: string
          id: string
          wrong_term: string
        }
        Insert: {
          category?: string
          correct_term: string
          created_at?: string
          id?: string
          wrong_term: string
        }
        Update: {
          category?: string
          correct_term?: string
          created_at?: string
          id?: string
          wrong_term?: string
        }
        Relationships: []
      }
      dpia_practices: {
        Row: {
          cg_email: string | null
          cg_name: string | null
          cg_role: string | null
          completed_by: string | null
          completed_date: string | null
          completed_role: string | null
          created_at: string
          dpia_date: string | null
          dpia_generated: boolean | null
          dpia_html: string | null
          dpo_email: string | null
          dpo_name: string | null
          dpo_org: string | null
          dpo_tel: string | null
          dspt_status: string | null
          ico_reg: string | null
          id: string
          ods_code: string | null
          onboarded_at: string | null
          pm_email: string | null
          pm_name: string | null
          practice_address: string | null
          practice_name: string
          practice_tel: string | null
          source_file: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cg_email?: string | null
          cg_name?: string | null
          cg_role?: string | null
          completed_by?: string | null
          completed_date?: string | null
          completed_role?: string | null
          created_at?: string
          dpia_date?: string | null
          dpia_generated?: boolean | null
          dpia_html?: string | null
          dpo_email?: string | null
          dpo_name?: string | null
          dpo_org?: string | null
          dpo_tel?: string | null
          dspt_status?: string | null
          ico_reg?: string | null
          id?: string
          ods_code?: string | null
          onboarded_at?: string | null
          pm_email?: string | null
          pm_name?: string | null
          practice_address?: string | null
          practice_name: string
          practice_tel?: string | null
          source_file?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cg_email?: string | null
          cg_name?: string | null
          cg_role?: string | null
          completed_by?: string | null
          completed_date?: string | null
          completed_role?: string | null
          created_at?: string
          dpia_date?: string | null
          dpia_generated?: boolean | null
          dpia_html?: string | null
          dpo_email?: string | null
          dpo_name?: string | null
          dpo_org?: string | null
          dpo_tel?: string | null
          dspt_status?: string | null
          ico_reg?: string | null
          id?: string
          ods_code?: string | null
          onboarded_at?: string | null
          pm_email?: string | null
          pm_name?: string | null
          practice_address?: string | null
          practice_name?: string
          practice_tel?: string | null
          source_file?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      drug_synonyms: {
        Row: {
          created_at: string
          drug_name_norm: string
          synonym_norm: string
        }
        Insert: {
          created_at?: string
          drug_name_norm: string
          synonym_norm: string
        }
        Update: {
          created_at?: string
          drug_name_norm?: string
          synonym_norm?: string
        }
        Relationships: []
      }
      dtac_assessments: {
        Row: {
          clinical_safety: Json | null
          company_info: Json | null
          created_at: string
          data_protection: Json | null
          id: string
          interoperability: Json | null
          organisation_id: string | null
          status: string
          technical_security: Json | null
          updated_at: string
          usability_accessibility: Json | null
          user_id: string
          value_proposition: Json | null
          version: string | null
        }
        Insert: {
          clinical_safety?: Json | null
          company_info?: Json | null
          created_at?: string
          data_protection?: Json | null
          id?: string
          interoperability?: Json | null
          organisation_id?: string | null
          status?: string
          technical_security?: Json | null
          updated_at?: string
          usability_accessibility?: Json | null
          user_id: string
          value_proposition?: Json | null
          version?: string | null
        }
        Update: {
          clinical_safety?: Json | null
          company_info?: Json | null
          created_at?: string
          data_protection?: Json | null
          id?: string
          interoperability?: Json | null
          organisation_id?: string | null
          status?: string
          technical_security?: Json | null
          updated_at?: string
          usability_accessibility?: Json | null
          user_id?: string
          value_proposition?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dtac_assessments_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      dtac_evidence: {
        Row: {
          assessment_id: string
          file_name: string
          file_path: string
          file_type: string | null
          id: string
          question_code: string
          uploaded_at: string
        }
        Insert: {
          assessment_id: string
          file_name: string
          file_path: string
          file_type?: string | null
          id?: string
          question_code: string
          uploaded_at?: string
        }
        Update: {
          assessment_id?: string
          file_name?: string
          file_path?: string
          file_type?: string | null
          id?: string
          question_code?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dtac_evidence_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "dtac_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      enn_hub_practice_mappings: {
        Row: {
          created_at: string
          hub_id: string
          id: string
          practice_id: string
        }
        Insert: {
          created_at?: string
          hub_id: string
          id?: string
          practice_id: string
        }
        Update: {
          created_at?: string
          hub_id?: string
          id?: string
          practice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enn_hub_practice_mappings_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "enn_hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enn_hub_practice_mappings_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      enn_hubs: {
        Row: {
          annual_income: number
          created_at: string
          hub_list_size: number
          hub_name: string
          id: string
          practice_id: string
          weekly_appts_required: number
        }
        Insert: {
          annual_income?: number
          created_at?: string
          hub_list_size?: number
          hub_name: string
          id?: string
          practice_id: string
          weekly_appts_required?: number
        }
        Update: {
          annual_income?: number
          created_at?: string
          hub_list_size?: number
          hub_name?: string
          id?: string
          practice_id?: string
          weekly_appts_required?: number
        }
        Relationships: [
          {
            foreignKeyName: "enn_hubs_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      enn_insurance_checklist: {
        Row: {
          amount: string
          confirmed: boolean
          created_at: string
          id: string
          insurance_type: string
          practice_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: string
          confirmed?: boolean
          created_at?: string
          id?: string
          insurance_type: string
          practice_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: string
          confirmed?: boolean
          created_at?: string
          id?: string
          insurance_type?: string
          practice_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      enn_practice_data: {
        Row: {
          address: string | null
          annual_appts_required: number
          created_at: string
          id: string
          list_size: number
          non_winter_appts_required: number
          ods_code: string
          participating_winter: boolean
          practice_id: string
          weekly_appts_required: number
          weekly_non_winter_appts: number
          winter_appts_required: number
        }
        Insert: {
          address?: string | null
          annual_appts_required?: number
          created_at?: string
          id?: string
          list_size?: number
          non_winter_appts_required?: number
          ods_code: string
          participating_winter?: boolean
          practice_id: string
          weekly_appts_required?: number
          weekly_non_winter_appts?: number
          winter_appts_required?: number
        }
        Update: {
          address?: string | null
          annual_appts_required?: number
          created_at?: string
          id?: string
          list_size?: number
          non_winter_appts_required?: number
          ods_code?: string
          participating_winter?: boolean
          practice_id?: string
          weekly_appts_required?: number
          weekly_non_winter_appts?: number
          winter_appts_required?: number
        }
        Relationships: [
          {
            foreignKeyName: "enn_practice_data_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: true
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      fridge_status_changes: {
        Row: {
          changed_at: string
          changed_by: string
          fridge_id: string
          id: string
          new_status: boolean
          notes: string | null
          previous_status: boolean
        }
        Insert: {
          changed_at?: string
          changed_by: string
          fridge_id: string
          id?: string
          new_status: boolean
          notes?: string | null
          previous_status: boolean
        }
        Update: {
          changed_at?: string
          changed_by?: string
          fridge_id?: string
          id?: string
          new_status?: boolean
          notes?: string | null
          previous_status?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fridge_status_changes_fridge_id_fkey"
            columns: ["fridge_id"]
            isOneToOne: false
            referencedRelation: "practice_fridges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fridge_status_changes_fridge_id_fkey"
            columns: ["fridge_id"]
            isOneToOne: false
            referencedRelation: "public_fridge_qr_view"
            referencedColumns: ["id"]
          },
        ]
      }
      fridge_temperature_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          fridge_id: string
          id: string
          message: string
          reading_id: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          fridge_id: string
          id?: string
          message: string
          reading_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          fridge_id?: string
          id?: string
          message?: string
          reading_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "fridge_temperature_alerts_fridge_id_fkey"
            columns: ["fridge_id"]
            isOneToOne: false
            referencedRelation: "practice_fridges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fridge_temperature_alerts_fridge_id_fkey"
            columns: ["fridge_id"]
            isOneToOne: false
            referencedRelation: "public_fridge_qr_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fridge_temperature_alerts_reading_id_fkey"
            columns: ["reading_id"]
            isOneToOne: false
            referencedRelation: "fridge_temperature_readings"
            referencedColumns: ["id"]
          },
        ]
      }
      fridge_temperature_readings: {
        Row: {
          created_at: string
          fridge_id: string
          id: string
          is_within_range: boolean
          notes: string | null
          recorded_at: string
          recorded_by: string | null
          recorded_by_initials: string | null
          temperature_celsius: number
        }
        Insert: {
          created_at?: string
          fridge_id: string
          id?: string
          is_within_range: boolean
          notes?: string | null
          recorded_at?: string
          recorded_by?: string | null
          recorded_by_initials?: string | null
          temperature_celsius: number
        }
        Update: {
          created_at?: string
          fridge_id?: string
          id?: string
          is_within_range?: boolean
          notes?: string | null
          recorded_at?: string
          recorded_by?: string | null
          recorded_by_initials?: string | null
          temperature_celsius?: number
        }
        Relationships: [
          {
            foreignKeyName: "fridge_temperature_readings_fridge_id_fkey"
            columns: ["fridge_id"]
            isOneToOne: false
            referencedRelation: "practice_fridges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fridge_temperature_readings_fridge_id_fkey"
            columns: ["fridge_id"]
            isOneToOne: false
            referencedRelation: "public_fridge_qr_view"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          base_currency: string
          cached_at: string
          id: string
          rate: number
          rate_date: string
          source: string
          target_currency: string
        }
        Insert: {
          base_currency: string
          cached_at?: string
          id?: string
          rate: number
          rate_date: string
          source?: string
          target_currency: string
        }
        Update: {
          base_currency?: string
          cached_at?: string
          id?: string
          rate?: number
          rate_date?: string
          source?: string
          target_currency?: string
        }
        Relationships: []
      }
      genie_sessions: {
        Row: {
          brief_overview: string | null
          created_at: string | null
          duration_seconds: number | null
          email_sent: boolean | null
          end_time: string
          id: string
          message_count: number | null
          messages: Json
          service_type: string
          start_time: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          brief_overview?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          email_sent?: boolean | null
          end_time: string
          id?: string
          message_count?: number | null
          messages?: Json
          service_type: string
          start_time: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          brief_overview?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          email_sent?: boolean | null
          end_time?: string
          id?: string
          message_count?: number | null
          messages?: Json
          service_type?: string
          start_time?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gp_appointments: {
        Row: {
          address: string | null
          appointment_time: string | null
          appointment_type: string | null
          contact_number: string | null
          created_at: string
          date_of_birth: string | null
          id: string
          linked_consultation_id: string | null
          nhs_number: string | null
          notes: string | null
          patient_name: string
          postcode: string | null
          reason: string | null
          reviewing_clinician: string | null
          session_date: string
          session_name: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          appointment_time?: string | null
          appointment_type?: string | null
          contact_number?: string | null
          created_at?: string
          date_of_birth?: string | null
          id?: string
          linked_consultation_id?: string | null
          nhs_number?: string | null
          notes?: string | null
          patient_name: string
          postcode?: string | null
          reason?: string | null
          reviewing_clinician?: string | null
          session_date?: string
          session_name?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          appointment_time?: string | null
          appointment_type?: string | null
          contact_number?: string | null
          created_at?: string
          date_of_birth?: string | null
          id?: string
          linked_consultation_id?: string | null
          nhs_number?: string | null
          notes?: string | null
          patient_name?: string
          postcode?: string | null
          reason?: string | null
          reviewing_clinician?: string | null
          session_date?: string
          session_name?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gp_appointments_linked_consultation_id_fkey"
            columns: ["linked_consultation_id"]
            isOneToOne: false
            referencedRelation: "gp_consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      gp_consultation_ai_chats: {
        Row: {
          consultation_id: string
          created_at: string | null
          id: string
          messages: Json
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          consultation_id: string
          created_at?: string | null
          id?: string
          messages?: Json
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          consultation_id?: string
          created_at?: string | null
          id?: string
          messages?: Json
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gp_consultation_context: {
        Row: {
          consultation_id: string
          content_type: string
          created_at: string
          extracted_text: string | null
          file_path: string | null
          id: string
          name: string
          preview_url: string | null
        }
        Insert: {
          consultation_id: string
          content_type: string
          created_at?: string
          extracted_text?: string | null
          file_path?: string | null
          id?: string
          name: string
          preview_url?: string | null
        }
        Update: {
          consultation_id?: string
          content_type?: string
          created_at?: string
          extracted_text?: string | null
          file_path?: string | null
          id?: string
          name?: string
          preview_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gp_consultation_context_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "gp_consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      gp_consultation_notes: {
        Row: {
          cga_notes: Json | null
          consultation_id: string
          created_at: string
          heidi_notes: Json | null
          id: string
          is_systmone_optimised: boolean | null
          note_format: string | null
          note_style: string | null
          patient_letter: string | null
          referral_letter: string | null
          snomed_codes: string[] | null
          soap_notes: Json | null
          trainee_feedback: string | null
          updated_at: string
        }
        Insert: {
          cga_notes?: Json | null
          consultation_id: string
          created_at?: string
          heidi_notes?: Json | null
          id?: string
          is_systmone_optimised?: boolean | null
          note_format?: string | null
          note_style?: string | null
          patient_letter?: string | null
          referral_letter?: string | null
          snomed_codes?: string[] | null
          soap_notes?: Json | null
          trainee_feedback?: string | null
          updated_at?: string
        }
        Update: {
          cga_notes?: Json | null
          consultation_id?: string
          created_at?: string
          heidi_notes?: Json | null
          id?: string
          is_systmone_optimised?: boolean | null
          note_format?: string | null
          note_style?: string | null
          patient_letter?: string | null
          referral_letter?: string | null
          snomed_codes?: string[] | null
          soap_notes?: Json | null
          trainee_feedback?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gp_consultation_notes_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: true
            referencedRelation: "gp_consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      gp_consultation_transcripts: {
        Row: {
          cleaned_transcript: string | null
          confidence_score: number | null
          consultation_id: string
          created_at: string
          id: string
          realtime_transcript: string | null
          transcript_text: string | null
          transcription_service: string | null
        }
        Insert: {
          cleaned_transcript?: string | null
          confidence_score?: number | null
          consultation_id: string
          created_at?: string
          id?: string
          realtime_transcript?: string | null
          transcript_text?: string | null
          transcription_service?: string | null
        }
        Update: {
          cleaned_transcript?: string | null
          confidence_score?: number | null
          consultation_id?: string
          created_at?: string
          id?: string
          realtime_transcript?: string | null
          transcript_text?: string | null
          transcription_service?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gp_consultation_transcripts_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: true
            referencedRelation: "gp_consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      gp_consultations: {
        Row: {
          consent_timestamp: string | null
          consultation_category: string | null
          consultation_type: string
          created_at: string
          duration_seconds: number | null
          id: string
          patient_consent: boolean | null
          patient_context_confidence: number | null
          patient_dob: string | null
          patient_name: string | null
          patient_nhs_number: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          word_count: number | null
        }
        Insert: {
          consent_timestamp?: string | null
          consultation_category?: string | null
          consultation_type?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          patient_consent?: boolean | null
          patient_context_confidence?: number | null
          patient_dob?: string | null
          patient_name?: string | null
          patient_nhs_number?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id: string
          word_count?: number | null
        }
        Update: {
          consent_timestamp?: string | null
          consultation_category?: string | null
          consultation_type?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          patient_consent?: boolean | null
          patient_context_confidence?: number | null
          patient_dob?: string | null
          patient_name?: string | null
          patient_nhs_number?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          word_count?: number | null
        }
        Relationships: []
      }
      gp_practices: {
        Row: {
          address: string | null
          caldicott_guardian: string | null
          complaints_lead: string | null
          created_at: string
          dpo_name: string | null
          email: string | null
          fire_safety_officer: string | null
          health_safety_lead: string | null
          ics_code: string
          ics_name: string
          id: string
          infection_control_lead: string | null
          lead_gp_name: string | null
          list_size: number | null
          local_contacts: Json | null
          name: string
          neighbourhood_id: string | null
          organisation_type: string
          pcn_code: string | null
          phone: string | null
          postcode: string | null
          practice_code: string
          practice_manager_name: string | null
          safeguarding_lead_adults: string | null
          safeguarding_lead_children: string | null
          services_offered: Json | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          caldicott_guardian?: string | null
          complaints_lead?: string | null
          created_at?: string
          dpo_name?: string | null
          email?: string | null
          fire_safety_officer?: string | null
          health_safety_lead?: string | null
          ics_code: string
          ics_name: string
          id?: string
          infection_control_lead?: string | null
          lead_gp_name?: string | null
          list_size?: number | null
          local_contacts?: Json | null
          name: string
          neighbourhood_id?: string | null
          organisation_type: string
          pcn_code?: string | null
          phone?: string | null
          postcode?: string | null
          practice_code: string
          practice_manager_name?: string | null
          safeguarding_lead_adults?: string | null
          safeguarding_lead_children?: string | null
          services_offered?: Json | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          caldicott_guardian?: string | null
          complaints_lead?: string | null
          created_at?: string
          dpo_name?: string | null
          email?: string | null
          fire_safety_officer?: string | null
          health_safety_lead?: string | null
          ics_code?: string
          ics_name?: string
          id?: string
          infection_control_lead?: string | null
          lead_gp_name?: string | null
          list_size?: number | null
          local_contacts?: Json | null
          name?: string
          neighbourhood_id?: string | null
          organisation_type?: string
          pcn_code?: string | null
          phone?: string | null
          postcode?: string | null
          practice_code?: string
          practice_manager_name?: string | null
          safeguarding_lead_adults?: string | null
          safeguarding_lead_children?: string | null
          services_offered?: Json | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gp_practices_neighbourhood_id_fkey"
            columns: ["neighbourhood_id"]
            isOneToOne: false
            referencedRelation: "neighbourhoods"
            referencedColumns: ["id"]
          },
        ]
      }
      gp_scribe_settings: {
        Row: {
          created_at: string
          default_format_for_emis: boolean
          default_format_for_systmone: boolean
          default_output_level: number
          default_show_snomed_codes: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_format_for_emis?: boolean
          default_format_for_systmone?: boolean
          default_output_level?: number
          default_show_snomed_codes?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_format_for_emis?: boolean
          default_format_for_systmone?: boolean
          default_output_level?: number
          default_show_snomed_codes?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gp_signature_settings: {
        Row: {
          created_at: string
          gmc_number: string | null
          gp_name: string
          id: string
          is_default: boolean | null
          job_title: string | null
          practice_id: string | null
          practice_name: string | null
          qualifications: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gmc_number?: string | null
          gp_name: string
          id?: string
          is_default?: boolean | null
          job_title?: string | null
          practice_id?: string | null
          practice_name?: string | null
          qualifications?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gmc_number?: string | null
          gp_name?: string
          id?: string
          is_default?: boolean | null
          job_title?: string | null
          practice_id?: string | null
          practice_name?: string | null
          qualifications?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gp_signature_settings_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_details"
            referencedColumns: ["id"]
          },
        ]
      }
      icb_formulary: {
        Row: {
          bnf_chapter: string | null
          created_at: string
          detail_url: string | null
          drug_name: string
          formulary_status: string | null
          icb_region: string
          id: string
          last_reviewed: string | null
          last_reviewed_date: string | null
          name: string | null
          name_norm: string | null
          notes_restrictions: string | null
          prior_approval_page_ref: string | null
          prior_approval_pdf_url: string | null
          prior_approval_required: boolean
          source: string | null
          source_document: string | null
          source_page: string | null
          status: string
          therapeutic_area: string | null
          updated_at: string
        }
        Insert: {
          bnf_chapter?: string | null
          created_at?: string
          detail_url?: string | null
          drug_name: string
          formulary_status?: string | null
          icb_region?: string
          id?: string
          last_reviewed?: string | null
          last_reviewed_date?: string | null
          name?: string | null
          name_norm?: string | null
          notes_restrictions?: string | null
          prior_approval_page_ref?: string | null
          prior_approval_pdf_url?: string | null
          prior_approval_required?: boolean
          source?: string | null
          source_document?: string | null
          source_page?: string | null
          status: string
          therapeutic_area?: string | null
          updated_at?: string
        }
        Update: {
          bnf_chapter?: string | null
          created_at?: string
          detail_url?: string | null
          drug_name?: string
          formulary_status?: string | null
          icb_region?: string
          id?: string
          last_reviewed?: string | null
          last_reviewed_date?: string | null
          name?: string | null
          name_norm?: string | null
          notes_restrictions?: string | null
          prior_approval_page_ref?: string | null
          prior_approval_pdf_url?: string | null
          prior_approval_required?: boolean
          source?: string | null
          source_document?: string | null
          source_page?: string | null
          status?: string
          therapeutic_area?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      image_generations: {
        Row: {
          additional_requirements: string | null
          advanced_opened: boolean
          aspect_ratio: string
          created_at: string
          id: string
          image_url: string
          model: string
          prompt_final: string
          regeneration_of_id: string | null
          template_id: string
          user_id: string
        }
        Insert: {
          additional_requirements?: string | null
          advanced_opened?: boolean
          aspect_ratio: string
          created_at?: string
          id?: string
          image_url: string
          model: string
          prompt_final: string
          regeneration_of_id?: string | null
          template_id: string
          user_id: string
        }
        Update: {
          additional_requirements?: string | null
          advanced_opened?: boolean
          aspect_ratio?: string
          created_at?: string
          id?: string
          image_url?: string
          model?: string
          prompt_final?: string
          regeneration_of_id?: string | null
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_generations_regeneration_of_id_fkey"
            columns: ["regeneration_of_id"]
            isOneToOne: false
            referencedRelation: "image_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      image_processing_requests: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          mode: string
          openai_revised_prompt: string | null
          original_image_path: string
          processed_image_path: string | null
          prompt: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          mode?: string
          openai_revised_prompt?: string | null
          original_image_path: string
          processed_image_path?: string | null
          prompt: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          mode?: string
          openai_revised_prompt?: string | null
          original_image_path?: string
          processed_image_path?: string | null
          prompt?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      inbound_emails: {
        Row: {
          attachment_count: number | null
          attachments: Json | null
          classification: string | null
          created_at: string
          email_id: string | null
          from_email: string | null
          from_name: string | null
          has_attachments: boolean | null
          html_body: string | null
          id: string
          practice_id: string | null
          processing_notes: string | null
          processing_status: string
          record_id: string | null
          record_type: string | null
          subject: string | null
          text_body: string | null
          to_email: string | null
        }
        Insert: {
          attachment_count?: number | null
          attachments?: Json | null
          classification?: string | null
          created_at?: string
          email_id?: string | null
          from_email?: string | null
          from_name?: string | null
          has_attachments?: boolean | null
          html_body?: string | null
          id?: string
          practice_id?: string | null
          processing_notes?: string | null
          processing_status?: string
          record_id?: string | null
          record_type?: string | null
          subject?: string | null
          text_body?: string | null
          to_email?: string | null
        }
        Update: {
          attachment_count?: number | null
          attachments?: Json | null
          classification?: string | null
          created_at?: string
          email_id?: string | null
          from_email?: string | null
          from_name?: string | null
          has_attachments?: boolean | null
          html_body?: string | null
          id?: string
          practice_id?: string | null
          processing_notes?: string | null
          processing_status?: string
          record_id?: string | null
          record_type?: string | null
          subject?: string | null
          text_body?: string | null
          to_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_emails_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_details"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_categories: {
        Row: {
          colour: string
          created_at: string
          icon: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          colour?: string
          created_at?: string
          icon?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          colour?: string
          created_at?: string
          icon?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      kb_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
        }
        Insert: {
          chunk_index?: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "kb_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_documents: {
        Row: {
          category_id: string | null
          effective_date: string | null
          file_type: string | null
          file_url: string | null
          id: string
          is_active: boolean
          key_points: string[] | null
          keywords: string[] | null
          source: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          category_id?: string | null
          effective_date?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          key_points?: string[] | null
          keywords?: string[] | null
          source?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category_id?: string | null
          effective_date?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          key_points?: string[] | null
          keywords?: string[] | null
          source?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_documents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      lg_audit_logs: {
        Row: {
          actor: string
          actor_user_id: string | null
          at: string | null
          event: string
          id: string
          meta: Json | null
          patient_id: string | null
        }
        Insert: {
          actor: string
          actor_user_id?: string | null
          at?: string | null
          event: string
          id: string
          meta?: Json | null
          patient_id?: string | null
        }
        Update: {
          actor?: string
          actor_user_id?: string | null
          at?: string | null
          event?: string
          id?: string
          meta?: Json | null
          patient_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lg_audit_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "lg_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      lg_ocr_batches: {
        Row: {
          batch_number: number
          created_at: string | null
          id: string
          ocr_text: string
          pages_processed: number
          patient_id: string
        }
        Insert: {
          batch_number: number
          created_at?: string | null
          id?: string
          ocr_text: string
          pages_processed?: number
          patient_id: string
        }
        Update: {
          batch_number?: number
          created_at?: string | null
          id?: string
          ocr_text?: string
          pages_processed?: number
          patient_id?: string
        }
        Relationships: []
      }
      lg_patients: {
        Row: {
          ai_extracted_dob: string | null
          ai_extracted_name: string | null
          ai_extracted_nhs: string | null
          ai_extracted_sex: string | null
          ai_extraction_confidence: number | null
          all_dobs_found: string[] | null
          all_names_found: string[] | null
          all_nhs_numbers_found: string[] | null
          archived_at: string | null
          audit_report_url: string | null
          batch_id: string | null
          batch_report_sent: boolean | null
          compressed_pdf_size_mb: number | null
          compressed_pdf_url: string | null
          compression_applied_at: string | null
          compression_attempts: number | null
          compression_tier: string | null
          conflict_pages: Json | null
          created_at: string | null
          dob: string | null
          downloaded_at: string | null
          email_error: string | null
          email_sent_at: string | null
          error_message: string | null
          id: string
          identity_verification_issues: Json | null
          identity_verification_status: string | null
          images_count: number | null
          job_status: string | null
          last_audit_at: string | null
          last_audit_by: string | null
          nhs_number: string | null
          nhs_number_validated: boolean | null
          ocr_analysed_chars: number | null
          ocr_analysed_percentage: number | null
          ocr_batches_completed: number | null
          ocr_batches_total: number | null
          ocr_completed_at: string | null
          ocr_started_at: string | null
          ocr_text_url: string | null
          ocr_total_chars: number | null
          original_size_mb: number | null
          patient_name: string | null
          pdf_completed_at: string | null
          pdf_final_size_mb: number | null
          pdf_generation_status: string | null
          pdf_part_urls: Json | null
          pdf_parts: number | null
          pdf_split: boolean | null
          pdf_started_at: string | null
          pdf_url: string | null
          practice_ods: string
          previous_names: Json | null
          processing_completed_at: string | null
          processing_phase: string | null
          processing_started_at: string | null
          publish_status: string | null
          requires_verification: boolean | null
          service_level: string | null
          sex: string
          snomed_csv_url: string | null
          snomed_json_url: string | null
          source_filename: string | null
          source_page_count: number | null
          summary_completed_at: string | null
          summary_json_url: string | null
          summary_started_at: string | null
          updated_at: string | null
          upload_completed_at: string | null
          upload_progress: number | null
          upload_started_at: string | null
          uploaded_to_s1_at: string | null
          uploader_name: string
          user_id: string
          validated_at: string | null
          validated_by: string | null
          validation_result: Json | null
          validation_screenshot_url: string | null
          verification_rag: string | null
          verification_results: Json | null
          verification_score: number | null
          verification_status: string | null
          verified_at: string | null
        }
        Insert: {
          ai_extracted_dob?: string | null
          ai_extracted_name?: string | null
          ai_extracted_nhs?: string | null
          ai_extracted_sex?: string | null
          ai_extraction_confidence?: number | null
          all_dobs_found?: string[] | null
          all_names_found?: string[] | null
          all_nhs_numbers_found?: string[] | null
          archived_at?: string | null
          audit_report_url?: string | null
          batch_id?: string | null
          batch_report_sent?: boolean | null
          compressed_pdf_size_mb?: number | null
          compressed_pdf_url?: string | null
          compression_applied_at?: string | null
          compression_attempts?: number | null
          compression_tier?: string | null
          conflict_pages?: Json | null
          created_at?: string | null
          dob?: string | null
          downloaded_at?: string | null
          email_error?: string | null
          email_sent_at?: string | null
          error_message?: string | null
          id: string
          identity_verification_issues?: Json | null
          identity_verification_status?: string | null
          images_count?: number | null
          job_status?: string | null
          last_audit_at?: string | null
          last_audit_by?: string | null
          nhs_number?: string | null
          nhs_number_validated?: boolean | null
          ocr_analysed_chars?: number | null
          ocr_analysed_percentage?: number | null
          ocr_batches_completed?: number | null
          ocr_batches_total?: number | null
          ocr_completed_at?: string | null
          ocr_started_at?: string | null
          ocr_text_url?: string | null
          ocr_total_chars?: number | null
          original_size_mb?: number | null
          patient_name?: string | null
          pdf_completed_at?: string | null
          pdf_final_size_mb?: number | null
          pdf_generation_status?: string | null
          pdf_part_urls?: Json | null
          pdf_parts?: number | null
          pdf_split?: boolean | null
          pdf_started_at?: string | null
          pdf_url?: string | null
          practice_ods: string
          previous_names?: Json | null
          processing_completed_at?: string | null
          processing_phase?: string | null
          processing_started_at?: string | null
          publish_status?: string | null
          requires_verification?: boolean | null
          service_level?: string | null
          sex?: string
          snomed_csv_url?: string | null
          snomed_json_url?: string | null
          source_filename?: string | null
          source_page_count?: number | null
          summary_completed_at?: string | null
          summary_json_url?: string | null
          summary_started_at?: string | null
          updated_at?: string | null
          upload_completed_at?: string | null
          upload_progress?: number | null
          upload_started_at?: string | null
          uploaded_to_s1_at?: string | null
          uploader_name: string
          user_id: string
          validated_at?: string | null
          validated_by?: string | null
          validation_result?: Json | null
          validation_screenshot_url?: string | null
          verification_rag?: string | null
          verification_results?: Json | null
          verification_score?: number | null
          verification_status?: string | null
          verified_at?: string | null
        }
        Update: {
          ai_extracted_dob?: string | null
          ai_extracted_name?: string | null
          ai_extracted_nhs?: string | null
          ai_extracted_sex?: string | null
          ai_extraction_confidence?: number | null
          all_dobs_found?: string[] | null
          all_names_found?: string[] | null
          all_nhs_numbers_found?: string[] | null
          archived_at?: string | null
          audit_report_url?: string | null
          batch_id?: string | null
          batch_report_sent?: boolean | null
          compressed_pdf_size_mb?: number | null
          compressed_pdf_url?: string | null
          compression_applied_at?: string | null
          compression_attempts?: number | null
          compression_tier?: string | null
          conflict_pages?: Json | null
          created_at?: string | null
          dob?: string | null
          downloaded_at?: string | null
          email_error?: string | null
          email_sent_at?: string | null
          error_message?: string | null
          id?: string
          identity_verification_issues?: Json | null
          identity_verification_status?: string | null
          images_count?: number | null
          job_status?: string | null
          last_audit_at?: string | null
          last_audit_by?: string | null
          nhs_number?: string | null
          nhs_number_validated?: boolean | null
          ocr_analysed_chars?: number | null
          ocr_analysed_percentage?: number | null
          ocr_batches_completed?: number | null
          ocr_batches_total?: number | null
          ocr_completed_at?: string | null
          ocr_started_at?: string | null
          ocr_text_url?: string | null
          ocr_total_chars?: number | null
          original_size_mb?: number | null
          patient_name?: string | null
          pdf_completed_at?: string | null
          pdf_final_size_mb?: number | null
          pdf_generation_status?: string | null
          pdf_part_urls?: Json | null
          pdf_parts?: number | null
          pdf_split?: boolean | null
          pdf_started_at?: string | null
          pdf_url?: string | null
          practice_ods?: string
          previous_names?: Json | null
          processing_completed_at?: string | null
          processing_phase?: string | null
          processing_started_at?: string | null
          publish_status?: string | null
          requires_verification?: boolean | null
          service_level?: string | null
          sex?: string
          snomed_csv_url?: string | null
          snomed_json_url?: string | null
          source_filename?: string | null
          source_page_count?: number | null
          summary_completed_at?: string | null
          summary_json_url?: string | null
          summary_started_at?: string | null
          updated_at?: string | null
          upload_completed_at?: string | null
          upload_progress?: number | null
          upload_started_at?: string | null
          uploaded_to_s1_at?: string | null
          uploader_name?: string
          user_id?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_result?: Json | null
          validation_screenshot_url?: string | null
          verification_rag?: string | null
          verification_results?: Json | null
          verification_score?: number | null
          verification_status?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      lg_patients_archive: {
        Row: {
          billable_pages: number | null
          created_at: string
          deleted_at: string
          deleted_by: string | null
          id: string
          nhs_number: string | null
          original_patient_id: string
          pages_blank: number | null
          pages_scanned: number
          patient_dob: string | null
          patient_name: string | null
          practice_name: string | null
          practice_ods: string | null
          scan_date: string | null
          scanned_by: string | null
          scanned_by_user_id: string | null
        }
        Insert: {
          billable_pages?: number | null
          created_at?: string
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          nhs_number?: string | null
          original_patient_id: string
          pages_blank?: number | null
          pages_scanned?: number
          patient_dob?: string | null
          patient_name?: string | null
          practice_name?: string | null
          practice_ods?: string | null
          scan_date?: string | null
          scanned_by?: string | null
          scanned_by_user_id?: string | null
        }
        Update: {
          billable_pages?: number | null
          created_at?: string
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          nhs_number?: string | null
          original_patient_id?: string
          pages_blank?: number | null
          pages_scanned?: number
          patient_dob?: string | null
          patient_name?: string | null
          practice_name?: string | null
          practice_ods?: string | null
          scan_date?: string | null
          scanned_by?: string | null
          scanned_by_user_id?: string | null
        }
        Relationships: []
      }
      lg_patients_audit_log: {
        Row: {
          action: string
          action_details: Json | null
          created_at: string
          id: string
          ip_address: string | null
          patient_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          action_details?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          patient_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          action_details?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          patient_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      live_meeting_notes: {
        Row: {
          created_at: string
          current_version: number
          id: string
          last_updated_at: string
          meeting_id: string
          notes_content: string
          processing_status: string
          session_id: string
          transcript_word_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          current_version?: number
          id?: string
          last_updated_at?: string
          meeting_id: string
          notes_content: string
          processing_status?: string
          session_id: string
          transcript_word_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          current_version?: number
          id?: string
          last_updated_at?: string
          meeting_id?: string
          notes_content?: string
          processing_status?: string
          session_id?: string
          transcript_word_count?: number
          user_id?: string
        }
        Relationships: []
      }
      live_meeting_notes_versions: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          notes_content: string
          processing_metadata: Json | null
          session_id: string
          transcript_word_count: number
          user_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          notes_content: string
          processing_metadata?: Json | null
          session_id: string
          transcript_word_count?: number
          user_id: string
          version_number: number
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          notes_content?: string
          processing_metadata?: Json | null
          session_id?: string
          transcript_word_count?: number
          user_id?: string
          version_number?: number
        }
        Relationships: []
      }
      login_rate_limits: {
        Row: {
          blocked: boolean | null
          created_at: string
          email_attempted: string
          id: string
          ip_address: string
          password_hash_prefix: string | null
          user_agent: string | null
        }
        Insert: {
          blocked?: boolean | null
          created_at?: string
          email_attempted: string
          id?: string
          ip_address: string
          password_hash_prefix?: string | null
          user_agent?: string | null
        }
        Update: {
          blocked?: boolean | null
          created_at?: string
          email_attempted?: string
          id?: string
          ip_address?: string
          password_hash_prefix?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      low_confidence_chunks: {
        Row: {
          ai_suggested_restoration: boolean | null
          chunk_number: number
          confidence: number
          contextual_relevance_score: number | null
          created_at: string
          filter_reason: string
          id: string
          meeting_id: string | null
          original_confidence: number
          processed_at: string | null
          session_id: string
          transcriber_type: string
          transcription_text: string
          user_action: string | null
          user_edited_text: string | null
          user_id: string
        }
        Insert: {
          ai_suggested_restoration?: boolean | null
          chunk_number: number
          confidence: number
          contextual_relevance_score?: number | null
          created_at?: string
          filter_reason: string
          id?: string
          meeting_id?: string | null
          original_confidence: number
          processed_at?: string | null
          session_id: string
          transcriber_type?: string
          transcription_text: string
          user_action?: string | null
          user_edited_text?: string | null
          user_id: string
        }
        Update: {
          ai_suggested_restoration?: boolean | null
          chunk_number?: number
          confidence?: number
          contextual_relevance_score?: number | null
          created_at?: string
          filter_reason?: string
          id?: string
          meeting_id?: string | null
          original_confidence?: number
          processed_at?: string | null
          session_id?: string
          transcriber_type?: string
          transcription_text?: string
          user_action?: string | null
          user_edited_text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_low_confidence_meeting"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      magic_link_rate_limits: {
        Row: {
          blocked: boolean | null
          created_at: string | null
          email_requested: string
          id: string
          ip_address: string
          user_agent: string | null
        }
        Insert: {
          blocked?: boolean | null
          created_at?: string | null
          email_requested: string
          id?: string
          ip_address: string
          user_agent?: string | null
        }
        Update: {
          blocked?: boolean | null
          created_at?: string | null
          email_requested?: string
          id?: string
          ip_address?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      manual_translation_entries: {
        Row: {
          created_at: string
          detection_confidence: number | null
          exchange_number: number
          id: string
          medical_terms_detected: string[] | null
          original_language_detected: string
          original_text: string
          processing_time_ms: number | null
          safety_flag: string | null
          session_id: string
          speaker: string
          target_language: string
          timestamp: string
          translated_text: string
          translation_accuracy: number | null
          translation_confidence: number | null
        }
        Insert: {
          created_at?: string
          detection_confidence?: number | null
          exchange_number: number
          id?: string
          medical_terms_detected?: string[] | null
          original_language_detected: string
          original_text: string
          processing_time_ms?: number | null
          safety_flag?: string | null
          session_id: string
          speaker: string
          target_language: string
          timestamp?: string
          translated_text: string
          translation_accuracy?: number | null
          translation_confidence?: number | null
        }
        Update: {
          created_at?: string
          detection_confidence?: number | null
          exchange_number?: number
          id?: string
          medical_terms_detected?: string[] | null
          original_language_detected?: string
          original_text?: string
          processing_time_ms?: number | null
          safety_flag?: string | null
          session_id?: string
          speaker?: string
          target_language?: string
          timestamp?: string
          translated_text?: string
          translation_accuracy?: number | null
          translation_confidence?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_translation_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "manual_translation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_translation_sessions: {
        Row: {
          average_accuracy: number | null
          average_confidence: number | null
          created_at: string
          id: string
          is_active: boolean
          is_completed: boolean | null
          overall_safety_rating: string | null
          session_duration_seconds: number | null
          session_end: string | null
          session_metadata: Json | null
          session_start: string | null
          session_title: string | null
          target_language_code: string
          target_language_name: string
          total_exchanges: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          average_accuracy?: number | null
          average_confidence?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_completed?: boolean | null
          overall_safety_rating?: string | null
          session_duration_seconds?: number | null
          session_end?: string | null
          session_metadata?: Json | null
          session_start?: string | null
          session_title?: string | null
          target_language_code: string
          target_language_name: string
          total_exchanges?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          average_accuracy?: number | null
          average_confidence?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_completed?: boolean | null
          overall_safety_rating?: string | null
          session_duration_seconds?: number | null
          session_end?: string | null
          session_metadata?: Json | null
          session_start?: string | null
          session_title?: string | null
          target_language_code?: string
          target_language_name?: string
          total_exchanges?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      medical_term_corrections: {
        Row: {
          category: string
          context_phrase: string | null
          correct_term: string
          created_at: string
          created_by_name: string | null
          id: string
          incorrect_term: string
          is_global: boolean | null
          practice_id: string | null
          updated_at: string
          usage_count: number | null
          user_id: string
        }
        Insert: {
          category?: string
          context_phrase?: string | null
          correct_term: string
          created_at?: string
          created_by_name?: string | null
          id?: string
          incorrect_term: string
          is_global?: boolean | null
          practice_id?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id: string
        }
        Update: {
          category?: string
          context_phrase?: string | null
          correct_term?: string
          created_at?: string
          created_by_name?: string | null
          id?: string
          incorrect_term?: string
          is_global?: boolean | null
          practice_id?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      meeting_action_items: {
        Row: {
          action_text: string
          assignee_name: string | null
          assignee_type: string | null
          created_at: string
          due_date: string | null
          due_date_actual: string | null
          id: string
          meeting_id: string
          priority: string | null
          sort_order: number | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_text: string
          assignee_name?: string | null
          assignee_type?: string | null
          created_at?: string
          due_date?: string | null
          due_date_actual?: string | null
          id?: string
          meeting_id: string
          priority?: string | null
          sort_order?: number | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_text?: string
          assignee_name?: string | null
          assignee_type?: string | null
          created_at?: string
          due_date?: string | null
          due_date_actual?: string | null
          id?: string
          meeting_id?: string
          priority?: string | null
          sort_order?: number | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendance: {
        Row: {
          attended: boolean
          id: string
          meeting_id: string
          notes: string | null
          recorded_at: string
          recorded_by: string | null
          staff_id: string
        }
        Insert: {
          attended?: boolean
          id?: string
          meeting_id: string
          notes?: string | null
          recorded_at?: string
          recorded_by?: string | null
          staff_id: string
        }
        Update: {
          attended?: boolean
          id?: string
          meeting_id?: string
          notes?: string | null
          recorded_at?: string
          recorded_by?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "neighbourhood_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "nres_buyback_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendee_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_default: boolean | null
          practice_id: string
          template_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          practice_id: string
          template_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          practice_id?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      meeting_attendees: {
        Row: {
          attendee_id: string
          created_at: string
          id: string
          meeting_id: string
          meeting_role: string | null
        }
        Insert: {
          attendee_id: string
          created_at?: string
          id?: string
          meeting_id: string
          meeting_role?: string | null
        }
        Update: {
          attendee_id?: string
          created_at?: string
          id?: string
          meeting_id?: string
          meeting_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendees_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_audio_backups: {
        Row: {
          backup_reason: string | null
          created_at: string
          duration_seconds: number | null
          expected_word_count: number | null
          file_path: string
          file_size: number | null
          id: string
          integrity_check_at: string | null
          integrity_check_passed: boolean | null
          is_reprocessed: boolean | null
          meeting_id: string
          reprocessed_at: string | null
          reprocessed_by: string | null
          transcription_quality_score: number | null
          transcription_status: string | null
          updated_at: string
          user_id: string
          word_count: number | null
        }
        Insert: {
          backup_reason?: string | null
          created_at?: string
          duration_seconds?: number | null
          expected_word_count?: number | null
          file_path: string
          file_size?: number | null
          id?: string
          integrity_check_at?: string | null
          integrity_check_passed?: boolean | null
          is_reprocessed?: boolean | null
          meeting_id: string
          reprocessed_at?: string | null
          reprocessed_by?: string | null
          transcription_quality_score?: number | null
          transcription_status?: string | null
          updated_at?: string
          user_id: string
          word_count?: number | null
        }
        Update: {
          backup_reason?: string | null
          created_at?: string
          duration_seconds?: number | null
          expected_word_count?: number | null
          file_path?: string
          file_size?: number | null
          id?: string
          integrity_check_at?: string | null
          integrity_check_passed?: boolean | null
          is_reprocessed?: boolean | null
          meeting_id?: string
          reprocessed_at?: string | null
          reprocessed_by?: string | null
          transcription_quality_score?: number | null
          transcription_status?: string | null
          updated_at?: string
          user_id?: string
          word_count?: number | null
        }
        Relationships: []
      }
      meeting_audio_segments: {
        Row: {
          created_at: string
          duration_seconds: number | null
          end_time: string
          file_path: string
          file_size: number | null
          id: string
          meeting_id: string
          segment_number: number
          start_time: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          end_time: string
          file_path: string
          file_size?: number | null
          id?: string
          meeting_id: string
          segment_number: number
          start_time: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          end_time?: string
          file_path?: string
          file_size?: number | null
          id?: string
          meeting_id?: string
          segment_number?: number
          start_time?: string
        }
        Relationships: []
      }
      meeting_auto_notes: {
        Row: {
          created_at: string
          detail_level: string | null
          error_message: string | null
          generated_notes: string | null
          generation_completed_at: string | null
          generation_started_at: string | null
          id: string
          meeting_id: string
          retry_count: number | null
          status: string
          updated_at: string
          word_count: number | null
        }
        Insert: {
          created_at?: string
          detail_level?: string | null
          error_message?: string | null
          generated_notes?: string | null
          generation_completed_at?: string | null
          generation_started_at?: string | null
          id?: string
          meeting_id: string
          retry_count?: number | null
          status?: string
          updated_at?: string
          word_count?: number | null
        }
        Update: {
          created_at?: string
          detail_level?: string | null
          error_message?: string | null
          generated_notes?: string | null
          generation_completed_at?: string | null
          generation_started_at?: string | null
          id?: string
          meeting_id?: string
          retry_count?: number | null
          status?: string
          updated_at?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_auto_notes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_dashboard_sessions: {
        Row: {
          created_at: string
          id: string
          last_saved_at: string | null
          live_notes: string | null
          meeting_id: string | null
          processing_settings: Json
          session_data: Json
          updated_at: string
          user_id: string
          validation_corrections: Json
        }
        Insert: {
          created_at?: string
          id?: string
          last_saved_at?: string | null
          live_notes?: string | null
          meeting_id?: string | null
          processing_settings?: Json
          session_data?: Json
          updated_at?: string
          user_id: string
          validation_corrections?: Json
        }
        Update: {
          created_at?: string
          id?: string
          last_saved_at?: string | null
          live_notes?: string | null
          meeting_id?: string | null
          processing_settings?: Json
          session_data?: Json
          updated_at?: string
          user_id?: string
          validation_corrections?: Json
        }
        Relationships: [
          {
            foreignKeyName: "meeting_dashboard_sessions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_documents: {
        Row: {
          created_at: string
          description: string | null
          document_type: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          meeting_id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_type?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          meeting_id: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          description?: string | null
          document_type?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          meeting_id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      meeting_folders: {
        Row: {
          colour: string | null
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          colour?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          colour?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meeting_generation_log: {
        Row: {
          actual_model_used: string
          created_at: string
          cross_section_check_performed: boolean
          decision_count: number | null
          detail_tier: string | null
          detected_content_type: string | null
          duration_seconds: number | null
          extracted_action_count: number | null
          extraction_reasoning_trace: string | null
          failure_reasons: Json | null
          fallback_count: number
          fallback_reason: string | null
          generation_ms: number | null
          id: string
          meeting_id: string
          next_meeting_item_count: number | null
          primary_model: string
          pro_elapsed_ms: number | null
          pro_error_message: string | null
          pro_status_code: number | null
          skip_reason: string | null
          transcript_snippet: string | null
          transcript_word_count: number | null
        }
        Insert: {
          actual_model_used: string
          created_at?: string
          cross_section_check_performed?: boolean
          decision_count?: number | null
          detail_tier?: string | null
          detected_content_type?: string | null
          duration_seconds?: number | null
          extracted_action_count?: number | null
          extraction_reasoning_trace?: string | null
          failure_reasons?: Json | null
          fallback_count?: number
          fallback_reason?: string | null
          generation_ms?: number | null
          id?: string
          meeting_id: string
          next_meeting_item_count?: number | null
          primary_model: string
          pro_elapsed_ms?: number | null
          pro_error_message?: string | null
          pro_status_code?: number | null
          skip_reason?: string | null
          transcript_snippet?: string | null
          transcript_word_count?: number | null
        }
        Update: {
          actual_model_used?: string
          created_at?: string
          cross_section_check_performed?: boolean
          decision_count?: number | null
          detail_tier?: string | null
          detected_content_type?: string | null
          duration_seconds?: number | null
          extracted_action_count?: number | null
          extraction_reasoning_trace?: string | null
          failure_reasons?: Json | null
          fallback_count?: number
          fallback_reason?: string | null
          generation_ms?: number | null
          id?: string
          meeting_id?: string
          next_meeting_item_count?: number | null
          primary_model?: string
          pro_elapsed_ms?: number | null
          pro_error_message?: string | null
          pro_status_code?: number | null
          skip_reason?: string | null
          transcript_snippet?: string | null
          transcript_word_count?: number | null
        }
        Relationships: []
      }
      meeting_groups: {
        Row: {
          additional_members: Json | null
          color: string
          contact_ids: number[] | null
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_members?: Json | null
          color?: string
          contact_ids?: number[] | null
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_members?: Json | null
          color?: string
          contact_ids?: number[] | null
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meeting_infographics: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          meeting_id: string
          orientation: string | null
          storage_path: string | null
          style: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          meeting_id: string
          orientation?: string | null
          storage_path?: string | null
          style?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          meeting_id?: string
          orientation?: string | null
          storage_path?: string | null
          style?: string | null
          user_id?: string
        }
        Relationships: []
      }
      meeting_metadata_audit: {
        Row: {
          edited_at: string
          edited_by: string
          field_name: string
          id: string
          meeting_id: string
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          edited_at?: string
          edited_by: string
          field_name: string
          id?: string
          meeting_id: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          edited_at?: string
          edited_by?: string
          field_name?: string
          id?: string
          meeting_id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_metadata_audit_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_notes_multi: {
        Row: {
          content: string
          created_at: string | null
          generated_at: string | null
          id: string
          meeting_id: string
          model_used: string | null
          note_type: string
          processing_time_ms: number | null
          token_count: number | null
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          generated_at?: string | null
          id?: string
          meeting_id: string
          model_used?: string | null
          note_type: string
          processing_time_ms?: number | null
          token_count?: number | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          generated_at?: string | null
          id?: string
          meeting_id?: string
          model_used?: string | null
          note_type?: string
          processing_time_ms?: number | null
          token_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      meeting_notes_queue: {
        Row: {
          attempts: number
          batch_id: string | null
          completed_at: string | null
          created_at: string
          detail_level: string
          error_message: string | null
          id: string
          last_processed_at: string | null
          max_attempts: number
          meeting_id: string
          note_type: string | null
          priority: number
          processing_model: string | null
          processing_time_ms: number | null
          retry_count: number | null
          started_at: string | null
          status: string
          token_count: number | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          batch_id?: string | null
          completed_at?: string | null
          created_at?: string
          detail_level?: string
          error_message?: string | null
          id?: string
          last_processed_at?: string | null
          max_attempts?: number
          meeting_id: string
          note_type?: string | null
          priority?: number
          processing_model?: string | null
          processing_time_ms?: number | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          token_count?: number | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          batch_id?: string | null
          completed_at?: string | null
          created_at?: string
          detail_level?: string
          error_message?: string | null
          id?: string
          last_processed_at?: string | null
          max_attempts?: number
          meeting_id?: string
          note_type?: string | null
          priority?: number
          processing_model?: string | null
          processing_time_ms?: number | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          token_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_queue_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_overviews: {
        Row: {
          audio_overview_duration: number | null
          audio_overview_text: string | null
          audio_overview_url: string | null
          created_at: string
          created_by: string | null
          discussion_data: Json | null
          id: string
          meeting_id: string
          overview: string
          pronunciation_rules: Json | null
          script_style: string | null
          updated_at: string
          voice_id: string | null
          voice_name: string | null
        }
        Insert: {
          audio_overview_duration?: number | null
          audio_overview_text?: string | null
          audio_overview_url?: string | null
          created_at?: string
          created_by?: string | null
          discussion_data?: Json | null
          id?: string
          meeting_id: string
          overview: string
          pronunciation_rules?: Json | null
          script_style?: string | null
          updated_at?: string
          voice_id?: string | null
          voice_name?: string | null
        }
        Update: {
          audio_overview_duration?: number | null
          audio_overview_text?: string | null
          audio_overview_url?: string | null
          created_at?: string
          created_by?: string | null
          discussion_data?: Json | null
          id?: string
          meeting_id?: string
          overview?: string
          pronunciation_rules?: Json | null
          script_style?: string | null
          updated_at?: string
          voice_id?: string | null
          voice_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_overviews_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_qa_sessions: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          messages: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          messages?: Json
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_qa_sessions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_shares: {
        Row: {
          access_level: string
          created_at: string
          id: string
          meeting_id: string
          message: string | null
          shared_at: string
          shared_by: string
          shared_with_email: string
          shared_with_user_id: string | null
        }
        Insert: {
          access_level?: string
          created_at?: string
          id?: string
          meeting_id: string
          message?: string | null
          shared_at?: string
          shared_by: string
          shared_with_email: string
          shared_with_user_id?: string | null
        }
        Update: {
          access_level?: string
          created_at?: string
          id?: string
          meeting_id?: string
          message?: string | null
          shared_at?: string
          shared_by?: string
          shared_with_email?: string
          shared_with_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_shares_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_summaries: {
        Row: {
          action_items: string[] | null
          ai_generated: boolean
          created_at: string
          decisions: string[] | null
          generation_metadata: Json | null
          id: string
          key_points: string[] | null
          meeting_id: string
          next_steps: string[] | null
          summary: string
          updated_at: string
        }
        Insert: {
          action_items?: string[] | null
          ai_generated?: boolean
          created_at?: string
          decisions?: string[] | null
          generation_metadata?: Json | null
          id?: string
          key_points?: string[] | null
          meeting_id: string
          next_steps?: string[] | null
          summary: string
          updated_at?: string
        }
        Update: {
          action_items?: string[] | null
          ai_generated?: boolean
          created_at?: string
          decisions?: string[] | null
          generation_metadata?: Json | null
          id?: string
          key_points?: string[] | null
          meeting_id?: string
          next_steps?: string[] | null
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_summaries_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_summary_chunks: {
        Row: {
          chunk_index: number
          created_at: string
          detail_level: string | null
          id: string
          meeting_id: string | null
          partial_summary: string
          session_id: string
          source_word_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chunk_index: number
          created_at?: string
          detail_level?: string | null
          id?: string
          meeting_id?: string | null
          partial_summary: string
          session_id: string
          source_word_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chunk_index?: number
          created_at?: string
          detail_level?: string | null
          id?: string
          meeting_id?: string | null
          partial_summary?: string
          session_id?: string
          source_word_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meeting_transcription_chunks: {
        Row: {
          audio_backup_id: string | null
          chunk_number: number
          cleaned_at: string | null
          cleaned_text: string | null
          cleaning_duration_ms: number | null
          cleaning_status: string | null
          confidence: number | null
          confidence_score: number | null
          created_at: string
          end_time: number | null
          id: string
          is_final: boolean | null
          meeting_id: string
          merge_rejection_reason: string | null
          segments_json: Json | null
          seq: number | null
          session_id: string
          source: string | null
          start_time: number | null
          transcriber_type: string | null
          transcription_text: string
          user_id: string
          validation_status: string | null
          word_count: number | null
        }
        Insert: {
          audio_backup_id?: string | null
          chunk_number: number
          cleaned_at?: string | null
          cleaned_text?: string | null
          cleaning_duration_ms?: number | null
          cleaning_status?: string | null
          confidence?: number | null
          confidence_score?: number | null
          created_at?: string
          end_time?: number | null
          id?: string
          is_final?: boolean | null
          meeting_id: string
          merge_rejection_reason?: string | null
          segments_json?: Json | null
          seq?: number | null
          session_id: string
          source?: string | null
          start_time?: number | null
          transcriber_type?: string | null
          transcription_text: string
          user_id: string
          validation_status?: string | null
          word_count?: number | null
        }
        Update: {
          audio_backup_id?: string | null
          chunk_number?: number
          cleaned_at?: string | null
          cleaned_text?: string | null
          cleaning_duration_ms?: number | null
          cleaning_status?: string | null
          confidence?: number | null
          confidence_score?: number | null
          created_at?: string
          end_time?: number | null
          id?: string
          is_final?: boolean | null
          meeting_id?: string
          merge_rejection_reason?: string | null
          segments_json?: Json | null
          seq?: number | null
          session_id?: string
          source?: string | null
          start_time?: number | null
          transcriber_type?: string | null
          transcription_text?: string
          user_id?: string
          validation_status?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_transcription_chunks_audio_backup_id_fkey"
            columns: ["audio_backup_id"]
            isOneToOne: false
            referencedRelation: "meeting_audio_backups"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_transcripts: {
        Row: {
          confidence_score: number | null
          content: string
          created_at: string
          id: string
          meeting_id: string
          speaker_name: string | null
          timestamp_seconds: number
        }
        Insert: {
          confidence_score?: number | null
          content: string
          created_at?: string
          id?: string
          meeting_id: string
          speaker_name?: string | null
          timestamp_seconds?: number
        }
        Update: {
          confidence_score?: number | null
          content?: string
          created_at?: string
          id?: string
          meeting_id?: string
          speaker_name?: string | null
          timestamp_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "meeting_transcripts_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          agenda: string | null
          assembly_ai_transcript: string | null
          assembly_confidence: number | null
          assembly_transcript_text: string | null
          audio_backup_created_at: string | null
          audio_backup_path: string | null
          auto_generated_name: string | null
          best_of_all_transcript: string | null
          chunk_count: number | null
          created_at: string
          data_retention_date: string | null
          description: string | null
          device_browser: string | null
          device_ip_address: string | null
          device_os: string | null
          device_screen_resolution: string | null
          device_type: string | null
          device_user_agent: string | null
          duration_minutes: number | null
          end_time: string | null
          expected_attendees: string[] | null
          folder_id: string | null
          format: string | null
          id: string
          import_metadata: Json | null
          import_source: string | null
          is_paused: boolean | null
          last_retry_at: string | null
          left_audio_url: string | null
          live_transcript_text: string | null
          location: string | null
          meeting_attendees_json: Json | null
          meeting_configuration: Json | null
          meeting_context: Json | null
          meeting_format: string | null
          meeting_location: string | null
          meeting_type: string
          merge_decision_log: Json | null
          mixed_audio_url: string | null
          notes_config: Json | null
          notes_cost_usd_est: number | null
          notes_documents_loaded_at: string | null
          notes_email_sent_at: string | null
          notes_first_delta_at: string | null
          notes_generation_status: string | null
          notes_input_tokens: number | null
          notes_meeting_loaded_at: string | null
          notes_model_attempt: number
          notes_model_used: string | null
          notes_output_tokens: number | null
          notes_post_processing_complete_at: string | null
          notes_prompt_assembled_at: string | null
          notes_request_dispatched_at: string | null
          notes_stream_complete_at: string | null
          notes_style_2: string | null
          notes_style_3: string | null
          notes_style_4: string | null
          notes_style_5: string | null
          notes_title_generated_at: string | null
          overview: string | null
          participants: string[] | null
          practice_id: string | null
          primary_transcript_source: string | null
          recording_created_at: string | null
          refine_count: number
          remote_chunk_paths: string[] | null
          requires_audio_backup: boolean | null
          retry_count: number | null
          right_audio_url: string | null
          soap_notes: Json | null
          standard_minutes_variations: Json | null
          start_time: string
          status: string
          style_previews: Json | null
          style_previews_generated_at: string | null
          style_previews_transcript_hash: string | null
          title: string
          transcript_cleaned_at: string | null
          transcript_cleaned_word_count: number | null
          transcript_updated_at: string | null
          updated_at: string
          upload_session_id: string | null
          user_id: string
          whisper_confidence: number | null
          whisper_transcript_text: string | null
          word_count: number | null
        }
        Insert: {
          agenda?: string | null
          assembly_ai_transcript?: string | null
          assembly_confidence?: number | null
          assembly_transcript_text?: string | null
          audio_backup_created_at?: string | null
          audio_backup_path?: string | null
          auto_generated_name?: string | null
          best_of_all_transcript?: string | null
          chunk_count?: number | null
          created_at?: string
          data_retention_date?: string | null
          description?: string | null
          device_browser?: string | null
          device_ip_address?: string | null
          device_os?: string | null
          device_screen_resolution?: string | null
          device_type?: string | null
          device_user_agent?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          expected_attendees?: string[] | null
          folder_id?: string | null
          format?: string | null
          id?: string
          import_metadata?: Json | null
          import_source?: string | null
          is_paused?: boolean | null
          last_retry_at?: string | null
          left_audio_url?: string | null
          live_transcript_text?: string | null
          location?: string | null
          meeting_attendees_json?: Json | null
          meeting_configuration?: Json | null
          meeting_context?: Json | null
          meeting_format?: string | null
          meeting_location?: string | null
          meeting_type?: string
          merge_decision_log?: Json | null
          mixed_audio_url?: string | null
          notes_config?: Json | null
          notes_cost_usd_est?: number | null
          notes_documents_loaded_at?: string | null
          notes_email_sent_at?: string | null
          notes_first_delta_at?: string | null
          notes_generation_status?: string | null
          notes_input_tokens?: number | null
          notes_meeting_loaded_at?: string | null
          notes_model_attempt?: number
          notes_model_used?: string | null
          notes_output_tokens?: number | null
          notes_post_processing_complete_at?: string | null
          notes_prompt_assembled_at?: string | null
          notes_request_dispatched_at?: string | null
          notes_stream_complete_at?: string | null
          notes_style_2?: string | null
          notes_style_3?: string | null
          notes_style_4?: string | null
          notes_style_5?: string | null
          notes_title_generated_at?: string | null
          overview?: string | null
          participants?: string[] | null
          practice_id?: string | null
          primary_transcript_source?: string | null
          recording_created_at?: string | null
          refine_count?: number
          remote_chunk_paths?: string[] | null
          requires_audio_backup?: boolean | null
          retry_count?: number | null
          right_audio_url?: string | null
          soap_notes?: Json | null
          standard_minutes_variations?: Json | null
          start_time?: string
          status?: string
          style_previews?: Json | null
          style_previews_generated_at?: string | null
          style_previews_transcript_hash?: string | null
          title: string
          transcript_cleaned_at?: string | null
          transcript_cleaned_word_count?: number | null
          transcript_updated_at?: string | null
          updated_at?: string
          upload_session_id?: string | null
          user_id: string
          whisper_confidence?: number | null
          whisper_transcript_text?: string | null
          word_count?: number | null
        }
        Update: {
          agenda?: string | null
          assembly_ai_transcript?: string | null
          assembly_confidence?: number | null
          assembly_transcript_text?: string | null
          audio_backup_created_at?: string | null
          audio_backup_path?: string | null
          auto_generated_name?: string | null
          best_of_all_transcript?: string | null
          chunk_count?: number | null
          created_at?: string
          data_retention_date?: string | null
          description?: string | null
          device_browser?: string | null
          device_ip_address?: string | null
          device_os?: string | null
          device_screen_resolution?: string | null
          device_type?: string | null
          device_user_agent?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          expected_attendees?: string[] | null
          folder_id?: string | null
          format?: string | null
          id?: string
          import_metadata?: Json | null
          import_source?: string | null
          is_paused?: boolean | null
          last_retry_at?: string | null
          left_audio_url?: string | null
          live_transcript_text?: string | null
          location?: string | null
          meeting_attendees_json?: Json | null
          meeting_configuration?: Json | null
          meeting_context?: Json | null
          meeting_format?: string | null
          meeting_location?: string | null
          meeting_type?: string
          merge_decision_log?: Json | null
          mixed_audio_url?: string | null
          notes_config?: Json | null
          notes_cost_usd_est?: number | null
          notes_documents_loaded_at?: string | null
          notes_email_sent_at?: string | null
          notes_first_delta_at?: string | null
          notes_generation_status?: string | null
          notes_input_tokens?: number | null
          notes_meeting_loaded_at?: string | null
          notes_model_attempt?: number
          notes_model_used?: string | null
          notes_output_tokens?: number | null
          notes_post_processing_complete_at?: string | null
          notes_prompt_assembled_at?: string | null
          notes_request_dispatched_at?: string | null
          notes_stream_complete_at?: string | null
          notes_style_2?: string | null
          notes_style_3?: string | null
          notes_style_4?: string | null
          notes_style_5?: string | null
          notes_title_generated_at?: string | null
          overview?: string | null
          participants?: string[] | null
          practice_id?: string | null
          primary_transcript_source?: string | null
          recording_created_at?: string | null
          refine_count?: number
          remote_chunk_paths?: string[] | null
          requires_audio_backup?: boolean | null
          retry_count?: number | null
          right_audio_url?: string | null
          soap_notes?: Json | null
          standard_minutes_variations?: Json | null
          start_time?: string
          status?: string
          style_previews?: Json | null
          style_previews_generated_at?: string | null
          style_previews_transcript_hash?: string | null
          title?: string
          transcript_cleaned_at?: string | null
          transcript_cleaned_word_count?: number | null
          transcript_updated_at?: string | null
          updated_at?: string
          upload_session_id?: string | null
          user_id?: string
          whisper_confidence?: number | null
          whisper_transcript_text?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "meeting_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings_archive: {
        Row: {
          deleted_at: string | null
          duration_minutes: number | null
          id: string
          original_created_at: string | null
          original_meeting_id: string
          title: string | null
          user_id: string
          word_count: number | null
        }
        Insert: {
          deleted_at?: string | null
          duration_minutes?: number | null
          id?: string
          original_created_at?: string | null
          original_meeting_id: string
          title?: string | null
          user_id: string
          word_count?: number | null
        }
        Update: {
          deleted_at?: string | null
          duration_minutes?: number | null
          id?: string
          original_created_at?: string | null
          original_meeting_id?: string
          title?: string | null
          user_id?: string
          word_count?: number | null
        }
        Relationships: []
      }
      mock_inspection_access: {
        Row: {
          can_edit: boolean | null
          created_at: string
          granted_by_user_id: string
          granted_to_user_id: string
          id: string
          session_id: string
        }
        Insert: {
          can_edit?: boolean | null
          created_at?: string
          granted_by_user_id: string
          granted_to_user_id: string
          id?: string
          session_id: string
        }
        Update: {
          can_edit?: boolean | null
          created_at?: string
          granted_by_user_id?: string
          granted_to_user_id?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_inspection_access_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mock_inspection_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_inspection_capture_sessions: {
        Row: {
          created_at: string | null
          element_id: string | null
          expires_at: string
          id: string
          is_active: boolean | null
          session_token: string
          short_code: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          element_id?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          session_token: string
          short_code?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          element_id?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          session_token?: string
          short_code?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mock_inspection_captured_images: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          session_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          session_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_inspection_captured_images_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mock_inspection_capture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_inspection_custom_assignees: {
        Row: {
          assignee_name: string
          created_at: string
          id: string
          session_id: string
        }
        Insert: {
          assignee_name: string
          created_at?: string
          id?: string
          session_id: string
        }
        Update: {
          assignee_name?: string
          created_at?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_inspection_custom_assignees_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mock_inspection_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_inspection_element_templates: {
        Row: {
          created_at: string
          domain: string
          element_key: string
          element_name: string
          evidence_guidance: string
          id: string
          is_priority_domain: boolean
          priority: number
        }
        Insert: {
          created_at?: string
          domain: string
          element_key: string
          element_name: string
          evidence_guidance: string
          id?: string
          is_priority_domain?: boolean
          priority?: number
        }
        Update: {
          created_at?: string
          domain?: string
          element_key?: string
          element_name?: string
          evidence_guidance?: string
          id?: string
          is_priority_domain?: boolean
          priority?: number
        }
        Relationships: []
      }
      mock_inspection_elements: {
        Row: {
          assessed_at: string | null
          created_at: string
          domain: string
          element_key: string
          element_name: string
          evidence_files: Json | null
          evidence_guidance: string
          evidence_notes: string | null
          id: string
          improvement_comments: string | null
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          assessed_at?: string | null
          created_at?: string
          domain: string
          element_key: string
          element_name: string
          evidence_files?: Json | null
          evidence_guidance: string
          evidence_notes?: string | null
          id?: string
          improvement_comments?: string | null
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          assessed_at?: string | null
          created_at?: string
          domain?: string
          element_key?: string
          element_name?: string
          evidence_files?: Json | null
          evidence_guidance?: string
          evidence_notes?: string | null
          id?: string
          improvement_comments?: string | null
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_inspection_elements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mock_inspection_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_inspection_fundamentals: {
        Row: {
          assigned_to: string | null
          category: string
          checked_at: string | null
          created_at: string
          fix_by_date: string | null
          fix_by_preset: string | null
          id: string
          item_key: string
          item_name: string
          notes: string | null
          photo_file_name: string | null
          photo_url: string | null
          session_id: string
          status: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          checked_at?: string | null
          created_at?: string
          fix_by_date?: string | null
          fix_by_preset?: string | null
          id?: string
          item_key: string
          item_name: string
          notes?: string | null
          photo_file_name?: string | null
          photo_url?: string | null
          session_id: string
          status?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          checked_at?: string | null
          created_at?: string
          fix_by_date?: string | null
          fix_by_preset?: string | null
          id?: string
          item_key?: string
          item_name?: string
          notes?: string | null
          photo_file_name?: string | null
          photo_url?: string | null
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_inspection_fundamentals_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mock_inspection_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_inspection_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          inspection_type: string
          practice_id: string
          report_generated_at: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          inspection_type?: string
          practice_id: string
          report_generated_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          inspection_type?: string
          practice_id?: string
          report_generated_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_inspection_sessions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_inspection_site_issues: {
        Row: {
          created_at: string
          description: string | null
          id: string
          photo_file_name: string | null
          photo_url: string | null
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          photo_file_name?: string | null
          photo_url?: string | null
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          photo_file_name?: string | null
          photo_url?: string | null
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_inspection_site_issues_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mock_inspection_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_alerts: {
        Row: {
          alert_type: string
          created_at: string
          current_value: number
          details: Json | null
          id: string
          message: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          threshold_value: number
          updated_at: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          current_value: number
          details?: Json | null
          id?: string
          message: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          threshold_value: number
          updated_at?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          current_value?: number
          details?: Json | null
          id?: string
          message?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          threshold_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      narp_cohort_membership: {
        Row: {
          cohort_key: string
          export_id: string
          patient_snapshot_id: number
          practice_id: string
        }
        Insert: {
          cohort_key: string
          export_id: string
          patient_snapshot_id: number
          practice_id: string
        }
        Update: {
          cohort_key?: string
          export_id?: string
          patient_snapshot_id?: number
          practice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "narp_cohort_membership_export_id_fkey"
            columns: ["export_id"]
            isOneToOne: false
            referencedRelation: "narp_exports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narp_cohort_membership_patient_snapshot_id_fkey"
            columns: ["patient_snapshot_id"]
            isOneToOne: false
            referencedRelation: "narp_patient_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narp_cohort_membership_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      narp_export_log: {
        Row: {
          cohort_label: string | null
          column_count: number
          consent_acknowledged: boolean
          exported_at: string
          file_checksum: string
          file_size_bytes: number | null
          filename: string | null
          id: string
          included_identifiers: boolean
          practice_id: string
          reason_text: string
          request_ip: string | null
          row_count: number
          user_agent: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          cohort_label?: string | null
          column_count: number
          consent_acknowledged?: boolean
          exported_at?: string
          file_checksum: string
          file_size_bytes?: number | null
          filename?: string | null
          id?: string
          included_identifiers?: boolean
          practice_id: string
          reason_text: string
          request_ip?: string | null
          row_count: number
          user_agent?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          cohort_label?: string | null
          column_count?: number
          consent_acknowledged?: boolean
          exported_at?: string
          file_checksum?: string
          file_size_bytes?: number | null
          filename?: string | null
          id?: string
          included_identifiers?: boolean
          practice_id?: string
          reason_text?: string
          request_ip?: string | null
          row_count?: number
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      narp_exports: {
        Row: {
          created_at: string
          error_message: string | null
          export_date: string
          file_checksum: string
          file_name: string | null
          id: string
          patient_count: number
          practice_id: string
          status: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          export_date: string
          file_checksum: string
          file_name?: string | null
          id?: string
          patient_count?: number
          practice_id: string
          status?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          export_date?: string
          file_checksum?: string
          file_name?: string | null
          id?: string
          patient_count?: number
          practice_id?: string
          status?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "narp_exports_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      narp_patient_snapshots: {
        Row: {
          ae_attendances: number | null
          age: number | null
          created_at: string
          drug_count: number | null
          export_date: string
          export_id: string
          fk_patient_link_id: string
          forenames_enc: string | null
          frailty_category: string | null
          id: number
          inpatient_elective: number | null
          inpatient_total_admissions: number | null
          nhs_number_enc: string | null
          nhs_number_hash: string | null
          outpatient_first: number | null
          outpatient_followup: number | null
          poa: number | null
          polos: number | null
          practice_id: string
          risk_tier: string | null
          rub: string | null
          surname_enc: string | null
        }
        Insert: {
          ae_attendances?: number | null
          age?: number | null
          created_at?: string
          drug_count?: number | null
          export_date: string
          export_id: string
          fk_patient_link_id: string
          forenames_enc?: string | null
          frailty_category?: string | null
          id?: number
          inpatient_elective?: number | null
          inpatient_total_admissions?: number | null
          nhs_number_enc?: string | null
          nhs_number_hash?: string | null
          outpatient_first?: number | null
          outpatient_followup?: number | null
          poa?: number | null
          polos?: number | null
          practice_id: string
          risk_tier?: string | null
          rub?: string | null
          surname_enc?: string | null
        }
        Update: {
          ae_attendances?: number | null
          age?: number | null
          created_at?: string
          drug_count?: number | null
          export_date?: string
          export_id?: string
          fk_patient_link_id?: string
          forenames_enc?: string | null
          frailty_category?: string | null
          id?: number
          inpatient_elective?: number | null
          inpatient_total_admissions?: number | null
          nhs_number_enc?: string | null
          nhs_number_hash?: string | null
          outpatient_first?: number | null
          outpatient_followup?: number | null
          poa?: number | null
          polos?: number | null
          practice_id?: string
          risk_tier?: string | null
          rub?: string | null
          surname_enc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "narp_patient_snapshots_export_id_fkey"
            columns: ["export_id"]
            isOneToOne: false
            referencedRelation: "narp_exports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narp_patient_snapshots_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      narp_pii_access_log: {
        Row: {
          accessed_at: string
          context: string | null
          fk_patient_link_id: string | null
          id: number
          patient_count_rendered: number
          practice_id: string | null
          route: string | null
          user_id: string | null
        }
        Insert: {
          accessed_at?: string
          context?: string | null
          fk_patient_link_id?: string | null
          id?: number
          patient_count_rendered?: number
          practice_id?: string | null
          route?: string | null
          user_id?: string | null
        }
        Update: {
          accessed_at?: string
          context?: string | null
          fk_patient_link_id?: string | null
          id?: number
          patient_count_rendered?: number
          practice_id?: string | null
          route?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "narp_pii_access_log_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      narp_worklist_items: {
        Row: {
          added_at: string
          added_by: string
          added_drug_count: number | null
          added_export_id: string | null
          added_frailty_category: string | null
          added_poa: number | null
          added_polos: number | null
          added_risk_tier: string | null
          change_flag: string
          change_flag_updated_at: string | null
          created_at: string
          fk_patient_link_id: string
          id: string
          latest_poa: number | null
          latest_risk_tier: string | null
          notes: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_email: string | null
          reviewed_via_meeting_id: string | null
          updated_at: string
          worklist_id: string
        }
        Insert: {
          added_at?: string
          added_by: string
          added_drug_count?: number | null
          added_export_id?: string | null
          added_frailty_category?: string | null
          added_poa?: number | null
          added_polos?: number | null
          added_risk_tier?: string | null
          change_flag?: string
          change_flag_updated_at?: string | null
          created_at?: string
          fk_patient_link_id: string
          id?: string
          latest_poa?: number | null
          latest_risk_tier?: string | null
          notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_email?: string | null
          reviewed_via_meeting_id?: string | null
          updated_at?: string
          worklist_id: string
        }
        Update: {
          added_at?: string
          added_by?: string
          added_drug_count?: number | null
          added_export_id?: string | null
          added_frailty_category?: string | null
          added_poa?: number | null
          added_polos?: number | null
          added_risk_tier?: string | null
          change_flag?: string
          change_flag_updated_at?: string | null
          created_at?: string
          fk_patient_link_id?: string
          id?: string
          latest_poa?: number | null
          latest_risk_tier?: string | null
          notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_email?: string | null
          reviewed_via_meeting_id?: string | null
          updated_at?: string
          worklist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "narp_worklist_items_added_export_id_fkey"
            columns: ["added_export_id"]
            isOneToOne: false
            referencedRelation: "narp_exports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narp_worklist_items_reviewed_via_meeting_id_fkey"
            columns: ["reviewed_via_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narp_worklist_items_worklist_id_fkey"
            columns: ["worklist_id"]
            isOneToOne: false
            referencedRelation: "narp_worklists"
            referencedColumns: ["id"]
          },
        ]
      }
      narp_worklist_meeting_links: {
        Row: {
          id: string
          linked_at: string
          linked_by: string
          meeting_id: string
          unlinked_at: string | null
          worklist_id: string
        }
        Insert: {
          id?: string
          linked_at?: string
          linked_by: string
          meeting_id: string
          unlinked_at?: string | null
          worklist_id: string
        }
        Update: {
          id?: string
          linked_at?: string
          linked_by?: string
          meeting_id?: string
          unlinked_at?: string | null
          worklist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "narp_worklist_meeting_links_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narp_worklist_meeting_links_worklist_id_fkey"
            columns: ["worklist_id"]
            isOneToOne: false
            referencedRelation: "narp_worklists"
            referencedColumns: ["id"]
          },
        ]
      }
      narp_worklists: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          cohort_label: string | null
          created_at: string
          created_by: string
          created_by_email: string | null
          description: string | null
          id: string
          practice_id: string
          source_export_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          cohort_label?: string | null
          created_at?: string
          created_by: string
          created_by_email?: string | null
          description?: string | null
          id?: string
          practice_id: string
          source_export_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          cohort_label?: string | null
          created_at?: string
          created_by?: string
          created_by_email?: string | null
          description?: string | null
          id?: string
          practice_id?: string
          source_export_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "narp_worklists_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narp_worklists_source_export_id_fkey"
            columns: ["source_export_id"]
            isOneToOne: false
            referencedRelation: "narp_exports"
            referencedColumns: ["id"]
          },
        ]
      }
      neighbourhood_meetings: {
        Row: {
          created_at: string
          created_by: string
          duration_hours: number
          id: string
          is_recurring: boolean
          meeting_date: string
          meeting_type: string
          neighbourhood: string
          practice_key: string
          recurrence_rule: string | null
          start_time: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          duration_hours?: number
          id?: string
          is_recurring?: boolean
          meeting_date: string
          meeting_type: string
          neighbourhood?: string
          practice_key: string
          recurrence_rule?: string | null
          start_time?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          duration_hours?: number
          id?: string
          is_recurring?: boolean
          meeting_date?: string
          meeting_type?: string
          neighbourhood?: string
          practice_key?: string
          recurrence_rule?: string | null
          start_time?: string | null
          title?: string | null
        }
        Relationships: []
      }
      neighbourhoods: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      news_articles: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          image_url: string | null
          is_custom: boolean | null
          is_headline: boolean | null
          is_published: boolean | null
          location: string | null
          published_at: string | null
          relevance_score: number | null
          source: string | null
          start_date: string | null
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_custom?: boolean | null
          is_headline?: boolean | null
          is_published?: boolean | null
          location?: string | null
          published_at?: string | null
          relevance_score?: number | null
          source?: string | null
          start_date?: string | null
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_custom?: boolean | null
          is_headline?: boolean | null
          is_published?: boolean | null
          location?: string | null
          published_at?: string | null
          relevance_score?: number | null
          source?: string | null
          start_date?: string | null
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      nhs_terms: {
        Row: {
          created_at: string
          definition: string
          id: string
          is_master: boolean
          term: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          definition: string
          id?: string
          is_master?: boolean
          term: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          definition?: string
          id?: string
          is_master?: boolean
          term?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      nres_board_action_documents: {
        Row: {
          action_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          user_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          user_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nres_board_action_documents_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "nres_board_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      nres_board_actions: {
        Row: {
          action_title: string
          created_at: string
          created_by_email: string | null
          description: string | null
          due_date: string | null
          id: string
          meeting_date: string
          notes: string | null
          original_status: string | null
          original_status_date: string | null
          priority: string
          reference_number: string | null
          responsible_person: string
          status: string
          status_changed_at: string | null
          updated_at: string
          updated_by_email: string | null
          user_id: string
        }
        Insert: {
          action_title: string
          created_at?: string
          created_by_email?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_date: string
          notes?: string | null
          original_status?: string | null
          original_status_date?: string | null
          priority?: string
          reference_number?: string | null
          responsible_person: string
          status?: string
          status_changed_at?: string | null
          updated_at?: string
          updated_by_email?: string | null
          user_id: string
        }
        Update: {
          action_title?: string
          created_at?: string
          created_by_email?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_date?: string
          notes?: string | null
          original_status?: string | null
          original_status_date?: string | null
          priority?: string
          reference_number?: string | null
          responsible_person?: string
          status?: string
          status_changed_at?: string | null
          updated_at?: string
          updated_by_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      nres_board_members: {
        Row: {
          created_at: string
          email: string | null
          group_name: string | null
          id: string
          is_active: boolean
          name: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          group_name?: string | null
          id?: string
          is_active?: boolean
          name: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          group_name?: string | null
          id?: string
          is_active?: boolean
          name?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nres_buyback_access: {
        Row: {
          access_role: string
          granted_at: string | null
          granted_by: string | null
          id: string
          practice_key: string
          user_id: string
        }
        Insert: {
          access_role: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          practice_key: string
          user_id: string
        }
        Update: {
          access_role?: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          practice_key?: string
          user_id?: string
        }
        Relationships: []
      }
      nres_buyback_claims: {
        Row: {
          actual_payment_date: string | null
          approved_by_email: string | null
          bacs_reference: string | null
          calculated_amount: number
          claim_month: string
          claim_ref: number
          claim_type: string
          claimed_amount: number
          created_at: string
          declaration_confirmed: boolean
          expected_payment_date: string | null
          gl_summary: Json | null
          holiday_weeks_deducted: number | null
          id: string
          invoice_generated_at: string | null
          invoice_number: string | null
          invoice_pdf_path: string | null
          paid_at: string | null
          paid_by: string | null
          payment_audit_trail: Json | null
          payment_method: string | null
          payment_notes: string | null
          payment_status: string | null
          pml_po_reference: string | null
          practice_id: string | null
          practice_key: string | null
          practice_notes: string | null
          queried_at: string | null
          queried_by: string | null
          queried_by_role: string | null
          query_flagged_lines: Json | null
          query_notes: string | null
          query_responded_at: string | null
          query_response: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          staff_details: Json
          status: string
          submitted_at: string | null
          submitted_by_email: string | null
          submitted_by_name: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
          verified_notes: string | null
        }
        Insert: {
          actual_payment_date?: string | null
          approved_by_email?: string | null
          bacs_reference?: string | null
          calculated_amount?: number
          claim_month: string
          claim_ref?: number
          claim_type?: string
          claimed_amount?: number
          created_at?: string
          declaration_confirmed?: boolean
          expected_payment_date?: string | null
          gl_summary?: Json | null
          holiday_weeks_deducted?: number | null
          id?: string
          invoice_generated_at?: string | null
          invoice_number?: string | null
          invoice_pdf_path?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_audit_trail?: Json | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_status?: string | null
          pml_po_reference?: string | null
          practice_id?: string | null
          practice_key?: string | null
          practice_notes?: string | null
          queried_at?: string | null
          queried_by?: string | null
          queried_by_role?: string | null
          query_flagged_lines?: Json | null
          query_notes?: string | null
          query_responded_at?: string | null
          query_response?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_details?: Json
          status?: string
          submitted_at?: string | null
          submitted_by_email?: string | null
          submitted_by_name?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
          verified_notes?: string | null
        }
        Update: {
          actual_payment_date?: string | null
          approved_by_email?: string | null
          bacs_reference?: string | null
          calculated_amount?: number
          claim_month?: string
          claim_ref?: number
          claim_type?: string
          claimed_amount?: number
          created_at?: string
          declaration_confirmed?: boolean
          expected_payment_date?: string | null
          gl_summary?: Json | null
          holiday_weeks_deducted?: number | null
          id?: string
          invoice_generated_at?: string | null
          invoice_number?: string | null
          invoice_pdf_path?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_audit_trail?: Json | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_status?: string | null
          pml_po_reference?: string | null
          practice_id?: string | null
          practice_key?: string | null
          practice_notes?: string | null
          queried_at?: string | null
          queried_by?: string | null
          queried_by_role?: string | null
          query_flagged_lines?: Json | null
          query_notes?: string | null
          query_responded_at?: string | null
          query_response?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_details?: Json
          status?: string
          submitted_at?: string | null
          submitted_by_email?: string | null
          submitted_by_name?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
          verified_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nres_buyback_claims_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_details"
            referencedColumns: ["id"]
          },
        ]
      }
      nres_buyback_rate_settings: {
        Row: {
          allow_invoice_email_when_suppressed: boolean
          email_sending_disabled: boolean
          email_testing_mode: boolean
          employer_ni_pct: number
          employer_pension_pct: number
          id: string
          management_roles_config: Json
          meeting_gp_rate: number
          meeting_pm_rate: number
          notify_director_on_resubmit: boolean | null
          notify_submitter_on_approve: boolean | null
          notify_submitter_on_paid: boolean
          notify_submitter_on_query: boolean | null
          notify_submitter_on_resubmit: boolean | null
          notify_verifier_on_approve: boolean | null
          notify_verifier_on_query: boolean | null
          on_costs_pct: number
          roles_config: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          allow_invoice_email_when_suppressed?: boolean
          email_sending_disabled?: boolean
          email_testing_mode?: boolean
          employer_ni_pct?: number
          employer_pension_pct?: number
          id?: string
          management_roles_config?: Json
          meeting_gp_rate?: number
          meeting_pm_rate?: number
          notify_director_on_resubmit?: boolean | null
          notify_submitter_on_approve?: boolean | null
          notify_submitter_on_paid?: boolean
          notify_submitter_on_query?: boolean | null
          notify_submitter_on_resubmit?: boolean | null
          notify_verifier_on_approve?: boolean | null
          notify_verifier_on_query?: boolean | null
          on_costs_pct?: number
          roles_config?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          allow_invoice_email_when_suppressed?: boolean
          email_sending_disabled?: boolean
          email_testing_mode?: boolean
          employer_ni_pct?: number
          employer_pension_pct?: number
          id?: string
          management_roles_config?: Json
          meeting_gp_rate?: number
          meeting_pm_rate?: number
          notify_director_on_resubmit?: boolean | null
          notify_submitter_on_approve?: boolean | null
          notify_submitter_on_paid?: boolean
          notify_submitter_on_query?: boolean | null
          notify_submitter_on_resubmit?: boolean | null
          notify_verifier_on_approve?: boolean | null
          notify_verifier_on_query?: boolean | null
          on_costs_pct?: number
          roles_config?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      nres_buyback_staff: {
        Row: {
          allocation_type: string
          allocation_value: number
          created_at: string
          hourly_rate: number
          id: string
          is_active: boolean
          practice_id: string | null
          practice_key: string | null
          staff_category: string
          staff_name: string
          staff_role: string
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allocation_type?: string
          allocation_value?: number
          created_at?: string
          hourly_rate?: number
          id?: string
          is_active?: boolean
          practice_id?: string | null
          practice_key?: string | null
          staff_category?: string
          staff_name: string
          staff_role?: string
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allocation_type?: string
          allocation_value?: number
          created_at?: string
          hourly_rate?: number
          id?: string
          is_active?: boolean
          practice_id?: string | null
          practice_key?: string | null
          staff_category?: string
          staff_name?: string
          staff_role?: string
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nres_buyback_staff_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_details"
            referencedColumns: ["id"]
          },
        ]
      }
      nres_candidate_feedback: {
        Row: {
          agrees_with_assessment: boolean
          candidate_id: string
          comment: string | null
          created_at: string
          id: string
          role_type: string
          updated_at: string
          user_id: string
          user_name: string
          user_role: string | null
        }
        Insert: {
          agrees_with_assessment: boolean
          candidate_id: string
          comment?: string | null
          created_at?: string
          id?: string
          role_type: string
          updated_at?: string
          user_id: string
          user_name: string
          user_role?: string | null
        }
        Update: {
          agrees_with_assessment?: boolean
          candidate_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          role_type?: string
          updated_at?: string
          user_id?: string
          user_name?: string
          user_role?: string | null
        }
        Relationships: []
      }
      nres_claim_evidence: {
        Row: {
          claim_id: string
          evidence_type: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          notes: string | null
          staff_index: number | null
          uploaded_at: string
          user_id: string
        }
        Insert: {
          claim_id: string
          evidence_type: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          notes?: string | null
          staff_index?: number | null
          uploaded_at?: string
          user_id: string
        }
        Update: {
          claim_id?: string
          evidence_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          notes?: string | null
          staff_index?: number | null
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nres_claim_evidence_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "nres_buyback_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      nres_claim_evidence_config: {
        Row: {
          applies_to: string
          created_at: string
          description: string | null
          evidence_type: string
          id: string
          is_mandatory: boolean
          label: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          applies_to?: string
          created_at?: string
          description?: string | null
          evidence_type: string
          id?: string
          is_mandatory?: boolean
          label: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          applies_to?: string
          created_at?: string
          description?: string | null
          evidence_type?: string
          id?: string
          is_mandatory?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      nres_claimants: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          member_practice: string | null
          name: string
          practice_id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          member_practice?: string | null
          name: string
          practice_id: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          member_practice?: string | null
          name?: string
          practice_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      nres_estates_config: {
        Row: {
          f2f_split_pct: number
          id: string
          room_data: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          f2f_split_pct?: number
          id?: string
          room_data?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          f2f_split_pct?: number
          id?: string
          room_data?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      nres_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
          practice_id: string | null
          receipt_reference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          expense_date: string
          id?: string
          practice_id?: string | null
          receipt_reference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          practice_id?: string | null
          receipt_reference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nres_expenses_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      nres_hours_entries: {
        Row: {
          activity_type: string
          claimant_name: string | null
          claimant_type: string | null
          created_at: string
          description: string | null
          duration_hours: number
          end_time: string
          entered_by: string | null
          id: string
          invoice_status: string | null
          invoiced_by: string | null
          invoiced_date: string | null
          practice_id: string | null
          start_time: string
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          activity_type: string
          claimant_name?: string | null
          claimant_type?: string | null
          created_at?: string
          description?: string | null
          duration_hours: number
          end_time: string
          entered_by?: string | null
          id?: string
          invoice_status?: string | null
          invoiced_by?: string | null
          invoiced_date?: string | null
          practice_id?: string | null
          start_time: string
          updated_at?: string
          user_id: string
          work_date: string
        }
        Update: {
          activity_type?: string
          claimant_name?: string | null
          claimant_type?: string | null
          created_at?: string
          description?: string | null
          duration_hours?: number
          end_time?: string
          entered_by?: string | null
          id?: string
          invoice_status?: string | null
          invoiced_by?: string | null
          invoiced_date?: string | null
          practice_id?: string | null
          start_time?: string
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "nres_hours_entries_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      nres_management_time: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          billing_entity: string | null
          billing_org_code: string | null
          claim_month: string | null
          created_at: string
          description: string | null
          hourly_rate: number
          hours: number
          id: string
          invoice_number: string | null
          management_role_key: string
          notes: string | null
          person_name: string
          query_notes: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          total_amount: number | null
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
          work_date: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          billing_entity?: string | null
          billing_org_code?: string | null
          claim_month?: string | null
          created_at?: string
          description?: string | null
          hourly_rate?: number
          hours?: number
          id?: string
          invoice_number?: string | null
          management_role_key: string
          notes?: string | null
          person_name: string
          query_notes?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          total_amount?: number | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
          work_date: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          billing_entity?: string | null
          billing_org_code?: string | null
          claim_month?: string | null
          created_at?: string
          description?: string | null
          hourly_rate?: number
          hours?: number
          id?: string
          invoice_number?: string | null
          management_role_key?: string
          notes?: string | null
          person_name?: string
          query_notes?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
          work_date?: string
        }
        Relationships: []
      }
      nres_pay_alignment_responses: {
        Row: {
          client_hash: string | null
          comments: Json | null
          id: string
          is_anonymous: boolean
          practice: string | null
          responses: Json
          risk_flag: string | null
          submitted_at: string
          survey_id: string
        }
        Insert: {
          client_hash?: string | null
          comments?: Json | null
          id?: string
          is_anonymous: boolean
          practice?: string | null
          responses: Json
          risk_flag?: string | null
          submitted_at?: string
          survey_id: string
        }
        Update: {
          client_hash?: string | null
          comments?: Json | null
          id?: string
          is_anonymous?: boolean
          practice?: string | null
          responses?: Json
          risk_flag?: string | null
          submitted_at?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nres_pay_alignment_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "nres_pay_alignment_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      nres_pay_alignment_surveys: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          token: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          token: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          token?: string
        }
        Relationships: []
      }
      nres_recruitment_audit: {
        Row: {
          action: string
          field: string | null
          id: string
          new_value: string | null
          old_value: string | null
          practice_name: string | null
          staff_name: string
          timestamp: string
          user_email: string
        }
        Insert: {
          action: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          practice_name?: string | null
          staff_name: string
          timestamp?: string
          user_email: string
        }
        Update: {
          action?: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          practice_name?: string | null
          staff_name?: string
          timestamp?: string
          user_email?: string
        }
        Relationships: []
      }
      nres_recruitment_config: {
        Row: {
          id: string
          practices_data: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          practices_data?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          practices_data?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      nres_submenu_access: {
        Row: {
          created_at: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          submenu_key: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          submenu_key: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          submenu_key?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      nres_system_roles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          organisation: string | null
          role: string
          updated_at: string
          user_email: string
          user_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          organisation?: string | null
          role: string
          updated_at?: string
          user_email: string
          user_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          organisation?: string | null
          role?: string
          updated_at?: string
          user_email?: string
          user_name?: string
        }
        Relationships: []
      }
      nres_user_settings: {
        Row: {
          created_at: string
          hourly_rate: number | null
          id: string
          rate_set_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hourly_rate?: number | null
          id?: string
          rate_set_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hourly_rate?: number | null
          id?: string
          rate_set_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nres_vault_admins: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          is_admin: boolean
          is_super_admin: boolean
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          is_admin?: boolean
          is_super_admin?: boolean
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          is_admin?: boolean
          is_super_admin?: boolean
          user_id?: string
        }
        Relationships: []
      }
      nres_vault_audit_log: {
        Row: {
          action: string
          browser_info: string | null
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_name: string | null
          target_type: string
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          action: string
          browser_info?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_name?: string | null
          target_type: string
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          action?: string
          browser_info?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_name?: string | null
          target_type?: string
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      nres_vault_settings: {
        Row: {
          created_at: string
          id: string
          max_file_size_mb: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_file_size_mb?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_file_size_mb?: number
          updated_at?: string
        }
        Relationships: []
      }
      nres_vault_user_group_members: {
        Row: {
          added_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          added_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nres_vault_user_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "nres_vault_user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      nres_vault_user_groups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pcn_manager_practices: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          created_at: string | null
          id: string
          practice_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          practice_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          practice_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pcn_manager_practices_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_test_runs: {
        Row: {
          action_count: number | null
          cost_usd_est: number | null
          created_at: string
          custom_test: boolean
          diagnostic_log: Json | null
          docx_storage_path: string | null
          email_recipient: string | null
          email_sent_at: string | null
          email_triggered_at: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          input_tokens: number | null
          meeting_id: string | null
          meeting_inserted_at: string | null
          model_override: string | null
          notes_chars: number | null
          notes_completed_at: string | null
          notes_documents_loaded_at: string | null
          notes_first_delta_at: string | null
          notes_invoked_at: string | null
          notes_meeting_loaded_at: string | null
          notes_model_used: string | null
          notes_path: string | null
          notes_post_processing_complete_at: string | null
          notes_prompt_assembled_at: string | null
          notes_request_dispatched_at: string | null
          notes_status_generating_at: string | null
          notes_stream_complete_at: string | null
          notes_title_generated_at: string | null
          output_tokens: number | null
          started_at: string
          status: string
          summary_inserted_at: string | null
          test_size: string
          transcript_chars: number
          transcript_inserted_at: string | null
          transcript_words: number
          user_id: string
        }
        Insert: {
          action_count?: number | null
          cost_usd_est?: number | null
          created_at?: string
          custom_test?: boolean
          diagnostic_log?: Json | null
          docx_storage_path?: string | null
          email_recipient?: string | null
          email_sent_at?: string | null
          email_triggered_at?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          input_tokens?: number | null
          meeting_id?: string | null
          meeting_inserted_at?: string | null
          model_override?: string | null
          notes_chars?: number | null
          notes_completed_at?: string | null
          notes_documents_loaded_at?: string | null
          notes_first_delta_at?: string | null
          notes_invoked_at?: string | null
          notes_meeting_loaded_at?: string | null
          notes_model_used?: string | null
          notes_path?: string | null
          notes_post_processing_complete_at?: string | null
          notes_prompt_assembled_at?: string | null
          notes_request_dispatched_at?: string | null
          notes_status_generating_at?: string | null
          notes_stream_complete_at?: string | null
          notes_title_generated_at?: string | null
          output_tokens?: number | null
          started_at?: string
          status?: string
          summary_inserted_at?: string | null
          test_size: string
          transcript_chars: number
          transcript_inserted_at?: string | null
          transcript_words: number
          user_id: string
        }
        Update: {
          action_count?: number | null
          cost_usd_est?: number | null
          created_at?: string
          custom_test?: boolean
          diagnostic_log?: Json | null
          docx_storage_path?: string | null
          email_recipient?: string | null
          email_sent_at?: string | null
          email_triggered_at?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          input_tokens?: number | null
          meeting_id?: string | null
          meeting_inserted_at?: string | null
          model_override?: string | null
          notes_chars?: number | null
          notes_completed_at?: string | null
          notes_documents_loaded_at?: string | null
          notes_first_delta_at?: string | null
          notes_invoked_at?: string | null
          notes_meeting_loaded_at?: string | null
          notes_model_used?: string | null
          notes_path?: string | null
          notes_post_processing_complete_at?: string | null
          notes_prompt_assembled_at?: string | null
          notes_request_dispatched_at?: string | null
          notes_status_generating_at?: string | null
          notes_stream_complete_at?: string | null
          notes_title_generated_at?: string | null
          output_tokens?: number | null
          started_at?: string
          status?: string
          summary_inserted_at?: string | null
          test_size?: string
          transcript_chars?: number
          transcript_inserted_at?: string | null
          transcript_words?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_test_runs_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      plaud_integrations: {
        Row: {
          auto_generate_notes: boolean
          created_at: string
          default_meeting_type: string | null
          enabled: boolean
          id: string
          updated_at: string
          user_id: string
          webhook_secret: string | null
        }
        Insert: {
          auto_generate_notes?: boolean
          created_at?: string
          default_meeting_type?: string | null
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id: string
          webhook_secret?: string | null
        }
        Update: {
          auto_generate_notes?: boolean
          created_at?: string
          default_meeting_type?: string | null
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      pm_responsibilities: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string
          description: string | null
          frequency_type: string
          frequency_value: number | null
          id: string
          is_active: boolean
          is_mandatory: boolean
          practice_id: string
          reference_url: string | null
          title: string
          typical_due_day: number | null
          typical_due_month: number | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          frequency_type?: string
          frequency_value?: number | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          practice_id: string
          reference_url?: string | null
          title: string
          typical_due_day?: number | null
          typical_due_month?: number | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          frequency_type?: string
          frequency_value?: number | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          practice_id?: string
          reference_url?: string | null
          title?: string
          typical_due_day?: number | null
          typical_due_month?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_responsibilities_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "pm_responsibility_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_responsibilities_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_responsibility_assignments: {
        Row: {
          assigned_by: string
          assigned_to_role: string | null
          assigned_to_user_id: string | null
          created_at: string
          id: string
          notes: string | null
          responsibility_id: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          assigned_to_role?: string | null
          assigned_to_user_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          responsibility_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          assigned_to_role?: string | null
          assigned_to_user_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          responsibility_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_responsibility_assignments_responsibility_id_fkey"
            columns: ["responsibility_id"]
            isOneToOne: false
            referencedRelation: "pm_responsibilities"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_responsibility_categories: {
        Row: {
          colour: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          practice_id: string
        }
        Insert: {
          colour?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          practice_id: string
        }
        Update: {
          colour?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          practice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_responsibility_categories_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_responsibility_instances: {
        Row: {
          assignment_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_date: string
          evidence_notes: string | null
          evidence_url: string | null
          id: string
          reminder_sent: boolean
          responsibility_id: string
          status: string
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date: string
          evidence_notes?: string | null
          evidence_url?: string | null
          id?: string
          reminder_sent?: boolean
          responsibility_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date?: string
          evidence_notes?: string | null
          evidence_url?: string | null
          id?: string
          reminder_sent?: boolean
          responsibility_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_responsibility_instances_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "pm_responsibility_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_responsibility_instances_responsibility_id_fkey"
            columns: ["responsibility_id"]
            isOneToOne: false
            referencedRelation: "pm_responsibilities"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_completions: {
        Row: {
          created_at: string
          current_version_id: string | null
          effective_date: string
          id: string
          metadata: Json
          policy_content: string
          policy_reference_id: string
          policy_title: string
          practice_id: string | null
          review_date: string
          status: string
          updated_at: string
          user_id: string
          version: string
        }
        Insert: {
          created_at?: string
          current_version_id?: string | null
          effective_date: string
          id?: string
          metadata?: Json
          policy_content: string
          policy_reference_id: string
          policy_title: string
          practice_id?: string | null
          review_date: string
          status?: string
          updated_at?: string
          user_id: string
          version?: string
        }
        Update: {
          created_at?: string
          current_version_id?: string | null
          effective_date?: string
          id?: string
          metadata?: Json
          policy_content?: string
          policy_reference_id?: string
          policy_title?: string
          practice_id?: string | null
          review_date?: string
          status?: string
          updated_at?: string
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_completions_current_version_id_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_completions_policy_reference_id_fkey"
            columns: ["policy_reference_id"]
            isOneToOne: false
            referencedRelation: "policy_reference_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_completions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_details"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_generation_jobs: {
        Row: {
          attempt_count: number | null
          completed_at: string | null
          created_at: string
          current_step: string | null
          custom_instructions: string | null
          email_when_ready: boolean | null
          error_message: string | null
          generated_content: string | null
          heartbeat_at: string | null
          id: string
          lease_expires_at: string | null
          metadata: Json | null
          next_retry_at: string | null
          policy_reference_id: string
          policy_title: string
          practice_details: Json
          progress_pct: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number | null
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          custom_instructions?: string | null
          email_when_ready?: boolean | null
          error_message?: string | null
          generated_content?: string | null
          heartbeat_at?: string | null
          id?: string
          lease_expires_at?: string | null
          metadata?: Json | null
          next_retry_at?: string | null
          policy_reference_id: string
          policy_title: string
          practice_details: Json
          progress_pct?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number | null
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          custom_instructions?: string | null
          email_when_ready?: boolean | null
          error_message?: string | null
          generated_content?: string | null
          heartbeat_at?: string | null
          id?: string
          lease_expires_at?: string | null
          metadata?: Json | null
          next_retry_at?: string | null
          policy_reference_id?: string
          policy_title?: string
          practice_details?: Json
          progress_pct?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      policy_generations: {
        Row: {
          created_at: string
          gap_analysis: Json | null
          generated_content: string
          generation_type: string
          id: string
          input_document_url: string | null
          metadata: Json | null
          policy_name: string | null
          policy_reference_id: string | null
          practice_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gap_analysis?: Json | null
          generated_content: string
          generation_type: string
          id?: string
          input_document_url?: string | null
          metadata?: Json | null
          policy_name?: string | null
          policy_reference_id?: string | null
          practice_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gap_analysis?: Json | null
          generated_content?: string
          generation_type?: string
          id?: string
          input_document_url?: string | null
          metadata?: Json | null
          policy_name?: string | null
          policy_reference_id?: string | null
          practice_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_generations_policy_reference_id_fkey"
            columns: ["policy_reference_id"]
            isOneToOne: false
            referencedRelation: "policy_reference_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_generations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_library_access: {
        Row: {
          access_level: Database["public"]["Enums"]["policy_access_level"]
          created_at: string
          granted_by: string
          id: string
          practice_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["policy_access_level"]
          created_at?: string
          granted_by: string
          id?: string
          practice_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["policy_access_level"]
          created_at?: string
          granted_by?: string
          id?: string
          practice_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_library_access_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_details"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_profile_flags: {
        Row: {
          dismissed_at: string | null
          dismissed_by: string | null
          flagged_at: string
          id: string
          policy_id: string
          profile_change_id: string
          resolved_by_version_id: string | null
          user_id: string
        }
        Insert: {
          dismissed_at?: string | null
          dismissed_by?: string | null
          flagged_at?: string
          id?: string
          policy_id: string
          profile_change_id: string
          resolved_by_version_id?: string | null
          user_id: string
        }
        Update: {
          dismissed_at?: string | null
          dismissed_by?: string | null
          flagged_at?: string
          id?: string
          policy_id?: string
          profile_change_id?: string
          resolved_by_version_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_profile_flags_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policy_completions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_profile_flags_profile_change_id_fkey"
            columns: ["profile_change_id"]
            isOneToOne: false
            referencedRelation: "profile_change_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_profile_flags_resolved_by_version_id_fkey"
            columns: ["resolved_by_version_id"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_reference_library: {
        Row: {
          category: string
          cqc_kloe: string
          created_at: string
          description: string | null
          guidance_sources: Json | null
          id: string
          is_active: boolean
          policy_name: string
          priority: string
          required_roles: string[] | null
          required_services: string[] | null
          template_sections: Json | null
          updated_at: string
        }
        Insert: {
          category: string
          cqc_kloe: string
          created_at?: string
          description?: string | null
          guidance_sources?: Json | null
          id?: string
          is_active?: boolean
          policy_name: string
          priority: string
          required_roles?: string[] | null
          required_services?: string[] | null
          template_sections?: Json | null
          updated_at?: string
        }
        Update: {
          category?: string
          cqc_kloe?: string
          created_at?: string
          description?: string | null
          guidance_sources?: Json | null
          id?: string
          is_active?: boolean
          policy_name?: string
          priority?: string
          required_roles?: string[] | null
          required_services?: string[] | null
          template_sections?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      policy_templates: {
        Row: {
          configuration: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          policy_type: string
          region: string
          updated_at: string | null
        }
        Insert: {
          configuration?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          policy_type: string
          region?: string
          updated_at?: string | null
        }
        Update: {
          configuration?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          policy_type?: string
          region?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      policy_versions: {
        Row: {
          approved_by: string | null
          change_summary: string
          change_type: string
          content: Json
          created_at: string
          created_by: string | null
          id: string
          next_review_date: string | null
          policy_id: string
          status: string
          superseded_at: string | null
          user_id: string
          version_number: string
        }
        Insert: {
          approved_by?: string | null
          change_summary?: string
          change_type?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          next_review_date?: string | null
          policy_id: string
          status?: string
          superseded_at?: string | null
          user_id: string
          version_number?: string
        }
        Update: {
          approved_by?: string | null
          change_summary?: string
          change_type?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          next_review_date?: string | null
          policy_id?: string
          status?: string
          superseded_at?: string | null
          user_id?: string
          version_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_versions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policy_completions"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_details: {
        Row: {
          address: string | null
          branch_site_address: string | null
          branch_site_name: string | null
          branch_site_phone: string | null
          branch_site_postcode: string | null
          branch_sites: Json | null
          caldicott_guardian: string | null
          clinical_system: string | null
          complaints_lead: string | null
          created_at: string
          dpo_name: string | null
          email: string | null
          email_signature: string | null
          fire_safety_officer: string | null
          footer_text: string | null
          has_branch_site: boolean | null
          health_safety_lead: string | null
          id: string
          infection_control_lead: string | null
          is_default: boolean | null
          lead_gp_name: string | null
          letter_signature: string | null
          list_size: number | null
          logo_url: string | null
          ods_code: string | null
          pcn_code: string | null
          phone: string | null
          postcode: string | null
          practice_logo_url: string | null
          practice_manager_name: string | null
          practice_name: string
          safeguarding_lead_adults: string | null
          safeguarding_lead_children: string | null
          senior_gp_partner: string | null
          services_offered: Json | null
          show_page_numbers: boolean | null
          signature_url: string | null
          siro: string | null
          updated_at: string
          use_for_all_meetings: boolean | null
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          branch_site_address?: string | null
          branch_site_name?: string | null
          branch_site_phone?: string | null
          branch_site_postcode?: string | null
          branch_sites?: Json | null
          caldicott_guardian?: string | null
          clinical_system?: string | null
          complaints_lead?: string | null
          created_at?: string
          dpo_name?: string | null
          email?: string | null
          email_signature?: string | null
          fire_safety_officer?: string | null
          footer_text?: string | null
          has_branch_site?: boolean | null
          health_safety_lead?: string | null
          id?: string
          infection_control_lead?: string | null
          is_default?: boolean | null
          lead_gp_name?: string | null
          letter_signature?: string | null
          list_size?: number | null
          logo_url?: string | null
          ods_code?: string | null
          pcn_code?: string | null
          phone?: string | null
          postcode?: string | null
          practice_logo_url?: string | null
          practice_manager_name?: string | null
          practice_name: string
          safeguarding_lead_adults?: string | null
          safeguarding_lead_children?: string | null
          senior_gp_partner?: string | null
          services_offered?: Json | null
          show_page_numbers?: boolean | null
          signature_url?: string | null
          siro?: string | null
          updated_at?: string
          use_for_all_meetings?: boolean | null
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          branch_site_address?: string | null
          branch_site_name?: string | null
          branch_site_phone?: string | null
          branch_site_postcode?: string | null
          branch_sites?: Json | null
          caldicott_guardian?: string | null
          clinical_system?: string | null
          complaints_lead?: string | null
          created_at?: string
          dpo_name?: string | null
          email?: string | null
          email_signature?: string | null
          fire_safety_officer?: string | null
          footer_text?: string | null
          has_branch_site?: boolean | null
          health_safety_lead?: string | null
          id?: string
          infection_control_lead?: string | null
          is_default?: boolean | null
          lead_gp_name?: string | null
          letter_signature?: string | null
          list_size?: number | null
          logo_url?: string | null
          ods_code?: string | null
          pcn_code?: string | null
          phone?: string | null
          postcode?: string | null
          practice_logo_url?: string | null
          practice_manager_name?: string | null
          practice_name?: string
          safeguarding_lead_adults?: string | null
          safeguarding_lead_children?: string | null
          senior_gp_partner?: string | null
          services_offered?: Json | null
          show_page_numbers?: boolean | null
          signature_url?: string | null
          siro?: string | null
          updated_at?: string
          use_for_all_meetings?: boolean | null
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      practice_fridges: {
        Row: {
          created_at: string
          created_by: string
          fridge_name: string
          id: string
          is_active: boolean
          is_online: boolean
          location: string
          max_temp_celsius: number
          min_temp_celsius: number
          practice_id: string
          qr_code_data: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          fridge_name: string
          id?: string
          is_active?: boolean
          is_online?: boolean
          location: string
          max_temp_celsius?: number
          min_temp_celsius?: number
          practice_id: string
          qr_code_data: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          fridge_name?: string
          id?: string
          is_active?: boolean
          is_online?: boolean
          location?: string
          max_temp_celsius?: number
          min_temp_celsius?: number
          practice_id?: string
          qr_code_data?: string
          updated_at?: string
        }
        Relationships: []
      }
      practice_letterheads: {
        Row: {
          active: boolean
          alignment: string
          created_at: string
          height_cm: number
          id: string
          include_all_pages: boolean
          original_filename: string
          original_mime_type: string | null
          practice_id: string
          rendered_height_px: number | null
          rendered_png_path: string | null
          rendered_width_px: number | null
          storage_path: string
          top_margin_cm: number
          updated_at: string
          uploaded_at: string
          uploaded_by: string
          uploaded_by_email: string | null
        }
        Insert: {
          active?: boolean
          alignment?: string
          created_at?: string
          height_cm?: number
          id?: string
          include_all_pages?: boolean
          original_filename: string
          original_mime_type?: string | null
          practice_id: string
          rendered_height_px?: number | null
          rendered_png_path?: string | null
          rendered_width_px?: number | null
          storage_path: string
          top_margin_cm?: number
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
          uploaded_by_email?: string | null
        }
        Update: {
          active?: boolean
          alignment?: string
          created_at?: string
          height_cm?: number
          id?: string
          include_all_pages?: boolean
          original_filename?: string
          original_mime_type?: string | null
          practice_id?: string
          rendered_height_px?: number | null
          rendered_png_path?: string | null
          rendered_width_px?: number | null
          storage_path?: string
          top_margin_cm?: number
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
          uploaded_by_email?: string | null
        }
        Relationships: []
      }
      practice_manager_feedback: {
        Row: {
          comments: string | null
          complaints_system_usefulness: number
          created_at: string
          id: string
          ip_address: unknown
          meeting_manager_usefulness: number
          practice_id: string | null
          practice_name: string | null
          respondent_email: string | null
          respondent_name: string | null
          would_use_complaints_system: number
          would_use_meeting_manager: number
        }
        Insert: {
          comments?: string | null
          complaints_system_usefulness: number
          created_at?: string
          id?: string
          ip_address?: unknown
          meeting_manager_usefulness: number
          practice_id?: string | null
          practice_name?: string | null
          respondent_email?: string | null
          respondent_name?: string | null
          would_use_complaints_system: number
          would_use_meeting_manager: number
        }
        Update: {
          comments?: string | null
          complaints_system_usefulness?: number
          created_at?: string
          id?: string
          ip_address?: unknown
          meeting_manager_usefulness?: number
          practice_id?: string | null
          practice_name?: string | null
          respondent_email?: string | null
          respondent_name?: string | null
          would_use_complaints_system?: number
          would_use_meeting_manager?: number
        }
        Relationships: [
          {
            foreignKeyName: "practice_manager_feedback_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_neighbourhood_assignments: {
        Row: {
          created_at: string | null
          id: string
          is_branch_site: boolean | null
          is_main_site: boolean | null
          neighbourhood_id: string
          notes: string | null
          practice_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_branch_site?: boolean | null
          is_main_site?: boolean | null
          neighbourhood_id: string
          notes?: string | null
          practice_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_branch_site?: boolean | null
          is_main_site?: boolean | null
          neighbourhood_id?: string
          notes?: string | null
          practice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_neighbourhood_assignments_neighbourhood_id_fkey"
            columns: ["neighbourhood_id"]
            isOneToOne: false
            referencedRelation: "neighbourhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_neighbourhood_assignments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_policy_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          configuration_overrides: Json | null
          id: string
          is_active: boolean | null
          notes: string | null
          policy_template_id: string
          practice_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          configuration_overrides?: Json | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          policy_template_id: string
          practice_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          configuration_overrides?: Json | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          policy_template_id?: string
          practice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_policy_assignments_policy_template_id_fkey"
            columns: ["policy_template_id"]
            isOneToOne: false
            referencedRelation: "policy_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_staff_defaults: {
        Row: {
          created_at: string
          default_email: string
          default_phone: string | null
          id: string
          is_active: boolean
          practice_id: string | null
          staff_name: string
          staff_role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_email: string
          default_phone?: string | null
          id?: string
          is_active?: boolean
          practice_id?: string | null
          staff_name: string
          staff_role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_email?: string
          default_phone?: string | null
          id?: string
          is_active?: boolean
          practice_id?: string | null
          staff_name?: string
          staff_role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_staff_defaults_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_details"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_sessions: {
        Row: {
          background_image: string | null
          complexity_level: string
          created_at: string
          id: string
          presentation_type: string
          slide_count: number
          slide_images: Json | null
          slides: Json
          source_documents: Json | null
          template_id: string
          title: string
          topic: string
          updated_at: string
          user_id: string
          voice_id: string
          voice_name: string
        }
        Insert: {
          background_image?: string | null
          complexity_level: string
          created_at?: string
          id?: string
          presentation_type: string
          slide_count: number
          slide_images?: Json | null
          slides?: Json
          source_documents?: Json | null
          template_id: string
          title: string
          topic: string
          updated_at?: string
          user_id: string
          voice_id: string
          voice_name: string
        }
        Update: {
          background_image?: string | null
          complexity_level?: string
          created_at?: string
          id?: string
          presentation_type?: string
          slide_count?: number
          slide_images?: Json | null
          slides?: Json
          source_documents?: Json | null
          template_id?: string
          title?: string
          topic?: string
          updated_at?: string
          user_id?: string
          voice_id?: string
          voice_name?: string
        }
        Relationships: []
      }
      primary_care_networks: {
        Row: {
          created_at: string
          id: string
          pcn_code: string
          pcn_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          pcn_code: string
          pcn_name: string
        }
        Update: {
          created_at?: string
          id?: string
          pcn_code?: string
          pcn_name?: string
        }
        Relationships: []
      }
      profile_change_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          policies_affected: number
          practice_id: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          policies_affected?: number
          practice_id?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          policies_affected?: number
          practice_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ai4gp_access: boolean | null
          ai4gp_chat_retention_days: number | null
          ai4gp_disclaimer_collapsed: boolean | null
          created_at: string
          default_home_page_desktop: string | null
          default_home_page_mobile: string | null
          department: string | null
          email: string
          email_signature: string | null
          full_name: string
          id: string
          last_login: string | null
          letter_signature: string | null
          meeting_retention_policy: string | null
          mic_test_service_visible: boolean
          nhs_trust: string | null
          northamptonshire_icb_active: boolean | null
          phone: string | null
          role: string | null
          shared_drive_visible: boolean
          show_ai_service: boolean | null
          show_ai4gp_disclaimer: boolean | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai4gp_access?: boolean | null
          ai4gp_chat_retention_days?: number | null
          ai4gp_disclaimer_collapsed?: boolean | null
          created_at?: string
          default_home_page_desktop?: string | null
          default_home_page_mobile?: string | null
          department?: string | null
          email: string
          email_signature?: string | null
          full_name: string
          id?: string
          last_login?: string | null
          letter_signature?: string | null
          meeting_retention_policy?: string | null
          mic_test_service_visible?: boolean
          nhs_trust?: string | null
          northamptonshire_icb_active?: boolean | null
          phone?: string | null
          role?: string | null
          shared_drive_visible?: boolean
          show_ai_service?: boolean | null
          show_ai4gp_disclaimer?: boolean | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai4gp_access?: boolean | null
          ai4gp_chat_retention_days?: number | null
          ai4gp_disclaimer_collapsed?: boolean | null
          created_at?: string
          default_home_page_desktop?: string | null
          default_home_page_mobile?: string | null
          department?: string | null
          email?: string
          email_signature?: string | null
          full_name?: string
          id?: string
          last_login?: string | null
          letter_signature?: string | null
          meeting_retention_policy?: string | null
          mic_test_service_visible?: boolean
          nhs_trust?: string | null
          northamptonshire_icb_active?: boolean | null
          phone?: string | null
          role?: string | null
          shared_drive_visible?: boolean
          show_ai_service?: boolean | null
          show_ai4gp_disclaimer?: boolean | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quick_record_tokens: {
        Row: {
          created_at: string
          device_name: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      raw_transcript_chunks: {
        Row: {
          chunk_id: number
          confidence: number | null
          created_at: string
          id: string
          meeting_id: string
          text: string
          timestamp: string
          updated_at: string
        }
        Insert: {
          chunk_id: number
          confidence?: number | null
          created_at?: string
          id?: string
          meeting_id: string
          text: string
          timestamp: string
          updated_at?: string
        }
        Update: {
          chunk_id?: number
          confidence?: number | null
          created_at?: string
          id?: string
          meeting_id?: string
          text?: string
          timestamp?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_transcript_chunks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      realtime_transcription_sessions: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          session_token: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          session_token?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          session_token?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reception_translation_messages: {
        Row: {
          created_at: string
          id: string
          original_text: string
          session_id: string
          source_language: string
          speaker: string
          target_language: string
          translated_text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_text: string
          session_id: string
          source_language: string
          speaker: string
          target_language: string
          translated_text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          original_text?: string
          session_id?: string
          source_language?: string
          speaker?: string
          target_language?: string
          translated_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reception_translation_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "reception_translation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      reception_translation_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          is_active: boolean
          is_training: boolean
          notes: string | null
          patient_language: string
          session_title: string | null
          session_token: string
          total_messages: number | null
          training_scenario: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          is_training?: boolean
          notes?: string | null
          patient_language: string
          session_title?: string | null
          session_token: string
          total_messages?: number | null
          training_scenario?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          is_training?: boolean
          notes?: string | null
          patient_language?: string
          session_title?: string | null
          session_token?: string
          total_messages?: number | null
          training_scenario?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referral_destinations: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string | null
          created_by: string | null
          department: string
          email: string | null
          fax: string | null
          hospital_name: string
          id: string
          is_active: boolean | null
          notes: string | null
          phone: string | null
          practice_id: string | null
          specialty_keywords: string[] | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          department: string
          email?: string | null
          fax?: string | null
          hospital_name: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          phone?: string | null
          practice_id?: string | null
          specialty_keywords?: string[] | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string
          email?: string | null
          fax?: string | null
          hospital_name?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          phone?: string | null
          practice_id?: string | null
          specialty_keywords?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_destinations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      replacement_shifts: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          assignment_date: string
          bank_holiday_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          end_time: string
          hours: number
          id: string
          location: string
          notes: string | null
          required_role: string
          shift_template_id: string | null
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          assignment_date: string
          bank_holiday_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          end_time: string
          hours: number
          id?: string
          location: string
          notes?: string | null
          required_role: string
          shift_template_id?: string | null
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          assignment_date?: string
          bank_holiday_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string
          hours?: number
          id?: string
          location?: string
          notes?: string | null
          required_role?: string
          shift_template_id?: string | null
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "replacement_shifts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_shifts_bank_holiday_id_fkey"
            columns: ["bank_holiday_id"]
            isOneToOne: false
            referencedRelation: "bank_holidays_closed_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_shifts_shift_template_id_fkey"
            columns: ["shift_template_id"]
            isOneToOne: false
            referencedRelation: "shift_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          event_details: Json | null
          event_timestamp: string
          event_type: string
          id: string
          ip_address: unknown
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_details?: Json | null
          event_timestamp?: string
          event_type: string
          id?: string
          ip_address?: unknown
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_details?: Json | null
          event_timestamp?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_scan_findings: {
        Row: {
          category: string | null
          created_at: string
          description: string
          details: string | null
          finding_id: string
          id: string
          level: string
          name: string
          resolved_at: string | null
          scan_id: string
          scanned_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description: string
          details?: string | null
          finding_id: string
          id?: string
          level: string
          name: string
          resolved_at?: string | null
          scan_id: string
          scanned_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string
          details?: string | null
          finding_id?: string
          id?: string
          level?: string
          name?: string
          resolved_at?: string | null
          scan_id?: string
          scanned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_scan_findings_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "security_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      security_scans: {
        Row: {
          created_at: string
          error_count: number
          id: string
          info_count: number
          scan_type: string | null
          scanned_at: string
          total_findings: number
          triggered_by: string | null
          warn_count: number
        }
        Insert: {
          created_at?: string
          error_count?: number
          id?: string
          info_count?: number
          scan_type?: string | null
          scanned_at?: string
          total_findings?: number
          triggered_by?: string | null
          warn_count?: number
        }
        Update: {
          created_at?: string
          error_count?: number
          id?: string
          info_count?: number
          scan_type?: string | null
          scanned_at?: string
          total_findings?: number
          triggered_by?: string | null
          warn_count?: number
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          description: string | null
          id: string
          is_active: boolean | null
          setting_name: string
          setting_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          is_active?: boolean | null
          setting_name: string
          setting_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          is_active?: boolean | null
          setting_name?: string
          setting_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      shared_drive_activity: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          target_id: string
          target_name: string
          target_type: Database["public"]["Enums"]["file_type"]
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id: string
          target_name: string
          target_type: Database["public"]["Enums"]["file_type"]
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string
          target_name?: string
          target_type?: Database["public"]["Enums"]["file_type"]
          user_id?: string
        }
        Relationships: []
      }
      shared_drive_files: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          file_path: string
          file_size: number | null
          file_type: string | null
          folder_id: string | null
          id: string
          mime_type: string | null
          name: string
          original_name: string
          scope: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name: string
          original_name: string
          scope?: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          original_name?: string
          scope?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_drive_files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "shared_drive_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_drive_folders: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          parent_id: string | null
          path: string
          scope: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          parent_id?: string | null
          path: string
          scope?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          parent_id?: string | null
          path?: string
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_drive_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "shared_drive_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_drive_permissions: {
        Row: {
          actions: Database["public"]["Enums"]["permission_action"][]
          created_at: string
          granted_by: string
          id: string
          is_inherited: boolean
          permission_level: Database["public"]["Enums"]["permission_level"]
          target_id: string
          target_type: Database["public"]["Enums"]["file_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          actions?: Database["public"]["Enums"]["permission_action"][]
          created_at?: string
          granted_by: string
          id?: string
          is_inherited?: boolean
          permission_level: Database["public"]["Enums"]["permission_level"]
          target_id: string
          target_type: Database["public"]["Enums"]["file_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          actions?: Database["public"]["Enums"]["permission_action"][]
          created_at?: string
          granted_by?: string
          id?: string
          is_inherited?: boolean
          permission_level?: Database["public"]["Enums"]["permission_level"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["file_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shift_templates: {
        Row: {
          allow_all_staff: boolean | null
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          location: Database["public"]["Enums"]["work_location"]
          name: string
          required_role: Database["public"]["Enums"]["staff_role"]
          start_time: string
          updated_at: string
        }
        Insert: {
          allow_all_staff?: boolean | null
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          location: Database["public"]["Enums"]["work_location"]
          name: string
          required_role: Database["public"]["Enums"]["staff_role"]
          start_time: string
          updated_at?: string
        }
        Update: {
          allow_all_staff?: boolean | null
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          location?: Database["public"]["Enums"]["work_location"]
          name?: string
          required_role?: Database["public"]["Enums"]["staff_role"]
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      snomed_codes: {
        Row: {
          cluster_description: string
          code_description: string
          created_at: string | null
          domain: string | null
          id: string
          snomed_code: string
          source_document: string | null
        }
        Insert: {
          cluster_description: string
          code_description: string
          created_at?: string | null
          domain?: string | null
          id?: string
          snomed_code: string
          source_document?: string | null
        }
        Update: {
          cluster_description?: string
          code_description?: string
          created_at?: string | null
          domain?: string | null
          id?: string
          snomed_code?: string
          source_document?: string | null
        }
        Relationships: []
      }
      specialist_services: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          department: string | null
          email: string | null
          hospital_name: string | null
          id: string
          is_default: boolean | null
          notes: string | null
          phone: string | null
          service_name: string
          specialty_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          hospital_name?: string | null
          id?: string
          is_default?: boolean | null
          notes?: string | null
          phone?: string | null
          service_name: string
          specialty_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          hospital_name?: string | null
          id?: string
          is_default?: boolean | null
          notes?: string | null
          phone?: string | null
          service_name?: string
          specialty_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_assignments: {
        Row: {
          assigned_by: string | null
          assignment_date: string
          created_at: string
          end_time: string
          hours_worked: number | null
          id: string
          location: Database["public"]["Enums"]["work_location"]
          notes: string | null
          shift_template_id: string | null
          staff_member_id: string | null
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assignment_date: string
          created_at?: string
          end_time: string
          hours_worked?: number | null
          id?: string
          location: Database["public"]["Enums"]["work_location"]
          notes?: string | null
          shift_template_id?: string | null
          staff_member_id?: string | null
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assignment_date?: string
          created_at?: string
          end_time?: string
          hours_worked?: number | null
          id?: string
          location?: Database["public"]["Enums"]["work_location"]
          notes?: string | null
          shift_template_id?: string | null
          staff_member_id?: string | null
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_assignments_shift_template_id_fkey"
            columns: ["shift_template_id"]
            isOneToOne: false
            referencedRelation: "shift_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_assignments_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_hours_summary: {
        Row: {
          id: string
          month: number
          staff_member_id: string | null
          total_hours: number
          total_shifts: number
          updated_at: string
          week_number: number
          year: number
        }
        Insert: {
          id?: string
          month: number
          staff_member_id?: string | null
          total_hours?: number
          total_shifts?: number
          updated_at?: string
          week_number: number
          year: number
        }
        Update: {
          id?: string
          month?: number
          staff_member_id?: string | null
          total_hours?: number
          total_shifts?: number
          updated_at?: string
          week_number?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_hours_summary_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          created_at: string
          email: string
          gp_onsite_rate: number | null
          gp_remote_rate: number | null
          hourly_rate: number | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          gp_onsite_rate?: number | null
          gp_remote_rate?: number | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          gp_onsite_rate?: number | null
          gp_remote_rate?: number | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      staff_responses: {
        Row: {
          complaint_id: string
          created_at: string
          id: string
          responded_at: string
          responded_by: string | null
          response_text: string
          staff_email: string
          staff_name: string
          staff_role: string | null
          updated_at: string
        }
        Insert: {
          complaint_id: string
          created_at?: string
          id?: string
          responded_at?: string
          responded_by?: string | null
          response_text: string
          staff_email: string
          staff_name: string
          staff_role?: string | null
          updated_at?: string
        }
        Update: {
          complaint_id?: string
          created_at?: string
          id?: string
          responded_at?: string
          responded_by?: string | null
          response_text?: string
          staff_email?: string
          staff_name?: string
          staff_role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_responses_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_images: {
        Row: {
          category: string
          created_at: string
          description: string | null
          file_size: number | null
          id: string
          image_url: string
          is_active: boolean
          storage_path: string
          tags: string[] | null
          title: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          file_size?: number | null
          id?: string
          image_url: string
          is_active?: boolean
          storage_path: string
          tags?: string[] | null
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          file_size?: number | null
          id?: string
          image_url?: string
          is_active?: boolean
          storage_path?: string
          tags?: string[] | null
          title?: string
        }
        Relationships: []
      }
      supplier_incidents: {
        Row: {
          actual_completion_date: string | null
          closed_at: string | null
          closed_by: string | null
          corrective_actions: string | null
          created_at: string
          dcb0129_compliant: boolean | null
          dcb0160_compliant: boolean | null
          description: string
          id: string
          immediate_actions_taken: string | null
          impact_assessment: string | null
          incident_reference: string
          incident_type: string
          lessons_learned: string | null
          practice_id: string | null
          preventive_actions: string | null
          regulatory_notification_date: string | null
          regulatory_notification_required: boolean | null
          regulatory_notification_sent: boolean | null
          reported_by: string
          reported_date: string
          root_cause_analysis: string | null
          severity: string
          status: string
          supplier_name: string
          system_component: string
          target_completion_date: string | null
          updated_at: string
        }
        Insert: {
          actual_completion_date?: string | null
          closed_at?: string | null
          closed_by?: string | null
          corrective_actions?: string | null
          created_at?: string
          dcb0129_compliant?: boolean | null
          dcb0160_compliant?: boolean | null
          description: string
          id?: string
          immediate_actions_taken?: string | null
          impact_assessment?: string | null
          incident_reference: string
          incident_type: string
          lessons_learned?: string | null
          practice_id?: string | null
          preventive_actions?: string | null
          regulatory_notification_date?: string | null
          regulatory_notification_required?: boolean | null
          regulatory_notification_sent?: boolean | null
          reported_by: string
          reported_date?: string
          root_cause_analysis?: string | null
          severity?: string
          status?: string
          supplier_name: string
          system_component: string
          target_completion_date?: string | null
          updated_at?: string
        }
        Update: {
          actual_completion_date?: string | null
          closed_at?: string | null
          closed_by?: string | null
          corrective_actions?: string | null
          created_at?: string
          dcb0129_compliant?: boolean | null
          dcb0160_compliant?: boolean | null
          description?: string
          id?: string
          immediate_actions_taken?: string | null
          impact_assessment?: string | null
          incident_reference?: string
          incident_type?: string
          lessons_learned?: string | null
          practice_id?: string | null
          preventive_actions?: string | null
          regulatory_notification_date?: string | null
          regulatory_notification_required?: boolean | null
          regulatory_notification_sent?: boolean | null
          reported_by?: string
          reported_date?: string
          root_cause_analysis?: string | null
          severity?: string
          status?: string
          supplier_name?: string
          system_component?: string
          target_completion_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      survey_answers: {
        Row: {
          answer_options: Json | null
          answer_rating: number | null
          answer_text: string | null
          id: string
          question_id: string
          response_id: string
        }
        Insert: {
          answer_options?: Json | null
          answer_rating?: number | null
          answer_text?: string | null
          id?: string
          question_id: string
          response_id: string
        }
        Update: {
          answer_options?: Json | null
          answer_rating?: number | null
          answer_text?: string | null
          id?: string
          question_id?: string
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_email_preferences: {
        Row: {
          created_at: string | null
          digest_day: string | null
          id: string
          practice_id: string | null
          receive_weekly_digest: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          digest_day?: string | null
          id?: string
          practice_id?: string | null
          receive_weekly_digest?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          digest_day?: string | null
          id?: string
          practice_id?: string | null
          receive_weekly_digest?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_email_preferences_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_questions: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          is_required: boolean | null
          options: Json | null
          question_text: string
          question_type: string
          survey_id: string
        }
        Insert: {
          created_at?: string | null
          display_order: number
          id?: string
          is_required?: boolean | null
          options?: Json | null
          question_text: string
          question_type: string
          survey_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_required?: boolean | null
          options?: Json | null
          question_text?: string
          question_type?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          id: string
          ip_hash: string | null
          respondent_email: string | null
          respondent_name: string | null
          submitted_at: string | null
          survey_id: string
        }
        Insert: {
          id?: string
          ip_hash?: string | null
          respondent_email?: string | null
          respondent_name?: string | null
          submitted_at?: string | null
          survey_id: string
        }
        Update: {
          id?: string
          ip_hash?: string | null
          respondent_email?: string | null
          respondent_name?: string | null
          submitted_at?: string | null
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          branding_level: string | null
          created_at: string | null
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          is_anonymous: boolean | null
          practice_id: string | null
          public_token: string | null
          short_code: string
          show_practice_logo: boolean | null
          start_date: string | null
          status: string | null
          survey_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          branding_level?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_anonymous?: boolean | null
          practice_id?: string | null
          public_token?: string | null
          short_code: string
          show_practice_logo?: boolean | null
          start_date?: string | null
          status?: string | null
          survey_type: string
          title: string
          updated_at?: string | null
        }
        Update: {
          branding_level?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_anonymous?: boolean | null
          practice_id?: string | null
          public_token?: string | null
          short_code?: string
          show_practice_logo?: boolean | null
          start_date?: string | null
          status?: string | null
          survey_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveys_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      system_audit_log: {
        Row: {
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          operation: string
          practice_id: string | null
          record_id: string | null
          session_id: string | null
          table_name: string
          timestamp: string
          user_agent: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          practice_id?: string | null
          record_id?: string | null
          session_id?: string | null
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          practice_id?: string | null
          record_id?: string | null
          session_id?: string | null
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      system_extensions_info: {
        Row: {
          documented_at: string | null
          extension_name: string
          reason_not_moved: string | null
          security_notes: string | null
        }
        Insert: {
          documented_at?: string | null
          extension_name: string
          reason_not_moved?: string | null
          security_notes?: string | null
        }
        Update: {
          documented_at?: string | null
          extension_name?: string
          reason_not_moved?: string | null
          security_notes?: string | null
        }
        Relationships: []
      }
      system_monitoring_status: {
        Row: {
          check_details: Json | null
          created_at: string
          critical_alerts: number
          id: string
          last_check_at: string
          system_status: string
          total_alerts: number
          warning_alerts: number
        }
        Insert: {
          check_details?: Json | null
          created_at?: string
          critical_alerts?: number
          id?: string
          last_check_at?: string
          system_status: string
          total_alerts?: number
          warning_alerts?: number
        }
        Update: {
          check_details?: Json | null
          created_at?: string
          critical_alerts?: number
          id?: string
          last_check_at?: string
          system_status?: string
          total_alerts?: number
          warning_alerts?: number
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      template_attendees: {
        Row: {
          attendee_id: string
          created_at: string
          id: string
          template_id: string
        }
        Insert: {
          attendee_id: string
          created_at?: string
          id?: string
          template_id: string
        }
        Update: {
          attendee_id?: string
          created_at?: string
          id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_attendees_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_attendees_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "meeting_attendee_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      traffic_light_medicines: {
        Row: {
          antimicrobial_data: Json | null
          bnf_chapter: string | null
          bnf_data: Json | null
          created_at: string | null
          detail_url: string | null
          devices_vaccines_data: Json | null
          formulary_data: Json | null
          icb_region: string | null
          id: string
          last_reviewed_date: string | null
          links_data: Json | null
          monitoring_data: Json | null
          name: string
          notes: string | null
          populations_data: Json | null
          prior_approval_data: Json | null
          prior_approval_url: string | null
          source_document: string | null
          status_enum: string
          status_raw: string | null
          updated_at: string | null
        }
        Insert: {
          antimicrobial_data?: Json | null
          bnf_chapter?: string | null
          bnf_data?: Json | null
          created_at?: string | null
          detail_url?: string | null
          devices_vaccines_data?: Json | null
          formulary_data?: Json | null
          icb_region?: string | null
          id?: string
          last_reviewed_date?: string | null
          links_data?: Json | null
          monitoring_data?: Json | null
          name: string
          notes?: string | null
          populations_data?: Json | null
          prior_approval_data?: Json | null
          prior_approval_url?: string | null
          source_document?: string | null
          status_enum: string
          status_raw?: string | null
          updated_at?: string | null
        }
        Update: {
          antimicrobial_data?: Json | null
          bnf_chapter?: string | null
          bnf_data?: Json | null
          created_at?: string | null
          detail_url?: string | null
          devices_vaccines_data?: Json | null
          formulary_data?: Json | null
          icb_region?: string | null
          id?: string
          last_reviewed_date?: string | null
          links_data?: Json | null
          monitoring_data?: Json | null
          name?: string
          notes?: string | null
          populations_data?: Json | null
          prior_approval_data?: Json | null
          prior_approval_url?: string | null
          source_document?: string | null
          status_enum?: string
          status_raw?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      transcript_cleaning_jobs: {
        Row: {
          batch_id: string | null
          chunk_id: string | null
          chunks_processed: number | null
          cleaned_transcript_length: number | null
          created_at: string
          error_message: string | null
          id: string
          is_realtime_cleaning: boolean | null
          meeting_id: string | null
          original_transcript_length: number
          processing_duration_ms: number | null
          processing_end_time: string | null
          processing_start_time: string | null
          processing_status: string
          total_chunks: number | null
          updated_at: string
          word_count: number
        }
        Insert: {
          batch_id?: string | null
          chunk_id?: string | null
          chunks_processed?: number | null
          cleaned_transcript_length?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          is_realtime_cleaning?: boolean | null
          meeting_id?: string | null
          original_transcript_length: number
          processing_duration_ms?: number | null
          processing_end_time?: string | null
          processing_start_time?: string | null
          processing_status?: string
          total_chunks?: number | null
          updated_at?: string
          word_count: number
        }
        Update: {
          batch_id?: string | null
          chunk_id?: string | null
          chunks_processed?: number | null
          cleaned_transcript_length?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          is_realtime_cleaning?: boolean | null
          meeting_id?: string | null
          original_transcript_length?: number
          processing_duration_ms?: number | null
          processing_end_time?: string | null
          processing_start_time?: string | null
          processing_status?: string
          total_chunks?: number | null
          updated_at?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "transcript_cleaning_jobs_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "meeting_transcription_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcript_cleaning_jobs_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_cleaning_stats: {
        Row: {
          average_processing_time_ms: number
          created_at: string
          date: string
          id: string
          total_jobs_completed: number
          total_jobs_failed: number
          total_jobs_processed: number
          total_processing_time_ms: number
          total_transcripts_cleaned: number
          total_words_processed: number
          updated_at: string
        }
        Insert: {
          average_processing_time_ms?: number
          created_at?: string
          date?: string
          id?: string
          total_jobs_completed?: number
          total_jobs_failed?: number
          total_jobs_processed?: number
          total_processing_time_ms?: number
          total_transcripts_cleaned?: number
          total_words_processed?: number
          updated_at?: string
        }
        Update: {
          average_processing_time_ms?: number
          created_at?: string
          date?: string
          id?: string
          total_jobs_completed?: number
          total_jobs_failed?: number
          total_jobs_processed?: number
          total_processing_time_ms?: number
          total_transcripts_cleaned?: number
          total_words_processed?: number
          updated_at?: string
        }
        Relationships: []
      }
      transcription_chunks: {
        Row: {
          audio_chunk_id: string | null
          chunk_number: number
          confidence: number | null
          created_at: string | null
          id: string
          language: string | null
          meeting_id: string | null
          processing_time_ms: number | null
          transcript_text: string
        }
        Insert: {
          audio_chunk_id?: string | null
          chunk_number: number
          confidence?: number | null
          created_at?: string | null
          id?: string
          language?: string | null
          meeting_id?: string | null
          processing_time_ms?: number | null
          transcript_text: string
        }
        Update: {
          audio_chunk_id?: string | null
          chunk_number?: number
          confidence?: number | null
          created_at?: string | null
          id?: string
          language?: string | null
          meeting_id?: string | null
          processing_time_ms?: number | null
          transcript_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcription_chunks_audio_chunk_id_fkey"
            columns: ["audio_chunk_id"]
            isOneToOne: false
            referencedRelation: "audio_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcription_chunks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      transcription_pilot_runs: {
        Row: {
          assemblyai_cost_usd: number | null
          assemblyai_error: string | null
          assemblyai_latency_ms: number | null
          assemblyai_text: string | null
          audio_duration_seconds: number | null
          audio_mime_type: string | null
          audio_size_bytes: number | null
          created_at: string
          gpt4o_cost_usd: number | null
          gpt4o_error: string | null
          gpt4o_latency_ms: number | null
          gpt4o_mini_cost_usd: number | null
          gpt4o_mini_error: string | null
          gpt4o_mini_latency_ms: number | null
          gpt4o_mini_text: string | null
          gpt4o_text: string | null
          id: string
          label: string | null
          notes: string | null
          prompt_used: string | null
          user_id: string
          whisper1_cost_usd: number | null
          whisper1_error: string | null
          whisper1_latency_ms: number | null
          whisper1_text: string | null
        }
        Insert: {
          assemblyai_cost_usd?: number | null
          assemblyai_error?: string | null
          assemblyai_latency_ms?: number | null
          assemblyai_text?: string | null
          audio_duration_seconds?: number | null
          audio_mime_type?: string | null
          audio_size_bytes?: number | null
          created_at?: string
          gpt4o_cost_usd?: number | null
          gpt4o_error?: string | null
          gpt4o_latency_ms?: number | null
          gpt4o_mini_cost_usd?: number | null
          gpt4o_mini_error?: string | null
          gpt4o_mini_latency_ms?: number | null
          gpt4o_mini_text?: string | null
          gpt4o_text?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          prompt_used?: string | null
          user_id: string
          whisper1_cost_usd?: number | null
          whisper1_error?: string | null
          whisper1_latency_ms?: number | null
          whisper1_text?: string | null
        }
        Update: {
          assemblyai_cost_usd?: number | null
          assemblyai_error?: string | null
          assemblyai_latency_ms?: number | null
          assemblyai_text?: string | null
          audio_duration_seconds?: number | null
          audio_mime_type?: string | null
          audio_size_bytes?: number | null
          created_at?: string
          gpt4o_cost_usd?: number | null
          gpt4o_error?: string | null
          gpt4o_latency_ms?: number | null
          gpt4o_mini_cost_usd?: number | null
          gpt4o_mini_error?: string | null
          gpt4o_mini_latency_ms?: number | null
          gpt4o_mini_text?: string | null
          gpt4o_text?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          prompt_used?: string | null
          user_id?: string
          whisper1_cost_usd?: number | null
          whisper1_error?: string | null
          whisper1_latency_ms?: number | null
          whisper1_text?: string | null
        }
        Relationships: []
      }
      translation_documents: {
        Row: {
          clinical_verification: Json | null
          created_at: string | null
          detected_language: string | null
          error_message: string | null
          file_name: string
          file_type: string
          file_url: string | null
          id: string
          original_text: string | null
          session_id: string
          status: string | null
          thumbnail_url: string | null
          translated_text: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          clinical_verification?: Json | null
          created_at?: string | null
          detected_language?: string | null
          error_message?: string | null
          file_name: string
          file_type: string
          file_url?: string | null
          id?: string
          original_text?: string | null
          session_id: string
          status?: string | null
          thumbnail_url?: string | null
          translated_text?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          clinical_verification?: Json | null
          created_at?: string | null
          detected_language?: string | null
          error_message?: string | null
          file_name?: string
          file_type?: string
          file_url?: string | null
          id?: string
          original_text?: string | null
          session_id?: string
          status?: string | null
          thumbnail_url?: string | null
          translated_text?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "translation_documents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "reception_translation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_sessions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_flagged: boolean
          is_protected: boolean
          patient_language: string
          session_end: string | null
          session_metadata: Json | null
          session_start: string
          session_title: string
          total_translations: number
          translation_scores: Json
          translation_type: string | null
          translations: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_flagged?: boolean
          is_protected?: boolean
          patient_language?: string
          session_end?: string | null
          session_metadata?: Json | null
          session_start?: string
          session_title: string
          total_translations?: number
          translation_scores?: Json
          translation_type?: string | null
          translations?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_flagged?: boolean
          is_protected?: boolean
          patient_language?: string
          session_end?: string | null
          session_metadata?: Json | null
          session_start?: string
          session_title?: string
          total_translations?: number
          translation_scores?: Json
          translation_type?: string | null
          translations?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_document_settings: {
        Row: {
          action_items_on: boolean | null
          attendees_on: boolean | null
          audio_mode: string
          decisions_register_on: boolean | null
          discussion_summary_on: boolean | null
          exec_summary_on: boolean | null
          footer_on: boolean | null
          id: string
          logo_on: boolean | null
          logo_position: string | null
          logo_scale: number | null
          meeting_details_on: boolean | null
          next_meeting_on: boolean | null
          notes_length: string
          open_items_on: boolean | null
          preferred_mic_device_id: string | null
          preferred_mic_label: string | null
          priority_column_on: boolean
          section_actions: boolean
          section_attendees: boolean
          section_decisions: boolean
          section_exec_summary: boolean
          section_full_transcript: boolean
          section_key_points: boolean
          section_next_meeting: boolean
          section_open_items: boolean
          transcription_engine: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          action_items_on?: boolean | null
          attendees_on?: boolean | null
          audio_mode?: string
          decisions_register_on?: boolean | null
          discussion_summary_on?: boolean | null
          exec_summary_on?: boolean | null
          footer_on?: boolean | null
          id?: string
          logo_on?: boolean | null
          logo_position?: string | null
          logo_scale?: number | null
          meeting_details_on?: boolean | null
          next_meeting_on?: boolean | null
          notes_length?: string
          open_items_on?: boolean | null
          preferred_mic_device_id?: string | null
          preferred_mic_label?: string | null
          priority_column_on?: boolean
          section_actions?: boolean
          section_attendees?: boolean
          section_decisions?: boolean
          section_exec_summary?: boolean
          section_full_transcript?: boolean
          section_key_points?: boolean
          section_next_meeting?: boolean
          section_open_items?: boolean
          transcription_engine?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          action_items_on?: boolean | null
          attendees_on?: boolean | null
          audio_mode?: string
          decisions_register_on?: boolean | null
          discussion_summary_on?: boolean | null
          exec_summary_on?: boolean | null
          footer_on?: boolean | null
          id?: string
          logo_on?: boolean | null
          logo_position?: string | null
          logo_scale?: number | null
          meeting_details_on?: boolean | null
          next_meeting_on?: boolean | null
          notes_length?: string
          open_items_on?: boolean | null
          preferred_mic_device_id?: string | null
          preferred_mic_label?: string | null
          priority_column_on?: boolean
          section_actions?: boolean
          section_attendees?: boolean
          section_decisions?: boolean
          section_exec_summary?: boolean
          section_full_transcript?: boolean
          section_key_points?: boolean
          section_next_meeting?: boolean
          section_open_items?: boolean
          transcription_engine?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_generated_images: {
        Row: {
          alt_text: string | null
          category: string | null
          created_at: string | null
          detailed_prompt: string | null
          id: string
          image_settings: Json | null
          image_url: string
          is_favourite: boolean | null
          prompt: string
          quick_pick_id: string | null
          source: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          alt_text?: string | null
          category?: string | null
          created_at?: string | null
          detailed_prompt?: string | null
          id?: string
          image_settings?: Json | null
          image_url: string
          is_favourite?: boolean | null
          prompt: string
          quick_pick_id?: string | null
          source?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          alt_text?: string | null
          category?: string | null
          created_at?: string | null
          detailed_prompt?: string | null
          id?: string
          image_settings?: Json | null
          image_url?: string
          is_favourite?: boolean | null
          prompt?: string
          quick_pick_id?: string | null
          source?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_generated_images_archive: {
        Row: {
          alt_text: string | null
          archived_at: string
          category: string | null
          created_at: string
          detailed_prompt: string | null
          id: string
          image_settings: Json | null
          image_url: string
          is_favourite: boolean | null
          prompt: string | null
          quick_pick_id: string | null
          source: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          alt_text?: string | null
          archived_at?: string
          category?: string | null
          created_at: string
          detailed_prompt?: string | null
          id: string
          image_settings?: Json | null
          image_url: string
          is_favourite?: boolean | null
          prompt?: string | null
          quick_pick_id?: string | null
          source?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          alt_text?: string | null
          archived_at?: string
          category?: string | null
          created_at?: string
          detailed_prompt?: string | null
          id?: string
          image_settings?: Json | null
          image_url?: string
          is_favourite?: boolean | null
          prompt?: string | null
          quick_pick_id?: string | null
          source?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_image_defaults: {
        Row: {
          created_at: string | null
          id: string
          image_id: string | null
          template_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_id?: string | null
          template_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_id?: string | null
          template_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_image_defaults_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "user_generated_images"
            referencedColumns: ["id"]
          },
        ]
      }
      user_logos: {
        Row: {
          created_at: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_modules: {
        Row: {
          created_at: string
          enabled: boolean
          granted_at: string
          granted_by: string | null
          id: string
          module: Database["public"]["Enums"]["app_module"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          granted_at?: string
          granted_by?: string | null
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          granted_at?: string
          granted_by?: string | null
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_name_corrections: {
        Row: {
          correct_spelling: string
          created_at: string
          id: string
          incorrect_spelling: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          correct_spelling: string
          created_at?: string
          id?: string
          incorrect_spelling: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          correct_spelling?: string
          created_at?: string
          id?: string
          incorrect_spelling?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          agewell_access: boolean
          api_testing_service_access: boolean | null
          assigned_at: string | null
          assigned_by: string | null
          bp_service_access: boolean | null
          can_export_narp_identifiable: boolean
          can_view_narp_identifiable: boolean
          complaints_admin_access: boolean | null
          complaints_manager_access: boolean | null
          cqc_compliance_access: boolean | null
          created_at: string | null
          cso_governance_access: boolean | null
          document_signoff_access: boolean | null
          enhanced_access: boolean | null
          fridge_monitoring_access: boolean
          gp_scribe_access: boolean | null
          id: string
          lg_capture_access: boolean | null
          meeting_notes_access: boolean | null
          mic_test_service_access: boolean | null
          narp_upload_access: boolean
          practice_id: string | null
          practice_role: Database["public"]["Enums"]["practice_role"] | null
          replywell_access: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          shared_drive_access: boolean | null
          show_consultation_examples: boolean | null
          survey_manager_access: boolean | null
          translation_service_access: boolean | null
          user_id: string
        }
        Insert: {
          agewell_access?: boolean
          api_testing_service_access?: boolean | null
          assigned_at?: string | null
          assigned_by?: string | null
          bp_service_access?: boolean | null
          can_export_narp_identifiable?: boolean
          can_view_narp_identifiable?: boolean
          complaints_admin_access?: boolean | null
          complaints_manager_access?: boolean | null
          cqc_compliance_access?: boolean | null
          created_at?: string | null
          cso_governance_access?: boolean | null
          document_signoff_access?: boolean | null
          enhanced_access?: boolean | null
          fridge_monitoring_access?: boolean
          gp_scribe_access?: boolean | null
          id?: string
          lg_capture_access?: boolean | null
          meeting_notes_access?: boolean | null
          mic_test_service_access?: boolean | null
          narp_upload_access?: boolean
          practice_id?: string | null
          practice_role?: Database["public"]["Enums"]["practice_role"] | null
          replywell_access?: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          shared_drive_access?: boolean | null
          show_consultation_examples?: boolean | null
          survey_manager_access?: boolean | null
          translation_service_access?: boolean | null
          user_id: string
        }
        Update: {
          agewell_access?: boolean
          api_testing_service_access?: boolean | null
          assigned_at?: string | null
          assigned_by?: string | null
          bp_service_access?: boolean | null
          can_export_narp_identifiable?: boolean
          can_view_narp_identifiable?: boolean
          complaints_admin_access?: boolean | null
          complaints_manager_access?: boolean | null
          cqc_compliance_access?: boolean | null
          created_at?: string | null
          cso_governance_access?: boolean | null
          document_signoff_access?: boolean | null
          enhanced_access?: boolean | null
          fridge_monitoring_access?: boolean
          gp_scribe_access?: boolean | null
          id?: string
          lg_capture_access?: boolean | null
          meeting_notes_access?: boolean | null
          mic_test_service_access?: boolean | null
          narp_upload_access?: boolean
          practice_id?: string | null
          practice_role?: Database["public"]["Enums"]["practice_role"] | null
          replywell_access?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          shared_drive_access?: boolean | null
          show_consultation_examples?: boolean | null
          survey_manager_access?: boolean | null
          translation_service_access?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      user_service_activations: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          created_at: string | null
          id: string
          notes: string | null
          service: Database["public"]["Enums"]["service_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          service: Database["public"]["Enums"]["service_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          service?: Database["public"]["Enums"]["service_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          id: string
          ip_address: unknown
          is_active: boolean | null
          last_activity: string
          login_time: string
          logout_reason: string | null
          logout_time: string | null
          practice_id: string | null
          session_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          last_activity?: string
          login_time?: string
          logout_reason?: string | null
          logout_time?: string | null
          practice_id?: string | null
          session_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          last_activity?: string
          login_time?: string
          logout_reason?: string | null
          logout_time?: string | null
          practice_id?: string | null
          session_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_validation_corrections: {
        Row: {
          confidence_score: number | null
          context: string | null
          correct_term: string
          created_at: string
          frequency_count: number | null
          id: string
          incorrect_term: string
          last_used_at: string | null
          practice_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence_score?: number | null
          context?: string | null
          correct_term: string
          created_at?: string
          frequency_count?: number | null
          id?: string
          incorrect_term: string
          last_used_at?: string | null
          practice_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence_score?: number | null
          context?: string | null
          correct_term?: string
          created_at?: string
          frequency_count?: number | null
          id?: string
          incorrect_term?: string
          last_used_at?: string | null
          practice_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vault_favourites: {
        Row: {
          created_at: string
          file_id: string
          id: string
          scope: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_id: string
          id?: string
          scope?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_id?: string
          id?: string
          scope?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_favourites_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "shared_drive_files"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      complaint_involved_parties_secure: {
        Row: {
          access_token_expires_at: string | null
          access_token_last_used_at: string | null
          complaint_id: string | null
          created_at: string | null
          id: string | null
          response_requested_at: string | null
          response_submitted_at: string | null
          response_text: string | null
          staff_email: string | null
          staff_name: string | null
          staff_role: string | null
        }
        Insert: {
          access_token_expires_at?: string | null
          access_token_last_used_at?: string | null
          complaint_id?: string | null
          created_at?: string | null
          id?: string | null
          response_requested_at?: string | null
          response_submitted_at?: string | null
          response_text?: string | null
          staff_email?: string | null
          staff_name?: string | null
          staff_role?: string | null
        }
        Update: {
          access_token_expires_at?: string | null
          access_token_last_used_at?: string | null
          complaint_id?: string | null
          created_at?: string | null
          id?: string | null
          response_requested_at?: string | null
          response_submitted_at?: string | null
          response_text?: string | null
          staff_email?: string | null
          staff_name?: string | null
          staff_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_involved_parties_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      icn_tl_norm: {
        Row: {
          bnf_chapter: string | null
          detail_url: string | null
          drug_name: string | null
          id: string | null
          last_modified: string | null
          name_norm: string | null
          notes: string | null
          status_enum: string | null
        }
        Insert: {
          bnf_chapter?: string | null
          detail_url?: string | null
          drug_name?: string | null
          id?: string | null
          last_modified?: string | null
          name_norm?: never
          notes?: string | null
          status_enum?: string | null
        }
        Update: {
          bnf_chapter?: string | null
          detail_url?: string | null
          drug_name?: string | null
          id?: string | null
          last_modified?: string | null
          name_norm?: never
          notes?: string | null
          status_enum?: string | null
        }
        Relationships: []
      }
      public_fridge_qr_view: {
        Row: {
          generic_location: string | null
          id: string | null
          is_active: boolean | null
          qr_code_data: string | null
        }
        Insert: {
          generic_location?: string | null
          id?: string | null
          is_active?: boolean | null
          qr_code_data?: string | null
        }
        Update: {
          generic_location?: string | null
          id?: string | null
          is_active?: boolean | null
          qr_code_data?: string | null
        }
        Relationships: []
      }
      public_practice_feedback: {
        Row: {
          avg_complaints_interest: number | null
          avg_complaints_usefulness: number | null
          avg_meeting_manager_interest: number | null
          avg_meeting_manager_usefulness: number | null
          feedback_count: number | null
          feedback_month: string | null
          practice_name: string | null
        }
        Relationships: []
      }
      security_audit_functions: {
        Row: {
          arguments: string | null
          function_name: unknown
          schema_name: unknown
          search_path_status: string | null
          security_type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _narp_pepper: { Args: never; Returns: string }
      admin_list_user_generated_images: {
        Args: never
        Returns: {
          category: string
          created_at: string
          id: string
          image_url: string
          prompt: string
          source: string
          title: string
          user_id: string
        }[]
      }
      assign_policy_to_all_practices: {
        Args: { p_assigned_by?: string; p_policy_template_id: string }
        Returns: number
      }
      assign_user_to_practice: {
        Args: {
          p_assigned_by?: string
          p_practice_id: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: string
      }
      auth_email: { Args: never; Returns: string }
      can_access_enn_vault_item: {
        Args: { p_target_id: string; p_target_type: string; p_user_id: string }
        Returns: boolean
      }
      can_access_nres_vault_item: {
        Args: { p_target_id: string; p_target_type: string; p_user_id: string }
        Returns: boolean
      }
      can_manage_practice_letterhead: {
        Args: { _practice_id: string }
        Returns: boolean
      }
      can_manage_surveys: {
        Args: { _practice_id: string; _user_id: string }
        Returns: boolean
      }
      can_read_nres_claim_evidence: {
        Args: { _claim_id: string; _user_id: string }
        Returns: boolean
      }
      can_submit_survey_answer: {
        Args: { _response_id: string }
        Returns: boolean
      }
      can_view_consultation_examples: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      can_view_practice_letterhead: {
        Args: { _practice_id: string }
        Returns: boolean
      }
      check_enn_vault_permission: {
        Args: { p_target_id: string; p_target_type: string; p_user_id: string }
        Returns: string
      }
      check_nres_vault_permission: {
        Args: { p_target_id: string; p_target_type: string; p_user_id: string }
        Returns: string
      }
      check_transcript_integrity: {
        Args: { p_meeting_id: string }
        Returns: {
          description: string
          issue_type: string
          metadata: Json
          severity: string
        }[]
      }
      check_user_exists_by_email: {
        Args: { email_param: string }
        Returns: boolean
      }
      check_user_practice_assignment: {
        Args: { p_email: string; p_practice_id: string }
        Returns: Json
      }
      cleanup_ai4gp_chat_history: { Args: never; Returns: number }
      cleanup_expired_sessions: { Args: never; Returns: number }
      cleanup_old_login_rate_limits: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      cleanup_old_sessions: { Args: { days_old?: number }; Returns: number }
      cleanup_old_transcription_chunks: { Args: never; Returns: number }
      cleanup_stuck_meetings: {
        Args: never
        Returns: {
          fixed_meeting_ids: string[]
          fixed_meetings_count: number
        }[]
      }
      cleanup_truly_empty_meetings: {
        Args: {
          p_max_word_threshold?: number
          p_min_age_minutes?: number
          p_user_id: string
        }
        Returns: {
          deleted_count: number
          deleted_ids: string[]
        }[]
      }
      complete_meeting: { Args: { meeting_id: string }; Returns: Json }
      create_complaint_outcome: {
        Args: {
          p_complaint_id: string
          p_outcome_letter: string
          p_outcome_summary: string
          p_outcome_type: string
        }
        Returns: string
      }
      create_complaint_outcome_questionnaire: {
        Args: { p_complaint_id: string; p_questionnaire_data: Json }
        Returns: string
      }
      create_default_attendee_templates: {
        Args: { p_practice_id: string; p_user_id: string }
        Returns: undefined
      }
      deduplicate_medicines: { Args: never; Returns: undefined }
      delay_seconds: { Args: { seconds: number }; Returns: undefined }
      delete_complaint_cascade: {
        Args: { p_complaint_id: string }
        Returns: Json
      }
      detect_meeting_data_crossover: {
        Args: never
        Returns: {
          last_updated: string
          meeting_id: string
          meeting_title: string
          potential_crossover: boolean
          summary_meeting_id: string
        }[]
      }
      emergency_detect_transcript_data_loss: {
        Args: never
        Returns: {
          chunk_count: number
          created_at: string
          meeting_id: string
          meeting_title: string
          severity: string
          user_id: string
          word_count: number
        }[]
      }
      find_chunks_needing_realtime_cleaning: {
        Args: { batch_size?: number }
        Returns: {
          chunk_id: string
          chunk_number: number
          meeting_id: string
          transcription_text: string
          word_count: number
        }[]
      }
      find_uncleaned_transcripts: {
        Args: { batch_size?: number }
        Returns: {
          meeting_id: string
          transcript_text: string
          word_count: number
        }[]
      }
      fix_complaint_status_inconsistencies: {
        Args: never
        Returns: {
          new_status: string
          old_status: string
          reference_number: string
        }[]
      }
      generate_complaint_reference: { Args: never; Returns: string }
      generate_incident_reference: { Args: never; Returns: string }
      generate_short_code: { Args: { length?: number }; Returns: string }
      get_actual_meeting_word_count: {
        Args: { p_meeting_id: string }
        Returns: number
      }
      get_all_live_recordings: {
        Args: never
        Returns: {
          created_at: string
          duration_minutes: number
          id: string
          is_paused: boolean
          last_chunk_at: string
          status: string
          title: string
          total_word_count: number
          updated_at: string
          user_id: string
          words_last_5_mins: number
        }[]
      }
      get_ask_ai_image_studio_usage_report: {
        Args: never
        Returns: {
          advanced_opened_count: number
          advanced_opened_rate: number
          last_generated: string
          regeneration_count: number
          regeneration_rate: number
          template_id: string
          total_generations: number
          unique_users: number
        }[]
      }
      get_combined_transcript: {
        Args: { p_meeting_id: string; p_session_id: string }
        Returns: string
      }
      get_complaint_compliance_summary: {
        Args: { p_complaint_id: string }
        Returns: {
          complaint_id: string
          completed_checks: number
          compliance_percentage: number
          total_checks: number
        }[]
      }
      get_complaint_for_external_access: {
        Args: { access_token_param: string }
        Returns: {
          category: Database["public"]["Enums"]["complaint_category"]
          complaint_description: string
          complaint_id: string
          complaint_title: string
          incident_date: string
          location_service: string
          reference_number: string
          response_submitted: boolean
          response_text: string
          staff_email: string
          staff_name: string
          staff_role: string
        }[]
      }
      get_comprehensive_drug_info: {
        Args: { drug_name_param: string }
        Returns: {
          antimicrobial_data: Json
          bnf_chapter: string
          bnf_data: Json
          devices_vaccines_data: Json
          drug_name: string
          formulary_data: Json
          icb_region: string
          last_reviewed_date: string
          links_data: Json
          monitoring_data: Json
          notes: string
          populations_data: Json
          prior_approval_data: Json
          source_document: string
          traffic_light_status: string
        }[]
      }
      get_current_user_id: { Args: never; Returns: string }
      get_current_user_role: {
        Args: { check_user_id?: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_database_table_sizes: {
        Args: never
        Returns: {
          row_count: number
          size_bytes: number
          size_pretty: string
          table_name: string
        }[]
      }
      get_default_staff_contact: {
        Args: {
          p_practice_id: string
          p_staff_name?: string
          p_staff_role: string
        }
        Returns: {
          default_email: string
          default_phone: string
          staff_name: string
        }[]
      }
      get_document_studio_recent_usage: {
        Args: { limit_count?: number }
        Returns: {
          action: string
          created_at: string
          document_type: string
          document_type_name: string
          free_form_request: string
          id: string
          request_summary: string
          title: string
          user_email: string
          user_name: string
          word_count: number
        }[]
      }
      get_document_studio_stats_by_user: {
        Args: never
        Returns: {
          all_time_count: number
          email: string
          full_name: string
          last_generated_at: string
          this_month_count: number
          this_week_count: number
          today_count: number
          top_document_type: string
          total_words: number
          user_id: string
        }[]
      }
      get_empty_meetings_for_cleanup: {
        Args: {
          p_max_word_threshold?: number
          p_min_age_minutes?: number
          p_user_id: string
        }
        Returns: {
          actual_word_count: number
          created_at: string
          has_chunks: boolean
          meeting_id: string
          status: string
          stored_word_count: number
          title: string
        }[]
      }
      get_genie_usage_report: {
        Args: never
        Returns: {
          out_ai4gp_count: number
          out_email: string
          out_full_name: string
          out_gp_genie_count: number
          out_last_24h: number
          out_last_30d: number
          out_last_7d: number
          out_last_active: string
          out_meeting_count: number
          out_patient_line_count: number
          out_pm_genie_count: number
          out_scribe_count: number
          out_total_chats: number
          out_total_messages: number
          out_user_id: string
        }[]
      }
      get_gp_scribe_stats_by_user: {
        Args: never
        Returns: {
          all_time_count: number
          email: string
          full_name: string
          last_consultation_at: string
          this_month_count: number
          this_week_count: number
          today_count: number
          total_duration_seconds: number
          total_words: number
          user_id: string
        }[]
      }
      get_image_usage_report: {
        Args: never
        Returns: {
          email: string
          full_name: string
          image_studio_count: number
          infographic_count: number
          last_24h: number
          last_30d: number
          last_7d: number
          last_generated: string
          quick_pick_count: number
          total_images: number
          user_id: string
        }[]
      }
      get_involved_party_access_url: {
        Args: { party_id: string }
        Returns: string
      }
      get_large_ai4gp_searches: {
        Args: { min_size_mb?: number }
        Returns: {
          created_at: string
          email: string
          full_name: string
          has_audio: boolean
          has_presentation: boolean
          id: string
          is_flagged: boolean
          is_protected: boolean
          size_bytes: number
          title: string
          updated_at: string
          user_id: string
        }[]
      }
      get_large_files: {
        Args: { min_size_bytes?: number }
        Returns: {
          file_name: string
          file_size: number
          file_size_pretty: string
          table_name: string
          uploaded_at: string
          uploaded_by_email: string
        }[]
      }
      get_large_files_stats: {
        Args: never
        Returns: {
          files_500kb_to_1mb: number
          files_over_1mb: number
          total_large_files: number
          total_large_files_size: number
          total_large_files_size_pretty: string
        }[]
      }
      get_largest_ai_chats: {
        Args: { limit_count?: number }
        Returns: {
          created_at: string
          email: string
          id: string
          is_flagged: boolean
          is_protected: boolean
          size_bytes: number
          title: string
          updated_at: string
          user_id: string
        }[]
      }
      get_latest_meeting_note_version: {
        Args: { p_meeting_id: string; p_session_id: string; p_user_id: string }
        Returns: {
          created_at: string
          notes_content: string
          transcript_word_count: number
          version_number: number
        }[]
      }
      get_meeting_full_transcript: {
        Args: { p_meeting_id: string }
        Returns: {
          item_count: number
          source: string
          transcript: string
        }[]
      }
      get_meeting_stats_by_user: {
        Args: never
        Returns: {
          completed_meetings: number
          email: string
          first_meeting_date: string
          full_name: string
          latest_meeting_date: string
          meeting_count: number
          recording_meetings: number
          user_id: string
        }[]
      }
      get_meeting_transcript: {
        Args: { p_meeting_id: string }
        Returns: string
      }
      get_meeting_usage_report: {
        Args: never
        Returns: {
          all_time: number
          avg_duration_mins: number
          deleted_meetings_count: number
          duration_24h: number
          duration_30d: number
          duration_7d: number
          email: string
          full_name: string
          last_24h: number
          last_30d: number
          last_7d: number
          total_duration_mins: number
          total_words: number
          user_id: string
          words_24h: number
          words_30d: number
          words_7d: number
        }[]
      }
      get_monitoring_dashboard: {
        Args: never
        Returns: {
          critical_alerts: number
          last_check: string
          recent_alerts: Json
          system_status: string
          total_active_alerts: number
          warning_alerts: number
        }[]
      }
      get_narp_export_rows: {
        Args: { _key: string; _practice_id: string }
        Returns: {
          ae_attendances: number
          age: number
          drug_count: number
          fk_patient_link_id: string
          forename: string
          frailty_category: string
          inpatient_total_admissions: number
          nhs_number: string
          poa: number
          polos: number
          risk_tier: string
          rub: string
          surname: string
        }[]
      }
      get_narp_identifiable_by_refs: {
        Args: { _fk_patient_link_ids: string[]; _practice_id: string }
        Returns: {
          fk_patient_link_id: string
          forenames: string
          nhs_number: string
          surname: string
        }[]
      }
      get_old_ai_chats: {
        Args: { days_old?: number }
        Returns: {
          created_at: string
          email: string
          id: string
          is_protected: boolean
          size_bytes: number
          title: string
          updated_at: string
          user_id: string
        }[]
      }
      get_patient_identifiable: {
        Args: { p_snapshot_id: number }
        Returns: {
          forenames: string
          nhs_number: string
          snapshot_id: number
          surname: string
        }[]
      }
      get_pcn_manager_practice_ids: {
        Args: { _user_id?: string }
        Returns: string[]
      }
      get_policy_library_access: {
        Args: { _practice_id: string; _user_id: string }
        Returns: string
      }
      get_policy_usage_report: {
        Args: never
        Returns: {
          business_continuity_count: number
          clinical_count: number
          email: string
          full_name: string
          health_safety_count: number
          hr_count: number
          info_governance_count: number
          last_24h: number
          last_30d: number
          last_7d: number
          last_created: string
          patient_services_count: number
          total_policies: number
          user_id: string
        }[]
      }
      get_practice_manager_assignable_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_practice_manager_practice_id: {
        Args: { _user_id?: string }
        Returns: string
      }
      get_practice_policy_status: {
        Args: { p_practice_id: string }
        Returns: {
          assigned_at: string
          configuration: Json
          is_active: boolean
          policy_name: string
          policy_type: string
          region: string
        }[]
      }
      get_practice_role_display_name: {
        Args: { role_enum: Database["public"]["Enums"]["practice_role"] }
        Returns: string
      }
      get_practice_users: {
        Args: { p_practice_id: string }
        Returns: {
          agewell_access: boolean
          ai4gp_access: boolean
          api_testing_service_access: boolean
          assigned_at: string
          bp_service_access: boolean
          complaints_manager_access: boolean
          cqc_compliance_access: boolean
          cso_governance_access: boolean
          document_signoff_access: boolean
          email: string
          enhanced_access: boolean
          fridge_monitoring_access: boolean
          full_name: string
          gp_scribe_access: boolean
          last_login: string
          lg_capture_access: boolean
          meeting_notes_access: boolean
          mic_test_service_access: boolean
          practice_role: string
          role: string
          shared_drive_access: boolean
          survey_manager_access: boolean
          translation_service_access: boolean
          user_id: string
        }[]
      }
      get_presentation_usage_report: {
        Args: never
        Returns: {
          avg_slides_per_presentation: number
          email: string
          full_name: string
          last_24h: number
          last_30d: number
          last_7d: number
          last_created: string
          total_presentations: number
          total_slides: number
          user_id: string
        }[]
      }
      get_public_survey: { Args: { p_token: string }; Returns: Json }
      get_recent_completed_meetings: {
        Args: { since_time: string }
        Returns: {
          created_at: string
          duration_minutes: number
          id: string
          notes_generation_status: string
          status: string
          title: string
          updated_at: string
          user_id: string
          word_count: number
        }[]
      }
      get_security_setting: { Args: { setting_name: string }; Returns: string }
      get_storage_by_user: {
        Args: never
        Returns: {
          ai_chats_count: number
          ai_chats_size_bytes: number
          email: string
          full_name: string
          meetings_count: number
          oldest_ai_chat: string
          oldest_meeting: string
          total_size_bytes: number
          transcript_chunks_count: number
          transcript_size_bytes: number
          user_id: string
        }[]
      }
      get_survey_by_token: { Args: { _token: string }; Returns: string }
      get_todays_meetings_details: {
        Args: never
        Returns: {
          duration_minutes: number
          end_time: string
          id: string
          start_time: string
          title: string
          user_id: string
          word_count: number
        }[]
      }
      get_translation_usage_report: {
        Args: never
        Returns: {
          avg_messages_per_session: number
          email: string
          full_name: string
          languages_used: string[]
          last_24h: number
          last_30d: number
          last_7d: number
          last_session_at: string
          live_sessions: number
          total_messages: number
          total_sessions: number
          training_sessions: number
          user_id: string
        }[]
      }
      get_user_modules: {
        Args: { p_user_id?: string }
        Returns: {
          granted_at: string
          granted_by: string
          module: Database["public"]["Enums"]["app_module"]
        }[]
      }
      get_user_practice_assignments: {
        Args: { p_user_id: string }
        Returns: {
          assigned_at: string
          assigned_by: string
          practice_id: string
          practice_name: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_user_practice_id: { Args: { user_uuid: string }; Returns: string }
      get_user_practice_ids: { Args: { p_user_id?: string }; Returns: string[] }
      get_user_role_for_policy: {
        Args: { check_user_id?: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_roles: {
        Args: { _user_id?: string }
        Returns: {
          practice_id: string
          practice_name: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_users_with_practices: {
        Args: never
        Returns: {
          email: string
          full_name: string
          last_login: string
          practice_assignments: Json
          user_id: string
        }[]
      }
      get_visible_practice_ids: {
        Args: { p_user_id: string }
        Returns: string[]
      }
      grant_user_module: {
        Args: {
          p_granted_by?: string
          p_module: Database["public"]["Enums"]["app_module"]
          p_user_id: string
        }
        Returns: string
      }
      has_any_nres_admin_role: {
        Args: { _user_email: string }
        Returns: boolean
      }
      has_any_nres_claims_read_role: {
        Args: { _user_email: string }
        Returns: boolean
      }
      has_can_export_narp_identifiable: {
        Args: { _practice_id: string; _user_id: string }
        Returns: boolean
      }
      has_can_view_narp_identifiable: {
        Args: { _practice_id: string; _user_id: string }
        Returns: boolean
      }
      has_cso_governance_access: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      has_document_signoff_access: { Args: never; Returns: boolean }
      has_enn_vault_access: { Args: { p_user_id: string }; Returns: boolean }
      has_mock_inspection_access: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: boolean
      }
      has_narp_upload_access: {
        Args: { p_practice: string; p_user: string }
        Returns: boolean
      }
      has_nres_access: { Args: { check_user_id?: string }; Returns: boolean }
      has_nres_buyback_access: {
        Args: { _practice_key: string; _roles?: string[]; _user_id: string }
        Returns: boolean
      }
      has_nres_claims_role: {
        Args: { _role: string; _user_email: string }
        Returns: boolean
      }
      has_nres_vault_access: { Args: { p_user_id: string }; Returns: boolean }
      has_practice_access: {
        Args: { p_practice: string; p_user: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_service_activation: {
        Args: {
          _service: Database["public"]["Enums"]["service_type"]
          _user_id: string
        }
        Returns: boolean
      }
      has_shared_drive_permission: {
        Args: {
          p_action: Database["public"]["Enums"]["permission_action"]
          p_target_id: string
          p_target_type: Database["public"]["Enums"]["file_type"]
          p_user_id: string
        }
        Returns: boolean
      }
      icn_norm: { Args: { input_name: string }; Returns: string }
      initialize_complaint_compliance: {
        Args: { p_complaint_id: string }
        Returns: undefined
      }
      is_nres_admin:
        | { Args: never; Returns: boolean }
        | { Args: { _user_id: string }; Returns: boolean }
      is_nres_claims_admin: { Args: never; Returns: boolean }
      is_pcn_manager: { Args: { _user_id?: string }; Returns: boolean }
      is_pcn_manager_for_practice: {
        Args: { _practice_id: string; _user_id: string }
        Returns: boolean
      }
      is_pml_user: { Args: never; Returns: boolean }
      is_practice_manager_for_practice: {
        Args: { _practice_id: string; _user_id: string }
        Returns: boolean
      }
      is_practice_member: { Args: { _practice_id: string }; Returns: boolean }
      is_session_valid: { Args: { p_session_id: string }; Returns: boolean }
      is_system_admin: { Args: { _user_id?: string }; Returns: boolean }
      log_complaint_action:
        | {
            Args: { p_action: string; p_complaint_id: string; p_details?: Json }
            Returns: string
          }
        | {
            Args: {
              p_action_description: string
              p_action_type: string
              p_complaint_id: string
              p_new_values?: Json
              p_old_values?: Json
            }
            Returns: undefined
          }
        | {
            Args: {
              p_action_description: string
              p_action_type: string
              p_complaint_id: string
              p_ip_address?: string
              p_new_values?: Json
              p_old_values?: Json
              p_user_agent?: string
            }
            Returns: undefined
          }
      log_complaint_activity: {
        Args: {
          p_action: string
          p_complaint_id: string
          p_description: string
          p_new_values?: Json
          p_old_values?: Json
        }
        Returns: undefined
      }
      log_complaint_document_action: {
        Args: {
          p_action_type: string
          p_complaint_id: string
          p_document_id?: string
          p_document_name: string
          p_ip_address?: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      log_complaint_view:
        | {
            Args: { p_complaint_id: string; p_view_context?: string }
            Returns: undefined
          }
        | {
            Args: {
              p_complaint_id: string
              p_ip_address?: string
              p_user_agent?: string
              p_view_context?: string
            }
            Returns: undefined
          }
      log_compliance_change: {
        Args: {
          p_complaint_id: string
          p_compliance_check_id: string
          p_compliance_item: string
          p_new_status: boolean
          p_notes?: string
          p_previous_status: boolean
        }
        Returns: string
      }
      log_meeting_content_access: {
        Args: {
          p_action?: string
          p_content_type: string
          p_meeting_id: string
        }
        Returns: undefined
      }
      log_narp_patient_reveal: {
        Args: {
          _context?: string
          _fk_patient_link_id: string
          _practice_id: string
          _route: string
        }
        Returns: undefined
      }
      log_narp_pii_page_access: {
        Args: {
          _patient_count_rendered: number
          _practice_id: string
          _route: string
        }
        Returns: undefined
      }
      log_security_event:
        | { Args: { event_data: Json; event_type: string }; Returns: undefined }
        | {
            Args: {
              p_event_details?: Json
              p_event_type: string
              p_ip_address?: unknown
              p_severity?: string
              p_user_agent?: string
              p_user_email?: string
              p_user_id?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_event_details?: Json
              p_event_type: string
              p_ip_address?: string
              p_severity: string
              p_user_agent?: string
            }
            Returns: undefined
          }
        | {
            Args: { p_details?: Json; p_event_type: string; p_user_id: string }
            Returns: string
          }
      log_session_access_attempt: {
        Args: { p_access_type: string; p_session_id: string }
        Returns: undefined
      }
      log_system_activity: {
        Args: {
          p_new_values?: Json
          p_old_values?: Json
          p_operation: string
          p_record_id?: string
          p_table_name: string
        }
        Returns: string
      }
      log_user_session: {
        Args: {
          p_ip_address?: unknown
          p_session_id?: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      mark_session_inactive: {
        Args: { p_session_id?: string; p_user_id: string }
        Returns: undefined
      }
      narp_decrypt_pii: { Args: { p_value: string }; Returns: string }
      narp_encrypt_pii: { Args: { p_value: string }; Returns: string }
      narp_hash_nhs_number: { Args: { p_nhs: string }; Returns: string }
      narp_insert_snapshots: {
        Args: {
          p_export_date: string
          p_export_id: string
          p_practice_id: string
          p_rows: Json
        }
        Returns: number
      }
      narp_insert_snapshots_with_key: {
        Args: {
          p_export_date: string
          p_export_id: string
          p_pii_key: string
          p_practice_id: string
          p_rows: Json
        }
        Returns: number
      }
      purge_expired_data: { Args: never; Returns: string }
      remove_user_from_practice: {
        Args: {
          p_practice_id: string
          p_role?: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: boolean
      }
      revoke_user_module: {
        Args: {
          p_module: Database["public"]["Enums"]["app_module"]
          p_user_id: string
        }
        Returns: boolean
      }
      safe_extract_word_count: { Args: { p_text: string }; Returns: number }
      safe_similarity: {
        Args: { text1: string; text2: string }
        Returns: number
      }
      safe_unaccent: { Args: { input_text: string }; Returns: string }
      submit_external_response: {
        Args: { access_token_param: string; response_text_param: string }
        Returns: boolean
      }
      sync_meeting_word_count: {
        Args: { p_meeting_id: string }
        Returns: number
      }
      trigger_queue_processing: { Args: never; Returns: Json }
      try_parse_jsonb: { Args: { p_text: string }; Returns: Json }
      update_chunk_cleaning_stats: {
        Args: {
          p_chunks_processed?: number
          p_failed_count?: number
          p_is_realtime?: boolean
          p_processing_time_ms?: number
        }
        Returns: undefined
      }
      update_session_activity: {
        Args: { p_session_id?: string; p_user_id: string }
        Returns: undefined
      }
      update_transcript_cleaning_stats: { Args: never; Returns: undefined }
      update_user_session_activity:
        | {
            Args: {
              p_ip_address?: unknown
              p_user_agent?: string
              p_user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_ip_address?: unknown
              p_session_id?: string
              p_user_agent?: string
              p_user_id: string
            }
            Returns: undefined
          }
      user_has_meeting_access: {
        Args: { p_meeting_id: string; p_user_id?: string }
        Returns: boolean
      }
      user_has_module_access: {
        Args: {
          p_module: Database["public"]["Enums"]["app_module"]
          p_user_id: string
        }
        Returns: boolean
      }
      validate_input_security: {
        Args: { input_text: string }
        Returns: boolean
      }
      validate_meeting_access: {
        Args: { p_meeting_id: string; p_user_id: string }
        Returns: boolean
      }
      validate_meeting_access_and_log: {
        Args: { p_content_type?: string; p_meeting_id: string }
        Returns: boolean
      }
      validate_nhs_email: { Args: { email_address: string }; Returns: boolean }
    }
    Enums: {
      app_module:
        | "gp_scribe"
        | "meeting_recorder"
        | "complaints_system"
        | "ai_4_pm"
        | "enhanced_access"
        | "cqc_compliance"
        | "shared_drive_access"
        | "mic_test_service"
        | "api_testing_service"
        | "translation_service"
      app_role:
        | "system_admin"
        | "practice_manager"
        | "gp"
        | "administrator"
        | "nurse"
        | "receptionist"
        | "practice_user"
        | "complaints_manager"
        | "pcn_manager"
        | "lmc_user"
        | "federation_user"
        | "icb_user"
      appointment_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "requires_action"
      communication_mode: "create" | "improve"
      communication_tone:
        | "friendly"
        | "professional"
        | "empathetic"
        | "clinical"
        | "informative"
        | "reassuring"
        | "apologetic"
        | "urgent"
        | "firm"
        | "diplomatic"
      complaint_category:
        | "clinical_care"
        | "staff_attitude"
        | "appointment_system"
        | "communication"
        | "facilities"
        | "billing"
        | "waiting_times"
        | "medication"
        | "referrals"
        | "other"
        | "Appointments & Access"
        | "Clinical Care & Treatment"
        | "Communication Issues"
        | "Staff Attitude & Behaviour"
        | "Prescriptions"
        | "Test Results & Follow-Up"
        | "Administration"
        | "Facilities & Environment"
        | "Digital Services"
        | "Confidentiality & Data"
      complaint_priority: "low" | "medium" | "high" | "urgent"
      complaint_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "response_sent"
        | "closed"
        | "escalated"
      file_type: "folder" | "file"
      permission_action: "view" | "edit" | "delete" | "share" | "upload"
      permission_level: "owner" | "editor" | "viewer" | "no_access"
      policy_access_level: "none" | "read" | "edit"
      practice_role:
        | "gp_partner"
        | "salaried_gp"
        | "reception_team"
        | "admin_team"
        | "secretaries"
        | "practice_manager"
        | "deputy_practice_manager"
        | "clinician"
      service_type:
        | "ai4pm"
        | "ai4gp"
        | "nres"
        | "meeting_recorder"
        | "complaints"
        | "cqc"
        | "lg_capture"
        | "policy_service"
        | "enn"
      staff_role:
        | "gp"
        | "phlebotomist"
        | "hca"
        | "nurse"
        | "paramedic"
        | "receptionist"
      work_location:
        | "remote"
        | "kings_heath"
        | "various_practices"
        | "covid_vaccinations"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_module: [
        "gp_scribe",
        "meeting_recorder",
        "complaints_system",
        "ai_4_pm",
        "enhanced_access",
        "cqc_compliance",
        "shared_drive_access",
        "mic_test_service",
        "api_testing_service",
        "translation_service",
      ],
      app_role: [
        "system_admin",
        "practice_manager",
        "gp",
        "administrator",
        "nurse",
        "receptionist",
        "practice_user",
        "complaints_manager",
        "pcn_manager",
        "lmc_user",
        "federation_user",
        "icb_user",
      ],
      appointment_status: [
        "pending",
        "in_progress",
        "completed",
        "requires_action",
      ],
      communication_mode: ["create", "improve"],
      communication_tone: [
        "friendly",
        "professional",
        "empathetic",
        "clinical",
        "informative",
        "reassuring",
        "apologetic",
        "urgent",
        "firm",
        "diplomatic",
      ],
      complaint_category: [
        "clinical_care",
        "staff_attitude",
        "appointment_system",
        "communication",
        "facilities",
        "billing",
        "waiting_times",
        "medication",
        "referrals",
        "other",
        "Appointments & Access",
        "Clinical Care & Treatment",
        "Communication Issues",
        "Staff Attitude & Behaviour",
        "Prescriptions",
        "Test Results & Follow-Up",
        "Administration",
        "Facilities & Environment",
        "Digital Services",
        "Confidentiality & Data",
      ],
      complaint_priority: ["low", "medium", "high", "urgent"],
      complaint_status: [
        "draft",
        "submitted",
        "under_review",
        "response_sent",
        "closed",
        "escalated",
      ],
      file_type: ["folder", "file"],
      permission_action: ["view", "edit", "delete", "share", "upload"],
      permission_level: ["owner", "editor", "viewer", "no_access"],
      policy_access_level: ["none", "read", "edit"],
      practice_role: [
        "gp_partner",
        "salaried_gp",
        "reception_team",
        "admin_team",
        "secretaries",
        "practice_manager",
        "deputy_practice_manager",
        "clinician",
      ],
      service_type: [
        "ai4pm",
        "ai4gp",
        "nres",
        "meeting_recorder",
        "complaints",
        "cqc",
        "lg_capture",
        "policy_service",
        "enn",
      ],
      staff_role: [
        "gp",
        "phlebotomist",
        "hca",
        "nurse",
        "paramedic",
        "receptionist",
      ],
      work_location: [
        "remote",
        "kings_heath",
        "various_practices",
        "covid_vaccinations",
      ],
    },
  },
} as const
