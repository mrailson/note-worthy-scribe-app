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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      ai_4_pm_searches: {
        Row: {
          brief_overview: string | null
          created_at: string
          id: string
          messages: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brief_overview?: string | null
          created_at?: string
          id?: string
          messages?: Json
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brief_overview?: string | null
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      attendees: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_default: boolean | null
          name: string
          organization: string | null
          role: string | null
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
          role?: string | null
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
          role?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audio_chunks: {
        Row: {
          audio_blob_path: string | null
          chunk_number: number
          created_at: string | null
          end_time: string
          file_size: number | null
          id: string
          meeting_id: string | null
          processing_status: string | null
          start_time: string
        }
        Insert: {
          audio_blob_path?: string | null
          chunk_number: number
          created_at?: string | null
          end_time: string
          file_size?: number | null
          id?: string
          meeting_id?: string | null
          processing_status?: string | null
          start_time: string
        }
        Update: {
          audio_blob_path?: string | null
          chunk_number?: number
          created_at?: string | null
          end_time?: string
          file_size?: number | null
          id?: string
          meeting_id?: string | null
          processing_status?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_chunks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "accessible_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_chunks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "accessible_meetings"
            referencedColumns: ["id"]
          },
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
      complaint_audit_detailed: {
        Row: {
          action_description: string
          action_type: string
          complaint_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action_description: string
          action_type: string
          complaint_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action_description?: string
          action_type?: string
          complaint_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
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
          performed_by: string
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
        Relationships: []
      }
      complaint_investigation_findings: {
        Row: {
          complaint_id: string
          created_at: string
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
      complaint_outcomes: {
        Row: {
          complaint_id: string
          created_at: string | null
          decided_at: string | null
          decided_by: string | null
          id: string
          outcome_letter: string
          outcome_summary: string
          outcome_type: string
        }
        Insert: {
          complaint_id: string
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          outcome_letter: string
          outcome_summary: string
          outcome_type: string
        }
        Update: {
          complaint_id?: string
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          outcome_letter?: string
          outcome_summary?: string
          outcome_type?: string
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
      gp_practices: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          ics_code: string
          ics_name: string
          id: string
          name: string
          neighbourhood_id: string | null
          organisation_type: string
          pcn_code: string | null
          phone: string | null
          postcode: string | null
          practice_code: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          ics_code: string
          ics_name: string
          id?: string
          name: string
          neighbourhood_id?: string | null
          organisation_type: string
          pcn_code?: string | null
          phone?: string | null
          postcode?: string | null
          practice_code: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          ics_code?: string
          ics_name?: string
          id?: string
          name?: string
          neighbourhood_id?: string | null
          organisation_type?: string
          pcn_code?: string | null
          phone?: string | null
          postcode?: string | null
          practice_code?: string
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
      medical_term_corrections: {
        Row: {
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
      meeting_audio_backups: {
        Row: {
          backup_reason: string | null
          created_at: string
          duration_seconds: number | null
          expected_word_count: number | null
          file_path: string
          file_size: number | null
          id: string
          is_reprocessed: boolean | null
          meeting_id: string
          reprocessed_at: string | null
          reprocessed_by: string | null
          transcription_quality_score: number | null
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
          is_reprocessed?: boolean | null
          meeting_id: string
          reprocessed_at?: string | null
          reprocessed_by?: string | null
          transcription_quality_score?: number | null
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
          is_reprocessed?: boolean | null
          meeting_id?: string
          reprocessed_at?: string | null
          reprocessed_by?: string | null
          transcription_quality_score?: number | null
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
      meeting_documents: {
        Row: {
          created_at: string
          description: string | null
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
      meeting_overviews: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          meeting_id: string
          overview: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_id: string
          overview: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_id?: string
          overview?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_overviews_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "accessible_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_overviews_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
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
            referencedRelation: "accessible_meetings"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "accessible_meetings"
            referencedColumns: ["id"]
          },
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
          chunk_number: number
          confidence: number | null
          created_at: string
          id: string
          meeting_id: string
          session_id: string
          transcription_text: string
          user_id: string
        }
        Insert: {
          chunk_number: number
          confidence?: number | null
          created_at?: string
          id?: string
          meeting_id: string
          session_id: string
          transcription_text: string
          user_id: string
        }
        Update: {
          chunk_number?: number
          confidence?: number | null
          created_at?: string
          id?: string
          meeting_id?: string
          session_id?: string
          transcription_text?: string
          user_id?: string
        }
        Relationships: []
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
            referencedRelation: "accessible_meetings"
            referencedColumns: ["id"]
          },
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
          audio_backup_created_at: string | null
          audio_backup_path: string | null
          created_at: string
          data_retention_date: string | null
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          format: string | null
          id: string
          left_audio_url: string | null
          location: string | null
          meeting_type: string
          mixed_audio_url: string | null
          practice_id: string | null
          recording_created_at: string | null
          requires_audio_backup: boolean | null
          right_audio_url: string | null
          start_time: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_backup_created_at?: string | null
          audio_backup_path?: string | null
          created_at?: string
          data_retention_date?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          format?: string | null
          id?: string
          left_audio_url?: string | null
          location?: string | null
          meeting_type?: string
          mixed_audio_url?: string | null
          practice_id?: string | null
          recording_created_at?: string | null
          requires_audio_backup?: boolean | null
          right_audio_url?: string | null
          start_time?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_backup_created_at?: string | null
          audio_backup_path?: string | null
          created_at?: string
          data_retention_date?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          format?: string | null
          id?: string
          left_audio_url?: string | null
          location?: string | null
          meeting_type?: string
          mixed_audio_url?: string | null
          practice_id?: string | null
          recording_created_at?: string | null
          requires_audio_backup?: boolean | null
          right_audio_url?: string | null
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "gp_practices"
            referencedColumns: ["id"]
          },
        ]
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
          id: string
          image_url: string | null
          location: string | null
          published_at: string | null
          relevance_score: number | null
          source: string | null
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          location?: string | null
          published_at?: string | null
          relevance_score?: number | null
          source?: string | null
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          location?: string | null
          published_at?: string | null
          relevance_score?: number | null
          source?: string | null
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
      practice_details: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          footer_text: string | null
          id: string
          is_default: boolean | null
          logo_url: string | null
          pcn_code: string | null
          phone: string | null
          practice_name: string
          show_page_numbers: boolean | null
          updated_at: string
          use_for_all_meetings: boolean | null
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          footer_text?: string | null
          id?: string
          is_default?: boolean | null
          logo_url?: string | null
          pcn_code?: string | null
          phone?: string | null
          practice_name: string
          show_page_numbers?: boolean | null
          updated_at?: string
          use_for_all_meetings?: boolean | null
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          footer_text?: string | null
          id?: string
          is_default?: boolean | null
          logo_url?: string | null
          pcn_code?: string | null
          phone?: string | null
          practice_name?: string
          show_page_numbers?: boolean | null
          updated_at?: string
          use_for_all_meetings?: boolean | null
          user_id?: string
          website?: string | null
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
      profiles: {
        Row: {
          ai4gp_access: boolean | null
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          last_login: string | null
          meeting_retention_policy: string | null
          mic_test_service_visible: boolean
          nhs_trust: string | null
          role: string | null
          shared_drive_visible: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          ai4gp_access?: boolean | null
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id?: string
          last_login?: string | null
          meeting_retention_policy?: string | null
          mic_test_service_visible?: boolean
          nhs_trust?: string | null
          role?: string | null
          shared_drive_visible?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          ai4gp_access?: boolean | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          last_login?: string | null
          meeting_retention_policy?: string | null
          mic_test_service_visible?: boolean
          nhs_trust?: string | null
          role?: string | null
          shared_drive_visible?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          ip_address: unknown | null
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
          ip_address?: unknown | null
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
          ip_address?: unknown | null
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
          file_path: string
          file_size: number | null
          file_type: string | null
          folder_id: string | null
          id: string
          mime_type: string | null
          name: string
          original_name: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name: string
          original_name: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          original_name?: string
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
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          parent_id?: string | null
          path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          parent_id?: string | null
          path?: string
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
      system_audit_log: {
        Row: {
          id: string
          ip_address: unknown | null
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
          ip_address?: unknown | null
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
          ip_address?: unknown | null
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
            referencedRelation: "accessible_meetings"
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
      user_roles: {
        Row: {
          ai_4_pm_access: boolean | null
          assigned_at: string | null
          assigned_by: string | null
          complaints_admin_access: boolean | null
          complaints_manager_access: boolean | null
          cqc_compliance_access: boolean | null
          created_at: string | null
          enhanced_access: boolean | null
          gp_scribe_access: boolean | null
          id: string
          meeting_notes_access: boolean | null
          mic_test_service_access: boolean | null
          practice_id: string | null
          replywell_access: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          shared_drive_access: boolean | null
          user_id: string
        }
        Insert: {
          ai_4_pm_access?: boolean | null
          assigned_at?: string | null
          assigned_by?: string | null
          complaints_admin_access?: boolean | null
          complaints_manager_access?: boolean | null
          cqc_compliance_access?: boolean | null
          created_at?: string | null
          enhanced_access?: boolean | null
          gp_scribe_access?: boolean | null
          id?: string
          meeting_notes_access?: boolean | null
          mic_test_service_access?: boolean | null
          practice_id?: string | null
          replywell_access?: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          shared_drive_access?: boolean | null
          user_id: string
        }
        Update: {
          ai_4_pm_access?: boolean | null
          assigned_at?: string | null
          assigned_by?: string | null
          complaints_admin_access?: boolean | null
          complaints_manager_access?: boolean | null
          cqc_compliance_access?: boolean | null
          created_at?: string | null
          enhanced_access?: boolean | null
          gp_scribe_access?: boolean | null
          id?: string
          meeting_notes_access?: boolean | null
          mic_test_service_access?: boolean | null
          practice_id?: string | null
          replywell_access?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          shared_drive_access?: boolean | null
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
      user_sessions: {
        Row: {
          id: string
          ip_address: unknown | null
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
          ip_address?: unknown | null
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
          ip_address?: unknown | null
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
    }
    Views: {
      accessible_meetings: {
        Row: {
          access_level: string | null
          access_type: string | null
          audio_backup_created_at: string | null
          audio_backup_path: string | null
          created_at: string | null
          data_retention_date: string | null
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          format: string | null
          id: string | null
          left_audio_url: string | null
          location: string | null
          meeting_type: string | null
          mixed_audio_url: string | null
          recording_created_at: string | null
          requires_audio_backup: boolean | null
          right_audio_url: string | null
          share_id: string | null
          share_message: string | null
          shared_at: string | null
          shared_by: string | null
          start_time: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_user_to_practice: {
        Args: {
          p_assigned_by?: string
          p_practice_id: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: string
      }
      generate_complaint_reference: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_incident_reference: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_combined_transcript: {
        Args: { p_meeting_id: string; p_session_id: string }
        Returns: string
      }
      get_complaint_compliance_summary: {
        Args: { complaint_id_param: string }
        Returns: {
          compliance_percentage: number
          compliant_items: number
          outstanding_items: string[]
          total_items: number
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
      get_current_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_role: {
        Args: { check_user_id?: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_database_table_sizes: {
        Args: Record<PropertyKey, never>
        Returns: {
          row_count: number
          size_bytes: number
          size_pretty: string
          table_name: string
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
        Args: Record<PropertyKey, never>
        Returns: {
          files_500kb_to_1mb: number
          files_over_1mb: number
          total_large_files: number
          total_large_files_size: number
          total_large_files_size_pretty: string
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
      get_meeting_transcript: {
        Args: { p_meeting_id: string }
        Returns: string
      }
      get_pcn_manager_practice_ids: {
        Args: { _user_id?: string }
        Returns: string[]
      }
      get_practice_manager_practice_id: {
        Args: { _user_id?: string }
        Returns: string
      }
      get_security_setting: {
        Args: { setting_name: string }
        Returns: string
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
      get_user_practice_ids: {
        Args: { p_user_id?: string }
        Returns: string[]
      }
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
        Args: Record<PropertyKey, never>
        Returns: {
          email: string
          full_name: string
          last_login: string
          practice_assignments: Json
          user_id: string
        }[]
      }
      grant_user_module: {
        Args: {
          p_granted_by?: string
          p_module: Database["public"]["Enums"]["app_module"]
          p_user_id: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
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
      initialize_complaint_compliance: {
        Args: { complaint_id_param: string }
        Returns: undefined
      }
      is_pcn_manager: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      is_pcn_manager_for_practice: {
        Args: { _practice_id: string; _user_id: string }
        Returns: boolean
      }
      is_practice_manager_for_practice: {
        Args: { _practice_id: string; _user_id: string }
        Returns: boolean
      }
      is_session_valid: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      is_system_admin: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      log_complaint_action: {
        Args: { p_action: string; p_complaint_id: string; p_details?: Json }
        Returns: string
      }
      log_complaint_activity: {
        Args: {
          p_action_description: string
          p_action_type: string
          p_complaint_id: string
          p_new_values?: Json
          p_old_values?: Json
        }
        Returns: string
      }
      log_complaint_document_action: {
        Args: {
          p_action_type: string
          p_complaint_id: string
          p_document_id?: string
          p_document_name: string
        }
        Returns: string
      }
      log_complaint_view: {
        Args: { p_complaint_id: string; p_view_context?: string }
        Returns: string
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
      log_security_event: {
        Args:
          | { event_data: Json; event_type: string }
          | { p_details?: Json; p_event_type: string; p_user_id: string }
          | {
              p_event_details?: Json
              p_event_type: string
              p_ip_address?: unknown
              p_severity?: string
              p_user_agent?: string
              p_user_email?: string
              p_user_id?: string
            }
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
      purge_expired_data: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
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
      submit_external_response: {
        Args: { access_token_param: string; response_text_param: string }
        Returns: boolean
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
      validate_meeting_access_and_log: {
        Args: { p_content_type?: string; p_meeting_id: string }
        Returns: boolean
      }
      validate_nhs_email: {
        Args: { email_address: string }
        Returns: boolean
      }
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
      app_role:
        | "system_admin"
        | "practice_manager"
        | "gp"
        | "administrator"
        | "nurse"
        | "receptionist"
        | "user"
        | "complaints_manager"
        | "pcn_manager"
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
      staff_role:
        | "gp"
        | "phlebotomist"
        | "hca"
        | "nurse"
        | "paramedic"
        | "receptionist"
      work_location: "remote" | "kings_heath" | "various_practices"
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
      ],
      app_role: [
        "system_admin",
        "practice_manager",
        "gp",
        "administrator",
        "nurse",
        "receptionist",
        "user",
        "complaints_manager",
        "pcn_manager",
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
      staff_role: [
        "gp",
        "phlebotomist",
        "hca",
        "nurse",
        "paramedic",
        "receptionist",
      ],
      work_location: ["remote", "kings_heath", "various_practices"],
    },
  },
} as const
