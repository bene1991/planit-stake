import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { FileUp, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';

interface GameData {
  date: string;
  time: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  status?: string;
  selected?: boolean;
  dateConverted?: boolean;
  timeConverted?: boolean;
}

interface GameImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  lastImportDate?: string;
}

export const GameImporter = ({ open, onOpenChange, onSuccess, lastImportDate }: GameImporterProps) => {
  const { user } = useAuth();
  const [games, setGames] = useState<GameData[]>([]);
  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);

  // Converter número serial do Excel para data DD/MM/AAAA
  const excelSerialToDate = (serial: number): string => {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + serial * 86400000);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Converter fração do dia do Excel para HH:mm
  const excelSerialToTime = (serial: number): string => {
    const totalMinutes = Math.round(serial * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  // Interpretar data (texto ou número serial)
  const parseDate = (value: any): { date: string; converted: boolean } => {
    if (typeof value === 'number' && value > 40000) {
      return { date: excelSerialToDate(value), converted: true };
    }
    if (typeof value === 'string') {
      // Se já está em DD/MM/AAAA, manter
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
        return { date: value, converted: false };
      }
      // Se está em YYYY-MM-DD, converter
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-');
        return { date: `${day}/${month}/${year}`, converted: false };
      }
    }
    return { date: String(value || ''), converted: false };
  };

  // Interpretar horário (texto ou número serial)
  const parseTime = (value: any): { time: string; converted: boolean } => {
    if (typeof value === 'number' && value >= 0 && value < 1) {
      return { time: excelSerialToTime(value), converted: true };
    }
    if (typeof value === 'string') {
      // Se já está em HH:mm ou HH:mm:ss, normalizar para HH:mm
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(value)) {
        const parts = value.split(':');
        return { time: `${parts[0].padStart(2, '0')}:${parts[1]}`, converted: false };
      }
    }
    return { time: String(value || ''), converted: false };
  };

  const downloadTemplate = () => {
    const template = [
      ['Data', 'Horário', 'Liga', 'TimeCasa', 'TimeVisitante', 'Status'],
      ['09/11/2025', '14:00', 'Brasileirão', 'Flamengo', 'Palmeiras', 'Not Started'],
      ['09/11/2025', '16:00', 'Premier League', 'Arsenal', 'Liverpool', 'Not Started'],
      ['09/11/2025', '18:30', 'La Liga', 'Real Madrid', 'Barcelona', 'Not Started'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Jogos');
    XLSX.writeFile(wb, 'template_jogos.xlsx');
    toast.success('Template baixado com sucesso!');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limpar jogos anteriores
    setGames([]);
    setProcessing(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Skip header row
      const rows = jsonData.slice(1).filter(row => row.length >= 5);
      
      const parsedGames: GameData[] = rows.map(row => {
        const dateResult = parseDate(row[0]);
        const timeResult = parseTime(row[1]);

        return {
          date: dateResult.date,
          time: timeResult.time,
          league: row[2]?.toString() || '',
          homeTeam: row[3]?.toString() || '',
          awayTeam: row[4]?.toString() || '',
          status: row[5]?.toString() || 'Not Started',
          selected: true,
          dateConverted: dateResult.converted,
          timeConverted: timeResult.converted,
        };
      });

      setGames(parsedGames);
      toast.success(`${parsedGames.length} jogos encontrados na planilha`);
    } catch (error) {
      console.error('Error reading file:', error);
      toast.error('Erro ao ler arquivo. Verifique o formato da planilha.');
    } finally {
      setProcessing(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const [textInput, setTextInput] = useState('');

  const handleTextParse = () => {
    if (!textInput.trim()) {
      toast.warning('Cole os dados dos jogos para processar');
      return;
    }

    // Limpar jogos anteriores
    setGames([]);
    setProcessing(true);

    try {
      const lines = textInput.split('\n').filter(line => line.trim());
      const parsedGames: GameData[] = [];

      // Parse text to extract game data
      // Format expected: "HH:mm Liga Casa vs Visitante" or similar
      lines.forEach(line => {
        // Try to detect time patterns (HH:mm)
        const timeMatch = line.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          // Try to extract team names (usually separated by 'vs', 'x', '-')
          const teamsMatch = line.match(/([A-Za-zÀ-ÿ\s]+)\s+(?:vs|x|-)\s+([A-Za-zÀ-ÿ\s]+)/i);
          if (teamsMatch) {
            // Try to extract league name (before the teams)
            const leagueMatch = line.match(/\d{1,2}:\d{2}\s+([A-Za-zÀ-ÿ\s]+?)\s+[A-Za-zÀ-ÿ]/);
            
            parsedGames.push({
              date: format(new Date(), 'dd/MM/yyyy'),
              time: timeMatch[0],
              league: leagueMatch?.[1]?.trim() || 'Liga',
              homeTeam: teamsMatch[1].trim(),
              awayTeam: teamsMatch[2].trim(),
              status: 'Not Started',
              selected: true,
            });
          }
        }
      });

      if (parsedGames.length === 0) {
        toast.warning('Nenhum jogo detectado. Verifique o formato do texto.');
      } else {
        setGames(parsedGames);
        toast.success(`${parsedGames.length} jogo(s) detectado(s). Revise os dados antes de importar.`);
        setTextInput('');
      }
    } catch (error) {
      console.error('Error parsing text:', error);
      toast.error('Erro ao processar texto');
    } finally {
      setProcessing(false);
    }
  };

  const toggleGameSelection = (index: number) => {
    setGames(prev => prev.map((game, i) => 
      i === index ? { ...game, selected: !game.selected } : game
    ));
  };

  const toggleAllGames = () => {
    const allSelected = games.every(g => g.selected);
    setGames(prev => prev.map(game => ({ ...game, selected: !allSelected })));
  };

  const updateGameField = (index: number, field: keyof GameData, value: string) => {
    setGames(prev => prev.map((game, i) => 
      i === index ? { ...game, [field]: value } : game
    ));
  };

  const fixImportedDates = async () => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    setProcessing(true);
    try {
      // Buscar todos os jogos do usuário
      const { data: allGames, error: fetchError } = await supabase
        .from('games')
        .select('id, date, time')
        .eq('owner_id', user.id);

      if (fetchError) throw fetchError;

      let fixed = 0;
      for (const game of allGames || []) {
        let needsUpdate = false;
        let newDate = game.date;
        let newTime = game.time;

        // Verificar se date parece ser número serial
        if (game.date && /^\d{5,}$/.test(game.date)) {
          const dateResult = parseDate(parseInt(game.date));
          const [day, month, year] = dateResult.date.split('/');
          newDate = `${year}-${month}-${day}`;
          needsUpdate = true;
        }

        // Verificar se time parece ser número serial (0.xxxxx)
        if (game.time && /^0\.\d+$/.test(game.time)) {
          const timeResult = parseTime(parseFloat(game.time));
          newTime = timeResult.time;
          needsUpdate = true;
        }

        if (needsUpdate) {
          const { error: updateError } = await supabase
            .from('games')
            .update({ date: newDate, time: newTime })
            .eq('id', game.id);

          if (!updateError) {
            fixed++;
          }
        }
      }

      if (fixed > 0) {
        toast.success(`${fixed} jogo(s) corrigido(s) com sucesso!`);
        onSuccess(); // Recarregar dados
      } else {
        toast.info('Nenhum jogo precisou de correção.');
      }
    } catch (error) {
      console.error('Error fixing dates:', error);
      toast.error('Erro ao corrigir datas importadas');
    } finally {
      setProcessing(false);
    }
  };

  const importGames = async () => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    const selectedGames = games.filter(g => g.selected);
    if (selectedGames.length === 0) {
      toast.warning('Selecione pelo menos um jogo para importar');
      return;
    }

    setImporting(true);
    let imported = 0;
    let duplicates = 0;

    try {
      // Check for existing games
      const { data: existingGames } = await supabase
        .from('games')
        .select('home_team, away_team, date, time')
        .eq('owner_id', user.id);

      for (const game of selectedGames) {
        // Convert DD/MM/YYYY to YYYY-MM-DD
        const [day, month, year] = game.date.split('/');
        const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

        // Check for duplicates
        const isDuplicate = existingGames?.some(
          existing => 
            existing.home_team === game.homeTeam &&
            existing.away_team === game.awayTeam &&
            existing.date === formattedDate &&
            existing.time === game.time
        );

        if (isDuplicate) {
          duplicates++;
          continue;
        }

        // Insert game
        const { error } = await supabase.from('games').insert({
          owner_id: user.id,
          date: formattedDate,
          time: game.time,
          league: game.league,
          home_team: game.homeTeam,
          away_team: game.awayTeam,
          status: game.status || 'Not Started',
        });

        if (error) {
          console.error('Error inserting game:', error);
        } else {
          imported++;
        }
      }

      // Update last import date
      await supabase
        .from('settings')
        .update({ last_import_date: new Date().toISOString() })
        .eq('owner_id', user.id);

      toast.success(
        `✅ Importação concluída!\n${imported} jogo(s) adicionado(s)${duplicates > 0 ? `\n${duplicates} duplicata(s) ignorada(s)` : ''}`
      );

      setGames([]);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error importing games:', error);
      toast.error('Erro ao importar jogos');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Jogos do Dia</DialogTitle>
          <DialogDescription>
            Importe múltiplos jogos de uma vez através de planilha Excel ou imagem
            {lastImportDate && (
              <span className="block mt-2 text-xs text-muted-foreground">
                Última importação: {format(new Date(lastImportDate), "dd/MM/yyyy HH:mm")}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="excel" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="excel">Planilha (.xlsx)</TabsTrigger>
            <TabsTrigger value="text">Texto/Colar</TabsTrigger>
          </TabsList>

          <TabsContent value="excel" className="space-y-4">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button variant="outline" onClick={downloadTemplate} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Modelo (.xlsx)
                </Button>
                <label className="flex-1">
                  <Button variant="default" className="w-full" disabled={processing} asChild>
                    <span>
                      {processing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileUp className="h-4 w-4 mr-2" />
                      )}
                      {processing ? 'Processando...' : 'Carregar Planilha'}
                    </span>
                  </Button>
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={processing}
                  />
                </label>
              </div>
              <Button 
                variant="outline" 
                onClick={fixImportedDates} 
                disabled={processing}
                className="w-full"
                size="sm"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Corrigindo...
                  </>
                ) : (
                  'Corrigir datas importadas anteriormente'
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="text" className="space-y-4">
            <div className="space-y-4">
              <Textarea
                placeholder="Cole aqui os dados dos jogos&#10;Formato: HH:mm Liga TimeCasa x TimeVisitante&#10;&#10;Exemplo:&#10;14:00 Brasileirão Flamengo x Palmeiras&#10;16:00 Premier League Arsenal vs Liverpool"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <Button 
                onClick={handleTextParse} 
                disabled={processing || !textInput.trim()}
                className="w-full"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Processar Texto'
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Cole uma lista de jogos copiada de sites como SofaScore, FlashScore, etc. O sistema tentará detectar automaticamente horário, times e liga.
            </p>
          </TabsContent>
        </Tabs>

        {games.length > 0 && (
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Jogos Detectados ({games.filter(g => g.selected).length}/{games.length})</h3>
              <Button variant="outline" size="sm" onClick={toggleAllGames}>
                {games.every(g => g.selected) ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Liga</TableHead>
                    <TableHead>Casa</TableHead>
                    <TableHead>Visitante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {games.map((game, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Checkbox
                          checked={game.selected}
                          onCheckedChange={() => toggleGameSelection(index)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            value={game.date}
                            onChange={(e) => updateGameField(index, 'date', e.target.value)}
                            className="w-28"
                            placeholder="DD/MM/AAAA"
                          />
                          {game.dateConverted && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap" title="Convertido de formato Excel">
                              ⏱
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            value={game.time}
                            onChange={(e) => updateGameField(index, 'time', e.target.value)}
                            className="w-20"
                            placeholder="HH:mm"
                          />
                          {game.timeConverted && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap" title="Convertido de formato Excel">
                              ⏱
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={game.league}
                          onChange={(e) => updateGameField(index, 'league', e.target.value)}
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={game.homeTeam}
                          onChange={(e) => updateGameField(index, 'homeTeam', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={game.awayTeam}
                          onChange={(e) => updateGameField(index, 'awayTeam', e.target.value)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button
              onClick={importGames}
              disabled={importing || games.filter(g => g.selected).length === 0}
              className="w-full"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                `Adicionar ${games.filter(g => g.selected).length} Selecionados ao Planejamento`
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
