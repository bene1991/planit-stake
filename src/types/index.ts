export interface Method {
  id: string;
  name: string;
  percentage: number;
  indice_confianca?: number;
}

export interface Bankroll {
  total: number;
  methods: Method[];
}

export interface MethodOperation {
  methodId: string;
  operationType?: 'Back' | 'Lay';
  entryOdds?: number;
  exitOdds?: number;
  result?: 'Green' | 'Red';
}

export interface Game {
  id: string;
  date: string;
  time: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  methodOperations: MethodOperation[];
  notes?: string;
  status?: string;
}

export interface Estrategia {
  id: string;
  owner_id: string;
  nome: string;
  descricao?: string;
  metodo_id: string;
  tipo_operacao?: 'Back' | 'Lay';
  odd_minima?: number;
  odd_maxima?: number;
  stake_tipo?: 'fixa' | 'percentual';
  stake_valor?: number;
  tempo_minuto_inicial?: number;
  tempo_minuto_final?: number;
  condicoes_entrada?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Simulacao {
  id: string;
  owner_id: string;
  data: string;
  nome_sessao: string;
  metodo_id: string;
  tipo_operacao?: 'Back' | 'Lay';
  odd_entrada?: number;
  odd_saida?: number;
  resultado?: 'Green' | 'Red';
  comentarios?: string;
  created_at?: string;
  updated_at?: string;
}
