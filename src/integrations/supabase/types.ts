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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      auto_trade_settings: {
        Row: {
          allowed_providers: string[]
          cooldown_seconds: number
          created_at: string
          enabled: boolean
          id: string
          kill_switch: boolean
          max_daily_loss: number
          max_open_positions: number
          max_position_size: number
          min_confidence: number
          min_signal_score: number
          paper_mode: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_providers?: string[]
          cooldown_seconds?: number
          created_at?: string
          enabled?: boolean
          id?: string
          kill_switch?: boolean
          max_daily_loss?: number
          max_open_positions?: number
          max_position_size?: number
          min_confidence?: number
          min_signal_score?: number
          paper_mode?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_providers?: string[]
          cooldown_seconds?: number
          created_at?: string
          enabled?: boolean
          id?: string
          kill_switch?: boolean
          max_daily_loss?: number
          max_open_positions?: number
          max_position_size?: number
          min_confidence?: number
          min_signal_score?: number
          paper_mode?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_pnl: {
        Row: {
          id: string
          kill_switch_triggered: boolean
          realized_pnl: number
          trade_count: number
          trade_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          kill_switch_triggered?: boolean
          realized_pnl?: number
          trade_count?: number
          trade_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          kill_switch_triggered?: boolean
          realized_pnl?: number
          trade_count?: number
          trade_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      engine_runs: {
        Row: {
          details: Json | null
          error_message: string | null
          finished_at: string | null
          id: string
          paper_mode: boolean | null
          signals_found: number | null
          started_at: string
          status: string
          trades_executed: number | null
          trades_skipped: number | null
          user_id: string
        }
        Insert: {
          details?: Json | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          paper_mode?: boolean | null
          signals_found?: number | null
          started_at?: string
          status?: string
          trades_executed?: number | null
          trades_skipped?: number | null
          user_id: string
        }
        Update: {
          details?: Json | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          paper_mode?: boolean | null
          signals_found?: number | null
          started_at?: string
          status?: string
          trades_executed?: number | null
          trades_skipped?: number | null
          user_id?: string
        }
        Relationships: []
      }
      order_history: {
        Row: {
          created_at: string
          error_message: string | null
          executed_at: string | null
          id: string
          market_id: string
          order_type: string
          paper_mode: boolean
          position_id: string | null
          price: number
          provider: string
          provider_order_id: string | null
          side: Database["public"]["Enums"]["trade_side"]
          size: number
          status: Database["public"]["Enums"]["trade_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          market_id: string
          order_type?: string
          paper_mode?: boolean
          position_id?: string | null
          price: number
          provider: string
          provider_order_id?: string | null
          side: Database["public"]["Enums"]["trade_side"]
          size: number
          status?: Database["public"]["Enums"]["trade_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          market_id?: string
          order_type?: string
          paper_mode?: boolean
          position_id?: string | null
          price?: number
          provider?: string
          provider_order_id?: string | null
          side?: Database["public"]["Enums"]["trade_side"]
          size?: number
          status?: Database["public"]["Enums"]["trade_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_history_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          closed_at: string | null
          confidence: number | null
          current_price: number | null
          entry_price: number
          id: string
          market_id: string
          market_title: string
          opened_at: string
          paper_mode: boolean
          pnl: number | null
          provider: string
          setup_type: string | null
          side: Database["public"]["Enums"]["trade_side"]
          signal_score: number | null
          size: number
          status: string
          stop_price: number | null
          target_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          confidence?: number | null
          current_price?: number | null
          entry_price: number
          id?: string
          market_id: string
          market_title: string
          opened_at?: string
          paper_mode?: boolean
          pnl?: number | null
          provider: string
          setup_type?: string | null
          side: Database["public"]["Enums"]["trade_side"]
          signal_score?: number | null
          size: number
          status?: string
          stop_price?: number | null
          target_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          confidence?: number | null
          current_price?: number | null
          entry_price?: number
          id?: string
          market_id?: string
          market_title?: string
          opened_at?: string
          paper_mode?: boolean
          pnl?: number | null
          provider?: string
          setup_type?: string | null
          side?: Database["public"]["Enums"]["trade_side"]
          signal_score?: number | null
          size?: number
          status?: string
          stop_price?: number | null
          target_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      trade_side: "yes" | "no"
      trade_status:
        | "pending"
        | "filled"
        | "partial"
        | "cancelled"
        | "failed"
        | "stopped"
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
      app_role: ["admin", "moderator", "user"],
      trade_side: ["yes", "no"],
      trade_status: [
        "pending",
        "filled",
        "partial",
        "cancelled",
        "failed",
        "stopped",
      ],
    },
  },
} as const
