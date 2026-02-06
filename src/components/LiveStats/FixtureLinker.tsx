import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Link2, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FixtureLinkerProps {
  gameId: string;
  gameDate: string;
  homeTeam: string;
  awayTeam: string;
  currentFixtureId?: string | null;
  onLinked?: () => void;
}

export function FixtureLinker({ gameId, currentFixtureId, onLinked }: FixtureLinkerProps) {
  const [fixtureId, setFixtureId] = useState(currentFixtureId || '');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSave = async () => {
    if (!fixtureId.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({ api_fixture_id: fixtureId.trim() })
        .eq('id', gameId);

      if (error) throw error;
      toast.success('Fixture vinculado!');
      setOpen(false);
      onLinked?.();
    } catch {
      toast.error('Erro ao vincular fixture');
    } finally {
      setSaving(false);
    }
  };

  if (currentFixtureId) {
    return (
      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
        <Link2 className="h-3 w-3" />
        #{currentFixtureId}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground">
          <Link2 className="h-3 w-3 mr-1" />
          Vincular
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        <div className="space-y-2">
          <p className="text-xs font-medium">ID do Fixture (API-Football)</p>
          <div className="flex gap-2">
            <Input
              value={fixtureId}
              onChange={(e) => setFixtureId(e.target.value)}
              placeholder="Ex: 1234567"
              className="h-8 text-xs"
            />
            <Button size="sm" className="h-8" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
