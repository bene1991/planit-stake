export interface RobotExecutionLog {
    id: string;
    created_at: string;
    stage: 'FILTER' | 'FROZEN' | 'SNAPSHOT' | 'VARIATION' | 'CLEANUP' | 'DISCARDED_PRE_FILTER' | 'DISCARDED_FILTER' | string;
    reason: string;
    league_id: string;
    details: any;
}

export interface LiveAlert {
    id: string;
    fixture_id: string;
    league_id: string;
    league_name?: string;
    home_team: string;
    away_team: string;
    minute_at_alert: number;
    variation_id: string;
    variation_name: string;
    stats_snapshot: any;
    goal_ht_result: 'pending' | 'green' | 'red' | string;
    over15_result: 'pending' | 'green' | 'red' | string;
    final_score: string;
    created_at: string;
    updated_at: string;
    is_discarded?: boolean;
    custom_odd_ht?: number;
    custom_odd_o15?: number;
    is_ht_discarded?: boolean;
    is_o15_discarded?: boolean;
    goal_events?: any;
    owner_id?: string;
    sheets_notified?: boolean;
}
