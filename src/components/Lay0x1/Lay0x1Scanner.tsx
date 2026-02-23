import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, Loader2, Settings2, ChevronDown, RefreshCw } from 'lucide-react';
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

export const Lay0x1Scanner = () => {
  const { weights, saveWeights } = useLay0x1Weights();
  const { saveAnalysis } = useLay0x1Analyses();
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFixtures, setLoadingFixtures] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [fixtures, setFixtures] = useState<any[]>([]);

  const fetchFixtures = async () => {
    setLoadingFixtures(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        toast.error('Faça login para usar o scanner');
        return;
      }

      // Fetch fixtures for the date
      const res = await supabase.functions.invoke('api-football', {
        body: { endpoint: 'fixtures', params: { date: selectedDate } },
      });

      const fixturesList = res.data?.response || [];
      setFixtures(fixturesList);
      toast.success(`${fixturesList.length} jogos encontrados`);
    } catch (err) {
      toast.error('Erro ao buscar jogos');
    } finally {
      setLoadingFixtures(false);
    }
  };

  const analyzeFixtures = async () => {
    if (fixtures.length === 0) {
      toast.error('Busque os jogos primeiro');
      return;
    }

    setLoading(true);
    setResults([]);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) return;

      const fixtureIds = fixtures.map((f: any) => f.fixture?.id).filter(Boolean);

      // Analyze in batches of 10
      const batchSize = 10;
      const allResults: AnalysisResult[] = [];

      for (let i = 0; i < fixtureIds.length; i += batchSize) {
        const batch = fixtureIds.slice(i, i + batchSize);
        const res = await supabase.functions.invoke('analyze-lay0x1', {
          body: { fixture_ids: batch },
        });

        if (res.data?.results) {
          allResults.push(...res.data.results);
        }
      }

      setResults(allResults);
      const approved = allResults.filter(r => r.approved).length;
      toast.success(`Análise completa: ${approved} aprovados de ${allResults.length}`);
    } catch (err) {
      console.error(err);
      toast.error('Erro na análise');
    } finally {
      setLoading(false);
    }
  };

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
            <Button onClick={fetchFixtures} disabled={loadingFixtures} variant="outline" className="gap-2">
              {loadingFixtures ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar Jogos
            </Button>
            <Button onClick={analyzeFixtures} disabled={loading || fixtures.length === 0} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Analisar ({fixtures.length})
            </Button>
          </div>

          {fixtures.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {fixtures.length} jogos encontrados para {selectedDate}
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
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Analisando jogos...</span>
        </div>
      )}

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
