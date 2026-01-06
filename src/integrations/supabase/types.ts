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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      bankroll: {
        Row: {
          created_at: string | null
          id: string
          owner_id: string
          total: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          owner_id: string
          total?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          owner_id?: string
          total?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_games: {
        Row: {
          added_to_planning: boolean | null
          away_team: string
          away_team_logo: string | null
          created_at: string
          date: string
          date_time: string | null
          home_team: string
          home_team_logo: string | null
          id: string
          league: string
          owner_id: string
          status: string | null
          time: string
          updated_at: string
        }
        Insert: {
          added_to_planning?: boolean | null
          away_team: string
          away_team_logo?: string | null
          created_at?: string
          date: string
          date_time?: string | null
          home_team: string
          home_team_logo?: string | null
          id?: string
          league: string
          owner_id: string
          status?: string | null
          time: string
          updated_at?: string
        }
        Update: {
          added_to_planning?: boolean | null
          away_team?: string
          away_team_logo?: string | null
          created_at?: string
          date?: string
          date_time?: string | null
          home_team?: string
          home_team_logo?: string | null
          id?: string
          league?: string
          owner_id?: string
          status?: string | null
          time?: string
          updated_at?: string
        }
        Relationships: []
      }
      estrategias: {
        Row: {
          condicoes_entrada: string | null
          created_at: string | null
          descricao: string | null
          id: string
          metodo_id: string
          nome: string
          odd_maxima: number | null
          odd_minima: number | null
          owner_id: string
          stake_tipo: string | null
          stake_valor: number | null
          tempo_minuto_final: number | null
          tempo_minuto_inicial: number | null
          tipo_operacao: string | null
          updated_at: string | null
        }
        Insert: {
          condicoes_entrada?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          metodo_id: string
          nome: string
          odd_maxima?: number | null
          odd_minima?: number | null
          owner_id: string
          stake_tipo?: string | null
          stake_valor?: number | null
          tempo_minuto_final?: number | null
          tempo_minuto_inicial?: number | null
          tipo_operacao?: string | null
          updated_at?: string | null
        }
        Update: {
          condicoes_entrada?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          metodo_id?: string
          nome?: string
          odd_maxima?: number | null
          odd_minima?: number | null
          owner_id?: string
          stake_tipo?: string | null
          stake_valor?: number | null
          tempo_minuto_final?: number | null
          tempo_minuto_inicial?: number | null
          tipo_operacao?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estrategias_metodo_id_fkey"
            columns: ["metodo_id"]
            isOneToOne: false
            referencedRelation: "methods"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture_cache: {
        Row: {
          events_raw: Json | null
          fixture_id: number
          id: string
          key_events: Json | null
          minute_now: number | null
          momentum_series: Json | null
          normalized_stats: Json | null
          stats_raw: Json | null
          status: string
          updated_at: string | null
        }
        Insert: {
          events_raw?: Json | null
          fixture_id: number
          id?: string
          key_events?: Json | null
          minute_now?: number | null
          momentum_series?: Json | null
          normalized_stats?: Json | null
          stats_raw?: Json | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          events_raw?: Json | null
          fixture_id?: number
          id?: string
          key_events?: Json | null
          minute_now?: number | null
          momentum_series?: Json | null
          normalized_stats?: Json | null
          stats_raw?: Json | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      games: {
        Row: {
          api_fixture_id: string | null
          away_team: string
          away_team_logo: string | null
          created_at: string | null
          date: string
          date_time: string | null
          final_score_away: number | null
          final_score_home: number | null
          goal_events: Json | null
          home_team: string
          home_team_logo: string | null
          id: string
          league: string
          notes: string | null
          owner_id: string
          status: string | null
          time: string
          updated_at: string | null
        }
        Insert: {
          api_fixture_id?: string | null
          away_team: string
          away_team_logo?: string | null
          created_at?: string | null
          date: string
          date_time?: string | null
          final_score_away?: number | null
          final_score_home?: number | null
          goal_events?: Json | null
          home_team: string
          home_team_logo?: string | null
          id?: string
          league: string
          notes?: string | null
          owner_id: string
          status?: string | null
          time: string
          updated_at?: string | null
        }
        Update: {
          api_fixture_id?: string | null
          away_team?: string
          away_team_logo?: string | null
          created_at?: string | null
          date?: string
          date_time?: string | null
          final_score_away?: number | null
          final_score_home?: number | null
          goal_events?: Json | null
          home_team?: string
          home_team_logo?: string | null
          id?: string
          league?: string
          notes?: string | null
          owner_id?: string
          status?: string | null
          time?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      method_operations: {
        Row: {
          commission_rate: number | null
          created_at: string | null
          entry_odds: number | null
          exit_odds: number | null
          game_id: string
          id: string
          method_id: string
          odd: number | null
          operation_type: string | null
          profit: number | null
          result: string | null
          stake_value: number | null
          updated_at: string | null
        }
        Insert: {
          commission_rate?: number | null
          created_at?: string | null
          entry_odds?: number | null
          exit_odds?: number | null
          game_id: string
          id?: string
          method_id: string
          odd?: number | null
          operation_type?: string | null
          profit?: number | null
          result?: string | null
          stake_value?: number | null
          updated_at?: string | null
        }
        Update: {
          commission_rate?: number | null
          created_at?: string | null
          entry_odds?: number | null
          exit_odds?: number | null
          game_id?: string
          id?: string
          method_id?: string
          odd?: number | null
          operation_type?: string | null
          profit?: number | null
          result?: string | null
          stake_value?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "method_operations_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "method_operations_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "methods"
            referencedColumns: ["id"]
          },
        ]
      }
      methods: {
        Row: {
          created_at: string | null
          id: string
          indice_confianca: number | null
          name: string
          owner_id: string
          percentage: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          indice_confianca?: number | null
          name: string
          owner_id: string
          percentage: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          indice_confianca?: number | null
          name?: string
          owner_id?: string
          percentage?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      operational_settings: {
        Row: {
          commission_rate: number | null
          created_at: string | null
          devolucao_maxima_percent: number | null
          id: string
          meta_mensal_stakes: number | null
          owner_id: string
          stake_value_reais: number | null
          stop_diario_stakes: number | null
          updated_at: string | null
        }
        Insert: {
          commission_rate?: number | null
          created_at?: string | null
          devolucao_maxima_percent?: number | null
          id?: string
          meta_mensal_stakes?: number | null
          owner_id: string
          stake_value_reais?: number | null
          stop_diario_stakes?: number | null
          updated_at?: string | null
        }
        Update: {
          commission_rate?: number | null
          created_at?: string | null
          devolucao_maxima_percent?: number | null
          id?: string
          meta_mensal_stakes?: number | null
          owner_id?: string
          stake_value_reais?: number | null
          stop_diario_stakes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          owner_id: string
          p256dh: string
          updated_at: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          owner_id: string
          p256dh: string
          updated_at?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          owner_id?: string
          p256dh?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          api_key: string | null
          created_at: string
          google_sheets_url: string | null
          id: string
          last_import_date: string | null
          owner_id: string
          telegram_bot_token: string | null
          telegram_chat_id: string | null
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          google_sheets_url?: string | null
          id?: string
          last_import_date?: string | null
          owner_id: string
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          created_at?: string
          google_sheets_url?: string | null
          id?: string
          last_import_date?: string | null
          owner_id?: string
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      simulacoes: {
        Row: {
          comentarios: string | null
          created_at: string | null
          data: string | null
          id: string
          metodo_id: string
          nome_sessao: string
          odd_entrada: number | null
          odd_saida: number | null
          owner_id: string
          resultado: string | null
          tipo_operacao: string | null
          updated_at: string | null
        }
        Insert: {
          comentarios?: string | null
          created_at?: string | null
          data?: string | null
          id?: string
          metodo_id: string
          nome_sessao: string
          odd_entrada?: number | null
          odd_saida?: number | null
          owner_id: string
          resultado?: string | null
          tipo_operacao?: string | null
          updated_at?: string | null
        }
        Update: {
          comentarios?: string | null
          created_at?: string | null
          data?: string | null
          id?: string
          metodo_id?: string
          nome_sessao?: string
          odd_entrada?: number | null
          odd_saida?: number | null
          owner_id?: string
          resultado?: string | null
          tipo_operacao?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simulacoes_metodo_id_fkey"
            columns: ["metodo_id"]
            isOneToOne: false
            referencedRelation: "methods"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorite_leagues: {
        Row: {
          country: string | null
          created_at: string
          id: string
          league_id: number
          league_name: string
          logo: string | null
          owner_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          league_id: number
          league_name: string
          logo?: string | null
          owner_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          league_id?: number
          league_name?: string
          logo?: string | null
          owner_id?: string
        }
        Relationships: []
      }
      vapid_keys: {
        Row: {
          created_at: string
          id: string
          private_key: string
          public_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          private_key: string
          public_key: string
        }
        Update: {
          created_at?: string
          id?: string
          private_key?: string
          public_key?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      atualizar_indices_confianca: {
        Args: { user_id_param: string }
        Returns: undefined
      }
      calcular_indice_confianca: {
        Args: { metodo_id_param: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
