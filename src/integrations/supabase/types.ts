export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
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
      complaint_involved_parties: {
        Row: {
          access_token: string | null
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
          created_at: string
          ics_code: string
          ics_name: string
          id: string
          name: string
          neighbourhood_id: string | null
          organisation_type: string
          pcn_code: string | null
          practice_code: string
        }
        Insert: {
          created_at?: string
          ics_code: string
          ics_name: string
          id?: string
          name: string
          neighbourhood_id?: string | null
          organisation_type: string
          pcn_code?: string | null
          practice_code: string
        }
        Update: {
          created_at?: string
          ics_code?: string
          ics_name?: string
          id?: string
          name?: string
          neighbourhood_id?: string | null
          organisation_type?: string
          pcn_code?: string | null
          practice_code?: string
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
            referencedRelation: "meetings"
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
          created_at: string
          data_retention_date: string | null
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          format: string | null
          id: string
          location: string | null
          meeting_type: string
          start_time: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_retention_date?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          format?: string | null
          id?: string
          location?: string | null
          meeting_type?: string
          start_time?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_retention_date?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          format?: string | null
          id?: string
          location?: string | null
          meeting_type?: string
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
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
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          last_login: string | null
          meeting_retention_policy: string | null
          nhs_trust: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id?: string
          last_login?: string | null
          meeting_retention_policy?: string | null
          nhs_trust?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          last_login?: string | null
          meeting_retention_policy?: string | null
          nhs_trust?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
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
      user_roles: {
        Row: {
          ai_4_pm_access: boolean | null
          assigned_at: string | null
          assigned_by: string | null
          complaints_admin_access: boolean | null
          complaints_manager_access: boolean | null
          created_at: string | null
          gp_scribe_access: boolean | null
          id: string
          meeting_notes_access: boolean | null
          practice_id: string | null
          replywell_access: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          ai_4_pm_access?: boolean | null
          assigned_at?: string | null
          assigned_by?: string | null
          complaints_admin_access?: boolean | null
          complaints_manager_access?: boolean | null
          created_at?: string | null
          gp_scribe_access?: boolean | null
          id?: string
          meeting_notes_access?: boolean | null
          practice_id?: string | null
          replywell_access?: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          ai_4_pm_access?: boolean | null
          assigned_at?: string | null
          assigned_by?: string | null
          complaints_admin_access?: boolean | null
          complaints_manager_access?: boolean | null
          created_at?: string | null
          gp_scribe_access?: boolean | null
          id?: string
          meeting_notes_access?: boolean | null
          practice_id?: string | null
          replywell_access?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_complaint_reference: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_complaint_compliance_summary: {
        Args: { complaint_id_param: string }
        Returns: {
          total_items: number
          compliant_items: number
          compliance_percentage: number
          outstanding_items: string[]
        }[]
      }
      get_complaint_for_external_access: {
        Args: { access_token_param: string }
        Returns: {
          complaint_id: string
          reference_number: string
          complaint_title: string
          complaint_description: string
          category: Database["public"]["Enums"]["complaint_category"]
          incident_date: string
          location_service: string
          staff_name: string
          staff_email: string
          staff_role: string
          response_text: string
          response_submitted: boolean
        }[]
      }
      get_current_user_id: {
        Args: Record<PropertyKey, never>
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
      get_user_role_for_policy: {
        Args: { check_user_id?: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_roles: {
        Args: { _user_id?: string }
        Returns: {
          role: Database["public"]["Enums"]["app_role"]
          practice_id: string
          practice_name: string
        }[]
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
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
        Args: { _user_id: string; _practice_id: string }
        Returns: boolean
      }
      is_practice_manager_for_practice: {
        Args: { _user_id: string; _practice_id: string }
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
        Args: { p_complaint_id: string; p_action: string; p_details?: Json }
        Returns: string
      }
      log_complaint_activity: {
        Args: {
          p_complaint_id: string
          p_action_type: string
          p_action_description: string
          p_old_values?: Json
          p_new_values?: Json
        }
        Returns: string
      }
      log_compliance_change: {
        Args: {
          p_complaint_id: string
          p_compliance_check_id: string
          p_compliance_item: string
          p_previous_status: boolean
          p_new_status: boolean
          p_notes?: string
        }
        Returns: string
      }
      log_security_event: {
        Args: { p_event_type: string; p_user_id: string; p_details?: Json }
        Returns: string
      }
      log_system_activity: {
        Args: {
          p_table_name: string
          p_operation: string
          p_record_id?: string
          p_old_values?: Json
          p_new_values?: Json
        }
        Returns: string
      }
      purge_expired_data: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      submit_external_response: {
        Args: { access_token_param: string; response_text_param: string }
        Returns: boolean
      }
      validate_nhs_email: {
        Args: { email_address: string }
        Returns: boolean
      }
    }
    Enums: {
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
      complaint_priority: "low" | "medium" | "high" | "urgent"
      complaint_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "response_sent"
        | "closed"
        | "escalated"
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
    },
  },
} as const
