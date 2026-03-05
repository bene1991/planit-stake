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
      api_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          response_data: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          response_data: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          response_data?: Json
        }
        Relationships: []
      }
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
      btts_entries: {
        Row: {
          away_team: string
          created_at: string | null
          date: string
          home_team: string
          id: string
          league: string
          method: string | null
          odd: number
          owner_id: string
          profit: number | null
          result: string
          stake_value: number
          time: string
          updated_at: string | null
        }
        Insert: {
          away_team: string
          created_at?: string | null
          date: string
          home_team: string
          id?: string
          league: string
          method?: string | null
          odd: number
          owner_id: string
          profit?: number | null
          result: string
          stake_value: number
          time: string
          updated_at?: string | null
        }
        Update: {
          away_team?: string
          created_at?: string | null
          date?: string
          home_team?: string
          id?: string
          league?: string
          method?: string | null
          odd?: number
          owner_id?: string
          profit?: number | null
          result?: string
          stake_value?: number
          time?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      btts_health_settings: {
        Row: {
          bankroll_current: number | null
          bankroll_initial: number | null
          bankroll_peak: number | null
          created_at: string | null
          id: string
          odd_range_max: number | null
          odd_range_min: number | null
          owner_id: string
          pause_until: string | null
          stake_percent: number | null
          stake_reduction_percent: number | null
          stake_reduction_until: string | null
          updated_at: string | null
        }
        Insert: {
          bankroll_current?: number | null
          bankroll_initial?: number | null
          bankroll_peak?: number | null
          created_at?: string | null
          id?: string
          odd_range_max?: number | null
          odd_range_min?: number | null
          owner_id: string
          pause_until?: string | null
          stake_percent?: number | null
          stake_reduction_percent?: number | null
          stake_reduction_until?: string | null
          updated_at?: string | null
        }
        Update: {
          bankroll_current?: number | null
          bankroll_initial?: number | null
          bankroll_peak?: number | null
          created_at?: string | null
          id?: string
          odd_range_max?: number | null
          odd_range_min?: number | null
          owner_id?: string
          pause_until?: string | null
          stake_percent?: number | null
          stake_reduction_percent?: number | null
          stake_reduction_until?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      btts_league_quarantine: {
        Row: {
          created_at: string | null
          id: string
          league: string
          owner_id: string
          quarantine_until: string
          reason: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          league: string
          owner_id: string
          quarantine_until: string
          reason?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          league?: string
          owner_id?: string
          quarantine_until?: string
          reason?: string | null
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
          btts_bookmaker: string | null
          btts_fetched_at: string | null
          btts_is_betfair: boolean | null
          btts_no: number | null
          btts_yes: number | null
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
          matchbook_event_id: string | null
          notes: string | null
          owner_id: string
          radar_url: string | null
          sofascore_crop_height: number | null
          sofascore_crop_top: number | null
          sofascore_url: string | null
          status: string | null
          time: string
          updated_at: string | null
        }
        Insert: {
          api_fixture_id?: string | null
          away_team: string
          away_team_logo?: string | null
          btts_bookmaker?: string | null
          btts_fetched_at?: string | null
          btts_is_betfair?: boolean | null
          btts_no?: number | null
          btts_yes?: number | null
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
          matchbook_event_id?: string | null
          notes?: string | null
          owner_id: string
          radar_url?: string | null
          sofascore_crop_height?: number | null
          sofascore_crop_top?: number | null
          sofascore_url?: string | null
          status?: string | null
          time: string
          updated_at?: string | null
        }
        Update: {
          api_fixture_id?: string | null
          away_team?: string
          away_team_logo?: string | null
          btts_bookmaker?: string | null
          btts_fetched_at?: string | null
          btts_is_betfair?: boolean | null
          btts_no?: number | null
          btts_yes?: number | null
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
          matchbook_event_id?: string | null
          notes?: string | null
          owner_id?: string
          radar_url?: string | null
          sofascore_crop_height?: number | null
          sofascore_crop_top?: number | null
          sofascore_url?: string | null
          status?: string | null
          time?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lay_operations_real: {
        Row: {
          away_team: string
          created_at: string
          final_score_away: number | null
          final_score_home: number | null
          fixture_id: string
          home_team: string
          id: string
          league: string
          liability: number
          odd_used: number
          operation_date: string
          profit: number | null
          stake: number
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          away_team: string
          created_at?: string
          final_score_away?: number | null
          final_score_home?: number | null
          fixture_id: string
          home_team: string
          id?: string
          league: string
          liability?: number
          odd_used: number
          operation_date: string
          profit?: number | null
          stake: number
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          away_team?: string
          created_at?: string
          final_score_away?: number | null
          final_score_home?: number | null
          fixture_id?: string
          home_team?: string
          id?: string
          league?: string
          liability?: number
          odd_used?: number
          operation_date?: string
          profit?: number | null
          stake?: number
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lay0x1_analyses: {
        Row: {
          away_team: string
          away_team_logo: string | null
          classification: string
          created_at: string
          criteria_snapshot: Json
          date: string
          final_score_away: number | null
          final_score_home: number | null
          fixture_id: string
          home_team: string
          home_team_logo: string | null
          ia_justification: string | null
          id: string
          is_backtest: boolean
          league: string
          liability: number | null
          odd_used: number | null
          owner_id: string
          profit: number | null
          resolved_at: string | null
          result: string | null
          score_value: number
          source_list: string
          stake: number | null
          was_0x1: boolean | null
          weights_snapshot: Json
        }
        Insert: {
          away_team: string
          away_team_logo?: string | null
          classification?: string
          created_at?: string
          criteria_snapshot?: Json
          date: string
          final_score_away?: number | null
          final_score_home?: number | null
          fixture_id: string
          home_team: string
          home_team_logo?: string | null
          ia_justification?: string | null
          id?: string
          is_backtest?: boolean
          league: string
          liability?: number | null
          odd_used?: number | null
          owner_id: string
          profit?: number | null
          resolved_at?: string | null
          result?: string | null
          score_value?: number
          source_list?: string
          stake?: number | null
          was_0x1?: boolean | null
          weights_snapshot?: Json
        }
        Update: {
          away_team?: string
          away_team_logo?: string | null
          classification?: string
          created_at?: string
          criteria_snapshot?: Json
          date?: string
          final_score_away?: number | null
          final_score_home?: number | null
          fixture_id?: string
          home_team?: string
          home_team_logo?: string | null
          ia_justification?: string | null
          id?: string
          is_backtest?: boolean
          league?: string
          liability?: number | null
          odd_used?: number | null
          owner_id?: string
          profit?: number | null
          resolved_at?: string | null
          result?: string | null
          score_value?: number
          source_list?: string
          stake?: number | null
          was_0x1?: boolean | null
          weights_snapshot?: Json
        }
        Relationships: []
      }
      lay0x1_blocked_leagues: {
        Row: {
          created_at: string
          id: string
          league_name: string
          owner_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          league_name: string
          owner_id: string
          reason?: string
        }
        Update: {
          created_at?: string
          id?: string
          league_name?: string
          owner_id?: string
          reason?: string
        }
        Relationships: []
      }
      lay0x1_calibration_history: {
        Row: {
          ai_recommendations: Json
          changes_summary: string[]
          created_at: string
          criterion_rates: Json
          cycle_number: number
          forced_rebalance: boolean
          general_rate: number
          id: string
          new_thresholds: Json
          new_weights: Json
          old_thresholds: Json
          old_weights: Json
          owner_id: string
          patterns_detected: Json
          threshold_details: Json
          total_analyses: number
          trigger_type: string
        }
        Insert: {
          ai_recommendations?: Json
          changes_summary?: string[]
          created_at?: string
          criterion_rates?: Json
          cycle_number?: number
          forced_rebalance?: boolean
          general_rate?: number
          id?: string
          new_thresholds?: Json
          new_weights?: Json
          old_thresholds?: Json
          old_weights?: Json
          owner_id: string
          patterns_detected?: Json
          threshold_details?: Json
          total_analyses?: number
          trigger_type?: string
        }
        Update: {
          ai_recommendations?: Json
          changes_summary?: string[]
          created_at?: string
          criterion_rates?: Json
          cycle_number?: number
          forced_rebalance?: boolean
          general_rate?: number
          id?: string
          new_thresholds?: Json
          new_weights?: Json
          old_thresholds?: Json
          old_weights?: Json
          owner_id?: string
          patterns_detected?: Json
          threshold_details?: Json
          total_analyses?: number
          trigger_type?: string
        }
        Relationships: []
      }
      lay0x1_ia_evolution_log: {
        Row: {
          adjustment_reason: string | null
          created_at: string | null
          cycle: number
          ia_games: number
          ia_win_rate: number | null
          id: string
          owner_id: string
          standard_win_rate: number | null
          thresholds_after: Json
          thresholds_before: Json
          total_games_analyzed: number
        }
        Insert: {
          adjustment_reason?: string | null
          created_at?: string | null
          cycle: number
          ia_games?: number
          ia_win_rate?: number | null
          id?: string
          owner_id: string
          standard_win_rate?: number | null
          thresholds_after: Json
          thresholds_before: Json
          total_games_analyzed?: number
        }
        Update: {
          adjustment_reason?: string | null
          created_at?: string | null
          cycle?: number
          ia_games?: number
          ia_win_rate?: number | null
          id?: string
          owner_id?: string
          standard_win_rate?: number | null
          thresholds_after?: Json
          thresholds_before?: Json
          total_games_analyzed?: number
        }
        Relationships: []
      }
      lay0x1_ia_thresholds: {
        Row: {
          bound_max_away_odd: number
          bound_max_btts: number
          bound_max_cs: number
          bound_max_home_goals: number
          bound_min_away_odd: number
          bound_min_btts: number
          bound_min_cs: number
          bound_min_home_goals: number
          calibration_trigger: number
          created_at: string | null
          cycle: number
          games_since_calibration: number
          id: string
          last_calibrated_at: string | null
          max_away_clean_sheet_pct: number
          max_away_odd: number
          max_home_clean_sheet_pct: number
          min_away_conceded_avg: number
          min_btts_pct: number
          min_home_goals_avg: number
          min_over25_pct: number
          owner_id: string
          updated_at: string | null
        }
        Insert: {
          bound_max_away_odd?: number
          bound_max_btts?: number
          bound_max_cs?: number
          bound_max_home_goals?: number
          bound_min_away_odd?: number
          bound_min_btts?: number
          bound_min_cs?: number
          bound_min_home_goals?: number
          calibration_trigger?: number
          created_at?: string | null
          cycle?: number
          games_since_calibration?: number
          id?: string
          last_calibrated_at?: string | null
          max_away_clean_sheet_pct?: number
          max_away_odd?: number
          max_home_clean_sheet_pct?: number
          min_away_conceded_avg?: number
          min_btts_pct?: number
          min_home_goals_avg?: number
          min_over25_pct?: number
          owner_id: string
          updated_at?: string | null
        }
        Update: {
          bound_max_away_odd?: number
          bound_max_btts?: number
          bound_max_cs?: number
          bound_max_home_goals?: number
          bound_min_away_odd?: number
          bound_min_btts?: number
          bound_min_cs?: number
          bound_min_home_goals?: number
          calibration_trigger?: number
          created_at?: string | null
          cycle?: number
          games_since_calibration?: number
          id?: string
          last_calibrated_at?: string | null
          max_away_clean_sheet_pct?: number
          max_away_odd?: number
          max_home_clean_sheet_pct?: number
          min_away_conceded_avg?: number
          min_btts_pct?: number
          min_home_goals_avg?: number
          min_over25_pct?: number
          owner_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lay0x1_odds_cache: {
        Row: {
          away_odd: number
          cached_at: string
          date: string
          draw_odd: number
          fixture_id: number
          home_odd: number
          id: string
        }
        Insert: {
          away_odd?: number
          cached_at?: string
          date: string
          draw_odd?: number
          fixture_id: number
          home_odd?: number
          id?: string
        }
        Update: {
          away_odd?: number
          cached_at?: string
          date?: string
          draw_odd?: number
          fixture_id?: number
          home_odd?: number
          id?: string
        }
        Relationships: []
      }
      lay0x1_stats_cache: {
        Row: {
          away_clean_sheet_pct: number | null
          away_conceded_avg: number
          away_goals_avg: number | null
          btts_pct: number | null
          cached_at: string
          date: string
          fixture_id: number
          h2h_0x1_count: number
          home_clean_sheet_pct: number | null
          home_conceded_avg: number | null
          home_goals_avg: number
          id: string
          league_goals_avg: number
          over15_combined: number
          over25_pct: number | null
        }
        Insert: {
          away_clean_sheet_pct?: number | null
          away_conceded_avg?: number
          away_goals_avg?: number | null
          btts_pct?: number | null
          cached_at?: string
          date: string
          fixture_id: number
          h2h_0x1_count?: number
          home_clean_sheet_pct?: number | null
          home_conceded_avg?: number | null
          home_goals_avg?: number
          id?: string
          league_goals_avg?: number
          over15_combined?: number
          over25_pct?: number | null
        }
        Update: {
          away_clean_sheet_pct?: number | null
          away_conceded_avg?: number
          away_goals_avg?: number | null
          btts_pct?: number | null
          cached_at?: string
          date?: string
          fixture_id?: number
          h2h_0x1_count?: number
          home_clean_sheet_pct?: number | null
          home_conceded_avg?: number | null
          home_goals_avg?: number
          id?: string
          league_goals_avg?: number
          over15_combined?: number
          over25_pct?: number | null
        }
        Relationships: []
      }
      lay0x1_weights: {
        Row: {
          created_at: string
          cycle_count: number
          defensive_weight: number
          h2h_weight: number
          id: string
          last_calibration_at: string | null
          league_avg_weight: number
          max_away_odd: number
          max_h2h_0x1: number
          min_away_conceded_avg: number
          min_home_goals_avg: number
          min_over15_combined: number
          min_score: number
          odds_weight: number
          offensive_weight: number
          over_weight: number
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_count?: number
          defensive_weight?: number
          h2h_weight?: number
          id?: string
          last_calibration_at?: string | null
          league_avg_weight?: number
          max_away_odd?: number
          max_h2h_0x1?: number
          min_away_conceded_avg?: number
          min_home_goals_avg?: number
          min_over15_combined?: number
          min_score?: number
          odds_weight?: number
          offensive_weight?: number
          over_weight?: number
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_count?: number
          defensive_weight?: number
          h2h_weight?: number
          id?: string
          last_calibration_at?: string | null
          league_avg_weight?: number
          max_away_odd?: number
          max_h2h_0x1?: number
          min_away_conceded_avg?: number
          min_home_goals_avg?: number
          min_over15_combined?: number
          min_score?: number
          odds_weight?: number
          offensive_weight?: number
          over_weight?: number
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      lay1x0_analyses: {
        Row: {
          away_team: string
          away_team_logo: string | null
          classification: string
          created_at: string | null
          criteria_snapshot: Json | null
          date: string
          fixture_id: string
          home_team: string
          home_team_logo: string | null
          ia_justification: string | null
          id: string
          is_backtest: boolean | null
          league: string
          owner_id: string
          profit: number | null
          result: string | null
          score_value: number
          source_list: string | null
          weights_snapshot: Json | null
        }
        Insert: {
          away_team: string
          away_team_logo?: string | null
          classification?: string
          created_at?: string | null
          criteria_snapshot?: Json | null
          date: string
          fixture_id: string
          home_team: string
          home_team_logo?: string | null
          ia_justification?: string | null
          id?: string
          is_backtest?: boolean | null
          league: string
          owner_id: string
          profit?: number | null
          result?: string | null
          score_value?: number
          source_list?: string | null
          weights_snapshot?: Json | null
        }
        Update: {
          away_team?: string
          away_team_logo?: string | null
          classification?: string
          created_at?: string | null
          criteria_snapshot?: Json | null
          date?: string
          fixture_id?: string
          home_team?: string
          home_team_logo?: string | null
          ia_justification?: string | null
          id?: string
          is_backtest?: boolean | null
          league?: string
          owner_id?: string
          profit?: number | null
          result?: string | null
          score_value?: number
          source_list?: string | null
          weights_snapshot?: Json | null
        }
        Relationships: []
      }
      live_alerts: {
        Row: {
          away_team: string | null
          created_at: string
          final_score: string | null
          fixture_id: string
          goal_ht_result: string | null
          home_team: string | null
          id: string
          league_id: string | null
          league_name: string | null
          minute_at_alert: number
          over15_result: string | null
          stats_snapshot: Json | null
          updated_at: string
          variation_id: string | null
          variation_name: string | null
        }
        Insert: {
          away_team?: string | null
          created_at?: string
          final_score?: string | null
          fixture_id: string
          goal_ht_result?: string | null
          home_team?: string | null
          id?: string
          league_id?: string | null
          league_name?: string | null
          minute_at_alert: number
          over15_result?: string | null
          stats_snapshot?: Json | null
          updated_at?: string
          variation_id?: string | null
          variation_name?: string | null
        }
        Update: {
          away_team?: string | null
          created_at?: string
          final_score?: string | null
          fixture_id?: string
          goal_ht_result?: string | null
          home_team?: string | null
          id?: string
          league_id?: string | null
          league_name?: string | null
          minute_at_alert?: number
          over15_result?: string | null
          stats_snapshot?: Json | null
          updated_at?: string
          variation_id?: string | null
          variation_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_alerts_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "robot_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      live_monitor_state: {
        Row: {
          fixture_id: string
          game_id: string
          id: string
          last_away_score: number | null
          last_events_count: number | null
          last_home_score: number | null
          notified_events: Json | null
          owner_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          fixture_id: string
          game_id: string
          id?: string
          last_away_score?: number | null
          last_events_count?: number | null
          last_home_score?: number | null
          notified_events?: Json | null
          owner_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          fixture_id?: string
          game_id?: string
          id?: string
          last_away_score?: number | null
          last_events_count?: number | null
          last_home_score?: number | null
          notified_events?: Json | null
          owner_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_monitor_state_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stats_snapshots: {
        Row: {
          created_at: string
          fixture_id: string
          id: string
          minute: number
          stats_json: Json
        }
        Insert: {
          created_at?: string
          fixture_id: string
          id?: string
          minute: number
          stats_json: Json
        }
        Update: {
          created_at?: string
          fixture_id?: string
          id?: string
          minute?: number
          stats_json?: Json
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
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          indice_confianca?: number | null
          name: string
          owner_id: string
          percentage: number
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          indice_confianca?: number | null
          name?: string
          owner_id?: string
          percentage?: number
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      monthly_reports: {
        Row: {
          ai_negative_points: Json | null
          ai_positive_points: Json | null
          ai_score: number | null
          ai_suggestions: Json | null
          ai_summary: string | null
          best_day_profit: number | null
          best_method_name: string | null
          best_method_profit: number | null
          closed_at: string | null
          created_at: string | null
          greens: number
          id: string
          max_drawdown: number
          max_green_streak: number
          max_red_streak: number
          owner_id: string
          profit_money: number
          profit_stakes: number
          reds: number
          total_operations: number
          win_rate: number
          worst_day_profit: number | null
          year_month: string
        }
        Insert: {
          ai_negative_points?: Json | null
          ai_positive_points?: Json | null
          ai_score?: number | null
          ai_suggestions?: Json | null
          ai_summary?: string | null
          best_day_profit?: number | null
          best_method_name?: string | null
          best_method_profit?: number | null
          closed_at?: string | null
          created_at?: string | null
          greens?: number
          id?: string
          max_drawdown?: number
          max_green_streak?: number
          max_red_streak?: number
          owner_id: string
          profit_money?: number
          profit_stakes?: number
          reds?: number
          total_operations?: number
          win_rate?: number
          worst_day_profit?: number | null
          year_month: string
        }
        Update: {
          ai_negative_points?: Json | null
          ai_positive_points?: Json | null
          ai_score?: number | null
          ai_suggestions?: Json | null
          ai_summary?: string | null
          best_day_profit?: number | null
          best_method_name?: string | null
          best_method_profit?: number | null
          closed_at?: string | null
          created_at?: string | null
          greens?: number
          id?: string
          max_drawdown?: number
          max_green_streak?: number
          max_red_streak?: number
          owner_id?: string
          profit_money?: number
          profit_stakes?: number
          reds?: number
          total_operations?: number
          win_rate?: number
          worst_day_profit?: number | null
          year_month?: string
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
      robot_blocked_leagues: {
        Row: {
          active: boolean | null
          created_at: string
          id: string
          league_id: string
          league_name: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          id?: string
          league_id: string
          league_name: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          id?: string
          league_id?: string
          league_name?: string
        }
        Relationships: []
      }
      robot_execution_logs: {
        Row: {
          created_at: string
          details: Json | null
          execution_time: string
          fixture_id: string
          id: string
          league_id: string | null
          reason: string
          stage: string
          variation_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          execution_time?: string
          fixture_id: string
          id?: string
          league_id?: string | null
          reason: string
          stage: string
          variation_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          execution_time?: string
          fixture_id?: string
          id?: string
          league_id?: string | null
          reason?: string
          stage?: string
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "robot_execution_logs_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "robot_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      robot_variations: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          first_half_only: boolean | null
          id: string
          max_minute: number | null
          min_combined_shots: number | null
          min_dangerous_attacks: number | null
          min_lambda_total: number | null
          min_minute: number | null
          min_over15_pre: number | null
          min_possession: number | null
          min_shots: number | null
          min_shots_on_target: number | null
          min_expected_goals: number | null
          min_corners: number | null
          min_shots_insidebox: number | null
          name: string
          require_score_zero: boolean | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          first_half_only?: boolean | null
          id?: string
          max_minute?: number | null
          min_combined_shots?: number | null
          min_dangerous_attacks?: number | null
          min_lambda_total?: number | null
          min_minute?: number | null
          min_over15_pre?: number | null
          min_possession?: number | null
          min_shots?: number | null
          min_shots_on_target?: number | null
          min_expected_goals?: number | null
          min_corners?: number | null
          min_shots_insidebox?: number | null
          name: string
          require_score_zero?: boolean | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          first_half_only?: boolean | null
          id?: string
          max_minute?: number | null
          min_combined_shots?: number | null
          min_dangerous_attacks?: number | null
          min_lambda_total?: number | null
          min_minute?: number | null
          min_over15_pre?: number | null
          min_possession?: number | null
          min_shots?: number | null
          min_shots_on_target?: number | null
          min_expected_goals?: number | null
          min_corners?: number | null
          min_shots_insidebox?: number | null
          name?: string
          require_score_zero?: boolean | null
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
      telegram_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message: string
          metadata: Json | null
          status: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message: string
          metadata?: Json | null
          status?: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          status?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
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
