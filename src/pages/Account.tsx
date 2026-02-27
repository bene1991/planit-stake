import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLogo } from '@/contexts/LogoContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { User, KeyRound, Palette, Link, Database, Loader2, Trophy, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { VTLogo } from '@/components/VTLogo';
import { LogoVariant } from '@/hooks/useLogoVariant';
import { NotificationSettings } from '@/components/NotificationSettings';
import { TelegramSettings } from '@/components/TelegramSettings';
import { PushNotificationSettings } from '@/components/PushNotificationSettings';
import { GoalSoundSelector } from '@/components/GoalSoundSelector';
import { ApiKeyModal } from '@/components/ApiKeyModal';
import { useSettings } from '@/hooks/useSettings';
import { fixLeagueNames } from '@/utils/fixLeagueNames';
import { LeagueManager } from '@/components/LeagueManager';
import { useSupabaseGames } from '@/hooks/useSupabaseGames';
import { RefreshIntervalSettings } from '@/components/RefreshIntervalSettings';
import { useOperationalSettings } from '@/hooks/useOperationalSettings';

export default function Account() {
  const { user } = useAuth();
  const { variant, setVariant } = useLogo();
  const { settings } = useSettings();
  const { games, refreshGames } = useSupabaseGames();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [fixingLeagues, setFixingLeagues] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showLeagueManager, setShowLeagueManager] = useState(false);

  const { settings: opSettings, updateSettings: updateOpSettings } = useOperationalSettings();
  const [editedOpSettings, setEditedOpSettings] = useState({
    metaMensalStakes: 30,
    stopDiarioStakes: 3,
    devolucaoMaximaPercent: 50,
    commissionRate: 4.5,
    stakeValueReais: 100,
  });

  useEffect(() => {
    if (opSettings) {
      setEditedOpSettings({
        metaMensalStakes: opSettings.metaMensalStakes,
        stopDiarioStakes: opSettings.stopDiarioStakes,
        devolucaoMaximaPercent: opSettings.devolucaoMaximaPercent,
        commissionRate: opSettings.commissionRate * 100,
        stakeValueReais: opSettings.stakeValueReais,
      });
    }
  }, [opSettings]);

  const handleSaveOpSettings = async () => {
    try {
      await updateOpSettings({
        metaMensalStakes: editedOpSettings.metaMensalStakes,
        stopDiarioStakes: editedOpSettings.stopDiarioStakes,
        devolucaoMaximaPercent: editedOpSettings.devolucaoMaximaPercent,
        commissionRate: editedOpSettings.commissionRate / 100,
        stakeValueReais: editedOpSettings.stakeValueReais,
      });
      toast.success('Configurações salvas!');
    } catch {
      toast.error('Erro ao salvar configurações');
    }
  };

  const logoVariants: { value: LogoVariant; label: string; description: string }[] = [
    { value: 'chart', label: 'Gráfico Ascendente', description: 'Logo com linha de tendência' },
    { value: 'candlestick', label: 'Candlesticks', description: 'Logo com padrão de velas' },
    { value: 'minimal', label: 'Minimalista', description: 'Design circular clean' },
  ];

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setLoading(false);

    if (error) {
      toast.error('Erro ao alterar senha: ' + error.message);
    } else {
      toast.success('Senha alterada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleFixLeagueNames = async () => {
    setFixingLeagues(true);
    try {
      const result = await fixLeagueNames();

      if (result.errors > 0) {
        toast.error(`Correção concluída com ${result.errors} erros`);
      } else if (result.updated > 0) {
        toast.success(`${result.updated} jogos corrigidos!`);
      } else {
        toast.info('Nenhum jogo precisava de correção');
      }

      // Log details to console for debugging
      console.log('Fix League Names Result:', result);
    } catch (error) {
      toast.error('Erro ao corrigir nomes das ligas');
      console.error(error);
    } finally {
      setFixingLeagues(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
          <User className="h-6 w-6 text-secondary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Minha Conta</h1>
          <p className="text-muted-foreground">Gerencie suas informações</p>
        </div>
      </div>

      <Card className="p-6 shadow-card">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-2">Informações da Conta</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-medium">E-mail:</span>
              <span>{user?.email}</span>
            </div>
          </div>
        </div>

        <div className="border-t pt-6 mb-6">
          <div className="mb-4 flex items-center gap-2">
            <Link className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">API Football</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Conecte sua API Key para importar jogos e estatísticas ao vivo
          </p>
          <Button
            type="button"
            onClick={() => setShowApiKeyModal(true)}
            variant={settings?.api_key ? 'outline' : 'default'}
          >
            {settings?.api_key ? 'API vinculada (editar)' : 'Vincular API'}
          </Button>
        </div>

        <div className="border-t pt-6 mb-6">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Manutenção de Dados</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Corrigir nomes de ligas antigas para incluir o país (ex: "Bundesliga" → "Germany - Bundesliga")
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleFixLeagueNames}
              disabled={fixingLeagues}
              variant="outline"
            >
              {fixingLeagues ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Corrigindo...
                </>
              ) : (
                'Corrigir Nomes das Ligas'
              )}
            </Button>
            <Button
              type="button"
              onClick={() => setShowLeagueManager(!showLeagueManager)}
              variant={showLeagueManager ? 'secondary' : 'outline'}
            >
              <Trophy className="mr-2 h-4 w-4" />
              {showLeagueManager ? 'Fechar Gerenciador' : 'Gerenciar Ligas'}
            </Button>
          </div>
        </div>

        {showLeagueManager && (
          <div className="border-t pt-6 mb-6">
            <LeagueManager
              games={games.map(g => ({
                id: g.id,
                league: g.league,
                homeTeam: g.homeTeam,
                awayTeam: g.awayTeam
              }))}
              onRefresh={refreshGames}
            />
          </div>
        )}

        <div className="border-t pt-6 mb-6">
          <div className="mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Estilo da Logo</h2>
          </div>

          <RadioGroup value={variant} onValueChange={(value) => setVariant(value as LogoVariant)}>
            <div className="grid gap-4">
              {logoVariants.map((option) => (
                <Label
                  key={option.value}
                  htmlFor={option.value}
                  className="flex items-center gap-4 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <VTLogo variant={option.value} className="h-12 w-12" />
                  <div className="flex-1">
                    <p className="font-medium">{option.label}</p>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </Label>
              ))}
            </div>
          </RadioGroup>
        </div>

        <div className="border-t pt-6">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Alterar Senha</h2>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </form>
        </div>
      </Card>

      {/* Configurações Operacionais */}
      <Card className="p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Configurações Operacionais</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Defina suas metas, limites de risco e parâmetros de operação
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="opStake">Valor da Stake (R$)</Label>
            <Input
              id="opStake"
              type="number"
              value={editedOpSettings.stakeValueReais}
              onChange={(e) => setEditedOpSettings(prev => ({ ...prev, stakeValueReais: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="opMeta">Meta mensal (stakes)</Label>
            <Input
              id="opMeta"
              type="number"
              value={editedOpSettings.metaMensalStakes}
              onChange={(e) => setEditedOpSettings(prev => ({ ...prev, metaMensalStakes: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="opStop">Stop diário (stakes)</Label>
            <Input
              id="opStop"
              type="number"
              value={editedOpSettings.stopDiarioStakes}
              onChange={(e) => setEditedOpSettings(prev => ({ ...prev, stopDiarioStakes: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="opDevol">Devolução máxima (%)</Label>
            <Input
              id="opDevol"
              type="number"
              value={editedOpSettings.devolucaoMaximaPercent}
              onChange={(e) => setEditedOpSettings(prev => ({ ...prev, devolucaoMaximaPercent: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="opComissao">Comissão da casa (%)</Label>
            <Input
              id="opComissao"
              type="number"
              step="0.1"
              value={editedOpSettings.commissionRate}
              onChange={(e) => setEditedOpSettings(prev => ({ ...prev, commissionRate: Number(e.target.value) }))}
            />
          </div>
        </div>
        <Button type="button" onClick={handleSaveOpSettings} className="w-full mt-4">
          Salvar Configurações
        </Button>
      </Card>

      <RefreshIntervalSettings />
      <GoalSoundSelector />
      <TelegramSettings />
      <PushNotificationSettings />
      <NotificationSettings />

      <ApiKeyModal open={showApiKeyModal} onOpenChange={setShowApiKeyModal} />
    </div>
  );
}
