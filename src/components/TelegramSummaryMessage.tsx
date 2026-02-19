import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Send, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';
import { Game, Method } from '@/types';
import { format } from 'date-fns';

interface SummaryItem {
  homeTeam: string;
  awayTeam: string;
  league: string;
  time: string;
  market: string;
  result: 'Green' | 'Red';
  stakePercent: number | null; // null = sem dados para calcular
}

interface TelegramSummaryMessageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  games: Game[];
  methods: Method[];
  date: string; // yyyy-MM-dd
}

function buildSummaryItems(games: Game[], methods: Method[]): SummaryItem[] {
  const targetNames = ['Lay 0x1', 'Lay 1x0'];
  const items: SummaryItem[] = [];

  for (const game of games) {
    for (const op of game.methodOperations) {
      if (!op.result) continue;
      const method = methods.find(m => m.id === op.methodId);
      if (!method || !targetNames.includes(method.name)) continue;

      let stakePercent: number | null = null;
      if (op.profit != null && op.stakeValue && op.stakeValue > 0) {
        stakePercent = (op.profit / op.stakeValue) * 100;
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

  // Format date dd/mm/aaaa
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

  // Totalizador
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

export function TelegramSummaryMessage({ open, onOpenChange, games, methods, date }: TelegramSummaryMessageProps) {
  const { settings } = useSettings();
  const [sending, setSending] = useState(false);

  const items = buildSummaryItems(games, methods);
  const message = buildSummaryMessage(items, date);

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
