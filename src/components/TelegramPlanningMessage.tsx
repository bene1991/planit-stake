import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';
import { Game, Method } from '@/types';

interface TelegramGame {
  homeTeam: string;
  awayTeam: string;
  league: string;
  time: string;
  market: string;
  entryOdds?: number;
}

interface TelegramPlanningMessageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  games: Game[];
  methods: Method[];
}

function buildTelegramGames(games: Game[], methods: Method[]): TelegramGame[] {
  const targetNames = ['Lay 0x1', 'Lay 1x0'];
  const result: TelegramGame[] = [];

  for (const game of games) {
    for (const op of game.methodOperations) {
      const method = methods.find(m => m.id === op.methodId);
      if (method && targetNames.includes(method.name)) {
        result.push({
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          league: game.league,
          time: game.time,
          market: method.name,
          entryOdds: op.entryOdds,
        });
      }
    }
  }

  return result;
}

function buildMessage(telegramGames: TelegramGame[]): string {
  if (telegramGames.length === 0) return '';

  let msg = '📊 PLANEJAMENTO DO DIA\n';

  for (const g of telegramGames) {
    const oddText = g.entryOdds ? g.entryOdds.toFixed(2) : 'A definir';
    msg += `\n🏟 Jogo: ${g.homeTeam} x ${g.awayTeam}`;
    msg += `\n📍 Liga: ${g.league}`;
    msg += `\n⏰ Horário: ${g.time}`;
    msg += `\n🎯 Mercado: ${g.market}`;
    msg += `\n💰 Odd mínima para entrada: ${oddText}`;
    msg += `\n⏱ Entrada somente com jogo em 0x0`;
    msg += `\n📈 Responsabilidade: consultar planilha de alavancagem`;
    msg += '\n';
  }

  msg += '\n---\n';
  msg += '\n⚙️ Regras da operação:';
  msg += '\n• Operar apenas um placar por jogo';
  msg += '\n• Não entrar fora da odd definida';
  msg += '\n';
  msg += '\n💸 Gestão de banca (orientação):';
  msg += '\n• Iniciar ciclo com no máximo 1% da banca';
  msg += '\n• Seguir progressão da planilha sem improvisar';
  msg += '\n• Ao atingir 100%, resetar para a responsabilidade inicial';
  msg += '\n• Nunca ultrapassar o risco pré-definido';
  msg += '\n• Só aumentar a stake inicial após atingir pelo menos 500% de resultado acumulado';
  msg += '\n• Ao aumentar, nunca elevar mais do que 30% da stake atual';

  return msg;
}

export function TelegramPlanningMessage({ open, onOpenChange, games, methods }: TelegramPlanningMessageProps) {
  const { settings } = useSettings();
  const [sending, setSending] = useState(false);

  const telegramGames = buildTelegramGames(games, methods);
  const message = buildMessage(telegramGames);

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
        toast.success('✅ Mensagem enviada ao Telegram!');
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
            <Send className="h-5 w-5 text-primary" />
            Planejamento Diário - Telegram
          </DialogTitle>
        </DialogHeader>

        {telegramGames.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Nenhum jogo encontrado com método Lay 0x1 ou Lay 1x0 hoje.
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

export { buildTelegramGames };
