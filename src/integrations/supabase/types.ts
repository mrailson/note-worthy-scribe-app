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
      gp_practices: {
        Row: {
          created_at: string
          ics_code: string
          ics_name: string
          id: string
          name: string
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
          organisation_type?: string
          pcn_code?: string | null
          practice_code?: string
        }
        Relationships: []
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
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          id: string
          meeting_type: string
          start_time: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          meeting_type?: string
          start_time?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          meeting_type?: string
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
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
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          created_at: string | null
          id: string
          practice_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          practice_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          practice_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practice_details"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_user_id: {
        Args: Record<PropertyKey, never>
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
      is_system_admin: {
        Args: { _user_id?: string }
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
      ],
    },
  },
} as const
