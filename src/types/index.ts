export interface Method {
  id: string;
  name: string;
  percentage: number;
}

export interface Bankroll {
  total: number;
  methods: Method[];
}

export interface Game {
  id: string;
  date: string;
  time: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  methods: string[];
  notes?: string;
  operationType?: 'Back' | 'Lay';
  entryOdds?: number;
  exitOdds?: number;
  result?: 'Green' | 'Red';
}
