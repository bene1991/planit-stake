import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, Loader2, Settings2, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLay0x1Weights, type Lay0x1Weights } from '@/hooks/useLay0x1Weights';
import { useLay0x1Analyses } from '@/hooks/useLay0x1Analyses';
import { Lay0x1ScoreCard } from './Lay0x1ScoreCard';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface AnalysisResult {
  fixture_id: string;
  home_team: string;
  away_team: string;
  league: string;
  date: string;
  approved: boolean;
  score_value: number;
  classification: string;
  criteria: any;
  reasons: string[];
}

const CACHE_KEY_PREFIX = 'lay0x1_results_';
const CACHE_META_PREFIX = 'lay0x1_meta_';

function getCachedResults(date: string): AnalysisResult[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY_PREFIX + date);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function setCachedResults(date: string, results: AnalysisResult[], meta?: any) {
  try {
    sessionStorage.setItem(CACHE_KEY_PREFIX + date, JSON.stringify(results));
    if (meta) sessionStorage.setItem(CACHE_META_PREFIX + date, JSON.stringify(meta));
  } catch { /* storage full */ }
}

function getCachedMeta(date: string): any {
  try {
    const raw = sessionStorage.getItem(CACHE_META_PREFIX + date);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export const Lay0x1Scanner = () => {
  const { weights, saveWeights } = useLay0x1Weights();
  const { saveAnalysis } = useLay0x1Analyses();
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const autoFetchedRef = useRef<string | null>(null);

  // Load from cache on mount / date change
  useEffect(() => {
    const cached = getCachedResults(selectedDate);
    if (cached && cached.length > 0) {
      setResults(cached);
      setMeta(getCachedMeta(selectedDate));
      autoFetchedRef.current = selectedDate;
    } else {
      setResults([]);
      setMeta(null);
    }
  }, [selectedDate]);

  // Auto-fetch on mount if no cache
  useEffect(() => {
    if (autoFetchedRef.current === selectedDate) return;
    const cached = getCachedResults(selectedDate);
    if (!cached) {
      autoFetchedRef.current = selectedDate;
      analyzeGames();
    }
  }, [selectedDate]);

  const analyzeGames = useCallback(async () => {
    setLoading(true);
    setResults([]);
    setMeta(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        toast.error('Faça login para usar o scanner');
        return;
      }

      const res = await supabase.functions.invoke('analyze-lay0x1', {
        body: { date: selectedDate },
      });

      if (res.error) {
        toast.error('Erro na análise');
        console.error(res.error);
        return;
      }

      const analysisResults: AnalysisResult[] = res.data?.results || [];
      const resMeta = {
        total_fixtures: res.data?.total_fixtures || 0,
        pre_filtered: res.data?.pre_filtered || 0,
        analyzed: res.data?.analyzed || 0,
      };

      setResults(analysisResults);
      setMeta(resMeta);
      setCachedResults(selectedDate, analysisResults, resMeta);
      autoFetchedRef.current = selectedDate;

      const approved = analysisResults.filter(r => r.approved).length;
      toast.success(`${resMeta.total_fixtures} jogos → ${resMeta.pre_filtered} pré-filtrados → ${approved} aprovados`);
    } catch (err) {
      console.error(err);
      toast.error('Erro na análise');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const handleSave = async (result: AnalysisResult) => {
    setSavingId(result.fixture_id);
    await saveAnalysis({
      fixture_id: result.fixture_id,
      home_team: result.home_team,
      away_team: result.away_team,
      league: result.league,
      date: result.date,
      score_value: result.score_value,
      classification: result.classification,
      criteria_snapshot: result.criteria,
      weights_snapshot: weights,
    });
    toast.success('Análise salva!');
    setSavingId(null);
  };

  const handleWeightChange = (key: keyof Lay0x1Weights, value: number) => {
    saveWeights({ [key]: value });
  };

  const approvedResults = results.filter(r => r.approved);
  const rejectedResults = results.filter(r => !r.approved);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full sm:w-auto"
            />
            <Button onClick={analyzeGames} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? 'Analisando...' : 'Analisar Jogos do Dia'}
            </Button>
          </div>

          {loading && (
            <div className="mt-3 space-y-1">
              <Progress value={undefined} className="h-2" />
              <p className="text-xs text-muted-foreground">Buscando jogos, filtrando por odds e analisando...</p>
            </div>
          )}

          {!loading && meta && (
            <p className="text-xs text-muted-foreground mt-2">
              {meta.total_fixtures} jogos no dia → {meta.pre_filtered} com odd casa &lt; visitante → {approvedResults.length} aprovados
            </p>
          )}
        </CardContent>
      </Card>

      {/* Settings */}
      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Settings2 className="w-4 h-4" /> Ajustar Critérios</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card>
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Mín. gols mandante (casa): {weights.min_home_goals_avg}</Label>
                <Slider value={[weights.min_home_goals_avg]} min={0.5} max={3} step={0.1}
                  onValueChange={([v]) => handleWeightChange('min_home_goals_avg', v)} />
              </div>
              <div>
                <Label className="text-xs">Mín. gols sofridos visitante (fora): {weights.min_away_conceded_avg}</Label>
                <Slider value={[weights.min_away_conceded_avg]} min={0.5} max={3} step={0.1}
                  onValueChange={([v]) => handleWeightChange('min_away_conceded_avg', v)} />
              </div>
              <div>
                <Label className="text-xs">Máx. odd visitante: {weights.max_away_odd}</Label>
                <Slider value={[weights.max_away_odd]} min={2} max={8} step={0.1}
                  onValueChange={([v]) => handleWeightChange('max_away_odd', v)} />
              </div>
              <div>
                <Label className="text-xs">Mín. Over 1.5 combinado: {weights.min_over15_combined}%</Label>
                <Slider value={[weights.min_over15_combined]} min={30} max={150} step={5}
                  onValueChange={([v]) => handleWeightChange('min_over15_combined', v)} />
              </div>
              <div>
                <Label className="text-xs">Máx. 0x1 no H2H: {weights.max_h2h_0x1}</Label>
                <Slider value={[weights.max_h2h_0x1]} min={0} max={3} step={1}
                  onValueChange={([v]) => handleWeightChange('max_h2h_0x1', v)} />
              </div>
              <div className="sm:col-span-2 p-2 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">
                  ⚡ <strong>Critério fixo:</strong> Odd da casa sempre deve ser menor que a do visitante (pré-filtro automático)
                </p>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Results */}
      {!loading && results.length > 0 && (
        <>
          {approvedResults.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-emerald-400 mb-2">
                ✅ Aprovados ({approvedResults.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {approvedResults.map(r => (
                  <Lay0x1ScoreCard
                    key={r.fixture_id}
                    homeTeam={r.home_team}
                    awayTeam={r.away_team}
                    league={r.league}
                    scoreValue={r.score_value}
                    classification={r.classification}
                    approved={r.approved}
                    criteria={r.criteria}
                    reasons={r.reasons}
                    onSave={() => handleSave(r)}
                    saving={savingId === r.fixture_id}
                  />
                ))}
              </div>
            </div>
          )}

          {rejectedResults.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between text-sm text-muted-foreground">
                  <span>❌ Reprovados ({rejectedResults.length})</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  {rejectedResults.map(r => (
                    <Lay0x1ScoreCard
                      key={r.fixture_id}
                      homeTeam={r.home_team}
                      awayTeam={r.away_team}
                      league={r.league}
                      scoreValue={r.score_value}
                      classification={r.classification}
                      approved={r.approved}
                      criteria={r.criteria}
                      reasons={r.reasons}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}
    </div>
  );
};
