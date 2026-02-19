import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Copy, Send, FileText, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';
import { Game, Method } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { calculateProfit } from '@/utils/profitCalculator';
import { getNowInBrasilia } from '@/utils/timezone';
import { useOperationalSettings } from '@/hooks/useOperationalSettings';

interface SummaryItem {
  homeTeam: string;
  awayTeam: string;
  league: string;
  time: string;
  market: string;
  result: 'Green' | 'Red';
  stakePercent: number | null;
}

interface TelegramSummaryMessageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  games: Game[];
  methods: Method[];
}

function buildSummaryItems(games: Game[], methods: Method[], stakeReference: number): SummaryItem[] {
  const targetNames = ['Lay 0x1', 'Lay 1x0'];
  const items: SummaryItem[] = [];

  for (const game of games) {
    for (const op of game.methodOperations) {
      if (!op.result) continue;
      const method = methods.find(m => m.id === op.methodId);
      if (!method || !targetNames.includes(method.name)) continue;

      let stakePercent: number | null = null;

      if (op.profit != null) {
        stakePercent = (op.profit / stakeReference) * 100;
      } else if (op.stakeValue && op.odd && op.operationType && op.result) {
        const profit = calculateProfit({
          stakeValue: op.stakeValue,
          odd: op.odd,
          operationType: op.operationType,
          result: op.result,
          commissionRate: op.commissionRate ?? 0.045,
        });
        if (profit !== 0 || op.result === 'Red') {
          stakePercent = (profit / stakeReference) * 100;
        }
      }

      items.push({
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        league: game.league,
        time: game.time,
        market: method.name,
        result: op.result,
        stakePercent,
      });
    }
  }

  return items;
}

function buildSummaryMessage(items: SummaryItem[], dateStr: string): string {
  if (items.length === 0) return '';

  const [year, month, day] = dateStr.split('-');
  const formattedDate = `${day}/${month}/${year}`;

  let msg = `📋 RESUMO DO DIA - ${formattedDate}\n`;

  for (const item of items) {
    const emoji = item.result === 'Green' ? '✅' : '❌';
    let resultText: string = item.result;
    if (item.stakePercent !== null) {
      const sign = item.stakePercent >= 0 ? '+' : '';
      resultText = `${item.result} | ${sign}${item.stakePercent.toFixed(1)}% de stake`;
    }

    msg += `\n🏟 ${item.homeTeam} x ${item.awayTeam}`;
    msg += `\n📍 ${item.league}`;
    msg += `\n⏰ Horário: ${item.time}`;
    msg += `\n🎯 Mercado: ${item.market}`;
    msg += `\n${emoji} ${resultText}`;
    msg += '\n';
  }

  const greens = items.filter(i => i.result === 'Green').length;
  const reds = items.filter(i => i.result === 'Red').length;
  const total = items.length;
  const winRate = total > 0 ? ((greens / total) * 100).toFixed(1) : '0.0';

  const totalStakePercent = items.reduce((sum, i) => {
    if (i.stakePercent !== null) return sum + i.stakePercent;
    return sum;
  }, 0);

  const hasStakeData = items.some(i => i.stakePercent !== null);

  msg += '\n---\n';
  msg += '\n📊 Totalizador:';
  msg += `\n• Operações: ${total} (${greens} Green, ${reds} Red)`;
  msg += `\n• Win Rate: ${winRate}%`;
  if (hasStakeData) {
    const sign = totalStakePercent >= 0 ? '+' : '';
    msg += `\n• Resultado: ${sign}${totalStakePercent.toFixed(1)}% de stake`;
  }
  msg += '\n\nBons trades!';

  return msg;
}

export function TelegramSummaryMessage({ open, onOpenChange, games, methods }: TelegramSummaryMessageProps) {
  const { settings } = useSettings();
  const { settings: opSettings } = useOperationalSettings();
  const [sending, setSending] = useState(false);

  // Default to yesterday in Brasilia
  const now = getNowInBrasilia();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const [selectedDate, setSelectedDate] = useState<Date>(yesterday);

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const filteredGames = games.filter(g => g.date === selectedDateStr);

  const stakeReference = opSettings.stakeValueReais;
  const items = buildSummaryItems(filteredGames, methods, stakeReference);
  const message = buildSummaryMessage(items, selectedDateStr);

  const hasTelegramConfig = settings?.telegram_bot_token && settings?.telegram_chat_id;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success('📋 Mensagem copiada!');
    } catch {
      toast.error('Erro ao copiar mensagem');
    }
  };

  const handleSendTelegram = async () => {
    if (!settings?.telegram_bot_token || !settings?.telegram_chat_id) {
      toast.error('Configure o Telegram em Conta → Configurações do Telegram');
      return;
    }

    setSending(true);
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: settings.telegram_chat_id,
            text: message,
          }),
        }
      );

      const data = await response.json();

      if (data.ok) {
        toast.success('✅ Resumo enviado ao Telegram!');
        onOpenChange(false);
      } else {
        toast.error('Erro do Telegram: ' + data.description);
      }
    } catch (error: any) {
      toast.error('Erro ao enviar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Resumo do Dia - Telegram
          </DialogTitle>
        </DialogHeader>

        {/* Date Picker */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Data:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                {format(selectedDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                locale={ptBR}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Nenhuma operação finalizada com Lay 0x1 ou Lay 1x0 nesta data.
          </p>
        ) : (
          <>
            <Textarea
              readOnly
              value={message}
              className="flex-1 min-h-[300px] text-xs font-mono resize-none"
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleCopy}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
              <Button
                onClick={handleSendTelegram}
                disabled={sending || !hasTelegramConfig}
                title={!hasTelegramConfig ? 'Configure o Telegram nas configurações' : ''}
              >
                <Send className="h-4 w-4 mr-2" />
                {sending ? 'Enviando...' : 'Enviar ao Telegram'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
